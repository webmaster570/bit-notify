
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function cleanup() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0844415258";
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      initializeApp({
        credential: cert({
          projectId: projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
      });
    } else {
      initializeApp({ projectId });
    }
  }

  const databaseId = process.env.FIREBASE_DATABASE_ID || "ai-studio-45fb3207-d536-45da-87f6-8b2651c59b61";
  const db = getFirestore(databaseId);

  console.log('Fetching tokens for cleanup...');
  const snapshot = await db.collection('fcmTokens').get();
  console.log(`Found ${snapshot.size} token documents.`);

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (snapshot.size > 0) {
    await batch.commit();
    console.log('Successfully deleted all tokens.');
  } else {
    console.log('No tokens to delete.');
  }
}

cleanup().catch(console.error);
