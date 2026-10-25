"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
function settingBool(settings: AppSetting[] | undefined, key: string): boolean {
  return settings?.find((s) => s.key === key)?.value === true;
}

async function putSetting(key: string, value: unknown) {
  return apiRequest<AppSetting>(`/admin/settings/${key}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

export default function AdminSettingsPage() {
  const client = useQueryClient();

  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiRequest<AppSetting[]>("/admin/settings"),
  });

  // ── Contact recipient ──────────────────────────────────────────────────────
  const [contactEmail, setContactEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const serverContactEmail = settingString(settings.data, "contact_recipient_email");
  useEffect(() => {
    setContactEmail(serverContactEmail);
  }, [serverContactEmail]);

  const saveEmail = useMutation({
    mutationFn: (value: string) => putSetting("contact_recipient_email", value),
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
    saveEmail.mutate(parsed.data);
  }
  const emailDirty = contactEmail.trim() !== serverContactEmail;

  // ── Announcement / offer bar ───────────────────────────────────────────────
  const srvEnabled = settingBool(settings.data, "offer_bar_enabled");
  const srvEn = settingString(settings.data, "offer_bar_text_en");
  const srvEs = settingString(settings.data, "offer_bar_text_es");
  const srvLink = settingString(settings.data, "offer_bar_link");

  const [offerEnabled, setOfferEnabled] = useState(false);
  const [offerEn, setOfferEn] = useState("");
  const [offerEs, setOfferEs] = useState("");
  const [offerLink, setOfferLink] = useState("");
  useEffect(() => {
    setOfferEnabled(srvEnabled);
    setOfferEn(srvEn);
    setOfferEs(srvEs);
    setOfferLink(srvLink);
  }, [srvEnabled, srvEn, srvEs, srvLink]);

  const saveOffer = useMutation({
    mutationFn: async () => {
      // app_settings is key/value, so each field is its own PUT. Order is irrelevant.
      await putSetting("offer_bar_text_en", offerEn.trim());
      await putSetting("offer_bar_text_es", offerEs.trim());
      await putSetting("offer_bar_link", offerLink.trim());
      await putSetting("offer_bar_enabled", offerEnabled);
    },
    onSuccess: () => {
      toast.success("Announcement bar saved.");
      void client.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save the announcement bar.")),
  });

  const offerDirty =
    offerEnabled !== srvEnabled ||
    offerEn.trim() !== srvEn ||
    offerEs.trim() !== srvEs ||
    offerLink.trim() !== srvLink;
  const offerIncomplete = offerEnabled && (!offerEn.trim() || !offerEs.trim());

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Platform"
        title="Settings"
        description="Configure how the public website and platform behave."
      />

      {settings.isError ? (
        <div className="max-w-2xl space-y-3">
          <p className="text-sm text-destructive">{errorMessage(settings.error, "Could not load settings.")}</p>
          <Button variant="outline" size="sm" onClick={() => settings.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid max-w-2xl gap-6">
          <Card>
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
                    <Button type="submit" disabled={saveEmail.isPending || !emailDirty}>
                      {saveEmail.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Announcement bar</CardTitle>
              <CardDescription>
                A thin bar shown above the public website’s navigation — e.g. a launch offer or
                seasonal promotion. Toggle it on and off here; it appears in the visitor’s language.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {settings.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <div className="grid gap-4">
                  <label className="flex items-center gap-2.5 text-sm font-medium">
                    <Checkbox
                      checked={offerEnabled}
                      onCheckedChange={(v) => setOfferEnabled(v === true)}
                    />
                    Show the announcement bar on the public site
                  </label>
                  <div className="grid gap-1.5">
                    <Label htmlFor="offer-en">Message (English)</Label>
                    <Input
                      id="offer-en"
                      placeholder="Launch offer: 15% off new compliance packages"
                      maxLength={200}
                      value={offerEn}
                      onChange={(e) => setOfferEn(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="offer-es">Message (Spanish)</Label>
                    <Input
                      id="offer-es"
                      placeholder="Oferta de lanzamiento: 15% de descuento…"
                      maxLength={200}
                      value={offerEs}
                      onChange={(e) => setOfferEs(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="offer-link">Link (optional)</Label>
                    <Input
                      id="offer-link"
                      placeholder="/packages or https://…"
                      maxLength={500}
                      value={offerLink}
                      onChange={(e) => setOfferLink(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">
                      A path like <code>/packages</code> or <code>/services</code>, or a full URL.
                      Leave blank for a non-clickable bar.
                    </span>
                  </div>
                  {offerIncomplete && (
                    <p className="text-xs text-destructive">
                      Add the message in both languages before enabling the bar.
                    </p>
                  )}
                  <div>
                    <Button
                      onClick={() => saveOffer.mutate()}
                      disabled={saveOffer.isPending || !offerDirty || offerIncomplete}
                    >
                      {saveOffer.isPending ? "Saving…" : "Save announcement bar"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
