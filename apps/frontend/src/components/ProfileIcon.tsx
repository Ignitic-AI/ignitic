'use client'

import { useState } from 'react'
import axios from 'axios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Plus,X } from 'lucide-react';
import { toast } from "sonner"
import { API_V1_BASE_URL } from "@/lib/api"

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

export default function ProfileIcon() {
  const { data: session, status } = useSession()
  // console.log(session);
  // Create organization form state
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [orgForm, setOrgForm] = useState<Organization>({
    name: "",
    description: "",
    memberCount: 0,
    role: "member",
    createdAt: new Date().toISOString(),
    status: "active",
    ecommerce_domain: "",
    industry: "",
    company_size: "small",
    website: "",
    country: "",
    city: "",
    address: "",
    phone_number: "",
    subscription_plan: "free"
  });


  const isLoggedIn = !!session
  const userName = session?.user?.user?.first_name || "Guest";
  console.log(session?.user)
  console.log("Status:", status);
  const router = useRouter()

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
  
    try {
      // Create new organization with all required fields
      const newOrg: Organization = {
        name: orgForm.name,
        description: orgForm.description,
        memberCount: 1, // Starting with 1 member (the owner)
        role: "owner",
        createdAt: new Date().toISOString(),
        status: "active",
        // Default values for API-required fields
        ecommerce_domain: "",
        industry: "",
        company_size: "small",
        website: "",
        country: "",
        city: "",
        address: "",
        phone_number: "",
        subscription_plan: "free"
      };
  
      // Make API call to POST /api/v1/organizations
      const response = await axios.post(
        `${API_V1_BASE_URL}/organizations`,
        {
          name: newOrg.name,
          description: newOrg.description,
          employee_count: newOrg.memberCount,
          ecommerce_domain: newOrg.ecommerce_domain,
          industry: newOrg.industry,
          company_size: newOrg.company_size,
          website: newOrg.website,
          country: newOrg.country,
          city: newOrg.city,
          address: newOrg.address,
          phone_number: newOrg.phone_number,
          subscription_plan: newOrg.subscription_plan
        },
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.user?.token}`
          }
        }
      );
  
      // Update with the actual organization data from API response
      const createdOrg: Organization = {
        ...newOrg,
        memberCount: response.data.employee_count || newOrg.memberCount,
        createdAt: response.data.created_at || newOrg.createdAt
      };
  
      
      setOrgForm({
    name: "",
    description: "",
    memberCount: 0,
    role: "member",
    createdAt: new Date().toISOString(),
    status: "active",
    ecommerce_domain: "",
    industry: "",
    company_size: "small",
    website: "",
    country: "",
    city: "",
    address: "",
    phone_number: "",
    subscription_plan: "free"
  });
  
  
      toast.success("Organization created successfully");
    } catch (error) {
      console.error("Failed to create organization:", error);
      toast.error("Failed to create organization");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-10 w-10 p-0 rounded-full mr-3 active:scale-95 transition-all duration-300 ring-offset-background outline-none hover:ring-2 hover:ring-border/40 focus-visible:ring-2 focus-visible:ring-ring border-0 shadow-sm overflow-hidden"
        >
          <Avatar className="h-full w-full">
            <AvatarImage
              src='/default.jpg'
              alt={userName}
              className="object-cover"
            />
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        className="w-[280px] font-generalSans p-1.5 rounded-lg border border-border/20 bg-bg-lm/80 dark:bg-bg-light/80 backdrop-blur-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] z-50 text-foreground" 
        align="end" 
        sideOffset={12}
        forceMount 
      >
        {isLoggedIn ? (
          <div className="flex flex-col gap-0.5">
            <DropdownMenuLabel className="font-normal py-2">
              <div className="flex flex-col bg-black/3 dark:bg-white/3 p-3 rounded-sm shadow-[0_2px_10px_-2px_rgba(0,0,0,0.06)]">
                <p className="text-base font-medium leading-none tracking-tight">{userName}</p>
                
              </div>
            </DropdownMenuLabel>
            
            <DropdownMenuItem 
              onClick={()=> router.push("/profile")}
              className="rounded-sm px-3 py-2.5 text-sm cursor-pointer transition-colors focus:bg-accent/80 focus:text-accent-foreground"
            >
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/30 mx-2 my-1"/>
            
            <DropdownMenuItem 
              className="group rounded-sm px-3 py-2.5 text-sm cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10 focus:bg-accent/80 focus:text-accent-foreground flex items-center bg-black/3 dark:bg-white/3 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.06)]" 
              onClick={() => router.push("/organization/create")}
            >
              <Plus className="h-4 w-4 mr-2.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="font-medium">Create Organization</span>
            </DropdownMenuItem>

            
            
            <DropdownMenuItem 
              onClick={() => signOut()} 
              className="rounded-sm px-3 py-2.5 text-sm cursor-pointer transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive font-medium"
            >
              Log out
            </DropdownMenuItem>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-1">
            <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Account
            </DropdownMenuLabel>
            
            <DropdownMenuItem 
              onClick={() => signIn()}
              className="rounded-sm px-3 py-2.5 text-sm cursor-pointer transition-colors focus:bg-accent/80 focus:text-accent-foreground font-medium"
            >
              Login
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => router.push("/signup")}
              className="rounded-sm px-3 py-2.5 text-sm cursor-pointer transition-colors focus:bg-accent/80 focus:text-accent-foreground font-medium"
            >
              Sign up
            </DropdownMenuItem>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
