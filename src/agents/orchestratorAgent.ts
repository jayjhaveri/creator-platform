// src/agents/orchestratorAgent.ts
import { ChatGroq } from '@langchain/groq';
import { createOpenAIToolsAgent, AgentExecutor } from 'langchain/agents';
import { DynamicStructuredTool } from 'langchain/tools';
import { z } from 'zod';

import { resolveCampaign } from '../tools/campaignResolver';
import { findMatchingCreators } from '../tools/creatorSearch';
import { sendEmailsToCreators } from '../tools/sendIntroEmails';
import { getInitiateVoiceCallsHandler, initiateVoiceCallsSchema } from '../tools/initiateVoiceCallsTool';
import { createBrand } from '../tools/createBrand';
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
import { creatorAssignmentsService } from '../services/creatorAssignmentsService';
import { createNegotiation, getNegotiationByCampaignId } from '../services/negotiationsService';
import { startCall, startCallInternal } from '../services/voiceAgent/initiateVoiceAgent';

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
            name: 'createBrand',
            description: 'Create a new brand profile for onboarding. Input: { brandName, email, website, industry, companySize, description? }',
            schema: z.object({
                brandName: z.string(),
                email: z.string().email(),
                website: z.string(),
                industry: z.string(),
                companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']),
                description: z.string().optional(),
            }),
            func: async (args) => {
                const { ...rest } = args;
                const result = await createBrand({
                    ...rest,
                    phone,
                    isActive: true
                });
                await saveToolLog(sessionId, 'createBrand', result);
                await SessionStateManager.set(sessionId, 'brandId', result.brandId);
                return JSON.stringify(result);
            },
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
    You are a helpful assistant that helps brands manage influencer campaigns.

    Your responses will be sent via WhatsApp, so follow these formatting rules:

- Use *asterisks* for **bold**, _underscores_ for *italics*, and ~tildes~ for *strikethrough* if needed
- Keep messages short and readable on mobile
- Do not use markdown blocks, numbered or bulleted lists
- Paste raw links instead of using formatted hyperlinks
- Use emojis like ✅ or 🚀 to make replies friendly, but don’t overdo it
- Prefer short paragraphs with line breaks

    Use the following memory of previous tool calls during this session to avoid redundant steps or unnecessary questions.

{toolMemoryContext}

    If {isFirstMessage} is true:
- Always call the tool \`checkBrandExists\` using the user's phone number: ${phone}
- Do not proceed to other tasks until brand status is confirmed
    
    For First message, check if the brand is registered using the phone number provided.
    Use the phone number: ${phone} to check if the brand exists using the tool \`checkBrandExists\`.

    If the brand exists:
    - Greet them personally using their brand name.
    - Proceed to help with campaign tasks.

    If not:
    If not:
- Welcome the user warmly and explain that this agent helps automate creator marketing campaigns, outreach, and negotiation
- Let them know that to get started, you’ll need a few quick brand details (like brand name, email, website, industry, description)
- Clearly ask for these details so you can register them using the \`createBrand\` tool
- Reassure them that this is a one-time setup and will unlock all campaign automation features

    You can:
    - Help users create, view, update, or delete campaigns by using the campaignManager tool
    - Search and connect them with suitable creators
    - Onboard new brands if they aren't already registered

    To find creators for a campaign:
- Always call the \`findMatchingCreators\` tool using a real \`campaignId\`
- Never make up creator names
- Only respond with creator details after calling the tool

    Behaviors:
    - Always use the tools available to get accurate data
    - Never assume — resolve or create campaigns and brands only with the tools
    - Ask for missing info when needed, then take action
    - Be natural, clear, and helpful in your responses
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