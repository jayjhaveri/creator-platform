import sgMail from '@sendgrid/mail';
import { db } from '../config/firebase';
import { Creator, Campaign, Communication, Brand } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';
import { generateEmailContent } from '../utils/generateEmailContent';
import logger from '../utils/logger';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const sendInitialEmail = async (
    creator: Creator,
    campaign: Campaign,
    brand: Brand,
    negotiationId: string
) => {
    const to = creator.email;
    const brandEmailPrefix = brand.email.split('@')[0].replace(/\W/g, '');
    const fromEmail = `${brandEmailPrefix}--${negotiationId}@techable.in`;
    const fromName = `${brand.brandName} via CreatorPlatform`;

    logger.info(`Sending initial email to ${to} from ${fromEmail}`);

    const content = await generateEmailContent(brand, creator, campaign);

    const msg = {
        to,
        from: {
            email: fromEmail,
            name: fromName,
        },
        subject: content.subject,
        text: content.body,
    };

    await sgMail.send(msg);

    const communicationId = uuidv4();
    const now = new Date().toISOString();

    const communication: Communication = {
        communicationId,
        negotiationId,
        type: 'email',
        direction: 'outbound',
        status: 'sent',
        subject: content.subject,
        content: content.body,
        aiAgentUsed: true,
        voiceCallDuration: 0,
        voiceCallSummary: '',
        followUpRequired: true,
        followUpDate: '',
        createdAt: now,
    };

    await db.collection('communications').doc(communicationId).set(communication);
    await db.collection('negotiations').doc(negotiationId).update({
        status: 'email_sent',
        updatedAt: now,
    });

    return { success: true };
};