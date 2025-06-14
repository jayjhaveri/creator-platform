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
    parrentCollection: string;
    sourceId: string;
    chunkIndex: number;
    chunkText: string;
    [key: string]: any;
}

export async function upsertChunksToVectorStore({ chunks }: VectorStoreInput): Promise<void> {
    const batch = db.batch();
    const collectionRef = db.collection('chunks');

    for (const { vector, metadata } of chunks) {
        const docRef = collectionRef.doc();
        batch.set(docRef, {
            vectorEmbedding: FieldValue.vector(vector),
            ...metadata,
            createdAt: new Date().toISOString(),
        });
    }

    try {
        await batch.commit();
        console.log(`✅ Successfully upserted ${chunks.length} chunks to vector store`);
    } catch (err) {
        console.error('🔥 Error storing vector chunks in Firestore:', err);
        throw err;
    }
}