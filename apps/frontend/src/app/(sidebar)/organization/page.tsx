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
  X,
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
  DialogTrigger,
  DialogClose
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import gsap from 'gsap'
import { useSession, signIn} from "next-auth/react"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

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
  console.log(session?.user?.token)
  const [adminOrgs, setAdminOrgs] = useState<Organization[]>([]);
  const [members, setMembers] = useState<Member[]>(mockMembers)
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isJoinOrgOpen, setIsJoinOrgOpen] = useState(false)
  const [memberSearchTerm, setMemberSearchTerm] = useState("")
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);


  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

// Create organization form state
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

  const [memberForm, setMemberForm] = useState({
    email: "",
    role: "member",
  })

  const [joinForm, setJoinForm] = useState({
    orgId: "",
  })

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

    setAdminOrgs([...adminOrgs, createdOrg]);
    setIsCreateOrgOpen(false);
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

  // const handleAddMember = async (e: React.FormEvent) => {
  //   e.preventDefault()

  //   try {
  //     // Simulate API call to POST /api/v1/organizations/{id}/members
  //     const newMember: Member = {
  //       id: `member-${Date.now()}`,
  //       name: memberForm.email.split("@")[0],
  //       email: memberForm.email,
  //       role: memberForm.role,
  //       avatar: "/placeholder.svg?height=32&width=32",
  //       joinedAt: new Date().toISOString().split("T")[0],
  //       status: "pending",
  //       orgId: selectedOrg?.id || "",
  //     }

  //     setMembers([...members, newMember])
  //     setIsAddMemberOpen(false)
  //     setMemberForm({ email: "", role: "member" })

  //     toast(
  //        "Member invitation sent successfully",
  //     )
  //   } catch (error) {
  //     toast("Failed to add member",
        
  //     )
  //   }
  // }

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

  const handleRemoveMember = async (memberId: string) => {
    try {
      // Simulate API call to DELETE /api/v1/organizations/{id}/members/{memberId}
      setMembers(members.filter((member) => member.id !== memberId))
      toast(
 "Member removed successfully",
      )
    } catch (error) {
      toast(

"Failed to remove member",
        
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
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-text font-generalSans">
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
          <h1 className="text-3xl font-bold tracking-tight text-text">Organizations</h1>
          <p className="text-muted-foreground">Manage your organizations and team members</p>
        </div>
        <div className="flex gap-2">
          {/* Keep your Join/Create dialogs here */}
          
      
        <Dialog open={isJoinOrgOpen} onOpenChange={setIsJoinOrgOpen}>
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
        </Dialog>

        <Dialog open={isCreateOrgOpen} onOpenChange={setIsCreateOrgOpen} >
          <DialogTrigger asChild>
            <Button className="border-border border-1 hover:bg-secondary hover:text-primary font-semibold text-lg p-6">
              <Plus className="h-4 w-4 " />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-primary" showCloseButton={false}>
            <DialogClose asChild>
    <Button 
      variant="ghost" 
      size="icon" 
      className="absolute right-4 top-4 rounded-full bg-danger text-white hover:bg-danger/80 "
    >
      <X className="h-4 w-4" />
    </Button>
  </DialogClose>
            <form onSubmit={handleCreateOrganization} className="text-text font-generalSans">
  <DialogHeader>
    <DialogTitle className="text-2xl">Create New Organization</DialogTitle>
    <DialogDescription className="text-lg -mt-2">Set up a new organization for your team</DialogDescription>
  </DialogHeader>
  <div className="grid gap-4 py-4">
    <div className="grid grid-cols-2 gap-4">
      {/* Column 1 */}
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Organization Name*</Label>
          <Input
            id="name"
            value={orgForm.name}
            onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            placeholder="Technology "
            value={orgForm.industry}
            onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            placeholder="www.example.com"
            value={orgForm.website}
            onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            placeholder="Lahore"
            value={orgForm.city}
            onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
          />
        </div>
      </div>

      {/* Column 2 */}
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Brief description of your organization"
            value={orgForm.description}
            onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company_size">Company Size</Label>
          <Select
            value={orgForm.company_size}
            onValueChange={(value) => setOrgForm({ ...orgForm, company_size: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small (1-50)</SelectItem>
              <SelectItem value="medium">Medium (51-200)</SelectItem>
              <SelectItem value="large">Large (201+)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            placeholder="United States"
            value={orgForm.country}
            onChange={(e) => setOrgForm({ ...orgForm, country: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone_number">Phone Number</Label>
          <Input
            id="phone_number"
            placeholder="+92 XXXXXXXXXX"
            value={orgForm.phone_number}
            onChange={(e) => setOrgForm({ ...orgForm, phone_number: e.target.value })}
          />
        </div>
      </div>
    </div>

    <div className="grid gap-2">
      <Label htmlFor="subscription_plan">Subscription Plan</Label>
      <Select
        value={orgForm.subscription_plan}
        onValueChange={(value) => setOrgForm({ ...orgForm, subscription_plan: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="free">Free</SelectItem>
          <SelectItem value="basic">Basic</SelectItem>
          <SelectItem value="premium">Premium</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
  <DialogFooter>
    <Button type="button" variant="outline" onClick={() => setIsCreateOrgOpen(false)} className="bg-danger">
      Cancel
    </Button>
    <Button type="submit" className="bg-success">Create Organization</Button>
  </DialogFooter>
</form>
          </DialogContent>
        </Dialog>
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
