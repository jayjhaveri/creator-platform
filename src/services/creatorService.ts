import { db } from '../config/firebase';
import { Creator } from '../types/schema';

const COLLECTION = 'creators';

export const createCreator = async (data: Creator) => {
  const now = new Date().toISOString();
  const docRef = await db.collection(COLLECTION).add({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return { id: docRef.id };
};

export const getCreatorById = async (id: string) => {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) throw new Error('Creator not found');
  return { id: doc.id, ...doc.data() };
};

export const updateCreator = async (id: string, data: Partial<Creator>) => {
  const now = new Date().toISOString();
  await db.collection(COLLECTION).doc(id).update({
    ...data,
    updatedAt: now,
  });
  return { id };
};

export const deleteCreator = async (id: string) => {
  await db.collection(COLLECTION).doc(id).delete();
  return { id };
};

export const listCreators = async () => {
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
