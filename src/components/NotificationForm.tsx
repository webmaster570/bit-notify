import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { Send, Clock, Target, AlertCircle, Paperclip, Upload, FileText, X, FileEdit, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { useBranding } from '../context/BrandingContext';

export function NotificationForm({ onSuccess, editingId }: { onSuccess: () => void, editingId?: string | null }) {
  const { branding, theme } = useBranding();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('update');
  const [targetDepts, setTargetDepts] = useState<string[]>(['All']);
  const [targetRoles, setTargetRoles] = useState<string[]>(['All']);
  const [targetYear, setTargetYear] = useState('All');
  const [targetCourse, setTargetCourse] = useState('All');
  const [scheduledAt, setScheduledAt] = useState('');
  const [attachment, setAttachment] = useState<{ name: string, data: string, type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);

  const [systemConfig, setSystemConfig] = useState<{ roles: string[], departments: string[] } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'system', 'config'));
      if (snap.exists()) {
        const data = snap.data();
        setSystemConfig({
          roles: data.roles || [],
          departments: data.departments || []
        });
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (editingId) {
      const fetchDraft = async () => {
        const docSnap = await getDoc(doc(db, 'notifications', editingId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitle(data.title || '');
          setBody(data.body || '');
          setPriority(data.priority || 'medium');
          setCategory(data.category || 'update');
          
          // Handle legacy single-string fields or new array fields
          const depts = data.targetGroup?.departments || (data.targetGroup?.department ? [data.targetGroup.department] : ['All']);
          const roles = data.targetGroup?.categories || (data.targetGroup?.category ? [data.targetGroup.category] : ['All']);
          
          setTargetDepts(depts);
          setTargetRoles(roles);
          setTargetYear(data.targetGroup?.academicYear || 'All');
          setTargetCourse(data.targetGroup?.course || 'All');
          setAttachment(data.attachment || null);
          if (data.scheduledAt) {
            const date = data.scheduledAt.toDate();
            setScheduledAt(date.toISOString().slice(0, 16));
          }
        }
      };
      fetchDraft();
    }
  }, [editingId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { // ~800KB limit for Firestore
        alert('File is too large. Please select a file smaller than 800KB.');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachment({
          name: file.name,
          type: file.type,
          data: event.target?.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (status: 'sent' | 'scheduled' | 'draft') => {
    setLoading(true);
    setIsDrafting(status === 'draft');

    try {
      const payload = {
        title,
        body,
        priority,
        category,
        attachment,
        targetGroup: {
          departments: targetDepts,
          categories: targetRoles,
          academicYear: targetYear,
          course: targetCourse,
          // Legacy support
          department: targetDepts.length === 1 ? targetDepts[0] : (targetDepts.includes('All') ? 'All' : 'Multiple'),
          category: targetRoles.length === 1 ? targetRoles[0] : (targetRoles.includes('All') ? 'All' : 'Multiple'),
        },
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        updatedAt: serverTimestamp(),
        status: status === 'draft' ? 'draft' : (scheduledAt ? 'scheduled' : 'sent'),
        deliveryStats: {
          sentCount: 0,
          readCount: 0,
        },
        createdBy: auth.currentUser?.uid || 'system',
      };

      if (editingId) {
        await updateDoc(doc(db, 'notifications', editingId), payload);
      } else {
        await addDoc(collection(db, 'notifications'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      // Trigger push notification via backend if status is 'sent'
      if (status === 'sent') {
        try {
          // Query active device tokens directly from client using authenticated SDK
          let targetTokens: string[] = [];
          try {
            const tokensSnap = await getDocs(collection(db, 'fcmTokens'));
            tokensSnap.forEach(docSnap => {
              const data = docSnap.data();
              if (data && data.token && typeof data.token === 'string') {
                const deptMatch = targetDepts.includes('All') || !data.department || data.department === 'All' || targetDepts.some(d => d.toLowerCase() === String(data.department).toLowerCase());
                const roleMatch = targetRoles.includes('All') || !data.category || data.category === 'All' || targetRoles.some(r => r.toLowerCase() === String(data.category).toLowerCase());
                const courseMatch = !targetCourse || targetCourse === 'All' || !data.course || data.course === 'All' || String(data.course).toLowerCase() === targetCourse.toLowerCase();
                const yearMatch = !targetYear || targetYear === 'All' || !data.academicYear || data.academicYear === 'All' || String(data.academicYear).toLowerCase() === targetYear.toLowerCase();
                if (deptMatch && roleMatch && courseMatch && yearMatch) {
                  targetTokens.push(data.token);
                }
              }
            });
            targetTokens = [...new Set(targetTokens)];
          } catch (tErr) {
            console.warn('[NotificationForm] Client token query warning:', tErr);
          }

          const pushRes = await fetch('/api/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              body,
              tokens: targetTokens,
              icon: branding.logoUrl || '/bit-mesra-logo.png?v=4',
              badge: branding.logoUrl || '/bit-mesra-logo.png?v=4',
              targetGroup: {
                departments: targetDepts,
                categories: targetRoles,
                academicYear: targetYear,
                course: targetCourse,
              }
            })
          });
          const pushData = await pushRes.json();
          console.log('[NotificationForm] Push broadcast response:', pushData);

          if (pushRes.ok) {
            const count = pushData.sentCount || 0;
            const mob = pushData.mobileCount || 0;
            const desk = pushData.desktopCount || 0;
            if (count > 0) {
              alert(`Broadcast Dispatched!\n\nPush notification sent to ${count} device(s) across campus:\n📱 Mobile: ${mob}\n💻 Desktop: ${desk}`);
            } else {
              alert(`Broadcast saved, but 0 devices were targeted for your selection.\n\nPlease ensure students/staff have enabled push notifications on their phones.`);
            }
          }
        } catch (pushErr) {
          console.error('Failed to trigger push notification:', pushErr);
        }
      }

      setTitle('');
      setBody('');
      setScheduledAt('');
      setAttachment(null);
      onSuccess();
    } catch (err) {
      console.error('Error saving notification:', err);
    } finally {
      setLoading(false);
      setIsDrafting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave(scheduledAt ? 'scheduled' : 'sent');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          {editingId ? (
            <FileEdit className={cn("h-5 w-5", theme.textClass)} />
          ) : (
            <Send className={cn("h-5 w-5", theme.textClass)} />
          )}
          {editingId ? 'Edit Draft' : 'Create Broadcast'}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={cn(
                  "w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:border-transparent outline-none transition-all",
                  "focus:ring-" + theme.id + "-500"
                )}
                placeholder="e.g. End Semester Exam Schedule"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message Body</label>
              <textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className={cn(
                  "w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:border-transparent outline-none transition-all resize-none",
                  "focus:ring-" + theme.id + "-500"
                )}
                placeholder="Details of the announcement..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className={cn(
                    "w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 outline-none text-sm",
                    "focus:ring-" + theme.id + "-500"
                  )}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 outline-none text-sm",
                    "focus:ring-" + theme.id + "-500"
                  )}
                >
                  <option value="update">Campus Update</option>
                  <option value="class">Class Alert</option>
                  <option value="assignment">Assignment</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Target className="h-4 w-4" /> Target Audience
              </label>
              <div className="space-y-2">
                <MultiSelect
                  label="Departments"
                  options={['All', ...(systemConfig?.departments || [])]}
                  selected={targetDepts}
                  onChange={setTargetDepts}
                  theme={theme}
                />
                <MultiSelect
                  label="Roles"
                  options={['All', ...(systemConfig?.roles || [])]}
                  selected={targetRoles}
                  onChange={setTargetRoles}
                  theme={theme}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Course (All)"
                  value={targetCourse}
                  onChange={(e) => setTargetCourse(e.target.value)}
                  className="px-2 py-2 border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="Year (All)"
                  value={targetYear}
                  onChange={(e) => setTargetYear(e.target.value)}
                  className="px-2 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Schedule (Optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={cn(
                  "w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 outline-none text-sm",
                  "focus:ring-" + theme.id + "-500"
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Attachment (Max 800KB)
              </label>
              <div className="relative group">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                    attachment 
                      ? "border-blue-200 bg-blue-50 text-blue-700" 
                      : "border-slate-200 hover:border-blue-400 text-slate-500"
                  )}
                >
                  {attachment ? (
                    <>
                      <FileText className="h-4 w-4" />
                      <span className="text-xs font-medium truncate max-w-[200px]">{attachment.name}</span>
                      <button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); setAttachment(null); }}
                        className={cn("ml-2 p-1 rounded-full", theme.lightBgClass)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span className="text-xs">Click to upload document or image</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={async () => {
              try {
                let allTokens: string[] = [];
                try {
                  const snap = await getDocs(collection(db, 'fcmTokens'));
                  snap.forEach(d => {
                    const data = d.data();
                    if (data && data.token && typeof data.token === 'string') {
                      allTokens.push(data.token);
                    }
                  });
                  allTokens = [...new Set(allTokens)];
                } catch (tokErr) {
                  console.warn('Could not query tokens for test:', tokErr);
                }

                const res = await fetch('/api/broadcast', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    title: `${branding.institutionName || 'BIT Mesra'} Test Alert`, 
                    body: `Sent at ${new Date().toLocaleTimeString()}. Push notification delivery with official BIT Mesra emblem is active!`,
                    tokens: allTokens,
                    icon: branding.logoUrl || '/bit-mesra-logo.png?v=4',
                    badge: branding.logoUrl || '/bit-mesra-logo.png?v=4',
                  })
                });

                const contentType = res.headers.get('content-type');
                let data: any = {};
                if (contentType && contentType.includes('application/json')) {
                  data = await res.json();
                } else {
                  const text = await res.text();
                  if (res.status === 404) {
                    alert('Endpoint /api/broadcast is not active on this deployment (404). Please ensure the latest commit with api/broadcast.ts and vercel.json is deployed.');
                    return;
                  }
                  alert(`Server returned non-JSON response (${res.status}):\n${text.slice(0, 150)}`);
                  return;
                }

                if (res.ok) {
                  const mob = data.mobileCount ?? 0;
                  const desk = data.desktopCount ?? 0;
                  alert(`Test Broadcast Sent Successfully!\n\nDelivered to: ${data.sentCount || 0} active device(s)\n📱 Mobile devices: ${mob}\n💻 Desktop devices: ${desk}\n\nFailures: ${data.failureCount || 0}`);
                } else {
                  alert(`Test Failed: ${data.error || data.details || 'Unknown error'}`);
                }
              } catch (err: any) {
                alert(`Network/Client Error:\n${err.message}`);
              }
            }}
            className={cn("text-xs font-semibold text-slate-400 transition-colors mr-auto", theme.hoverClass.replace('hover:bg-', 'hover:text-'))}
          >
            Send Test Push
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave('draft')}
            className="px-6 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            {loading && isDrafting ? 'Saving...' : 'Save as Draft'}
          </button>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 text-white font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50",
              theme.bgClass,
              theme.hoverClass
            )}
          >
            {loading && !isDrafting ? 'Processing...' : (scheduledAt ? 'Schedule' : 'Broadcast Now')}
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function MultiSelect({ label, options, selected, onChange, theme }: { 
  label: string, 
  options: string[], 
  selected: string[], 
  onChange: (vals: string[]) => void,
  theme: any
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (opt: string) => {
    if (opt === 'All') {
      onChange(['All']);
    } else {
      let next = selected.filter(s => s !== 'All');
      if (next.includes(opt)) {
        next = next.filter(s => s !== opt);
        if (next.length === 0) next = ['All'];
      } else {
        next.push(opt);
      }
      onChange(next);
    }
  };

  const displayText = selected.includes('All') ? `All ${label}` : `${selected.length} ${label} selected`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white hover:bg-slate-50 transition-colors shadow-xs"
      >
        <span className="truncate pr-2 font-medium text-slate-700">{displayText}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[70] py-2 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
            {options.map(opt => {
              const isSel = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleOption(opt)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center transition-all",
                    isSel ? cn(theme.bgClass, "border-transparent") : "border-slate-300 bg-white"
                  )}>
                    {isSel && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className={cn("text-xs transition-colors", isSel ? "font-bold text-slate-900" : "text-slate-600")}>
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
