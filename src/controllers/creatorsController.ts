import { Request, Response } from 'express';
import * as creatorService from '../services/creatorService';
import { Creator } from '../types/schema';

export const createCreator = async (req: Request, res: Response) => {
    try {
        const creator: Creator = req.body;
        const result = await creatorService.createCreator(creator);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating creator:', error);
        res.status(500).json({ error: 'Failed to create creator' });
    }
};

export const getCreatorById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const creator = await creatorService.getCreatorById(id);
        res.status(200).json(creator);
    } catch (error) {
        console.error('Error fetching creator:', error);
        res.status(404).json({ error: 'Creator not found' });
    }
};

export const updateCreator = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates: Partial<Creator> = req.body;
        const result = await creatorService.updateCreator(id, updates);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating creator:', error);
        res.status(500).json({ error: 'Failed to update creator' });
    }
};

export const deleteCreator = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await creatorService.deleteCreator(id);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error deleting creator:', error);
        res.status(500).json({ error: 'Failed to delete creator' });
    }
};

export const listCreators = async (_req: Request, res: Response) => {
    try {
        const creators = await creatorService.listCreators();
        res.status(200).json(creators);
    } catch (error) {
        console.error('Error listing creators:', error);
        res.status(500).json({ error: 'Failed to list creators' });
    }
};