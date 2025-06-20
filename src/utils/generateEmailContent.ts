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

**Follow this strict Markdown format for your response:**
**(If you don't follow this, your response will be rejected.)**

## Subject
<The next email’s subject line — keep it short and clear>

## Body
<The next email’s body — max 150 words. Must be friendly, natural, and professional.>

**Only return the Markdown response. Do NOT include any explanations or commentary.**  
`;

    const userPrompt = `
Campaign Overview:
- Name: ${campaign.campaignName}
- Description: ${campaign.description}
- Deliverables: ${campaign.deliverables}
- Budget: ₹${campaign.budgetPerCreator}
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


export interface EmailMessage {
    /** “brand” when the brand sent it, “creator” when the creator replied */
    sender: "brand" | "creator";
    subject: string;
    body: string;
}

export async function generateNextEmail({ brand, creator, campaign, history }: { brand: Brand; creator: Creator; campaign: Campaign; history: EmailMessage[]; }): Promise<{ subject: string; body: string; }> {
    const systemPrompt = `
You are an AI email‐negotiation assistant for the brand "${brand.brandName}". 
Your job is to handle the entire email thread with creator "${creator.displayName}" regarding campaign "${campaign.campaignName}". 

Campaign details:
- Description: ${campaign.description}
- Deliverables: ${campaign.deliverables}
- Budget: ₹${campaign.budgetPerCreator}
- Timeline: ${campaign.startDate} to ${campaign.endDate}

Creator details:
- Name: ${creator.displayName}
- Email: ${creator.email}
- Primary category: ${creator.category}
- Followers: IG: ${creator.instagramFollowers}, YT: ${creator.youtubeSubscribers}

Brand details:
- Name: ${brand.brandName}
- Email: ${brand.email}
- Phone: ${brand.phone || "[not provided]"}

Your responsibilities:
1. Review the entire negotiation history (see the messages below, in chronological order).
2. If the creator has not yet given a phone number or expressed clear willingness, send a friendly follow‐up asking for their phone number for a voice call. 
3. If the creator provided their phone number in a previous email, send a polite confirmation (“Thank you, we will call you in 2 hours/minutes…”) and wrap up this email‐thread.
4. If the creator asks for campaign pricing, respond by summarizing the budget range and suggest scheduling a call to finalize.
5. If the creator’s reply is vague (“Hi,” “Sounds good,” etc.), send a gentle prompt to clarify or share their availability.
6. If the negotiation is already complete (phone booked, no further follow‐ups needed), respond with “no further emails needed.”

Follow this strict Markdown format for your response Subject and Body:
**Output format (strictly in Markdown and strictly follow this format):**

## Subject
<The next email’s subject line>

## Body
<The next email’s body, max 150 words>

**Do NOT** include any explanation beyond the subject and body.  
`.trim();

    const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
    ];

    for (const msg of history) {
        const combined = `Subject: ${msg.subject}\n\n${msg.body}`;
        if (msg.sender === "creator") {
            chatMessages.push({ role: "user", content: combined });
        } else {
            chatMessages.push({ role: "assistant", content: combined });
        }
    }


    const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-maverick-17b-128e-instruct",
        messages: chatMessages,
        temperature: 0.6,
    });


    const aiContent = response.choices[0]?.message?.content || "";
    logger.info("NegotiatorAgent: raw LLM reply:", aiContent);

    // 4) Parse the Markdown reply into subject/body.
    const cleaned = aiContent.trim();
    const subjectMatch = cleaned.match(/## Subject\s+(.+?)\s+## Body/s);
    const bodyMatch = cleaned.match(/## Body\s+([\s\S]*)/);

    let nextSubject = subjectMatch?.[1].trim() ?? "";
    let nextBody = bodyMatch?.[1].trim() ?? "";

    // If the model indicates no further emails, we can return empty strings or a sentinel.
    if (/no further emails needed/i.test(nextSubject + " " + nextBody)) {
        nextSubject = "";
        nextBody = "No further emails needed.";
    }

    if (!nextBody) {
        logger.warn("NegotiatorAgent: No body content generated, using fallback.");
        nextBody = "Thank you for your response. Please let us know if you have any questions or need further information.";
    }

    //check if history has 2 or more messages
    let reSubject = ""
    if (history.length >= 2) {
        reSubject = history[1].subject;
        logger.info("NegotiatorAgent: Using second message subject for reply:", reSubject);
    } else {
        // If we don't have a second message, we can use the first message's subject as a fallback
        reSubject = history[0].subject;
        logger.info("NegotiatorAgent: Using first message subject for reply:", reSubject);
    }

    return { subject: reSubject || "", body: nextBody || "" };
}