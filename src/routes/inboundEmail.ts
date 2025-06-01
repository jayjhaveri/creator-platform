import express from 'express';
import { handleInboundEmail, sendFollowUpEmail } from '../controllers/inboundEmailController';
import { asyncHandler } from '../utils/asyncHandler';
import getRawBody from 'raw-body';
import { simpleParser } from 'mailparser';
import logger from '../utils/logger';
import formidableMiddleware from 'express-formidable';



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
router.post(
    '/handleInboundEmail',
    formidableMiddleware(),
    async (req, res) => {
        const from = req.fields?.from as string | undefined;
        const to = req.fields?.to as string | undefined;
        const subject = req.fields?.subject as string | undefined;
        const text = req.fields?.text as string | undefined;

        const headers = req.fields?.headers as string | undefined;
        let messageId: string | undefined;
        let inReplyTo: string | undefined;
        let references: string | undefined;

        if (headers) {
            const matchMsg = headers.match(/^Message-ID:\s*(.+)$/im);
            const matchReply = headers.match(/^In-Reply-To:\s*(.+)$/im);
            const matchRefs = headers.match(/^References:\s*(.+)$/im);

            if (matchMsg) {
                messageId = matchMsg[1].trim().replace(/^<|>$/g, '');
            }
            if (matchReply) {
                inReplyTo = matchReply[1].trim().replace(/^<|>$/g, '');
            }
            if (matchRefs) {
                references = matchRefs[1].trim();
            }
        }

        // Optionally log for debugging
        console.debug("✅ Parsed inbound email fields:", req.fields);

        // Forward to your controller
        await handleInboundEmail(
            { body: { from, to, subject, text, messageId, inReplyTo, references } } as any,
            res
        );
    }
);

router.post(
    '/handleInboundEmailTest',
    async (req, res) => {

        // Forward to your controller
        await handleInboundEmail(
            req,
            res
        );
    }
);


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