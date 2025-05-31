import express from 'express';
import { verifyFirebaseToken } from '../middleware/verifyToken';
import { asyncHandler } from '../utils/asyncHandler';
import {
    createNegotiation,
    getNegotiationById,
    updateNegotiation,
    deleteNegotiation,
    listNegotiations
} from '../controllers/negotiationsController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Negotiations
 *   description: Endpoints for managing negotiations
 */

/**
 * @swagger
 * /negotiations:
 *   post:
 *     summary: Create a new negotiation
 *     tags: [Negotiations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Negotiation'
 *     responses:
 *       201:
 *         description: Negotiation created
 *       500:
 *         description: Server error
 */
router.post('/', verifyFirebaseToken, asyncHandler(createNegotiation));

/**
 * @swagger
 * /negotiations/{id}:
 *   get:
 *     summary: Get a negotiation by ID
 *     tags: [Negotiations]
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
 *         description: Negotiation found
 *       404:
 *         description: Not found
 */
router.get('/:id', verifyFirebaseToken, asyncHandler(getNegotiationById));

/**
 * @swagger
 * /negotiations/{id}:
 *   put:
 *     summary: Update a negotiation
 *     tags: [Negotiations]
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
 *             $ref: '#/components/schemas/Negotiation'
 *     responses:
 *       200:
 *         description: Updated successfully
 *       500:
 *         description: Server error
 */
router.put('/:id', verifyFirebaseToken, asyncHandler(updateNegotiation));

/**
 * @swagger
 * /negotiations/{id}:
 *   delete:
 *     summary: Delete a negotiation
 *     tags: [Negotiations]
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
 *         description: Deleted
 *       500:
 *         description: Server error
 */
router.delete('/:id', verifyFirebaseToken, asyncHandler(deleteNegotiation));

/**
 * @swagger
 * /negotiations:
 *   get:
 *     summary: List all negotiations
 *     tags: [Negotiations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of negotiations
 *       500:
 *         description: Server error
 */
router.get('/', verifyFirebaseToken, asyncHandler(listNegotiations));

export default router;