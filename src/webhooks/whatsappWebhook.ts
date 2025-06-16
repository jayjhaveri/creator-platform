import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { getOrchestratorAgent } from '../agents/orchestratorAgent';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { sendWhatsAppReply } from '../utils/whatsapp';
import logger from '../utils/logger';

export async function whatsappWebhookHandler(req: Request, res: Response) {
    try {
        logger.info('Received a request on WhatsApp webhook', { method: req.method });

        if (req.method !== 'POST') {
            logger.warn('Invalid request method', { method: req.method });
            return res.status(405).send('Only POST requests are allowed');
        }

        const data = req.body;
        logger.info('Request body received', JSON.stringify(data, null, 2));

        if (!data.messageId || !data.content || !data.from) {
            logger.error('Missing required fields in request body', { body: data });
            return res.status(400).send('Missing required fields');
        }

        const now = new Date().toISOString();
        const phone = data.from;
        const text = data.content?.text || '';
        const sessionId = phone;
        const userId = phone;

        logger.info('Saving raw WhatsApp message', { messageId: data.messageId, from: phone });
        await db.collection('whatsapp_messages').add({
            messageId: data.messageId,
            from: phone,
            to: data.to,
            receivedAt: data.receivedAt,
            event: data.event,
            contentType: data.content?.contentType || null,
            text,
            senderName: data.whatsapp?.senderName || null,
            isin24window: data.isin24window,
            isResponded: data.isResponded,
            userResponse: data.UserResponse,
            timestamp: data.timestamp,
            raw: data,
        });

        logger.info('Invoking orchestrator agent', { sessionId, input: text });
        const agent = await getOrchestratorAgent(sessionId, phone);
        let result = await agent.invoke({ input: text });

        logger.info('Received AI response', { output: result.output });

        logger.info('Sending WhatsApp reply', { phone, reply: result.output });

        //if result.output is empty, try again with the agent
        if (!result.output || result.output.trim() === '') {
            logger.warn('Empty AI response, retrying with agent', { sessionId, input: text });
            result = await agent.invoke({ input: text });
            if (!result.output || result.output.trim() === '') {
                logger.error('AI response is still empty after retry', { sessionId, input: text });
                result.output = 'Sorry, I could not generate a response at this time. Please try again later.';
                return res.status(200).send('No response generated');
            }
            logger.info('Retry successful, sending new response', { output: result.output });
        }

        await sendWhatsAppReply(phone, result.output);

        logger.info('Successfully processed and replied to the message', { messageId: data.messageId });
        return res.status(200).send('Processed and replied.');
    } catch (err) {
        logger.error('WhatsApp Webhook Error', { error: err });
        return res.status(500).send('Internal server error');
    }
}