import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'faculty' | 'student';
  name: string;
  department?: string;
  academicYear?: string;
  course?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      try {
        if (!isMounted) return;

        if (currentUser) {
          // Keep loading true while fetching the profile to prevent flashing
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (isMounted) {
            setUser(currentUser);

            if (docSnap.exists()) {
              const data = docSnap.data();
              setProfile({
                uid: currentUser.uid,
                email: currentUser.email || data.email || '',
                role: data.role || (currentUser.email?.includes('admin') || currentUser.email?.includes('webmaster') ? 'admin' : 'student'),
                name: data.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'Campus User',
                department: data.department || 'All',
                academicYear: data.academicYear || 'All',
                course: data.course || 'All',
                ...data,
              } as UserProfile);
            } else {
              // Auto-create and populate user profile so user never sees "Complete Profile" screen
              const isAdmin = currentUser.email?.includes('admin') || currentUser.email?.includes('webmaster');
              const autoProfile: UserProfile = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                name: currentUser.displayName || currentUser.email?.split('@')[0] || (isAdmin ? 'Administrator' : 'Student'),
                role: isAdmin ? 'admin' : 'student',
                department: 'All',
                academicYear: 'All',
                course: 'All',
              };

              setProfile(autoProfile);

              // Persist in background so document exists in Firestore
              setDoc(doc(db, 'users', currentUser.uid), {
                ...autoProfile,
                createdAt: new Date(),
              }, { merge: true }).catch((err) => {
                console.warn('Could not auto-persist profile in users collection:', err);
              });
            }
          }
        } else {
          if (isMounted) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Auth profile fetch error:", err);
          // If Firestore query fails, fallback to auto profile so user is not blocked
          if (currentUser) {
            const isAdmin = currentUser.email?.includes('admin') || currentUser.email?.includes('webmaster');
            const fallbackProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || currentUser.email?.split('@')[0] || (isAdmin ? 'Administrator' : 'Student'),
              role: isAdmin ? 'admin' : 'student',
              department: 'All',
              academicYear: 'All',
              course: 'All',
            };
            setUser(currentUser);
            setProfile(fallbackProfile);
          } else {
            setError(err.message);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
      }
    }, 10000);

    return () => {
      isMounted = false;
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return { user, profile, loading, error };
}
