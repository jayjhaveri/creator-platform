import { Request, Response } from 'express';
import { KnowledgeBaseDocument } from '../../types/schema';
import { createKnowledgeBaseDocument } from '../../services/elevenlabs/services/knowledgeService';
import { createKnowledgeBaseFromMarkdown } from '../../services/elevenlabs/knowledge';

export const create = async (req: Request, res: Response) => {
    try {
        const elevenLabsDocumentId = await createKnowledgeBaseFromMarkdown(req.body.markdown);
        const document: KnowledgeBaseDocument = req.body;
        document.elevenLabsDocumentId = elevenLabsDocumentId;
        const id = await createKnowledgeBaseDocument(document);
        res.status(201).json({ id });
    } catch (error) {
        console.error('Error creating knowledge base document:', error);
        res.status(500).json({ error: 'Failed to create knowledge base document' });
    }
};
