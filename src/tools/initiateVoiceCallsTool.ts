import { SessionStateManager } from "../agents/orchestratorAgent";
import { creatorAssignmentsService } from "../services/creatorAssignmentsService";
import { createNegotiation, getNegotiationByCampaignId } from "../services/negotiationsService";
import { startCallInternal } from "../services/voiceAgent/initiateVoiceAgent";
import { saveToolLog } from "../utils/chatHistory";
import logger from "../utils/logger";


export const initiateVoiceCallsSchema = {
    name: 'initiateVoiceCalls',
    description: `Initiate voice calls to creators if they’ve shared their phone number and a negotiation exists or can be created.`,
    zodSchema: {
        creatorIds: ['string[]', 'List of creator IDs'],
        campaignId: ['string', 'Campaign ID associated with the creators'],
    },
};

export function getInitiateVoiceCallsHandler(sessionId: string) {
    return async function ({ creatorIds, campaignId }: { creatorIds: string[]; campaignId: string }) {
        logger.info(`Starting initiateVoiceCalls handler for sessionId: ${sessionId}`);

        const brandId = await SessionStateManager.get(sessionId, 'brandId');
        if (!brandId) {
            logger.error('Missing brandId in session');
            throw new Error('Missing brandId in session');
        }

        const summary: string[] = [];

        for (const creatorId of creatorIds) {
            try {
                logger.info(`Processing creatorId: ${creatorId}`);
                const assignment = await creatorAssignmentsService.getCreatorAssignment(brandId, creatorId);
                if (!assignment?.phoneDiscovered || !assignment.phone) {
                    logger.warn(`No phone number shared for creator ${creatorId}`);
                    summary.push(`❌ ${creatorId}: No phone number shared.`);
                    continue;
                }

                logger.info(`Phone number found for creatorId: ${creatorId}`);

                const negotiations = await getNegotiationByCampaignId(campaignId) as any[];
                let negotiation = negotiations.find(n => n.creatorId === creatorId);

                if (!negotiation) {
                    logger.info(`No existing negotiation found for creatorId: ${creatorId}, creating a new one.`);
                    summary.push(`❌ ${creatorId}: No phone number shared.`);
                    continue;
                } else {
                    logger.info(`Existing negotiation found for creatorId: ${creatorId}`);
                }

                await startCallInternal(
                    negotiation.negotiationId || negotiation.id,
                    assignment.phone
                );

                logger.info(`Call successfully initiated for creatorId: ${creatorId}`);
                summary.push(`✅ ${creatorId}: Call initiated.`);
            } catch (err: any) {
                logger.error(`Error processing creatorId: ${creatorId} - ${err.message}`);
                summary.push(`⚠️ ${creatorId}: Error - ${err.message}`);
            }
        }

        const response = summary.join('\n');
        logger.info(`Final summary for initiateVoiceCalls: \n${response}`);
        await saveToolLog(sessionId, 'initiateVoiceCalls', response);
        return response;
    };
}