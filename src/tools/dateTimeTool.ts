import { z } from 'zod';

export const getDateTimeTool = {
    name: 'getDateTime',
    description: 'Get current date and time. Useful for scheduling or timestamping.',
    schema: z.object({
        timezone: z.string().optional() // optional user-defined timezone
    }),
    func: async ({ timezone }: { timezone?: string }) => {
        const now = timezone ? new Date().toLocaleString("en-IN", { timeZone: timezone }) : new Date().toISOString();
        return JSON.stringify({
            datetime: now,
            timezone: timezone || 'UTC',
        });
    }
};
