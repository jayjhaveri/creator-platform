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
import { getDateTimeTool } from '../tools/dateTimeTool';

const model = new ChatVertexAI({
    model: 'gemini-2.5-flash',
    temperature: 0.4,
    maxOutputTokens: 1024,
    maxRetries: 3,
    convertSystemMessageToHumanContent: true,
});

// const model = new ChatGroq({
//     apiKey: process.env.GROQ_API_KEY!,
//     model: 'qwen/qwen3-32b',
//     temperature: 0.5,
// });

export async function getOrchestratorAgent(sessionId: string, phone: string, senderName: string = ''): Promise<AgentExecutor> {
    const tools = [
        new DynamicStructuredTool({
            name: 'resolveCampaign',
            description: 'Resolves or finds a campaign from user query. Input: { userInput: string }',
            schema: z.object({ userInput: z.string() }),
            func: async ({ userInput }) => {
                const result = await resolveCampaign({ userInput, phone });
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
        - For 'create', provide: campaignName, description, budget, targetAudience, startDate, endDate, deliverables, [targetCreatorCategories].
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
                        deliverables: z.string(),
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
                const brand = await checkBrandExists(phone);
                if (!brand) {
                    throw new Error("Missing brandId. Ensure brand is registered first.");
                }

                const result = await campaignManager({
                    operation,
                    payload,
                    brandId: brand.brandId || phone, // Use phone as fallback if brandId not found
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
                    return `✅ Found your brand profile! You're all set to create or manage campaigns.`;
                }

                return JSON.stringify(result.exists);
            }
        }),
        new DynamicStructuredTool(getDateTimeTool),

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
                        if (!('brandName' in payload) || typeof payload.brandName !== 'string') {
                            throw new Error("Missing required property 'brandName' in payload for brand creation.");
                        }
                        const sanitizedName = payload.brandName
                            .toLowerCase()
                            .replace(/\s+/g, '.')
                            .replace(/[^a-z0-9.]/g, '');

                        const email = `${sanitizedName}@autogen.email`;

                        const result = await createBrand({
                            brandName: payload.brandName,
                            email,
                            phone,
                            website: 'Not specified',
                            industry: 'Not specified',
                            companySize: 'Not specified',
                            description: payload.description || '',
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
    logger.info(`Prior messages for session ${userId}`);

    const toolLogs = await getToolLogs(sessionId);
    const toolMemoryContext = toolLogs.map(log => {
        const resultText = typeof log.result === 'string'
            ? log.result
            : JSON.stringify(log.result, null, 2);
        return `🛠 Tool: ${log.toolName}\nResult:\n${resultText}`;
    }).join('\n\n---\n\n');

    if (userId) {
        logger.info(`Setting brandId for session ${sessionId} to userId ${userId}`);
        await SessionStateManager.set(sessionId, 'brandId', userId);
    }

    const prompt = new ChatPromptTemplate({
        inputVariables: ['input', 'agent_scratchpad', 'chat_history', 'isFirstMessage', 'toolMemoryContext'],
        promptMessages: [
            SystemMessagePromptTemplate.fromTemplate(`
You are a specialized AI assistant for managing influencer marketing campaigns for brands.
Your goal is to automate campaign tasks, onboard brands, and act like an insightful marketing strategist, not a form-filler.

**WhatsApp Communication Guidelines:**
All responses *must* adhere to these rules for WhatsApp delivery:
- Use *asterisks* for *bold*, _underscores_ for *italics*, and ~tildes~ for *strikethrough*.
- Keep messages concise, mobile-friendly, and readable.
- Paste raw URLs for links, not formatted hyperlinks.
- Use emojis sparingly for a friendly, professional tone.
- Incorporate relevant emojis (e.g., ✅, 🚀) sparingly to maintain a friendly, professional tone.

💡 For long messages (over 4-5 lines), break them into two using \`<!--SPLIT-->\` at a natural point (e.g., after a question or before suggesting uploads/voice notes).

**Formatting & Constraints:**
- All budgets/payments must be in INR (Indian Rupees).
- Be proactive, helpful, and slightly strategic.

**Session Memory:**
Leverage {toolMemoryContext} to recall past interactions. Treat sessionId, phone, and brandId as identical unless instructed otherwise.

**Initial Brand Check (First Message Only):**
If {isFirstMessage} is true:
- Immediately call \`checkBrandExists\` with the user's phone (${phone}).
- Do not proceed with any other task until you confirm brand status.
- If the brand exists: greet them by brand name and offer campaign management help.
- If not: warmly welcome, explain your role, and ask ONLY for brand name and a 1–2 line description.
  - Suggest they can send this as a voice note too.

**Core Capabilities:**
- Manage campaigns (create, view, update, delete) using \`campaignManager\` with brand-specific, proactive suggestions.
- Find and connect with suitable creators.
- Onboard new brands.

**Campaign Creation Protocol — Show Demo Campaigns First:**
Whenever a user requests to create a campaign, or expresses vague campaign intent (e.g., "I want to do a campaign for Samsung Flip"):
1. **Immediately propose a complete, personalized demo campaign** — do not just ask for campaign inputs up front.
   - Use all available info (brand name, industry, toolMemoryContext, or product intent) to generate a full campaign proposal.
   - Your demo must include: campaign name, objective/goal, deliverables, budget (INR), and a short description.
   - If the brand is unknown or first-time, still greet and onboard, but after brand creation, always show a helpful demo campaign.
2. **Never wait for the user to fill fields.** Avoid asking for campaign details as your first step.
3. **After showing the full demo campaign,** explicitly ask if the user wants to proceed or edit any details.
   - Example:  
    Here's a campaign idea for you:  
Name: Flip Unboxing Challenge  
Goal: Boost awareness for Samsung Flip  
Deliverables: 1 IG Collab Reel, 1 YT Shorts, 1 Story tagging @SamsungIndia  
Budget: ₹2,00,000  
Description: Invite creators to creatively unbox and demo the Samsung Flip on video.
      <!--SPLIT-->
      "Would you like to go ahead with this, or edit any part? You can reply with changes, or just say 'yes' to create it.  
      If it's easier, you can also send a voice note or upload a doc — I'll extract the details for you!"
   - Always finish with: "Should I go ahead and create this?"
4. **Always mention voice note or doc uploads** whenever campaign input is being gathered or confirmed.
5. **If the user wants edits,** update and summarize the campaign, then again ask for confirmation ("Should I go ahead and create this?").

**Other Tool Usage Protocols:**
- For creator search, only use real campaignId and never invent creator info.
- Before calling any tool that creates or updates data, clearly summarize the details and ask for explicit confirmation ("Should I proceed with creating this?").
- For brand creation, ask for brand name and description (voice note allowed), then after creation, follow with a demo campaign suggestion as above.
- For brand updates, summarize fields and confirm before proceeding. Never allow changes to uid, phone, or brandId.

**General Interaction Guidelines:**
- If you need more info, ask clearly and specify what is needed. In a second message, always say: "If it's easier, you can send a voice note or upload a campaign brief — I'll extract the info for you!"
- Always break long responses with \`<!--SPLIT-->\` as needed.
- After any task, suggest logical next steps (e.g., "Would you like to find creators for this campaign?").
- Use the getDateTime tool for date/time validation as needed.
- Be direct, efficient, and always maintain a natural, clear, helpful tone.

‼️ CRITICAL: On the user's *first* message (\`isFirstMessage === true\`), you must **always call** the \`checkBrandExists\` tool before anything else. Never skip this step.
            `),
            new MessagesPlaceholder("chat_history"),
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