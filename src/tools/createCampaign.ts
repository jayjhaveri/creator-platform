import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/firebase';
import { CampaignPlatformRequirement } from '../types/schema'; // adjust path as needed

export async function createCampaign({
    brandId,
    campaignName,
    description,
    budget,
    targetAudience,
    startDate,
    endDate,
    requiredPlatforms
}: {
    brandId: string;
    campaignName: string;
    description: string;
    budget: number;
    targetAudience: string;
    startDate: string;
    endDate: string;
    requiredPlatforms: CampaignPlatformRequirement[];
}): Promise<{
    status: string;
    campaignId: string;
    campaignName: string;
    description: string;
    budget: number;
    targetAudience: string;
    startDate: string;
    endDate: string;
    requiredPlatforms: CampaignPlatformRequirement[];
}> {
    const campaignId = uuidv4();
    const now = new Date().toISOString();

    const campaign = {
        campaignId,
        brandId,
        campaignName,
        description,
        budget,
        targetAudience,
        startDate,
        endDate,
        requiredPlatforms,
        status: 'draft',
        targetCreatorCategories: [],
        createdAt: now,
        updatedAt: now,
    };

    await db.collection('campaigns').doc(campaignId).set(campaign);

    return {
        status: 'created',
        campaignId,
        campaignName,
        description,
        budget,
        targetAudience,
        startDate,
        endDate,
        requiredPlatforms,
    };
}