import { Request, Response } from 'express';
import { processEmailFollowUp } from '../services/followUpService';

export const handleFollowUp = async (req: Request, res: Response) => {
    try {
        const negotiationId = req.params.id;
        if (!negotiationId) return res.status(400).json({ error: 'Missing negotiation ID' });

        const result = await processEmailFollowUp(negotiationId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Follow-up error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
