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

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'unknown_device';
  let deviceId = localStorage.getItem('edu_device_id');
  if (!deviceId) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    deviceId = (isMobile ? 'mob_' : 'desk_') + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36);
    try {
      localStorage.setItem('edu_device_id', deviceId);
    } catch {
      // Ignore localStorage write failures
    }
  }
  return deviceId;
}

export function getDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

export const requestForToken = async (registration?: ServiceWorkerRegistration) => {
  if (!messaging) {
    console.log('Messaging not supported/initialized');
    return null;
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('Notifications not supported by this browser');
    return null;
  }
  
  try {
    // Request permission first
    const permission = Notification.permission === 'default' 
      ? await Notification.requestPermission() 
      : Notification.permission;
      
    if (permission !== 'granted') {
      console.log('Notification permission not granted:', permission);
      return null;
    }

    let swRegistration = registration;
    if (!swRegistration && 'serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('Could not get navigator.serviceWorker.ready:', swErr);
      }
    }

    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_VAPID_KEY || 'BJO530hzi2JWHttuCtYUrtwWKKWJGCeDka_xwc9nXTzHaeDHjQh11ADLKtl_o34OEOiNXdxsydAIp6CMqLo_q0w',
      serviceWorkerRegistration: swRegistration
    });
    
    if (currentToken) {
      console.log('FCM Token generated successfully');
      try {
        localStorage.setItem('edu_current_fcm_token', currentToken);
      } catch {
        // Ignore
      }
      
      // Store the token for the current user in Firestore
      if (auth.currentUser) {
        let userData: any = {};
        try {
          const userDoc = await getDocFromServer(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            userData = userDoc.data();
          }
        } catch (profileErr) {
          console.warn('Profile read skipped or unavailable during token save:', profileErr);
        }

        const deviceId = getDeviceId();
        const deviceType = getDeviceType();

        const tokenPayload = {
          token: currentToken,
          deviceId: deviceId,
          deviceType: deviceType,
          platform: typeof navigator !== 'undefined' ? (navigator.platform || 'unknown') : 'unknown',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 150) : '',
          updatedAt: serverTimestamp(),
          email: auth.currentUser.email,
          uid: auth.currentUser.uid,
          department: userData.department || 'All',
          category: userData.category || 'All',
          course: userData.course || 'All',
          academicYear: userData.academicYear || 'All'
        };

        // To prevent "zombie" notifications when multiple users share a device:
        // 1. Store the token using a stable document ID: deviceId (NOT user_deviceId)
        // This ensures one device = one record in the database.
        const tokenRef = doc(db, 'fcmTokens', deviceId);
        await setDoc(tokenRef, tokenPayload, { merge: true });

        // 3. For compatibility with legacy targeting, also update the UID doc
        const userTokenRef = doc(db, 'fcmTokens', auth.currentUser.uid);
        await setDoc(userTokenRef, tokenPayload, { merge: true });

        console.log(`FCM Token updated for device ${deviceId} (${deviceType})`);
      } else {
        console.warn('FCM Token generated but no user is logged in');
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
