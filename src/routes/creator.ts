import express from 'express';
import { verifyFirebaseToken } from '../middleware/verifyToken';
import { asyncHandler } from '../utils/asyncHandler';
import {
    createCreator,
    getCreatorById,
    updateCreator,
    deleteCreator,
    listCreators
} from '../controllers/creatorsController';
import logger from '../utils/logger';
import { db } from '../config/firebase';
import { generateEmbeddingsForChunks } from '../services/embeddingService';
import { upsertChunksToVectorStore } from '../services/vectorStore';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Creators
 *   description: Creator management endpoints
 */

/**
 * @swagger
 * /api/creators:
 *   post:
 *     summary: Create a creator
 *     tags: [Creators]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Creator'
 *     responses:
 *       201:
 *         description: Creator created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 */
router.post(
    '/',
    verifyFirebaseToken,
    asyncHandler(createCreator)
);

router.post('/reprocess-creators', async (req, res) => {
    logger.info('🚀 Triggered /tools/reprocess-creators');

    try {
        const snapshot = await db.collection('creators').get();
        logger.info(`🔍 Found ${snapshot.size} creators`);

        for (const doc of snapshot.docs) {
            const creatorId = doc.id;
            const creator = doc.data();

            const embeddingText = `${creator.displayName || ''} ${creator.bio || ''} ${creator.category || ''}`;
            logger.info(`🧠 Reprocessing creator: ${creator.displayName} (${creatorId})`);

            try {
                const chunks = await generateEmbeddingsForChunks(embeddingText);

                await upsertChunksToVectorStore({
                    chunks: chunks.map(chunk => ({
                        vector: chunk.embedding,
                        metadata: {
                            parentCollection: 'creators',
                            sourceId: creatorId,
                            chunkIndex: chunk.chunkIndex,
                            chunkText: chunk.chunkText,
                        },
                    })),
                });

                logger.info(`✅ Vector updated for: ${creator.displayName}`);
            } catch (err) {
                logger.error(`❌ Failed processing creator ${creatorId}:`, err);
            }
        }

        logger.info('🎉 Finished reprocessing all creators');
        res.status(200).send('All creators reprocessed successfully');
    } catch (error) {
        logger.error('🔥 Error in /reprocess-creators:', error);
        res.status(500).send('Internal server error');
    }
});

/**
 * @swagger
 * /api/creators/{id}:
 *   get:
 *     summary: Get a creator by ID
 *     tags: [Creators]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Creator object
 */
router.get(
    '/:id',
    verifyFirebaseToken,
    asyncHandler(getCreatorById)
);

/**
 * @swagger
 * /api/creators/{id}:
 *   put:
 *     summary: Update a creator
 *     tags: [Creators]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Creator'
 *     responses:
 *       200:
 *         description: Creator updated
 */
router.put(
    '/:id',
    verifyFirebaseToken,
    asyncHandler(updateCreator)
);

/**
 * @swagger
 * /api/creators/{id}:
 *   delete:
 *     summary: Delete a creator
 *     tags: [Creators]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Creator deleted
 */
router.delete(
    '/:id',
    verifyFirebaseToken,
    asyncHandler(deleteCreator)
);

/**
 * @swagger
 * /api/creators:
 *   get:
 *     summary: List all creators
 *     tags: [Creators]
 *     responses:
 *       200:
 *         description: List of creators
 */
router.get(
    '/',
    verifyFirebaseToken,
    asyncHandler(listCreators)
);



export default router;