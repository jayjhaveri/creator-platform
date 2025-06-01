// src/tasks/pollTranscription.ts

import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { VoiceCommunication } from '../types/schema';
import { elevenLabs } from '../services/elevenLabs/clients/elevenLabsClient';
import logger from '../utils/logger';
import { saveAudioToFirebase } from '../utils/uploadAudioToFirebase';

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