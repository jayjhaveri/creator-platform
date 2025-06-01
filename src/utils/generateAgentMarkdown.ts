// src/utils/generateAgentMarkdown.ts

import { Brand, Campaign, Communication, VoiceTranscriptMessage } from '../types/schema';
import { EmailMessage } from './generateEmailContent';
import { generateFormattedMarkdown } from './generateFormattedMarkdown';


export const generateAgentMarkdown = async (
    brand: Brand,
    campaign: Campaign,
    communications: EmailMessage[],
    voiceHistory: VoiceTranscriptMessage[]
): Promise<string> => {
    return await generateFormattedMarkdown(
        brand,
        campaign,
        communications,
        voiceHistory
    );
};
