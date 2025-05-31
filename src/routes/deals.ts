import express from 'express';
import { verifyFirebaseToken } from '../middleware/verifyToken';
import {
    createDeal,
    getDealById,
    updateDeal,
    deleteDeal,
    listDeals,
    getDealsByCampaignId
} from '../controllers/dealsController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Deals
 *   description: Endpoints for managing brand-creator deals
 */

/**
 * @swagger
 * /api/deals:
 *   post:
 *     summary: Create a new deal
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Deal'
 *     responses:
 *       201:
 *         description: Deal created
 *       500:
 *         description: Failed to create deal
 */
router.post('/', verifyFirebaseToken, createDeal);

/**
 * @swagger
 * /api/deals:
 *   get:
 *     summary: List all deals
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of deals
 *       500:
 *         description: Failed to list deals
 */
router.get('/', verifyFirebaseToken, listDeals);

/**
 * @swagger
 * /api/deals/{id}:
 *   get:
 *     summary: Get deal by ID
 *     tags: [Deals]
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
 *         description: Deal details
 *       404:
 *         description: Deal not found
 */
router.get('/:id', verifyFirebaseToken, getDealById);

/**
 * @swagger
 * /api/deals/{id}:
 *   put:
 *     summary: Update a deal
 *     tags: [Deals]
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
 *             $ref: '#/components/schemas/Deal'
 *     responses:
 *       204:
 *         description: Deal updated
 *       500:
 *         description: Failed to update deal
 */
router.put('/:id', verifyFirebaseToken, updateDeal);

/**
 * @swagger
 * /api/deals/{id}:
 *   delete:
 *     summary: Delete a deal
 *     tags: [Deals]
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
 *         description: Deal deleted
 *       500:
 *         description: Failed to delete deal
 */
router.delete('/:id', verifyFirebaseToken, deleteDeal);

/**
 * @swagger
 * /api/deals/campaign/{campaignId}:
 *   get:
 *     summary: Get deals by campaign ID
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deals for the given campaign
 *       500:
 *         description: Failed to fetch deals
 */
router.get('/campaign/:campaignId', verifyFirebaseToken, getDealsByCampaignId);

export default router;