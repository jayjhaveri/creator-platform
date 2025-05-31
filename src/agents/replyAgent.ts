import Groq from 'groq-sdk';
import { Brand, Creator, Negotiation } from '../types/schema';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

interface ReplyAnalysisResult {
    action: 'request_phone' | 'initiate_call' | 'ask_rate' | 'escalate';
    notes: string;
    phoneNumber?: string;
    callScript?: string;
}

export const analyzeInboundReply = async (
    replyText: string,
    negotiation: Negotiation,
    creator: Creator,
    brand: Brand
): Promise<ReplyAnalysisResult> => {
    const prompt = `
You're an AI negotiation assistant for the brand "${brand.brandName}".
A creator named "${creator.displayName}" has replied to your email regarding campaign "${negotiation.campaignId}".

Please:
1. Analyze the reply and decide the next step.
2. If a phone number is present, extract it in E.164 or standard format.
3. Suggest a call script if appropriate.

Return only valid JSON like this:
{
  "action": "request_phone" | "initiate_call" | "ask_rate" | "escalate",
  "notes": "short explanation",
  "phoneNumber": "9876543210", // or "" if not found
  "callScript": "if action is initiate_call"
}

Creator reply:
"""
${replyText}
"""
`;

    const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        messages: [
            { role: 'system', content: 'You are a negotiation agent helping brands collaborate with creators.' },
            { role: 'user', content: prompt.trim() },
        ],
        temperature: 0.3,
        max_tokens: 512,
    });

    const message = response.choices[0]?.message?.content;
    if (!message) throw new Error('No response from Groq reply analyzer');

    try {
        const parsed: ReplyAnalysisResult = JSON.parse(message);
        return parsed;
    } catch (err) {
        console.error('Failed to parse Groq reply analysis JSON:', message);
        throw new Error('Invalid LLM reply format');
    }
};
