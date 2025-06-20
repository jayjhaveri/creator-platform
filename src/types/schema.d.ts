import { v4 as uuidv4 } from 'uuid';

export interface Brand {
  brandId: string = ''; // Nullable for new brands
  brandName: string;
  email: string;
  phone: string;
  uid: string; // Firebase UID of the brand owner
  website: string;
  industry: string;
  description?: string; // Optional field for additional brand info
  companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  isActive: boolean;
  defaultVoiceAgentId?: string; // Reference to the default agent in voiceAgents collection
  createdAt: string;
  updatedAt: string;
}

export interface Creator {
  creatorId: string = ''; // Nullable for new creators
  displayName: string;
  bio: string?;
  profilePictureUrl: string;
  email: string;
  phone: string;
  instagramHandle: string;
  instagramFollowers: number;
  youtubeHandle: string;
  youtubeSubscribers: number;
  category: 'lifestyle' | 'tech' | 'fashion' | 'fitness' | 'food' | 'travel' | 'gaming' | 'beauty' | 'education' | 'other';
  averageEngagementRate: number;
  preferredContactMethod: 'email' | 'phone' | 'instagram' | 'youtube';
  createdAt: string;
  updatedAt: string;
}

export interface CampaignTargetCategory {
  category: Creator['category'];
  minFollowers: number;
  maxBudgetPerCreator: number;
}

export interface Campaign {
  campaignId: string = ''; // Nullable for new campaigns
  brandId: string;
  campaignName: string;
  description: string;
  budget: number;
  targetAudience: string;
  deliverables: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'negotiating' | 'completed' | 'cancelled';
  targetCreatorCategories: CampaignTargetCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface Negotiation {
  negotiationId: string = ''; // Nullable for new negotiations
  campaignId: string;
  brandId: string;
  creatorId: string;
  status: 'initiated' | 'email_sent' | 'phone_contacted' | 'in_progress' | 'deal_proposed' | 'accepted' | 'rejected' | 'cancelled';
  proposedRate: number;
  counterRate: number;
  finalRate: number;
  maxBudget: number;
  deliverables: string; // Freeform field like "1 post, 3 reels, 1 story"
  aiAgentNotes: string;
  creatorAvailability: 'available' | 'busy' | 'unavailable' | 'unknown';
  initialContactMethod: 'email' | 'phone' | 'instagram' | 'youtube';
  phoneContactAttempted: boolean;
  voiceCallCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  escalationCount: number;
}

export interface Communication {
  communicationId: string = ''; // Nullable for new communications
  negotiationId: string;
  type: 'email' | 'voice_call' | 'instagram_dm' | 'youtube_message';
  direction: 'outbound' | 'inbound';
  status: 'sent' | 'delivered' | 'opened' | 'replied' | 'failed' | 'completed';
  subject: string;
  content: string;
  aiAgentUsed: boolean;
  voiceCallDuration: number;
  voiceCallSummary: string;
  followUpRequired: boolean;
  followUpDate: string;
  messageId: string;
  createdAt: string;
  references?: string; // References to previous communications or related messages
}

export interface Deal {
  dealId: string = ''; // Nullable for new deals
  negotiationId: string;
  campaignId: string;
  brandId: string;
  creatorId: string;
  finalRate: number;
  paymentTerms: 'immediate' | '30_days' | '60_days' | 'on_delivery' | 'milestone_based';
  deliverables: string; // Freeform field like "1 post, 3 reels, 1 story"
  contractSigned: boolean;
  contractSignedDate: string;
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed';
  dealStatus: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBase {
  kbId: string; // ElevenLabs knowledge base ID
  name: string;
  brandId: string;
  creatorId?: string;
  campaignId?: string;
  negotiationId?: string;
  sourceType: 'generated' | 'manual' | 'email' | 'deal_summary';
  sourceDocId?: string; // ID of the originating doc/email/etc.
  content: string; // Markdown or plain text content
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceAgent {
  agentId: string; // ElevenLabs Agent ID
  brandId: string;
  linkedKbIds: string[]; // List of knowledge base IDs attached to the agent
  defaultPhoneNumberId: string; // ElevenLabs phone number ID assigned to this agent
  isActive: boolean;
  firstMessage?: string; // Optional first message used in voice calls
  systemPrompt?: string; // Optional system prompt or instructions
  createdAt: string;
  updatedAt: string;
  agentPhoneNumberId?: string; // Optional reference to the phone number used by this agent
}

export interface VoiceCommunication {
  voiceCommunicationId: string;
  negotiationId: string;
  brandId: string;
  creatorId: string;
  voiceAgentId: string; // Reference to the voice agent used
  agentId: string;
  conversationId: string;
  callSid: string;
  status: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
  hasAudio: boolean;
  hasUserAudio: boolean;
  hasResponseAudio: boolean;
  startTimeUnixSecs: number;
  callDurationSecs: number;
  transcript: VoiceTranscriptMessage[];
  rawPayload: any; // full JSON payload from ElevenLabs
  createdAt: string;
  updatedAt: string;
  phone: string; // Phone number used for the call
}

export interface VoiceTranscriptMessage {
  role: 'user' | 'agent';
  message: string;
  time_in_call_secs: number;
}

export interface Chunk {
  chunkId: string; // Firestore doc ID
  sourceId: string; // ID of the brand, creator, campaign, etc.
  parentCollection: 'brands' | 'creators' | 'campaigns' | 'communications' | 'voiceCommunications'; // source collection
  chunkText: string; // the actual paragraph or section
  chunkIndex: number; // position of the chunk in the original document (e.g. 0, 1, 2)
  vector: number[]; // 768-dim or 2048-dim embedding
  sourceDocId?: string; // optional: source PDF, email, or file ID if chunked from uploaded document
  language?: string; // e.g. 'en', 'hi', etc. for multilingual support
  tags?: string[]; // optional categorization tags like ['pricing', 'target', 'brief']
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// Collection: userChats
export interface UserChat {
  sessionId: string;         // Unique per user-chat session (can be WhatsApp thread ID, etc.)
  userId: string;            // Firebase UID or brandId
  messages: Message[];       // Array of messages
  createdAt: string;         // ISO timestamp
  updatedAt: string;         // For sorting or purging
}

export interface Message {
  role: 'human' | 'ai';
  content: string;
  timestamp: string;         // ISO timestamp
}

export interface CreatorAssignment {
  id?: string;
  userId: string;
  creatorId: string;
  campaignIds: string[];
  phoneDiscovered: boolean;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}