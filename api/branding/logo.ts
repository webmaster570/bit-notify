import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
      } catch {
        initializeApp({ projectId });
      }
    } else {
      initializeApp({ projectId });
    }
  }

  const primaryDbId = process.env.FIREBASE_DATABASE_ID || "ai-studio-45fb3207-d536-45da-87f6-8b2651c59b61";
  return { primaryDbId };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Acknowledge upload
    return res.json({ success: true, url: '/api/branding/logo' });
  }

  try {
    const { primaryDbId } = getFirebaseAdmin();
    const db = getFirestore(primaryDbId);
    const brandingDoc = await db.collection('settings').doc('branding').get();

    if (brandingDoc.exists) {
      const data = brandingDoc.data();
      if (data && data.logoUrl && data.logoUrl.startsWith('data:')) {
        const matches = data.logoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mime = matches[1];
          const imgBuffer = Buffer.from(matches[2], 'base64');
          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': imgBuffer.length,
            'Cache-Control': 'public, max-age=0, must-revalidate',
          });
          return res.end(imgBuffer);
        }
      } else if (data && data.logoUrl && (data.logoUrl.startsWith('http://') || data.logoUrl.startsWith('https://'))) {
        return res.redirect(302, data.logoUrl);
      }
    }
  } catch (err) {
    console.warn('[api/branding/logo] Error loading branding from Firestore:', err);
  }

  // Redirect to official high-res BIT Mesra emblem
  return res.redirect(302, 'https://bitmesra.ac.in/sitelogo/bit-newlogo.png');
}
