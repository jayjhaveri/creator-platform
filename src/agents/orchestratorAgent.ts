// src/agents/orchestratorAgent.ts
import { ChatGroq } from '@langchain/groq';
import { createOpenAIToolsAgent, AgentExecutor } from 'langchain/agents';
import { DynamicStructuredTool } from 'langchain/tools';
import { z } from 'zod';

import { resolveCampaign } from '../tools/campaignResolver';
import { findMatchingCreators } from '../tools/creatorSearch';
import { sendEmailsToCreators } from '../tools/sendIntroEmails';
import { getInitiateVoiceCallsHandler, initiateVoiceCallsSchema } from '../tools/initiateVoiceCallsTool';
import { checkBrandExists } from '../tools/checkBrandExists';
import {
    ChatPromptTemplate,
    MessagesPlaceholder,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    AIMessagePromptTemplate,
} from '@langchain/core/prompts';
import { saveUserMessage, saveAgentMessage, getSessionData, saveToolLog, getToolLogs } from '../utils/chatHistory';
import logger from '../utils/logger';
import { BufferMemory } from 'langchain/memory';
import { FirestoreChatMessageHistory } from '../memory/FirestoreChatMessageHistory';
import { campaignManager } from '../tools/campaignManager';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { createBrand, getBrandByBrandId, getBrandById, updateBrand, updateBrandByBrandId } from '../services/brandService';

// const model = new ChatVertexAI({
//     model: 'gemini-2.5-flash',
//     temperature: 0.4,
//     maxOutputTokens: 1024,
//     maxRetries: 3,
//     convertSystemMessageToHumanContent: true,
// });

const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY!,
    model: 'qwen/qwen3-32b',
    temperature: 0.5,
});

export async function getOrchestratorAgent(sessionId: string, phone: string): Promise<AgentExecutor> {
    const tools = [
        new DynamicStructuredTool({
            name: 'resolveCampaign',
            description: 'Resolves or finds a campaign from user query. Input: { userInput: string }',
            schema: z.object({ userInput: z.string() }),
            func: async ({ userInput }) => {
                const result = await resolveCampaign({ userInput });
                await saveToolLog(sessionId, 'resolveCampaign', result);
                return JSON.stringify(result);
            },
        }),
        new DynamicStructuredTool({
            name: 'findMatchingCreators',
            description: 'Find creators that match a campaign. Input: { campaignId: string }',
            schema: z.object({ campaignId: z.string() }),
            func: async ({ campaignId }) => {

                if (!campaignId) {
                    throw new Error("Missing campaignId. This tool must be used with a valid campaignId.");
                }

                const result = await findMatchingCreators({ campaignId });
                await saveToolLog(sessionId, 'findMatchingCreators', result);
                return JSON.stringify(result);
            },
        }),
        new DynamicStructuredTool({
            name: 'sendEmailsToCreators',
            description: 'Send intro emails to creators. Input: { creatorIds: string[], campaignId: string }',
            schema: z.object({
                creatorIds: z.array(z.string()),
                campaignId: z.string(),
            }),
            func: async ({ creatorIds, campaignId }) => {
                const result = await sendEmailsToCreators({ creatorIds, campaignId });
                await saveToolLog(sessionId, 'sendEmailsToCreators', result);
                return JSON.stringify(result);
            },
        }),
        new DynamicStructuredTool({
            name: 'campaignManager',
            description: `
        Manage campaigns for a brand. Supports create, read, update, and delete operations.

        Input:
        {
            operation: "create" | "read" | "update" | "delete",
            payload: { ... },  // varies by operation
        }

        Rules:
        - For 'create', provide: campaignName, description, budget, targetAudience, startDate, endDate, requiredPlatforms, [targetCreatorCategories].
        - For 'read', no payload needed.
        - For 'update', provide: campaignId, updates (only fields to change).
        - For 'delete', provide: campaignId.
    `,
            schema: z.object({
                operation: z.enum(['create', 'read', 'update', 'delete']),
                payload: z.union([
                    z.object({ // create
                        campaignName: z.string(),
                        description: z.string(),
                        budget: z.number(),
                        targetAudience: z.string(),
                        requiredPlatforms: z.array(
                            z.object({
                                platform: z.string(),
                                contentType: z.string(),
                                quantity: z.number(),
                            })
                        ),
                        startDate: z.string(),
                        endDate: z.string(),
                        targetCreatorCategories: z.array(z.string()).optional()
                    }),
                    z.object({}).strict(), // read
                    z.object({ // update
                        campaignId: z.string(),
                        updates: z.record(z.any())
                    }),
                    z.object({ // delete
                        campaignId: z.string()
                    })
                ]), // Flexible, validated inside
            }),
            func: async ({ operation, payload }) => {
                const brandId = await SessionStateManager.get(sessionId, 'brandId');
                if (!brandId) {
                    throw new Error("Missing brandId. Ensure brand is registered first.");
                }

                const result = await campaignManager({
                    operation,
                    payload,
                    brandId,
                });

                await saveToolLog(sessionId, 'campaignManager', result);
                return JSON.stringify(result);
            },
        }),
        new DynamicStructuredTool({
            name: 'checkBrandExists',
            description: 'Check if a brand is already registered using phone number. Input: { phone: string }',
            schema: z.object({ phone: z.string() }),
            func: async ({ phone }) => {
                const result = await checkBrandExists(phone);
                await saveToolLog(sessionId, 'checkBrandExists', result);
                if (result.exists) {
                    await SessionStateManager.set(sessionId, 'brandId', result.brandId);
                }
                return JSON.stringify(result);
            },
        }),
        new DynamicStructuredTool({
            name: 'brandManager',
            description: `
Manage brand profile information for onboarding or updates.

Supported operations:
- "create": Register a new brand.
- "read": Fetch current brand info.
- "update": Update brand metadata (excluding uid, phone, brandId).

Input:
{
  operation: "create" | "read" | "update",
  payload: { ... }
}
`,
            schema: z.object({
                operation: z.enum(['create', 'read', 'update']),
                payload: z.union([
                    // Create
                    z.object({
                        brandName: z.string(),
                        email: z.string().email(),
                        website: z.string(),
                        industry: z.string(),
                        companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']),
                        description: z.string().optional(),
                    }),
                    // Read
                    z.object({}).strict(),
                    // Update
                    z.object({
                        updates: z.record(z.any()),
                    }),
                ])
            }),
            func: async ({ operation, payload }) => {
                const brandId = await SessionStateManager.get(sessionId, 'brandId');
                if (!brandId && operation !== 'create') {
                    throw new Error("Brand ID not found. Cannot perform non-create operations.");
                }

                switch (operation) {
                    case 'create': {
                        const result = await createBrand({
                            ...payload,
                            phone,
                            isActive: true,
                        });
                        await SessionStateManager.set(sessionId, 'brandId', result.brandId);
                        await saveToolLog(sessionId, 'brandManager.create', result);
                        logger.info(`Brand created with ID: ${result.brandId}`);
                        return JSON.stringify(result);
                    }
                    case 'read': {
                        const brand = await getBrandByBrandId(brandId);
                        await saveToolLog(sessionId, 'brandManager.read', brand);
                        return JSON.stringify(brand);
                    }
                    case 'update': {
                        const forbidden = ['uid', 'phone', 'brandId'];
                        if ('updates' in payload && typeof payload.updates === 'object' && payload.updates !== null) {
                            for (const key of forbidden) {
                                if (key in payload.updates) {
                                    throw new Error(`Cannot update field: ${key}`);
                                }
                            }
                            await updateBrandByBrandId(brandId, payload.updates);
                            await saveToolLog(sessionId, 'brandManager.update', payload.updates);
                            logger.info(`Brand updated with ID: ${brandId}`);
                            return JSON.stringify({ message: 'Brand updated successfully.' });
                        } else {
                            throw new Error("Missing or invalid 'updates' property in payload for update operation.");
                        }
                    }
                }
            }
        }),
        new DynamicStructuredTool({
            name: initiateVoiceCallsSchema.name,
            description: `${initiateVoiceCallsSchema.description}

Input:
{
  creatorIds: string[], // List of creator IDs
  campaignId: string     // Campaign ID associated with the creators
}
`,
            schema: z.object({
                creatorIds: z.array(z.string()),
                campaignId: z.string(),
            }),
            func: getInitiateVoiceCallsHandler(sessionId),
        }),
    ];

    const { messages: priorMessages, userId } = await getSessionData(sessionId);

    const toolLogs = await getToolLogs(sessionId);
    const toolMemoryContext = toolLogs.map(log => {
        const resultText = typeof log.result === 'string'
            ? log.result
            : JSON.stringify(log.result, null, 2);
        return `🛠 Tool: ${log.toolName}\nResult:\n${resultText}`;
    }).join('\n\n---\n\n');

    if (userId) {
        await SessionStateManager.set(sessionId, 'brandId', userId);
    }

    const prompt = new ChatPromptTemplate({
        inputVariables: ['input', 'agent_scratchpad', 'chat_history', 'isFirstMessage', 'toolMemoryContext'],
        promptMessages: [
            SystemMessagePromptTemplate.fromTemplate(`
You are a specialized AI assistant for managing influencer marketing campaigns on behalf of brands. Your primary function is to automate campaign tasks and facilitate brand onboarding.

**WhatsApp Communication Guidelines:**
All responses *must* adhere to these rules for WhatsApp delivery:
- Use *asterisks* for *bold*, _underscores_ for *italics*, and ~tildes~ for *strikethrough*.
- Keep messages concise, mobile-friendly, and highly readable.
- **Do NOT** use markdown code blocks, numbered lists, or bullet points. Prefer short paragraphs with line breaks.
- Paste raw URLs for links; do not use formatted hyperlinks.
- Incorporate relevant emojis (e.g., ✅, 🚀) sparingly to maintain a friendly, professional tone.

**Global Constraints & Formatting:**
- All currency references, particularly for campaign budgets and creator payments, *must* be in **INR (Indian Rupees)**.
- Maintain a helpful, professional, and slightly proactive demeanor.

**Session Memory:**
Utilize the provided {toolMemoryContext} to understand past interactions and avoid redundant questions or steps.
For now, the user's *phone number*, *brandId*, and *sessionId* are considered identical.
This means: you may treat sessionId  as the brand’s unique identifier (\`brandId\`).
You do NOT need to retrieve or store brandId separately unless instructed otherwise.

**Initial Brand Check (First Message Only):**
If this is the user's very first message ({isFirstMessage} is true):
- Immediately call the \`checkBrandExists\` tool with the user's phone number: ${phone}.
- Do NOT proceed with any other task until the brand's status is confirmed by this tool.
- *If the brand exists*: Greet them personally by their brand name and offer immediate assistance with campaign management tasks.
- *If the brand does NOT exist*:
    - Warmly welcome them and explain your role in automating creator marketing campaigns, outreach, and negotiation.
    - Inform them that a quick, one-time setup is required to unlock all features.
    - Clearly request the following brand details for registration using the \`createBrand\` tool: brand name, email, website, industry, and a brief description.

**Core Capabilities:**
You can:
- Manage campaigns: create, view, update, or delete using the \`campaignManager\` tool — with proactive, brand-specific suggestions.
- Search for and connect with suitable creators.
- Onboard new brands.

**Tool Usage Protocols:**
1. **Campaign Creation (\`campaignManager.create\`) – Proactive, Personalized Guidance:**

- When a user says something like "I want to create a campaign":
    - Respond proactively with enthusiasm and clarity.
    - Explain the essential fields needed *in one concise paragraph*: campaign name, description, target audience, budget (in INR), platforms (e.g., Instagram, YouTube), content types, and start/end dates.
    - Ask the user to share as many of these details as possible in one message.
    - Mention they can also specify creator preferences (e.g., categories, style).
    - You can also say: “If it’s easier, feel free to send a quick voice note or upload a campaign brief — I’ll extract the info for you!”

- 🎯 Personalization:
    - If the brand profile is known, use the \`industry\`, \`brandName\`, or \`past campaigns\` (if toolMemoryContext contains them) to *tailor your message*.
    - Example: “Based on your industry, I can suggest something like a *Glow-up Challenge* on Instagram or a *Reel Unboxing* for your gadget. Would you like ideas like that?”

- ✅ Example Campaign Suggestions:
    - You *may* suggest sample campaign themes or hashtags that fit the brand’s industry, but do NOT rely solely on any static example generator tool.
    - Instead, generate smart, creative, brand-aligned ideas using the LLM’s reasoning, based on the industry or description.

- 🧠 Avoid robotic or repetitive responses. Make the assistant sound insightful, like a marketing strategist, not just a form-filler.

- Once all details are gathered, summarize them, and ask for confirmation: “Should I go ahead and create this campaign for you?”

2.  **Creator Search (\`findMatchingCreators\`):**
    - Always call \`findMatchingCreators\` with a real \`campaignId\`.
    - **CRITICAL**: Never invent creator information. Do NOT respond with creator names, emails, or statistics unless the \`findMatchingCreators\` tool has been *successfully called* and its output *directly provides* this data.
    - When successfully calling \`findMatchingCreators\`, present the found creators' information *richly and concisely*. For each creator, include relevant details like their primary niche, top platforms, follower count, engagement rate, and key audience demographics (age range, gender, location) as provided by the tool output. Always respect the \`findMatchingCreators\` output limitations.
    - If you lack information, politely ask the user for it.

3.  **Confirmation for Data Creation/Updates:**
    - Before calling *any* tool that creates or updates data (e.g., \`createBrand\`, \`campaignManager.create\`, \`campaignManager.update\`):
        - Summarize *all* the details (e.g., brand name, email; or campaign name, budget, dates, platforms, audience) clearly for the user.
        - Explicitly ask for confirmation, such as "Should I proceed with creating this?" or "Do you confirm these details?"
        - Only execute the tool if the user provides a clear affirmative ("yes", "confirm", "proceed").

4. **Brand Profile Management (\`brandManager\`)**

- Use \`brandManager.create\` *only after confirming that the brand is not already registered*, as determined by the \`checkBrandExists\` tool.
- When registering a brand, clearly ask for:
    - brand name
    - email
    - website
    - industry
    - company size
    - (optional) a brief description
- You may also say: “If you’d prefer, you can send this as a quick voice note or a brand PDF/brief — I’ll extract the details for you.”

- Before calling \`brandManager.update\`:
    - Summarize the fields the brand wants to update.
    - **Confirm explicitly** with the user ("Do you want me to update your brand profile with this info?").
    - Reject any attempt to modify \`uid\`, \`phone\`, or \`brandId\` — these fields are protected.

- After a successful update, acknowledge with a friendly confirmation and offer next steps (e.g., campaign creation).

- When calling \`brandManager.read\`, do so to remind the user of their current profile if they request to “see my brand info” or similar.        

**General Interaction Guidelines:**
- If you require more information from the user to complete a task or call a tool, clearly and politely ask for it, specifically mentioning *what* information is needed.
- You may also say (in the *second message*): “If it’s easier, you can send a quick voice note or upload a campaign brief — I’ll extract the info for you!”

💡 To avoid long messages on WhatsApp, you can use \`<!--SPLIT-->\` in your response to send two messages instead of one.
- After providing information or completing a task, always suggest logical next steps the user can take (e.g., "What else can I help you with?", "Would you like to find creators for this campaign?", "Is there anything else I can assist you with today?").
- Maintain a natural, clear, and helpful tone throughout the conversation.
- Prioritize directness and efficiency in all responses.
    `),
            new MessagesPlaceholder("chat_history"), // Placeholder for chat history
            HumanMessagePromptTemplate.fromTemplate("{input}"),
            new MessagesPlaceholder("agent_scratchpad"),
        ],
    });

    const memory = new BufferMemory({
        chatHistory: new FirestoreChatMessageHistory(sessionId),
        returnMessages: true, // Needed for agent_scratchpad
        memoryKey: 'chat_history',
        inputKey: 'input',
        outputKey: 'output'
    });

    const agent = await createOpenAIToolsAgent({
        llm: model,
        tools,
        prompt,
    });


    return new SessionAgentExecutor(sessionId, agent, phone, tools, memory, toolMemoryContext);
}

class SessionAgentExecutor extends AgentExecutor {
    constructor(private sessionId: string, agent: any, private phone: string, tools: any[],
        memoryAgent: BufferMemory, private toolMemoryContext: string) {
        super({ agent, tools, memory: memoryAgent, verbose: false, returnIntermediateSteps: true });
    }

    async invoke(input: { input: string }, options?: any) {
        const brandId = await SessionStateManager.get(this.sessionId, 'brandId') || this.phone;
        await saveUserMessage(this.sessionId, input.input, brandId);

        //get history for this session
        const { messages: priorMessages } = await getSessionData(this.sessionId);
        //if message lengnth is 1, then this is the first message
        if (priorMessages.length === 1) {
            //set isFirstMessage to true
            await SessionStateManager.set(this.sessionId, 'isFirstMessage', true);
            logger.info(`First message detected for session ${this.sessionId}. Setting isFirstMessage to true.`);
        } else {
            //set isFirstMessage to false
            await SessionStateManager.set(this.sessionId, 'isFirstMessage', false);
        }

        //check if this is the first message
        const isFirstMessage = await SessionStateManager.get(this.sessionId, 'isFirstMessage');

        const result = await super.invoke({
            input: input.input, isFirstMessage,
            toolMemoryContext: this.toolMemoryContext
        }, options);
        logger.info(`Agent invoked with input: ${input.input}`);
        logger.info(`Agent steps: ${JSON.stringify(result.intermediateSteps, null, 2)}`);
        if (typeof result.output === 'string') {
            await saveAgentMessage(this.sessionId, result.output, brandId);
        }


        return result;
    }
}

export class SessionStateManager {
    private static state: Record<string, Record<string, any>> = {};

    static async get(sessionId: string, key: string) {
        return SessionStateManager.state[sessionId]?.[key];
    }

    static async set(sessionId: string, key: string, value: any) {
        if (!SessionStateManager.state[sessionId]) {
            SessionStateManager.state[sessionId] = {};
        }
        SessionStateManager.state[sessionId][key] = value;
    }
}