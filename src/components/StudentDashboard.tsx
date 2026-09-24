import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Layout } from './Layout';
import { NotificationList } from './NotificationList';
import { UserProfile } from '../hooks/useAuth';
import { Bell, Shield, Calendar } from 'lucide-react';

export function StudentDashboard({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Query notifications targeted to this user's department/course/year or "All"
  const notifsQuery = query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc')
  );

  const [notifications, loadingNotifs] = useCollection(notifsQuery);

  // Filter client-side because Firestore doesn't support complex "OR" well with "All" defaults in this schema without multiple queries
  const filteredNotifs = notifications?.docs.filter(d => {
    const data = d.data();
    if (data.status !== 'sent') return false;
    const target = data.targetGroup;

    const deptMatch = !target.department || target.department === 'All' || target.department === profile.department;
    const courseMatch = !target.course || target.course === 'All' || target.course === profile.course;
    const yearMatch = !target.academicYear || target.academicYear === 'All' || target.academicYear === profile.academicYear;

    return deptMatch && courseMatch && yearMatch;
  }) || [];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-200">
              <h2 className="text-3xl font-bold mb-2">Hello, {profile.name}!</h2>
              <p className="text-blue-100 opacity-90">
                You have {filteredNotifs.length} active updates from {profile.department} department.
              </p>
              <div className="flex flex-wrap gap-4 mt-6">
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-white/20">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm font-medium">{profile.role}</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-white/20">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">Year {profile.academicYear || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="h-6 w-6 text-blue-600" />
                  Latest Announcements
                </h3>
              </div>
              <NotificationList notifications={filteredNotifs} loading={loadingNotifs} />
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">All Updates</h2>
            <NotificationList notifications={filteredNotifs} loading={loadingNotifs} />
          </div>
        );
      default:
        return <div className="flex flex-col items-center justify-center py-20 text-slate-500">Coming soon...</div>;
    }
  };

  return (
    <Layout profile={profile} activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}
