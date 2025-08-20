"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { useSession } from "next-auth/react"


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

const page = () => {
  const { data: session, status } = useSession()
  const { orgId } = useParams()
  const [loading, setLoading] = useState(false);
  console.log(session?.user?.token)
  


  useEffect(() => {
      setLoading(true);
    const fetchOrgs = async () => {
      try {
        const config = {
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.user?.token}`,
          },
        };
  
        const adminRes = await axios.get<any>(
          "http://localhost:8080/api/v1/organizations",
          config
        );
        console.log("Admin Organizations Response:", adminRes.data);
  
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
  
        // setAdminOrgs(normalizedOrgs);
      } catch (err) {
        console.error("Error fetching organizations:", err);
      } finally{
        setLoading(false);
      }
    };
  
    if (session?.user?.token) fetchOrgs();
  }, [session?.user?.token]);
  return (
    <div>page</div>
  )
}

export default page