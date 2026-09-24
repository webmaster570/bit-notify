import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

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

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      try {
        if (!isMounted) return;
        setUser(user);
        
        if (user) {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (isMounted) {
            if (docSnap.exists()) {
              setProfile({ uid: user.uid, ...docSnap.data() } as UserProfile);
            } else {
              setProfile(null);
            }
          }
        } else {
          if (isMounted) setProfile(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Auth profile fetch error:", err);
          setError(err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
        setError("Connection timeout. Please check your internet or configuration.");
      }
    }, 15000); // Increased to 15s for slower connections

    return () => {
      isMounted = false;
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return { user, profile, loading, error };
}
