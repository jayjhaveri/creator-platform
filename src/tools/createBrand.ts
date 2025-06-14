//src/tools/createBrand.ts

import { db } from '../config/firebase';
import { Brand } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';

type BrandInput = Omit<Brand, 'brandId' | 'createdAt' | 'updatedAt' | 'isActive'>;


export async function createBrand(input: Omit<Brand, 'brandId' | 'createdAt' | 'updatedAt'>): Promise<Brand> {
    const brandId = uuidv4();
    const now = new Date().toISOString();

    const newBrand: Brand = {
        brandId,
        ...input,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        totalBudget: input.totalBudget ?? null,
    };

    await db.collection('brands').doc(brandId).set(newBrand);

    return newBrand;
}
