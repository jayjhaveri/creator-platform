// src/utils/generateFormattedMarkdown.ts

import { Brand, Campaign, VoiceTranscriptMessage } from '../types/schema';
import { EmailMessage } from './generateEmailContent';
import logger from './logger';
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

/**
 * Uses Groq (Mixtral) to format brand, campaign, and communication data into clean markdown.
 */
export const generateFormattedMarkdown = async (
    brand: Brand,
    campaign: Campaign,
    communications: EmailMessage[],
    voiceHistory: VoiceTranscriptMessage[],
): Promise<string> => {
    const rawInput = {
        brand,
        campaign,
        communications,
        voiceHistory
    };

    const prompt = `
You are a helpful assistant who takes structured JSON data for a brand, campaign, and communication history, and produces well-formatted markdown suitable for use as a knowledge base document.

Format with headers like # Brand Info, ## Campaign, ## Communications, and under each, give clean summaries and structured content.

For each communication, include sender (brand or creator), subject, and content.

All currency values should be formatted in Indian Rupees (₹).

Here's the data:

${JSON.stringify(rawInput, null, 2)}

Return only markdown. Do not include commentary or extra formatting.
  `;

    try {
        const completion = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
            messages: [
                { role: 'system', content: `You are an expert markdown formatter.` },
                { role: 'user', content: prompt },
            ],
            temperature: 0.6,
        });

        const result = completion.choices[0].message.content;
        logger.info('Generated formatted markdown from Groq:', result);
        return result || '';
    } catch (error: any) {
        logger.error('Error generating formatted markdown from Groq:', error);
        throw new Error('Failed to generate formatted markdown');
    }
};