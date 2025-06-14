import { Request, Response } from 'express';
import * as brandService from '../services/brandService';
import { Brand } from '../types/schema';
import { db } from '../config/firebase';
import logger from '../utils/logger';
import { generateEmbeddingsForChunks } from '../services/embeddingService';
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

        logger.info('🔍 Generating embedding for query:', query);
        const [embedding] = await generateEmbeddingsForChunks(query);

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
            logger.warn('⚠️ Invalid or empty embedding generated');
            return res.status(500).json({ error: 'Failed to generate embedding' });
        }

        logger.info(`✅ Embedding generated (length: ${embedding.length})`);
        logger.info('📁 Executing vector search in Firestore chunks...');

        const snapshot = await db
            .collection('chunks')
            .where('type', '==', 'brands')
            .findNearest({
                vectorField: 'vectorEmbedding',
                queryVector: embedding.embedding,
                limit: 10,
                distanceMeasure: 'COSINE',
                distanceResultField: 'similarityScore',
                distanceThreshold: 0.51
            })
            .get();

        if (snapshot.empty) {
            logger.info('⚠️ No matching chunks found for query:', query);
            return res.status(200).json({ results: [] });
        }

        const resultsMap = new Map();

        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const sourceId = data.sourceId;
            const existing = resultsMap.get(sourceId);

            if (!existing || data.similarityScore > existing.similarityScore) {
                resultsMap.set(sourceId, {
                    id: sourceId,
                    similarityScore: data.similarityScore,
                    chunkId: doc.id,
                    chunkContent: data.chunk,
                    metadata: data,
                });
            }
        });

        const results = Array.from(resultsMap.values());
        res.status(200).json({ results });
    } catch (error) {
        logger.error('🔥 Error in vector search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};