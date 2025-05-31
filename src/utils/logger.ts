// src/utils/logger.ts
import pino from 'pino';

const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            translateTime: 'SYS:standard',
            colorize: true,
            ignore: 'pid,hostname',
        },
    },
});

export default logger;