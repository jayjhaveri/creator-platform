import { Request, Response } from 'express';
import * as negotiationsService from '../services/negotiationsService';
import { Negotiation } from '../types/schema';

export const createNegotiation = async (req: Request, res: Response) => {
    try {
        const negotiation: Negotiation = req.body;
        const result = await negotiationsService.createNegotiation(negotiation);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating negotiation:', error);
        res.status(500).json({ error: 'Failed to create negotiation' });
    }
};

export const getNegotiationById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const negotiation = await negotiationsService.getNegotiationById(id);
        res.status(200).json(negotiation);
    } catch (error) {
        console.error('Error fetching negotiation:', error);
        res.status(404).json({ error: 'Negotiation not found' });
    }
};

export const updateNegotiation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates: Partial<Negotiation> = req.body;
        const result = await negotiationsService.updateNegotiation(id, updates);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating negotiation:', error);
        res.status(500).json({ error: 'Failed to update negotiation' });
    }
};

export const deleteNegotiation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await negotiationsService.deleteNegotiation(id);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error deleting negotiation:', error);
        res.status(500).json({ error: 'Failed to delete negotiation' });
    }
};

export const listNegotiations = async (_req: Request, res: Response) => {
    try {
        const negotiations = await negotiationsService.listNegotiations();
        res.status(200).json(negotiations);
    } catch (error) {
        console.error('Error listing negotiations:', error);
        res.status(500).json({ error: 'Failed to list negotiations' });
    }
};