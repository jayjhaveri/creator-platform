import { v4 as uuidv4 } from 'uuid';

export interface Brand {
  brandId: string = '';
  brandName: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  totalBudget: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Creator {
  creatorId: string = '';
  displayName: string;
  email: string;
  phone: string;
  instagramHandle: string;
  instagramFollowers: number;
  youtubeHandle: string;
  youtubeSubscribers: number;
  category: 'lifestyle' | 'tech' | 'fashion' | 'fitness' | 'food' | 'travel' | 'gaming' | 'beauty' | 'education' | 'other';
  averageEngagementRate: number;
  baseRate: number;
  isAvailable: boolean;
  preferredContactMethod: 'email' | 'phone' | 'instagram' | 'youtube';
  hasManager: boolean;
  managerEmail: string;
  managerPhone: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignPlatformRequirement {
  platform: 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'twitter';
  contentType: 'post' | 'story' | 'reel' | 'video' | 'live';
  quantity: number;
}

export interface CampaignTargetCategory {
  category: Creator['category'];
  minFollowers: number;
  maxBudgetPerCreator: number;
}

export interface Campaign {
  campaignId: string = '';
  brandId: string;
  campaignName: string;
  description: string;
  budget: number;
  targetAudience: string;
  requiredPlatforms: CampaignPlatformRequirement[];
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'negotiating' | 'completed' | 'cancelled';
  targetCreatorCategories: CampaignTargetCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface Deliverable {
  platform: CampaignPlatformRequirement['platform'];
  contentType: CampaignPlatformRequirement['contentType'];
  quantity: number;
  deadline: string;
  status?: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'completed';
}

export interface Negotiation {
  negotiationId: string = '';
  campaignId: string;
  brandId: string;
  creatorId: string;
  status: 'initiated' | 'email_sent' | 'phone_contacted' | 'in_progress' | 'deal_proposed' | 'accepted' | 'rejected' | 'cancelled';
  proposedRate: number;
  counterRate: number;
  finalRate: number;
  maxBudget: number;
  deliverables: Deliverable[];
  aiAgentNotes: string;
  creatorAvailability: 'available' | 'busy' | 'unavailable' | 'unknown';
  initialContactMethod: 'email' | 'phone' | 'instagram' | 'youtube';
  phoneContactAttempted: boolean;
  voiceCallCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Communication {
  communicationId: string = '';
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
  createdAt: string;
}

export interface Deal {
  dealId: string = '';
  negotiationId: string;
  campaignId: string;
  brandId: string;
  creatorId: string;
  finalRate: number;
  paymentTerms: 'immediate' | '30_days' | '60_days' | 'on_delivery' | 'milestone_based';
  deliverables: Deliverable[];
  contractSigned: boolean;
  contractSignedDate: string;
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed';
  dealStatus: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}
