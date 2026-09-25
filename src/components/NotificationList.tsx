import React, { useState } from 'react';
import { format } from 'date-fns';
import { Bell, Clock, AlertTriangle, Info, Calendar, Megaphone, Trash2, Paperclip, X, Target, CheckCircle2, Users, Eye, FileEdit } from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface NotificationListProps {
  notifications: any[];
  loading: boolean;
  isAdmin?: boolean;
  onEdit?: (id: string) => void;
}

export function NotificationList({ notifications, loading, isAdmin, onEdit }: NotificationListProps) {
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-8 bg-slate-100 rounded w-full mb-6" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-slate-50 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 border-dashed shadow-sm">
        <div className="p-4 bg-slate-50 rounded-full mb-4">
          <Bell className="h-10 w-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No Notifications</h3>
        <p className="text-slate-500 max-w-xs text-center mt-1">There are no notifications to display at this time.</p>
      </div>
    );
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this notification?')) {
      await deleteDoc(doc(db, 'notifications', id));
    }
  };

  const handleEditClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onEdit) onEdit(id);
  };

  const priorityColors = {
    high: 'bg-red-50 text-red-700 border-red-100',
    medium: 'bg-orange-50 text-orange-700 border-orange-100',
    low: 'bg-blue-50 text-blue-700 border-blue-100',
  };

  const categoryIcons = {
    update: <Info className="h-4 w-4" />,
    class: <Calendar className="h-4 w-4" />,
    assignment: <Megaphone className="h-4 w-4" />,
    emergency: <AlertTriangle className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Title</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notifications.map((n) => {
                const data = n.data();
                const date = data.createdAt?.toDate() || new Date();

                return (
                  <tr 
                    key={n.id} 
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => setSelectedNotification({ id: n.id, ...data })}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {format(date, 'MMM d, yyyy • h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          {categoryIcons[data.category as keyof typeof categoryIcons] || <Bell className="h-4 w-4" />}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 capitalize">
                          {data.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                          {data.title || '(Untitled Draft)'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            priorityColors[data.priority as keyof typeof priorityColors]
                          )}>
                            {data.priority}
                          </span>
                          {data.status === 'draft' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-600 border-slate-200">
                              Draft
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && data.status === 'draft' && (
                          <button
                            onClick={(e) => handleEditClick(e, n.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Continue Composing"
                          >
                            <FileEdit className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => handleDelete(e, n.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-blue-600">
                  {categoryIcons[selectedNotification.category as keyof typeof categoryIcons] || <Bell className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">
                    {selectedNotification.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      priorityColors[selectedNotification.priority as keyof typeof priorityColors]
                    )}>
                      {selectedNotification.priority} Priority
                    </span>
                    <span className="text-slate-400 text-xs font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(selectedNotification.createdAt?.toDate() || new Date(), 'MMMM d, yyyy • h:mm a')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="p-2 text-slate-400 hover:bg-white hover:text-slate-600 rounded-full transition-all border border-transparent hover:border-slate-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Notification Content</h4>
                <p className="text-slate-700 leading-relaxed text-lg bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                  {selectedNotification.body}
                </p>
              </div>

              {selectedNotification.attachment && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Attachments</h4>
                  <a
                    href={selectedNotification.attachment.data}
                    download={selectedNotification.attachment.name}
                    className="inline-flex items-center gap-3 px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm group/btn"
                  >
                    <div className="p-2 bg-slate-100 rounded-xl group-hover/btn:bg-blue-100 transition-colors">
                      <Paperclip className="h-5 w-5 text-slate-500 group-hover/btn:text-blue-600" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>{selectedNotification.attachment.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Click to download file</span>
                    </div>
                  </a>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Target Audience</h4>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Target className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-600 font-medium">
                        {selectedNotification.targetGroup.department} • {selectedNotification.targetGroup.course}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-600 font-medium">
                        Academic Year {selectedNotification.targetGroup.academicYear}
                      </span>
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Delivery Performance</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <div className="flex items-center gap-2 text-emerald-700 mb-1">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Sent</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-900">
                          {selectedNotification.deliveryStats?.sentCount || 0}
                        </div>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-700 mb-1">
                          <Eye className="h-4 w-4" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Read</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-900">
                          {selectedNotification.deliveryStats?.readCount || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border shadow-sm",
                selectedNotification.status === 'sent' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-200 text-slate-600 border-slate-300"
              )}>
                Status: {selectedNotification.status}
              </span>
              <button
                onClick={() => setSelectedNotification(null)}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

