"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingLogo } from "@/components/Loading"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { NotebookTabs, UsersRound, CreditCard, Briefcase } from 'lucide-react';
import BusinessProfileTab from "@/components/BusinessProfileTab";
import { toast } from "sonner";


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

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

const Page = () => {
  const { data: session } = useSession();
  const { orgId } = useParams();
  const orgIdString = orgId as string;
  const [loading, setLoading] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  console.log("orgId", orgId);
  console.log("Session TOken", session?.user?.token);

  
  const tab = (searchParams.get("tab") as "general" | "members" | "licenses" | "businessProfile") || "general";

  const setTab = (value: "general" | "members" | "assets" | "licenses" | "businessProfile") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    if (organization && organization.role !== "admin" && tab === "businessProfile") {
      toast.error("You do not have permission to view the Business Profile.");
      setTab("general");
    }
  }, [tab, organization]);

  const [formData, setFormData] = useState({
    email: "",
    role: "member",
  });
  const [open, setOpen] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setLoading(true);
    const fetchOrg = async () => {
      try {
        const config = {
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.user?.token}`,
          },
        };

        const res = await axios.get<any>(
          `http://localhost:8080/api/v1/organizations/${orgId}`,
          config
        );

        const org: Organization = {
          id: res.data.id,
          name: res.data.name,
          description: res.data.description,
          memberCount: res.data.employee_count,
          role: res.data.user_role,
          createdAt: res.data.joined_at,
          subscription_plan: res.data.subscription_plan,
          ecommerce_domain: res.data.ecommerce_domain,
          industry: res.data.industry,
          company_size: res.data.company_size,
          website: res.data.website,
          country: res.data.country,
          city: res.data.city,
          status: "active",
          address: res.data.address || "",
          phone_number: res.data.phone_number || "",
        };

        setOrganization(org);
      } catch (err) {
        console.error("Error fetching organization:", err);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.token) fetchOrg();
  }, [session?.user?.token, orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8080/api/v1/organizations/${orgId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          Authorization: `Bearer ${session?.user?.token}`
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to add member");
      }

      // Reset form
      setFormData({ email: "", role: "member" });
      setOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch members when tab changes to "members"
  useEffect(() => {
    if (tab !== "members" || !session?.user?.token) return;

    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const config = {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${session?.user?.token}`,
          },
        };

        const res = await axios.get<any>(
          `http://localhost:8080/api/v1/organizations/${orgId}/members`,
          config
        );

        const normalizedMembers: any[] = res.data.members.map((m: any) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
        }));

        setMembers(normalizedMembers);
      } catch (err) {
        console.error("Error fetching members:", err);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [tab, session?.user?.token, orgId]);
  console.log("members", members);

  return (
    <div className="flex h-screen text-text-lm dark:text-text bg-bg-lm dark:bg-bg font-generalSans overflow-hidden">
      {/* Sidebar */}
      <div className="md:w-48 lg:w-64 border-solid border-r-2 p-4">
        <h2 className="text-lg font-semibold mb-4">Organization</h2>
        <nav className="flex flex-col space-y-3">
          
          <button
            onClick={() => setTab("general")}
            className={cn(
              "flex items-center justify-baseline text-left px-3 py-2 rounded-md hover:bg-gray-400",
              tab === "general" && "bg-info font-medium"
            )}
          >
            <NotebookTabs className="w-4 h-4 mr-2" />
            General
          </button>
          <button
            onClick={() => setTab("members")}
            className={cn(
              "flex items-center justify-baseline text-left px-3 py-2 rounded-md hover:bg-gray-400",
              tab === "members" && "bg-info font-medium"
            )}
          >
            <UsersRound className="w-4 h-4 mr-2" />
            Members
          </button>

          <button
            onClick={() => {
              if (organization && organization.role !== "admin") {
                return;
              }
              setTab("businessProfile");
            }}
            className={cn(
              "flex items-center justify-baseline text-left px-3 py-2 rounded-md hover:bg-gray-400",
              tab === "businessProfile" && "bg-info font-medium",
              organization && organization.role !== "admin" && "opacity-50"
            )}
            title={organization && organization.role !== "admin" ? "Admin access required" : ""}
          >
            <Briefcase className="w-4 h-4 mr-2" />
            Business Profile
          </button>
          
          <button
            onClick={() => setTab("licenses")}
            className={cn(
              "flex items-center justify-baseline text-left px-3 py-2 rounded-md hover:bg-gray-400",
              tab === "licenses" && "bg-info font-medium"
            )}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Licenses
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1">
        {tab === "general" && (
          <Card className="bg-bg-light-lm dark:bg-bg-light border border-gray-800 rounded-none">
            <CardContent className="space-y-6 p-6 ">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-dHighlight">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-text-lm dark:text-text">
                      {organization?.name || "Organization"}
                    </h3>
                  </div>
                </div>
                <Button variant="outline" className="text-text-lm dark:text-text font-semibold">Update profile</Button>
              </div>

              <Separator className="bg-gray-800" />

              <div className="flex justify-between text-text-lm dark:text-text font-semibold">
                <p>Leave organization</p>
                <Button variant="ghost" className="text-danger-lm dark:text-danger hover:text-red-500">
                  Leave organization
                </Button>
              </div>

              <Separator className="bg-gray-800" />

              <div className="flex justify-between text-text-lm dark:text-text font-semibold">
                <p>Delete organization</p>
                <Button variant="ghost" className="text-danger-lm dark:text-danger hover:text-red-500">
                  Delete organization
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "members" && (
          <Card className="bg-bg-light-lm dark:bg-bg-light border border-gray-800 text-text-lm dark:text-text rounded-none">
            <CardContent className="p-6">
              {loadingMembers ? (
                <LoadingLogo bgColor="bg-bg-light-lm dark:bg-bg-light"/>
              ) : 
              <div>
                <div className="flex justify-end">
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button>Add Member</Button>
                    </DialogTrigger>
                    <DialogContent className="text-text font-generalSans bg-bg">
                      <DialogHeader>
                        <DialogTitle>Add a new member</DialogTitle>
                        <DialogDescription>Invite someone to join your organization.</DialogDescription>
                      </DialogHeader>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            placeholder="member@example.com"
                            value={formData.email}
                            onChange={(e) => handleChange("email", e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select
                            value={formData.role}
                            onValueChange={(value) => handleChange("role", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Button type="submit" disabled={loading} className="w-full">
                          {loading ? "Adding..." : "Add Member"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <ul className="divide-y divide-gray-800 mt-6">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-text text-sm font-medium">
                          {member.name
                            ? member.name.charAt(0).toUpperCase()
                            : member.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">
                            {member.name ? member.name : member.email}
                          </p>
                        </div>
                      </div>

                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-700 text-white">
                        {member.role}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              }
            </CardContent>
          </Card>
        )}

        {tab === "businessProfile" && organization?.role === "admin" && (
          <Card className="bg-bg-light-lm dark:bg-bg-light border border-gray-800 text-text-lm dark:text-text rounded-none overflow-y-auto max-h-[calc(100vh-2rem)]">
            <CardContent className="p-6">
              <BusinessProfileTab 
                orgId={orgIdString} 
                token={session?.user?.token} 
                role={organization?.role} 
              />
            </CardContent>
          </Card>
        )}

        {/* {tab === "assets" && (

            
              <Assets/>
        )} */}

        {tab === "licenses" && (
          <Card className="bg-bg-light-lm dark:bg-bg-light border border-gray-800 text-text rounded-none">
            <CardContent className="p-6">
              <p>Licenses information coming soon...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Page;
