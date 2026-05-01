"use client"

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarGroup, AvatarGroupItem, AvatarGroupTooltip } from "@/components/ui/avatar-group";
import { useOrgStore } from "@/app/_store/useorgStore";
import { API_V1_BASE_URL } from "@/lib/api";

interface Member {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  joined_at: string;
}

const UserAvatar = () => {
  const { data: session } = useSession();
  const currentOrg = useOrgStore((state) => state.currentOrg);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      // @ts-ignore
      const token = session?.user?.token;
      if (!currentOrg?.id || !token) return;
      
      try {
        const config = {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        };

        const res = await axios.get(
          `${API_V1_BASE_URL}/organizations/${currentOrg.id}/members`,
          config
        );

        if (res.data && res.data.members) {
          setMembers(res.data.members);
        }
      } catch (err) {
        console.error("Error fetching members for avatar:", err);
      }
    };

    fetchMembers();
  }, [currentOrg?.id, session]);

  if (!currentOrg) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Avatar Group */}
      <AvatarGroup tooltipClassName="!top-full !mt-2 !left-1/2 !-translate-x-1/2 !translate-y-0 !z-50" animation="flip">
        {members.map((member) => {
          const name = member.first_name || member.last_name 
            ? `${member.first_name || ""} ${member.last_name || ""}`.trim() 
            : member.email;
          const fallback = member.first_name 
            ? member.first_name.charAt(0).toUpperCase() + (member.last_name ? member.last_name.charAt(0).toUpperCase() : "")
            : member.email.charAt(0).toUpperCase();

          return (
            <AvatarGroupItem key={member.id}>
              <Avatar className="size-8 rounded-full overflow-hidden border-2 border-background">
                {/* <AvatarImage src={member.avatar_url || ""} /> */}
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
              <AvatarGroupTooltip className="flex flex-col gap-0.5 text-center">
                <span className="text-sm font-semibold">{name}</span>
                <span className="text-xs font-normal capitalize">{member.role}</span>
              </AvatarGroupTooltip>
            </AvatarGroupItem>
          );
        })}
      </AvatarGroup>
    </div>
  )
}

export default UserAvatar
