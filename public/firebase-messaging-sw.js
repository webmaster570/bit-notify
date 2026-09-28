importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Fast service worker lifecycle activation (vital for mobile browsers) & pre-caching branding assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open('edunotify-branding-v1').then((cache) => {
      return cache.addAll([
        '/bit-mesra-logo.png',
        '/logo.png',
        '/favicon.png',
        '/bit-mesra-banner.png'
      ]);
    }).catch((err) => {
      console.warn('Asset pre-caching skipped:', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
  
  // Display the uploaded or official BIT Mesra emblem icon
  const notificationIcon = payload?.notification?.icon || payload?.data?.icon || '/bit-mesra-logo.png';
  const notificationBadge = payload?.notification?.badge || payload?.data?.badge || '/bit-mesra-logo.png';

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
      const notificationIcon = rawData.data.icon || '/bit-mesra-logo.png';
      const notificationBadge = rawData.data.badge || '/bit-mesra-logo.png';
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
