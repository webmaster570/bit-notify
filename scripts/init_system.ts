import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function setup() {
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

  const configRef = db.collection('system').doc('config');
  
  await configRef.set({
    roles: ['Faculty', 'Staff', 'Student', 'PhD Scholars'],
    departments: ['ICT', 'Mathematics', 'Physics', 'Chemistry', 'Business', 'Engineering'],
    updatedAt: new Date()
  }, { merge: true });

  console.log('System configuration initialized successfully.');
}

setup().catch(console.error);
