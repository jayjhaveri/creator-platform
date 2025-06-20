// followUpService.ts
import { db } from '../config/firebase';
import { EmailMessage, generateNextEmail } from '../utils/generateEmailContent';
import { Negotiation, Creator, Campaign, Brand, Communication } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '../utils/sendEmail';
import logger from '../utils/logger';

export const processEmailFollowUp = async (negotiationId: string) => {
    const negotiationRef = db.collection('negotiations').doc(negotiationId);
    const negotiationSnap = await negotiationRef.get();
    if (!negotiationSnap.exists) throw new Error('Negotiation not found');
    const negotiation = negotiationSnap.data() as Negotiation;

    const creatorSnapPromise = db.collection('creators').doc(negotiation.creatorId).get();
    const campaignSnapPromise = db.collection('campaigns').doc(negotiation.campaignId).get();

    try {
        // Use where for brandId instead of doc
        const brandQuerySnap = await db.collection('brands')
            .where('brandId', '==', negotiation.brandId)
            .limit(1)
            .get();

        if (brandQuerySnap.empty) {
            throw new Error('Brand not found');
        }

        const brandSnap = brandQuerySnap.docs[0];

        const [creatorSnap, campaignSnap] = await Promise.all([
            creatorSnapPromise,
            campaignSnapPromise,
        ]);

        if (!creatorSnap.exists || !campaignSnap.exists) {
            throw new Error('Associated documents missing');
        }

        const creator = creatorSnap.data() as Creator;
        const brand = brandSnap.data() as Brand;
        const campaign = campaignSnap.data() as Campaign;

        const repliesSnap = await db
            .collection('communications')
            .where('negotiationId', '==', negotiationId)
            .where('direction', '==', 'inbound')
            .where('status', '==', 'replied')
            .get();

        if (!repliesSnap.empty) return { skipped: true, reason: 'Creator has replied' };

        const lastOutboundSnap = await db
            .collection('communications')
            .where('negotiationId', '==', negotiationId)
            .where('direction', '==', 'outbound')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        const previousEmail = lastOutboundSnap.docs[0]?.data() as Communication | undefined;

        const history = await db.collection('communications')
            .where('negotiationId', '==', negotiationId)
            .orderBy('createdAt', 'asc')
            .get()
            .then(snapshot => snapshot.docs.map(doc => doc.data() as Communication));

        logger.info('Negotiation history:', history);


        const emailHistory: EmailMessage[] = history.map(comm => ({
            sender: comm.direction === 'inbound' ? "creator" : "brand",
            subject: comm.subject,
            body: comm.content,
        }));

        const { subject, body } = await generateNextEmail({
            brand,
            creator,
            campaign,
            history: emailHistory,
        });


        const brandEmailPrefix = brand.email.split('@')[0].replace(/\W/g, '');
        const fromEmail = `${brandEmailPrefix}--${negotiationId}@techable.in`;
        const replyToEmail = `${brandEmailPrefix}--${negotiationId}@parse.techable.in`;
        const now = new Date().toISOString();
        const communicationId = uuidv4();

        const messageId = `<${uuidv4()}@techable.in>`;

        const fromName = `${brand.brandName} via CreatorPlatform`;


        await sendEmail({
            to: creator.email,
            from: {
                email: fromEmail,
                name: fromName,
            },
            subject,
            text: body,
            replyTo: {
                email: replyToEmail,
                name: `${fromName}`,
            },
            headers: {
                'Message-ID': messageId,
                'X-Negotiation-ID': negotiationId,
                'X-Brand-ID': brand.brandId,
                'X-Campaign-ID': campaign.campaignId,
            },
        });

        const communication: Communication = {
            communicationId,
            negotiationId,
            type: 'email',
            direction: 'outbound',
            status: 'sent',
            subject,
            content: body,
            aiAgentUsed: true,
            voiceCallDuration: 0,
            voiceCallSummary: '',
            followUpRequired: false,
            followUpDate: '',
            createdAt: now,
            messageId: messageId
        };

        await db.collection('communications').doc(communicationId).set(communication);
        await db.collection('negotiations').doc(negotiationId).update({ updatedAt: now });

        return { success: true };
    } catch (error) {
        logger.error('Error processing email follow-up:', error);
        throw error;
    }
};
