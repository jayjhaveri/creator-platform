import { db } from '../config/firebase';
import { Campaign, Creator, Brand } from '../types/schema';
import { sendInitialEmail } from '../agents/emailAgent';
import logger from '../utils/logger';

export async function sendEmailsToCreators({
    creatorIds,
    campaignId,
}: {
    creatorIds: string[];
    campaignId: string;
}): Promise<{ success: boolean; details: string[] }> {
    try {
        const campaignSnap = await db.collection('campaigns').doc(campaignId).get();
        if (!campaignSnap.exists) {
            throw new Error(`Campaign ${campaignId} not found.`);
        }
        const campaign = campaignSnap.data() as Campaign;

        const brandSnap = await db.collection('brands').doc(campaign.brandId).get();
        if (!brandSnap.exists) {
            throw new Error(`Brand ${campaign.brandId} not found.`);
        }
        const brand = brandSnap.data() as Brand;

        const results: string[] = [];

        for (const creatorId of creatorIds) {
            const creatorSnap = await db.collection('creators').doc(creatorId).get();
            if (!creatorSnap.exists) {
                results.push(`❌ Creator ${creatorId} not found.`);
                continue;
            }

            const creator = creatorSnap.data() as Creator;

            const negotiationRef = db.collection('negotiations').doc();
            const negotiationId = negotiationRef.id;
            const now = new Date().toISOString();

            await negotiationRef.set({
                negotiationId,
                campaignId,
                brandId: brand.brandId,
                creatorId,
                status: 'initiated',
                proposedRate: 0,
                counterRate: 0,
                finalRate: 0,
                maxBudget: campaign.budget,
                deliverables: [],
                aiAgentNotes: '',
                creatorAvailability: 'unknown',
                initialContactMethod: 'email',
                phoneContactAttempted: false,
                voiceCallCompleted: false,
                createdAt: now,
                updatedAt: now,
                escalationCount: 0,
            });

            await sendInitialEmail(creator, campaign, brand, negotiationId);
            results.push(`✅ Email sent to ${creator.email}`);
        }

        return { success: true, details: results };
    } catch (error: any) {
        logger.error(`Failed to send intro emails: ${error.message}`);
        return { success: false, details: [error.message] };
    }
}
