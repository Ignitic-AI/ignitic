import { z } from 'zod';

// Step 1 Validation Schema
export const step1Schema = z.object({
  isOrg: z.boolean(),
  orgName: z.string(),
  platform: z.string(),
  workOnMultiplePlatforms: z.boolean(),
  selectedBrands: z.array(z.string()),
}).refine(
  (data) => {
    // If user has org, orgName must be filled
    if (data.isOrg) {
      return data.orgName.trim().length > 0;
    }
    return true;
  },
  {
    message: "Organization Name is Required",
    path: ["orgName"],
  }
);

// Step 2 Validation Schema
export const step2Schema = z.object({
  sizeOfOrg: z.string().min(1, "Organization size is required"),
  yourRole: z.string().min(1, "Your role is required"),
  country: z.string().min(1, "Country is required"),
  whereYouHearUs: z.string(), // Optional field
});

export type Step1FormData = z.infer<typeof step1Schema>;
export type Step2FormData = z.infer<typeof step2Schema>;
