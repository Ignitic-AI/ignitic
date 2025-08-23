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
        "http://localhost:8080/api/v1/organizations",
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
    } catch (error) {
      console.error("❌ Failed to create organization:", error);
      toast.error("Failed to create organization");
    }
  };

  return (
     <div className="w-3/4 mx-auto p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="text-text font-generalSans">
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-2xl font-bold">Create New Organization</h1>
          <p className="text-lg text-muted-foreground -mt-1">
            Set up a new organization for your team
          </p>
        </div>

        {/* Form Fields */}
        <div className="grid gap-6 py-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-lg">Organization Name*</Label>
                <Input id="name" {...register("name")} required />
                {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="industry" className="text-lg">Industry</Label>
                <Input id="industry" placeholder="Technology" {...register("industry")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="website" className="text-lg">Website</Label>
                <Input id="website" placeholder="www.example.com" {...register("website")} />
                {errors.website && <p className="text-red-500 text-sm">{errors.website.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="city" className="text-lg">City</Label>
                <Input id="city" placeholder="Lahore" {...register("city")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address" className="text-lg">Address</Label>
                <Input id="address" placeholder="123 Main St" {...register("address")} />
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="description" className="text-lg">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your organization"
                  rows={3}
                  {...register("description")}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company_size" className="text-lg">Company Size</Label>
                <Select onValueChange={(val) => setValue("company_size", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (1-50)</SelectItem>
                    <SelectItem value="medium">Medium (51-200)</SelectItem>
                    <SelectItem value="large">Large (201+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="country" className="text-lg">Country</Label>
                <Input id="country" placeholder="United States" {...register("country")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone_number" className="text-lg">Phone Number</Label>
                <Input id="phone_number" placeholder="+92 XXXXXXXXXX" {...register("phone_number")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ecommerce_domain" className="text-lg">E-commerce Domain</Label>
                <Input
                  id="ecommerce_domain"
                  placeholder="e.g. fashion, electronics"
                  {...register("ecommerce_domain")}
                />
              </div>
            </div>
          </div>

          {/* Subscription Plan */}
          <div className="grid gap-2">
            <Label htmlFor="subscription_plan" className="text-lg">Subscription Plan*</Label>
            <Select onValueChange={(val) => setValue("subscription_plan", val)}>
              <SelectTrigger>
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
          <Button type="button" variant="outline" className="bg-danger">
            Cancel
          </Button>
          <Button type="submit" className="bg-success">
            Create Organization
          </Button>
        </div>
      </form>
    </div>
  );
}
