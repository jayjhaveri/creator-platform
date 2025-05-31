// src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
    logger.info({ method: req.method, url: req.url, body: req.body }, 'Incoming request');
    next();
};