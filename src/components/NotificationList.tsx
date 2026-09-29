import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  Bell, 
  Clock, 
  AlertTriangle, 
  Info, 
  Calendar, 
  Megaphone, 
  Trash2, 
  Paperclip, 
  X, 
  Target, 
  CheckCircle2, 
  Users, 
  Eye, 
  FileEdit, 
  Search, 
  ChevronDown, 
  Check 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useBranding } from '../context/BrandingContext';

interface NotificationListProps {
  notifications: any[];
  loading: boolean;
  isAdmin?: boolean;
  onEdit?: (id: string) => void;
}

export function NotificationList({ notifications: rawNotifications, loading, isAdmin, onEdit }: NotificationListProps) {
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [displayLimit, setDisplayLimit] = useState(10);
  const { theme } = useBranding();

  // Normalize notifications
  const notifications = useMemo(() => {
    return (rawNotifications || []).map(n => {
      const data = typeof n.data === 'function' ? n.data() : n;
      return {
        id: n.id || data.id,
        ...data
      };
    }).filter(n => n.id);
  }, [rawNotifications]);

  // Search/Filter logic
  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return notifications;
    const query = searchQuery.toLowerCase();
    return notifications.filter(n => 
      String(n.title || '').toLowerCase().includes(query) || 
      String(n.body || '').toLowerCase().includes(query) ||
      String(n.category || '').toLowerCase().includes(query) ||
      String(n.targetGroup?.department || '').toLowerCase().includes(query)
    );
  }, [notifications, searchQuery]);

  const paginatedNotifications = useMemo(() => {
    return filteredNotifications.slice(0, displayLimit);
  }, [filteredNotifications, displayLimit]);

  if (loading && (rawNotifications || []).length === 0) {
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!id) {
      alert('Cannot delete: Notification ID is missing.');
      return;
    }
    if (confirm('Delete this notification record? This cannot be undone.')) {
      try {
        const docRef = doc(db, 'notifications', id);
        await deleteDoc(docRef);
        alert('Notification deleted successfully.');
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (err: any) {
        console.error('Delete error:', err);
        alert(`Delete failed: ${err.message || 'Check your permissions.'}`);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} notifications?`)) {
      try {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
          const docRef = doc(db, 'notifications', id);
          batch.delete(docRef);
        });
        await batch.commit();
        alert(`${selectedIds.size} notifications deleted successfully.`);
        setSelectedIds(new Set());
      } catch (err: any) {
        console.error('Bulk delete error:', err);
        alert(`Bulk delete failed: ${err.message || 'Check your permissions.'}`);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedNotifications.map(n => n.id)));
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const priorityColors = {
    high: 'bg-red-50 text-red-700 border-red-100',
    medium: 'bg-orange-50 text-orange-700 border-orange-100',
    low: cn(theme.lightBgClass, theme.textClass, theme.borderClass),
  };

  const categoryIcons = {
    update: <Info className="h-4 w-4" />,
    class: <Calendar className="h-4 w-4" />,
    assignment: <Megaphone className="h-4 w-4" />,
    emergency: <AlertTriangle className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      {/* List Header & Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-xs"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex-1 sm:flex-none px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Selected ({selectedIds.size})
              </button>
            )}
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap ml-auto sm:ml-0">
              {filteredNotifications.length} Results
            </span>
          </div>
        )}
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="p-5 bg-slate-50 rounded-full mb-5 text-slate-300">
            <Bell className="h-12 w-12" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No Announcements Found</h3>
          <p className="text-slate-500 max-w-xs text-center mt-2 text-sm leading-relaxed">
            {searchQuery ? "No results match your search criteria." : "The notice board is currently empty."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  {isAdmin && (
                    <th className="pl-8 py-5 w-4">
                      <button 
                        onClick={toggleSelectAll}
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center transition-all",
                          selectedIds.size === paginatedNotifications.length && paginatedNotifications.length > 0
                            ? cn(theme.bgClass, "border-transparent")
                            : "border-slate-300 bg-white"
                        )}
                      >
                        {selectedIds.size === paginatedNotifications.length && paginatedNotifications.length > 0 && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className={cn("py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest", !isAdmin && "pl-8")}>Notice Title</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Targeting</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Priority</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Dispatch Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedNotifications.map((data) => {
                  const id = data.id;
                  const date = data.createdAt?.toDate() || new Date();
                  const isSelected = selectedIds.has(id);

                  return (
                    <tr 
                      key={id} 
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors cursor-pointer group",
                        isSelected && "bg-blue-50/30"
                      )}
                      onClick={() => setSelectedNotification(data)}
                    >
                      {isAdmin && (
                        <td className="pl-8 py-6">
                          <button 
                            onClick={(e) => toggleSelect(e, id)}
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center transition-all",
                              isSelected ? cn(theme.bgClass, "border-transparent") : "border-slate-200 bg-white group-hover:border-slate-300"
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </button>
                        </td>
                      )}
                      <td className={cn("py-6", !isAdmin && "pl-8")}>
                        <div className="flex flex-col gap-1 max-w-md">
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm font-bold text-slate-900 transition-colors line-clamp-1", "group-hover:" + theme.textClass)}>
                              {data.title || '(Untitled)'}
                            </p>
                            {data.status === 'draft' && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-600 border-slate-200">
                                Draft
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {data.body}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <Users className="h-3 w-3 text-slate-400" />
                            {(() => {
                              const roles = data.targetGroup?.categories || [data.targetGroup?.category || 'All'];
                              if (roles.includes('All')) return 'Everyone';
                              if (roles.length > 1) return `${roles.length} Roles`;
                              return roles[0];
                            })()}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium ml-4 uppercase tracking-tight">
                            {(() => {
                              const depts = data.targetGroup?.departments || [data.targetGroup?.department || 'All'];
                              if (depts.includes('All')) return 'All Departments';
                              if (depts.length > 1) return `${depts.length} Departments`;
                              return depts[0];
                            })()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 bg-slate-100 rounded-lg text-slate-500",
                            "group-hover:" + theme.lightBgClass,
                            "group-hover:" + theme.textClass
                          )}>
                            {categoryIcons[data.category as keyof typeof categoryIcons] || <Bell className="h-3.5 w-3.5" />}
                          </div>
                          <span className="text-xs font-semibold text-slate-600 capitalize">
                            {data.category}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border",
                          priorityColors[data.priority as keyof typeof priorityColors]
                        )}>
                          {data.priority}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-6">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-bold text-slate-900 group-hover:text-slate-700">
                              {format(date, 'MMM d, yyyy')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {format(date, 'h:mm a')}
                            </span>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {data.status === 'draft' && onEdit && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onEdit(id); }}
                                  className={cn("p-2 rounded-xl transition-all", theme.textClass, "hover:" + theme.lightBgClass)}
                                  title="Edit Draft"
                                >
                                  <FileEdit className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => handleDelete(e, id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card View */}
          <div className="lg:hidden space-y-4">
            {paginatedNotifications.map((data) => {
              const id = data.id;
              const date = data.createdAt?.toDate() || new Date();
              const isSelected = selectedIds.has(id);

              return (
                <div 
                  key={id}
                  onClick={() => setSelectedNotification(data)}
                  className={cn(
                    "bg-white rounded-3xl border border-slate-200 p-5 shadow-sm active:bg-slate-50 transition-colors relative",
                    isSelected && "border-blue-300 ring-1 ring-blue-100"
                  )}
                >
                  {isAdmin && (
                    <button 
                      onClick={(e) => toggleSelect(e, id)}
                      className={cn(
                        "absolute top-4 left-4 h-5 w-5 rounded-full border flex items-center justify-center transition-all z-10",
                        isSelected ? cn(theme.bgClass, "border-transparent") : "border-slate-200 bg-white"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </button>
                  )}

                  <div className={cn("flex items-start justify-between mb-4", isAdmin && "pl-8")}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2.5 rounded-2xl",
                        theme.lightBgClass,
                        theme.textClass
                      )}>
                        {categoryIcons[data.category as keyof typeof categoryIcons] || <Bell className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 leading-tight">
                          {data.title || '(Untitled)'}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border",
                            priorityColors[data.priority as keyof typeof priorityColors]
                          )}>
                            {data.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {format(date, 'MMM d')}
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-500 line-clamp-2 mb-5 leading-relaxed bg-slate-50/50 p-3 rounded-2xl">
                    {data.body}
                  </p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-slate-300" />
                      <span className="text-[10px] font-bold text-slate-500">
                        {(() => {
                          const roles = data.targetGroup?.categories || [data.targetGroup?.category || 'All'];
                          const depts = data.targetGroup?.departments || [data.targetGroup?.department || 'All'];
                          const roleText = roles.includes('All') ? 'Everyone' : (roles.length > 1 ? `${roles.length} Roles` : roles[0]);
                          const deptText = depts.includes('All') ? 'Global' : (depts.length > 1 ? `${depts.length} Depts` : depts[0]);
                          return `${roleText} / ${deptText}`;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          onClick={(e) => handleDelete(e, id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mr-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <Eye className={cn("h-4 w-4", theme.textClass)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Load More */}
          {filteredNotifications.length > displayLimit && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setDisplayLimit(prev => prev + 10)}
                className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
              >
                Load More Results
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 bg-white rounded-2xl shadow-sm border border-slate-100", theme.textClass)}>
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
                    className={cn(
                      "inline-flex items-center gap-3 px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 transition-all shadow-sm group/btn",
                      "hover:" + theme.lightBgClass,
                      "hover:" + theme.textClass,
                      "hover:" + theme.borderClass
                    )}
                  >
                    <div className={cn("p-2 bg-slate-100 rounded-xl transition-colors", "group-hover/btn:" + theme.lightBgClass.replace('bg-', 'bg-').replace('50', '100'))}>
                      <Paperclip className={cn("h-5 w-5 text-slate-500", "group-hover/btn:" + theme.textClass)} />
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
                    <div className="flex items-start gap-3 text-sm">
                      <Target className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-600 font-bold">
                          {(() => {
                            const roles = selectedNotification.targetGroup?.categories || [selectedNotification.targetGroup?.category || 'All'];
                            return roles.includes('All') ? 'All Institutional Roles' : roles.join(', ');
                          })()}
                        </span>
                        <span className="text-slate-500 font-medium text-xs">
                          {(() => {
                            const depts = selectedNotification.targetGroup?.departments || [selectedNotification.targetGroup?.department || 'All'];
                            return depts.includes('All') ? 'All Departments' : depts.join(', ');
                          })()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-600 font-medium">
                        Year {selectedNotification.targetGroup?.academicYear || 'All'}
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
                      <div className={cn("p-4 rounded-2xl border", theme.lightBgClass, theme.borderClass)}>
                        <div className={cn("flex items-center gap-2 mb-1", theme.textClass)}>
                          <Eye className="h-4 w-4" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Read</span>
                        </div>
                        <div className={cn("text-2xl font-bold", theme.id === 'slate' ? 'text-slate-900' : theme.textClass.replace('text-', 'text-').replace('600', '900'))}>
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
