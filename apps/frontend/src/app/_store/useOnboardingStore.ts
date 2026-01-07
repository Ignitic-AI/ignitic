import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useSessionStore } from './useSessionStore';


interface OnboardingFormData {
  // Step 1
  isOrg: boolean;
  orgName: string;
  platform: string;
  workOnMultiplePlatforms: boolean;
  selectedBrands: string[];
  
  // Step 2
  sizeOfOrg: string;
  yourRole: string;
  country: string;
  whereYouHearUs: string;
  
  // Step 3
  invitedEmails: string[];
  emailInput: string;
  
  // Step 4
  automations: string[];

  // Created org
  createdOrgId: string | null;
}

interface OnboardingState {
  formData: OnboardingFormData;
  isSubmitting: boolean;
  error: string | null;
  
  // Actions
  updateStep1: (data: Partial<Pick<OnboardingFormData, 'isOrg' | 'orgName' | 'platform' | 'workOnMultiplePlatforms' | 'selectedBrands'>>) => void;
  updateStep2: (data: Partial<Pick<OnboardingFormData, 'sizeOfOrg' | 'yourRole' | 'country' | 'whereYouHearUs'>>) => void;
  updateStep3: (data: Partial<Pick<OnboardingFormData, 'invitedEmails' | 'emailInput'>>) => void;
  updateStep4: (data: Partial<Pick<OnboardingFormData, 'automations'>>) => void;
  submitOrganization: () => Promise<boolean>;
  addMembers: () => Promise<void>;
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
        
        // Map form data to API payload
        const payload = {
          name: formData.orgName,
          description: "",
          employee_count: 1,
          ecommerce_domain: "",
          industry: "",
          company_size: formData.sizeOfOrg,
          website: formData.platform,
          country: formData.country,
          city: "",
          address: "",
          phone_number: "",
          subscription_plan: ""
        };
        
        set({ isSubmitting: true, error: null });
        
        try {
          const token = useSessionStore.getState().currentSession?.user?.token;
          
          const response = await fetch('http://localhost:8080/api/v1/organizations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to create organization' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('Organization created successfully:', data);
          
          // Save the created organization ID
          set((state) => ({
            isSubmitting: false,
            formData: { ...state.formData, createdOrgId: data.organization?.id || null }
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
                const response = await fetch(`http://localhost:8080/api/v1/organizations/${orgId}/members`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    email: email,
                    role: "member"
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
      
      resetForm: () => set({ formData: initialFormData, error: null }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
