import express from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { processEmailFollowUp } from '../services/followUpService';
import { pollTranscription } from '../controllers/pollTranscriptionController';

const router = express.Router();

router.post('/follow-up', asyncHandler(async (req, res) => {
    const { negotiationId } = req.body;

    if (!negotiationId) {
        return res.status(400).json({ error: 'negotiationId required' });
    }

    // Optional: validate a custom header like X-App-Secret for security
    await processEmailFollowUp(negotiationId);
    res.status(200).json({ success: true });
}));

router.post('/poll-transcription', asyncHandler(pollTranscription));

export default router;