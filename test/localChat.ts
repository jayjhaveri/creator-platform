import readline from 'readline';
import { getOrchestratorAgent } from '../src/agents/orchestratorAgent';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const sessionId = 'test-session-001';

async function main() {
    const agent = await getOrchestratorAgent(sessionId, "9426624439");

    console.log('🤖 Agent ready. Start chatting!\n');

    const ask = async () => {
        rl.question('You: ', async (userInput) => {
            if (userInput.trim().toLowerCase() === 'exit') {
                rl.close();
                return;
            }

            const result = await agent.invoke({ input: userInput });
            console.log(`🤖 Agent: ${result.output}\n`);

            ask(); // loop back
        });
    };

    ask();
}

main();
