"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useOrgStore } from "@/app/_store/useorgStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Trash2, Plus } from "lucide-react";

export default function OrgInvite() {
  const { currentOrg } = useOrgStore();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteList, setInviteList] = useState([{ email: "", role: "member" }]);

  // handle button click
  const handleInviteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentOrg) {
      toast.error("Create an Organization First", {
          description: "You need to create an organization before inviting members.",
        });
      return;
    }
    setIsInviteOpen(true);
  };

  // form logic
  const handleAddMember = () => {
    setInviteList([...inviteList, { email: "", role: "member" }]);
  };

  const handleRemoveMember = (index: number) => {
    setInviteList(inviteList.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: string, value: string) => {
    const updated = [...inviteList];
    updated[index][field as keyof typeof updated[number]] = value;
    setInviteList(updated);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(`${inviteList.length} invite(s) sent successfully!`);
    setIsInviteOpen(false);
  };

  return (
    <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
      {/* Button */}
      <DialogTrigger asChild>
        <Button
          onClick={handleInviteClick}
          variant="outline"
          className="bg-bg-light-lm text-text-lm dark:bg-bg-light dark:text-text hover:bg-white font-semibold text-lg px-3 py-1 font-generalSans"
        >
          <UserPlus className="h-4 w-4" />
          Invite 
        </Button>
      </DialogTrigger>

      {/* Dialog Content */}
      <DialogContent className="max-w-lg bg-text dark:bg-text-lm border font-generalSans">
        <form onSubmit={handleInvite}>
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold text-text-lm dark:text-text">
              Invite Members
            </DialogTitle>
            <DialogDescription className="text-text-muted-lm dark:text-text-muted -mt-4">
              Add one or more members with their email and role.
            </DialogDescription>
          </DialogHeader>

          {/* Invite List */}
          <div className="grid gap-4 py-6 max-h-[400px] overflow-y-auto pr-2">
            {inviteList.map((member, index) => (
              <div
                key={index}
                className="grid gap-4 border border-border p-2 rounded-lg relative shadow-sm bg-gray-100 dark:bg-bg-light"
              >
                {/* Email */}
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-text-muted-lm dark:text-text-muted">
                    Email
                  </Label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={member.email}
                    onChange={(e) =>
                      handleChange(index, "email", e.target.value)
                    }
                    required
                    className="bg-background border-input"
                  />
                </div>

                {/* Role */}
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-text-muted-lm dark:text-text-muted">
                    Role
                  </Label>
                  <Select
                    value={member.role}
                    onValueChange={(value) =>
                      handleChange(index, "role", value)
                    }
                  >
                    <SelectTrigger className="bg-background border-input">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Remove */}
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

            {/* Add Another Member */}
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

          {/* Footer */}
          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsInviteOpen(false)}
              className="px-6"
            >
              Cancel
            </Button>
            <Button type="submit" className="px-6">
              Send Invites
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
