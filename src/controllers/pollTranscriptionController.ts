// src/tasks/pollTranscription.ts

import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { VoiceCommunication } from '../types/schema';
import { elevenLabs } from '../services/elevenLabs/clients/elevenLabsClient';
import logger from '../utils/logger';
import { saveAudioToFirebase } from '../utils/uploadAudioToFirebase';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { HumanMessage } from '@langchain/core/messages';
import { send } from 'process';
import { sendWhatsAppReply } from '../utils/whatsapp';
import { saveAgentMessage, saveUserMessage } from '../utils/chatHistory';

export const pollTranscription = async (req: Request, res: Response) => {
    try {
        const { voiceCommunicationId } = req.body;
        if (!voiceCommunicationId) return res.status(400).json({ error: 'Missing voiceCommunicationId' });

        const docRef = db.collection('voiceCommunications').doc(voiceCommunicationId);
        const snapshot = await docRef.get();
        if (!snapshot.exists) return res.status(404).json({ error: 'Voice communication not found' });

        const voiceComm = snapshot.data() as VoiceCommunication;
        const { conversationId } = voiceComm;

        let updated = false;
        for (let i = 0; i < 10; i++) {
            const response = await elevenLabs.get(`/conversations/${conversationId}`);
            const body = response.data;

            if (body.status === 'done') {
                await docRef.update({
                    status: body.status,
                    transcript: body.transcript,
                    callDurationSecs: body.metadata?.call_duration_secs || 0,
                    startTimeUnixSecs: body.metadata?.start_time_unix_secs || 0,
                    hasAudio: body.has_audio,
                    hasUserAudio: body.has_user_audio,
                    hasResponseAudio: body.has_response_audio,
                    rawPayload: body,
                    updatedAt: new Date().toISOString(),
                });
                logger.info(`Transcription polling complete for ${voiceCommunicationId}`);
                updated = true;

                try {
                    const audioResponse = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`, {
                        method: "GET",
                        headers: {
                            "Xi-Api-Key": process.env.ELEVENLABS_API_KEY!,
                        },
                    });

                    if (!audioResponse.ok) {
                        throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
                    }

                    const audioBuffer = await audioResponse.arrayBuffer();

                    try {
                        const model = new ChatVertexAI({
                            model: 'gemini-2.5-flash',
                            temperature: 0.4,
                            maxOutputTokens: 3000,
                            maxRetries: 3,
                        });

                        const transcriptText = (body.transcript || [])
                            .filter((msg: any) => msg?.role && typeof msg.message === 'string' && msg.message.trim())
                            .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Agent'}: ${msg.message.trim()}`)
                            .join('\n');

                        const negotiationSnap = await db.collection('negotiations').doc(voiceComm.negotiationId).get();
                        if (!negotiationSnap.exists) throw new Error('Negotiation not found');

                        const negotiation = negotiationSnap.data();
                        if (!negotiation) throw new Error('Negotiation data is missing');

                        const campaignSnap = await db.collection('campaigns').doc(negotiation.campaignId).get();
                        const campaign = campaignSnap.exists ? campaignSnap.data() : null;
                        if (!campaign) throw new Error('Campaign not found');

                        //get brand details
                        const brandSnap = await db.collection('brands').where('brandId', '==', negotiation.brandId).limit(1).get();
                        if (brandSnap.empty) throw new Error('Brand not found');
                        const brand = brandSnap.docs[0].data();
                        if (!brand) throw new Error('Brand data is missing');

                        const creatorSnap = await db.collection('creators').doc(voiceComm.creatorId).get();
                        const creator = creatorSnap.exists ? creatorSnap.data() : null;

                        const dashboardLink = `https://influenzer-flow-dashboard.lovable.app/campaigns/${negotiation.campaignId}`;

                        const summaryPrompt = `
You are an AI assistant for the brand *${brand.brandName}*, summarizing a voice call the brand had with a creator.

🎯 *Your goal*: Write a crisp, friendly WhatsApp message that starts with: "Hi *${brand.brandName}* team 👋," and summarizes what the creator said and what was agreed. Use a clear, structured style. Use *bold*, emojis, and short bullet points.

🧾 *Context*:
- 👤 Creator: ${creator?.displayName || 'Unknown'} (${creator?.category || 'N/A'})
- 📣 Campaign: ${campaign?.campaignName || 'Unnamed Campaign'}
- 💰 Budget: ₹${campaign?.budget?.toLocaleString() || 'N/A'}

📌 *Summarize the call* by highlighting:
- ✅ Agreements (content type, payment, deadlines)
- 📌 Pending decisions or follow-ups
- 📬 Next steps for the brand team
- 🔗 For full details: ${dashboardLink}

🗣️ Transcript below:
${transcriptText}
`; const summary = await model.invoke([new HumanMessage(summaryPrompt)]);

                        let phone = brand.phone || 'No phone number provided';

                        // For testing purposes, replace with actual phone number
                        await sendWhatsAppReply(
                            phone,
                            summary.text || 'No summary generated',);
                        logger.info(`WhatsApp summary sent for ${voiceCommunicationId}`);

                        await saveAgentMessage(
                            phone,
                            summary.text || 'No summary generated',
                            phone,);

                    } catch (error) {
                        logger.error(`Failed to summarize transcript for ${voiceCommunicationId}:`, error);
                        await docRef.update({
                            summaryError: (error as Error).message,
                            updatedAt: new Date().toISOString(),
                        });
                        continue;
                    }

                    await saveAudioToFirebase(
                        Buffer.from(audioBuffer),
                        conversationId,
                        voiceCommunicationId
                    );
                    logger.info(`Audio saved for conversation ${conversationId} in voice communication ${voiceCommunicationId}`);
                } catch (error) {
                    logger.error(`Failed to fetch or save audio for conversation ${conversationId}:`, error);
                    await docRef.update({
                        audioFetchError: (error as Error).message,
                        updatedAt: new Date().toISOString(),
                    });
                }
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 6000));
        }

        if (!updated) {
            logger.warn(`Polling ended but transcription not complete for ${voiceCommunicationId}`);
        }

        res.status(200).json({ message: 'Polling complete' });
    } catch (err) {
        logger.error('Error in pollTranscription:', err);
        res.status(500).json({ error: 'Polling transcription failed' });
    }
};