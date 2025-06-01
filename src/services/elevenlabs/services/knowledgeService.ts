import { db } from "../../../config/firebase";
import { KnowledgeBaseDocument } from "../../../types/schema";

const COLLECTION_NAME = 'knowledge_base_documents';

export const createKnowledgeBaseDocument = async (data: KnowledgeBaseDocument) => {
    const timestamp = new Date().toISOString();

    const docRef = db.collection(COLLECTION_NAME).doc();
    data.id = docRef.id;

    const documentWithTimestamps = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
    };
    await docRef.set(documentWithTimestamps);
    return { id: docRef.id };
};

export const getKnowledgeBaseDocumentById = async (id: string): Promise<KnowledgeBaseDocument | null> => {
    const doc = await db.collection(COLLECTION_NAME).doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as KnowledgeBaseDocument), id: doc.id };
};

export const updateKnowledgeBaseDocument = async (id: string, updates: Partial<KnowledgeBaseDocument>) => {
    const timestamp = new Date().toISOString();
    await db.collection(COLLECTION_NAME).doc(id).update({
        ...updates,
        updatedAt: timestamp
    });
};

export const deleteKnowledgeBaseDocument = async (id: string) => {
    await db.collection(COLLECTION_NAME).doc(id).delete();
};

export const listKnowledgeBaseDocuments = async (): Promise<KnowledgeBaseDocument[]> => {
    const snapshot = await db.collection(COLLECTION_NAME).get();
    return snapshot.docs.map(doc => ({ ...(doc.data() as KnowledgeBaseDocument), id: doc.id }));
};
