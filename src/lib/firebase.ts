import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAPWGfjLqUfjMsFOB0WKkSau3NRL1roRFM",
  authDomain: "gen-lang-client-0844415258.firebaseapp.com",
  projectId: "gen-lang-client-0844415258",
  storageBucket: "gen-lang-client-0844415258.firebasestorage.app",
  messagingSenderId: "171725930908",
  appId: "1:171725930908:web:d7eff0c76e1c1be6678859"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Use the specific database ID from the config
export const db = getFirestore(app, "ai-studio-45fb3207-d536-45da-87f6-8b2651c59b61");
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}

export const requestForToken = async () => {
  if (!messaging) {
    console.log('Messaging not supported/initialized');
    return null;
  }
  
  try {
    // Request permission first
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission not granted:', permission);
      return null;
    }

    const currentToken = await getToken(messaging, {
      vapidKey: 'BJO530hzi2JWHttuCtYUrtwWKKWJGCeDka_xwc9nXTzHaeDHjQh11ADLKtl_o34OEOiNXdxsydAIp6CMqLo_q0w'
    });
    
    if (currentToken) {
      console.log('FCM Token generated successfully');
      
      // Store the token for the current user in Firestore
      if (auth.currentUser) {
        const tokenRef = doc(db, 'fcmTokens', auth.currentUser.uid);
        await setDoc(tokenRef, {
          token: currentToken,
          updatedAt: serverTimestamp(),
          email: auth.currentUser.email,
          uid: auth.currentUser.uid
        }, { merge: true });
        console.log('FCM Token saved to Firestore for user:', auth.currentUser.uid);
      } else {
        console.warn('FCM Token generated but no user is logged in to save it to');
      }
      return currentToken;
    } else {
      console.log('No registration token available.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving or saving token:', err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
