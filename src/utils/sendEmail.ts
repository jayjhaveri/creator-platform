// utils/sendEmail.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface EmailOptions {
    to: string;
    from: string;
    subject: string;
    text: string;
}

export const sendEmail = async ({ to, from, subject, text }: EmailOptions): Promise<void> => {
    const msg = {
        to,
        from,
        subject,
        text,
    };

    await sgMail.send(msg);
};