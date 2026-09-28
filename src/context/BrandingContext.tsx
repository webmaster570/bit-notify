import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

export type ThemeColorKey = 'blue' | 'crimson' | 'emerald' | 'indigo' | 'amber' | 'violet' | 'slate';
export type PresetIconKey = 'graduation' | 'shield' | 'landmark' | 'bell' | 'book' | 'sparkles';

export interface ThemeColorDefinition {
  id: ThemeColorKey;
  label: string;
  hex: string;
  badge: string;
  bgClass: string;
  hoverClass: string;
  textClass: string;
  lightBgClass: string;
  borderClass: string;
  gradientFrom: string;
  gradientTo: string;
}

export const THEME_COLORS: Record<ThemeColorKey, ThemeColorDefinition> = {
  blue: {
    id: 'blue',
    label: 'Royal Blue (Tech & Campus)',
    hex: '#2563eb',
    badge: 'bg-blue-600',
    bgClass: 'bg-blue-600',
    hoverClass: 'hover:bg-blue-700',
    textClass: 'text-blue-600',
    lightBgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    gradientFrom: 'from-blue-600',
    gradientTo: 'to-indigo-700',
  },
  crimson: {
    id: 'crimson',
    label: 'BIT Crimson (Academic Heritage)',
    hex: '#991b1b',
    badge: 'bg-red-800',
    bgClass: 'bg-red-800',
    hoverClass: 'hover:bg-red-900',
    textClass: 'text-red-800',
    lightBgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    gradientFrom: 'from-red-800',
    gradientTo: 'to-rose-900',
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald Green (Campus Life)',
    hex: '#059669',
    badge: 'bg-emerald-600',
    bgClass: 'bg-emerald-600',
    hoverClass: 'hover:bg-emerald-700',
    textClass: 'text-emerald-600',
    lightBgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    gradientFrom: 'from-emerald-600',
    gradientTo: 'to-teal-700',
  },
  indigo: {
    id: 'indigo',
    label: 'Deep Indigo (Collegiate Modern)',
    hex: '#4f46e5',
    badge: 'bg-indigo-600',
    bgClass: 'bg-indigo-600',
    hoverClass: 'hover:bg-indigo-700',
    textClass: 'text-indigo-600',
    lightBgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    gradientFrom: 'from-indigo-600',
    gradientTo: 'to-purple-700',
  },
  amber: {
    id: 'amber',
    label: 'Collegiate Gold (Distinction)',
    hex: '#d97706',
    badge: 'bg-amber-600',
    bgClass: 'bg-amber-600',
    hoverClass: 'hover:bg-amber-700',
    textClass: 'text-amber-600',
    lightBgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    gradientFrom: 'from-amber-600',
    gradientTo: 'to-orange-700',
  },
  violet: {
    id: 'violet',
    label: 'Cyber Violet (Innovation)',
    hex: '#7c3aed',
    badge: 'bg-violet-600',
    bgClass: 'bg-violet-600',
    hoverClass: 'hover:bg-violet-700',
    textClass: 'text-violet-600',
    lightBgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
    gradientFrom: 'from-violet-600',
    gradientTo: 'to-fuchsia-700',
  },
  slate: {
    id: 'slate',
    label: 'Obsidian Minimal (Executive)',
    hex: '#18181b',
    badge: 'bg-zinc-900',
    bgClass: 'bg-zinc-900',
    hoverClass: 'hover:bg-black',
    textClass: 'text-zinc-900',
    lightBgClass: 'bg-zinc-100',
    borderClass: 'border-zinc-300',
    gradientFrom: 'from-zinc-900',
    gradientTo: 'to-slate-800',
  },
};

export interface BrandingConfig {
  title: string;
  institutionName: string;
  tagline: string;
  logoUrl: string;
  presetIcon: PresetIconKey;
  themeColor: ThemeColorKey;
  bannerAlert: string;
  showBannerAlert: boolean;
  accentColorHex?: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  title: 'EduNotify',
  institutionName: 'BIT Mesra',
  tagline: 'Birla Institute of Technology, Mesra - Official Campus Broadcast Network',
  logoUrl: '/bit-mesra-logo.png',
  presetIcon: 'graduation',
  themeColor: 'crimson',
  bannerAlert: 'Official campus notification service is online and active.',
  showBannerAlert: false,
};

interface BrandingContextType {
  branding: BrandingConfig;
  theme: ThemeColorDefinition;
  updateBranding: (newConfig: Partial<BrandingConfig>) => Promise<void>;
  resetBranding: () => Promise<void>;
  saving: boolean;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('edu_branding_cache');
        if (cached) return { ...DEFAULT_BRANDING, ...JSON.parse(cached) };
      } catch {
        // Ignore cache parse error
      }
    }
    return DEFAULT_BRANDING;
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Listen to Firestore for live real-time sync across all users and devices
    const unsub = onSnapshot(
      doc(db, 'settings', 'branding'),
      (docSnap) => {
        if (docSnap.exists()) {
          const remote = docSnap.data() as Partial<BrandingConfig>;
          setBranding((prev) => {
            const next = { ...prev, ...remote };
            try {
              localStorage.setItem('edu_branding_cache', JSON.stringify(next));
            } catch {
              // Ignore
            }
            return next;
          });
        }
      },
      (err) => {
        console.warn('Could not read real-time branding (using cache/default):', err);
      }
    );

    return () => unsub();
  }, []);

  // Sync document title, favicon, and apple-touch-icon
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const pageTitle = branding.title 
        ? `${branding.title} | ${branding.institutionName || 'BIT Mesra'}`
        : 'EduNotify | BIT Mesra';
      document.title = pageTitle;

      const activeIcon = branding.logoUrl || '/bit-mesra-logo.png';
      
      let linkIcon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!linkIcon) {
        linkIcon = document.createElement('link');
        linkIcon.rel = 'icon';
        document.head.appendChild(linkIcon);
      }
      linkIcon.href = activeIcon;

      let linkApple = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
      if (!linkApple) {
        linkApple = document.createElement('link');
        linkApple.rel = 'apple-touch-icon';
        document.head.appendChild(linkApple);
      }
      linkApple.href = activeIcon;
    }
  }, [branding.title, branding.institutionName, branding.logoUrl]);

  const updateBranding = async (newConfig: Partial<BrandingConfig>) => {
    setSaving(true);
    try {
      const merged: BrandingConfig = {
        ...branding,
        ...newConfig,
      };

      setBranding(merged);
      try {
        localStorage.setItem('edu_branding_cache', JSON.stringify(merged));
      } catch {
        // Ignore
      }

      await setDoc(doc(db, 'settings', 'branding'), {
        ...merged,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } finally {
      setSaving(false);
    }
  };

  const resetBranding = async () => {
    setSaving(true);
    try {
      setBranding(DEFAULT_BRANDING);
      await setDoc(doc(db, 'settings', 'branding'), {
        ...DEFAULT_BRANDING,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSaving(false);
    }
  };

  const currentTheme = THEME_COLORS[branding.themeColor] || THEME_COLORS.blue;

  return (
    <BrandingContext.Provider
      value={{
        branding,
        theme: currentTheme,
        updateBranding,
        resetBranding,
        saving,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
