/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthView } from './components/AuthView';
import { AdminDashboard } from './components/AdminDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { Loader2 } from 'lucide-react';
import { requestForToken, onMessageListener } from './lib/firebase';

export default function App() {
  const { user, profile, loading, error } = useAuth();

  useEffect(() => {
    if (user) {
      requestForToken();
      
      onMessageListener().then((payload: any) => {
        console.log('Received foreground message: ', payload);
        // You could show a toast here if you want
      });
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-slate-500 text-sm animate-pulse text-center px-4">Connecting to EduNotify services...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 max-w-md">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  if (!profile) {
    return <CompleteProfileView user={user} />;
  }

  if (profile.role === 'admin') {
    return <AdminDashboard profile={profile} />;
  }

  return <StudentDashboard profile={profile} />;
}

import { signOut } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

function CompleteProfileView({ user }: { user: any }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'faculty' | 'admin'>('student');
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await setDoc(doc(db, 'users', user.uid), {
        name,
        email: user.email,
        role,
        department,
        course: role === 'student' ? course : null,
        academicYear: role === 'student' ? academicYear : null,
        createdAt: new Date(),
      });
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-100 rounded-2xl sm:px-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Complete Your Profile</h2>
          <p className="text-slate-600 text-sm mb-8">We just need a few more details to set up your account.</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty Staff</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Department</label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g. Computer Science"
              />
            </div>

            {role === 'student' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Course</label>
                  <input
                    type="text"
                    required
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="B.Tech"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Year</label>
                  <input
                    type="text"
                    required
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="2024"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Finish Setup'}
              </button>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="w-full flex justify-center py-2 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
              >
                Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
