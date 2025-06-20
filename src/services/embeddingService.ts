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

    const chunkSize = 1000; // 1000 characters per chunk
    const chunkOverlap = 200; // 200 characters overlap
    logger.info(`🔍 Splitting text into chunks of size ${chunkSize} with overlap ${chunkOverlap}`);

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
                    taskType: "RETRIEVAL_QUERY"
                }
            });

            if (embeddings?.[0]?.embedding) {
                const normalized = normalizeVector(embeddings[0].embedding);
                results.push({
                    embedding: normalized,
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

function normalizeVector(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
    return vec.map(x => x / norm);
}