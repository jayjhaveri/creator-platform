import { Request, Response } from 'express';
import * as brandService from '../services/brandService';
import { Brand } from '../types/schema';
import { db } from '../config/firebase';
import logger from '../utils/logger';
import { generateEmbedding } from '../services/embeddingService';
import { FieldValue } from 'firebase-admin/firestore';

export const createBrand = async (req: Request, res: Response) => {
    try {
        const { id } = await brandService.createBrand(req.body);
        res.status(201).json({ id });
    } catch (error) {
        console.error('Error creating brand:', error);
        res.status(500).json({ error: 'Failed to create brand' });
    }
};

export const getBrandById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const brand = await brandService.getBrandById(id);
        if (!brand) return res.status(404).json({ error: 'Brand not found' });
        res.status(200).json(brand);
    } catch (error) {
        console.error('Error fetching brand:', error);
        res.status(500).json({ error: 'Failed to fetch brand' });
    }
};

export const updateBrand = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates: Partial<Brand> = req.body;
        await brandService.updateBrand(id, updates);
        res.status(204).send();
    } catch (error) {
        console.error('Error updating brand:', error);
        res.status(500).json({ error: 'Failed to update brand' });
    }
};

export const deleteBrand = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await brandService.deleteBrand(id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting brand:', error);
        res.status(500).json({ error: 'Failed to delete brand' });
    }
};

export const listBrands = async (_req: Request, res: Response) => {
    try {
        const brands = await brandService.listBrands();
        res.status(200).json(brands);
    } catch (error) {
        console.error('Error listing brands:', error);
        res.status(500).json({ error: 'Failed to list brands' });
    }
};


export const searchBrandsByVector = async (req: Request, res: Response) => {
    try {
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid `query` in request body' });
        }

        console.log('🔍 Generating embedding for query:', query);
        const embedding = await generateEmbedding(query);

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
            console.warn('⚠️ Invalid or empty embedding generated');
            return res.status(500).json({ error: 'Failed to generate embedding' });
        }

        console.log(`✅ Embedding generated (length: ${embedding.length})`);
        console.log('📁 Executing vector search in Firestore...');

        const snapshot = await db
            .collection('brands')
            .findNearest({
                vectorField: 'vectorEmbedding',
                queryVector: embedding,
                limit: 5, // you can adjust this as needed
                distanceMeasure: 'COSINE',
                distanceResultField: 'similarityScore',
                distanceThreshold: 0.51
            })
            .get();

        if (snapshot.empty) {
            console.log('⚠️ No matching documents found for query:', query);
            return res.status(200).json({ results: [] });
        }

        const results = snapshot.docs.map((doc) => {
            const data = doc.data();
            const similarityScore = doc.get('similarityScore');
            console.log(`📄 Match: ${doc.id} | Similarity: ${similarityScore?.toFixed(4)}`);
            return {
                id: doc.id,
                similarityScore,
                ...data,
            };
        });

        res.status(200).json({ results });
    } catch (error) {
        console.error('🔥 Error in vector search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};