import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useSessionStore } from './useSessionStore';
import { API_V1_BASE_URL } from '@/lib/api';

function employeeCountFromCompanySize(size: string): number {
  switch (size) {
    case 'Just me (1)':
      return 1;
    case 'Small team (2-10)':
      return 5;
    case 'Medium team (11-50)':
      return 25;
    case 'Large team (51-200)':
      return 100;
    case 'Enterprise (200+)':
      return 500;
    default:
      return 1;
  }
}

function apiErrorMessage(data: Record<string, unknown>, status: number): string {
  const msg = data.message ?? data.error;
  if (typeof msg === 'string') return msg;
  return `Request failed (${status})`;
}

interface OnboardingFormData {
  isOrg: boolean;
  orgName: string;
  platform: string;
  workOnMultiplePlatforms: boolean;
  selectedBrands: string[];

  sizeOfOrg: string;
  yourRole: string;
  country: string;
  whereYouHearUs: string;

  invitedEmails: string[];
  emailInput: string;

  automations: string[];

  createdOrgId: string | null;
}

interface OnboardingState {
  formData: OnboardingFormData;
  isSubmitting: boolean;
  error: string | null;

  updateStep1: (data: Partial<Pick<OnboardingFormData, 'isOrg' | 'orgName' | 'platform' | 'workOnMultiplePlatforms' | 'selectedBrands'>>) => void;
  updateStep2: (data: Partial<Pick<OnboardingFormData, 'sizeOfOrg' | 'yourRole' | 'country' | 'whereYouHearUs'>>) => void;
  updateStep3: (data: Partial<Pick<OnboardingFormData, 'invitedEmails' | 'emailInput'>>) => void;
  updateStep4: (data: Partial<Pick<OnboardingFormData, 'automations'>>) => void;
  submitOrganization: () => Promise<boolean>;
  addMembers: () => Promise<void>;
  completeOnboarding: () => Promise<boolean>;
  resetForm: () => void;
}

const initialFormData: OnboardingFormData = {
  isOrg: false,
  orgName: '',
  platform: '',
  workOnMultiplePlatforms: false,
  selectedBrands: [],
  sizeOfOrg: '',
  yourRole: '',
  country: '',
  whereYouHearUs: 'Facebook',

  invitedEmails: [],
  emailInput: '',
  automations: [],
  createdOrgId: null,
};

const API = API_V1_BASE_URL;

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      formData: initialFormData,
      isSubmitting: false,
      error: null,

      updateStep1: (data) => set((state) => ({
        formData: { ...state.formData, ...data }
      })),

      updateStep2: (data) => set((state) => ({
        formData: { ...state.formData, ...data }
      })),

      updateStep3: (data) => set((state) => ({
        formData: { ...state.formData, ...data }
      })),

      updateStep4: (data) => set((state) => ({
        formData: { ...state.formData, ...data }
      })),

      submitOrganization: async () => {
        const { formData } = get();

        const payload = {
          name: formData.orgName,
          description: '',
          employee_count: employeeCountFromCompanySize(formData.sizeOfOrg),
          ecommerce_domain: '',
          industry: '',
          company_size: formData.sizeOfOrg,
          website: formData.platform,
          country: formData.country,
          city: '',
          address: '',
          phone_number: '',
          subscription_plan: '',
          hear_about_us: formData.whereYouHearUs,
          work_on_multiple_platforms: formData.workOnMultiplePlatforms,
          selected_brands: formData.selectedBrands,
          creator_job_title: formData.yourRole,
        };

        set({ isSubmitting: true, error: null });

        try {
          const token = useSessionStore.getState().currentSession?.user?.token;

          const response = await fetch(`${API}/organizations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
            throw new Error(apiErrorMessage(errorData, response.status));
          }

          const data = await response.json() as { organization?: { id?: string } };

          set((state) => ({
            isSubmitting: false,
            formData: { ...state.formData, createdOrgId: data.organization?.id ?? null }
          }));
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          set({ isSubmitting: false, error: errorMessage });
          console.error('Error creating organization:', error);
          return false;
        }
      },

      addMembers: async () => {
        const { formData } = get();
        const orgId = formData.createdOrgId;
        const emails = formData.invitedEmails;

        if (!orgId || emails.length === 0) return;

        const token = useSessionStore.getState().currentSession?.user?.token;

        try {
          await Promise.all(
            emails.map(async (email) => {
              try {
                const response = await fetch(`${API}/organizations/${orgId}/members`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    email: email,
                    role: 'member'
                  }),
                });

                if (!response.ok) {
                  console.error(`Failed to invite ${email}: ${response.statusText}`);
                }
              } catch (err) {
                console.error(`Error inviting ${email}:`, err);
              }
            })
          );
        } catch (error) {
          console.error('Error in addMembers:', error);
        }
      },

      completeOnboarding: async () => {
        const { formData } = get();
        const token = useSessionStore.getState().currentSession?.user?.token;

        if (!token) {
          set({ error: 'Not authenticated' });
          return false;
        }

        set({ isSubmitting: true, error: null });

        try {
          if (formData.createdOrgId) {
            const response = await fetch(`${API}/organizations/${formData.createdOrgId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                preferred_automation_ids: formData.automations,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
              throw new Error(apiErrorMessage(errorData, response.status));
            }
          } else {
            const body = {
              has_organization: formData.isOrg,
              created_organization: false,
              org_name: formData.orgName,
              platform: formData.platform,
              work_on_multiple_platforms: formData.workOnMultiplePlatforms,
              selected_brands: formData.selectedBrands,
              size_of_org: formData.sizeOfOrg,
              your_role: formData.yourRole,
              country: formData.country,
              where_you_hear_us: formData.whereYouHearUs,
              preferred_automation_ids: formData.automations,
              invited_emails: formData.invitedEmails,
            };

            const response = await fetch(`${API}/auth/onboarding/personal`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(body),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
              throw new Error(apiErrorMessage(errorData, response.status));
            }
          }

          set({ isSubmitting: false });
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          set({ isSubmitting: false, error: errorMessage });
          console.error('completeOnboarding:', error);
          return false;
        }
      },

      resetForm: () => set({ formData: initialFormData, error: null }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
