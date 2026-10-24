import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  User as FirebaseUser,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';

import { auth, googleProvider } from '../firebase';
import { BPAIKUser } from '../types';
import { normalizeCardQrPayload } from '../utils/cardQr';

interface AuthApiResponse {
  success?: boolean;
  error?: string;
  user?: BPAIKUser;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  bpaikUser: BPAIKUser | null;
  isLoading: boolean;
  error: string | null;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  loginWithCardQr: (qrCode: string) => Promise<BPAIKUser>;
  updateUserProfile: (data: Partial<BPAIKUser>) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

async function readApiResponse(
  response: Response
): Promise<AuthApiResponse> {
  try {
    return await response.json() as AuthApiResponse;
  } catch {
    return {};
  }
}

async function authenticateGoogleUser(
  user: FirebaseUser
): Promise<BPAIKUser> {
  const idToken = await user.getIdToken();

  const response = await fetch('/api/auth/google', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ idToken })
  });

  const result = await readApiResponse(response);

  if (!response.ok || !result.success || !result.user) {
    throw new Error(
      result.error || 'Server gagal memverifikasi akun Google melalui D1.'
    );
  }

  return result.user;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  bpaikUser: null,
  isLoading: true,
  error: null,
  rememberMe: true,
  setRememberMe: () => {},
  loginWithGoogle: async () => {},
  loginWithCardQr: async () => {
    throw new Error('Login QR belum tersedia.');
  },
  updateUserProfile: async () => {},
  logout: async () => {},
  clearError: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const [rememberMe, setRememberMeState] = useState(true);
  const [firebaseUser, setFirebaseUser] =
    useState<FirebaseUser | null>(null);
  const [bpaikUser, setBpaikUser] =
    useState<BPAIKUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestSequence = useRef(0);

  const setRememberMe = (value: boolean) => {
    setRememberMeState(value);
  };

  // Restore a server session on page load. When Firebase Google Auth
  // is present, the Worker verifies its ID token and loads the D1 profile.
  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const sequence = ++requestSequence.current;
      setIsLoading(true);

      const restore = async () => {
        if (user) {
          try {
            const profile = await authenticateGoogleUser(user);

            if (!active || sequence !== requestSequence.current) return;

            setFirebaseUser(user);
            setBpaikUser(profile);
            setError(null);
          } catch (err: unknown) {
            if (!active || sequence !== requestSequence.current) return;

            setFirebaseUser(null);
            setBpaikUser(null);
            setError(
              err instanceof Error
                ? err.message
                : 'Gagal memverifikasi akun Google.'
            );

            // A Google identity with no eligible D1 profile must not
            // remain authenticated in the client.
            await signOut(auth).catch(() => {});
          }
        } else {
          setFirebaseUser(null);

          try {
            const response = await fetch('/api/auth/me', {
              method: 'GET',
              credentials: 'same-origin',
              cache: 'no-store'
            });

            const result = await readApiResponse(response);

            if (!active || sequence !== requestSequence.current) return;

            if (response.ok && result.success && result.user) {
              setBpaikUser(result.user);
              setError(null);
            } else {
              setBpaikUser(null);

              if (response.status !== 401) {
                setError(
                  result.error || 'Server gagal memulihkan sesi login.'
                );
              }
            }
          } catch {
            if (!active || sequence !== requestSequence.current) return;

            setBpaikUser(null);
            setError(
              'Server autentikasi tidak dapat dijangkau. Periksa koneksi dan konfigurasi Worker.'
            );
          }
        }
      };

      void restore().finally(() => {
        if (active && sequence === requestSequence.current) {
          setIsLoading(false);
        }
      });
    });

    return () => {
      active = false;
      requestSequence.current++;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      ).catch(() => {
        // Some embedded browsers do not allow changing persistence.
      });

      const credential = await signInWithPopup(auth, googleProvider);
      const sequence = ++requestSequence.current;
      const profile = await authenticateGoogleUser(credential.user);

      if (sequence === requestSequence.current) {
        setFirebaseUser(credential.user);
        setBpaikUser(profile);
      }
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : 'Gagal melakukan login Google.';

      if (!message.includes('popup-closed-by-user')) {
        setError(message);
      }

      await signOut(auth).catch(() => {});
      setFirebaseUser(null);
      setBpaikUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithCardQr = async (
    rawCode: string
  ): Promise<BPAIKUser> => {
    setIsLoading(true);
    setError(null);

    try {
      // QR must match a credential stored in D1. No demo-account,
      // arbitrary NPP, email, or client-defined role fallback is used.
      const code = normalizeCardQrPayload(rawCode);

      if (!code) {
        throw new Error('QR tidak berisi kredensial kartu yang valid.');
      }

      // Switching from a previous Google login to a card identity.
      if (auth.currentUser) {
        await signOut(auth);
      }

      const sequence = ++requestSequence.current;

      const response = await fetch('/api/auth/card', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success || !result.user) {
        throw new Error(
          result.error || 'QR tidak terdaftar di database D1.'
        );
      }

      if (sequence === requestSequence.current) {
        setFirebaseUser(null);
        setBpaikUser(result.user);
      }

      return result.user;
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : 'Gagal memverifikasi QR kartu.';

      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (
    data: Partial<BPAIKUser>
  ) => {
    if (!bpaikUser) {
      throw new Error('Tidak ada sesi pengguna yang aktif.');
    }

    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: data.name,
        jabatan: data.jabatan,
        whatsapp: data.whatsapp,
        avatarUrl: data.avatarUrl
      })
    });

    const result = await readApiResponse(response);

    if (!response.ok || !result.success || !result.user) {
      throw new Error(
        result.error || 'Gagal menyimpan profil ke D1.'
      );
    }

    setBpaikUser(result.user);
  };

  const logout = async () => {
    setIsLoading(true);
    ++requestSequence.current;

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    } catch {
      // Continue clearing client auth even if the endpoint is unreachable.
    }

    try {
      await signOut(auth);
    } catch {
      // QR-only sessions have no Firebase user to sign out.
    }

    setFirebaseUser(null);
    setBpaikUser(null);
    setError(null);
    setIsLoading(false);
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
