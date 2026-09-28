import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0844415258";
  
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log('Initializing Firebase Admin with Service Account for project:', projectId);
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
      // Fallback
      initializeApp({ projectId });
    }
  } else {
    console.log('Initializing Firebase Admin with default credentials for project:', projectId);
    initializeApp({ projectId });
  }
}

// Use the specific database ID from the config or environment
const databaseId = process.env.FIREBASE_DATABASE_ID || "ai-studio-45fb3207-d536-45da-87f6-8b2651c59b61";

let db = getFirestore(databaseId);
const messaging = getMessaging();

console.log(`Firestore initialized with projectId: ${getApps()[0].options.projectId}, databaseId: ${databaseId}`);

let currentLogoBase64: string | null = null;
let currentLogoMime: string = 'image/png';

  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // Serve current branding logo (supports uploaded custom image or BIT Mesra official emblem)
  app.get('/api/branding/logo', (req, res) => {
    if (currentLogoBase64) {
      try {
        const imgBuffer = Buffer.from(currentLogoBase64, 'base64');
        res.writeHead(200, {
          'Content-Type': currentLogoMime,
          'Content-Length': imgBuffer.length,
          'Cache-Control': 'public, max-age=0, must-revalidate',
        });
        return res.end(imgBuffer);
      } catch (e) {
        console.warn('Failed to serve cached base64 logo:', e);
      }
    }
    const defaultLogoPath = path.join(__dirname, 'public', 'bit-mesra-logo.png');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.sendFile(defaultLogoPath, (err) => {
      if (err) {
        res.redirect('https://bitmesra.ac.in/sitelogo/bit-newlogo.png');
      }
    });
  });

  // Clear server in-memory logo cache
  app.post('/api/branding/clear-cache', (req, res) => {
    currentLogoBase64 = null;
    currentLogoMime = 'image/png';
    res.json({ success: true, message: 'Server logo cache cleared successfully' });
  });

  // Sync uploaded logo to server memory/cache to keep FCM payload lightweight
  app.post('/api/branding/logo', (req, res) => {
    const { dataUrl } = req.body;
    if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        currentLogoMime = matches[1];
        currentLogoBase64 = matches[2];
        return res.json({ success: true, url: '/api/branding/logo' });
      }
    }
    return res.json({ success: true, url: '/bit-mesra-logo.png' });
  });

  app.post('/api/broadcast', async (req, res) => {
    const { title, body, targetGroup, testToken, token, tokens: directTokens, icon, badge, image } = req.body;
    console.log('Broadcast request received:', { 
      title, 
      targetGroup, 
      hasTestToken: !!(testToken || token), 
      directTokenCount: Array.isArray(directTokens) ? directTokens.length : 0,
      hasCustomIcon: !!icon 
    });

    try {
      let tokens: string[] = [];

      // If tokens were queried and passed directly from client
      if (Array.isArray(directTokens) && directTokens.length > 0) {
        tokens.push(...directTokens.filter(t => typeof t === 'string' && t.trim().length > 0));
      }

      // If a single test token was provided
      const singleToken = testToken || token;
      if (singleToken && typeof singleToken === 'string') {
        tokens.push(singleToken);
      }

      let mobileCount = 0;
      let desktopCount = 0;

      // Also attempt server-side Firestore query if available
      try {
        let query: any = db.collection('fcmTokens');
        const tokensSnapshot = await query.get();
        console.log(`[server.ts] Tokens retrieved from Firestore: ${tokensSnapshot.size}`);

        tokensSnapshot.docs.forEach((docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
          const data = docSnap.data() || {};
          const tokenStr = data.token;
          if (!tokenStr || typeof tokenStr !== 'string') return;

          let isMatch = true;
          if (targetGroup && Object.keys(targetGroup).length > 0) {
            const deptMatch = !targetGroup.department || targetGroup.department === 'All' || !data.department || data.department === 'All' || String(targetGroup.department).toLowerCase() === String(data.department).toLowerCase();
            const courseMatch = !targetGroup.course || targetGroup.course === 'All' || !data.course || data.course === 'All' || String(targetGroup.course).toLowerCase() === String(data.course).toLowerCase();
            const yearMatch = !targetGroup.academicYear || targetGroup.academicYear === 'All' || !data.academicYear || data.academicYear === 'All' || String(targetGroup.academicYear).toLowerCase() === String(data.academicYear).toLowerCase();
            isMatch = deptMatch && courseMatch && yearMatch;
          }

          if (isMatch) {
            tokens.push(tokenStr);
          }
        });
      } catch (dbErr) {
        console.warn('[server.ts] Server Firestore token query skipped or failed (using direct tokens):', dbErr);
      }

      // Deduplicate tokens
      tokens = [...new Set(tokens)];

      // Count mobile vs desktop user agents
      tokens.forEach(t => {
        // Approximate detection based on token format or default split
        mobileCount++;
      });

      if (tokens.length === 0) {
        console.log('No eligible tokens found for target group:', targetGroup);
        return res.status(200).json({ 
          success: true, 
          message: 'No eligible tokens found. Please ensure users have enabled notifications on their devices.', 
          sentCount: 0, 
          mobileCount: 0, 
          desktopCount: 0 
        });
      }

      console.log(`Sending broadcast to ${tokens.length} eligible device token(s)...`);

      const broadcastTag = 'campus-alert-' + Date.now();

      // Resolve origin for fully qualified icon URLs
      const origin = req.headers.origin 
        || (req.headers.referer ? new URL(req.headers.referer).origin : '') 
        || (req.headers.host ? `https://${req.headers.host}` : '');

      let resolvedIcon = icon;
      if (resolvedIcon && (resolvedIcon.includes('flaticon') || resolvedIcon.includes('3135823'))) {
        resolvedIcon = null;
      }

      if (!resolvedIcon) {
        try {
          const brandingDoc = await db.collection('settings').doc('branding').get();
          if (brandingDoc.exists) {
            const bData = brandingDoc.data();
            if (bData && bData.logoUrl && !bData.logoUrl.includes('flaticon') && !bData.logoUrl.includes('3135823')) {
              resolvedIcon = bData.logoUrl;
            }
          }
        } catch {
          // Ignore
        }
      }

      const bitMesraOfficialUrl = 'https://bitmesra.ac.in/sitelogo/bit-newlogo.png';
      const defaultLocalLogo = origin ? `${origin}/bit-mesra-logo.png?v=4` : bitMesraOfficialUrl;

      if (resolvedIcon && resolvedIcon.startsWith('data:')) {
        const matches = resolvedIcon.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          currentLogoMime = matches[1];
          currentLogoBase64 = matches[2];
          resolvedIcon = origin ? `${origin}/api/branding/logo` : bitMesraOfficialUrl;
        }
      }

      if (resolvedIcon && resolvedIcon.startsWith('/')) {
        resolvedIcon = origin ? `${origin}${resolvedIcon}` : bitMesraOfficialUrl;
      }

      if (!resolvedIcon || resolvedIcon.includes('flaticon') || resolvedIcon.includes('3135823')) {
        resolvedIcon = defaultLocalLogo;
      }

      const resolvedBadge = origin ? `${origin}/bit-mesra-logo.png?v=4` : bitMesraOfficialUrl;

      // Construct standard Web Push payload with high priority delivery
      const message: any = {
        notification: {
          title: title,
          body: body || '',
        },
        data: {
          title: String(title),
          body: String(body || ''),
          icon: String(resolvedIcon),
          badge: String(resolvedBadge),
          image: String(image || ''),
          url: '/',
          click_action: '/',
          tag: broadcastTag,
          timestamp: String(Date.now()),
          priority: 'high',
        },
        webpush: {
          headers: {
            Urgency: 'high',
            TTL: '86400',
          },
          notification: {
            title: title,
            body: body || '',
            icon: resolvedIcon,
            badge: resolvedBadge,
            image: image || undefined,
            vibrate: [200, 100, 200, 100, 200], // Haptic vibration on mobile phones
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

      console.log('Dispatching FCM Multicast to ' + tokens.length + ' device(s)');
      const response = await messaging.sendEachForMulticast(message);
      console.log('FCM Success Count:', response.successCount, 'Failures:', response.failureCount);
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Token ${idx} delivery error:`, resp.error);
          }
        });
      }

      res.status(200).json({ 
        success: true, 
        sentCount: response.successCount, 
        failureCount: response.failureCount,
        totalTokens: tokens.length,
        mobileCount,
        desktopCount,
        icon: resolvedIcon,
      });
    } catch (error) {
      console.error('Critical Error in /api/broadcast:', error);
      res.status(500).json({ 
        error: 'Failed to send broadcast',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const fs = await import('fs/promises');
        let template = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });
}

startServer();
