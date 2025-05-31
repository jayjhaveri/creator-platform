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