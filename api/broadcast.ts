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

  // The primary database ID where client tokens and collections are saved
  const primaryDbId = process.env.FIREBASE_DATABASE_ID || "ai-studio-45fb3207-d536-45da-87f6-8b2651c59b61";
  const messaging = getMessaging();

  return { primaryDbId, messaging };
}

async function getTokensSnapshot(primaryDbId: string) {
  // First attempt: Primary database
  try {
    const db = getFirestore(primaryDbId);
    return await db.collection('fcmTokens').get();
  } catch (err: any) {
    // If not found (code 5), fallback to default database
    if (err?.code === 5 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('Database not found')) {
      console.warn(`[api/broadcast] Database "${primaryDbId}" not found, falling back to default database...`);
      try {
        const defaultDb = getFirestore();
        return await defaultDb.collection('fcmTokens').get();
      } catch (fallbackErr) {
        console.error('[api/broadcast] Fallback to default database also failed:', fallbackErr);
        throw err;
      }
    }
    throw err;
  }
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
    const { primaryDbId, messaging } = getFirebaseAdmin();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { title, body: messageBody, targetGroup, testToken, token } = body;

    console.log('[api/broadcast] Request received:', { title, targetGroup, hasTestToken: !!(testToken || token) });

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let tokens: string[] = [];

    // If an explicit test token was sent (e.g. from the dashboard Quick Test), add it directly
    const directToken = testToken || token;
    if (directToken && typeof directToken === 'string') {
      tokens.push(directToken);
    }

    let mobileCount = 0;
    let desktopCount = 0;

    // 1. Fetch tokens from Firestore
    try {
      const tokensSnapshot = await getTokensSnapshot(primaryDbId);
      console.log(`[api/broadcast] Total tokens in Firestore: ${tokensSnapshot.size}`);

      const matchedTokens: string[] = [];

      tokensSnapshot.docs.forEach((doc: any) => {
        const data = doc.data() || {};
        const tokenStr = data.token;
        if (!tokenStr || typeof tokenStr !== 'string') return;

        // Target group filter
        let isMatch = true;
        if (targetGroup && Object.keys(targetGroup).length > 0) {
          const deptMatch = !targetGroup.department || targetGroup.department === 'All' || !data.department || data.department === 'All' || String(targetGroup.department).toLowerCase() === String(data.department).toLowerCase();
          const courseMatch = !targetGroup.course || targetGroup.course === 'All' || !data.course || data.course === 'All' || String(targetGroup.course).toLowerCase() === String(data.course).toLowerCase();
          const yearMatch = !targetGroup.academicYear || targetGroup.academicYear === 'All' || !data.academicYear || data.academicYear === 'All' || String(targetGroup.academicYear).toLowerCase() === String(data.academicYear).toLowerCase();
          isMatch = deptMatch && courseMatch && yearMatch;
        }

        if (isMatch) {
          matchedTokens.push(tokenStr);
          if (data.deviceType === 'mobile' || /Android|webOS|iPhone|iPad/i.test(data.userAgent || '')) {
            mobileCount++;
          } else {
            desktopCount++;
          }
        }
      });

      tokens = [...tokens, ...matchedTokens];
    } catch (dbErr: any) {
      console.error('[api/broadcast] Could not query Firestore fcmTokens:', dbErr);
      // If we don't have directToken and DB query failed, propagate error
      if (tokens.length === 0) {
        throw dbErr;
      }
    }

    tokens = [...new Set(tokens)];

    if (tokens.length === 0) {
      console.log('[api/broadcast] No eligible tokens found for target group:', targetGroup);
      return res.status(200).json({ success: true, message: 'No eligible tokens found', sentCount: 0, mobileCount: 0, desktopCount: 0 });
    }

    console.log(`[api/broadcast] Sending broadcast to ${tokens.length} token(s) (Mobile: ${mobileCount}, Desktop: ${desktopCount})...`);

    const broadcastTag = 'campus-broadcast-' + Date.now();

    const message: any = {
      notification: {
        title: title,
        body: messageBody || '',
      },
      // Data payload for mobile background workers and Android apps
      data: {
        title: title,
        body: messageBody || '',
        url: '/',
        click_action: '/',
        tag: broadcastTag,
        timestamp: String(Date.now()),
        priority: 'high',
      },
      // Webpush payload for desktop and mobile browsers (Chrome, Edge, Safari PWA)
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400',
        },
        notification: {
          title: title,
          body: messageBody || '',
          icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
          badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
          vibrate: [200, 100, 200, 100, 200], // Mobile vibration pattern
          requireInteraction: true,
          tag: broadcastTag,
          renotify: true,
          silent: false,
          data: {
            url: '/',
          },
        },
        fcmOptions: {
          link: '/',
        },
      },
      // Android payload for mobile push services
      android: {
        priority: 'high',
        notification: {
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          channelId: 'campus_alerts',
          tag: broadcastTag,
        },
      },
      tokens: tokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    console.log('[api/broadcast] FCM response - Success:', response.successCount, 'Failures:', response.failureCount);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[api/broadcast] Token ${idx} failed:`, resp.error);
        }
      });
    }

    return res.status(200).json({
      success: true,
      sentCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: tokens.length,
      mobileCount,
      desktopCount,
    });
  } catch (error: any) {
    console.error('[api/broadcast] Error:', error);
    return res.status(500).json({
      error: 'Failed to send broadcast',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
