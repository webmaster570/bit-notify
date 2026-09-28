/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthView } from './components/AuthView';
import { AdminDashboard } from './components/AdminDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { Loader2 } from 'lucide-react';
import { requestForToken, messaging } from './lib/firebase';
import { onMessage } from 'firebase/messaging';
import { useBranding } from './context/BrandingContext';

export default function App() {
  const { user, profile, loading, error } = useAuth();
  const { branding } = useBranding();
  const [foregroundAlert, setForegroundAlert] = useState<{ title: string; body: string; icon: string } | null>(null);

  useEffect(() => {
    // Automatically purge old cacheStorage versions on client startup
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          if (name !== 'edunotify-branding-v4') {
            console.log('[App] Purged old cacheStorage:', name);
            caches.delete(name);
          }
        });
      }).catch(() => {});
    }

    if (user) {
      console.log('User detected, initializing notifications for:', user.email);
      
      // Explicitly register service worker with version query to prevent HTTP caching of SW script
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js?v=4')
          .then(async (registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
            registration.update().catch(() => {});

            // Ensure worker is in ready/active state before requesting token
            const activeReg = await navigator.serviceWorker.ready;
            
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              return requestForToken(activeReg);
            }
            return null;
          })
          .then(token => {
            if (token) {
              console.log('Notification registration successful for:', user.email);
            } else {
              console.warn('Notification registration pending permission for:', user.email);
            }
          })
          .catch(err => {
            console.error('Critical error in service worker/notification setup:', err);
          });
      }
      
      // Keep listening for foreground messages
      if (messaging) {
        const unsubscribe = onMessage(messaging, (payload) => {
          console.log('Foreground message received on mobile/desktop:', payload);

          const title = payload.notification?.title || payload.data?.title || `${branding.institutionName || 'BIT Mesra'} Alert`;
          const bodyText = payload.notification?.body || payload.data?.body || 'New announcement available.';
          
          let iconUrl = payload.notification?.icon || payload.data?.icon;
          if (!iconUrl || iconUrl.includes('flaticon') || iconUrl.includes('3135823')) {
            iconUrl = branding.logoUrl || '/bit-mesra-logo.png?v=4';
          }
          let badgeUrl = (payload.notification as any)?.badge || payload.data?.badge;
          if (!badgeUrl || badgeUrl.includes('flaticon') || badgeUrl.includes('3135823')) {
            badgeUrl = branding.logoUrl || '/bit-mesra-logo.png?v=4';
          }

          // Trigger mobile vibration if supported
          try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([200, 100, 200, 100, 200]);
            }
          } catch {}

          // Display in-app banner for instant visibility on phone screen
          setForegroundAlert({
            title,
            body: bodyText,
            icon: iconUrl
          });
          setTimeout(() => setForegroundAlert(null), 8000);
          
          // Show OS browser notification if permitted
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const options: any = {
              body: bodyText,
              icon: iconUrl,
              badge: badgeUrl,
              image: (payload.notification as any)?.image || payload.data?.image || undefined,
              vibrate: [200, 100, 200, 100, 200],
              tag: payload.data?.tag || ('edu-notify-' + Date.now()),
              renotify: true,
              data: {
                url: payload.data?.url || '/',
                icon: iconUrl
              }
            };
            
            // Prefer showing via active Service Worker registration
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
              }).catch(() => {
                try {
                  new Notification(title, options);
                } catch {}
              });
            } else {
              try {
                new Notification(title, options);
              } catch {}
            }
          }
        });
        return () => unsubscribe();
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-slate-500 text-sm animate-pulse text-center px-4">Connecting to EduNotify services...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 max-w-md">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  // Active user profile (guaranteed fallback from useAuth)
  const activeProfile = profile || {
    uid: user.uid,
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'User',
    role: (user.email?.includes('admin') || user.email?.includes('webmaster') ? 'admin' : 'student') as 'admin' | 'student',
    department: 'All',
    academicYear: 'All',
    course: 'All'
  };

  return (
    <>
      {foregroundAlert && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-start gap-3.5 animate-in slide-in-from-top-4 duration-300">
          <img
            src={foregroundAlert.icon}
            alt="BIT Mesra Alert"
            className="h-10 w-10 object-contain rounded-xl bg-white/10 p-1 shrink-0 border border-white/20"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/bit-mesra-logo.png?v=4';
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-white truncate">{foregroundAlert.title}</h4>
              <button
                onClick={() => setForegroundAlert(null)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300 mt-1 line-clamp-2">{foregroundAlert.body}</p>
          </div>
        </div>
      )}
      {(activeProfile.role === 'admin' || activeProfile.role === 'push_admin') ? (
        <AdminDashboard profile={activeProfile} />
      ) : (
        <StudentDashboard profile={activeProfile} />
      )}
    </>
  );
}

