"use client"

import {useState, useRef, useEffect} from "react"
import {
  Plus,
  Users,
  UserPlus,
  UserMinus,
  Crown,
  Shield,
  User,
  MoreHorizontal,
  Lock,
  ChevronUp,
  Trash2,
  ArrowUpRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import gsap from 'gsap'
import { useSession, signIn} from "next-auth/react"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { useOrgStore } from "@/app/_store/useorgStore"

// Mock data for organizations
const mockOrganizations = [
  {
    id: "org-1",
    name: "Acme Corporation",
    description: "Leading technology solutions provider",
    memberCount: 45,
    role: "owner",
    createdAt: "2024-01-15",
    status: "active",
  },
  {
    id: "org-2",
    name: "StartupXYZ",
    description: "Innovative fintech startup",
    memberCount: 12,
    role: "admin",
    createdAt: "2024-02-20",
    status: "active",
  },
  {
    id: "org-3",
    name: "Design Studio",
    description: "Creative design and branding agency",
    memberCount: 8,
    role: "member",
    createdAt: "2024-03-10",
    status: "active",
  },
]

// Mock data for organization members
const mockMembers = [
  {
    id: "member-1",
    orgId: "org-1",
    name: "John Doe",
    email: "john@acme.com",
    role: "owner",
    avatar: "/placeholder.svg?height=32&width=32",
    joinedAt: "2024-01-15",
    status: "active",
  },
  {
    id: "member-2",
    orgId: "org-1",
    name: "Jane Smith",
    email: "jane@acme.com",
    role: "admin",
    avatar: "/placeholder.svg?height=32&width=32",
    joinedAt: "2024-01-20",
    status: "active",
  },
  {
    id: "member-3",
    orgId: "org-2",
    name: "Mike Johnson",
    email: "mike@acme.com",
    role: "member",
    avatar: "/placeholder.svg?height=32&width=32",
    joinedAt: "2024-02-01",
    status: "active",
  },
  {
    id: "member-4",
    orgId: "org-3",
    name: "Sarah Wilson",
    email: "sarah@acme.com",
    role: "member",
    avatar: "/placeholder.svg?height=32&width=32",
    joinedAt: "2024-02-15",
    status: "pending",
  },
]

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
  id: string
  name: string
  email: string
  role: string
  avatar: string
  joinedAt: string
  status: string
  orgId: string
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: User,
}

const roleColors = {
  owner: "bg-yellow-100 text-yellow-800 border-yellow-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  member: "bg-gray-100 text-gray-800 border-gray-200",
}

const statusColors = {
  active: "bg-green-100 text-green-800",
  pending: "bg-orange-100 text-orange-800",
  inactive: "bg-red-100 text-red-800",
}

export default function OrganizationsPage() {
  const { data: session, status } = useSession()
  const [adminOrgs, setAdminOrgs] = useState<Organization[]>([]);
  const [members, setMembers] = useState<Member[]>(mockMembers)
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteList, setInviteList] = useState([
    { email: "", role: "member" },
  ])
  const [isJoinOrgOpen, setIsJoinOrgOpen] = useState(false)
  const [memberSearchTerm, setMemberSearchTerm] = useState("")
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { currentOrg } = useOrgStore();

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  useEffect(() => {
    setLoading(true);
    if (status === 'unauthenticated') {
    return;
  }
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
      console.log("Session: ", session?.user)

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

      setAdminOrgs(normalizedOrgs);
    } catch (err) {
      console.error("Error fetching organizations:", err);
    } finally{
      setLoading(false);
    }
  };

  if (session?.user?.token) fetchOrgs();
}, [session?.user?.token]);




  const toggleExpand = (orgId: string) => {
  
  setExpandedOrgs(prev => {
    const newSet = new Set(prev);
    if (newSet.has(orgId)) {
      // Collapse animation
      const card = cardRefs.current[orgId];
      const content = contentRefs.current[orgId];
      
      if (card && content) {
        const tl = gsap.timeline();
        tl.to(card, {
    height: 'auto', 
    duration: 0.06,
    ease: "power2.out"
}, 0)
.to(content, {
    height: 0,
    opacity: 1,
    duration: 0.2,
    ease: "power2.out"
}, 0);
      }
      newSet.delete(orgId);
    } else {
      // Expand animation
      newSet.add(orgId);
      requestAnimationFrame(() => {
        const card = cardRefs.current[orgId];
        const content = contentRefs.current[orgId];
        
        if (card && content) {
          gsap.set(content, { height: 0, opacity: 0 });
          gsap.set(card, { height: "auto" }); 
          const contentHeight = content.scrollHeight;
          
          const tl = gsap.timeline();

tl.to(card, {
    height: 'auto', // Animate card to exact content height
    duration: 0.03,
    ease: "power2.out"
}, 0)
.to(content, {
    height: contentHeight,
    opacity: 1,
    duration: 0.2,
    ease: "power2.out"
}, 0);
        }
      });
    }
    return newSet;
  });
};


  const [memberForm, setMemberForm] = useState({
    email: "",
    role: "member",
  })

  const [joinForm, setJoinForm] = useState({
    orgId: "",
  })

 

const handleChange = (index: number, field: string, value: string) => {
    const newList = [...inviteList]
    newList[index] = { ...newList[index], [field]: value }
    setInviteList(newList)
  }

  const handleAddMember = () => {
    setInviteList([...inviteList, { email: "", role: "member" }])
  }

  const handleRemoveMember = (index: number) => {
    setInviteList(inviteList.filter((_, i) => i !== index))
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if(currentOrg) {
      const reqs = inviteList.map(member =>
        axios.post(`http://localhost:8080/api/v1/organizations/${currentOrg.id}/invite`, {
          email: member.email,
          role: member.role
        },{
        headers: {
            'Authorization': `Bearer ${session?.user?.token}`,
            'Content-Type': 'application/json'
          }
      })
    )
    console.log("Sent Req ",reqs)
    setIsInviteOpen(false)
  }
}

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Simulate API call to POST /api/v1/organizations/{id}/join
      toast(
 "Join request sent successfully",
      )
      setIsJoinOrgOpen(false)
      setJoinForm({ orgId: "" })
    } catch (error) {
      toast(
        
         "Failed to join organization"
      )
    }
  }

  // const handleLeaveOrganization = async (orgId: string) => {
  //   try {
  //     // Simulate API call to POST /api/v1/organizations/{id}/leave
  //     setAdminOrgs(adminOrgs.filter((org) => org.name !== orgId))
  //     toast(
      
  //       "Left organization successfully",
  //     )
  //   } catch (error) {
  //     toast(
  //        "Failed to leave organization",
  //       )
  //   }
  // }



  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      // Simulate API call to PUT /api/v1/organizations/{id}/members/{memberId}
      setMembers(members.map((member) => (member.id === memberId ? { ...member, role: newRole } : member)))
      toast(

"Member role updated successfully",
      )
    } catch (error) {
      toast(

         "Failed to update member role",

      )
    }
  }

  // const filteredOrganizations = adminOrgs.filter(
  //   (org) =>
  //     org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     org.description.toLowerCase().includes(searchTerm.toLowerCase()),
  // )

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(memberSearchTerm.toLowerCase()),
  )

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-bg font-generalSans">
  <div className="flex flex-col items-center text-center w-auto max-w-md">
    <Lock className="h-8 w-8 mb-2" />
    <h2 className="text-3xl font-semibold ">Not Logged In</h2>
    <p className="text-muted-foreground">
      Please sign in to access Organizations
    </p>
  </div>
  <Button onClick={() => signIn()} className="hover:bg-info hover:scale-105 hover:text-lg">Sign In</Button>
</div>
    );
  }

  

  return (
    <div className="container mx-auto p-6 space-y-8 font-generalSans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-bg">Organizations</h1>
          <p className="text-muted-foreground">Manage your organizations and team members</p>
        </div>
        <div className="flex gap-2">
          {/* Keep your Join/Create dialogs here */}
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="bg-primary text-primary-foreground hover:bg-white font-semibold text-lg px-6 py-3 h-auto"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Invite Members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-text border font-generalSans">
        <form onSubmit={handleInvite}>
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold">Invite Members</DialogTitle>
            <DialogDescription className="text-text-muted -mt-4">
              Add one or more members with their email and role.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6 max-h-[400px] overflow-y-auto pr-2 ">
            {inviteList.map((member, index) => (
              <div key={index} className="grid gap-4 border border-border p-2 rounded-lg relative shadow-sm bg-gray-100">
                {/* Email */}
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-foreground">Email</Label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={member.email}
                    onChange={(e) => handleChange(index, "email", e.target.value)}
                    required
                    className="bg-background border-input"
                  />
                </div>

                {/* Role */}
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-foreground">Role</Label>
                  <Select value={member.role} onValueChange={(value) => handleChange(index, "role", value)}>
                    <SelectTrigger className="bg-background border-input">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Remove button (if more than one) */}
                {inviteList.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-4 w-4"
                    onClick={() => handleRemoveMember(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {/* Add new member */}
            <Button
              type="button"
              variant="outline"
              className="flex items-center justify-center gap-2 h-12 border-dashed border-2 border-info hover:bg-muted/50 text-muted-foreground hover:text-foreground bg-transparent"
              onClick={handleAddMember}
            >
              <Plus className="h-4 w-4" />
              Add Another Member
            </Button>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)} className="px-6">
              Cancel
            </Button>
            <Button type="submit" className="px-6" onClick={handleInvite}>
              Send Invites
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
          
      
        {/* <Dialog open={isJoinOrgOpen} onOpenChange={setIsJoinOrgOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="bg-primary text-text font-semibold text-lg p-6">
              <UserPlus className="h-4 w-4 " />
              Join Organization
            </Button>
          </DialogTrigger>
          <DialogContent >
            <form onSubmit={handleJoinOrganization}>
              <DialogHeader>
                <DialogTitle>Join Organization</DialogTitle>
                <DialogDescription>
                  Enter the organization ID to request to join
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="orgId">Organization ID</Label>
                  <Input
                    id="orgId"
                    placeholder="org-12345"
                    value={joinForm.orgId}
                    onChange={(e) => setJoinForm({ ...joinForm, orgId: e.target.value })}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsJoinOrgOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Send Request</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog> */}

        
      </div>
      </div>

      {/* Organizations Grid */}
  {loading ? (
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
    {[...Array(3)].map((_, i) => (
      <div key={i}>
        <Card className="bg-blue-200 text-bg">
          <CardHeader>
            <div className="space-y-2">
              <Skeleton className="h-6 w-2/3 flex-grow bg-gray-800 rounded" /> 
              <Skeleton className="h-4 w-1/2 flex-grow bg-gray-700 rounded" /> 
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 bg-gray-700 rounded" />
              <Skeleton className="h-6 w-16 bg-gray-700 rounded" />
            </div>
            <div className="mt-2">
              <Skeleton className="h-4 w-32 bg-gray-700 rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    ))}
  </div>
) : (
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
    {adminOrgs.map((org) => {
      const RoleIcon = roleIcons[org.role as keyof typeof roleIcons];
      const orgMembers = members.filter((m) => m.orgId === org.id);
      const isExpanded = expandedOrgs.has(org.name);

      return (
        <div 
          key={org.id}
          className={`${isExpanded ? "md:col-span-2 lg:col-span-3" : ""}`}
        >
          <Card
            ref={(el) => { cardRefs.current[org.name] = el }}
            className="transition-shadow cursor-pointer bg-blue-200 text-bg"
            onClick={() => toggleExpand(org.name)}
            style={{
              transition: "box-shadow 0.2s ease-out, transform 0.2s ease-out"
            }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl text-bg">{org.name}</CardTitle>
                  <CardDescription className="text-md text-primary">{org.description}</CardDescription>
                </div>
                <div className="flex items-center justify-end gap-2">
  {isExpanded && (
    <Link href={`/organization/${org.id}`} passHref>
      <Button
        variant="secondary"
        size="lg"
        className="gap-1 text-xl bg-border border-2 border-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowUpRight className="h-5 w-5 mr-3" />
        View Business Profile
      </Button>
    </Link>
  )}

  <DropdownMenu>
    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="sm">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {org.role !== "owner" && (
        <DropdownMenuItem className="text-destructive">
          <UserMinus className="h-4 w-4 mr-2" /> Leave
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
</div>

              </div>
            </CardHeader>

            {/* Always visible card summary */}
            <CardContent className={isExpanded ? "border-b" : ""}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary font-semibold" />
                  <span className={`text-lg ${isExpanded ? "" : "text-muted-foreground"} text-primary font-semibold`}>
                    {org.memberCount} members
                  </span>
                </div>
                <Badge variant="outline" className={roleColors[org.role as keyof typeof roleColors]}>
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {org.role}
                </Badge>
              </div>
              {!isExpanded && (
                <div className="mt-2 text-md text-primary -mb-6">Estd. {org.createdAt.split('T')[0]}</div>
              )}
            </CardContent>

            {/* Expandable content with animation */}
            <div
              ref={(el) => {contentRefs.current[org.name] = el}}
              className="overflow-hidden"
              style={{ height: 0, opacity: 0 }}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between -mt-4 text-md text-primary">
  <span>Estd. {org.createdAt.split('T')[0]}</span>

</div>


                
                
                <Table className="rounded-lg border-b border-2 border-border-muted">
                  <TableHeader className="bg-highlight text-text">
                    <TableRow>
                      <TableHead className="w-[200px] text-text">Member</TableHead>
                      <TableHead className="w-[120px] text-text">Role</TableHead>
                      <TableHead className="w-[100px] text-text">Status</TableHead>
                      <TableHead className="text-text">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgMembers.map((member) => {
                      const MemberRoleIcon = roleIcons[member.role as keyof typeof roleIcons];
                      return (
                        <TableRow key={member.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                                <AvatarFallback>
                                  {member.name.split(" ").map((n) => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-sm text-muted-foreground">{member.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={roleColors[member.role as keyof typeof roleColors]}>
                              <MemberRoleIcon className="h-3 w-3 mr-1" />
                              {member.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={statusColors[member.status as keyof typeof statusColors]}>
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-primary">
                            {member.joinedAt}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <CardFooter className="flex justify-end p-4 border-t">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(org.name);
                  }}
                  className="gap-1"
                >
                  <ChevronUp className="h-4 w-4" />
                  Collapse
                </Button>
              </CardFooter>
            </div>
          </Card>
        </div>
      );
    })}
  </div>
)}
</div>

  )
}
