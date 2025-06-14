// src/services/embeddingService.ts
import { googleAI } from '@genkit-ai/googleai';
import { genkit } from 'genkit';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import logger from '../utils/logger';

const ai = genkit({
    plugins: [googleAI()],
});

export interface EmbeddingChunk {
    embedding: number[];
    chunkText: string;
    chunkIndex: number;
}

async function splitTextWithLangChain(text: string, chunkSize: number, chunkOverlap: number): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
    });

    const documents = await splitter.createDocuments([text]);
    return documents.map(doc => doc.pageContent);
}

export async function generateEmbeddingsForChunks(text: string): Promise<EmbeddingChunk[]> {
    logger.info('🧠 generateEmbeddingsForChunks() called');
    logger.info('📥 Input text length:', text.length);

    const chunkSize = 500;
    const chunkOverlap = 100;

    const chunks = await splitTextWithLangChain(text, chunkSize, chunkOverlap);
    const results: EmbeddingChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.info(`📦 Embedding chunk ${i + 1}/${chunks.length}: ${chunk.slice(0, 80)} ...`);

        try {
            const embeddings = await ai.embed({
                embedder: googleAI.embedder('text-embedding-004'),
                content: chunk,
                options: {
                    outputDimensionality: 768,
                    taskType: "RETRIEVAL_DOCUMENT"
                }
            });

            if (embeddings?.[0]?.embedding) {
                results.push({
                    embedding: embeddings[0].embedding,
                    chunkText: chunk,
                    chunkIndex: i
                });
            } else {
                logger.warn(`❌ No embedding returned for chunk ${i}`);
            }
        } catch (err) {
            logger.error(`🔥 Error embedding chunk ${i}:`, err);
        }
    }

    logger.info(`✅ Generated ${results.length} embeddings out of ${chunks.length} chunks`);
    return results;
}