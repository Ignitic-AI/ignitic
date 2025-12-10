import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Session {
  user?: {
    token?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    [key: string]: any;
  };
  expires: string;
  [key: string]: any;
}

interface SessionState {
  currentSession: Session | null;
  setSession: (session: Session | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentSession: null,
      setSession: (session) => set({ currentSession: session }),
      clearSession: () => set({ currentSession: null }),
    }),
    {
      name: 'session-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
