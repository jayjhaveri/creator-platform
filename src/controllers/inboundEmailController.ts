import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { Brand, Campaign, Communication, Creator, Negotiation } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';
import { analyzeInboundReply } from '../agents/replyAgent';
import { generatePhoneRequestEmail } from '../utils/generateEmailContent';
import sgMail from '@sendgrid/mail';
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import logger from '../utils/logger';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const tasksClient = new CloudTasksClient();
const QUEUE_NAME = 'creator-followups'; // your queue name
const QUEUE_LOCATION = 'us-central1'; // or your GCP region

export const handleInboundEmail = async (req: Request, res: Response) => {
    try {
        logger.info('Received inbound email request', req.body);
        const { from, to, subject, text } = req.body;

        logger.info('Inbound email received', {
            from,
            to,
            subject,
            text,
        });

        // Parse negotiationId and brand slug from "to" email address
        const toAddress = to?.toLowerCase();
        const match = toAddress?.match(/^(.+?)--([a-zA-Z0-9_-]+)@techable\.in$/);
        if (!match) return res.status(400).send('Invalid recipient format');

        const brandSlug = match[1];
        const negotiationId = match[2];

        const creatorEmail = from;

        // Optional: verify the negotiation exists and matches the creator
        const negotiationDoc = await db.collection('negotiations').doc(negotiationId).get();
        if (!negotiationDoc.exists) return res.status(404).send('Negotiation not found');

        const negotiation = negotiationDoc.data() as Negotiation;
        if (!negotiation || !negotiation.creatorId) {
            return res.status(404).send('Negotiation data incomplete');
        }
        const creatorDoc = await db.collection('creators').doc(negotiation.creatorId).get();
        if (!creatorDoc.exists || creatorDoc.data()?.email !== creatorEmail) {
            return res.status(403).send('Creator mismatch');
        }

        const creator = creatorDoc.data() as Creator;

        const communicationId = uuidv4();
        const now = new Date().toISOString();

        const communication: Communication = {
            communicationId,
            negotiationId,
            type: 'email',
            direction: 'inbound',
            status: 'replied',
            subject: subject || '',
            content: text || '',
            aiAgentUsed: false,
            voiceCallDuration: 0,
            voiceCallSummary: '',
            followUpRequired: false,
            followUpDate: '',
            createdAt: now,
        };

        await db.collection('communications').doc(communicationId).set(communication);

        // Run LLM analysis to determine next steps
        const brandDoc = await db.collection('brands').doc(negotiation.brandId).get();
        const brand = brandDoc.data() as Brand;

        if (!brand) {
            return res.status(404).send('Brand not found');
        }

        const analysis = await analyzeInboundReply(text || '', negotiation, creator, brand);

        // Fetch the latest outbound email for context
        const outboundSnapshot = await db
            .collection('communications')
            .where('negotiationId', '==', negotiationId)
            .where('direction', '==', 'outbound')
            .where('type', '==', 'email')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        const previousEmail = outboundSnapshot.docs[0]?.data() as Communication | undefined;

        // If phone is missing but agent wants to request it, send follow-up
        if (!analysis.phoneNumber && analysis.action === 'request_phone') {
            // Fetch campaign using negotiation.campaignId
            const campaignDoc = await db.collection('campaigns').doc(negotiation.campaignId).get();
            if (!campaignDoc.exists) {
                return res.status(404).send('Campaign not found');
            }
            const campaign = campaignDoc.data() as Campaign;

            const followUp = await generatePhoneRequestEmail(
                brand,
                creator,
                campaign,
                previousEmail?.content || '',
                text || ''
            );

            const followUpId = uuidv4();
            const fromEmail = `${brand.email.split('@')[0].replace(/\W/g, '')}--${negotiationId}@techable.in`;
            const fromName = `${brand.brandName} via CreatorPlatform`;

            const taskPayload = {
                to: creator.email,
                subject: followUp.subject,
                text: followUp.body,
                fromEmail,
                fromName,
            };

            const parent = tasksClient.queuePath(process.env.GCP_PROJECT!, QUEUE_LOCATION, QUEUE_NAME);

            const task = {
                httpRequest: {
                    httpMethod: protos.google.cloud.tasks.v2.HttpMethod.POST,
                    url: `${process.env.API_BASE_URL}/inbound-email/send-followup`,
                    headers: { 'Content-Type': 'application/json' },
                    body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
                },
                scheduleTime: {
                    seconds: Math.floor(Date.now() / 1000) + 30, // 30 second delay
                },
            };

            await tasksClient.createTask({ parent, task });

            await db.collection('communications').doc(followUpId).set({
                communicationId: followUpId,
                negotiationId,
                type: 'email',
                direction: 'outbound',
                status: 'sent',
                subject: followUp.subject,
                content: followUp.body,
                aiAgentUsed: true,
                voiceCallDuration: 0,
                voiceCallSummary: '',
                followUpRequired: false,
                followUpDate: '',
                createdAt: now,
            });
        }

        // If phone number found in reply, update creator (or manager)
        if (analysis.phoneNumber && /^\d{10,15}$/.test(analysis.phoneNumber)) {
            const targetField = creator.hasManager ? 'managerPhone' : 'phone';
            await db.collection('creators').doc(creator.creatorId).update({
                [targetField]: analysis.phoneNumber,
                updatedAt: now,
            });
        }

        // Log AI notes in negotiation
        await db.collection('negotiations').doc(negotiationId).update({
            aiAgentNotes: analysis.notes,
            updatedAt: now,
        });

        // Optional: logic to initiate voice call if analysis.action === 'initiate_call' can be added here

        await db.collection('negotiations').doc(negotiationId).update({
            status: 'in_progress',
            updatedAt: now,
        });

        res.status(200).send('Reply logged');
    } catch (err) {
        console.error('Inbound email error:', err);
        res.status(500).send('Failed to process inbound email');
    }
};

export const sendFollowUpEmail = async (req: Request, res: Response) => {
    try {
        const { to, subject, text, fromEmail, fromName } = req.body;

        if (!to || !subject || !text || !fromEmail || !fromName) {
            return res.status(400).json({ error: 'Missing fields in request body' });
        }

        await sgMail.send({
            to,
            from: {
                email: fromEmail,
                name: fromName,
            },
            subject,
            text,
        });

        console.log(`[Follow-Up] Sent email to ${to}`);
        res.status(200).send('Follow-up email sent successfully');
    } catch (error) {
        console.error('Failed to send follow-up email:', error);
        res.status(500).send('Failed to send follow-up email');
    }
};