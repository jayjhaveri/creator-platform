import { elevenLabs } from './clients/elevenLabsClient';

// List all phone numbers
export const listPhoneNumbers = async () => {
    const response = await elevenLabs.get('/phone-numbers/');
    return response.data;
};

// Get details of a specific phone number by ID
export const getPhoneNumberById = async (phoneNumberId: string) => {
    const response = await elevenLabs.get(`/phone-numbers/${phoneNumberId}`);
    return response.data;
};

// Assign or reassign a phone number to an agent
export const assignPhoneNumberToAgent = async (phoneNumberId: string, agentId: string) => {
    const response = await elevenLabs.patch(`/phone-numbers/${phoneNumberId}`, {
        agent_id: agentId,
    });
    return response.data;
};
