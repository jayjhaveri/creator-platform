import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';
import { Campaign } from '../types/schema';
import logger from '../utils/logger'; // Import logger utility
import { log } from 'console';

export async function campaignManager({
    operation,
    payload,
    brandId,
}: {
    operation: 'create' | 'read' | 'update' | 'delete';
    payload: any;
    brandId: string;
}) {
    const now = new Date().toISOString();
    const campaignRef = db.collection('campaigns');

    try {
        logger.info(`Starting operation: ${operation} for brandId: ${brandId}`);

        switch (operation) {
            case 'create': {
                const campaignId = uuidv4();
                const newCampaign: Campaign = {
                    campaignId,
                    brandId,
                    campaignName: payload.campaignName,
                    description: payload.description,
                    budget: payload.budget,
                    targetAudience: payload.targetAudience,
                    deliverables: payload.deliverables,
                    startDate: payload.startDate,
                    endDate: payload.endDate,
                    status: 'draft', // default status on creation
                    targetCreatorCategories: payload.targetCreatorCategories || [],
                    createdAt: now,
                    updatedAt: now,
                };
                await campaignRef.doc(campaignId).set(newCampaign);
                logger.info(`Campaign created successfully with ID: ${campaignId}`);
                return { status: 'created', campaignId };
            }

            case 'read': {
                const snapshot = await campaignRef
                    .where('brandId', '==', brandId)
                    .orderBy('createdAt', 'desc')
                    .get();
                logger.info(`Read operation completed for brandId: ${brandId}, retrieved ${snapshot.docs.length} campaigns.`);
                return snapshot.docs.map((doc) => doc.data() as Campaign);
            }

            case 'update': {
                const { campaignId, updates } = payload;

                if (!campaignId || !updates || typeof updates !== 'object') {
                    throw new Error('Missing or invalid update payload: campaignId and updates are required.');
                }


                logger.info(`Updating campaign with ID: ${campaignId}`);
                logger.debug(`Updates: ${JSON.stringify(updates)}`);
                const campaignDoc = campaignRef.doc(campaignId);

                await campaignDoc.update({ ...updates, updatedAt: now });
                logger.info(`Campaign updated successfully with ID: ${campaignId}`);
                return { status: 'updated', campaignId };
            }

            case 'delete': {
                const { campaignId } = payload;
                await campaignRef.doc(campaignId).delete();
                logger.info(`Campaign deleted successfully with ID: ${campaignId}`);
                return { status: 'deleted', campaignId };
            }

            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }
    } catch (error) {
        logger.error(`Error during operation: ${operation} for brandId: ${brandId}`, error);
        throw error;
    }
}