import { db } from '../config/firebase';
import { Communication } from '../types/schema';

const COLLECTION = 'communications';

export const createCommunication = async (data: any) => {
    const now = new Date().toISOString();

    const communicationRef = db.collection(COLLECTION).doc();
    data.communicationId = communicationRef.id;

    await communicationRef.set({
        ...data,
        createdAt: now,
    });
    return { id: communicationRef.id };
};

export const getCommunicationById = async (id: string) => {
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) throw new Error('Communication not found');
    return { id: doc.id, ...doc.data() };
};

export const updateCommunication = async (id: string, data: Partial<Communication>) => {
    const now = new Date().toISOString();
    await db.collection(COLLECTION).doc(id).update({
        ...data,
        updatedAt: now,
    });
};

export const deleteCommunication = async (id: string) => {
    await db.collection(COLLECTION).doc(id).delete();
};

export const listCommunications = async () => {
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getCommunicationsByNegotiationId = async (negotiationId: string): Promise<Communication[]> => {
    const snapshot = await db
        .collection('communications')
        .where('negotiationId', '==', negotiationId)
        .get();

    return snapshot.docs.map(doc => ({
        ...(doc.data() as Communication),
        communicationId: doc.id,
    }));
};
