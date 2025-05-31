import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Verifies the Firebase ID token and attaches the decoded user to req.user
 */
export const verifyFirebaseToken = asyncHandler(async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }

    const token = authHeader.split('Bearer ')[1];

    const decodedToken = await auth.verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
});
