import { elevenLabs } from './clients/elevenLabsClient';
import logger from '../../utils/logger';

export interface TranscriptSegment {
    role: 'user' | 'agent';
    message: string;
    time_in_call_secs: number;
}

export interface ConversationPollResult {
    agent_id: string;
    conversation_id: string;
    status: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
    transcript: TranscriptSegment[];
    metadata: {
        start_time_unix_secs: number;
        call_duration_secs: number;
    };
    has_audio: boolean;
    has_user_audio: boolean;
    has_response_audio: boolean;
}

export const pollConversationUntilDone = async (
    conversationId: string,
    maxAttempts = 10,
    delayMs = 5000
): Promise<ConversationPollResult> => {
    let attempt = 0;
    while (attempt < maxAttempts) {
        try {
            const response = await elevenLabs.get<{ body: ConversationPollResult }>(
                `/conversations/${conversationId}`
            );
            const result = response.data.body;

            logger.info(
                `Polling attempt ${attempt + 1}: Conversation ${conversationId} status = ${result.status}`
            );

            if (result.status === 'done' || result.status === 'failed') {
                return result;
            }
        } catch (error: any) {
            logger.error('Error polling ElevenLabs conversation:', error?.response?.data || error.message);
        }

        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(`Polling timed out after ${maxAttempts} attempts for conversation ${conversationId}`);
};