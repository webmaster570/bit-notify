import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Layout } from './Layout';
import { NotificationList } from './NotificationList';
import { UserProfile } from '../hooks/useAuth';
import { Bell, Shield, Calendar, Building2 } from 'lucide-react';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';
import { useBranding } from '../context/BrandingContext';
import { cn } from '../lib/utils';

export function StudentDashboard({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { branding, theme } = useBranding();

  // Query notifications targeted to this user's department/course/year or "All"
  const notifsQuery = query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc')
  );

  const [notifications, loadingNotifs] = useCollection(notifsQuery);

  // Filter client-side
  const filteredNotifs = notifications?.docs.filter(d => {
    const data = d.data();
    if (data.status !== 'sent') return false;
    const target = data.targetGroup;
    if (!target) return true;

    const deptMatch = !target.department || target.department === 'All' || target.department === profile.department;
    const courseMatch = !target.course || target.course === 'All' || target.course === profile.course;
    const yearMatch = !target.academicYear || target.academicYear === 'All' || target.academicYear === profile.academicYear;

    return deptMatch && courseMatch && yearMatch;
  }) || [];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8 max-w-6xl mx-auto">
            {/* Greeting Hero Card with Dynamic Branding */}
            <div className={cn(
              "rounded-3xl p-8 text-white shadow-sm bg-gradient-to-r",
              theme.gradientFrom,
              theme.gradientTo
            )}>
              <span className="text-[11px] uppercase font-bold tracking-widest opacity-80 block mb-1">
                {branding.institutionName || 'Student & Staff Portal'}
              </span>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Hello, {profile.name}!</h2>
              <p className="text-sm opacity-90 leading-relaxed max-w-xl">
                {branding.tagline || `You have ${filteredNotifs.length} active updates from your department.`}
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-6 text-xs">
                <div className="bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-xl flex items-center gap-2 border border-white/20">
                  <Shield className="h-4 w-4" />
                  <span className="font-semibold capitalize">{profile.role}</span>
                </div>
                {profile.department && profile.department !== 'All' && (
                  <div className="bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-xl flex items-center gap-2 border border-white/20">
                    <Building2 className="h-4 w-4" />
                    <span className="font-semibold">{profile.department}</span>
                  </div>
                )}
                {profile.academicYear && profile.academicYear !== 'All' && (
                  <div className="bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-xl flex items-center gap-2 border border-white/20">
                    <Calendar className="h-4 w-4" />
                    <span className="font-semibold">Year {profile.academicYear}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notification Registration (No Send Test Push button for students/staff) */}
            <NotificationPermissionBanner isAdmin={false} />

            {/* Latest Announcements */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("p-1.5 rounded-lg text-white", theme.bgClass)}>
                    <Bell className="h-4 w-4" />
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">Latest Campus Announcements</h3>
                </div>
                <span className="text-xs text-slate-400">
                  {filteredNotifs.length} total active notice{filteredNotifs.length === 1 ? '' : 's'}
                </span>
              </div>
              <NotificationList notifications={filteredNotifs} loading={loadingNotifs} />
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">All Updates &amp; Notices</h2>
              <p className="text-xs text-slate-500">Official notifications issued by campus administration and faculty.</p>
            </div>
            <NotificationList notifications={filteredNotifs} loading={loadingNotifs} />
          </div>
        );
      default:
        return <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-xs">Page not found</div>;
    }
  };

  return (
    <Layout profile={profile} activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}
