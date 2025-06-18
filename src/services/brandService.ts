import { db } from '../config/firebase';
import { Brand } from '../types/schema';
import { Timestamp } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'brands';

export const createBrand = async (data: any) => {
    const timestamp = new Date().toISOString();

    const brandDocRef = db.collection(COLLECTION_NAME).doc();
    data.brandId = data.phone || brandDocRef.id;
    data.uid = data.phone || brandDocRef.id;

    const brandWithTimestamps = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
    };
    await brandDocRef.set(brandWithTimestamps);
    return data;
};

export const getBrandById = async (id: string): Promise<Brand | null> => {
    const doc = await db.collection(COLLECTION_NAME).doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as Brand), brandId: doc.id };
};

export const getBrandByBrandId = async (id: string): Promise<Brand | null> => {
    const doc = await db.collection(COLLECTION_NAME).where('brandId', '==', id).limit(1).get();
    if (doc.empty) return null;
    const brandDoc = doc.docs[0];
    return { ...(brandDoc.data() as Brand) };
};

export const getBrandByPhone = async (phone: string): Promise<Brand | null> => {
    const doc = await db.collection(COLLECTION_NAME).where('phone', '==', phone).limit(1).get();
    if (doc.empty) return null;
    return doc.docs[0].data() as Brand;
};

export const updateBrand = async (id: string, updates: Partial<Brand>) => {
    const timestamp = new Date().toISOString();
    await db.collection(COLLECTION_NAME).doc(id).update({
        ...updates,
        updatedAt: timestamp
    });
};

export const updateBrandByBrandId = async (id: string, updates: Partial<Brand>) => {
    const timestamp = new Date().toISOString();
    const brandQuery = await db.collection(COLLECTION_NAME).where('brandId', '==', id).limit(1).get();
    if (brandQuery.empty) {
        throw new Error(`Brand with brandId "${id}" not found`);
    }
    const brandDoc = brandQuery.docs[0];
    await brandDoc.ref.update({
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
