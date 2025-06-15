import { db } from '../config/firebase';
import logger from '../utils/logger';

/**
 * Checks if a brand exists in the Firestore using the provided phone number.
 * 
 * @param phone - The phone number to look up.
 * @returns An object indicating whether the brand exists and, if it does, the brandId.
 */
export async function checkBrandExists(phone: string): Promise<{ exists: boolean; brandId?: string }> {
    logger.info('Checking if brand exists', { phone });

    const snapshot = await db.collection('brands').where('phone', '==', phone).limit(1).get();

    if (snapshot.empty) {
        logger.info('No brand found for the provided phone number', { phone });
        return { exists: false };
    }

    const doc = snapshot.docs[0];
    const brandData = {
        exists: true,
        brandId: doc.id,
        ...doc.data() as { brandName: string; email: string; phone: string; uid: string; website: string; industry: string; companySize: string; totalBudget?: number | null; description?: string }
    };

    logger.info('Brand found', { phone, brandId: doc.id });
    return brandData;
}
