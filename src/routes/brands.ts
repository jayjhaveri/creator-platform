/**
 * @swagger
 * tags:
 *   name: Brands
 *   description: Brand management endpoints
 */

import express from 'express';
import { verifyFirebaseToken } from '../middleware/verifyToken';
import { db } from '../config/firebase';
import { asyncHandler } from '../utils/asyncHandler';
import { Brand } from '../types/schema';
import {
    createBrand,
    getBrandById,
    updateBrand,
    deleteBrand,
    listBrands
} from '../controllers/brandsController';

/**
 * @swagger
 * /api/brands:
 *   post:
 *     summary: Create a brand
 *     tags: [Brands]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brandName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               website:
 *                 type: string
 *               industry:
 *                 type: string
 *               companySize:
 *                 type: string
 *                 enum: [startup, small, medium, large, enterprise]
 *               totalBudget:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Brand created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 */

const router = express.Router();


router.post(
    '/',
    verifyFirebaseToken,
    asyncHandler(createBrand)
);

/**
 * @swagger
 * /api/brands/{id}:
 *   get:
 *     summary: Get a brand by ID
 *     tags: [Brands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand ID
 *     responses:
 *       200:
 *         description: Brand data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Brand'
 */
router.get(
    '/:id',
    verifyFirebaseToken,
    asyncHandler(getBrandById)
);

/**
 * @swagger
 * /api/brands/{id}:
 *   put:
 *     summary: Update a brand by ID
 *     tags: [Brands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Brand'
 *     responses:
 *       200:
 *         description: Brand updated
 */
router.put(
    '/:id',
    verifyFirebaseToken,
    asyncHandler(updateBrand)
);

/**
 * @swagger
 * /api/brands/{id}:
 *   delete:
 *     summary: Delete a brand by ID
 *     tags: [Brands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand ID
 *     responses:
 *       200:
 *         description: Brand deleted
 */
router.delete(
    '/:id',
    verifyFirebaseToken,
    asyncHandler(deleteBrand)
);

router.get(
    '/',
    verifyFirebaseToken,
    asyncHandler(listBrands)
);

export default router;
