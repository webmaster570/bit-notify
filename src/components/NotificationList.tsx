import React from 'react';
import { format } from 'date-fns';
import { Bell, Clock, AlertTriangle, Info, Calendar, Megaphone, Trash2, Paperclip } from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface NotificationListProps {
  notifications: any[];
  loading: boolean;
  isAdmin?: boolean;
}

export function NotificationList({ notifications, loading, isAdmin }: NotificationListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
        <Bell className="h-12 w-12 text-slate-200 mb-4" />
        <p className="text-slate-500 font-medium">No notifications found</p>
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this notification?')) {
      await deleteDoc(doc(db, 'notifications', id));
    }
  };

  return (
    <div className="space-y-4">
      {notifications.map((n) => {
        const data = n.data();
        const date = data.createdAt?.toDate() || new Date();

        const priorityColors = {
          high: 'bg-red-50 text-red-700 border-red-100',
          medium: 'bg-orange-50 text-orange-700 border-orange-100',
          low: 'bg-blue-50 text-blue-700 border-blue-100',
        };

        const categoryIcons = {
          update: <Info className="h-5 w-5" />,
          class: <Calendar className="h-5 w-5" />,
          assignment: <Megaphone className="h-5 w-5" />,
          emergency: <AlertTriangle className="h-5 w-5" />,
        };

        return (
          <div
            key={n.id}
            className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border",
                    priorityColors[data.priority as keyof typeof priorityColors]
                  )}>
                    {data.priority}
                  </span>
                  <span className="text-slate-400 text-xs font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(date, 'MMM d, h:mm a')}
                  </span>
                  {data.status === 'scheduled' && (
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-bold border border-slate-200">
                      Scheduled
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 p-2 bg-slate-50 rounded-lg text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    {categoryIcons[data.category as keyof typeof categoryIcons] || <Bell className="h-5 w-5" />}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {data.title}
                    </h4>
                    <p className="mt-1 text-slate-600 leading-relaxed">
                      {data.body}
                    </p>

                    {data.attachment && (
                      <div className="mt-4">
                        <a
                          href={data.attachment.data}
                          download={data.attachment.name}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-100 transition-all"
                        >
                          <Paperclip className="h-4 w-4" />
                          {data.attachment.name}
                          <span className="text-[10px] text-slate-400 ml-2">Download</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <Target className="h-3 w-3" />
                    Target: {data.targetGroup.department} • {data.targetGroup.course} • Yr {data.targetGroup.academicYear}
                  </div>
                  
                  {isAdmin && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 text-[10px] font-bold">
                        <CheckCircle2 className="h-3 w-3" />
                        Sent: {data.deliveryStats?.sentCount || 0}
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-[10px] font-bold">
                        <Users className="h-3 w-3" />
                        Read: {data.deliveryStats?.readCount || 0}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="flex flex-col items-end gap-2">
                  <span className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                    data.status === 'sent' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-200"
                  )}>
                    {data.status}
                  </span>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { Target, CheckCircle2, Users } from 'lucide-react';
