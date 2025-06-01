import { db } from '../config/firebase';
import { Deal } from '../types/schema';

const COLLECTION = 'deals';

export const createDeal = async (data: any) => {
    const now = new Date().toISOString();

    const dealRef = db.collection(COLLECTION).doc();
    data.dealId = dealRef.id;

    await dealRef.set({
        ...data,
        createdAt: now,
        updatedAt: now,
    });
    return { id: dealRef.id };
};

export const getDealById = async (id: string): Promise<Deal> => {
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) throw new Error('Deal not found');
    return { ...(doc.data() as Deal), dealId: doc.id };
};

export const updateDeal = async (id: string, data: Partial<Deal>) => {
    const now = new Date().toISOString();
    await db.collection(COLLECTION).doc(id).update({
        ...data,
        updatedAt: now,
    });
};

export const deleteDeal = async (id: string) => {
    await db.collection(COLLECTION).doc(id).delete();
};

export const listDeals = async (): Promise<Deal[]> => {
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map(doc => ({ ...(doc.data() as Deal), dealId: doc.id }));
};

export const getDealsByCampaignId = async (campaignId: string): Promise<Deal[]> => {
    const snapshot = await db
        .collection(COLLECTION)
        .where('campaignId', '==', campaignId)
        .get();

    return snapshot.docs.map(doc => ({ ...(doc.data() as Deal), dealId: doc.id }));
};