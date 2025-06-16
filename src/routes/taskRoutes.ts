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
    try {
        await processEmailFollowUp(negotiationId);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to process email follow-up', details: (error as Error).message });
    }
    res.status(200).json({ success: true });
}));

router.post('/poll-transcription', asyncHandler(pollTranscription));

export default router;