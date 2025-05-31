import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp(); // Uses Application Default Credentials
}

export const auth = admin.auth();
export const db = admin.firestore();
