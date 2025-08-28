"use client"

import { useSession } from "next-auth/react";
import { Building2, Plus, Check, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation";
import { useOrgStore } from "@/app/_store/useorgStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const getAvatarFallback = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "text-amber-600"
      case "admin":
        return "text-blue-600"
      case "member":
        return "text-gray-600"
      default:
        return "text-gray-600"
    }
  }
const OrgDropdown = () => {
  const { data: session, status } = useSession()
  const organizations = useOrgStore((state) => state.organizations);
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const setCurrentOrg = useOrgStore((s) => s.setCurrentOrg);
  const clearCurrentOrg = useOrgStore((s) => s.clearCurrentOrg);
  const isLoggedIn = !!session
  const router = useRouter()
  

  return (
    <DropdownMenu >
      <DropdownMenuTrigger asChild className="font-generalSans">
        <Button variant="outline" className="w-[240px] justify-between h-10 px-3 bg-transparent">
          <div className="flex items-center gap-2 min-w-0">
              {/* <Avatar className="h-6 w-6">
                <AvatarImage src={currentOrg?.avatar || "/placeholder.svg"} />
                <AvatarFallback className="text-xs bg-muted">
                  {currentOrg ? getAvatarFallback(currentOrg.name) : getAvatarFallback(mockUser.name)}
                </AvatarFallback>
              </Avatar> */}
              <span className="truncate text-sm font-medium">{currentOrg ? currentOrg.name : "Personal Account"}</span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[240px] font-generalSans" align="start">
        <DropdownMenuLabel className=" text-xs">Select Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Personal Account Option */}
        <DropdownMenuItem onClick={clearCurrentOrg} className="flex items-center gap-2 px-2 py-2">
            {/* <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-muted">{getAvatarFallback(session?.user?.name)}</AvatarFallback>
            </Avatar> */}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium truncate">Personal Account</span>
              <span className="text-xs text-muted-foreground truncate">{session?.user?.user?.email}</span>
            </div>
            {!currentOrg && <Check className="h-4 w-4 text-emerald-600" />}
          </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Organizations List */}
        {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => setCurrentOrg(org.id)}
              className="flex items-center gap-2 px-2 py-2"
            >
              {/* <Avatar className="h-6 w-6">
                <AvatarImage src={org.avatar || "/placeholder.svg"} />
                <AvatarFallback className="text-xs bg-muted">{getAvatarFallback(org.name)}</AvatarFallback>
              </Avatar> */}
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{org.name}</span>
                <span className={`text-xs truncate ${getRoleColor(org.role)}`}>
                  {org.role.charAt(0).toUpperCase() + org.role.slice(1)}
                </span>
              </div>
              {currentOrg?.id === org.id && <Check className="h-4 w-4 text-emerald-600" />}
            </DropdownMenuItem>
          ))}

        <DropdownMenuSeparator />
        
        <DropdownMenuItem className="bg-text" onClick={() => router.push("/organization/create")}>
              <Plus className="h-4 w-4 text-bg" />
              Create Organization
            </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default OrgDropdown