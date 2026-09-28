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
    const { title, body: messageBody, targetGroup, testToken, token, tokens: directTokens, icon, badge, image } = body;

    console.log('[api/broadcast] Request received:', { 
      title, 
      targetGroup, 
      hasTestToken: !!(testToken || token), 
      directTokenCount: Array.isArray(directTokens) ? directTokens.length : 0,
      hasCustomIcon: !!icon 
    });

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let tokens: string[] = [];

    // 1. If explicit tokens were provided in the request body
    if (Array.isArray(directTokens) && directTokens.length > 0) {
      tokens.push(...directTokens.filter(t => typeof t === 'string' && t.trim().length > 0));
    }

    const singleToken = testToken || token;
    if (singleToken && typeof singleToken === 'string') {
      tokens.push(singleToken);
    }

    let mobileCount = 0;
    let desktopCount = 0;

    // 2. Fetch additional tokens from Firestore if accessible
    try {
      const tokensSnapshot = await getTokensSnapshot(primaryDbId);
      console.log(`[api/broadcast] Total tokens in Firestore: ${tokensSnapshot.size}`);

      const matchedTokens: string[] = [];

      tokensSnapshot.docs.forEach((docSnap: any) => {
        const data = docSnap.data() || {};
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
        }
      });

      tokens = [...tokens, ...matchedTokens];
    } catch (dbErr: any) {
      console.warn('[api/broadcast] Firestore query skipped or failed (using direct tokens):', dbErr?.message || dbErr);
    }

    tokens = [...new Set(tokens)];

    tokens.forEach(() => {
      mobileCount++;
    });

    if (tokens.length === 0) {
      console.log('[api/broadcast] No eligible tokens found for target group:', targetGroup);
      return res.status(200).json({ 
        success: true, 
        message: 'No eligible tokens found. Please ensure users have enabled notifications.', 
        sentCount: 0, 
        mobileCount: 0, 
        desktopCount: 0 
      });
    }

    console.log(`[api/broadcast] Sending broadcast to ${tokens.length} token(s)...`);

    const broadcastTag = 'campus-alert-' + Date.now();

    // Resolve origin for fully qualified icon URLs
    const origin = req.headers.origin 
      || (req.headers.referer ? new URL(req.headers.referer).origin : '') 
      || (req.headers.host ? `https://${req.headers.host}` : '');

    // Resolve notification icon: prioritize uploaded/sent icon, else active portal branding, else default BIT Mesra logo
    let resolvedIcon = icon;
    if (!resolvedIcon || resolvedIcon.includes('flaticon') || resolvedIcon.includes('3135823')) {
      try {
        const db = getFirestore(primaryDbId);
        const brandingDoc = await db.collection('settings').doc('branding').get();
        if (brandingDoc.exists) {
          const bData = brandingDoc.data();
          if (bData && bData.logoUrl && !bData.logoUrl.includes('flaticon') && !bData.logoUrl.includes('3135823')) {
            resolvedIcon = bData.logoUrl;
          }
        }
      } catch (bErr) {
        console.warn('[api/broadcast] Could not read branding doc for push icon:', bErr);
      }
    }

    // High availability BIT Mesra official emblem fallback
    const bitMesraOfficialUrl = 'https://bitmesra.ac.in/sitelogo/bit-newlogo.png';
    const defaultLocalLogo = origin ? `${origin}/bit-mesra-logo.png?v=4` : bitMesraOfficialUrl;

    if (!resolvedIcon || resolvedIcon.includes('flaticon') || resolvedIcon.includes('3135823')) {
      resolvedIcon = defaultLocalLogo;
    } else if (resolvedIcon.startsWith('data:')) {
      resolvedIcon = origin ? `${origin}/api/branding/logo` : bitMesraOfficialUrl;
    } else if (resolvedIcon.startsWith('/')) {
      resolvedIcon = origin ? `${origin}${resolvedIcon}` : bitMesraOfficialUrl;
    }

    const resolvedBadge = origin ? `${origin}/bit-mesra-logo.png?v=4` : bitMesraOfficialUrl;

    const message: any = {
      notification: {
        title: title,
        body: messageBody || '',
      },
      // Data payload for mobile background workers and Android apps
      data: {
        title: String(title),
        body: String(messageBody || ''),
        icon: String(resolvedIcon),
        badge: String(resolvedBadge),
        image: String(image || ''),
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
          icon: resolvedIcon,
          badge: resolvedBadge,
          image: image || undefined,
          vibrate: [200, 100, 200, 100, 200], // Mobile vibration pattern
          tag: broadcastTag,
          renotify: true,
          silent: false,
          data: {
            url: '/',
            icon: resolvedIcon,
          },
        },
        fcmOptions: {
          link: '/',
        },
      },
      tokens: tokens,
    };

    console.log('[api/broadcast] Sending multicast with icon:', resolvedIcon);
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
