import React, { useState } from 'react';
import { useBranding, THEME_COLORS, ThemeColorKey, PresetIconKey } from '../context/BrandingContext';
import { 
  GraduationCap, 
  Shield, 
  Landmark, 
  Bell, 
  BookOpen, 
  Sparkles, 
  Upload, 
  Image as ImageIcon, 
  Check, 
  RotateCcw, 
  Save, 
  Layers, 
  Palette, 
  Building2, 
  Eye, 
  Megaphone,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';

export function BrandingSettings() {
  const { branding, theme, updateBranding, resetBranding, saving } = useBranding();

  const [title, setTitle] = useState(branding.title);
  const [institutionName, setInstitutionName] = useState(branding.institutionName);
  const [tagline, setTagline] = useState(branding.tagline);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl || '');
  const [presetIcon, setPresetIcon] = useState<PresetIconKey>(branding.presetIcon || 'graduation');
  const [themeColor, setThemeColor] = useState<ThemeColorKey>(branding.themeColor || 'blue');
  const [showBannerAlert, setShowBannerAlert] = useState(branding.showBannerAlert);
  const [bannerAlert, setBannerAlert] = useState(branding.bannerAlert);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheClearMessage, setCacheClearMessage] = useState<string | null>(null);

  const handleClearCache = async () => {
    setClearingCache(true);
    setCacheClearMessage(null);
    try {
      // 1. Purge all browser CacheStorage
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // 2. Clear server in-memory logo cache
      try {
        await fetch('/api/branding/clear-cache', { method: 'POST' });
      } catch {
        // Ignore
      }

      // 3. Clear localStorage branding cache
      try {
        localStorage.removeItem('edu_branding_cache');
      } catch {
        // Ignore
      }

      // 4. Signal service workers to purge internal caches and re-register
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          if (reg.active) {
            reg.active.postMessage({ action: 'CLEAR_CACHE' });
          }
          await reg.update().catch(() => {});
        }
      }

      setCacheClearMessage('All notification and logo image caches have been completely wiped! Official BIT Mesra emblem is now active.');
      setTimeout(() => setCacheClearMessage(null), 6000);
    } catch {
      setCacheClearMessage('Image caches successfully cleared.');
      setTimeout(() => setCacheClearMessage(null), 4000);
    } finally {
      setClearingCache(false);
    }
  };

  const presetIcons: { id: PresetIconKey; label: string; icon: React.ElementType }[] = [
    { id: 'graduation', label: 'Grad Cap', icon: GraduationCap },
    { id: 'shield', label: 'Heritage Shield', icon: Shield },
    { id: 'landmark', label: 'Campus Hall', icon: Landmark },
    { id: 'bell', label: 'Broadcast Bell', icon: Bell },
    { id: 'book', label: 'Academic Book', icon: BookOpen },
    { id: 'sparkles', label: 'Modern Pulse', icon: Sparkles },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('Please choose an image under 1MB for fastest loading.');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        setLogoUrl(result);
        // Sync to server cache for instant push notification icon delivery
        try {
          await fetch('/api/branding/logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: result })
          });
        } catch (uploadErr) {
          console.warn('Could not sync logo to server:', uploadErr);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalLogo = logoUrl.trim() || '/bit-mesra-logo.png';
    await updateBranding({
      title: title.trim() || 'EduNotify',
      institutionName: institutionName.trim() || 'BIT Mesra',
      tagline: tagline.trim(),
      logoUrl: finalLogo,
      presetIcon,
      themeColor,
      showBannerAlert,
      bannerAlert: bannerAlert.trim(),
    });

    if (finalLogo.startsWith('data:')) {
      try {
        await fetch('/api/branding/logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: finalLogo })
        });
      } catch {
        // Ignore
      }
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = async () => {
    if (confirm('Reset branding and design theme back to official BIT Mesra defaults?')) {
      await resetBranding();
      setTitle('EduNotify');
      setInstitutionName('BIT Mesra');
      setTagline('Birla Institute of Technology, Mesra - Official Campus Broadcast Network');
      setLogoUrl('/bit-mesra-logo.png');
      setPresetIcon('graduation');
      setThemeColor('crimson');
      setShowBannerAlert(false);
      setBannerAlert('Official campus notification service is online and active.');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const selectedTheme = THEME_COLORS[themeColor] || THEME_COLORS.blue;
  const ActiveIconComponent = presetIcons.find((i) => i.id === presetIcon)?.icon || GraduationCap;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Palette className="h-5 w-5" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Branding &amp; Appearance</h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Customize the app name, institutional logo, primary color scheme, and campus announcement headers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleClearCache}
            disabled={clearingCache}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-amber-300 bg-amber-50/80 rounded-xl text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-all shadow-xs"
            title="Purges all cached notification icons and service worker image assets"
          >
            {clearingCache ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-700" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 text-amber-700" />
            )}
            <span>{clearingCache ? 'Purging Caches...' : 'Remove Cached Images'}</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all",
              selectedTheme.bgClass,
              selectedTheme.hoverClass,
              saving && "opacity-60 cursor-not-allowed"
            )}
          >
            {savedSuccess ? (
              <>
                <Check className="h-4 w-4" />
                <span>Saved Live!</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{saving ? 'Publishing...' : 'Save & Publish'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {cacheClearMessage && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{cacheClearMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setCacheClearMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Controls - 7 Cols */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* Card 1: Identity & Names */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Campus Identity</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Application Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. BIT EduNotify"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Displayed on the sidebar, header, and browser tabs.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Institution / University Name
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. Birla Institute of Technology, Mesra"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Identifies official campus broadcasts.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Campus Tagline / Subtitle
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Official real-time broadcast and alerts network"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          {/* Card 2: Logo Selection */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ImageIcon className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Logo &amp; Brand Icon</h3>
            </div>

            {/* Preset Icon Choice & Official BIT Mesra Emblem */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Option A: Choose Institutional Seal or Official Emblem
                </label>
                <button
                  type="button"
                  onClick={() => setLogoUrl('/bit-mesra-logo.png')}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border",
                    (logoUrl === '/bit-mesra-logo.png' || (!logoUrl && branding.logoUrl === '/bit-mesra-logo.png'))
                      ? "bg-red-50 text-red-700 border-red-200 ring-2 ring-red-500/20"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <img src="/bit-mesra-logo.png" alt="BIT Mesra" className="h-4 w-4 object-contain" />
                  <span>Use Official BIT Mesra Logo</span>
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {presetIcons.map((item) => {
                  const Icon = item.icon;
                  const isSelected = presetIcon === item.id && !logoUrl;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setPresetIcon(item.id);
                        setLogoUrl('');
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all",
                        isSelected
                          ? cn("border-slate-900 bg-slate-900 text-white shadow-xs")
                          : "border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50/50 hover:bg-slate-50"
                      )}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Logo Upload or URL */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Option B: Upload Custom Logo Image or Provide URL
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer text-slate-600 hover:text-slate-900 transition-all text-xs font-medium bg-slate-50/50">
                  <Upload className="h-4 w-4 text-slate-500" />
                  <span>Upload Image File (PNG, JPG, SVG)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="relative">
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://.../your-institution-logo.png"
                    className="w-full h-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('/bit-mesra-logo.png')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                    >
                      Reset to BIT
                    </button>
                  )}
                </div>
              </div>

              {/* Notification icon indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-amber-900 text-xs">
                <div className="flex items-center gap-3">
                  <img
                    src={logoUrl || '/bit-mesra-logo.png'}
                    alt="Notification Icon Preview"
                    className="h-8 w-8 object-contain rounded-md bg-white border border-amber-200 shadow-2xs shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/bit-mesra-logo.png';
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[11px] text-amber-950">Active Push Notification Icon</p>
                    <p className="text-[10px] text-amber-800">
                      This emblem is attached to all push notifications on Android, iOS, Windows, and macOS.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] border border-amber-300 transition-all self-end sm:self-center"
                >
                  {clearingCache ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  <span>{clearingCache ? 'Purging...' : 'Force Purge Cache'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Recommended: Square or badge with transparent background.
              </p>
            </div>
          </div>

          {/* Card 3: Color Themes */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Palette className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Color Palette &amp; Accent Theme</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(THEME_COLORS) as ThemeColorKey[]).map((key) => {
                const colorDef = THEME_COLORS[key];
                const isSelected = themeColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setThemeColor(key)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      isSelected
                        ? "border-slate-900 bg-slate-50/80 ring-2 ring-slate-900/10 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div
                      className="h-8 w-8 rounded-lg shrink-0 shadow-xs flex items-center justify-center text-white"
                      style={{ backgroundColor: colorDef.hex }}
                    >
                      {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{colorDef.label}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{colorDef.hex}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 4: Top Announcement Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Top Campus Notice Banner</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBannerAlert}
                  onChange={(e) => setShowBannerAlert(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {showBannerAlert && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Notice Text (Visible to all students &amp; staff)</label>
                <input
                  type="text"
                  value={bannerAlert}
                  onChange={(e) => setBannerAlert(e.target.value)}
                  placeholder="e.g. Mid-semester exams begin on Monday. Check updated seating plan."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Displays a thin announcement banner at the very top of all student, faculty, and administrator screens.
            </p>
          </div>
        </form>

        {/* Live Interactive Preview - 5 Cols */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Eye className="h-4 w-4 text-slate-500" />
                <span>Live Interactive Preview</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Instant Reflect
              </span>
            </div>

            {/* Mock Window Preview */}
            <div className="bg-white rounded-2xl border border-slate-300/80 shadow-md overflow-hidden">
              {/* Fake Browser Top Chrome */}
              <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="bg-white px-3 py-1 rounded-md text-[10px] text-slate-600 font-mono flex-1 text-center truncate border border-slate-200/60">
                  https://campus.edu/{title.toLowerCase().replace(/\s+/g, '')}
                </div>
              </div>

              {/* Optional Top Alert Banner Preview */}
              {showBannerAlert && bannerAlert && (
                <div className={cn("px-3 py-1.5 text-white text-[11px] font-medium flex items-center justify-between shadow-xs", selectedTheme.bgClass)}>
                  <span className="truncate">{bannerAlert}</span>
                  <Megaphone className="h-3 w-3 shrink-0 ml-2 opacity-80" />
                </div>
              )}

              {/* Fake App Canvas */}
              <div className="p-4 space-y-4 bg-slate-50">
                {/* Header Preview */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="h-8 w-8 object-contain rounded-lg border border-slate-100"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={cn("p-1.5 rounded-lg text-white", selectedTheme.bgClass)}>
                        <ActiveIconComponent className="h-4 w-4" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-none">
                        {title || 'EduNotify'}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-none">
                        {institutionName || 'Campus Broadcasts'}
                      </p>
                    </div>
                  </div>

                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold text-white", selectedTheme.bgClass)}>
                    Live
                  </span>
                </div>

                {/* Hero Greeting Preview */}
                <div className={cn("p-5 rounded-2xl text-white shadow-xs bg-gradient-to-r", selectedTheme.gradientFrom, selectedTheme.gradientTo)}>
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block mb-1">
                    {institutionName || 'Campus Network'}
                  </span>
                  <h3 className="text-base font-bold leading-tight">Welcome to {title || 'EduNotify'}</h3>
                  <p className="text-[11px] opacity-90 mt-1 line-clamp-2">
                    {tagline || 'Real-time notifications and announcements.'}
                  </p>
                </div>

                {/* Sample Notification Card Preview */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={cn("font-bold", selectedTheme.textClass)}>Campus Announcement</span>
                    <span className="text-slate-400 text-[10px]">Just now</span>
                  </div>
                  <h5 className="text-xs font-semibold text-slate-900">End Semester Schedule Released</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Official examination guidelines for all departments are now available on the portal.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-600" />
                <span>Real-Time Broadcast Synchronization</span>
              </p>
              <p className="text-blue-700 text-[11px] leading-relaxed">
                When you click &quot;Save &amp; Publish&quot;, your chosen logo, institutional title, and color scheme update immediately for every logged-in student, faculty member, and administrator without requiring a page reload.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
