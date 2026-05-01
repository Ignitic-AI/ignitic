import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware'

interface Organization {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  role: string;
  createdAt: string;
  subscription_plan: string;
  ecommerce_domain: string;
  industry: string;
  company_size: string;
  website: string;
  country: string;
  city: string;
  status?: string;        
  address?: string;       
  phone_number?: string;  
}

interface OrgState {
  organizations: Organization[];
  currentOrg: Organization | null;

  setOrganizations: (orgs: Organization[]) => void;
  syncOrganizations: (orgs: Organization[]) => void;
  removeOrganization: (orgId: string) => void;
  setCurrentOrg: (orgId: string) => void;
  clearCurrentOrg: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      organizations: [],
      currentOrg: null,

      syncOrganizations: (orgs) =>
        set((state) => {
          const nextCurrentOrg = state.currentOrg
            ? orgs.find((org) => org.id === state.currentOrg?.id) || null
            : null
          return { organizations: orgs, currentOrg: nextCurrentOrg }
        }),

      setOrganizations: (orgs) => get().syncOrganizations(orgs),

      removeOrganization: (orgId) =>
        set((state) => {
          const nextOrganizations = state.organizations.filter(
            (org) => org.id !== orgId
          )
          const nextCurrentOrg =
            state.currentOrg?.id === orgId ? null : state.currentOrg
          return { organizations: nextOrganizations, currentOrg: nextCurrentOrg }
        }),

      setCurrentOrg: (orgId) => {
        const org = get().organizations.find((o) => o.id === orgId) || null
        set({ currentOrg: org })
      },

      clearCurrentOrg: () => set({ currentOrg: null }),
    }),
    {
      name: 'org-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
