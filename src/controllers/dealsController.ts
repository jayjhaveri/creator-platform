import { Request, Response } from 'express';
import * as dealsService from '../services/dealsService';
import { Deal } from '../types/schema';

export const createDeal = async (req: Request, res: Response) => {
    try {

        const result = await dealsService.createDeal(req.body);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating deal:', error);
        res.status(500).json({ error: 'Failed to create deal' });
    }
};

export const getDealById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const deal = await dealsService.getDealById(id);
        res.status(200).json(deal);
    } catch (error) {
        console.error('Error fetching deal:', error);
        res.status(404).json({ error: 'Deal not found' });
    }
};

export const updateDeal = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data: Partial<Deal> = req.body;
        await dealsService.updateDeal(id, data);
        res.status(204).send();
    } catch (error) {
        console.error('Error updating deal:', error);
        res.status(500).json({ error: 'Failed to update deal' });
    }
};

export const deleteDeal = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await dealsService.deleteDeal(id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting deal:', error);
        res.status(500).json({ error: 'Failed to delete deal' });
    }
};

export const listDeals = async (_req: Request, res: Response) => {
    try {
        const deals = await dealsService.listDeals();
        res.status(200).json(deals);
    } catch (error) {
        console.error('Error listing deals:', error);
        res.status(500).json({ error: 'Failed to list deals' });
    }
};

export const getDealsByCampaignId = async (req: Request, res: Response) => {
    try {
        const { campaignId } = req.params;
        const deals = await dealsService.getDealsByCampaignId(campaignId);
        res.status(200).json(deals);
    } catch (error) {
        console.error('Error fetching deals by campaignId:', error);
        res.status(500).json({ error: 'Failed to fetch deals' });
    }
};