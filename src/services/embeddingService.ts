// src/services/embeddingService.ts
import { googleAI } from '@genkit-ai/googleai';
import { genkit } from 'genkit';

const ai = genkit({
    plugins: [googleAI()],
});

export async function generateEmbedding(text: string): Promise<number[]> {
    console.log('🧠 generateEmbedding() called');
    console.log('📥 Input text:', text);

    try {
        const embeddings = await ai.embed({
            embedder: googleAI.embedder('text-embedding-004'),
            content: text,
            options: {
                outputDimensionality: 768,
                taskType: "RETRIEVAL_QUERY"
            }
        });

        // console.log('📦 Raw embedding response:', JSON.stringify(embeddings, null, 2));

        if (!embeddings?.[0]?.embedding || !Array.isArray(embeddings[0].embedding)) {
            console.error('❌ Failed to generate a valid embedding from the response');
            throw new Error('Failed to generate embedding');
        }

        console.log('✅ Embedding generated successfully, length:', embeddings[0].embedding.length);
        return embeddings[0].embedding;
    } catch (err) {
        console.error('🔥 Error while generating embedding:', err);
        throw err;
    }
}