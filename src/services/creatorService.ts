import { db } from '../config/firebase';
import { Creator } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION = 'creators';

export const createCreator = async (data: any) => {
  const now = new Date().toISOString();

  const creatorRef = db.collection(COLLECTION).doc();
  const creatorId = creatorRef.id;

  await creatorRef.set({
    ...data,
    creatorId,
    createdAt: now,
    updatedAt: now,
  });

  return { id: creatorId };
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

