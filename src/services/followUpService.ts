// followUpService.ts
import { db } from '../config/firebase';
import { generatePhoneRequestEmail } from '../utils/generateEmailContent';
import { Negotiation, Creator, Campaign, Brand, Communication } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '../utils/sendEmail';

export const processEmailFollowUp = async (negotiationId: string) => {
    const negotiationRef = db.collection('negotiations').doc(negotiationId);
    const negotiationSnap = await negotiationRef.get();
    if (!negotiationSnap.exists) throw new Error('Negotiation not found');
    const negotiation = negotiationSnap.data() as Negotiation;

    const [creatorSnap, brandSnap, campaignSnap] = await Promise.all([
        db.collection('creators').doc(negotiation.creatorId).get(),
        db.collection('brands').doc(negotiation.brandId).get(),
        db.collection('campaigns').doc(negotiation.campaignId).get(),
    ]);

    if (!creatorSnap.exists || !brandSnap.exists || !campaignSnap.exists) {
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

    const { subject, body } = await generatePhoneRequestEmail(
        brand,
        creator,
        campaign,
        previousEmail?.content ?? '',
        undefined // No previous email content provided
    );

    const brandEmailPrefix = brand.email.split('@')[0].replace(/\W/g, '');
    const fromEmail = `${brandEmailPrefix}--${negotiationId}@techable.in`;
    const now = new Date().toISOString();
    const communicationId = uuidv4();

    await sendEmail({
        to: creator.email,
        from: fromEmail,
        subject,
        text: body,
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
    };

    await db.collection('communications').doc(communicationId).set(communication);
    await db.collection('negotiations').doc(negotiationId).update({ updatedAt: now });

    return { success: true };
};
