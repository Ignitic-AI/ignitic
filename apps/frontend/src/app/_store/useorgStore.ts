import { create } from 'zustand';

interface OrgProfileState {
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  // optionally: org profiles cache, loading states, etc.
}

export const useOrgStore = create<OrgProfileState>((set) => ({
  currentOrgId: null,
  setCurrentOrgId: (id) => set({ currentOrgId: id }),
}));
