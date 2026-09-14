"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";
import { useSession} from "next-auth/react"
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { API_V1_BASE_URL } from "@/lib/api";

// Organization interface
interface Organization {
  id?: string;
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

// --- Validation Schema aligned with Organization interface ---
const orgSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  description: z.string(),
  memberCount: z.number().min(0).default(1), 
  role: z.string().default("owner"),
  createdAt: z.string().default(() => new Date().toISOString()),
  subscription_plan: z.string().min(1, "Select a subscription plan"),
  ecommerce_domain: z.string(),
  industry: z.string(),
  company_size: z.string(),
  website: z
    .string()
    .url({ message: "Invalid URL" })
    .or(z.literal("")),
  country: z.string(),
  city: z.string(),
  status: z.string().default("active").optional(),
  address: z.string().optional(),
  phone_number: z.string().optional(),
});

export default function CreateOrganizationPage() {
  const { data: session, status } = useSession()
  const router = useRouter();

  const {
  register,
  handleSubmit,
  setValue,
  reset,
  formState: { errors },
} = useForm({
  resolver: zodResolver(orgSchema),
  defaultValues: {
    name: "",
    description: "",
    memberCount: 1,
    role: "owner",
    createdAt: new Date().toISOString(),
    subscription_plan: "",
    ecommerce_domain: "",
    industry: "",
    company_size: "",
    website: "",
    country: "",
    city: "",
    status: "active",
    address: "",
    phone_number: "",
  },
});


  const onSubmit = async (data: z.infer<typeof orgSchema>) => {
    try {
      const response = await axios.post(
        `${API_V1_BASE_URL}/organizations`,
        {
          name: data.name,
          description: data.description,
          employee_count: data.memberCount,
          ecommerce_domain: data.ecommerce_domain,
          industry: data.industry,
          company_size: data.company_size,
          website: data.website,
          country: data.country,
          city: data.city,
          address: data.address,
          phone_number: data.phone_number,
          subscription_plan: data.subscription_plan,
        },
        {
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.user?.token}`,
          },
        }
      );

      toast.success("Organization created successfully");
      console.log("✅ Created organization:", response.data);

      reset(); // reset form after success
      router.push("/organization");
    } catch (error) {
      console.error("❌ Failed to create organization:", error);
      toast.error("Failed to create organization");
    }
  };

  return (
     <div className="w-3/4 mx-auto p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="text-bg font-generalSans">
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-text-lm dark:text-text">Create New Organization</h1>
          <p className="text-lg text-text-muted-lm dark:text-text-muted -mt-1">
            Set up a new organization for your team
          </p>
        </div>

        {/* Form Fields */}
        <div className="grid gap-6 py-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-lg text-text-lm dark:text-text">Organization Name*</Label>
                <Input id="name" {...register("name")} required className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white"/>
                {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="industry" className="text-lg text-text-lm dark:text-text">Industry</Label>
                <Input id="industry" placeholder="Technology" {...register("industry")} className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white"/>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="website" className="text-lg text-text-lm dark:text-text">Website</Label>
                <Input id="website" placeholder="www.example.com" {...register("website")} className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white" />
                {errors.website && <p className="text-red-500 text-sm">{errors.website.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="city" className="text-lg text-text-lm dark:text-text">City</Label>
                <Input id="city" placeholder="Lahore" {...register("city")} className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address" className="text-lg text-text-lm dark:text-text">Address</Label>
                <Input id="address" placeholder="123 Main St" {...register("address")} className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white" />
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="description" className="text-lg text-text-lm dark:text-text">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your organization"
                  rows={3}
                  {...register("description")}
                  className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company_size" className="text-lg text-text-lm dark:text-text">Company Size</Label>
                <Select onValueChange={(val) => setValue("company_size", val)} >
                  <SelectTrigger  className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white">
                    <SelectValue placeholder="Select size"className="bg-bg-light-lm dark:bg-bg-light" />
                  </SelectTrigger >
                  <SelectContent>
                    <SelectItem value="small" className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white">Small (1-50)</SelectItem>
                    <SelectItem value="medium" className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white">Medium (51-200)</SelectItem>
                    <SelectItem value="large" className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white">Large (201+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="country" className="text-lg text-text-lm dark:text-text">Country</Label>
                <Input id="country" placeholder="United States" {...register("country")} className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone_number" className="text-lg text-text-lm dark:text-text">Phone Number</Label>
                <Input id="phone_number" placeholder="+92 XXXXXXXXXX" {...register("phone_number")} className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ecommerce_domain" className="text-lg text-text-lm dark:text-text">E-commerce Domain</Label>
                <Input
                  id="ecommerce_domain"
                  placeholder="e.g. fashion, electronics"
                  {...register("ecommerce_domain")}
                  className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Subscription Plan */}
          <div className="grid gap-2">
            <Label htmlFor="subscription_plan" className="text-lg text-text-lm dark:text-text">Subscription Plan*</Label>
            <Select onValueChange={(val) => setValue("subscription_plan", val)}>
              <SelectTrigger className="bg-bg-light-lm dark:bg-bg-light text-black dark:text-white">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            {errors.subscription_plan && (
              <p className="text-red-500 text-sm">{errors.subscription_plan.message}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-4">
          <Button
            type="button"
            onClick={() => router.push("/organization")}
            className="inline-flex items-center gap-2 border-2 border-border bg-danger-lm px-4 py-2 text-sm font-medium font-generalSans text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] hover:!bg-red-500 dark:border-highlight-lm dark:bg-danger dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)] rounded-[4px]"
          >
            Back
          </Button>
          <Button
            type="submit"
            className="inline-flex items-center gap-2 border-2 border-border bg-success-lm px-4 py-2 text-sm font-medium font-generalSans text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] hover:!bg-green-500 dark:border-highlight-lm dark:bg-success dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)] rounded-[4px]"
          >
            Create Organization
          </Button>
        </div>
      </form>
    </div>
  );
}
