import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GraduationCap, Shield, Landmark, Bell, BookOpen, Sparkles, Mail, Lock, User, Calendar, Building } from 'lucide-react';
import { cn } from '../lib/utils';
import { useBranding } from '../context/BrandingContext';

export function AuthView() {
  const { branding, theme } = useBranding();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Student');
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [systemConfig, setSystemConfig] = useState<{ roles: string[], departments: string[] } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'system', 'config'));
        if (configSnap.exists()) {
          const data = configSnap.data();
          const roles = data.roles || ['Faculty', 'Staff', 'Student', 'PhD Scholars'];
          const departments = data.departments || ['ICT', 'Mathematics', 'Physics', 'Chemistry', 'Business', 'Engineering'];
          setSystemConfig({ roles, departments });
          if (roles.length > 0) setRole(roles[0]);
          if (departments.length > 0) setDepartment(departments[0]);
        } else {
          // Fallback if document doesn't exist yet
          setSystemConfig({
            roles: ['Faculty', 'Staff', 'Student', 'PhD Scholars'],
            departments: ['ICT', 'Mathematics', 'Physics', 'Chemistry', 'Business', 'Engineering']
          });
        }
      } catch (err) {
        console.warn('Could not fetch system config:', err);
      }
    };
    fetchConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        
        // Map academic role to system permission role
        let systemRole: 'student' | 'faculty' | 'admin' = 'student';
        if (role === 'Faculty' || role === 'Staff') {
          systemRole = 'faculty';
        }

        // If email contains admin keywords, override for safety
        if (email.toLowerCase().includes('admin') || email.toLowerCase().includes('webmaster')) {
          systemRole = 'admin';
        }

        try {
          await setDoc(doc(db, 'users', user.uid), {
            name,
            email,
            role: systemRole,
            category: role, // Institutional category (Student, Staff, etc)
            department,
            course: (role === 'Student' || role === 'PhD Scholars') ? course : null,
            academicYear: (role === 'Student' || role === 'PhD Scholars') ? academicYear : null,
            createdAt: new Date(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      if (err.message?.includes('auth/operation-not-allowed')) {
        setError('Email/Password registration is not enabled yet. Please enable it in the Firebase Console.');
      } else {
        setError(err.message || 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.title}
              className="h-16 w-16 object-contain rounded-2xl shadow-md p-1 bg-white border border-slate-200"
            />
          ) : (
            <div className={cn("p-3.5 rounded-2xl shadow-md text-white", theme.bgClass)}>
              {branding.presetIcon === 'shield' && <Shield className="h-9 w-9" />}
              {branding.presetIcon === 'landmark' && <Landmark className="h-9 w-9" />}
              {branding.presetIcon === 'bell' && <Bell className="h-9 w-9" />}
              {branding.presetIcon === 'book' && <BookOpen className="h-9 w-9" />}
              {branding.presetIcon === 'sparkles' && <Sparkles className="h-9 w-9" />}
              {(!branding.presetIcon || branding.presetIcon === 'graduation') && <GraduationCap className="h-9 w-9" />}
            </div>
          )}
        </div>
        <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {branding.title || 'EduNotify'}
        </h2>
        <p className="mt-1 text-center text-xs font-semibold text-slate-500">
          {branding.institutionName || 'Campus Broadcast System'}
        </p>
        <p className="mt-1 text-center text-xs text-slate-400">
          {isLogin ? "Sign in to access your campus announcements" : "Create an account on the institutional network"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-100 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Full Name</label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={cn(
                        "block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm",
                        "focus:ring-" + theme.id + "-500",
                        "focus:border-" + theme.id + "-500"
                      )}
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Institutional Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={cn(
                      "mt-1 block w-full pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none sm:text-sm rounded-lg",
                      "focus:ring-" + theme.id + "-500",
                      "focus:border-" + theme.id + "-500"
                    )}
                  >
                    {systemConfig?.roles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    {!systemConfig && (
                      <>
                        <option value="Student">Student</option>
                        <option value="Faculty">Faculty</option>
                        <option value="Staff">Staff</option>
                        <option value="PhD Scholars">PhD Scholars</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Department</label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-slate-400" />
                    </div>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      required
                      className={cn(
                        "block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm",
                        "focus:ring-" + theme.id + "-500",
                        "focus:border-" + theme.id + "-500"
                      )}
                    >
                      {systemConfig?.departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      {!systemConfig && (
                        <option value="">Select Department</option>
                      )}
                    </select>
                  </div>
                </div>

                {(role === 'Student' || role === 'PhD Scholars') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Course</label>
                      <div className="mt-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <BookOpen className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          required
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          className={cn(
                            "block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm",
                            "focus:ring-" + theme.id + "-500",
                            "focus:border-" + theme.id + "-500"
                          )}
                          placeholder="B.Tech"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Year</label>
                      <div className="mt-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Calendar className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          required
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          className={cn(
                            "block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm",
                            "focus:ring-" + theme.id + "-500",
                            "focus:border-" + theme.id + "-500"
                          )}
                          placeholder="2024"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700">Email Address</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm",
                    "focus:ring-" + theme.id + "-500",
                    "focus:border-" + theme.id + "-500"
                  )}
                  placeholder="name@institute.edu"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm",
                    "focus:ring-" + theme.id + "-500",
                    "focus:border-" + theme.id + "-500"
                  )}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                  theme.bgClass,
                  theme.hoverClass
                )}
              >
                {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className={cn(
                  "w-full flex justify-center py-2 px-4 border rounded-lg shadow-sm text-sm font-medium transition-colors",
                  theme.borderClass,
                  theme.textClass,
                  "bg-white hover:bg-slate-50"
                )}
              >
                {isLogin ? 'Register New Account' : 'Back to Login'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
