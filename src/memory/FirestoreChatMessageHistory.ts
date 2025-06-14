import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatMessageHistory } from 'langchain/memory';
import { getSessionData } from '../utils/chatHistory';

export class FirestoreChatMessageHistory extends ChatMessageHistory {
    constructor(private sessionId: string) {
        super();
    }

    async getMessages(): Promise<BaseMessage[]> {
        const { messages } = await getSessionData(this.sessionId);
        return messages
            .map((msg: any) => {
                if (msg.role === 'human') return new HumanMessage(msg.content);
                if (msg.role === 'ai') return new AIMessage(msg.content);
                return null;
            })
            .filter((m): m is BaseMessage => !!m);
    }

    async addMessage(_message: BaseMessage): Promise<void> {
        // Already handled via saveUserMessage / saveAgentMessage in your AgentExecutor
    }

    async clear(): Promise<void> {
        // Optional: implement Firestore cleanup logic if needed
    }
}
