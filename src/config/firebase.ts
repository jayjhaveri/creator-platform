import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        storageBucket: 'creator-platform-461506.firebasestorage.app',
    }); // Uses Application Default Credentials
}

export const auth = admin.auth();
export const db = admin.firestore();
