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
  setCurrentOrg: (orgId: string) => void;
  clearCurrentOrg: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      organizations: [],
      currentOrg: null,

      setOrganizations: (orgs) => set({ organizations: orgs }),

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
