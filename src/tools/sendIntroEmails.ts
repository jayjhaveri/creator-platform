import { db } from '../config/firebase';
import { Campaign, Creator, Brand } from '../types/schema';
import { sendInitialEmail } from '../agents/emailAgent';
import { creatorAssignmentsService } from '../services/creatorAssignmentsService';
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

        const brandRef = await db.collection('brands').where('brandId', '==', campaign.brandId).get();
        if (brandRef.empty) {
            throw new Error(`Brand with ID ${campaign.brandId} not found.`);
        }
        const brandDoc = brandRef.docs[0];
        const brand = brandDoc.data() as Brand;

        const results: string[] = [];
        const dashboardLink = `https://influenzer-flow-dashboard.lovable.app/campaigns/${campaignId}`;

        for (const creatorId of creatorIds) {
            const alreadyAssigned = await creatorAssignmentsService.isCreatorAssigned(
                campaign.brandId,
                creatorId,
                campaignId
            );

            if (alreadyAssigned) {
                results.push(`ℹ️ Email already sent to ${creatorId}. Skipping.`);
                continue;
            }

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

            // Send email
            // Fire and forget: send email and record assignment sequentially, but don't await
            (async () => {
                await sendInitialEmail(creator, campaign, brand, negotiationId);
                await creatorAssignmentsService.createOrUpdateAssignment(
                    campaign.brandId,
                    creatorId,
                    campaignId
                );
            })();

            results.push(`✅ Email sent to ${creator.email}`);
        }

        results.push(`📍 View campaign progress: ${dashboardLink}`);
        logger.info(`📤 Email dispatch summary for campaign ${campaignId}:\n${results.join('\n')}`);

        return { success: true, details: results };
    } catch (error: any) {
        logger.error(`Failed to send intro emails: ${error.message}`);
        return { success: false, details: [error.message] };
    }
}