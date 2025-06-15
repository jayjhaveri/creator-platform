//src/services/creatorAssignmentsService.ts
import { db } from '../config/firebase';
import { CreatorAssignment } from '../types/schema';

const collectionRef = db.collection('creatorAssignments');

export const creatorAssignmentsService = {
    async createOrUpdateAssignment(
        userId: string,
        creatorId: string,
        campaignId: string
    ): Promise<void> {
        const snapshot = await collectionRef
            .where('userId', '==', userId)
            .where('creatorId', '==', creatorId)
            .get();

        const now = new Date().toISOString();

        if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            const data = docSnap.data() as CreatorAssignment;

            if (!data.campaignIds.includes(campaignId)) {
                const updatedCampaignIds = [...data.campaignIds, campaignId];
                await docSnap.ref.update({
                    campaignIds: updatedCampaignIds,
                    updatedAt: now,
                });
            }
        } else {
            const assignmentData: Omit<CreatorAssignment, 'id'> = {
                userId,
                creatorId,
                campaignIds: [campaignId],
                phoneDiscovered: false,
                createdAt: now,
                updatedAt: now,
            };
            await collectionRef.add(assignmentData);
        }
    },

    async getAssignmentsByUser(userId: string): Promise<CreatorAssignment[]> {
        const snapshot = await collectionRef.where('userId', '==', userId).get();

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: typeof data.createdAt === 'string'
                    ? data.createdAt
                    : new Date(data.createdAt).toISOString(),
                updatedAt: typeof data.updatedAt === 'string'
                    ? data.updatedAt
                    : new Date(data.updatedAt).toISOString(),
            } as CreatorAssignment;
        });
    },

    async getCreatorAssignment(
        userId: string,
        creatorId: string
    ): Promise<CreatorAssignment | null> {
        const snapshot = await collectionRef
            .where('userId', '==', userId)
            .where('creatorId', '==', creatorId)
            .get();

        if (snapshot.empty) return null;

        const docSnap = snapshot.docs[0];
        const data = docSnap.data();

        return {
            id: docSnap.id,
            ...data,
            createdAt: typeof data.createdAt === 'string'
                ? data.createdAt
                : new Date(data.createdAt).toISOString(),
            updatedAt: typeof data.updatedAt === 'string'
                ? data.updatedAt
                : new Date(data.updatedAt).toISOString(),
        } as CreatorAssignment;
    },

    async isCreatorAssigned(
        userId: string,
        creatorId: string,
        campaignId: string
    ): Promise<boolean> {
        const assignment = await this.getCreatorAssignment(userId, creatorId);
        return assignment?.campaignIds.includes(campaignId) ?? false;
    },

    async removeCampaignFromCreator(
        userId: string,
        creatorId: string,
        campaignId: string
    ): Promise<void> {
        const snapshot = await collectionRef
            .where('userId', '==', userId)
            .where('creatorId', '==', creatorId)
            .get();

        if (snapshot.empty) return;

        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as CreatorAssignment;

        const updatedCampaignIds = data.campaignIds.filter(id => id !== campaignId);

        if (updatedCampaignIds.length === 0) {
            await docSnap.ref.delete();
        } else {
            await docSnap.ref.update({
                campaignIds: updatedCampaignIds,
                updatedAt: new Date().toISOString(),
            });
        }
    },

    async getAssignmentsByCampaign(
        campaignId: string
    ): Promise<CreatorAssignment[]> {
        const snapshot = await collectionRef
            .where('campaignIds', 'array-contains', campaignId)
            .get();

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: typeof data.createdAt === 'string'
                    ? data.createdAt
                    : new Date(data.createdAt).toISOString(),
                updatedAt: typeof data.updatedAt === 'string'
                    ? data.updatedAt
                    : new Date(data.updatedAt).toISOString(),
            } as CreatorAssignment;
        });
    },

    async updatePhoneDiscovery(
        userId: string,
        creatorId: string,
        phoneNumber?: string
    ): Promise<void> {
        const snapshot = await collectionRef
            .where('userId', '==', userId)
            .where('creatorId', '==', creatorId)
            .get();

        if (snapshot.empty) return;

        const docSnap = snapshot.docs[0];
        await docSnap.ref.update({
            phoneDiscovered: !!phoneNumber,
            phoneNumber: phoneNumber ?? null,
            updatedAt: new Date().toISOString(),
        });
    },
};