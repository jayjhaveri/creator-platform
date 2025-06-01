import express from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { startCall } from '../services/voiceAgent/initiateVoiceAgent';
import { verifyFirebaseToken } from '../middleware/verifyToken';

const route = express.Router();

/**
 * @swagger
 * tags:
 *   name: VoiceAgent
 *   description: Endpoints for managing voice calls
 */
/**
 * @swagger
 * /api/initiateCall/start:
 *   post:
 *     summary: Start a voice call
 *     tags: [VoiceAgent]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               negotiationId:
 *                 type: string
 *                 description: ID of the negotiation to start the call for
 *               phone:
 *                 type: string
 *                 description: Phone number to call
 *     responses:
 *       200:
 *         description: Call started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 callId:
 *                   type: string
 *                   description: Unique identifier for the started call
 *       400:
 *         description: Bad request, missing or invalid parameters
 *       500:
 *         description: Internal server error
 */
route.post('/start', asyncHandler(startCall));

export default route;