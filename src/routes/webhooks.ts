import express from 'express';
import { handleFirestoreEvent } from '../controllers/firestoreController';
import { asyncHandler } from '../utils/asyncHandler';
import { whatsappWebhookHandler } from '../webhooks/whatsappWebhook';

const router = express.Router();

/**
 * @swagger
 * /webhooks/firestore:
 *   post:
 *     summary: Handle Firestore webhook events
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventType:
 *                 type: string
 *               resource:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Event processed successfully
 */
router.post('/firestore', asyncHandler(handleFirestoreEvent));

/**
 * @swagger
 * /webhooks/whatsapp:
 *   post:
 *     summary: Handle WhatsApp webhook events
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messageId:
 *                 type: string
 *               content:
 *                 type: object
 *                 properties:
 *                   text:
 *                     type: string
 *               from:
 *                 type: string
 *     responses:
 *       200:
 *         description: WhatsApp message processed successfully
 */
router.post('/whatsapp', asyncHandler(whatsappWebhookHandler));



export default router;