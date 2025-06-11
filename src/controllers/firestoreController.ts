import { Request, Response } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { generateEmbedding } from '../services/embeddingService';
import { upsertToVectorStore } from '../services/vectorStore';

const firestore = new Firestore();

export const handleFirestoreEvent = async (req: Request, res: Response) => {
    console.log('🔥 Webhook hit: /webhooks/firestore');

    try {
        const write = req.body?.protoPayload?.request?.writes?.[0];
        const docPath = write?.update?.name;

        const updateMask = write?.updateMask?.fieldPaths || [];

        const relevantFields = ['brandName', 'industry', 'description'];
        const hasRelevantChange = updateMask.some((field: string) => relevantFields.includes(field));

        if (!hasRelevantChange) {
            console.log('✅ No changes in embedding-relevant fields — skipping vector update.');
            return res.status(204).send('No relevant changes — skipping embedding update.');
        }

        if (!docPath) {
            console.warn('⚠️ Could not extract document path from event:', JSON.stringify(req.body, null, 2));
            return res.status(400).send('Invalid Firestore Audit Log payload');
        }

        const relativePath = docPath.split('/documents/')[1]; // e.g., brands/abc123
        const docId = relativePath.split('/').pop() || 'unknown';

        console.log(`📄 Firestore doc path: ${docPath}`);
        console.log(`🆔 Document ID: ${docId}`);

        const docSnapshot = await firestore.doc(relativePath).get();

        if (!docSnapshot.exists) {
            console.warn(`⚠️ Document not found in Firestore: ${relativePath}`);
            return res.status(404).send('Document not found');
        }

        const fields = docSnapshot.data()!;
        const embeddingText = `${fields.brandName || ''} ${fields.industry || ''} ${fields.description || ''}`;
        console.log('🧠 Embedding Text:', embeddingText);

        const embedding = await generateEmbedding(embeddingText);
        console.log('✅ Embedding generated with length:', embedding.length);

        console.log('💾 Upserting to vector store...');
        await upsertToVectorStore({
            id: docId,
            vector: embedding,
            metadata: {
                type: 'brand',
                brandName: fields.brandName,
                industry: fields.industry,
            }
        });

        console.log('🎯 Vector successfully stored for:', docId);
        return res.status(200).send('Vector stored');
    } catch (error) {
        console.error('🔥 Error in Firestore webhook handler:', error);
        return res.status(500).send('Internal error');
    }
};