import logger from '../../utils/logger';
import { elevenLabs } from './clients/elevenLabsClient';


interface MakeCallPayload {
    agent_id: string;
    agent_phone_number_id: string;
    to_number: string;
}

interface MakeCallResponse {
    success: boolean;
    message: string;
    conversation_id: string;
    callSid: string;
}

export const makeOutboundCall = async ({
    agent_id,
    agent_phone_number_id,
    to_number,
}: MakeCallPayload): Promise<MakeCallResponse> => {
    try {
        const response = await elevenLabs.post<MakeCallResponse>('/twilio/outbound-call', {
            agent_id,
            agent_phone_number_id,
            to_number,
        });

        logger.info(`Successfully initiated outbound call to ${to_number} using agent ${agent_id}`);
        return response.data;
    } catch (error: any) {
        logger.error('Failed to make outbound call via ElevenLabs Twilio:', error?.response?.data || error.message);
        throw new Error('Error initiating outbound voice call');
    }
};