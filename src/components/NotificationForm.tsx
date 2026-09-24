import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send, Clock, Target, AlertCircle, Paperclip, Upload, FileText, X } from 'lucide-react';
import { cn } from '../lib/utils';

export function NotificationForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('update');
  const [targetDept, setTargetDept] = useState('All');
  const [targetYear, setTargetYear] = useState('All');
  const [targetCourse, setTargetCourse] = useState('All');
  const [scheduledAt, setScheduledAt] = useState('');
  const [attachment, setAttachment] = useState<{ name: string, data: string, type: string } | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        title,
        body,
        priority,
        category,
        attachment,
        targetGroup: {
          department: targetDept,
          academicYear: targetYear,
          course: targetCourse,
        },
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdAt: serverTimestamp(),
        status: scheduledAt ? 'scheduled' : 'sent',
        deliveryStats: {
          sentCount: 0,
          readCount: 0,
        },
      });

      // Trigger push notification via backend if not scheduled for later
      if (!scheduledAt) {
        try {
          await fetch('/api/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              body,
              targetGroup: {
                department: targetDept,
                academicYear: targetYear,
                course: targetCourse,
              }
            })
          });
        } catch (pushErr) {
          console.error('Failed to trigger push notification:', pushErr);
        }
      }

      setTitle('');
      setBody('');
      setScheduledAt('');
      onSuccess();
    } catch (err) {
      console.error('Error adding notification:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Send className="h-5 w-5 text-blue-600" />
          Create Broadcast
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
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
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
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Dept (All)"
                  value={targetDept}
                  onChange={(e) => setTargetDept(e.target.value)}
                  className="px-2 py-2 border border-slate-200 rounded-lg text-xs"
                />
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
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
                        className="ml-2 p-1 hover:bg-blue-100 rounded-full"
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

        <div className="pt-4 flex items-center justify-end border-t border-slate-100">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Broadcast Now'}
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
