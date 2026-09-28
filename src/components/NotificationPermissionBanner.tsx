import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, ExternalLink, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { requestForToken, auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

export function NotificationPermissionBanner({ compact = false }: { compact?: boolean }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isIframe, setIsIframe] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [tokenSummary, setTokenSummary] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running inside iframe
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }

    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);

    // If already granted and user is logged in, check if token is registered in Firestore
    if (Notification.permission === 'granted' && auth.currentUser) {
      getDoc(doc(db, 'fcmTokens', auth.currentUser.uid)).then(snap => {
        if (snap.exists() && snap.data().token) {
          const t = snap.data().token;
          setTokenSummary(`${t.slice(0, 10)}...${t.slice(-6)}`);
        }
      }).catch(err => {
        console.warn('Could not read user fcm token:', err);
      });
    }
  }, []);

  const handleEnableNotifications = async () => {
    setIsRegistering(true);
    setTestStatus(null);
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : undefined;
      const t = await requestForToken(reg);
      if (t) {
        setTokenSummary(`${t.slice(0, 10)}...${t.slice(-6)}`);
        setPermission('granted');
      } else {
        setPermission(Notification.permission);
      }
    } catch (err) {
      console.error('Error enabling notifications:', err);
      setPermission(Notification.permission);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestStatus('Sending...');
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'EduNotify Test Alert',
          body: `Verification test received at ${new Date().toLocaleTimeString()}! Push notification is operational.`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestStatus(`Delivered to ${data.sentCount || 0} device(s)`);
      } else {
        setTestStatus(`Failed: ${data.details || data.error || 'Check server credentials'}`);
      }
    } catch (err: any) {
      setTestStatus(`Error: ${err.message}`);
    }
  };

  if (permission === 'unsupported') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <span>Push notifications are not supported by this browser. Please use Chrome, Edge, Firefox, or Safari on iOS 16.4+ (added to Home Screen).</span>
      </div>
    );
  }

  // 1. Running inside AI Studio preview iframe
  if (isIframe) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">Preview Window Detected</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-800">
                Browser Security Limit
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Modern web browsers (Chrome, Edge, Safari) <strong>forbid notification permissions inside embedded iframes</strong>. To register this device and receive real push popups, open the application directly in a separate browser tab.
            </p>
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <a
            href={typeof window !== 'undefined' ? window.location.href : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all shadow-sm"
          >
            <span>Open in Dedicated Tab</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // 2. Permission is Denied by the browser
  if (permission === 'denied') {
    return (
      <div className="bg-red-50/80 border border-red-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-xl text-red-600 shrink-0 mt-0.5">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Push Notifications Blocked</h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                PERMISSION DENIED
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your web browser has set notifications to <strong>Blocked</strong> for this website URL. Websites cannot override this security setting automatically.
            </p>
          </div>
        </div>

        <div className="bg-white/80 p-4 rounded-xl border border-red-100 text-xs text-slate-700 space-y-2">
          <p className="font-semibold text-slate-900 flex items-center gap-1.5">
            <span>👉 How to unblock in 10 seconds:</span>
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-normal pl-1">
            <li>Look at your browser&apos;s address bar at the very top of your screen.</li>
            <li>
              Click the <strong>Tune / Sliders (🎚️)</strong> or <strong>Padlock (🔒)</strong> icon immediately to the left of the website URL.
            </li>
            <li>
              Find <strong>Notifications</strong> and change it from <em>&quot;Block&quot;</em> to <strong>&quot;Allow&quot;</strong> (or click <em>&quot;Reset permissions&quot;</em>).
            </li>
            <li>Click the reload button below.</li>
          </ol>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload Page &amp; Re-check</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Permission is Granted and Active
  if (permission === 'granted') {
    return (
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Push Notifications Active</h4>
              <p className="text-[11px] text-slate-500">This device is registered to receive campus alerts.</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            REGISTERED
          </span>
        </div>

        {tokenSummary && (
          <div className="bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Device Token:</span>
            <span className="text-slate-700 font-bold">{tokenSummary}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-500">
            {testStatus ? <strong className="text-blue-600">{testStatus}</strong> : 'Test delivery on this device:'}
          </span>
          <button
            onClick={handleSendTestPush}
            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all"
          >
            Send Quick Test
          </button>
        </div>
      </div>
    );
  }

  // 4. Default: User hasn't enabled yet
  return (
    <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-2.5 bg-blue-100 rounded-2xl text-blue-600 shrink-0">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">Enable Push Notifications</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Receive instant alerts for urgent announcements, class schedules, and deadlines.
          </p>
        </div>
      </div>
      <button
        onClick={handleEnableNotifications}
        disabled={isRegistering}
        className="shrink-0 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Bell className="h-3.5 w-3.5" />
        <span>{isRegistering ? 'Registering...' : 'Allow Notifications'}</span>
      </button>
    </div>
  );
}
