import { getMatchingCampaignsByVector } from '../lib/vectorSearch';

export async function resolveCampaign({ userInput, phone }: { userInput: string, phone: string }) {
    const campaigns = await getMatchingCampaignsByVector(userInput, phone);


    if (!campaigns || campaigns.length === 0) {
        return { status: 'not_found' };
    }

    if (campaigns.length === 1) {
        const campaign = campaigns[0];
        return {
            status: 'found',
            campaignId: campaign.id,
            campaignName: campaign.campaignName,
            description: campaign.description,
        };
    }

    // Multiple matches — ask user to choose
    return {
        status: 'multiple',
        options: campaigns.map((c: any) => ({
            campaignId: c.id,
            campaignName: c.campaignName,
            description: c.description,
        })),
    };
}