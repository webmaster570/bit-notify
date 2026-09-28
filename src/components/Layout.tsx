import React from 'react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { 
  GraduationCap, 
  Shield, 
  Landmark, 
  Bell, 
  BookOpen, 
  Sparkles, 
  LogOut, 
  Users, 
  BarChart2, 
  Palette, 
  Menu, 
  X, 
  Send,
  Megaphone
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../hooks/useAuth';
import { useBranding } from '../context/BrandingContext';

interface LayoutProps {
  children: React.ReactNode;
  profile: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, profile, activeTab, setActiveTab }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { branding, theme } = useBranding();

  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: BarChart2 },
    { id: 'broadcast', label: 'Broadcast', icon: Send, adminOnly: true },
    { id: 'notifications', label: 'History', icon: Bell },
    { id: 'users', label: 'Students & Staff', icon: Users, adminOnly: true },
    { id: 'branding', label: 'Branding & Design', icon: Palette, adminOnly: true },
  ];

  const filteredMenu = menuItems.filter(item => !item.adminOnly || profile?.role === 'admin');

  // Render chosen branding icon or custom image
  const renderLogoIcon = (sizeClass: string = "h-5 w-5") => {
    if (branding.logoUrl) {
      return (
        <img
          src={branding.logoUrl}
          alt={branding.title}
          className="h-8 w-8 object-contain rounded-lg"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }

    switch (branding.presetIcon) {
      case 'shield':
        return <Shield className={sizeClass} />;
      case 'landmark':
        return <Landmark className={sizeClass} />;
      case 'bell':
        return <Bell className={sizeClass} />;
      case 'book':
        return <BookOpen className={sizeClass} />;
      case 'sparkles':
        return <Sparkles className={sizeClass} />;
      case 'graduation':
      default:
        return <GraduationCap className={sizeClass} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Optional Top Announcement Bar (Visible across campus) */}
      {branding.showBannerAlert && branding.bannerAlert && (
        <div className={cn("px-4 py-2 text-white text-xs font-medium flex items-center justify-center gap-2 shadow-xs shrink-0 transition-all", theme.bgClass)}>
          <Megaphone className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          <span className="truncate">{branding.bannerAlert}</span>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0">
          <div className="p-6 flex items-center gap-3">
            <div className={cn("p-2 rounded-xl text-white shadow-xs", theme.bgClass)}>
              {renderLogoIcon("h-6 w-6 text-white")}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-lg font-bold text-slate-900 tracking-tight block truncate">
                {branding.title || 'EduNotify'}
              </span>
              <p className="text-[11px] text-slate-500 truncate font-medium">
                {branding.institutionName || 'Campus Broadcasts'}
              </p>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1 mt-2">
            {filteredMenu.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150",
                    isActive
                      ? cn(theme.lightBgClass, theme.textClass, "shadow-2xs")
                      : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? theme.textClass : "text-slate-500")} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200/80">
            <div className="flex items-center gap-3 px-2 py-3 mb-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0", theme.bgClass)}>
                {profile?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{profile?.name}</p>
                <p className="text-[10px] text-slate-500 truncate capitalize">
                  {profile?.department && profile.department !== 'All' ? `${profile.department} · ` : ''}
                  {profile?.role}
                </p>
              </div>
            </div>

            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile Header */}
          <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={cn("p-1.5 rounded-lg text-white", theme.bgClass)}>
                {renderLogoIcon("h-4 w-4")}
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 block leading-tight">
                  {branding.title || 'EduNotify'}
                </span>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  {branding.institutionName}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </header>

          {/* Mobile Menu Drawer */}
          {isMobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-white p-6 flex flex-col animate-in slide-in-from-top duration-200">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-2 rounded-xl text-white", theme.bgClass)}>
                    {renderLogoIcon("h-5 w-5")}
                  </div>
                  <div>
                    <span className="text-base font-bold text-slate-900 block">{branding.title || 'EduNotify'}</span>
                    <span className="text-xs text-slate-500 block">{branding.institutionName}</span>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5 text-slate-600" />
                </button>
              </div>

              <nav className="space-y-2 flex-1">
                {filteredMenu.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl",
                      activeTab === item.id
                        ? cn(theme.lightBgClass, theme.textClass)
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <button
                onClick={() => signOut(auth)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-red-600 bg-red-50 rounded-xl"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Main Content Body */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
