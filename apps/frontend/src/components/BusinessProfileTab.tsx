"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingLogo } from "@/components/Loading";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { API_V1_BASE_URL } from "@/lib/api";

interface BusinessProfileTabProps {
  orgId: string;
  token?: string;
  role?: string;
}

interface ProfileData {
  business_hours: string;
  primary_markets: string[];
  default_currency: string;
  supported_languages: string[];
  support_email: string;
  support_channels: string[];
  social_links: Record<string, string>;
  fulfillment_method: string;
  shipping_carriers: string[];
  returns_policy_url: string;
  payment_gateways: string[];
  tax_identifiers: Record<string, string>;
  primary_contacts: any[]; // using broadly as per schema prompt
  compliance_contacts: any[];
  ecommerce_platforms: any[];
  key_systems: string[];
  holiday_blackout_dates: string[];
  data_processing_addenda: string;
}

const DEFAULT_PROFILE: ProfileData = {
  business_hours: "",
  primary_markets: [],
  default_currency: "",
  supported_languages: [],
  support_email: "",
  support_channels: [],
  social_links: {},
  fulfillment_method: "",
  shipping_carriers: [],
  returns_policy_url: "",
  payment_gateways: [],
  tax_identifiers: {},
  primary_contacts: [],
  compliance_contacts: [],
  ecommerce_platforms: [],
  key_systems: [],
  holiday_blackout_dates: [],
  data_processing_addenda: "",
};

export default function BusinessProfileTab({ orgId, token, role }: BusinessProfileTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileData>(DEFAULT_PROFILE);
  const [originalData, setOriginalData] = useState<ProfileData>(DEFAULT_PROFILE);
  const [isDirty, setIsDirty] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isAdmin = role === "admin";

  useEffect(() => {
    const fetchBusinessProfile = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${API_V1_BASE_URL}/organizations/${orgId}/business-profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        // Ensure all arrays/objects are initialized correctly even if backend returns null
        const safeData = {
          ...DEFAULT_PROFILE,
          ...(data.data || {}),
        };
        setFormData(safeData);
        setOriginalData(safeData);
      } catch (err: any) {
        if (err.response?.status === 404) {
          // If not found, it means it hasn't been created yet. We start with DEFAULT.
        } else {
          toast.error("Failed to load business profile");
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };

    if (token && orgId) {
      fetchBusinessProfile();
    }
  }, [orgId, token]);

  // Check if form is dirty whenever formData changes
  useEffect(() => {
    setIsDirty(JSON.stringify(formData) !== JSON.stringify(originalData));
  }, [formData, originalData]);

  const handleSubmit = async () => {
    if (!isAdmin) return;
    
    setSaving(true);
    try {
      await axios.put(
        `${API_V1_BASE_URL}/organizations/${orgId}/business-profile`,
        formData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success("Business profile saved successfully");
      setOriginalData(formData);
      setIsDirty(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save business profile");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return;
    
    setSaving(true);
    try {
      await axios.delete(
        `${API_V1_BASE_URL}/organizations/${orgId}/business-profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success("Business profile deleted successfully");
      setFormData(DEFAULT_PROFILE);
      setOriginalData(DEFAULT_PROFILE);
      setIsDirty(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete business profile");
    } finally {
      setSaving(false);
    }
  };

  // --- Helpers for updating nested fields ---
  const handleStringChange = (field: keyof ProfileData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field: keyof ProfileData, value: string) => {
    const arr = value.split(",").map((v) => v.trim()).filter(Boolean);
    setFormData((prev) => ({ ...prev, [field]: arr }));
  };

  const handleMapUpdate = (field: keyof ProfileData, key: string, val: string) => {
    setFormData((prev) => {
      const map = { ...(prev[field] as Record<string, string>) };
      map[key] = val;
      return { ...prev, [field]: map };
    });
  };

  const handleMapDelete = (field: keyof ProfileData, key: string) => {
    setFormData((prev) => {
      const map = { ...(prev[field] as Record<string, string>) };
      delete map[key];
      return { ...prev, [field]: map };
    });
  };

  const addMapEntry = (field: keyof ProfileData) => {
    setFormData((prev) => {
      const map = { ...(prev[field] as Record<string, string>) };
      let newKey = "";
      let counter = 1;
      while (newKey in map) {
        newKey = `entry_${counter}`;
        counter++;
      }
      map[newKey] = "";
      return { ...prev, [field]: map };
    });
  };

  // Generic Array of Objects (e.g., Contacts, Platforms)
  const addObjectToArray = (field: keyof ProfileData, template: any) => {
    setFormData((prev) => {
      const arr = [...(prev[field] as any[])];
      arr.push(template);
      return { ...prev, [field]: arr };
    });
  };

  const updateObjectInArray = (field: keyof ProfileData, index: number, objKey: string, val: string) => {
    setFormData((prev) => {
      const arr = [...(prev[field] as any[])];
      arr[index] = { ...arr[index], [objKey]: val };
      return { ...prev, [field]: arr };
    });
  };

  const removeObjectFromArray = (field: keyof ProfileData, index: number) => {
    setFormData((prev) => {
      const arr = [...(prev[field] as any[])];
      arr.splice(index, 1);
      return { ...prev, [field]: arr };
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <LoadingLogo bgColor="bg-bg-light-lm dark:bg-bg-light" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-800">
        <div>
          <h2 className="text-xl font-semibold">Business Profile</h2>
          {!isAdmin && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              You do not have the required permissions to edit these settings. Admin role required.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost"
                className="text-danger-lm dark:text-danger hover:text-red-500 hover:bg-red-500/10"
                disabled={saving || !isAdmin}
              >
                Delete Profile
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="font-generalSans text-text bg-bg border-gray-800">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the organization's business profile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-transparent border-gray-700 hover:bg-gray-800 text-text">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete}
                  className="bg-danger-lm dark:bg-danger text-white hover:bg-red-600"
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button 
            className="bg-success-lm dark:bg-success hover:bg-green-700 dark:hover:bg-green-600 text-white transition-colors"
            onClick={handleSubmit} 
            disabled={!isDirty || saving || !isAdmin}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic String Fields */}
        <div className="space-y-2">
          <Label>Business Hours</Label>
          <Input
            value={formData.business_hours}
            onChange={(e) => handleStringChange("business_hours", e.target.value)}
            disabled={!isAdmin}
            placeholder="e.g., Mon-Fri 9AM-5PM EST"
          />
        </div>

        <div className="space-y-2">
          <Label>Default Currency</Label>
          <Input
            value={formData.default_currency}
            onChange={(e) => handleStringChange("default_currency", e.target.value)}
            disabled={!isAdmin}
            placeholder="e.g., USD"
          />
        </div>

        <div className="space-y-2">
          <Label>Support Email</Label>
          <Input
            type="email"
            value={formData.support_email}
            onChange={(e) => handleStringChange("support_email", e.target.value)}
            disabled={!isAdmin}
            placeholder="support@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label>Fulfillment Method</Label>
          <Input
            value={formData.fulfillment_method}
            onChange={(e) => handleStringChange("fulfillment_method", e.target.value)}
            disabled={!isAdmin}
            placeholder="e.g., In-house, 3PL"
          />
        </div>

        <div className="space-y-2">
          <Label>Returns Policy URL</Label>
          <Input
            value={formData.returns_policy_url}
            onChange={(e) => handleStringChange("returns_policy_url", e.target.value)}
            disabled={!isAdmin}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <Label>Data Processing Addenda URL</Label>
          <Input
            value={formData.data_processing_addenda}
            onChange={(e) => handleStringChange("data_processing_addenda", e.target.value)}
            disabled={!isAdmin}
            placeholder="https://..."
          />
        </div>

        {/* Array Fields (Comma Separated) */}
        <div className="space-y-2">
          <Label>Primary Markets (comma-separated)</Label>
          <Input
            value={formData.primary_markets.join(", ")}
            onChange={(e) => handleArrayChange("primary_markets", e.target.value)}
            disabled={!isAdmin}
            placeholder="US, CA, UK"
          />
        </div>

        <div className="space-y-2">
          <Label>Supported Languages (comma-separated)</Label>
          <Input
            value={formData.supported_languages.join(", ")}
            onChange={(e) => handleArrayChange("supported_languages", e.target.value)}
            disabled={!isAdmin}
            placeholder="en, fr, es"
          />
        </div>

        <div className="space-y-2">
          <Label>Support Channels (comma-separated)</Label>
          <Input
            value={formData.support_channels.join(", ")}
            onChange={(e) => handleArrayChange("support_channels", e.target.value)}
            disabled={!isAdmin}
            placeholder="email, phone, chat"
          />
        </div>

        <div className="space-y-2">
          <Label>Shipping Carriers (comma-separated)</Label>
          <Input
            value={formData.shipping_carriers.join(", ")}
            onChange={(e) => handleArrayChange("shipping_carriers", e.target.value)}
            disabled={!isAdmin}
            placeholder="FedEx, UPS, USPS"
          />
        </div>

        <div className="space-y-2">
          <Label>Payment Gateways (comma-separated)</Label>
          <Input
            value={formData.payment_gateways.join(", ")}
            onChange={(e) => handleArrayChange("payment_gateways", e.target.value)}
            disabled={!isAdmin}
            placeholder="Stripe, PayPal"
          />
        </div>

        <div className="space-y-2">
          <Label>Key Systems (comma-separated)</Label>
          <Input
            value={formData.key_systems.join(", ")}
            onChange={(e) => handleArrayChange("key_systems", e.target.value)}
            disabled={!isAdmin}
            placeholder="ERP, CRM"
          />
        </div>

        <div className="space-y-2">
          <Label>Holiday Blackout Dates (comma-separated)</Label>
          <Input
            value={formData.holiday_blackout_dates.join(", ")}
            onChange={(e) => handleArrayChange("holiday_blackout_dates", e.target.value)}
            disabled={!isAdmin}
            placeholder="2024-12-25, 2024-12-26"
          />
        </div>
      </div>

      <div className="border-t border-gray-800 my-6 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Map Fields (Key-Value) */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Social Links</Label>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => addMapEntry("social_links")}>
                <Plus className="w-4 h-4" /> Add
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {Object.entries(formData.social_links).map(([key, val]) => (
              <div key={key} className="flex gap-2 items-center">
                <Input
                  className="w-1/3"
                  value={key}
                  disabled={!isAdmin}
                  onChange={(e) => {
                    const newKey = e.target.value;
                    const value = formData.social_links[key];
                    setFormData((prev) => {
                      const map = { ...prev.social_links };
                      delete map[key];
                      map[newKey] = value;
                      return { ...prev, social_links: map };
                    });
                  }}
                  placeholder="Platform"
                />
                <Input
                  className="flex-1"
                  value={val}
                  disabled={!isAdmin}
                  onChange={(e) => handleMapUpdate("social_links", key, e.target.value)}
                  placeholder="URL"
                />
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleMapDelete("social_links", key)}>
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
           <div className="flex justify-between items-center mb-2">
            <Label>Tax Identifiers</Label>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => addMapEntry("tax_identifiers")}>
                <Plus className="w-4 h-4" /> Add
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {Object.entries(formData.tax_identifiers).map(([key, val]) => (
              <div key={key} className="flex gap-2 items-center">
                <Input
                  className="w-1/3"
                  value={key}
                  disabled={!isAdmin}
                  onChange={(e) => {
                     const newKey = e.target.value;
                    const value = formData.tax_identifiers[key];
                    setFormData((prev) => {
                      const map = { ...prev.tax_identifiers };
                      delete map[key];
                      map[newKey] = value;
                      return { ...prev, tax_identifiers: map };
                    });
                  }}
                  placeholder="Country/Region"
                />
                <Input
                  className="flex-1"
                  value={val}
                  disabled={!isAdmin}
                  onChange={(e) => handleMapUpdate("tax_identifiers", key, e.target.value)}
                  placeholder="Tax ID"
                />
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleMapDelete("tax_identifiers", key)}>
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800 my-6 pt-6">
        <h3 className="text-lg font-medium mb-4">Contacts & Platforms</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Primary Contacts Array */}
          <div className="space-y-3">
             <div className="flex justify-between items-center">
              <Label>Primary Contacts</Label>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => addObjectToArray("primary_contacts", { name: "", email: "", role: "" })}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {formData.primary_contacts.map((contact, i) => (
                <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-md relative group">
                  {isAdmin && (
                    <button onClick={() => removeObjectFromArray("primary_contacts", i)} className="absolute top-2 right-2 hidden group-hover:block">
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                  <Input className="mb-2" placeholder="Name" value={contact.name || ""} disabled={!isAdmin} onChange={(e) => updateObjectInArray("primary_contacts", i, "name", e.target.value)} />
                  <Input className="mb-2" type="email" placeholder="Email" value={contact.email || ""} disabled={!isAdmin} onChange={(e) => updateObjectInArray("primary_contacts", i, "email", e.target.value)} />
                  <Input placeholder="Role" value={contact.role || ""} disabled={!isAdmin} onChange={(e) => updateObjectInArray("primary_contacts", i, "role", e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* Compliance Contacts Array */}
          <div className="space-y-3">
             <div className="flex justify-between items-center">
              <Label>Compliance Contacts</Label>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => addObjectToArray("compliance_contacts", { name: "", email: "", role: "" })}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {formData.compliance_contacts.map((contact, i) => (
                <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-md relative group">
                  {isAdmin && (
                    <button onClick={() => removeObjectFromArray("compliance_contacts", i)} className="absolute top-2 right-2 hidden group-hover:block">
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                  <Input className="mb-2" placeholder="Name" value={contact.name || ""} disabled={!isAdmin} onChange={(e) => updateObjectInArray("compliance_contacts", i, "name", e.target.value)} />
                  <Input className="mb-2" type="email" placeholder="Email" value={contact.email || ""} disabled={!isAdmin} onChange={(e) => updateObjectInArray("compliance_contacts", i, "email", e.target.value)} />
                  <Input placeholder="Role" value={contact.role || ""} disabled={!isAdmin} onChange={(e) => updateObjectInArray("compliance_contacts", i, "role", e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* Ecommerce Platforms Array */}
          <div className="space-y-3">
             <div className="flex justify-between items-center">
              <Label>Ecommerce Platforms</Label>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => addObjectToArray("ecommerce_platforms", { platform_name: "", store_url: "" })}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {formData.ecommerce_platforms.map((platform, i) => (
                <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-md relative group">
                  {isAdmin && (
                    <button onClick={() => removeObjectFromArray("ecommerce_platforms", i)} className="absolute top-2 right-2 hidden group-hover:block">
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                  <Input className="mb-2" placeholder="Platform Name (e.g., Shopify)" value={platform.platform_name || ""} disabled={!isAdmin} onChange={(e) => updateObjectInArray("ecommerce_platforms", i, "platform_name", e.target.value)} />
                  <Input placeholder="Store URL" value={platform.store_url || ""} disabled={!isAdmin} onChange={(e) => updateObjectInArray("ecommerce_platforms", i, "store_url", e.target.value)} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
