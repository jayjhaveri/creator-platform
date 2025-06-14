import axios from 'axios';
import logger from './logger';

export async function sendWhatsAppReply(phone: string, message: string) {

    logger.info('Env keys:', Object.keys(process.env));

    if (!process.env.WHATSAPP_AUTH_TOKEN) {
        logger.error('WhatsApp Auth Token is not set in environment variables');
        return;
    }
    try {
        const payload = {
            sendto: phone,
            authToken: `${process.env.WHATSAPP_AUTH_TOKEN!}`,
            originWebsite: 'https://techable.in',
            contentType: 'text',
            text: message,
        };

        await axios.post('https://api.11za.in/apis/sendMessage/sendMessages', payload);
        logger.info(`WhatsApp message sent to ${phone}`, { message });
    } catch (err) {
        console.error('Failed to send WhatsApp message:', err);
    }
}
