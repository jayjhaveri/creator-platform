

import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { Brand, Campaign, Creator, Negotiation } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { createVoiceAgent } from '../services/elevenLabs/createAgent';
import { createKnowledgeBase } from '../services/elevenLabs/createKnowledgeBase';
import { initiateVoiceAgent } from '../services/voiceAgent/initiateVoiceAgent';

export const initiateVoiceAgentForNegotiation = async (req: Request, res: Response) => {
    try {
        const { negotiationId } = req.params;
        const agentId = await initiateVoiceAgent(negotiationId);
        logger.info(`Voice agent created: ${agentId}`);
        res.status(200).json({ success: true, agentId });
    } catch (error) {
        logger.error('Error initiating voice agent:', error);
        res.status(500).json({ error: 'Failed to initiate voice agent' });
    }
};