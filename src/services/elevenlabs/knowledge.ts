import { elevenLabsAxios } from './client';

export const createKnowledgeBaseFromMarkdown = async (markdown: string): Promise<string> => {
    const response = await elevenLabsAxios.post('/knowledge-base/text', {
        text: markdown
    });

    return response.data.id || ""; // Adjust 'id' to the actual property you want to return
};
