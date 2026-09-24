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
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0844415258",
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
      });
    } else {
      // Fallback for local development or when env vars aren't set yet
      initializeApp({
        projectId: "gen-lang-client-0844415258"
      });
    }
  }

  const db = getFirestore("ai-studio-45fb3207-d536-45da-87f6-8b2651c59b61");
  const messaging = getMessaging();

  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  app.post('/api/broadcast', async (req, res) => {
    const { title, body, targetGroup } = req.body;

    try {
      // 1. Fetch tokens from Firestore
      const tokensSnapshot = await db.collection('fcmTokens').get();
      const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

      if (tokens.length === 0) {
        return res.status(200).json({ success: true, message: 'No tokens found' });
      }

      // 2. Send multicast message
      const message = {
        notification: {
          title: title,
          body: body,
        },
        tokens: tokens,
      };

      const response = await messaging.sendEachForMulticast(message);
      console.log('Successfully sent messages:', response);

      res.status(200).json({ 
        success: true, 
        sentCount: response.successCount, 
        failureCount: response.failureCount 
      });
    } catch (error) {
      console.error('Error sending broadcast:', error);
      res.status(500).json({ error: 'Failed to send broadcast' });
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
