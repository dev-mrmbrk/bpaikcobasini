import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, seedInitialData } from '../firebase';
import { BPAIKUser, UserRole } from '../types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  bpaikUser: BPAIKUser | null;
  isLoading: boolean;
  error: string | null;
  rememberMe: boolean;
  setRememberMe: (val: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  loginAsDemo: (role: 'ADMIN' | 'PESERTA') => Promise<void>;
  loginWithCardQr: (qrCode: string) => Promise<BPAIKUser>;
  updateUserProfile: (data: Partial<BPAIKUser>) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  bpaikUser: null,
  isLoading: true,
  error: null,
  rememberMe: true,
  setRememberMe: () => {},
  loginWithGoogle: async () => {},
  loginAsDemo: async () => {},
  loginWithCardQr: async () => { throw new Error('Not implemented'); },
  updateUserProfile: async () => {},
  logout: async () => {},
  clearError: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rememberMe, setRememberMeState] = useState<boolean>(true);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [bpaikUser, setBpaikUser] = useState<BPAIKUser | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const setRememberMe = (val: boolean) => {
    setRememberMeState(val);
  };

  // Zero localStorage: sync active session to Cloudflare D1 database (pbaik-absensi-data)
  const persistUser = (userData: BPAIKUser) => {
    fetch('/api/d1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'users',
        action: 'upsert',
        id: userData.id,
        record: userData
      })
    }).catch(e => console.warn('D1 user sync notice:', e));
  };

  const clearPersistedUser = () => {
    // zero localStorage
  };

  useEffect(() => {
    seedInitialData();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      setError(null);

      if (!user) {
        setFirebaseUser(null);
        setBpaikUser(null);
        setIsLoading(false);
        return;
      }

      setFirebaseUser(user);
      const email = user.email?.toLowerCase();

      try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const userData = snap.docs[0].data() as BPAIKUser;
          if (userData.status !== 'aktif') {
            await signOut(auth);
            clearPersistedUser();
            setBpaikUser(null);
            setError(`Akun pegawai ${email} berstatus NONAKTIF. Hubungi Admin BPAIK.`);
            setIsLoading(false);
            return;
          }
          setBpaikUser(userData);
          persistUser(userData);
        } else {
          // Check if this is a bootstrapped admin
          if (email === 'ridhwanmujahidin01@gmail.com' || email === 'eungeunyoon@gmail.com' || email === 'ridhwan.mbrk@gmail.com') {
            const adminProfile: BPAIKUser = {
              id: user.uid,
              email: email,
              name: user.displayName || (email === 'ridhwanmujahidin01@gmail.com' ? 'Ridhwan Mujahidin (Admin BPAIK)' : (email === 'eungeunyoon@gmail.com' ? 'Admin Utama BPAIK' : 'Ridhwan Mubarak, S.Ag., M.Ag.')),
              npp: 'NPP. 0422019800',
              jabatan: 'Administrator BPAIK',
              whatsapp: '081223344550',
              role: 'ADMIN',
              status: 'aktif',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', user.uid), adminProfile);
            setBpaikUser(adminProfile);
            persistUser(adminProfile);
          } else {
            await addDoc(collection(db, 'auditLogs'), {
              action: 'LOGIN_UNAUTHORIZED',
              actorEmail: email || 'unknown',
              actorName: user.displayName || 'Pengguna Tidak Terdaftar',
              actorRole: 'GUEST',
              targetType: 'AUTH',
              targetId: user.uid,
              description: `Percobaan masuk gagal: Email ${email} tidak tercatat di daftar resmi BPAIK UNISA Bandung`,
              timestamp: new Date().toISOString()
            });

            await signOut(auth);
            clearPersistedUser();
            setFirebaseUser(null);
            setBpaikUser(null);
            setError(`Akun Google (${email}) tidak terdaftar dalam data resmi BPAIK UNISA Bandung.`);
          }
        }
      } catch (err: unknown) {
        console.error('Auth check error:', err);
        setError('Gagal memverifikasi status pengguna di server BPAIK.');
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [rememberMe]);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      clearPersistedUser();
      // Set persistence based on rememberMe checkbox
      try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      } catch (e) {
        // persistence fallback if in strict iframe
      }
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Login popup error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal melakukan login Google';
      if (!msg.includes('popup-closed-by-user')) {
        setError(msg);
      }
      setIsLoading(false);
    }
  };

  const loginAsDemo = async (role: 'ADMIN' | 'PESERTA') => {
    setIsLoading(true);
    setError(null);
    const fallbackUser: BPAIKUser = role === 'ADMIN' ? {
      id: 'admin_bpaik',
      email: 'admin.bpaik@unisa-bandung.ac.id',
      name: 'Admin Utama BPAIK',
      npp: 'NPP. 0422019800',
      jabatan: 'Administrator BPAIK',
      whatsapp: '081223344550',
      role: 'ADMIN',
      status: 'aktif',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } : {
      id: 'peserta_hamzah',
      email: 'peserta.bpaik@gmail.com',
      name: 'Dr. H. Hamzah Arifin, M.Ag.',
      npp: 'NPP. 0415038102',
      jabatan: 'Dosen / Peserta Kajian',
      whatsapp: '081234567890',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      role: 'PESERTA',
      qrUniqueCode: 'BPAIK-KARTU-0415038102-HAMZAH',
      status: 'aktif',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const docId = role === 'ADMIN' ? 'admin_bpaik' : 'peserta_hamzah';
      const snap = await getDoc(doc(db, 'users', docId));
      if (snap.exists()) {
        const u = snap.data() as BPAIKUser;
        setBpaikUser(u);
        persistUser(u);
      } else {
        try {
          await setDoc(doc(db, 'users', docId), fallbackUser);
        } catch (writeErr) {
          console.warn('Notice writing demo user to Firestore:', writeErr);
        }
        setBpaikUser(fallbackUser);
        persistUser(fallbackUser);
      }
    } catch (err) {
      console.warn('Demo login Firestore read notice, using local fallback:', err);
      setBpaikUser(fallbackUser);
      persistUser(fallbackUser);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithCardQr = async (rawCode: string): Promise<BPAIKUser> => {
    setIsLoading(true);
    setError(null);
    const code = rawCode.trim();

    // Normalization variations for matching
    const cleanAlpha = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanDigits = code.replace(/\D/g, '');

    try {
      let targetUser: BPAIKUser | null = null;

      // 1. Try querying Firestore with multiple conditions safely
      try {
        const usersRef = collection(db, 'users');

        // Query 1: exact qrUniqueCode match
        const qQr = query(usersRef, where('qrUniqueCode', '==', code));
        const snapQr = await getDocs(qQr);
        if (!snapQr.empty) {
          targetUser = { ...snapQr.docs[0].data(), id: snapQr.docs[0].id } as BPAIKUser;
        }

        // Query 2: exact npp match
        if (!targetUser) {
          const qNpp = query(usersRef, where('npp', '==', code));
          const snapNpp = await getDocs(qNpp);
          if (!snapNpp.empty) {
            targetUser = { ...snapNpp.docs[0].data(), id: snapNpp.docs[0].id } as BPAIKUser;
          }
        }

        // Query 3: direct doc ID match
        if (!targetUser) {
          try {
            const docSnap = await getDoc(doc(db, 'users', code));
            if (docSnap.exists()) {
              targetUser = { ...docSnap.data(), id: docSnap.id } as BPAIKUser;
            }
          } catch (_) {
            // ignore doc id lookup error
          }
        }

        // Query 4: broad scan if not found yet
        if (!targetUser) {
          const allSnap = await getDocs(usersRef);
          allSnap.forEach(d => {
            if (targetUser) return;
            const u = { ...d.data(), id: d.id } as BPAIKUser;
            const uQrClean = (u.qrUniqueCode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const uNppClean = (u.npp || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const uNppDigits = (u.npp || '').replace(/\D/g, '');
            const uIdClean = u.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const uEmail = (u.email || '').toLowerCase();

            if (
              (u.qrUniqueCode && u.qrUniqueCode === code) ||
              (uQrClean && (uQrClean === cleanAlpha || cleanAlpha.includes(uQrClean) || uQrClean.includes(cleanAlpha))) ||
              (uNppClean && (uNppClean === cleanAlpha || cleanAlpha.includes(uNppClean))) ||
              (cleanDigits.length >= 6 && uNppDigits && (cleanDigits === uNppDigits || cleanDigits.includes(uNppDigits) || uNppDigits.includes(cleanDigits))) ||
              uIdClean === cleanAlpha ||
              uEmail === code.toLowerCase()
            ) {
              targetUser = u;
            }
          });
        }
      } catch (firestoreErr) {
        console.warn('Firestore read notice during card login, falling back to local registry:', firestoreErr);
      }

      // 2. Built-in system registry fallback (Hamzah, Admin BPAIK, etc.)
      if (!targetUser) {
        const isHamzah = 
          cleanDigits.includes('0415038102') || 
          cleanAlpha.includes('hamzah') || 
          cleanAlpha.includes('0415038102') ||
          code.includes('0415038102') ||
          code.toLowerCase().includes('hamzah');

        const isAdmin = 
          cleanDigits.includes('0422019800') || 
          cleanAlpha.includes('admin') || 
          cleanAlpha.includes('0422019800') ||
          code.includes('0422019800') ||
          code.toLowerCase().includes('admin');

        if (isHamzah) {
          targetUser = {
            id: 'peserta_hamzah',
            email: 'peserta.bpaik@gmail.com',
            name: 'Dr. H. Hamzah Arifin, M.Ag.',
            npp: 'NPP. 0415038102',
            jabatan: 'Dosen / Peserta Kajian',
            whatsapp: '081234567890',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
            role: 'PESERTA',
            qrUniqueCode: 'BPAIK-KARTU-0415038102-HAMZAH',
            status: 'aktif',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        } else if (isAdmin) {
          targetUser = {
            id: 'admin_bpaik',
            email: 'admin.bpaik@unisa-bandung.ac.id',
            name: 'Admin Utama BPAIK',
            npp: 'NPP. 0422019800',
            jabatan: 'Administrator BPAIK',
            whatsapp: '081223344550',
            role: 'ADMIN',
            status: 'aktif',
            qrUniqueCode: 'BPAIK-KARTU-0422019800-ADMIN',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
      }

      if (!targetUser) {
        throw new Error(`Kartu dengan kode "${code}" tidak ditemukan. Pastikan QR atau kode NPP valid.`);
      }

      if (targetUser.status !== 'aktif') {
        throw new Error(`Akun kartu "${targetUser.name}" berstatus ${targetUser.status.toUpperCase()}. Silakan hubungi Admin BPAIK.`);
      }

      setBpaikUser(targetUser);
      persistUser(targetUser);
      return targetUser;
    } catch (err: unknown) {
      console.error('Login with Card QR error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal memindai kartu peserta';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (data: Partial<BPAIKUser>) => {
    if (!bpaikUser) return;
    try {
      const updated = {
        ...bpaikUser,
        ...data,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'users', bpaikUser.id), updated);
      setBpaikUser(updated);
      persistUser(updated);
    } catch (err) {
      console.error('Update profile error:', err);
      throw err;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      clearPersistedUser();
      await signOut(auth);
      setFirebaseUser(null);
      setBpaikUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        bpaikUser,
        isLoading,
        error,
        rememberMe,
        setRememberMe,
        loginWithGoogle,
        loginAsDemo,
        loginWithCardQr,
        updateUserProfile,
        logout,
        clearError: () => setError(null)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
