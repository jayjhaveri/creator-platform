// src/services/vectorStore.ts
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

interface VectorStoreInput {
    id: string;
    vector: number[];
    metadata: {
        type: string;
        brandName?: string;
        industry?: string;
        [key: string]: any;
    };
}

export async function upsertToVectorStore({
    id,
    vector,
    metadata,
}: VectorStoreInput): Promise<void> {
    try {
        const docRef = db.collection('brands').doc(id);

        await docRef.set(
            {
                vectorEmbedding: FieldValue.vector(vector),
                ...metadata,
                updatedAt: new Date().toISOString(),
            },
            { merge: true }
        );

        console.log(`✅ Vector stored for brand ID: ${id}`);
    } catch (err) {
        console.error('🔥 Error storing vector in Firestore:', err);
        throw err;
    }
}