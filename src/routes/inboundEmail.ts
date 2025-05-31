import express from 'express';
import { handleInboundEmail, sendFollowUpEmail } from '../controllers/inboundEmailController';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

/**
 * @swagger
 * /inbound-email/handleInboundEmail:
 *  post:
 * summary: Handle inbound email to a negotiation
 * tags:
 *   name: InboundEmail
 *   description: Endpoints for handling inbound emails to negotiations
 */
router.post('/handleInboundEmail', express.urlencoded({ extended: true }), asyncHandler(handleInboundEmail));

/**
 * @swagger
 * /inbound-email/send-followup:
 *   post:
 *     summary: Send a follow-up email to a negotiation
 *     tags: [InboundEmail]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               negotiationId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Follow-up email sent successfully
 */
router.post('/send-followup', asyncHandler(sendFollowUpEmail));
export default router;