import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/app";
import { getUserProfile } from "../firebase/auth";
import type { UserRole } from "../domain/models";

interface AuthState {
  loading: boolean;
  user: User | null;
  role: UserRole | null;
  salonId: string | null;
}

const AuthContext = createContext<AuthState>({
  loading: false,
  user: null,
  role: null,
  salonId: null,
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const useEmulator = import.meta.env?.VITE_USE_EMULATOR === "true";
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    role: null,
    salonId: null,
  });

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (!user) {
        setState({ loading: false, user: null, role: null, salonId: null });
        return;
      }
      setState((s) => ({ ...s, loading: true, user }));
      if (useEmulator) {
        void user.getIdToken().then((idToken) => getUserProfile(user.uid, idToken)).then((data) => {
          setState({
            loading: false,
            user,
            role: data?.ruolo ?? null,
            salonId: data?.salonId ?? null,
          });
        }).catch(() => {
          setState({ loading: false, user, role: null, salonId: null });
        });
        return;
      }
      unsubProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          const data = snap.data();
          setState({
            loading: false,
            user,
            role: (data?.ruolo as UserRole) ?? null,
            salonId: (data?.salonId as string) ?? null,
          });
        },
        () => {
          setState({ loading: false, user, role: null, salonId: null });
        }
      );
    });
    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, [useEmulator]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
