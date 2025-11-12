"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarGroup, AvatarGroupItem, AvatarGroupTooltip } from "@/components/ui/avatar-group";

const UserAvatar = () => {
  const AVATARS = [
    {
      fallback: "A",
      name: "Nick Stone",
      role: "CEO, Loop Inc.",
    },
    {
      fallback: "JS",
      name: "Jessica Smith",
      role: "CTO, Kite Inc.",
    },
    {
      fallback: "MJ",
      name: "Michael Johnson",
      role: "Developer, Sito Inc.",
    },
    {
      fallback: "SW",
      name: "Samantha Williams",
      role: "Manager, TPO Inc.",
    },
  ];
  return (
    <div className="flex items-center gap-2">
      {/* Avatar Group */}
      <AvatarGroup tooltipClassName="!top-full !mt-2 !left-1/2 !-translate-x-1/2 !translate-y-0 !z-50" animation="flip">
        {AVATARS.map((avatar, index) => (
          <AvatarGroupItem key={index}>
            <Avatar className="size-8 rounded-full overflow-hidden border-2 border-background">
              {/* <AvatarImage src={avatar.src} /> */}
              <AvatarFallback>{avatar.fallback}</AvatarFallback>
            </Avatar>
            <AvatarGroupTooltip className="flex flex-col gap-0.5 text-center">
              <span className="text-sm font-semibold">{avatar.name}</span>
              <span className="text-xs font-normal">{avatar.role}</span>
            </AvatarGroupTooltip>
          </AvatarGroupItem>
        ))}
      </AvatarGroup>
      </div>
  )
}

export default UserAvatar