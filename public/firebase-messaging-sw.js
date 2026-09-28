importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Fast service worker lifecycle activation (vital for mobile browsers)
self.addEventListener('install', (event) => {
  self.skipWaiting();
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

// Handle background messages with rich mobile support (vibration, badge, renotify)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload?.notification?.title || payload?.data?.title || 'EduNotify Campus Alert';
  const notificationOptions = {
    body: payload?.notification?.body || payload?.data?.body || 'New announcement available.',
    icon: payload?.notification?.icon || 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
    badge: payload?.notification?.badge || 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
    // Mobile specific haptics & presentation
    vibrate: [200, 100, 200, 100, 200],
    renotify: true,
    requireInteraction: true,
    tag: payload?.data?.tag || ('campus-alert-' + (payload?.data?.timestamp || Date.now())),
    silent: false,
    data: {
      url: payload?.fcmOptions?.link || payload?.data?.url || '/'
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
      const title = rawData.data.title || 'EduNotify Campus Alert';
      const options = {
        body: rawData.data.body || 'New campus update.',
        icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
        vibrate: [200, 100, 200, 100, 200],
        renotify: true,
        requireInteraction: true,
        tag: rawData.data.tag || ('campus-alert-' + Date.now()),
        data: { url: rawData.data.url || '/' }
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
