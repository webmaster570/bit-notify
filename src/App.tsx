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

export default function App() {
  const { user, profile, loading, error } = useAuth();

  useEffect(() => {
    if (user) {
      console.log('User detected, initializing notifications for:', user.email);
      
      // Explicitly register service worker for broader compatibility
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
          .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
            
            // Only auto-fetch token if browser permission is already granted.
            // Never invoke Notification.requestPermission() automatically on page load,
            // as modern browsers automatically block/deny permission prompts without user gesture.
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              return requestForToken(registration);
            }
            return null;
          })
          .then(token => {
            if (token) {
              console.log('Notification registration successful for:', user.email);
            } else {
              console.warn('Notification registration failed or was denied for:', user.email);
            }
          })
          .catch(err => {
            console.error('Critical error in service worker/notification setup:', err);
          });
      }
      
      // Keep listening for foreground messages
      if (messaging) {
        const unsubscribe = onMessage(messaging, (payload) => {
          console.log('Foreground message received:', payload);
          
          // Show browser notification if permitted
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const title = payload.notification?.title || payload.data?.title || 'EduNotify Campus Alert';
            const options: any = {
              body: payload.notification?.body || payload.data?.body || 'New announcement available.',
              icon: payload.notification?.icon || 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
              badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
              // Vibration pattern for mobile
              vibrate: [200, 100, 200, 100, 200],
              tag: payload.data?.tag || ('edu-notify-' + Date.now()),
              renotify: true,
              data: {
                url: payload.data?.url || '/'
              }
            };
            
            // Prefer showing via active Service Worker registration
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
              }).catch(() => {
                try {
                  new Notification(title, options);
                } catch {
                  // Ignore
                }
              });
            } else {
              try {
                new Notification(title, options);
              } catch {
                // Ignore
              }
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

  if (activeProfile.role === 'admin') {
    return <AdminDashboard profile={activeProfile} />;
  }

  return <StudentDashboard profile={activeProfile} />;
}

