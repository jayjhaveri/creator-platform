import { db } from '../config/firebase';
import { Campaign } from '../types/schema';

export const createCampaign = async (campaign: Campaign) => {
    const now = new Date().toISOString();
    const docRef = await db.collection('campaigns').add({
        ...campaign,
        createdAt: now,
        updatedAt: now,
    });
    return { id: docRef.id };
};

export const getCampaignById = async (id: string) => {
    const doc = await db.collection('campaigns').doc(id).get();
    if (!doc.exists) throw new Error('Campaign not found');
    return { id: doc.id, ...doc.data() };
};

export const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
    const now = new Date().toISOString();
    await db.collection('campaigns').doc(id).update({
        ...updates,
        updatedAt: now,
    });
};

export const deleteCampaign = async (id: string) => {
    await db.collection('campaigns').doc(id).delete();
};

export const listCampaigns = async () => {
    const snapshot = await db.collection('campaigns').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};