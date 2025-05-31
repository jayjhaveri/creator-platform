import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route or middleware to automatically handle errors.
 * Use this for all async middleware and route functions.
 */
export const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
        (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
