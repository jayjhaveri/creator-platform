// src/tools/creatorSearch.ts
import { getFirestore } from 'firebase-admin/firestore';
import logger from '../utils/logger';
import { generateEmbeddingsForChunks } from '../services/embeddingService';

const db = getFirestore();

export interface CreatorMatch {
    id: string;
    displayName: string;
    instagramHandle: string;
    youtubeHandle: string;
    category: string;
    instagramFollowers: number;
    youtubeSubscribers: number;
    similarityScore: number;
    email?: string; // Optional, in case not all creators have an email
}

/**
 * Finds creators matching a campaign by semantic similarity and optional filters.
 * Embeds the campaign context in chunks, searches creator chunks, and aggregates results.
 * @param params.campaignId - ID of the campaign to match against
 * @returns array of CreatorMatch objects
 */
export async function findMatchingCreators({ campaignId }: { campaignId: string }): Promise<CreatorMatch[]> {
    try {
        logger.info(`🔍 Fetching campaign data for ID: ${campaignId}`);
        const campaignSnap = await db.collection('campaigns').doc(campaignId).get();
        if (!campaignSnap.exists) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }
        const campaign = campaignSnap.data()!;

        // Combine key fields for embedding
        const contextText = `${campaign.description || ''} ${campaign.targetAudience || ''}`;
        logger.info('🧠 Splitting and embedding campaign context into chunks');
        const chunks = await generateEmbeddingsForChunks(contextText);
        if (chunks.length === 0) {
            logger.warn('⚠️ No text chunks generated for embedding');
            return [];
        }

        // Aggregate similarity scores per creator
        const scoreMap = new Map<string, number>();
        for (const { embedding, chunkIndex } of chunks) {
            logger.info(`📁 Querying vector search for chunk ${chunkIndex}`);
            const snapshot = await db.collection('chunks')
                .where('parentCollection', '==', 'creators')
                .findNearest({
                    vectorField: 'vectorEmbedding',
                    queryVector: embedding,
                    limit: 25,
                    distanceMeasure: 'COSINE',
                    distanceResultField: 'similarityScore',
                })
                .get();

            logger.info(`📦 Retrieved ${snapshot.size} results for chunk ${chunkIndex}`);

            for (const doc of snapshot.docs) {
                const creatorId = doc.get('sourceId') as string;
                const score = doc.get('similarityScore') as number;
                const existing = scoreMap.get(creatorId) ?? 0;
                scoreMap.set(creatorId, (scoreMap.get(creatorId) ?? 0) + score);
            }
        }

        if (scoreMap.size === 0) {
            logger.info('❌ No matching creators found');
            return [];
        }

        // Sort creators by descending score and take top 10
        const sorted = Array.from(scoreMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const results: CreatorMatch[] = [];
        for (const [creatorId, similarityScore] of sorted) {
            const docSnap = await db.collection('creators').doc(creatorId).get();
            if (!docSnap.exists) {
                logger.warn(`⚠️ Creator doc not found for ID: ${creatorId}`);
                continue;
            }
            const c = docSnap.data()!;
            results.push({
                id: creatorId,
                displayName: c.displayName,
                email: c.email,
                instagramHandle: c.instagramHandle,
                youtubeHandle: c.youtubeHandle,
                category: c.category,
                instagramFollowers: c.instagramFollowers,
                youtubeSubscribers: c.youtubeSubscribers,
                similarityScore,
            });
        }

        logger.info(`✅ Found ${results.length} matching creators`);
        return results;
    } catch (error) {
        logger.error(`❌ Error in findMatchingCreators for campaignId: ${campaignId}`, error);
        throw error;
    }
}