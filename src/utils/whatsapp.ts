import axios from 'axios';

export async function sendWhatsAppReply(phone: string, message: string) {
    try {
        const payload = {
            sendto: phone,
            authToken: process.env.WHATSAPP_AUTH_TOKEN,
            originWebsite: 'https://techable.in',
            contentType: 'text',
            text: message,
        };

        await axios.post('https://api.11za.in/apis/sendMessage/sendMessages', payload);
    } catch (err) {
        console.error('Failed to send WhatsApp message:', err);
    }
}
