import { db } from '../config/firebase';
import { Negotiation } from '../types/schema';

const COLLECTION = 'negotiations';

export const createNegotiation = async (data: Negotiation) => {
    const now = new Date().toISOString();
    const negotiationRef = db.collection(COLLECTION).doc();
    data.negotiationId = negotiationRef.id;


    await negotiationRef.set({
        ...data,
        createdAt: now,
        updatedAt: now,
    });
    return { id: negotiationRef.id };
};

export const getNegotiationById = async (id: string) => {
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) throw new Error('Negotiation not found');
    return { id: doc.id, ...doc.data() };
};

export const updateNegotiation = async (id: string, data: Partial<Negotiation>) => {
    const now = new Date().toISOString();
    await db.collection(COLLECTION).doc(id).update({
        ...data,
        updatedAt: now,
    });
    return { id };
};

export const deleteNegotiation = async (id: string) => {
    await db.collection(COLLECTION).doc(id).delete();
    return { id };
};

export const listNegotiations = async () => {
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};