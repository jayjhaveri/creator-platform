import { Request, Response } from 'express';
import * as brandService from '../services/brandService';
import { Brand } from '../types/schema';

export const createBrand = async (req: Request, res: Response) => {
    try {
        const brand: Brand = req.body;
        const id = await brandService.createBrand(brand);
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