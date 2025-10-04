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
        'http://localhost:8080/api/v1/organizations',
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
        <Button variant="ghost" className="relative h-8 w-8 rounded-full mr-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src='/default.jpg'
              alt={userName}
            />
            {/* <AvatarFallback>
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback> */}
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-50 font-generalSans font-semibold text-2xl" align="end" forceMount >
        {isLoggedIn ? (
          <>
            <DropdownMenuLabel className="font-normal bg-info rounded-sm">
              <div className="flex flex-col space-y-1 ">
                <p className="text-lg font-semibold leading-none ">{userName}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={()=> router.push("/profile")}>Go to Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border text-text-muted"/>
            <DropdownMenuItem className="bg-text" onClick={() => router.push("/organization/create")}>
              <Plus className="h-4 w-4 text-bg" />
              Create Organization
            </DropdownMenuItem>
      





            <DropdownMenuSeparator className="bg-bg text-bg" />
            <DropdownMenuItem onClick={() => signOut()} className="bg-danger">Log out</DropdownMenuItem>
          </>
        ) : (
          < >
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signIn()}>Login</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/signup")}>Sign up</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
