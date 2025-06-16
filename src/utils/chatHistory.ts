import { getFirestore } from 'firebase-admin/firestore';
import { Message } from '../types/schema';
import { db } from '../config/firebase';


const CHAT_COLLECTION = 'userChats';
const TOOL_LOG_COLLECTION = 'toolLogs';

export async function saveUserMessage(sessionId: string, content: string, userId: string) {
    const message: Message = {
        role: 'human',
        content,
        timestamp: new Date().toISOString(),
    };
    return appendMessage(sessionId, message, userId);
}

export async function saveAgentMessage(sessionId: string, content: string, userId: string) {
    const message: Message = {
        role: 'ai',
        content,
        timestamp: new Date().toISOString(),
    };
    return appendMessage(sessionId, message, userId);
}

async function appendMessage(sessionId: string, message: Message, userId: string) {
    const ref = db.collection(CHAT_COLLECTION).doc(sessionId);
    const snapshot = await ref.get();

    if (snapshot.exists) {
        await ref.update({
            messages: [...snapshot.data()!.messages, message],
            updatedAt: new Date().toISOString(),
        });
    } else {
        await ref.set({
            sessionId,
            userId,
            messages: [message],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }
}

export async function getSessionData(sessionId: string): Promise<{
    messages: Message[],
    userId?: string
}> {
    const ref = db.collection(CHAT_COLLECTION).doc(sessionId);
    const snapshot = await ref.get();
    const data = snapshot.data();
    let messages: Message[] = [];

    //limit 20 messages
    if (data?.messages && Array.isArray(data.messages)) {
        messages = data.messages.slice(-20); // Get the last 20 messages
    }
    if (!data) {
        throw new Error(`Session ${sessionId} not found.`);
    }

    return {
        messages,
        userId: data.userId,
    };
}

export async function saveToolLog(sessionId: string, toolName: string, result: any) {
    const doc = db.collection(TOOL_LOG_COLLECTION).doc();
    await doc.set({
        sessionId,
        toolName,
        result,
        createdAt: new Date().toISOString(),
    });
}

export async function getToolLogs(sessionId: string): Promise<{
    toolName: string;
    result: any;
    createdAt: string;
}[]> {
    const snapshot = await db
        .collection(TOOL_LOG_COLLECTION)
        .where('sessionId', '==', sessionId)
        .limit(20)
        .orderBy('createdAt', 'asc')
        .get();

    return snapshot.docs.map(doc => doc.data() as {
        toolName: string;
        result: any;
        createdAt: string;
    });
}
