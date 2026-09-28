import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin for Serverless environment
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0844415258";
    
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      try {
        initializeApp({
          credential: cert({
            projectId: projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          })
        });
      } catch (err) {
        console.error('Failed to initialize Firebase Admin with service account:', err);
        initializeApp({ projectId });
      }
    } else {
      initializeApp({ projectId });
    }
  }

  const isVercel = !!process.env.VERCEL;
  const defaultDatabaseId = isVercel ? "(default)" : "ai-studio-45fb3207-d536-45da-87f6-8b2651c59b61";
  const databaseId = process.env.FIREBASE_DATABASE_ID || defaultDatabaseId;

  const db = getFirestore(databaseId);
  const messaging = getMessaging();

  return { db, messaging };
}

export default async function handler(req: any, res: any) {
  // CORS support
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { db, messaging } = getFirebaseAdmin();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { title, body: messageBody, targetGroup } = body;

    console.log('[api/broadcast] Request received:', { title, targetGroup });

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // 1. Fetch tokens from Firestore with filtering
    const tokensSnapshot = await db.collection('fcmTokens').get();
    console.log(`[api/broadcast] Total tokens in database: ${tokensSnapshot.size}`);

    let tokens = tokensSnapshot.docs
      .map((doc: any) => doc.data())
      .filter((data: any) => {
        if (targetGroup && Object.keys(targetGroup).length > 0) {
          const deptMatch = !targetGroup.department || targetGroup.department === 'All' || targetGroup.department === data.department;
          const courseMatch = !targetGroup.course || targetGroup.course === 'All' || targetGroup.course === data.course;
          const yearMatch = !targetGroup.academicYear || targetGroup.academicYear === 'All' || targetGroup.academicYear === data.academicYear;
          return deptMatch && courseMatch && yearMatch;
        }
        return true;
      })
      .map((data: any) => data.token)
      .filter((token: any) => typeof token === 'string' && token.length > 0);

    tokens = [...new Set(tokens)];

    if (tokens.length === 0) {
      console.log('[api/broadcast] No eligible tokens found for target group:', targetGroup);
      return res.status(200).json({ success: true, message: 'No eligible tokens found', sentCount: 0 });
    }

    console.log(`[api/broadcast] Sending broadcast to ${tokens.length} tokens...`);

    const message = {
      notification: {
        title: title,
        body: messageBody || '',
      },
      webpush: {
        notification: {
          title: title,
          body: messageBody || '',
          icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
          click_action: '/',
          badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
        },
        fcm_options: {
          link: '/',
        },
      },
      tokens: tokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    console.log('[api/broadcast] FCM response - Success:', response.successCount, 'Failures:', response.failureCount);

    return res.status(200).json({
      success: true,
      sentCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: any) {
    console.error('[api/broadcast] Error:', error);
    return res.status(500).json({
      error: 'Failed to send broadcast',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
