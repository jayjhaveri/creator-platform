// src/services/voiceAgent/scheduleTranscriptionPolling.ts

import { CloudTasksClient, protos } from '@google-cloud/tasks';
import logger from '../../utils/logger';

const tasksClient = new CloudTasksClient();
const QUEUE_NAME = 'poll-transcription-queue'; // Make sure this queue exists
const QUEUE_LOCATION = 'us-central1'; // Your GCP region

/**
 * Schedules a Cloud Task to poll transcription results for a voice communication.
 * @param voiceCommunicationId The Firestore doc ID to poll and update
 */
export const scheduleTranscriptionPollingTask = async (voiceCommunicationId: string): Promise<void> => {
    const delayInMinutes = 10;
    const delayInSeconds = delayInMinutes * 60;

    const task: protos.google.cloud.tasks.v2.ITask = {
        scheduleTime: {
            seconds: Math.floor(Date.now() / 1000) + delayInSeconds,
        },
        httpRequest: {
            httpMethod: protos.google.cloud.tasks.v2.HttpMethod.POST,
            url: `${process.env.API_BASE_URL}/tasks/poll-transcription`,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify({ voiceCommunicationId })).toString('base64'),
        },
    };

    const parent = tasksClient.queuePath(
        process.env.GCP_PROJECT!,
        QUEUE_LOCATION,
        QUEUE_NAME
    );

    try {
        await tasksClient.createTask({ parent, task });
        logger.info(`Scheduled transcription polling task for voiceCommunicationId: ${voiceCommunicationId}`);
    } catch (err) {
        logger.error('Failed to schedule transcription polling task', err);
        throw new Error('Unable to create transcription polling task');
    }
};