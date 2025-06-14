// src/agents/orchestratorAgent.ts
import { ChatGroq } from '@langchain/groq';
import { createOpenAIToolsAgent, AgentExecutor } from 'langchain/agents';
import { DynamicStructuredTool } from 'langchain/tools';
import { z } from 'zod';

import { resolveCampaign } from '../tools/campaignResolver';
import { findMatchingCreators } from '../tools/creatorSearch';
import { sendEmailsToCreators } from '../tools/sendIntroEmails';
import { createCampaign } from '../tools/createCampaign';
import { createBrand } from '../tools/createBrand';
import { checkBrandExists } from '../tools/checkBrandExists';
import {
    ChatPromptTemplate,
    MessagesPlaceholder,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    AIMessagePromptTemplate,
} from '@langchain/core/prompts';
import { saveUserMessage, saveAgentMessage, getSessionData, saveToolLog } from '../utils/chatHistory';
import logger from '../utils/logger';
import { BufferMemory } from 'langchain/memory';
import { FirestoreChatMessageHistory } from '../memory/FirestoreChatMessageHistory';

const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY!,
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    temperature: 0.3,
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
            name: 'createCampaign',
            description: 'Create a new campaign. Input: { campaignName, description, budget, targetAudience, startDate, endDate, requiredPlatforms }',
            schema: z.object({
                campaignName: z.string(),
                description: z.string(),
                budget: z.number(),
                targetAudience: z.string(),
                startDate: z.string(),
                endDate: z.string(),
                requiredPlatforms: z.array(
                    z.object({
                        platform: z.enum(['instagram', 'youtube', 'tiktok', 'facebook', 'twitter']),
                        contentType: z.enum(['post', 'story', 'reel', 'video', 'live']),
                        quantity: z.number().min(1),
                    })
                )
            }),
            func: async (args) => {
                const brandId = await SessionStateManager.get(sessionId, 'brandId');
                if (!brandId) {
                    throw new Error("Cannot create campaign without brandId. Please ensure brand is registered first.");
                }
                const result = await createCampaign({ brandId, ...args });
                await saveToolLog(sessionId, 'createCampaign', result);
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
                return JSON.stringify(result);
            },
        }),
        new DynamicStructuredTool({
            name: 'createBrand',
            description: 'Create a new brand profile for onboarding. Input: { brandName, email, phone, uid, website, industry, companySize, totalBudget?, description? }',
            schema: z.object({
                brandName: z.string(),
                email: z.string().email(),
                phone: z.string(),
                uid: z.string(),
                website: z.string(),
                industry: z.string(),
                companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']),
                totalBudget: z.number().nullable().optional(),
                description: z.string().optional(),
            }),
            func: async (args) => {
                const { totalBudget, ...rest } = args;
                const result = await createBrand({
                    ...rest,
                    totalBudget: typeof totalBudget === 'undefined' ? null : totalBudget,
                    isActive: true
                });
                await saveToolLog(sessionId, 'createBrand', result);
                await SessionStateManager.set(sessionId, 'brandId', result.brandId);
                return JSON.stringify(result);
            },
        }),
    ];

    const { messages: priorMessages, userId } = await getSessionData(sessionId);

    if (userId) {
        await SessionStateManager.set(sessionId, 'brandId', userId);
    }

    const prompt = new ChatPromptTemplate({
        inputVariables: ['input', 'agent_scratchpad', 'chat_history'],
        promptMessages: [
            SystemMessagePromptTemplate.fromTemplate(`
    You are a helpful assistant that helps brands manage influencer campaigns.

    Use the phone number: ${phone} to check if the brand exists using the tool \`checkBrandExists\`.

    If the brand exists:
    - Greet them personally using their brand name.
    - Proceed to help with campaign tasks.

    If not:
    - Guide the user to onboard by asking for brand details and calling \`createBrand\`.

    You can:
    - Help users create campaigns by collecting required fields step by step
    - Search and connect them with suitable creators
    - Onboard new brands if they aren't already registered

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


    return new SessionAgentExecutor(sessionId, agent, phone, tools, memory);
}

class SessionAgentExecutor extends AgentExecutor {
    constructor(private sessionId: string, agent: any, private phone: string, tools: any[],
        memoryAgent: BufferMemory) {
        super({ agent, tools, memory: memoryAgent, verbose: true });
    }

    async invoke(input: { input: string }, options?: any) {
        const brandId = await SessionStateManager.get(this.sessionId, 'brandId') || this.phone;
        await saveUserMessage(this.sessionId, input.input, brandId);

        const result = await super.invoke(input, options);
        logger.info(`Agent invoked with input: ${input.input}`);
        logger.info(`Agent steps: ${JSON.stringify(result.intermediateSteps, null, 2)}`);
        if (typeof result.output === 'string') {
            await saveAgentMessage(this.sessionId, result.output, brandId);
        }


        return result;
    }
}

class SessionStateManager {
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