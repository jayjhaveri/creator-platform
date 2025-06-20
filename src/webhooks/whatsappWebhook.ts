// src/routes/whatsappWebhookHandler.ts
import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { getOrchestratorAgent } from '../agents/orchestratorAgent';
import { sendWhatsAppReply } from '../utils/whatsapp';
import logger from '../utils/logger';
import { extractTextFromDocument } from '../utils/extractTextFromDocument';
import { transcribeVoice } from '../utils/transcribeVoice';

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

        const phone = data.from;
        const sessionId = phone;
        const userId = phone;
        const contentType = data.content?.media?.type || 'text';
        const senderName = data.whatsapp?.senderName || 'Unknown Sender';
        //log content type
        logger.info('Content type received', { contentType });
        let extractedText = '';

        // Step 1: Save raw message
        await db.collection('whatsapp_messages').add({
            messageId: data.messageId,
            from: phone,
            to: data.to,
            receivedAt: data.receivedAt || new Date().toISOString(),
            event: data.event || 'message',
            contentType: contentType || 'text',
            text: data.content?.text || null,
            senderName: data.whatsapp?.senderName || null,
            isin24window: data.isin24window || false,
            isResponded: data.isResponded || false,
            timestamp: data.timestamp || new Date().toISOString(),
            raw: data,
        });

        // Step 2: Handle content type
        if (contentType === 'text') {
            extractedText = data.content.text;
        } else if (contentType === 'image') {
            //send acknowledgment reply
            await sendWhatsAppReply(phone, 'Processing your image, please wait...');
            extractedText = await extractTextFromDocument(data.content.media.url);
            extractedText = `Extracted from uploaded image:\n${extractedText}`;
        } else if (contentType === 'document') {
            //send acknowledgment reply
            await sendWhatsAppReply(phone, 'Processing your document, please wait...');
            extractedText = await extractTextFromDocument(data.content.media.url);
            extractedText = `Extracted from uploaded document:\n${extractedText}`;
        } else if (contentType === 'voice') {
            //send acknowledgment reply
            await sendWhatsAppReply(phone, 'Processing your voice note, please wait...');
            extractedText = await transcribeVoice(data.content.media.url);
            extractedText = `Transcribed from voice note:\n${extractedText}`;
        } else {
            logger.warn('Unsupported content type received', { contentType });
            await sendWhatsAppReply(phone, 'Sorry, I could not understand this type of message.');
            return res.status(200).send('Unsupported message type');
        }

        if (!extractedText || extractedText.trim() === '') {
            logger.warn('No extractable text found');
            await sendWhatsAppReply(phone, 'Sorry, I could not extract any meaningful content from your message.');
            return res.status(200).send('Empty content');
        }

        // Step 3: Pass to agent
        const agent = await getOrchestratorAgent(sessionId, phone, senderName);
        let result = await agent.invoke({ input: extractedText });

        if (!result.output || result.output.trim() === '') {
            logger.warn('Agent returned empty output, retrying with extracted text');
            result = await agent.invoke({ input: extractedText });
            if (!result.output || result.output.trim() === '') {
                result.output = 'Sorry, I could not generate a response at this time. Please try again later.';
            }
        }

        logger.info('Agent response generated', { output: result.output });
        const messages = result.output?.split('<!--SPLIT-->') ?? [];

        if (messages.length === 0 || (messages.length === 1 && !messages[0].trim())) {
            await sendWhatsAppReply(phone, "Sorry, I couldn't generate a response. Please try again.");
        } else {
            for (const msg of messages) {
                const trimmed = msg.trim();
                if (trimmed.length > 0) {
                    await sendWhatsAppReply(phone, trimmed);
                }
            }
        }

        return res.status(200).send('Processed and replied.');
    } catch (err) {
        logger.error('WhatsApp Webhook Error', { error: err });
        return res.status(500).send('Internal server error');
    }
}