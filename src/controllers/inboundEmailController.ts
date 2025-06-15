import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { Brand, Campaign, Communication, Creator, Negotiation } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';
import { analyzeInboundReply } from '../agents/replyAgent';
import { EmailMessage, generateNextEmail } from '../utils/generateEmailContent';
import sgMail from '@sendgrid/mail';
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import logger from '../utils/logger';
import { parseOneAddress } from 'email-addresses';
import { init } from 'groq-sdk/_shims';
import { initiateVoiceAgent, scheduleInitiateCallViaCloudTask } from '../services/voiceAgent/initiateVoiceAgent';
import { sendWhatsAppReply } from '../utils/whatsapp';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const tasksClient = new CloudTasksClient();
const QUEUE_NAME = 'creator-followups'; // your queue name
const QUEUE_LOCATION = 'us-central1'; // or your GCP region

const MAX_ESCALATIONS = 2;

export const handleInboundEmail = async (req: Request, res: Response) => {
    try {
        logger.info('Received inbound email request', req.body);
        const { from, to, subject, text, messageId, inReplyTo, references } = req.body;


        logger.info('Parsed message ID:', messageId);

        logger.info('Inbound email received `from`:', from);
        logger.info('Inbound email received `to`:', to);
        logger.info('Inbound email received `subject`:', subject);
        logger.info('Inbound email received `text`:', text);
        logger.info('Inbound email received `inReplyTo`:', inReplyTo);
        logger.info('Inbound email received `references`:', references);

        const toRaw: string = to || '';
        const parsedTo = parseOneAddress(toRaw);

        // Only proceed if parsedTo is a mailbox (not a group)
        if (!parsedTo || parsedTo.type !== 'mailbox' || !parsedTo.address) {
            return res.status(400).send('Invalid recipient format');
        }

        const toAddress = parsedTo.address;
        logger.info('Parsed recipient address:', toAddress);
        const match = toAddress.match(/^(.+?)--([a-zA-Z0-9_-]+)@parse\.techable\.in$/);

        const fromAddress = parseOneAddress(from || '');
        if (!fromAddress || fromAddress.type !== 'mailbox' || !fromAddress.address) {
            return res.status(400).send('Invalid sender format');
        }
        logger.info('Parsed sender address:', fromAddress.address);

        if (!match) {
            return res.status(400).send('Invalid recipient format');
        }

        const brandSlug = match[1];
        const negotiationId = match[2];
        logger.info('Parsed brand slug:', brandSlug);
        logger.info('Parsed negotiation ID:', negotiationId);

        const creatorEmail = fromAddress.address;
        logger.info('Parsed creator email:', creatorEmail);

        // Optional: verify the negotiation exists and matches the creator
        const negotiationDoc = await db.collection('negotiations').doc(negotiationId).get();
        if (!negotiationDoc.exists) {
            logger.warn(`Negotiation with ID ${negotiationId} not found`);
            return res.status(404).send('Negotiation not found');
        }
        const negotiation = negotiationDoc.data() as Negotiation;
        if (!negotiation || !negotiation.creatorId) {
            logger.warn(`Negotiation data incomplete for ID ${negotiationId}`);
            return res.status(404).send('Negotiation data incomplete');
        }
        const creatorDoc = await db.collection('creators').doc(negotiation.creatorId).get();
        if (!creatorDoc.exists || creatorDoc.data()?.email !== creatorEmail) {
            logger.warn(`Creator with ID ${negotiation.creatorId} not found or email mismatch for negotiation ${negotiationId}`);
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
            messageId: messageId || '',
            createdAt: now,
        };

        await db.collection('communications').doc(communicationId).set(communication);

        // Run LLM analysis to determine next steps
        const brandDoc = await db.collection('brands').where("brandId", "==", negotiation.brandId).limit(1).get();

        if (brandDoc.empty) {
            logger.warn(`Brand with ID ${negotiation.brandId} not found for negotiation ${negotiationId}`);
            return res.status(404).send('Brand not found');
        }
        const brandId = brandDoc.docs[0].id;
        logger.info('Brand ID found:', brandId);

        const brand = brandDoc.docs[0].data() as Brand;

        if (!brand) {
            logger.warn(`Brand with ID ${negotiation.brandId} not found for negotiation ${negotiationId}`);
            return res.status(404).send('Brand not found');
        }

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
        console.log('Previous outbound email:', previousEmail);


        const currentEscalations = negotiation.escalationCount || 0;

        // escalate but try again by asking for phone
        const campaignDoc = await db.collection('campaigns').doc(negotiation.campaignId).get();
        if (!campaignDoc.exists) {
            logger.warn(`Campaign with ID ${negotiation.campaignId} not found for negotiation ${negotiationId}`);
            return res.status(404).send('Campaign not found');
        }
        const campaign = campaignDoc.data() as Campaign;

        //create EmailMessage array from all communications with negotiationId
        const history = await db.collection('communications')
            .where('negotiationId', '==', negotiationId)
            .orderBy('createdAt', 'asc')
            .get()
            .then(snapshot => snapshot.docs.map(doc => doc.data() as Communication));


        const emailHistory: EmailMessage[] = history.map(comm => ({
            sender: comm.direction === 'inbound' ? "creator" : "brand",
            subject: comm.subject,
            body: comm.content,
        }));

        logger.info('Email history for negotiation:', emailHistory);

        const followUp = await generateNextEmail({
            brand: brand,
            creator: creator,
            campaign: campaign,
            history: emailHistory,
        });

        await sendFollowUpViaCloudTask({
            followUp, brand,
            creator, negotiationId, now, inReplyToMessageId: messageId,
            referencesHeader: references
        });

        await db.collection('negotiations').doc(negotiationId).update({
            escalationCount: currentEscalations + 1,
            updatedAt: now,
        });

        // Run AI analysis on the reply
        const analysis = await analyzeInboundReply(emailHistory, negotiation, creator, brand);

        // ✅ Update phone if found
        if (analysis.phoneNumber) {
            // Normalize phone number: keep digits, allow leading +
            let normalizedPhone = analysis.phoneNumber.trim();
            if (normalizedPhone.startsWith('+')) {
                normalizedPhone = '+' + normalizedPhone.slice(1).replace(/\D/g, '');
            } else {
                normalizedPhone = normalizedPhone.replace(/\D/g, '');
            }
            // Validate length (10-15 digits, not counting +)
            const digitsOnly = normalizedPhone.startsWith('+') ? normalizedPhone.slice(1) : normalizedPhone;
            if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
                logger.info(`Updating phone number for creator ${creator.creatorId}: ${normalizedPhone}`);
                //update collection called creatorAssignments, find doc as per brandId and creatorId
                const creatorAssignment = await db.collection('creatorAssignments').where('userId', '==', negotiation.brandId)
                    .where('creatorId', '==', negotiation.creatorId)
                    .get();

                if (!creatorAssignment.empty) {
                    const assignmentDoc = creatorAssignment.docs[0];
                    await db.collection('creatorAssignments').doc(assignmentDoc.id).update({
                        phone: normalizedPhone,
                        phoneDiscovered: true,
                        updatedAt: now,
                    });

                    //schedule task after 2 hours to initiate voice agent
                    // await scheduleInitiateCallViaCloudTask(negotiationId, normalizedPhone);

                } else {
                    logger.warn(`Phone number found but invalid length after normalization: ${analysis.phoneNumber} => ${normalizedPhone}`);
                }
            }
        }

        // ✅ Update AI notes
        await db.collection('negotiations').doc(negotiationId).update({
            aiAgentNotes: analysis.notes,
            updatedAt: now,
        });

        // ✅ Update status to in_progress
        await db.collection('negotiations').doc(negotiationId).update({
            status: analysis.action,
            updatedAt: now,
        });

        // Format WhatsApp notification message
        const whatsappMessage = `
📨 *New Creator Reply Received*

👤 *Creator*: ${creator.displayName || creator.creatorId}
📧 *Email*: ${creator.email}
📢 *Campaign*: ${campaign.campaignName}
📝 *Reply*:
${text?.slice(0, 400) || '[No content]'}

💡 *AI Notes*: ${analysis.notes}

📊 *Track Campaign Progress*:
https://influenzer-flow-dashboard.lovable.app/campaigns/${campaign.campaignId}
`.trim();

        // Send WhatsApp message to the brand's phone
        if (brand.phone) {
            await sendWhatsAppReply(brand.phone, whatsappMessage);
        } else {
            logger.warn(`Brand ${brand.brandId} does not have a phone number to send WhatsApp notification`);
        }

        res.status(200).send('Reply logged');
    } catch (err) {
        console.error('Inbound email error:', err);
        res.status(500).send('Failed to process inbound email');
    }
};

async function sendFollowUpViaCloudTask(
    { followUp, brand, creator, negotiationId, now, inReplyToMessageId, referencesHeader }: { followUp: { subject: string; body: string; }; brand: Brand; creator: Creator; negotiationId: string; now: string; inReplyToMessageId?: string; referencesHeader?: string; }) {
    const followUpId = uuidv4();
    const fromEmail = `${brand.email.split('@')[0].replace(/\W/g, '')}--${negotiationId}@techable.in`;
    const fromName = `${brand.brandName} via CreatorPlatform`;

    const followUpMessageId = `${followUpId}@techable.in`;

    const newReferences = buildReferences(referencesHeader, inReplyToMessageId);

    //print all request parameters
    logger.info('Sending follow-up email via Cloud Task with payload:', {
        followUpId,
        negotiationId,
        creatorEmail: creator.email,
        subject: followUp.subject,
        body: followUp.body,
        fromEmail,
        fromName,
        inReplyToMessageId,
        newReferences,
        messageId: followUpMessageId
    });

    const taskPayload = {
        to: creator.email,
        subject: followUp.subject,
        text: followUp.body,
        fromEmail,
        fromName,
        inReplyTo: inReplyToMessageId,
        references: newReferences,
        messageId: followUpMessageId
    };

    const parent = tasksClient.queuePath(process.env.GCP_PROJECT!, QUEUE_LOCATION, QUEUE_NAME);
    const task = {
        httpRequest: {
            httpMethod: protos.google.cloud.tasks.v2.HttpMethod.POST,
            url: `${process.env.API_BASE_URL}/inbound-email/send-followup`,
            headers: { 'Content-Type': 'application/json' },
            body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
        },
        scheduleTime: { seconds: Math.floor(Date.now() / 1000) + 30 },
    };

    await tasksClient.createTask({ parent, task });

    logger.info(`Created Cloud Task for follow-up email with ID: ${followUpId}`);
    //add 30 seconds to createdAt for follow-up
    const createdAt = new Date(Date.now() + 30 * 1000).toISOString();

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
        messageId: `<${followUpMessageId}>`,
        references: newReferences,
        createdAt: createdAt,
    });
}

export const sendFollowUpEmail = async (req: Request, res: Response) => {
    try {
        const { to, subject, text, fromEmail, fromName, inReplyTo, references = "", messageId } = req.body;

        logger.info('Sending follow-up email with body:', req.body);
        logger.info(`inReplyTo: ${inReplyTo}`);

        if (!to || !subject || !text || !fromEmail || !fromName) {
            return res.status(400).json({ error: 'Missing fields in request body' });
        }

        const msg: any = {
            to,
            from: {
                email: fromEmail,
                name: fromName,
            },
            subject,
            text,
            replyTo: {
                email: fromEmail.replace(/@.*$/, '@parse.techable.in'),
                name: fromName,
            },
        };

        if (inReplyTo || references) {
            msg.headers = {
                ...(inReplyTo && { 'In-Reply-To': `<${inReplyTo}>` }),
                ...(references && { 'References': references.startsWith('<') ? references : `<${references}>` }),
                ...(messageId && { 'Message-ID': `<${messageId}>` }),
            };
        }

        logger.info(`Sending follow-up email to ${to} from ${fromEmail}`);
        logger.info(`Reply-To set to ${msg.replyTo.email}`);

        await sgMail.send(msg);

        console.log(`[Follow-Up] Sent email to ${to}`);
        res.status(200).send('Follow-up email sent successfully');
    } catch (error) {
        console.error('Failed to send follow-up email:', error);
        res.status(500).send('Failed to send follow-up email');
    }
};

export function buildReferences(previous?: string, replyToId?: string): string {
    const cleanedPrevious = previous?.trim() || '';
    const cleanedReplyTo = replyToId ? `<${replyToId.replace(/^<|>$/g, '')}>` : '';
    return [cleanedPrevious, cleanedReplyTo].filter(Boolean).join(' ').trim();
}