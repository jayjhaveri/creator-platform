import { CloudTasksClient } from '@google-cloud/tasks';

const client = new CloudTasksClient();

export const scheduleFollowUpTask = async (negotiationId: string, delayInSeconds: number) => {
    const project = process.env.GCP_PROJECT!;
    const location = `us-central1`; // e.g., 'us-central1'
    const queue = `follow-up-queue`; // e.g., 'follow-up-queue'
    const url = `${process.env.API_BASE_URL}/tasks/follow-up`; // e.g., 'https://<your-domain>/follow-up/check'

    const parent = client.queuePath(project, location, queue);

    const task = {
        httpRequest: {
            httpMethod: 'POST' as const,
            url,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify({ negotiationId })).toString('base64')
        },
        scheduleTime: {
            seconds: Math.floor(Date.now() / 1000) + delayInSeconds,
        },
    };

    await client.createTask({ parent, task });
};
