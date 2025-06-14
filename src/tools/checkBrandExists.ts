import { db } from '../config/firebase';

/**
 * Checks if a brand exists in the Firestore using the provided phone number.
 * 
 * @param phone - The phone number to look up.
 * @returns An object indicating whether the brand exists and, if it does, the brandId.
 */
export async function checkBrandExists(phone: string): Promise<{ exists: boolean; brandId?: string }> {
  const snapshot = await db.collection('brands').where('phone', '==', phone).limit(1).get();

  if (snapshot.empty) {
    return { exists: false };
  }

  const doc = snapshot.docs[0];
  return { exists: true, brandId: doc.id };
}
