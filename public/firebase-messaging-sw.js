importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const CACHE_NAME = 'edunotify-branding-v4';

// Helper to sanitize and resolve logo URL: always reject flaticon or legacy placeholders,
// and guarantee the official BIT Mesra emblem is used.
function sanitizeNotificationIcon(candidate) {
  const fallback = self.location.origin + '/bit-mesra-logo.png?v=4';
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
        '/bit-mesra-logo.png?v=4',
        '/logo.png?v=4',
        '/favicon.png?v=4',
        '/bit-mesra-banner.png?v=4'
      ]);
    }).catch((err) => {
      console.warn('Asset pre-caching skipped:', err);
    })
  );
});

// Purge any and all obsolete caches on activation and claim clients
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

// Primary Push Notification Event Listener (W3C standard - 100% reliable on mobile Chrome, Android & iOS PWA)
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received on device:', event);
  if (!event.data) return;

  event.waitUntil(
    (async () => {
      try {
        let payload = null;
        try {
          payload = event.data.json();
        } catch {
          payload = { notification: { title: 'BIT Mesra Alert', body: event.data.text() } };
        }

        console.log('[SW] Push payload parsed:', payload);

        const title = payload?.notification?.title 
          || payload?.data?.title 
          || 'BIT Mesra Campus Alert';

        const body = payload?.notification?.body 
          || payload?.data?.body 
          || 'New campus update is available.';

        const rawIcon = payload?.notification?.icon || payload?.data?.icon;
        const rawBadge = payload?.notification?.badge || payload?.data?.badge;
        const icon = sanitizeNotificationIcon(rawIcon);
        const badge = sanitizeNotificationIcon(rawBadge);
        const image = payload?.notification?.image || payload?.data?.image || undefined;
        const tag = payload?.data?.tag || ('campus-alert-' + Date.now());
        const targetUrl = payload?.fcmOptions?.link || payload?.data?.url || '/';

        const options = {
          body: body,
          icon: icon,
          badge: badge,
          image: image,
          vibrate: [200, 100, 200, 100, 200], // Haptic vibration on mobile
          tag: tag,
          renotify: true,
          silent: false,
          data: {
            url: targetUrl,
            icon: icon,
            timestamp: Date.now()
          }
        };

        await self.registration.showNotification(title, options);
        console.log('[SW] Notification successfully displayed on mobile/desktop:', title);
      } catch (err) {
        console.error('[SW] Error showing push notification:', err);
      }
    })()
  );
});

// Background message fallback for FCM JS SDK compat
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] FCM onBackgroundMessage callback triggered:', payload);
  const title = payload?.notification?.title || payload?.data?.title || 'BIT Mesra Campus Alert';
  const icon = sanitizeNotificationIcon(payload?.notification?.icon || payload?.data?.icon);
  const badge = sanitizeNotificationIcon(payload?.notification?.badge || payload?.data?.badge);

  self.registration.showNotification(title, {
    body: payload?.notification?.body || payload?.data?.body || 'New announcement available.',
    icon: icon,
    badge: badge,
    image: payload?.notification?.image || payload?.data?.image || undefined,
    vibrate: [200, 100, 200, 100, 200],
    renotify: true,
    tag: payload?.data?.tag || ('campus-alert-' + Date.now()),
    data: {
      url: payload?.fcmOptions?.link || payload?.data?.url || '/',
      icon: icon
    }
  });
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
