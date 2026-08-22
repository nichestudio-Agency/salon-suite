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
import type { UserRole } from "../domain/models";

interface AuthState {
  loading: boolean;
  user: User | null;
  role: UserRole | null;
  salonId: string | null;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  user: null,
  role: null,
  salonId: null,
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
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
      unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
        const data = snap.data();
        setState({
          loading: false,
          user,
          role: (data?.ruolo as UserRole) ?? null,
          salonId: (data?.salonId as string) ?? null,
        });
      });
    });
    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
