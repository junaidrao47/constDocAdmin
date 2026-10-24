"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, errorMessage } from "@/lib/api";

interface AppSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

const emailSchema = z.string().trim().email("Enter a valid email address.").max(254);

function settingString(settings: AppSetting[] | undefined, key: string): string {
  const row = settings?.find((s) => s.key === key);
  return typeof row?.value === "string" ? row.value : "";
}

export default function AdminSettingsPage() {
  const client = useQueryClient();

  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiRequest<AppSetting[]>("/admin/settings"),
  });

  const [contactEmail, setContactEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // Seed the input from the server value once it loads (and whenever it changes after a save).
  const serverContactEmail = settingString(settings.data, "contact_recipient_email");
  useEffect(() => {
    setContactEmail(serverContactEmail);
  }, [serverContactEmail]);

  const save = useMutation({
    mutationFn: (value: string) =>
      apiRequest<AppSetting>("/admin/settings/contact_recipient_email", {
        method: "PUT",
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      toast.success("Contact recipient saved.");
      void client.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save the setting.")),
  });

  function submitContactEmail(event: React.FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(contactEmail);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }
    setEmailError("");
    save.mutate(parsed.data);
  }

  const dirty = contactEmail.trim() !== serverContactEmail;

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Platform"
        title="Settings"
        description="Configure how the public website and platform behave."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Contact form recipient</CardTitle>
          <CardDescription>
            Messages sent from the website’s contact page are delivered to this email address.
            Change it any time; new inquiries go to the updated address immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : settings.isError ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                {errorMessage(settings.error, "Could not load settings.")}
              </p>
              <Button variant="outline" size="sm" onClick={() => settings.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <form onSubmit={submitContactEmail} className="grid max-w-md gap-1.5">
              <Label htmlFor="contact-email">Recipient email</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="inquiries@yourcompany.com"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                aria-invalid={Boolean(emailError)}
              />
              {emailError && <span className="text-xs text-destructive">{emailError}</span>}
              {!serverContactEmail && (
                <span className="text-xs text-muted-foreground">
                  Not set yet — inquiries currently fall back to the platform sender address.
                </span>
              )}
              <div className="mt-3">
                <Button type="submit" disabled={save.isPending || !dirty}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
