import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, ExternalLink, RefreshCw, CheckCircle2, ShieldAlert, Smartphone, Monitor, Share, PlusSquare } from 'lucide-react';
import { requestForToken, auth, db, getDeviceId, getDeviceType } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useBranding } from '../context/BrandingContext';

export function NotificationPermissionBanner({ compact = false, isAdmin = false }: { compact?: boolean; isAdmin?: boolean }) {
  const { branding } = useBranding();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isIframe, setIsIframe] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [tokenSummary, setTokenSummary] = useState<string | null>(null);
  const [fullToken, setFullToken] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [deviceStats, setDeviceStats] = useState<{ total: number; mobile: number; desktop: number } | null>(null);

  const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const isStandalone = typeof window !== 'undefined' && (('standalone' in window.navigator && Boolean((window.navigator as any).standalone)) || window.matchMedia('(display-mode: standalone)').matches);
  const isMobile = getDeviceType() === 'mobile';

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

    // If already granted and user is logged in, load device tokens
    if (Notification.permission === 'granted' && auth.currentUser) {
      const deviceId = getDeviceId();
      const specificRef = doc(db, 'fcmTokens', `${auth.currentUser.uid}_${deviceId}`);
      
      getDoc(specificRef).then(snap => {
        if (snap.exists() && snap.data().token) {
          const t = snap.data().token;
          setFullToken(t);
          setTokenSummary(`${t.slice(0, 10)}...${t.slice(-6)}`);
        } else {
          // Check primary ref
          getDoc(doc(db, 'fcmTokens', auth.currentUser!.uid)).then(primarySnap => {
            if (primarySnap.exists() && primarySnap.data().token) {
              const t = primarySnap.data().token;
              setFullToken(t);
              setTokenSummary(`${t.slice(0, 10)}...${t.slice(-6)}`);
            }
          });
        }
      }).catch(err => {
        console.warn('Could not read user fcm token:', err);
      });

      // Count registered devices for this user
      try {
        const q = query(collection(db, 'fcmTokens'), where('uid', '==', auth.currentUser.uid));
        getDocs(q).then(docsSnap => {
          let mob = 0;
          let desk = 0;
          const seenTokens = new Set<string>();
          docsSnap.forEach(d => {
            const data = d.data();
            if (data.token && !seenTokens.has(data.token)) {
              seenTokens.add(data.token);
              if (data.deviceType === 'mobile' || /Android|iPhone|iPad/i.test(data.userAgent || '')) {
                mob++;
              } else {
                desk++;
              }
            }
          });
          if (seenTokens.size > 0) {
            setDeviceStats({ total: seenTokens.size, mobile: mob, desktop: desk });
          }
        }).catch(() => {
          // Rule may limit query, ignore silently
        });
      } catch {
        // Ignore
      }
    }
  }, []);

  const handleEnableNotifications = async () => {
    setIsRegistering(true);
    setTestStatus(null);
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : undefined;
      const t = await requestForToken(reg);
      if (t) {
        setFullToken(t);
        setTokenSummary(`${t.slice(0, 10)}...${t.slice(-6)}`);
        setPermission('granted');
        setTestStatus('Device registered successfully! Tap "Send Quick Test" to verify.');
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
    setTestStatus('Sending test notification...');
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${branding.institutionName || 'BIT Mesra'} Broadcast Test`,
          body: `Verification alert received at ${new Date().toLocaleTimeString()} on ${isMobile ? 'Mobile' : 'Desktop'}!`,
          icon: branding.logoUrl || '/bit-mesra-logo.png?v=4',
          badge: branding.logoUrl || '/bit-mesra-logo.png?v=4',
          tokens: fullToken ? [fullToken] : [],
          testToken: fullToken || undefined,
        }),
      });

      const contentType = res.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 404) {
          throw new Error('API route /api/broadcast is not active on this deployment (404). Please ensure the latest files are deployed.');
        }
        throw new Error(text.slice(0, 120) || `HTTP error ${res.status}`);
      }

      if (res.ok) {
        setTestStatus(`Delivered to ${data.sentCount || 1} device(s) (Mobile: ${data.mobileCount || 0}, Desktop: ${data.desktopCount || 0})`);
      } else {
        setTestStatus(`Failed: ${data.details || data.error || 'Check server credentials'}`);
      }
    } catch (err: any) {
      setTestStatus(`Error: ${err.message}`);
    }
  };

  // Unsupported browser check
  if (permission === 'unsupported') {
    if (isIOS && !isStandalone) {
      return (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-700 shrink-0 mt-0.5">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">Enable Mobile Notifications on iOS (iPhone/iPad)</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apple requires web applications to be added to your device Home Screen to deliver background push notifications.
              </p>
              <div className="bg-white/80 p-3 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-1.5 mt-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Share className="h-4 w-4 text-blue-600" />
                  <span>1. Tap the Share button in Safari (at the bottom/top of the screen)</span>
                </div>
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <PlusSquare className="h-4 w-4 text-blue-600" />
                  <span>2. Scroll down and tap &quot;Add to Home Screen&quot;</span>
                </div>
                <p className="text-slate-600 text-[11px] pl-6">
                  3. Open the &quot;EduNotify&quot; icon from your Home Screen and tap &quot;Allow Notifications&quot;.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <span>Push notifications are not supported by this browser. Please use Chrome on Android, or Safari on iOS (added to Home Screen).</span>
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
              Modern web browsers <strong>block notification prompts inside embedded iframes</strong>. To register this device and test mobile/desktop push alerts, open the app directly in a browser tab.
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
              Your browser has notifications set to <strong>Blocked</strong> on this {isMobile ? 'mobile device' : 'computer'}.
            </p>
          </div>
        </div>

        <div className="bg-white/80 p-4 rounded-xl border border-red-100 text-xs text-slate-700 space-y-2">
          <p className="font-semibold text-slate-900 flex items-center gap-1.5">
            <span>👉 How to unblock in 10 seconds:</span>
          </p>
          {isMobile ? (
            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-normal pl-1">
              <li>Tap the <strong>Padlock (🔒)</strong> or <strong>Site Settings icon</strong> next to the URL at the top.</li>
              <li>Tap <strong>Permissions</strong> ➔ <strong>Notifications</strong>.</li>
              <li>Select <strong>Allow</strong>.</li>
              <li>Also ensure your phone settings have allowed notifications for Chrome/Browser.</li>
              <li>Tap the reload button below.</li>
            </ol>
          ) : (
            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-normal pl-1">
              <li>Click the <strong>Tune / Sliders (🎚️)</strong> or <strong>Padlock (🔒)</strong> icon immediately to the left of the website URL.</li>
              <li>Find <strong>Notifications</strong> and change it from <em>&quot;Block&quot;</em> to <strong>&quot;Allow&quot;</strong>.</li>
              <li>Click the reload button below.</li>
            </ol>
          )}
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
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  {isMobile ? 'Mobile Notifications Active' : 'Desktop Notifications Active'}
                </h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {isMobile ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                  {isMobile ? 'Phone / Tablet' : 'Desktop'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                This {isMobile ? 'mobile device' : 'computer'} will receive real-time campus broadcasts with sound and vibration.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
            READY
          </span>
        </div>

        {deviceStats && (
          <div className="flex items-center gap-3 text-xs bg-emerald-100/50 px-3 py-1.5 rounded-lg border border-emerald-200/60 text-emerald-900">
            <span className="font-semibold">Your Registered Devices:</span>
            <span className="flex items-center gap-1">
              <Monitor className="h-3.5 w-3.5 text-slate-600" /> {deviceStats.desktop} Desktop
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Smartphone className="h-3.5 w-3.5 text-slate-600" /> {deviceStats.mobile} Mobile
            </span>
          </div>
        )}

        {tokenSummary && (
          <div className="bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Device FCM Token:</span>
            <span className="text-slate-700 font-bold">{tokenSummary}</span>
          </div>
        )}

        {(isAdmin || isMobile || fullToken) && (
          <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
            <span className="text-[11px] text-slate-500">
              {testStatus ? <strong className="text-blue-600">{testStatus}</strong> : `Test push delivery on this ${isMobile ? 'phone' : 'computer'}:`}
            </span>
            <button
              onClick={handleSendTestPush}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Bell className="h-3.5 w-3.5" />
              <span>{isMobile ? 'Test This Phone' : 'Send Quick Test'}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // 4. Default: User hasn't enabled yet
  return (
    <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-2.5 bg-blue-100 rounded-2xl text-blue-600 shrink-0">
          {isMobile ? <Smartphone className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900">
              {isMobile ? 'Enable Mobile Push Notifications' : 'Enable Push Notifications'}
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
              {isMobile ? 'Mobile Device' : 'Desktop'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMobile 
              ? 'Receive immediate vibration and sound alerts on your phone whenever the admin broadcasts.' 
              : 'Receive instant alerts for urgent announcements, class schedules, and deadlines on this computer.'}
          </p>
        </div>
      </div>
      <button
        onClick={handleEnableNotifications}
        disabled={isRegistering}
        className="shrink-0 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Bell className="h-3.5 w-3.5" />
        <span>{isRegistering ? 'Registering Device...' : `Allow on ${isMobile ? 'Mobile' : 'Computer'}`}</span>
      </button>
    </div>
  );
}
