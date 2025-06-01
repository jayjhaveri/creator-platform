// src/services/voiceAgent/uploadAudioToFirebase.ts

import { getStorage } from 'firebase-admin/storage';

import { v4 as uuidv4 } from 'uuid';
import logger from './logger';
import { db } from '../config/firebase';


/**
 * Upload audio buffer to Firebase Storage under a structured path
 * and generate a signed download URL.
 *
 * @param buffer - Raw audio buffer (e.g., from ElevenLabs API)
 * @param conversationId - Conversation ID from ElevenLabs
 * @param voiceCommunicationId - Firestore document ID for this communication
 * @returns Signed URL to access the uploaded audio
 */
export const saveAudioToFirebase = async (
    buffer: Buffer,
    conversationId: string,
    voiceCommunicationId: string
): Promise<string> => {
    try {
        const storage = getStorage();
        const bucket = storage.bucket();

        const filePath = `voiceCalls/conversations/${conversationId}.mp3`;
        const file = bucket.file(filePath);
        const uuid = uuidv4();

        await file.save(buffer, {
            metadata: {
                contentType: 'audio/mpeg',
                metadata: {
                    firebaseStorageDownloadTokens: uuid,
                },
            },
            public: false,
        });

        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        logger.info(`Uploaded audio for conversation ${conversationId}, URL: ${signedUrl}`);

        await db.collection('voiceCommunications').doc(voiceCommunicationId).update({
            audioUrl: signedUrl,
            audioPath: filePath,
            updatedAt: new Date().toISOString(),
        });

        return signedUrl;
    } catch (error) {
        logger.error(`Failed to upload audio for conversation ${conversationId}`, error);
        throw new Error('Audio upload to Firebase failed');
    }
};
