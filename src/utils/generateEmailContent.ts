import Groq from 'groq-sdk';
import { Campaign, Creator, Brand } from '../types/schema';
import logger from './logger';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

export const generateEmailContent = async (
    brand: Brand,
    creator: Creator,
    campaign: Campaign
): Promise<{ subject: string; body: string }> => {
    const systemPrompt = `
You are an AI assistant representing the brand "${brand.brandName}".
Write a short, warm, human-sounding cold email to the creator "${creator.displayName}" about the campaign "${campaign.campaignName}".

Your goal:
- Compliment the creator's content genuinely.
- Briefly mention the campaign and why they’re a good fit.
- Ask for their phone number to connect via voice assistant (no pricing yet).

Respond strictly in the following Markdown format:

## Subject
<short subject here>

## Body
<email body here — max 150 words>

Do not include any explanations or extra commentary.
`;

    const userPrompt = `
Campaign Overview:
- Name: ${campaign.campaignName}
- Description: ${campaign.description}
- Platforms: ${campaign.requiredPlatforms.map(p => `${p.platform} (${p.contentType} x${p.quantity})`).join(', ')}
- Budget: ₹${campaign.budget}
- Timeline: ${campaign.startDate} to ${campaign.endDate}

Creator:
- Name: ${creator.displayName}
- Category: ${creator.category}
- Followers: IG: ${creator.instagramFollowers}, YT: ${creator.youtubeSubscribers}

Now write:
1. A subject line (max 10 words)
2. A short email body (150 words max)
`;

    const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        messages: [
            { role: 'system', content: systemPrompt.trim() },
            { role: 'user', content: userPrompt.trim() },
        ],
        temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    logger.info('Generated email content:', content);
    if (!content) throw new Error('No response from Groq');

    const cleanedContent = content
        .replace('[Your Name]', brand.brandName)
        .trim();

    const subjectMatch = cleanedContent.match(/## Subject\s+(.+?)\s+## Body/s);
    const bodyMatch = cleanedContent.match(/## Body\s+([\s\S]*)/);

    const rawSubject = subjectMatch?.[1].trim() ?? '';
    const fallbackSubject = `Collaboration Opportunity with ${brand.brandName}`;
    const safeSubject = rawSubject.length < 100 ? rawSubject : fallbackSubject;

    const body = bodyMatch?.[1].trim() ?? '';

    return { subject: safeSubject, body };
};

export async function generatePhoneRequestEmail({ brand, creator, campaign,
    previousEmailSubject, previousEmailBody, creatorReply }: { brand: Brand; creator: Creator; campaign: Campaign; previousEmailSubject: string; previousEmailBody?: string; creatorReply?: string; }): Promise<{ subject: string; body: string; }> {
    const systemPrompt = `
You are an AI assistant following up on a previous email thread.
The brand "${brand.brandName}" is trying to get in touch with the creator "${creator.displayName}" regarding the campaign "${campaign.campaignName}".

Your goal:
- Follow up politely and naturally based on the conversation.
- Ask again for the creator’s phone number for a voice assistant to follow up.

Respond strictly in the following Markdown format:

## Subject
<short subject here>

## Body
<follow-up email body here — max 100 words>

Do not include any explanations or extra commentary.
`;

    const userPrompt = `
Here is the last email we sent:
"${previousEmailBody || '[Not Available]'}"

Here is the creator's reply:
"${creatorReply || '[No reply yet]'}"

Now write:
1. A subject line (max 10 words)
2. A short follow-up body (100 words max)
`;

    const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        messages: [
            { role: 'system', content: systemPrompt.trim() },
            { role: 'user', content: userPrompt.trim() },
        ],
        temperature: 0.6,
    });

    const content = response.choices[0].message.content;
    logger.info('Generated follow-up email content:', content);
    if (!content) throw new Error('No response from Groq');

    const cleanedContent = content.trim();

    const subjectMatch = cleanedContent.match(/## Subject\s+(.+?)\s+## Body/s);
    const bodyMatch = cleanedContent.match(/## Body\s+([\s\S]*)/);

    const rawSubject = subjectMatch?.[1].trim() ?? '';
    const fallbackSubject = `Quick Follow-up from ${brand.brandName}`;
    const safeSubject = rawSubject.length < 100 ? rawSubject : fallbackSubject;

    const body = bodyMatch?.[1].trim() ?? '';

    return { subject: previousEmailSubject || "", body };
}

export async function generateCallConfirmationEmail({
    brand,
    creator,
    campaign,
    previousEmailSubject,
    previousEmailBody,
    creatorReply,
    preferredCallTime,
}: {
    brand: Brand;
    creator: Creator;
    campaign: Campaign;
    previousEmailSubject: string;
    previousEmailBody?: string;
    creatorReply?: string;
    preferredCallTime?: string;
}): Promise<{ subject: string; body: string }> {
    const systemPrompt = `
You're an AI assistant for the brand "${brand.brandName}".
The creator "${creator.displayName}" has shared their phone number for the campaign "${campaign.campaignName}".

Write a short, warm email:
- Acknowledge their reply and phone number.
- Mention a call will happen soon (default: "in 2 hours", or use provided time).
- Be warm, polite, and helpful.
- End with an invitation to reply if they need anything else.

Respond in this Markdown format:

## Subject
<short subject here — reuse thread subject if needed>

## Body
<confirmation message — max 100 words>

NO extra commentary or explanation.
  `.trim();

    const userPrompt = `
Last email we sent:
"${previousEmailBody || '[Not available]'}"

Creator's reply:
"${creatorReply || '[Not available]'}"

Preferred call time (if any): "${preferredCallTime || 'N/A'}"

Now write the confirmation email.
  `.trim();

    const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
    });

    const content = response.choices[0].message.content;
    logger.info('Generated call confirmation email content:', content);

    if (!content) throw new Error('No response from Groq for call confirmation');

    const subjectMatch = content.match(/## Subject\s+(.+?)\s+## Body/s);
    const bodyMatch = content.match(/## Body\s+([\s\S]*)/);

    const rawSubject = subjectMatch?.[1].trim() ?? '';
    const fallbackSubject = previousEmailSubject || `Call Confirmation from ${brand.brandName}`;
    const safeSubject = rawSubject.length < 100 ? rawSubject : fallbackSubject;

    const body = bodyMatch?.[1].trim() ?? '';

    return { subject: safeSubject, body };
}