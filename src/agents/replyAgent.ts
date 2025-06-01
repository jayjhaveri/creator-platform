import Groq from 'groq-sdk';
import { Brand, Creator, Negotiation } from '../types/schema';
import logger from '../utils/logger';
import { EmailMessage } from '../utils/generateEmailContent';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

interface ReplyAnalysisResult {
    action: 'request_phone' | 'initiate_call' | 'accepted' | 'escalate' | 'canelled';
    notes: string;
    phoneNumber?: string;
    callScript?: string;
}

export const analyzeInboundReply = async (
    messageHistory: EmailMessage[],
    negotiation: Negotiation,
    creator: Creator,
    brand: Brand
): Promise<ReplyAnalysisResult> => {
    const prompt = `
You're an AI negotiation assistant for the brand "${brand.brandName}".
A creator named "${creator.displayName}" has replied to your email regarding campaign "${negotiation.campaignId}".

Please:
1. Decide one of these actions only: "request_phone", "initiate_call", "escalate", "accepted", "cancelled".
2. If a valid phone number is included, action must be "initiate_call".
3. If no phone number but creator seems interested or positive, use "request_phone".
4. If the reply is vague, short, or just a greeting (like "hello", "hi", etc), use "escalate".
5. If the user asks for rates or pricing, use "ask_rate".
6. If the reply is a clear acceptance, use "accepted".
7. If the reply is negative or declines the offer, use "cancelled".

Output valid JSON:
{
  "action": "request_phone" | "initiate_call" | "escalate" | "accepted" | "cancelled",
  "notes": "short reasoning",
  "phoneNumber": "optional, if found",
  "callScript": "optional, if action is initiate_call"
}

Creator reply:
"""
${messageHistory
            .map((msg) => `- ${msg.sender}: ${msg.subject}\n${msg.body}`)
            .join('\n\n')}
"""
`;

    const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        messages: [
            { role: 'system', content: 'You are a negotiation agent helping brands collaborate with creators.' },
            { role: 'user', content: prompt.trim() },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 512,
    });

    const message = response.choices[0]?.message?.content;
    logger.info('Groq reply analysis response:', message);
    if (!message) throw new Error('No response from Groq reply analyzer');

    try {
        const parsed: ReplyAnalysisResult = JSON.parse(message);
        return parsed;
    } catch (err) {
        console.error('Failed to parse Groq reply analysis JSON:', message);
        throw new Error('Invalid LLM reply format');
    }
};
