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
// Default to "(default)" if on Vercel (custom project) unless specified
const isVercel = !!process.env.VERCEL;
const defaultDatabaseId = isVercel ? "(default)" : "ai-studio-45fb3207-d536-45da-87f6-8b2651c59b61";
const databaseId = process.env.FIREBASE_DATABASE_ID || defaultDatabaseId;

const db = getFirestore(databaseId);
const messaging = getMessaging();

console.log(`Firestore initialized with projectId: ${getApps()[0].options.projectId}, databaseId: ${databaseId}`);

  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  app.post('/api/broadcast', async (req, res) => {
    const { title, body, targetGroup } = req.body;
    console.log('Broadcast request received:', { title, targetGroup });

    try {
      // 1. Fetch tokens from Firestore with filtering
      let query: any = db.collection('fcmTokens');
      
      const tokensSnapshot = await query.get();
      console.log(`Total tokens in database: ${tokensSnapshot.size}`);

      let tokens = tokensSnapshot.docs
        .map(doc => doc.data())
        .filter(data => {
          // If targetGroup is provided, filter tokens
          if (targetGroup && Object.keys(targetGroup).length > 0) {
            const deptMatch = !targetGroup.department || targetGroup.department === 'All' || targetGroup.department === data.department;
            const courseMatch = !targetGroup.course || targetGroup.course === 'All' || targetGroup.course === data.course;
            const yearMatch = !targetGroup.academicYear || targetGroup.academicYear === 'All' || targetGroup.academicYear === data.academicYear;
            
            const isMatch = deptMatch && courseMatch && yearMatch;
            if (!isMatch) {
              console.log(`Token for ${data.email} filtered out. Target:`, targetGroup, 'Actual:', { dept: data.department, course: data.course, year: data.academicYear });
            }
            return isMatch;
          }
          return true;
        })
        .map(data => data.token)
        .filter(token => !!token); // Remove empty tokens

      // Unique tokens to avoid duplicate sends
      tokens = [...new Set(tokens)];

      if (tokens.length === 0) {
        console.log('No eligible tokens found for target group:', targetGroup);
        return res.status(200).json({ success: true, message: 'No eligible tokens found', sentCount: 0 });
      }

      console.log(`Sending broadcast to ${tokens.length} tokens...`);

      // 2. Send multicast message with enhanced config for web
      const message = {
        notification: {
          title: title,
          body: body,
        },
        webpush: {
          notification: {
            title: title,
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
            click_action: '/',
            badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png'
          },
          fcm_options: {
            link: '/'
          }
        },
        tokens: tokens,
      };

      console.log('FCM Message Payload:', JSON.stringify(message, null, 2));
      const response = await messaging.sendEachForMulticast(message);
      console.log('FCM Response Success Count:', response.successCount);
      console.log('FCM Response Failure Count:', response.failureCount);
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Token ${idx} failed:`, resp.error);
          }
        });
      }

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          console.log(`Cleaning up ${invalidTokens.length} invalid tokens...`);
          // Batch delete invalid tokens if needed, for now just log
        }
      }

      res.status(200).json({ 
        success: true, 
        sentCount: response.successCount, 
        failureCount: response.failureCount 
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
