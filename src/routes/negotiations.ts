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
import { sendInitialEmail } from '../agents/emailAgent';
import { db } from '../config/firebase';
import { Brand, Campaign, Creator } from '../types/schema';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Negotiations
 *   description: Endpoints for managing negotiations
 */

/**
 * @swagger
 * /api/negotiations:
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
 * /api/negotiations/{id}:
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
 * /api/negotiations/{id}:
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
 * /api/negotiations/{id}:
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
 * /api/negotiations:
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

/**
 * @swagger
 * /api/negotiations/{id}/start:
 *   post:
 *     summary: Start a negotiation by sending an initial email
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
 *         description: Email sent successfully
 *       404:
 *         description: Negotiation or related document not found
 */

router.post('/:id/start', verifyFirebaseToken, asyncHandler(async (req, res) => {
    const negotiationId = req.params.id;

    const negotiationDoc = await db.collection('negotiations').doc(negotiationId).get();
    if (!negotiationDoc.exists) {
        return res.status(404).json({ error: 'Negotiation not found' });
    }
    const negotiation = negotiationDoc.data();

    if (!negotiation) {
        return res.status(404).json({ error: 'Negotiation data not found' });
    }

    const [brandDoc, creatorDoc, campaignDoc] = await Promise.all([
        db.collection('brands').doc(negotiation.brandId).get(),
        db.collection('creators').doc(negotiation.creatorId).get(),
        db.collection('campaigns').doc(negotiation.campaignId).get(),
    ]);

    if (!brandDoc.exists || !creatorDoc.exists || !campaignDoc.exists) {
        return res.status(404).json({ error: 'Related document not found' });
    }

    const brand = brandDoc.data() as Brand;
    const creator = creatorDoc.data() as Creator;
    const campaign = campaignDoc.data() as Campaign;

    const result = await sendInitialEmail(creator, campaign, brand, negotiationId);
    res.json(result);
}));

// In negotiationsRouter.ts
import { handleFollowUp } from '../controllers/followUpController';

/**
 * @swagger
 * /negotiations/{id}/follow-up:
 *   post:
 *     summary: Trigger a follow-up email if creator hasn't replied
 *     tags: [Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The negotiation ID
 *     responses:
 *       200:
 *         description: Follow-up sent or skipped
 *       400:
 *         description: Missing ID or bad request
 *       500:
 *         description: Internal server error
 */
router.post('/:id/follow-up', verifyFirebaseToken, asyncHandler(handleFollowUp));

export default router;