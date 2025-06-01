import axios from 'axios';
import FormData from 'form-data';
import { agentFirstMessage, agentPersonalityPrompt } from './data/system';

export const elevenLabsAxios = axios.create({
    baseURL: 'https://api.elevenlabs.io/v1/convai',
    headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    },
});


export const createKnowledgeBaseFromMarkdown = async (markdown: string): Promise<string> => {
    const form = new FormData();
    form.append('file', Buffer.from(markdown), {
        filename: 'context.md',
        contentType: 'text/markdown',
    });

    const res = await elevenLabsAxios.post('/knowledge-base/file', form, {
        headers: {
            ...form.getHeaders(),
        },
    });

    return res.data.knowledgeBaseId;
};

export const createConversationalAgent = async (
    name: string,
    knowledgeBase?: Array<{ name: string; id: string; type: string }>
): Promise<any> => {
    const res = await elevenLabsAxios.post('/agents/create', {
        conversation_config: {
            turn: {
                silence_end_call_timeout: 20
            },
            agent: {
                first_message: agentFirstMessage,
                prompt: {
                    temperature: 0.5,
                    tools: [
                        {
                            name: "end_call",
                            description: "Gives agent the ability to end the call with the user.",
                            params: {
                                system_tool_type: "end_call"
                            },
                            type: "system"
                        }
                    ],
                    knowledge_base: knowledgeBase || [],
                    prompt: agentPersonalityPrompt,
                },
            }
        },
        name
    });
    return res.data;
};
