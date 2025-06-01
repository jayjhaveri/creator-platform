import { Request, Response } from 'express';
import * as communicationsService from '../services/communicationsService';
import { Communication } from '../types/schema';

export const createCommunication = async (req: Request, res: Response) => {
    try {
        const newId = await communicationsService.createCommunication(req.body);
        res.status(201).json({ id: newId });
    } catch (error) {
        console.error('Error creating communication:', error);
        res.status(500).json({ error: 'Failed to create communication' });
    }
};

export const getCommunicationsByNegotiationId = async (req: Request, res: Response) => {
    try {
        const negotiationId = req.params.negotiationId;
        const communications = await communicationsService.getCommunicationsByNegotiationId(negotiationId);
        res.status(200).json(communications);
    } catch (error) {
        console.error('Error fetching communications:', error);
        res.status(500).json({ error: 'Failed to fetch communications' });
    }
};

export const getCommunicationById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const communication = await communicationsService.getCommunicationById(id);
        res.status(200).json(communication);
    } catch (error) {
        console.error('Error fetching communication:', error);
        res.status(404).json({ error: 'Communication not found' });
    }
};

export const updateCommunication = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data: Partial<Communication> = req.body;
        await communicationsService.updateCommunication(id, data);
        res.status(204).send();
    } catch (error) {
        console.error('Error updating communication:', error);
        res.status(500).json({ error: 'Failed to update communication' });
    }
};

export const deleteCommunication = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await communicationsService.deleteCommunication(id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting communication:', error);
        res.status(500).json({ error: 'Failed to delete communication' });
    }
};
