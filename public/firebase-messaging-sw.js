importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const CACHE_NAME = 'edunotify-branding-v3';

// Helper to sanitize and resolve logo URL: always reject flaticon or legacy placeholders,
// and guarantee the BIT Mesra emblem is used.
function sanitizeNotificationIcon(candidate) {
  const fallback = self.location.origin + '/bit-mesra-logo.png?v=3';
  if (!candidate || typeof candidate !== 'string') {
    return fallback;
  }
  // Strip any old flaticon or cached graduation cap
  if (candidate.includes('flaticon.com') || candidate.includes('3135823')) {
    return fallback;
  }
  if (candidate.startsWith('http://') || candidate.startsWith('https://') || candidate.startsWith('data:')) {
    return candidate;
  }
  try {
    return new URL(candidate, self.location.origin).href;
  } catch {
    return fallback;
  }
}

// Service worker lifecycle activation & pre-caching branding assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/bit-mesra-logo.png?v=3',
        '/logo.png?v=3',
        '/favicon.png?v=3',
        '/bit-mesra-banner.png?v=3'
      ]);
    }).catch((err) => {
      console.warn('Asset pre-caching skipped:', err);
    })
  );
});

// Purge any and all obsolete caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Purging obsolete cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for client message to manually force-clear all caches
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    });
  }
});

firebase.initializeApp({
  apiKey: "AIzaSyAPWGfjLqUfjMsFOB0WKkSau3NRL1roRFM",
  authDomain: "gen-lang-client-0844415258.firebaseapp.com",
  projectId: "gen-lang-client-0844415258",
  storageBucket: "gen-lang-client-0844415258.firebasestorage.app",
  messagingSenderId: "171725930908",
  appId: "1:171725930908:web:d7eff0c76e1c1be6678859"
});

const messaging = firebase.messaging();

// Handle background messages with rich mobile support and BIT Mesra / uploaded institutional logo
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload?.notification?.title || payload?.data?.title || 'BIT Mesra Campus Alert';
  
  // Guarantee official BIT Mesra emblem or active uploaded logo (reject any flaticon)
  const rawIcon = payload?.notification?.icon || payload?.data?.icon;
  const rawBadge = payload?.notification?.badge || payload?.data?.badge;
  const notificationIcon = sanitizeNotificationIcon(rawIcon);
  const notificationBadge = sanitizeNotificationIcon(rawBadge);

  const notificationOptions = {
    body: payload?.notification?.body || payload?.data?.body || 'New announcement available.',
    icon: notificationIcon,
    badge: notificationBadge,
    image: payload?.notification?.image || payload?.data?.image || undefined,
    // Mobile specific haptics & presentation
    vibrate: [200, 100, 200, 100, 200],
    renotify: true,
    requireInteraction: true,
    tag: payload?.data?.tag || ('campus-alert-' + (payload?.data?.timestamp || Date.now())),
    silent: false,
    data: {
      url: payload?.fcmOptions?.link || payload?.data?.url || '/',
      icon: notificationIcon
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Fallback listener for raw push events on mobile browsers
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const rawData = event.data.json();
    // If the message does not have a top-level notification object (e.g. data-only push on mobile)
    if (rawData && !rawData.notification && rawData.data) {
      const title = rawData.data.title || 'BIT Mesra Campus Alert';
      const notificationIcon = sanitizeNotificationIcon(rawData.data.icon);
      const notificationBadge = sanitizeNotificationIcon(rawData.data.badge);
      const options = {
        body: rawData.data.body || 'New campus update.',
        icon: notificationIcon,
        badge: notificationBadge,
        image: rawData.data.image || undefined,
        vibrate: [200, 100, 200, 100, 200],
        renotify: true,
        requireInteraction: true,
        tag: rawData.data.tag || ('campus-alert-' + Date.now()),
        data: { 
          url: rawData.data.url || '/',
          icon: notificationIcon
        }
      };
      event.waitUntil(self.registration.showNotification(title, options));
    }
  } catch (e) {
    // If not JSON or already handled, continue silently
  }
});

// Click action handling for desktop and mobile devices
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
