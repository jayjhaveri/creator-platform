import { Brand, Creator, Campaign, CampaignPlatformRequirement, CampaignTargetCategory, Negotiation, Communication, Deal, Deliverable } from './schema';

export const defaultBrand = (): Brand => ({
    brandId: '',
    brandName: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    companySize: 'startup',
    description: '',
    uid: '',
    totalBudget: 0,
    isActive: false,
    createdAt: '',
    updatedAt: '',
});

export const defaultCreator = (): Creator => ({
    creatorId: '',
    displayName: '',
    email: '',
    phone: '',
    instagramHandle: '',
    instagramFollowers: 0,
    youtubeHandle: '',
    youtubeSubscribers: 0,
    category: 'other',
    averageEngagementRate: 0,
    preferredContactMethod: 'email',
    createdAt: '',
    updatedAt: '',
    bio: '',
    profilePictureUrl: ''
});

export const defaultCampaignPlatformRequirement = (): CampaignPlatformRequirement => ({
    platform: 'instagram',
    contentType: 'post',
    quantity: 0,
});

export const defaultCampaignTargetCategory = (): CampaignTargetCategory => ({
    category: 'other',
    minFollowers: 0,
    maxBudgetPerCreator: 0,
});

export const defaultCampaign = (): Campaign => ({
    campaignId: '',
    brandId: '',
    campaignName: '',
    description: '',
    budget: 0,
    targetAudience: '',
    requiredPlatforms: [],
    startDate: '',
    endDate: '',
    status: 'draft',
    targetCreatorCategories: [],
    createdAt: '',
    updatedAt: '',
});

export const defaultDeliverable = (): Deliverable => ({
    platform: 'instagram',
    contentType: 'post',
    quantity: 0,
    deadline: '',
    status: 'pending',
});

export const defaultNegotiation = (): Negotiation => ({
    negotiationId: '',
    campaignId: '',
    brandId: '',
    creatorId: '',
    status: 'initiated',
    proposedRate: 0,
    counterRate: 0,
    finalRate: 0,
    maxBudget: 0,
    deliverables: [],
    aiAgentNotes: '',
    creatorAvailability: 'unknown',
    initialContactMethod: 'email',
    phoneContactAttempted: false,
    voiceCallCompleted: false,
    createdAt: '',
    updatedAt: '',
    escalationCount: 0,
});

export const defaultCommunication = (): Communication => ({
    communicationId: '',
    negotiationId: '',
    type: 'email',
    direction: 'outbound',
    status: 'sent',
    subject: '',
    content: '',
    aiAgentUsed: false,
    voiceCallDuration: 0,
    voiceCallSummary: '',
    followUpRequired: false,
    followUpDate: '',
    messageId: '',
    createdAt: '',
});

export const defaultDeal = (): Deal => ({
    dealId: '',
    negotiationId: '',
    campaignId: '',
    brandId: '',
    creatorId: '',
    finalRate: 0,
    paymentTerms: 'immediate',
    deliverables: [],
    contractSigned: false,
    contractSignedDate: '',
    paymentStatus: 'pending',
    dealStatus: 'active',
    createdAt: '',
    updatedAt: '',
});
