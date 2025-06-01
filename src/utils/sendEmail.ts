// utils/sendEmail.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface EmailOptions {
    to: string;
    from: Record<string, string>; // { email: string, name?: string }
    subject: string;
    text: string;
    replyTo?: {
        email: string;
        name?: string;
    };
    headers?: Record<string, string>;
}

export const sendEmail = async ({ to, from, subject, text, replyTo, headers }: EmailOptions): Promise<void> => {
    const msg: any = {
        to,
        from,
        subject,
        text,
    };

    if (replyTo) {
        msg.reply_to = {
            email: replyTo.email,
            name: replyTo.name, // optional but good for clarity in clients like Gmail
        };
    }

    if (headers) {
        msg.headers = headers; // custom headers for tracking
    }

    await sgMail.send(msg);
};