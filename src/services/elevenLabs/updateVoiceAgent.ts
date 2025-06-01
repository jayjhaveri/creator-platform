import { elevenLabs } from './clients/elevenLabsClient';
import logger from '../../utils/logger';

interface UpdateAgentResponse {
    id: string;
    name: string;
}

export async function updateVoiceAgent({ agentId, kbIds, prompt = '', firstMessage = '' }: { agentId: string; kbIds: { id: string; name: string; }[]; prompt?: string; firstMessage?: string; }): Promise<string> {
    try {
        const response = await elevenLabs.patch<UpdateAgentResponse>(`/agents/${agentId}`, {
            conversation_config: {
                agent: {
                    prompt: {
                        knowledge_base: kbIds.map(kb => ({
                            id: kb.id,
                            name: kb.name,
                            type: 'text',
                        })),
                        prompt,
                    },
                    first_message: firstMessage
                }
            }
        });

        logger.info(`Updated ElevenLabs Agent '${agentId}' with KBs: ${kbIds.map(k => k.name).join(', ')}`);
        return response.data.id;
    } catch (error: any) {
        logger.error('Failed to update ElevenLabs agent:', error?.response?.data || error.message);
        throw new Error('Error updating voice agent for ElevenLabs');
    }
}