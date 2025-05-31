import { db } from '../config/firebase';
import { Brand } from '../types/schema';
import { Timestamp } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'brands';

export const createBrand = async (data: Brand) => {
    const timestamp = new Date().toISOString();

    const brandDocRef = db.collection(COLLECTION_NAME).doc();
    data.brandId = brandDocRef.id;

    const brandWithTimestamps = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
    };
    await brandDocRef.set(brandWithTimestamps);
    return { id: brandDocRef.id };
};

export const getBrandById = async (id: string): Promise<Brand | null> => {
    const doc = await db.collection(COLLECTION_NAME).doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as Brand), brandId: doc.id };
};

export const updateBrand = async (id: string, updates: Partial<Brand>) => {
    const timestamp = new Date().toISOString();
    await db.collection(COLLECTION_NAME).doc(id).update({
        ...updates,
        updatedAt: timestamp
    });
};

export const deleteBrand = async (id: string) => {
    await db.collection(COLLECTION_NAME).doc(id).delete();
};

export const listBrands = async (): Promise<Brand[]> => {
    const snapshot = await db.collection(COLLECTION_NAME).get();
    return snapshot.docs.map(doc => ({ ...(doc.data() as Brand), brandId: doc.id }));
};
