import express from 'express';
import { verifyFirebaseToken } from '../middleware/verifyToken';
import {
    createCommunication,
    getCommunicationsByNegotiationId,
    getCommunicationById,
    updateCommunication,
    deleteCommunication,
} from '../controllers/communicationsController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Communications
 *   description: Endpoints for managing communications tied to negotiations
 */

/**
 * @swagger
 * /api/communications:
 *   post:
 *     summary: Create a communication record
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Communication'
 *     responses:
 *       201:
 *         description: Communication created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 */
router.post('/', verifyFirebaseToken, createCommunication);

/**
 * @swagger
 * /api/communications/negotiation/{negotiationId}:
 *   get:
 *     summary: Get all communications by negotiation ID
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: negotiationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of communications for the negotiation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Communication'
 */
router.get('/negotiation/:negotiationId', verifyFirebaseToken, getCommunicationsByNegotiationId);

/**
 * @swagger
 * /api/communications/{id}:
 *   get:
 *     summary: Get a communication by ID
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A communication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Communication'
 */
router.get('/:id', verifyFirebaseToken, getCommunicationById);

/**
 * @swagger
 * /api/communications/{id}:
 *   put:
 *     summary: Update a communication
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Communication'
 *     responses:
 *       204:
 *         description: Communication updated successfully
 */
router.put('/:id', verifyFirebaseToken, updateCommunication);

/**
 * @swagger
 * /api/communications/{id}:
 *   delete:
 *     summary: Delete a communication
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Communication deleted successfully
 */
router.delete('/:id', verifyFirebaseToken, deleteCommunication);

export default router;