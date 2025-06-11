import express from 'express';
import { handleFirestoreEvent } from '../controllers/firestoreController';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

router.post('/', asyncHandler(handleFirestoreEvent));

export default router;