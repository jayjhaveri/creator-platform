// src/services/voiceAgent/initiateVoiceAgent.ts
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import { db } from '../../config/firebase';
import { Brand, Campaign, Communication, Creator, Negotiation, VoiceCommunication, VoiceTranscriptMessage } from '../../types/schema';
import { generateAgentMarkdown } from '../../utils/generateAgentMarkdown';
import { EmailMessage } from '../../utils/generateEmailContent';
import { createVoiceAgent } from '../elevenLabs/createAgent';
import { createKnowledgeBase } from '../elevenLabs/createKnowledgeBase';
import { v4 as uuidv4 } from 'uuid';
import { makeOutboundCall } from '../elevenLabs/makeCall';
import { Request, Response } from 'express';
import { updateVoiceAgent } from '../elevenLabs/updateVoiceAgent';
import logger from '../../utils/logger';

export const agentPhoneNumberId = "phnum_01jwgymzjafwfstkb80x07gmej";

export const initiateVoiceAgent = async (negotiationId: string): Promise<string> => {
    const negotiationDoc = await db.collection('negotiations').doc(negotiationId).get();
    if (!negotiationDoc.exists) throw new Error('Negotiation not found');
    const negotiation = negotiationDoc.data() as Negotiation;

    const brandDoc = await db.collection('brands').doc(negotiation.brandId).get();
    const campaignDoc = await db.collection('campaigns').doc(negotiation.campaignId).get();
    const creatorDoc = await db.collection('creators').doc(negotiation.creatorId).get();

    if (!brandDoc.exists || !campaignDoc.exists || !creatorDoc.exists)
        throw new Error('Required data not found');

    const brand = brandDoc.data() as Brand;
    const campaign = campaignDoc.data() as Campaign;
    const creator = creatorDoc.data() as Creator;

    const history = await db.collection('communications')
        .where('negotiationId', '==', negotiationId)
        .orderBy('createdAt', 'asc')
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data() as Communication));

    const voiceHistory = await db.collection('voiceCommunications')
        .where('negotiationId', '==', negotiationId)
        .orderBy('createdAt', 'asc')
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data() as VoiceCommunication));

    //each voice history has transcript array, need to merge them into a single array
    let mergedVoiceHistory: VoiceTranscriptMessage[] = [];
    for (const voiceComm of voiceHistory) {
        if (voiceComm.transcript && Array.isArray(voiceComm.transcript)) {
            const formattedTranscript = voiceComm.transcript.map(msg => ({
                role: msg.role,
                message: msg.message,
                time_in_call_secs: msg.time_in_call_secs ?? 0,
            }));
            mergedVoiceHistory = mergedVoiceHistory.concat(formattedTranscript);
        }
    }

    const emailHistory: EmailMessage[] = history.map(comm => ({
        sender: comm.direction === 'inbound' ? "creator" : "brand",
        subject: comm.subject,
        body: comm.content,
    }));



    const kbMarkdown = await generateAgentMarkdown(brand, campaign, emailHistory, mergedVoiceHistory);

    const kbName = `${brand.brandName}-${creator.displayName}-KB`;
    const kbId = await createKnowledgeBase(kbMarkdown, kbName);

    const prompt = `You are a voice-based AI representative acting on behalf of a brand to engage with a content creator. 
You are professional, concise, and friendly. Your goal is to discuss campaign deliverables, negotiate fair compensation, 
clarify expectations, and answer any questions the creator may have. You must adapt your responses based on prior communications, 
campaign details, and the creator’s tone or preferences. Always keep the brand’s interests in mind while being collaborative.`;

    const firstMessage = `Hi! I'm reaching out on behalf of ${brand.brandName} regarding our recent campaign conversation. 
We’d love to continue the discussion and work out the best collaboration. Can we go over the next steps together?`;

    //check if the agent already exists
    const existingAgent = await db.collection('voiceAgents')
        .where('negotiationId', '==', negotiationId).get();
    if (!existingAgent.empty) {
        console.log(`Voice agent already exists for negotiation ${negotiationId}`);
        const voiceAgentId = existingAgent.docs[0].id;

        const voiceAgentData = existingAgent.docs[0].data();
        const agentId = voiceAgentData.agentId;

        await updateVoiceAgent({
            agentId,
            kbIds: [{ id: kbId, name: kbName }],
            prompt,
            firstMessage
        });

        // Update the voice agent document with new knowledge base and prompt
        await db.collection('voiceAgents').doc(voiceAgentId).update({
            kbId,
            kbName,
            kbMarkdown,
            updatedAt: new Date().toISOString(),
        });

        console.log(`Updated existing voice agent for negotiation ${negotiationId}: ${voiceAgentId}`);

        console.log(`Voice agent already exists for negotiation ${negotiationId}: ${voiceAgentId}`);
        return voiceAgentId;
    }

    const agentId = await createVoiceAgent({
        kbIds: [{ id: kbId, name: kbName }],
        brand: brand,
        prompt,
        firstMessage
    });

    const voiceAgentId = uuidv4();
    const now = new Date().toISOString();
    await db.collection('voiceAgents').doc(voiceAgentId).set({
        voiceAgentId,
        agentId,
        kbId,
        kbName,
        kbMarkdown,
        agentPhoneNumberId: agentPhoneNumberId,
        brandId: brand.brandId,
        creatorId: creator.creatorId,
        negotiationId,
        createdAt: now,
        updatedAt: now,
    });

    return voiceAgentId;
};

const tasksClient = new CloudTasksClient();
const QUEUE_NAME = 'initiate-call-queue'; // your queue name
const QUEUE_LOCATION = 'us-central1'; // or your GCP region
//initiate call task after 2 hours
export const scheduleInitiateCallViaCloudTask = async (negotiationId: string, phone: string): Promise<void> => {

    // Schedule the task to run after 2 hours
    let delay = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    //for testing purposes, set to 1 minute
    delay = 1 * 60 * 1000; // 1 minute in milliseconds

    //schedule the task as per the delay
    const task = {
        scheduleTime: {
            seconds: Math.floor(Date.now() / 1000) + Math.floor(delay / 1000),
        },
        httpRequest: {
            httpMethod: protos.google.cloud.tasks.v2.HttpMethod.POST,
            url: `${process.env.API_BASE_URL}/api/initiateCall/start`,
            body: Buffer.from(JSON.stringify({ negotiationId, phone })).toString('base64'),
            headers: {
                'Content-Type': 'application/json',
            },
        },
    };
    try {
        await tasksClient.createTask({ parent: tasksClient.queuePath(process.env.GCP_PROJECT!, QUEUE_LOCATION, QUEUE_NAME), task });
        console.log(`Scheduled initiate call task for negotiation ${negotiationId}`);
    }
    catch (error) {
        console.error(`Failed to schedule initiate call task for negotiation ${negotiationId}:`, error);
        throw new Error('Failed to schedule initiate call task');
    }
    return;
}

export const startCall = async (req: Request, res: Response) => {
    try {
        const { negotiationId, phone } = req.body as any;
        if (!negotiationId || !phone) {
            return res.status(400).json({ error: 'Negotiation ID and phone number are required' });
        }

        const voiceAgentId = await initiateVoiceAgent(negotiationId)

        //get voice agent doc
        const voiceAgentDoc = await db.collection('voiceAgents').doc(voiceAgentId).get();
        if (!voiceAgentDoc.exists) throw new Error('Voice agent not found');
        const voiceAgent = voiceAgentDoc.data();
        if (!voiceAgent) throw new Error('Voice agent data not found');

        const makeCallResponse = await makeOutboundCall({
            agent_id: voiceAgent.agentId,
            agent_phone_number_id: voiceAgent.agentPhoneNumberId, // Assuming agentId is the phone number ID
            to_number: phone,
        });

        if (!makeCallResponse.success) {
            console.error('Failed to make outbound call:', makeCallResponse.message);
            return res.status(500).json({ error: 'Failed to initiate call' });
        }

        try {
            const voiceCommunication: VoiceCommunication = {
                voiceCommunicationId: uuidv4(),
                negotiationId,
                agentId: voiceAgent.agentId,
                voiceAgentId,
                conversationId: makeCallResponse.conversation_id,
                phone,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                brandId: '',
                creatorId: '',
                callSid: '',
                status: 'initiated',
                hasAudio: false,
                hasUserAudio: false,
                hasResponseAudio: false,
                startTimeUnixSecs: 0,
                callDurationSecs: 0,
                transcript: [],
                rawPayload: {}
            };

            await saveVoiceCommunication(voiceCommunication);
        } catch (error) {
            console.error('Failed to save voice communication:', error);
        }


        return res.status(200).json({ message: 'Call initiated successfully', voiceAgentId });
    } catch (error) {
        console.error('Error starting call:', error);
        res.status(500).json({ error: 'Failed to start call' });
    }
}

export const saveVoiceCommunication = async (doc: VoiceCommunication): Promise<void> => {
    try {
        await db.collection('voiceCommunications').doc(doc.voiceCommunicationId).set(doc);
        logger.info(`Saved voice communication: ${doc.voiceCommunicationId}`);
    } catch (err) {
        logger.error('Failed to save voice communication', err);
        throw err;
    }
};


