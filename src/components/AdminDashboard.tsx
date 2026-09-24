import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Layout } from './Layout';
import { NotificationForm } from './NotificationForm';
import { NotificationList } from './NotificationList';
import { UserProfile } from '../hooks/useAuth';
import { Users, Bell, TrendingUp, CheckCircle2, Send } from 'lucide-react';

import { UserManagement } from './UserManagement';

export function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifsQuery] = useState(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50)));
  const [notifications, loadingNotifs] = useCollection(notifsQuery);
  const [usersQuery] = useState(query(collection(db, 'users'), limit(100)));
  const [users, loadingUsers] = useCollection(usersQuery);

  const stats = [
    { label: 'Total Students', value: users?.size || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Sent Notifications', value: notifications?.size || 0, icon: Bell, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Active Broadcasts', value: notifications?.docs.filter(d => d.data().status === 'sent').length || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Scheduled', value: notifications?.docs.filter(d => d.data().status === 'scheduled').length || 0, icon: CheckCircle2, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-2 rounded-xl", stat.bg)}>
                      <stat.icon className={cn("h-6 w-6", stat.color)} />
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                  <h4 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h4>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                  <div className="bg-blue-50 p-4 rounded-2xl">
                    <Send className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">New Announcement</h3>
                    <p className="text-slate-500 text-sm max-w-xs">Reach your students instantly with targeted push notifications and updates.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('broadcast')}
                    className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    Start Broadcasting
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Recent Users</h3>
                  <div className="space-y-4">
                    {users?.docs.slice(0, 5).map(doc => {
                      const u = doc.data();
                      return (
                        <div key={doc.id} className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                            {u.name?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                            <p className="text-xs text-slate-500 truncate">{u.department} • {u.role}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button 
                    onClick={() => setActiveTab('users')}
                    className="mt-6 w-full py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                  >
                    Manage All Users
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'broadcast':
        return (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-slate-900">Broadcast Announcement</h2>
              <p className="text-slate-500 text-sm">Send real-time notifications to specific segments of your campus.</p>
            </div>
            <NotificationForm onSuccess={() => setActiveTab('notifications')} />
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Notification History</h2>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium"
              >
                New Broadcast
              </button>
            </div>
            <NotificationList notifications={notifications?.docs || []} loading={loadingNotifs} isAdmin />
          </div>
        );
      case 'users':
        return <UserManagement />;
      default:
        return <div className="flex flex-col items-center justify-center py-20 text-slate-500">Feature coming soon...</div>;
    }
  };

  return (
    <Layout profile={profile} activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

import { cn } from '../lib/utils';
