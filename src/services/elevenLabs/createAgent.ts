import { elevenLabs } from './clients/elevenLabsClient';
import logger from '../../utils/logger';
import { Brand } from '../../types/schema';

interface CreateAgentResponse {
    agent_id: string;
    name: string;
}

interface KBReference {
    id: string;
    name: string;
}

/**
 * Creates a new ElevenLabs voice agent for a brand.
 * @param kbIds - Array of knowledge base references to attach.
 * @param brandName - The name of the brand.
 * @param prompt - (Optional) Custom system prompt for agent behavior.
 * @param firstMessage - (Optional) Initial message spoken by the agent.
 */
export async function createVoiceAgent({ kbIds, brand, prompt = '', firstMessage = '' }: { kbIds: KBReference[]; brand: Brand; prompt?: string; firstMessage?: string; }): Promise<string> {
    try {
        const response = await elevenLabs.post<CreateAgentResponse>('/agents/create', {
            conversation_config: {
                agent: {
                    prompt: {
                        knowledge_base: kbIds.map(kb => ({
                            id: kb.id,
                            name: kb.name,
                            type: 'text'
                        })),
                        prompt,
                    },
                    first_message: firstMessage
                }
            },
            name: `${brand.brandName}-${brand.brandId}`,
        });

        logger.info(`Created ElevenLabs Agent for '${brand.brandName}': ${response.data.agent_id}`);
        return response.data.agent_id;
    } catch (error: any) {
        logger.error('Failed to create ElevenLabs agent:', error?.response?.data || error.message);
        throw new Error('Error creating voice agent for ElevenLabs');
    }
}