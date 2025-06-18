import { getBrandByPhone } from '../services/brandService'; // or wherever it's placed
import { Brand } from '../types/schema';
import logger from '../utils/logger';

/**
 * Checks if a brand exists using the phone number.
 */
export async function checkBrandExists(phone: string): Promise<{ exists: boolean; brandId?: string } & Partial<Brand>> {
    logger.info('Checking if brand exists', { phone });

    const brand = await getBrandByPhone(phone);

    if (!brand) {
        logger.info('No brand found for the provided phone number', { phone });
        return { exists: false };
    }

    logger.info('Brand found', { phone, brandId: brand.brandId });
    return {
        exists: true,
        ...brand
    };
}