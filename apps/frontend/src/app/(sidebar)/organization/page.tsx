"use client"

import {useState, useRef, useEffect} from "react"
import {
  Plus,
  Users,
  UserPlus,
  Crown,
  Shield,
  User,
  Lock,
  Trash2,
  Building2,
  MapPin,
  Globe
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { LoadingLogo } from "@/components/Loading"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import gsap from 'gsap'
import { useSession, signIn} from "next-auth/react"
import { useOrgStore } from "@/app/_store/useorgStore"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  const [members, setMembers] = useState<Member[]>([])
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteList, setInviteList] = useState([
    { email: "", role: "member" },
  ])
  const [isJoinOrgOpen, setIsJoinOrgOpen] = useState(false)
  const [memberSearchTerm, setMemberSearchTerm] = useState("")
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const currentOrg = useOrgStore((state) => state.currentOrg);
  const syncOrganizations = useOrgStore((state) => state.syncOrganizations);
  const router = useRouter()
  console.log(currentOrg?.id);

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
        `${API_V1_BASE_URL}/organizations`,
        config
      );
      console.log("Admin Organizations Response:", adminRes.data);
      console.log("Session: ", session?.user)

      // Normalize API response into your Organization interface
      const normalizedOrgs: Organization[] =
  adminRes?.data?.organizations?.map((org: any) => ({
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
  })) ?? [];

      setAdminOrgs(normalizedOrgs);
      syncOrganizations(normalizedOrgs);
    } catch (err) {
      console.error("Error fetching organizations:", err);
    } finally{
      setLoading(false);
    }
  };

  if (session?.user?.token) fetchOrgs();
}, [session?.user?.token, syncOrganizations]);




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
    height: 'auto', 
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

function formatDate(iso?: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString()
}


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
        axios.post(`${API_V1_BASE_URL}/organizations/${currentOrg.id}/invite`, {
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


  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(memberSearchTerm.toLowerCase()),
  )

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-bg font-generalSans">
  <div className="flex flex-col items-center text-center w-auto max-w-md">
    <Lock className="h-8 w-8 mb-2 text-text-lm dark:text-text" />
    <h2 className="text-3xl font-semibold text-text-lm dark:text-text ">Not Logged In</h2>
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
          <h1 className="text-3xl font-bold tracking-tight dark:text-text text-text-lm">Organizations</h1>
          <p className="dark:text-text-muted text-text-muted-lm  ">Manage your organizations and team members</p>
        </div>
        <div className="flex gap-2">
          {/* Keep your Join/Create dialogs here */}
          <Button
          variant="outline"
          className="bg-bg-light-lm  text-text-lm dark:bg-bg-light  dark:text-text hover:bg-white font-semibold text-lg px-6 py-3 h-auto"
          onClick={() => {
            router.push("/organization/create")
          }}
        >
          <Users className="h-5 w-5 mr-2" />
          New Organization
        </Button>
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="bg-bg-light-lm  text-text-lm dark:bg-bg-light  dark:text-text hover:bg-white font-semibold text-lg px-6 py-3 h-auto"
          onClick={(e) => {
      if (!currentOrg) {
        e.preventDefault(); 
        toast.error("Create an Organization First", {
          description: "You need to create an organization before inviting members.",
        });
        return;
      }
    }}
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Invite Members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-text dark:bg-text-lm border font-generalSans">
        <form onSubmit={handleInvite}>
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold text-text-lm dark:text-text">Invite Members</DialogTitle>
            <DialogDescription className="text-text-muted-lm dark:text-text-muted -mt-4">
              Add one or more members with their email and role.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6 max-h-[400px] overflow-y-auto pr-2 ">
            {inviteList.map((member, index) => (
              <div key={index} className="grid gap-4 border border-border p-2 rounded-lg relative shadow-sm bg-gray-10 dark:bg-bg-light">
                {/* Email */}
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-text-muted-lm dark:text-text-muted">Email</Label>
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
                  <Label className="text-sm font-medium text-text-muted-lm dark:text-text-muted">Role</Label>
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
          
      
        

        
      </div>
      </div>

      {/* Organizations Grid */}
  {loading ? (
    <LoadingLogo />
) : (
  <>
  {adminOrgs.length === 0 ? (
  <div className="flex items-center justify-center h-64">
    <p className="text-xl dark:text-text-muted text-text-muted-lm">No Organizations Yet</p>
  </div>
) : (
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
    {adminOrgs.map((org) => {
      

      return (
        <Link key={org.id} href={`/organization/${org.id}`} className="group">
                <Card className="h-full rounded-[4px] border-0 bg-bg-light-lm dark:bg-bg-light transition-colors font-generalSans">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-bg-lm dark:bg-bg ring-1 ring-border-lm dark:ring-border">
                          <Building2 className="h-5 w-5 text-text-lm  dark:text-text" />
                        </div>
                        <CardTitle className="text-text-lm dark:text-text text-2xl">{org.name}</CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-[4px] border-info-lm/35 dark:border-info/35 bg-info-lm/15 dark:bg-info/20 text-info-lm dark:text-info capitalize"
                        title="Subscription plan"
                      >
                        {org.subscription_plan}
                      </Badge>
                    </div>
                    
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-[4px] border-success-lm/35 dark:border-success/35 bg-success-lm/15 dark:bg-success/20 text-success-lm dark:text-success">
                        <Shield className="mr-1.5 h-3.5 w-3.5" />
                        {org.role}
                      </Badge>
                      <Badge variant="outline" className="rounded-[4px] border-border-lm dark:border-border bg-bg-dark-lm dark:bg-bg-dark text-text-muted-lm dark:text-text-muted">
                        <MapPin className="mr-1.5 h-3.5 w-3.5 " />
                        {org.city || "—"}, {org.country || "—"}
                      </Badge>
                      <Badge variant="outline" className="rounded-[4px] border-border-lm dark:border-border bg-bg-dark-lm dark:bg-bg-dark text-text-muted-lm dark:text-text-muted capitalize">
                        Size: {org.company_size || "—"}
                    
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-[4px] border-0 bg-bg-dark-lm dark:bg-bg-dark text-text-muted-lm dark:text-text-muted p-3">
                        <div className="flex items-center gap-1.5 ">
                          <Users className="h-4 w-4" />
                          Employees
                        </div>
                        <div className="mt-1">{org.memberCount ?? "—"}</div>
                      </div>
                      <div className="rounded-[4px] border-0 bg-bg-dark-lm dark:bg-bg-dark text-text-muted-lm dark:text-text-muted p-3">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-4 w-4" />
                          Domain
                        </div>
                        <div className="mt-1 ">{org.ecommerce_domain || "—"}</div>
                      </div>
                      <div className="rounded-[4px] border-0 bg-bg-dark-lm dark:bg-bg-dark text-text-muted-lm dark:text-text-muted p-3">
                        <div className="flex items-center gap-1.5 ">Joined</div>
                        <div className="mt-1 ">{formatDate(org.createdAt)}</div>
                      </div>
                    </div>

                    {org.website ? (
                      <div className="text-sm text-blue-500">Website: {org.website}</div>
                    ) : (
                      <div className="text-sm text-blue-500">No website provided</div>
                    )}
                  </CardContent>
                </Card>
              </Link>
      );
    })}
  </div>
)}
</>

)}
</div>

  )
}
