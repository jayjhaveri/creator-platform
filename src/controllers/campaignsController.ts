import { Request, Response } from 'express';
import * as campaignService from '../services/campaignService';
import { Campaign } from '../types/schema';

export const createCampaign = async (req: Request, res: Response) => {
    try {

        const result = await campaignService.createCampaign(req.body);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
};

export const getCampaignById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const campaign = await campaignService.getCampaignById(id);
        res.status(200).json(campaign);
    } catch (error) {
        console.error('Error fetching campaign:', error);
        res.status(404).json({ error: 'Campaign not found' });
    }
};

export const updateCampaign = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates: Partial<Campaign> = req.body;
        await campaignService.updateCampaign(id, updates);
        res.status(204).send();
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
};

export const deleteCampaign = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await campaignService.deleteCampaign(id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
};

export const listCampaigns = async (_req: Request, res: Response) => {
    try {
        const campaigns = await campaignService.listCampaigns();
        res.status(200).json(campaigns);
    } catch (error) {
        console.error('Error listing campaigns:', error);
        res.status(500).json({ error: 'Failed to list campaigns' });
    }
};