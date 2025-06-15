//src/tools/createBrand.ts

import { db } from '../config/firebase';
import { Brand } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';

type BrandInput = Omit<Brand, 'brandId' | 'createdAt' | 'updatedAt' | 'isActive'>;


export async function createBrand(input: Omit<Brand, 'brandId' | 'createdAt' | 'updatedAt' | 'uid'>): Promise<Brand> {
    const uuid = uuidv4();
    const now = new Date().toISOString();

    const newBrand: Brand = {
        brandId: input.phone,
        ...input,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        uid: input.phone,
    };

    await db.collection('brands').doc(uuid).set(newBrand);

    return newBrand;
}
