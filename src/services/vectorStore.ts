// src/services/vectorStore.ts
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

interface VectorStoreInput {
    chunks: {
        vector: number[];
        metadata: ChunkMetadata;
    }[];
}

interface ChunkMetadata {
    parentCollection: string;
    sourceId: string;
    chunkIndex: number;
    chunkText: string;
    [key: string]: any;
}

export async function upsertChunksToVectorStore({ chunks }: VectorStoreInput): Promise<void> {
    const batch = db.batch();
    const collectionRef = db.collection('chunks');

    for (const { vector, metadata } of chunks) {
        const querySnapshot = await collectionRef.where('sourceId', '==', metadata.sourceId).get();

        if (!querySnapshot.empty) {
            // Update existing document
            querySnapshot.forEach((doc) => {
                batch.update(doc.ref, {
                    vectorEmbedding: FieldValue.vector(vector),
                    ...metadata,
                    updatedAt: new Date().toISOString(),
                });
            });
        } else {
            // Create new document
            const docRef = collectionRef.doc();
            batch.set(docRef, {
                vectorEmbedding: FieldValue.vector(vector),
                ...metadata,
                createdAt: new Date().toISOString(),
            });
        }
    }

    try {
        await batch.commit();
        console.log(`✅ Successfully upserted ${chunks.length} chunks to vector store`);
    } catch (err) {
        console.error('🔥 Error storing vector chunks in Firestore:', err);
        throw err;
    }
}