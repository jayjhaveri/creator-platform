import logger from '../../utils/logger';
import { elevenLabs } from './clients/elevenLabsClient';

interface CreateKBResponse {
    id: string;
    name: string;
}

/**
 * Create a knowledge base from markdown text for a brand.
 * @param text - The markdown-formatted string containing brand context.
 * @param name - Human-readable name for the knowledge base.
 * @returns The created knowledge base ID.
 */
export const createKnowledgeBase = async (
    text: string,
    name: string
): Promise<string> => {
    try {
        const response = await elevenLabs.post<CreateKBResponse>('/knowledge-base/text', {
            text,
            name,
        });

        logger.info(`Created ElevenLabs KB for '${name}': ${response.data.id}`);
        return response.data.id;
    } catch (error: any) {
        logger.error('Failed to create knowledge base:', error?.response?.data || error.message);
        throw new Error('Error creating knowledge base for ElevenLabs');
    }
};

/**
 * Delete a knowledge base document from ElevenLabs.
 * @param kbId - The knowledge base document ID.
 */
export const deleteKnowledgeBase = async (kbId: string): Promise<void> => {
    try {
        await elevenLabs.delete(`/knowledge-base/${kbId}`, {
            params: { force: true },
        });

        logger.info(`Deleted ElevenLabs KB document with ID: ${kbId}`);
    } catch (error: any) {
        logger.error('Failed to delete knowledge base document:', error?.response?.data || error.message);
        throw new Error('Error deleting knowledge base document from ElevenLabs');
    }
};