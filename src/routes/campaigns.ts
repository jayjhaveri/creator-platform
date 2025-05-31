/**
 * @swagger
 * tags:
 *   name: Campaigns
 *   description: Campaign management endpoints
 */

import express from 'express';
import { verifyFirebaseToken } from '../middleware/verifyToken';
import { asyncHandler } from '../utils/asyncHandler';
import {
    createCampaign,
    getCampaignById,
    updateCampaign,
    deleteCampaign,
    listCampaigns
} from '../controllers/campaignsController';

const router = express.Router();

/**
 * @swagger
 * /api/campaigns:
 *   post:
 *     summary: Create a new campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Campaign'
 *     responses:
 *       201:
 *         description: Campaign created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 */
router.post(
    '/',
    verifyFirebaseToken,
    asyncHandler(createCampaign)
);

/**
 * @swagger
 * /api/campaigns/{id}:
 *   get:
 *     summary: Get campaign by ID
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campaign data
 */
router.get(
    '/:id',
    verifyFirebaseToken,
    asyncHandler(getCampaignById)
);

/**
 * @swagger
 * /api/campaigns/{id}:
 *   put:
 *     summary: Update a campaign
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Campaign'
 *     responses:
 *       200:
 *         description: Campaign updated
 */
router.put(
    '/:id',
    verifyFirebaseToken,
    asyncHandler(updateCampaign)
);

/**
 * @swagger
 * /api/campaigns/{id}:
 *   delete:
 *     summary: Delete a campaign
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Campaign deleted
 */
router.delete(
    '/:id',
    verifyFirebaseToken,
    asyncHandler(deleteCampaign)
);

/**
 * @swagger
 * /api/campaigns:
 *   get:
 *     summary: List all campaigns
 *     tags: [Campaigns]
 *     responses:
 *       200:
 *         description: List of campaigns
 */
router.get(
    '/',
    verifyFirebaseToken,
    asyncHandler(listCampaigns)
);

export default router;