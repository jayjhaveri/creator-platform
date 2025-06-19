import logger from '../utils/logger';
import { generateEmbeddingsForChunks } from '../services/embeddingService';
import { db } from '../config/firebase';


export async function getMatchingCampaignsByVector(userQuery: string, phone: string) {
    logger.info('🔍 Generating embedding for query:', userQuery);
    const [embedding] = await generateEmbeddingsForChunks(userQuery);

    if (!embedding || !Array.isArray(embedding.embedding) || embedding.embedding.length === 0) {
        logger.warn('⚠️ Invalid or empty embedding generated');
        return [];
    }

    logger.info(`✅ Embedding generated (length: ${embedding.embedding.length})`);
    logger.info('📁 Executing vector search in Firestore chunks...');

    const snapshot = await db
        .collection('chunks')
        .where('parentCollection', '==', 'campaigns')
        .findNearest({
            vectorField: 'vector',
            queryVector: embedding.embedding,
            limit: 5, // Fetch up to 5 matching campaigns
            distanceMeasure: 'COSINE',
            distanceResultField: 'similarityScore',
            distanceThreshold: 0.5,
        })
        .get();

    if (snapshot.empty) {
        logger.info('❌ No campaign match found for this query.');
        return [];
    }

    const results: any[] = [];

    for (const doc of snapshot.docs) {
        const campaignId = doc.get('sourceId');
        const similarityScore = doc.get('similarityScore');

        const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
        const campaignData = campaignDoc.data();
        //filter campaigns by phone number
        if (campaignDoc.exists && campaignData && campaignData.phone !== phone) {
            logger.info(`❌ Campaign with ID ${campaignId} does not match phone number ${phone}`);
            continue;
        }

        if (!campaignDoc.exists) {
            logger.warn(`⚠️ Campaign doc not found for ID: ${campaignId}`);
            continue;
        }

        const data = campaignDoc.data();
        results.push({
            id: campaignId,
            campaignName: data?.campaignName || '',
            description: data?.description || '',
            similarityScore,
        });
    }

    return results;
}