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
        logger.info('Request body received', { body: data });

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

        logger.info('Upserting into userChats', { sessionId });
        const chatRef = db.collection('userChats').doc(sessionId);
        const chatDoc = await chatRef.get();

        const messageEntry = {
            role: 'human',
            content: text,
            timestamp: now,
        };

        if (chatDoc.exists) {
            logger.info('Updating existing chat document', { sessionId });
            await chatRef.update({
                messages: FieldValue.arrayUnion(messageEntry),
                updatedAt: now,
            });
        } else {
            logger.info('Creating new chat document', { sessionId });
            await chatRef.set({
                sessionId,
                userId,
                messages: [messageEntry],
                createdAt: now,
                updatedAt: now,
            });
        }

        logger.info('Invoking orchestrator agent', { sessionId, input: text });
        const agent = await getOrchestratorAgent(sessionId, phone);
        const result = await agent.invoke({ input: text });

        logger.info('Received AI response', { output: result.output });
        const aiMessage = {
            role: 'ai',
            content: result.output,
            timestamp: new Date().toISOString(),
        };

        logger.info('Saving AI reply to userChats', { sessionId });
        await chatRef.update({
            messages: FieldValue.arrayUnion(aiMessage),
            updatedAt: new Date().toISOString(),
        });

        logger.info('Sending WhatsApp reply', { phone, reply: result.output });
        await sendWhatsAppReply(phone, result.output);

        logger.info('Successfully processed and replied to the message', { messageId: data.messageId });
        return res.status(200).send('Processed and replied.');
    } catch (err) {
        logger.error('WhatsApp Webhook Error', { error: err });
        return res.status(500).send('Internal server error');
    }
}