import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { getOrchestratorAgent } from '../agents/orchestratorAgent';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { sendWhatsAppReply } from '../utils/whatsapp';

export async function whatsappWebhookHandler(req: Request, res: Response) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).send('Only POST requests are allowed');
        }

        const data = req.body;

        if (!data.messageId || !data.content || !data.from) {
            return res.status(400).send('Missing required fields');
        }

        const now = new Date().toISOString();
        const phone = data.from;
        const text = data.content?.text || '';
        const sessionId = phone;
        const userId = phone;

        // 1. Save raw WhatsApp message
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

        // 2. Upsert into userChats
        const chatRef = db.collection('userChats').doc(sessionId);
        const chatDoc = await chatRef.get();

        const messageEntry = {
            role: 'human',
            content: text,
            timestamp: now,
        };

        if (chatDoc.exists) {
            await chatRef.update({
                messages: FieldValue.arrayUnion(messageEntry),
                updatedAt: now,
            });
        } else {
            await chatRef.set({
                sessionId,
                userId,
                messages: [messageEntry],
                createdAt: now,
                updatedAt: now,
            });
        }

        // 3. Run orchestrator agent to get AI response
        const agent = await getOrchestratorAgent(sessionId, phone);
        const result = await agent.invoke({ input: text });

        const aiMessage = {
            role: 'ai',
            content: result.output,
            timestamp: new Date().toISOString(),
        };

        // 4. Save AI reply to userChats
        await chatRef.update({
            messages: FieldValue.arrayUnion(aiMessage),
            updatedAt: new Date().toISOString(),
        });

        // 5. Optionally send WhatsApp reply (if integrated with an API like 11za)
        await sendWhatsAppReply(phone, result.output);

        return res.status(200).send('Processed and replied.');
    } catch (err) {
        console.error('WhatsApp Webhook Error:', err);
        return res.status(500).send('Internal server error');
    }
}