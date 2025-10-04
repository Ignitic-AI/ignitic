"use client"

import { useState } from "react"
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
  Globe,
  Edit,
  Key,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

// Mock user data from the provided structure
const userData = {
  company: "",
  created_at: "2025-09-22T22:26:51.906131Z",
  email: "testai9901@gmail.com",
  email_verified: true,
  first_name: "Affan",
  id: "14510d71-9233-4e4b-bf8b-af80ddfee20f",
  is_active: true,
  last_login: null,
  last_name: "Amir",
  organization_id: null,
  phone: "",
  role: "user",
  updated_at: "2025-09-22T22:28:07.251758Z",
}

export default function ProfilePage() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: false,
    weekly_digest: true,
  })
  const [isEditing, setIsEditing] = useState(false);
const [profile, setProfile] = useState({
  first_name: userData.first_name,
  last_name: userData.last_name,
  phone: userData.phone,
  company: userData.company,
});

  const [security, setSecurity] = useState({
    two_factor: false,
    login_alerts: true,
    session_timeout: true,
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

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
  className={`flex items-center ${
    isEditing
      ? "bg-danger hover:bg-red-400"
      : "bg-blue-600 hover:bg-blue-700"
  } transition-colors`}
>
  <Edit className="w-4 h-4 mr-2" />
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
                    {getInitials(userData.first_name, userData.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold">
                      {userData.first_name} {userData.last_name}
                    </h2>
                    {userData.email_verified && (
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/50">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                    {userData.is_active ? (
                      <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/50">Active</Badge>
                    ) : (
                      <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/50">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-text-muted-lm dark:text-text-muted mb-2">
                    <Mail className="w-4 h-4" />
                    <span>{userData.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-muted-lm dark:text-text-muted">
                    <Shield className="w-4 h-4" />
                    <span className="capitalize">{userData.role}</span>
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
        <Tabs defaultValue="account" className="space-y-1 ">
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
        value={profile.first_name}
        onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
        className="w-full mt-1 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    ) : (
      <p className="text-text-lm dark:text-text font-medium">{profile.first_name}</p>
    )}
  </div>

  <Separator className="bg-gray-800" />

  {/* Last Name */}
  <div>
    <label className="text-sm text-text-muted-lm dark:text-text-muted">Last Name</label>
    {isEditing ? (
      <input
        type="text"
        value={profile.last_name}
        onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
        className="w-full mt-1 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    ) : (
      <p className="text-text-lm dark:text-text font-medium">{profile.last_name}</p>
    )}
  </div>

  <Separator className="bg-gray-800" />

  {/* Email (read-only) */}
  <div>
    <label className="text-sm text-text-muted-lm dark:text-text-muted">Email Address</label>
    <p className="text-text-lm dark:text-text font-medium flex items-center gap-2">
      {userData.email}
      {userData.email_verified && <CheckCircle2 className="w-4 h-4 text-green-400" />}
    </p>
  </div>

  <Separator className="bg-gray-800" />

  {/* Phone */}
  <div>
    <label className="text-sm text-text-muted-lm dark:text-text-muted">Phone Number</label>
    {isEditing ? (
      <input
        type="text"
        value={profile.phone || ""}
        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
        className="w-full mt-1 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter phone number"
      />
    ) : (
      <p className="text-text-lm dark:text-text font-medium">
        {profile.phone || <span className="text-gray-500 italic">Not provided</span>}
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
        value={profile.company || ""}
        onChange={(e) => setProfile({ ...profile, company: e.target.value })}
        className="w-full mt-1 px-3 py-2 bg-bg-light-lm dark:bg-bg-light border border-gray-700 rounded-md text-text-lm dark:text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter company name"
      />
    ) : (
      <p className="text-text-lm dark:text-text font-medium">
        {profile.company || <span className="text-gray-500 italic">Not provided</span>}
      </p>
    )}
  </div>

  {/* Save Button (only in edit mode) */}
  {isEditing && (
    <div className="flex justify-end pt-4">
      <Button
        // onClick={}
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
                      <p className="text-text-lm dark:text-text font-medium">{formatDate(userData.created_at)}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(userData.created_at)}</p>
                    </div>
                    <Separator className="bg-gray-800" />
                    <div>
                      <label className="text-sm text-text-muted-lm dark:text-text-muted flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Last Updated
                      </label>
                      <p className="text-text-lm dark:text-text font-medium">{formatDate(userData.updated_at)}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(userData.updated_at)}</p>
                    </div>
                    <Separator className="bg-gray-800" />
                    <div>
                      <label className="text-sm text-text-muted-lm dark:text-text-muted flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Last Login
                      </label>
                      <p className="text-white font-medium">
                        {userData.last_login ? (
                          <>
                            {formatDate(userData.last_login)}
                            <span className="text-xs text-gray-500 block">{formatDateTime(userData.last_login)}</span>
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
                        {userData.organization_id || <span className="text-gray-500 italic">Not assigned</span>}
                      </p>
                    </div>
                    <Separator className="bg-gray-800" />
                    <div>
                      <label className="text-sm text-text-muted-lm dark:text-text-muted mr-2">Account Role</label>
                      <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/50 capitalize">
                        {userData.role}
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
                    <Button className="w-full bg-primary-lm dark:bg-primary">
                      <Lock className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                    <Button className="w-full bg-primary-lm dark:bg-primary">
                      <Key className="w-4 h-4 mr-2" />
                      Manage API Keys
                    </Button>
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

         
        </Tabs>
      </div>
    </div>
  )
}
