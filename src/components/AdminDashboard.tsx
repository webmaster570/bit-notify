import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Layout } from './Layout';
import { NotificationForm } from './NotificationForm';
import { NotificationList } from './NotificationList';
import { UserProfile } from '../hooks/useAuth';
import { format } from 'date-fns';
import { Users, Bell, TrendingUp, CheckCircle2, Send, Palette, Plus, ArrowRight, Clock, Megaphone } from 'lucide-react';
import { UserManagement } from './UserManagement';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';
import { BrandingSettings } from './BrandingSettings';
import { useBranding } from '../context/BrandingContext';
import { cn } from '../lib/utils';

export function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
  
  const isSuperAdmin = profile.role === 'admin';
  const isPushAdmin = profile.role === 'push_admin';

  // For push admins, only show their own notifications
  const [notifsQuery] = useState(() => {
    const baseQuery = collection(db, 'notifications');
    if (isPushAdmin) {
      return query(
        baseQuery, 
        where('createdBy', '==', auth.currentUser?.uid || 'none'),
        orderBy('createdAt', 'desc'), 
        limit(50)
      );
    }
    return query(baseQuery, orderBy('createdAt', 'desc'), limit(50));
  });

  const [notifications, loadingNotifs] = useCollection(notifsQuery);
  const [usersQuery] = useState(query(collection(db, 'users'), limit(100)));
  const [users] = useCollection(usersQuery);

  const { branding, theme } = useBranding();

  const handleEditDraft = (id: string) => {
    setEditingNotificationId(id);
    setActiveTab('broadcast');
  };

  const handleBroadcastSuccess = () => {
    setEditingNotificationId(null);
    setActiveTab('notifications');
  };

  const totalUsers = users?.size || 0;
  const sentNotifications = notifications?.docs.filter(d => d.data().status === 'sent').length || 0;
  const scheduledNotifications = notifications?.docs.filter(d => d.data().status === 'scheduled').length || 0;
  const totalBroadcasts = notifications?.size || 0;

  const stats = [
    { label: 'Campus Members', value: totalUsers, icon: Users, subtext: 'Registered students & staff' },
    { label: isPushAdmin ? 'Your Broadcasts' : 'Total Broadcasts', value: totalBroadcasts, icon: Bell, subtext: 'Historical alerts created' },
    { label: 'Delivered Alerts', value: sentNotifications, icon: TrendingUp, subtext: 'Dispatched in real-time' },
    { label: 'Scheduled Queue', value: scheduledNotifications, icon: CheckCircle2, subtext: 'Pending auto-dispatch' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8 max-w-7xl mx-auto">
            {/* Campus Header Banner */}
            <div className={cn(
              "rounded-3xl p-8 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gradient-to-r",
              theme.gradientFrom,
              theme.gradientTo
            )}>
              <div className="space-y-1.5 max-w-xl">
                <span className="text-[11px] uppercase font-bold tracking-widest opacity-80">
                  {isPushAdmin ? 'Push Notification Administrator' : (branding.institutionName || 'Administrative Console')}
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Welcome back, {profile.name}
                </h2>
                <p className="text-sm opacity-90 leading-relaxed">
                  {isPushAdmin 
                    ? 'Dispatch real-time announcements, schedule broadcasts, and monitor delivery across mobile and desktop devices.'
                    : (branding.tagline || 'Manage real-time campus broadcasts, students, and appearance.')}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab('broadcast')}
                  className="px-5 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all shadow-xs flex items-center gap-2"
                >
                  <Plus className="h-4 w-4 text-blue-600" />
                  <span>New Broadcast</span>
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => setActiveTab('branding')}
                    className="px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-2"
                  >
                    <Palette className="h-4 w-4" />
                    <span>Customize Design</span>
                  </button>
                )}
              </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500">{stat.label}</span>
                    <div className={cn("p-2 rounded-xl", theme.lightBgClass)}>
                      <stat.icon className={cn("h-4 w-4", theme.textClass)} />
                    </div>
                  </div>
                  <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</h4>
                  <p className="text-[11px] text-slate-400 mt-1">{stat.subtext}</p>
                </div>
              ))}
            </div>

            {/* Main Split Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Quick Actions & Recent Broadcasts - 2 Cols */}
              <div className="xl:col-span-2 space-y-6">
                {/* Broadcast Shortcut Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-2xl shrink-0 text-white shadow-xs", theme.bgClass)}>
                      <Send className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Broadcast Campus Announcement</h3>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-md leading-relaxed">
                        Dispatch notifications to specific departments, academic years, or the entire campus across desktop &amp; mobile phones.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('broadcast')}
                    className={cn(
                      "px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 flex items-center gap-1.5",
                      theme.bgClass,
                      theme.hoverClass
                    )}
                  >
                    <span>Start Broadcast</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Recent Alerts List */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1.5 rounded-lg", theme.lightBgClass)}>
                        <Clock className={cn("h-3.5 w-3.5", theme.textClass)} />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('notifications')}
                      className={cn("text-[11px] font-bold uppercase tracking-wider transition-colors", theme.textClass, "hover:opacity-75")}
                    >
                      Full History
                    </button>
                  </div>

                  {loadingNotifs ? (
                    <div className="py-12 text-center">
                      <div className="inline-block h-6 w-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-2" />
                      <p className="text-[11px] text-slate-400 font-medium">Retrieving history...</p>
                    </div>
                  ) : notifications && notifications.docs.length > 0 ? (
                    <div className="space-y-3">
                      {notifications.docs.slice(0, 4).map((docSnap) => {
                        const notif = docSnap.data();
                        const date = notif.createdAt?.toDate() || new Date();
                        return (
                          <div 
                            key={docSnap.id} 
                            className="group p-3 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50/50 transition-all cursor-pointer"
                            onClick={() => setActiveTab('notifications')}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                    {notif.title}
                                  </h5>
                                  <span className={cn(
                                    "px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-tighter",
                                    notif.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                  )}>
                                    {notif.status === 'sent' ? 'Sent' : 'Draft'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-1 leading-relaxed">{notif.body}</p>
                                <div className="flex items-center gap-2 text-[9px] text-slate-400 font-medium">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-2.5 w-2.5" />
                                    {notif.targetGroup?.department === 'All' ? 'Global' : notif.targetGroup?.department}
                                  </span>
                                  <span>·</span>
                                  <span>{format(date, 'MMM d, h:mm a')}</span>
                                </div>
                              </div>
                              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center flex flex-col items-center">
                      <div className="p-3 bg-slate-50 rounded-full mb-3">
                        <Megaphone className="h-6 w-6 text-slate-300" />
                      </div>
                      <p className="text-xs text-slate-400 font-medium">No announcements recorded.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Push Status & Members - 1 Col */}
              <div className="space-y-6">
                {/* Device Push Status for Admin (with test button) */}
                <NotificationPermissionBanner isAdmin={true} />

                {/* Campus Members Quick List */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900">Campus Members</h3>
                    {isSuperAdmin ? (
                      <button 
                        onClick={() => setActiveTab('users')}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Manage
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">Audience</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {users?.docs.slice(0, 5).map(doc => {
                      const u = doc.data();
                      return (
                        <div key={doc.id} className="flex items-center gap-3">
                          <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0", theme.bgClass)}>
                            {u.name?.charAt(0) || 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{u.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {u.department && u.department !== 'All' ? `${u.department} · ` : ''}
                              <span className="capitalize">
                                {u.role === 'push_admin' ? 'Push Admin' : u.role}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'broadcast':
        return (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {editingNotificationId ? 'Continue Composing' : 'Broadcast Announcement'}
                  </h2>
                  <p className="text-slate-500 text-xs">
                    {editingNotificationId 
                      ? 'Finish your draft and send it to your audience.' 
                      : 'Send real-time push alerts to mobile phones and desktops across campus.'}
                  </p>
                </div>
                {editingNotificationId && (
                  <button 
                    onClick={() => setEditingNotificationId(null)}
                    className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-xs"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
            <NotificationForm 
              onSuccess={handleBroadcastSuccess} 
              editingId={editingNotificationId} 
            />
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Broadcast History</h2>
                <p className="text-xs text-slate-500">Record of all notifications dispatched to student and staff devices.</p>
              </div>
              <button
                onClick={() => setActiveTab('broadcast')}
                className={cn("px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs", theme.bgClass, theme.hoverClass)}
              >
                New Broadcast
              </button>
            </div>
            <NotificationList 
              notifications={notifications?.docs || []} 
              loading={loadingNotifs} 
              isAdmin 
              onEdit={handleEditDraft}
            />
          </div>
        );

      case 'users':
        return isSuperAdmin ? <UserManagement /> : (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 max-w-xl mx-auto mt-8">
            <h3 className="text-base font-bold text-slate-900 mb-1">Restricted Access</h3>
            <p className="text-xs text-slate-500">Student &amp; Staff administration is managed by the Super Administrator.</p>
          </div>
        );

      case 'branding':
      case 'settings':
        return isSuperAdmin ? <BrandingSettings /> : (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 max-w-xl mx-auto mt-8">
            <h3 className="text-base font-bold text-slate-900 mb-1">Restricted Access</h3>
            <p className="text-xs text-slate-500">Branding and institutional appearance settings are reserved for Super Administrators.</p>
          </div>
        );

      default:
        return (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 max-w-xl mx-auto mt-8">
            Page not found
          </div>
        );
    }
  };

  return (
    <Layout profile={profile} activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}
