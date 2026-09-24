import React from 'react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { GraduationCap, LogOut, Bell, Users, BarChart2, Settings, Menu, X, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
  profile: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, profile, activeTab, setActiveTab }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: BarChart2 },
    { id: 'broadcast', label: 'Broadcast', icon: Send, adminOnly: true },
    { id: 'notifications', label: 'History', icon: Bell },
    { id: 'users', label: 'Students & Staff', icon: Users, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredMenu = menuItems.filter(item => !item.adminOnly || profile?.role === 'admin');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">EduNotify</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
                activeTab === item.id
                  ? "bg-blue-50 text-blue-600 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-2 py-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              {profile?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{profile?.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{profile?.role}</p>
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-slate-900">EduNotify</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-white p-6 animate-in slide-in-from-top duration-300">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold text-slate-900">EduNotify</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)}><X className="h-8 w-8 text-slate-600" /></button>
            </div>
            <nav className="space-y-4">
              {filteredMenu.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3 text-lg font-medium rounded-xl",
                    activeTab === item.id ? "bg-blue-50 text-blue-600" : "text-slate-600"
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-4 px-4 py-3 text-lg font-medium text-red-600"
              >
                <LogOut className="h-6 w-6" />
                Sign Out
              </button>
            </nav>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
