"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  User,
  Mail,
  Building2,
  Calendar,
  Clock,
  Shield,
  Bell,
  Lock,
  Eye,
  EyeOff,
  Edit,
  Key,
  CheckCircle2
} from "lucide-react"
import { useSession } from "next-auth/react"
import axios from "axios";
import { toast } from "sonner"
import { useCredits } from "@/context/credits-context"
import { type CreditRecord } from "@/lib/credits"
import { API_V1_BASE_URL } from "@/lib/api"

type UserProfile = {
  company: string;
  created_at: string;
  email: string;
  email_verified: boolean;
  first_name: string;
  id: string;
  is_active: boolean;
  last_login: string | null;
  last_name: string;
  organization_id: string | null;
  phone: string;
  role: string;
  updated_at: string;
};
type ApiResponse = {
  user: UserProfile;
};
export default function ProfileClient() {
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: false,
    weekly_digest: true,
  })
  const [activeTab, setActiveTab] = useState("account")
  const [recordsPage, setRecordsPage] = useState(1)
  const {
    organizationId,
    overview,
    entitlements,
    recordsResponse,
    fetchRecords,
    isLoading: isCreditsLoading,
    isLoadingRecords,
    refresh,
    error: creditsError,
  } = useCredits()
  const [isEditing, setIsEditing] = useState(false);
  // Change Password state
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const validatePassword = () => {
    if (!currentPassword || !newPassword) {
      toast("Please fill in both password fields")
      return false
    }
    if (newPassword.length < 8) {
      toast("New password must be at least 8 characters")
      return false
    }
    if (newPassword === currentPassword) {
      toast("New password must be different from current password")
      return false
    }
    return true
  }

  const handleChangePassword = async () => {
    if (!validatePassword()) return
    setIsUpdatingPassword(true)
    try {
      const payload = {
        current_password: currentPassword,
        new_password: newPassword,
      }
      const response = await axios.post(`${API_V1_BASE_URL}/auth/change-password`, payload, {
        headers: {
          Authorization: `Bearer ${session?.user?.token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.status === 200) {
        toast("Password updated successfully")
        setCurrentPassword("")
        setNewPassword("")
        setIsChangingPassword(false)
      } else {
        toast("Unable to update password")
      }
    } catch (error: any) {
      console.error("Error changing password:", error.response?.data || error.message)
      toast(error?.response?.data?.message || "Error changing password")
    } finally {
      setIsUpdatingPassword(false)
    }
  }



  const [security, setSecurity] = useState({
    two_factor: false,
    login_alerts: true,
    session_timeout: true,
  })

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return " ";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return " ";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0)}${lastName?.charAt(0)}`.toUpperCase()
  }

  const formatNumber = (value?: number) => (value ?? 0).toLocaleString("en-US")
  const formatRecordType = (value?: string) => (value || "unknown").replace(/_/g, " ")
  const formatDelta = (delta: number) => (delta > 0 ? `+${delta}` : `${delta}`)
  
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const response = await axios.get<ApiResponse>(
          `${API_V1_BASE_URL}/auth/profile`,
          {
            headers: {
              accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.user?.token}`,
            },
          }
        );
        setUser(response.data.user);
        console.log("User: ", response.data.user);
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
      setLoading(false);
    };

    if (session?.user?.token) {
      fetchProfile();
    } else {
      setLoading(false);
    }

    
  }, [session?.user?.token]);

  useEffect(() => {
    if (activeTab !== "credits") return
    fetchRecords(recordsPage, 20)
  }, [activeTab, recordsPage, fetchRecords])

   const handleUpdate = async () => {
    setLoading(true);
    try {
      const payload = {
        first_name: user?.first_name,
        last_name: user?.last_name,
        phone: user?.phone,
        company: user?.company,
      };

      const response = await axios.put(`${API_V1_BASE_URL}/auth/profile`, payload, {
        headers: {
          Authorization: `Bearer ${session?.user?.token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 200) {
        toast("Profile updated successfully");
      }
    } catch (error: any) {
      console.error("Error updating profile:", error.response?.data || error.message);
      toast("Error updating profile");
    } finally {
      setLoading(false);
    }
  };

  return (
  
    <div className="min-h-screen font-generalSans bg-bg-dark-lm dark:bg-bg-dark text-text-lm dark:text-text p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Profile </h1>
              <p className="text-text-muted-lm dark:text-text-muted mt-1">Manage your account and preferences</p>
            </div>
            <Button
              onClick={() => setIsEditing((prev) => !prev)}
              className={`flex items-center gap-2 rounded-[4px] border-2 px-4 py-2 text-sm font-medium font-generalSans ${
                isEditing
                  ? "border-danger-lm/50 dark:border-danger/45 bg-danger-lm/15 dark:bg-danger/20 text-danger-lm dark:text-danger hover:bg-danger-lm/20 dark:hover:bg-danger/25 shadow-none"
                  : "border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] text-text dark:text-text-lm shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)] hover:opacity-90"
              }`}
            >
              <Edit className="w-4 h-4" />
              {isEditing ? "Cancel" : "Edit Profile"}
            </Button>


          </div>
        </motion.div>

        {/* Profile Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800 text-text-lm dark:text-text">
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                <Avatar className="w-24 h-24 border-2 border-blue-600">
                  <AvatarImage src="/placeholder.svg?height=96&width=96" />
                  <AvatarFallback className="bg-blue-300 text-text-lm dark:text-text text-2xl">
                    {user ? (
  getInitials(user.first_name, user.last_name)
) : (
  getInitials("Guest", " ")
)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold">
                      {user?.first_name} {user?.last_name}
                    </h2>
                    {user?.email_verified && (
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/50">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                    {user?.is_active ? (
                      <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/50">Active</Badge>
                    ) : (
                      <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/50">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-text-muted-lm dark:text-text-muted mb-2">
                    <Mail className="w-4 h-4" />
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-muted-lm dark:text-text-muted">
                    <Shield className="w-4 h-4" />
                    <span className="capitalize">{user?.role}</span>
                  </div>
                </div>
                {/* <div className="text-right">
                  <p className="text-sm text-gray-400">User ID</p>
                  <p className="text-xs text-gray-500 font-mono">{userData.id.split("-")[0]}...</p>
                </div> */}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-1 ">
          <TabsList className="bg-bg-light-lm dark:bg-bg-light border border-gray-800">
  <TabsTrigger
    value="account"
    className="data-[state=active]:bg-highlight data-[state=active]:text-white transition-colors"
  >
    Account
  </TabsTrigger>
  <TabsTrigger
    value="security"
    className="data-[state=active]:bg-highlight data-[state=active]:text-white transition-colors"
  >
    Security
  </TabsTrigger>
  <TabsTrigger
    value="notifications"
    className="data-[state=active]:bg-highlight data-[state=active]:text-white transition-colors"
  >
    Notifications
  </TabsTrigger>
  <TabsTrigger
    value="credits"
    className="data-[state=active]:bg-highlight data-[state=active]:text-white transition-colors"
  >
    Credits
  </TabsTrigger>
</TabsList>


          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Personal Information */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800 text-text-lm dark:text-text h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-400" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>Your basic account details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
  {/* First Name */}
  <div>
    <label className="text-sm text-text-muted-lm dark:text-text-muted">First Name</label>
    {isEditing ? (
      <input
        type="text"
        value={user?.first_name || ""}
        onChange={(e) => setUser((prevUser) => {
  if (!prevUser) return null;
  return {
    ...prevUser,
    first_name: e.target.value,
  };
})}
        className="w-full mt-1 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    ) : (
      <p className="text-text-lm dark:text-text font-medium">{user?.first_name}</p>
    )}
  </div>

  <Separator className="bg-gray-800" />

  {/* Last Name */}
  <div>
    <label className="text-sm text-text-muted-lm dark:text-text-muted">Last Name</label>
    {isEditing ? (
      <input
        type="text"
        value={user?.last_name || ""}
        onChange={(e) => setUser((prevUser) => {
  if (!prevUser) return null;
  return {
    ...prevUser,
    last_name: e.target.value,
  };
})}
        className="w-full mt-1 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    ) : (
      <p className="text-text-lm dark:text-text font-medium">{user?.last_name}</p>
    )}
  </div>

  <Separator className="bg-gray-800" />

  {/* Email (read-only) */}
  <div>
    <label className="text-sm text-text-muted-lm dark:text-text-muted">Email Address</label>
    <p className="text-text-lm dark:text-text font-medium flex items-center gap-2">
      {user?.email}
      {user?.email_verified && <CheckCircle2 className="w-4 h-4 text-green-400" />}
    </p>
  </div>

  <Separator className="bg-gray-800" />

  {/* Phone */}
  <div>
    <label className="text-sm text-text-muted-lm dark:text-text-muted">Phone Number</label>
    {isEditing ? (
      <input
        type="text"
        value={user?.phone || ""}
        onChange={(e) => setUser((prevUser) => {
  if (!prevUser) return null;
  return {
    ...prevUser,
    phone: e.target.value,
  };
})}
        className="w-full mt-1 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter phone number"
      />
    ) : (
      <p className="text-text-lm dark:text-text font-medium">
        {user?.phone || <span className="text-gray-500 italic">Not provided</span>}
      </p>
    )}
  </div>

  <Separator className="bg-gray-800" />

  {/* Company */}
  <div>
    <label className="text-sm text-text-muted-lm dark:text-text-muted">Company</label>
    {isEditing ? (
      <input
        type="text"
        value={user?.company || ""}
        onChange={(e) => setUser((prevUser) => {
  if (!prevUser) return null;
  return {
    ...prevUser,
    company: e.target.value,
  };
})}
        className="w-full mt-1 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter company name"
      />
    ) : (
      <p className="text-text-lm dark:text-text font-medium">
        {user?.company || <span className="text-gray-500 italic">Not provided</span>}
      </p>
    )}
  </div>

  {/* Save Button (only in edit mode) */}
  {isEditing && (
    <div className="flex justify-end pt-4">
      <Button
        onClick={handleUpdate}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        Save Changes
      </Button>
    </div>
  )}
</CardContent>

                </Card>
              </motion.div>

              {/* Account Details */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800 text-text-lm dark:text-text h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-purple-400" />
                      Account Details
                    </CardTitle>
                    <CardDescription>Account status and timestamps</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm text-text-muted-lm dark:text-text-muted flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Account Created
                      </label>
                      <p className="text-text-lm dark:text-text font-medium">{formatDate(user?.created_at)}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(user?.created_at)}</p>
                    </div>
                    <Separator className="bg-gray-800" />
                    <div>
                      <label className="text-sm text-text-muted-lm dark:text-text-muted flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Last Updated
                      </label>
                      <p className="text-text-lm dark:text-text font-medium">{formatDate(user?.updated_at)}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(user?.updated_at)}</p>
                    </div>
                    <Separator className="bg-gray-800" />
                    <div>
                      <label className="text-sm text-text-muted-lm dark:text-text-muted flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Last Login
                      </label>
                      <p className="text-white font-medium">
                        {user?.last_login ? (
                          <>
                            {formatDate(user?.last_login)}
                            <span className="text-xs text-gray-500 block">{formatDateTime(user?.last_login)}</span>
                          </>
                        ) : (
                          <span className="text-gray-500 italic">Never logged in</span>
                        )}
                      </p>
                    </div>
                    <Separator className="bg-gray-800" />
                    <div>
                      <label className="text-sm text-text-muted-lm dark:text-text-muted flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Organization ID
                      </label>
                      <p className="text-white font-medium">
                        {user?.organization_id || <span className="text-gray-500 italic">Not assigned</span>}
                      </p>
                    </div>
                    <Separator className="bg-gray-800" />
                    <div>
                      <label className="text-sm text-text-muted-lm dark:text-text-muted mr-2">Account Role</label>
                      <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/50 capitalize">
                        {user?.role}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Security Settings */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800 text-text-lm dark:text-text">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-red-400" />
                      Security Settings
                    </CardTitle>
                    <CardDescription>Manage your security preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium">Two-Factor Authentication</label>
                        <p className="text-xs text-gray-400">Add an extra layer of security</p>
                      </div>
                      <Switch
                        checked={security.two_factor}
                        onCheckedChange={(checked) => setSecurity({ ...security, two_factor: checked })}
                      />
                    </div>
                    <Separator className="bg-gray-800" />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium">Login Alerts</label>
                        <p className="text-xs text-gray-400">Get notified of new logins</p>
                      </div>
                      <Switch
                        checked={security.login_alerts}
                        onCheckedChange={(checked) => setSecurity({ ...security, login_alerts: checked })}
                      />
                    </div>
                    <Separator className="bg-gray-800" />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium">Session Timeout</label>
                        <p className="text-xs text-gray-400">Auto-logout after inactivity</p>
                      </div>
                      <Switch
                        checked={security.session_timeout}
                        onCheckedChange={(checked) => setSecurity({ ...security, session_timeout: checked })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Password & Authentication */}
              {/* Password & Authentication with Change Password form */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800 text-text-lm dark:text-text">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-warning" />
                      Password & Authentication
                    </CardTitle>
                    <CardDescription>Manage your password and API keys</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={() => setIsChangingPassword((v) => !v)}
                      className="w-full rounded-[4px] border-2 border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] font-generalSans font-medium text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)]"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      {isChangingPassword ? "Cancel" : "Change Password"}
                    </Button>

                    {/* Animated reveal for change password form */}
                    {isChangingPassword && (
                      <motion.div
                        role="region"
                        aria-label="Change Password"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-md border border-gray-800 bg-bg-dark-lm/40 dark:bg-bg-dark/40 p-4 space-y-4"
                      >
                        {/* Current Password */}
                        <div>
                          <label
                            htmlFor="current_password"
                            className="block text-sm text-text-muted-lm dark:text-text-muted mb-1"
                          >
                            Current Password
                          </label>
                          <div className="relative">
                            <input
                              id="current_password"
                              type={showCurrent ? "text" : "password"}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="w-full pr-10 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter current password"
                            />
                            <button
                              type="button"
                              aria-label={showCurrent ? "Hide current password" : "Show current password"}
                              onClick={() => setShowCurrent((s) => (s ? false : true))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted-lm dark:text-text-muted hover:text-text"
                            >
                              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* New Password */}
                        <div>
                          <label
                            htmlFor="new_password"
                            className="block text-sm text-text-muted-lm dark:text-text-muted mb-1"
                          >
                            New Password
                          </label>
                          <div className="relative">
                            <input
                              id="new_password"
                              type={showNew ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full pr-10 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter new password"
                            />
                            <button
                              type="button"
                              aria-label={showNew ? "Hide new password" : "Show new password"}
                              onClick={() => setShowNew((s) => (s ? false : true))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted-lm dark:text-text-muted hover:text-text"
                            >
                              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-text-muted-lm dark:text-text-muted">Minimum 8 characters.</p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <Button
                            onClick={() => {
                              setIsChangingPassword(false)
                              setCurrentPassword("")
                              setNewPassword("")
                            }}
                            variant="outline"
                            className="border-gray-700 hover:bg-gray-800 bg-transparent"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleChangePassword}
                            disabled={isUpdatingPassword || !currentPassword || !newPassword}
                            className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
                          >
                            {isUpdatingPassword ? "Updating..." : "Update Password"}
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    <Separator className="bg-gray-800" />

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Connected Devices</label>
                      <p className="text-xs text-gray-400">Manage devices with access to your account</p>
                      <Button variant="outline" className="w-full border-gray-700 hover:bg-gray-800 bg-transparent">
                        View Devices
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800 text-text-lm dark:text-text">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-cyan-400" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>Choose how you want to be notified</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Email Notifications</label>
                      <p className="text-xs text-gray-400">Receive updates via email</p>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                    />
                  </div>
                  <Separator className="bg-gray-800" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Push Notifications</label>
                      <p className="text-xs text-gray-400">Get instant updates on your device</p>
                    </div>
                    <Switch
                      checked={notifications.push}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                    />
                  </div>
                  <Separator className="bg-gray-800" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">SMS Notifications</label>
                      <p className="text-xs text-gray-400">Receive text messages for critical updates</p>
                    </div>
                    <Switch
                      checked={notifications.sms}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })}
                    />
                  </div>
                  <Separator className="bg-gray-800" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Weekly Digest</label>
                      <p className="text-xs text-gray-400">Get a weekly summary of your activity</p>
                    </div>
                    <Switch
                      checked={notifications.weekly_digest}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, weekly_digest: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
          <TabsContent value="credits" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">Credits & Plan</h3>
                  <p className="text-sm text-text-muted-lm dark:text-text-muted">
                    Scope: {organizationId ? `Organization (${organizationId})` : "Personal account"}
                  </p>
                </div>
                <Button variant="outline" onClick={() => refresh()} disabled={isCreditsLoading}>
                  Refresh
                </Button>
              </div>

              {creditsError && (
                <Card className="bg-bg-light-lm dark:bg-bg-light border-red-700/50">
                  <CardContent className="p-4 text-sm text-red-500">{creditsError}</CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800">
                  <CardHeader>
                    <CardDescription>Available Credits</CardDescription>
                    <CardTitle className="text-2xl">{formatNumber(overview?.available_credits)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800">
                  <CardHeader>
                    <CardDescription>Consumed / Total</CardDescription>
                    <CardTitle className="text-2xl">
                      {formatNumber(overview?.credits_consumed)} / {formatNumber(overview?.total_credits)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800">
                  <CardHeader>
                    <CardDescription>Plan & Status</CardDescription>
                    <CardTitle className="text-2xl capitalize">
                      {overview?.plan || entitlements?.plan || "unknown"}{" "}
                      <Badge className="ml-2 capitalize">{overview?.status || "n/a"}</Badge>
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800">
                <CardHeader>
                  <CardTitle>Current Cycle</CardTitle>
                  <CardDescription>
                    {overview?.cycle_start ? formatDateTime(overview.cycle_start) : "N/A"} -{" "}
                    {overview?.cycle_end ? formatDateTime(overview.cycle_end) : "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm mb-2 text-text-muted-lm dark:text-text-muted">Feature Access</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entitlements?.rules?.features || {}).map(([key, enabled]) => (
                        <Badge
                          key={key}
                          className={enabled ? "bg-green-700/30 text-green-400" : "bg-red-700/30 text-red-400"}
                        >
                          {key}: {enabled ? "on" : "off"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800">
                <CardHeader>
                  <CardTitle>Credit Records</CardTitle>
                  <CardDescription>Recent credit changes and usage events.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoadingRecords ? (
                    <p className="text-sm text-text-muted-lm dark:text-text-muted">Loading records...</p>
                  ) : (recordsResponse?.records?.length || 0) === 0 ? (
                    <p className="text-sm text-text-muted-lm dark:text-text-muted">No credit records found.</p>
                  ) : (
                    <div className="space-y-2">
                      {recordsResponse?.records?.map((record: CreditRecord) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between rounded-md border border-gray-700 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium capitalize">{formatRecordType(record.record_type)}</p>
                            <p className="text-xs text-text-muted-lm dark:text-text-muted">
                              {record.action_key || "system"} • {formatDateTime(record.created_at)}
                            </p>
                          </div>
                          <Badge className={record.credits_delta < 0 ? "bg-red-700/30 text-red-400" : "bg-green-700/30 text-green-400"}>
                            {formatDelta(record.credits_delta)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
                      disabled={recordsPage <= 1 || isLoadingRecords}
                    >
                      Previous
                    </Button>
                    <p className="text-sm text-text-muted-lm dark:text-text-muted">
                      Page {recordsResponse?.page || recordsPage} / {recordsResponse?.total_pages || 1}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setRecordsPage((p) => p + 1)}
                      disabled={isLoadingRecords || (recordsResponse?.total_pages ? recordsPage >= recordsResponse.total_pages : true)}
                    >
                      Next
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

         
        </Tabs>
      </div>
    </div>
  )
}
