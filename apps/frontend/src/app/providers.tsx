"use client";
import { useEffect } from "react";
import { useOrgStore } from "@/app/_store/useorgStore";
import { useSession} from "next-auth/react"
import axios from "axios"

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

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const setOrganizations = useOrgStore((s) => s.setOrganizations);

  useEffect(() => {
    if (!session?.user?.token) return
    const fetchOrgs = async () => {
      try {
        const config = {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.token}`,
        },
      };
        const adminRes = await axios.get<any>(
        "http://localhost:8080/api/v1/organizations",
        config
      );

      if(adminRes.data.organizations == null){
        setOrganizations([]);
        return;
      }

      // Normalize API response into your Organization interface
      const normalizedOrgs: Organization[] = adminRes.data.organizations.map((org: any) => ({
        id: org.id,
        name: org.name,
        description: org.description,
        memberCount: org.employee_count,
        role: org.user_role,
        createdAt: org.joined_at,
        subscription_plan: org.subscription_plan,
        ecommerce_domain: org.ecommerce_domain,
        industry: org.industry,
        company_size: org.company_size,
        website: org.website,
        country: org.country,
        city: org.city,
        status: "active",  
        address: "",
        phone_number: "",
      }));
        setOrganizations(normalizedOrgs);
      } catch (err) {
        console.error("Failed to fetch orgs:", err);
      }
    }

    if (session?.user?.token) fetchOrgs();
  }, [session?.user?.token,status,setOrganizations]);

  return <>{children}</>;
}
