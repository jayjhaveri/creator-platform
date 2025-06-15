import { Request, Response } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { generateEmbeddingsForChunks } from '../services/embeddingService';
import { upsertChunksToVectorStore } from '../services/vectorStore';
import logger from '../utils/logger';

const firestore = new Firestore();

export const handleFirestoreEvent = async (req: Request, res: Response) => {
    console.log('🔥 Webhook hit: /webhooks/firestore');

    try {
        const write = req.body?.protoPayload?.request?.writes?.[0];
        const docPath = write?.update?.name;

        if (!docPath) {
            console.warn('⚠️ Could not extract document path from event:', JSON.stringify(req.body, null, 2));
            return res.status(204).send('Invalid Firestore Audit Log payload');
        }

        const relativePath = docPath.split('/documents/')[1]; // e.g., brands/abc123
        const [collectionName, docId] = relativePath.split('/');

        console.log(`📄 Firestore doc path: ${docPath}`);
        console.log(`📁 Collection: ${collectionName}`);
        console.log(`🆔 Document ID: ${docId}`);

        const updateMask = write.updateMask?.fieldPaths || [];
        const isCreate = updateMask.length === 0;

        const docSnapshot = await firestore.doc(relativePath).get();
        if (!docSnapshot.exists) {
            console.warn(`⚠️ Document not found in Firestore: ${relativePath}`);
            return res.status(404).send('Document not found');
        }

        const fields = docSnapshot.data()!;

        // Decide embedding strategy based on collection
        let embeddingText = '';
        let relevantFields: string[] = [];

        switch (collectionName) {
            case 'brands':
                relevantFields = ['brandName', 'industry', 'description'];
                embeddingText = `${fields.brandName || ''} ${fields.industry || ''} ${fields.description || ''}`;
                break;
            case 'creators':
                relevantFields = ['displayName', 'bio', 'category'];
                embeddingText = `${fields.displayName || ''} ${fields.bio || ''} ${fields.category || ''}`;
                break;
            case 'campaigns':
                relevantFields = ['campaignName', 'description', 'targetAudience'];
                embeddingText = `${fields.campaignName || ''} ${fields.description || ''} ${fields.targetAudience || ''}`;
                break;
            case 'communications':
                relevantFields = ['subject', 'content'];
                embeddingText = `${fields.subject || ''} ${fields.content || ''}`;
                break;
            case 'voiceCommunications':
                relevantFields = ['transcript'];
                embeddingText = (fields.transcript || []).map((t: any) => t.message).join(' ');
                break;
            default:
                console.log(`⚠️ Unhandled collection: ${collectionName}`);
                return res.status(204).send('No relevant collection handler');
        }

        if (!isCreate) {
            const hasRelevantChange = updateMask.some((field: string) => relevantFields.includes(field));
            if (!hasRelevantChange) {
                console.log('✅ No embedding-relevant changes — skipping.');
                return res.status(204).send('No relevant changes');
            }
        }


        console.log('🧠 Generating chunk embeddings...');
        const chunks = await generateEmbeddingsForChunks(embeddingText);

        await upsertChunksToVectorStore({
            chunks: chunks.map(chunk => ({
                vector: chunk.embedding,
                metadata: {
                    parentCollection: collectionName,
                    sourceId: docId,
                    chunkIndex: chunk.chunkIndex,
                    chunkText: chunk.chunkText,
                }
            }))
        });


        console.log('🎯 Vector successfully stored for:', docId);
        return res.status(200).send('Vector stored');
    } catch (error) {
        console.error('🔥 Error in Firestore webhook handler:', error);
        return res.status(500).send('Internal error');
    }
};