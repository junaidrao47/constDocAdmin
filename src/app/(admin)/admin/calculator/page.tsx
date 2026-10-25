"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { RuleCrud } from "@/components/pricing/rule-crud";
import { type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/api";
import { messageForError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import type { Service } from "@/lib/types";

// ── Local shapes for the pricing rules (not in the shared types yet) ──────────
interface Industry {
  id: string;
  name: string;
  description?: string | null;
  priceWeight: number | string;
  isActive: boolean;
}
interface Location {
  id: string;
  state: string;
  city: string;
  multiplier: number | string;
  cityFee: number | string;
  isActive: boolean;
}
interface WorkerRange {
  id: string;
  minWorkers: number;
  maxWorkers: number | null;
  basePrice: number | string;
  isActive: boolean;
}
interface CalcResult {
  workerBasePrice: number;
  locationMultiplier: number;
  industryWeight: number;
  cityFee: number;
  serviceCharges: Array<{ serviceId: string; name: string; price: number }>;
  subtotal: number;
  total: number;
  currency: string;
}
interface Setting {
  key: string;
  value: string | number;
}

const num = (v: number | string) => (typeof v === "number" ? v : Number(v));

export default function AdminCalculatorPage() {
  const client = useQueryClient();

  // Invalidate the preview whenever a rule changes so it recomputes against the new numbers.
  function onRulesChanged() {
    void client.invalidateQueries({ queryKey: ["calc-preview"] });
  }

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Pricing"
        title="Calculator & pricing"
        description="Edit the rules behind the public quote calculator — worker-range base prices, location multipliers and city fees, industry weights and quote settings. Changes apply immediately; the live preview recalculates as you edit."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <Tabs defaultValue="worker-ranges">
            <TabsList className="mb-5 flex-wrap">
              <TabsTrigger value="worker-ranges">Worker ranges</TabsTrigger>
              <TabsTrigger value="locations">Locations</TabsTrigger>
              <TabsTrigger value="industries">Industries</TabsTrigger>
              <TabsTrigger value="settings">Quote settings</TabsTrigger>
            </TabsList>

            <TabsContent value="worker-ranges">
              <RuleCrud<WorkerRange>
                title="Worker range"
                noun="worker range"
                description="The base price for a band of worker counts. The matching band's base price is the starting point of every estimate."
                endpoint="/admin/worker-ranges"
                queryKey="admin-worker-ranges"
                onChanged={onRulesChanged}
                columns={workerRangeColumns}
                fields={[
                  { name: "minWorkers", label: "Min workers", kind: "number", min: 0, step: "1" },
                  { name: "maxWorkers", label: "Max workers", kind: "number", min: 1, step: "1", nullable: true, help: "Blank = no upper limit." },
                  { name: "basePrice", label: "Base price (MXN)", kind: "number", min: 0, step: "0.01" },
                ]}
                toForm={(r) => ({
                  minWorkers: String(r.minWorkers),
                  maxWorkers: r.maxWorkers == null ? "" : String(r.maxWorkers),
                  basePrice: String(num(r.basePrice)),
                })}
                toBody={(v) => ({
                  minWorkers: Number(v.minWorkers),
                  maxWorkers: v.maxWorkers.trim() === "" ? null : Number(v.maxWorkers),
                  basePrice: Number(v.basePrice),
                })}
              />
            </TabsContent>

            <TabsContent value="locations">
              <RuleCrud<Location>
                title="Location"
                noun="location"
                description="A state + city with its price multiplier and flat city fee. The multiplier scales the worker-base portion; the city fee is added at the end."
                endpoint="/admin/locations"
                queryKey="admin-locations"
                onChanged={onRulesChanged}
                columns={locationColumns}
                fields={[
                  { name: "state", label: "State", kind: "text" },
                  { name: "city", label: "City", kind: "text" },
                  { name: "multiplier", label: "Multiplier", kind: "number", min: 0.0001, step: "0.0001", help: "1 = base price." },
                  { name: "cityFee", label: "City fee (MXN)", kind: "number", min: 0, step: "0.01", help: "Flat fee added after multipliers." },
                ]}
                toForm={(r) => ({
                  state: r.state,
                  city: r.city,
                  multiplier: String(num(r.multiplier)),
                  cityFee: String(num(r.cityFee)),
                })}
                toBody={(v) => ({
                  state: v.state,
                  city: v.city,
                  multiplier: Number(v.multiplier),
                  cityFee: Number(v.cityFee),
                })}
              />
            </TabsContent>

            <TabsContent value="industries">
              <RuleCrud<Industry>
                title="Industry"
                noun="industry"
                description="Industries carry a price weight that scales the worker-base portion of the estimate. 1 means no change."
                endpoint="/admin/industries"
                queryKey="admin-industries"
                onChanged={onRulesChanged}
                columns={industryColumns}
                fields={[
                  { name: "name", label: "Name", kind: "text" },
                  { name: "priceWeight", label: "Price weight", kind: "number", min: 0.0001, step: "0.0001", help: "1 = no change." },
                  { name: "description", label: "Description", kind: "text", required: false },
                ]}
                toForm={(r) => ({
                  name: r.name,
                  priceWeight: String(num(r.priceWeight)),
                  description: r.description ?? "",
                })}
                toBody={(v) => ({
                  name: v.name,
                  priceWeight: Number(v.priceWeight),
                  description: v.description.trim() === "" ? null : v.description,
                })}
              />
            </TabsContent>

            <TabsContent value="settings">
              <QuoteSettings />
            </TabsContent>
          </Tabs>
        </div>

        <EstimatePreview />
      </div>
    </div>
  );
}

// ── Rule table columns ────────────────────────────────────────────────────────
const statusCell = <T extends { isActive: boolean }>(row: T) => (
  <Badge variant={row.isActive ? "secondary" : "outline"}>{row.isActive ? "Active" : "Inactive"}</Badge>
);

const workerRangeColumns: Column<WorkerRange>[] = [
  {
    id: "range",
    header: "Workers",
    cell: (r) => <span className="font-medium">{r.minWorkers}–{r.maxWorkers ?? "∞"}</span>,
  },
  { id: "basePrice", header: "Base price", align: "right", cell: (r) => formatMoney(num(r.basePrice)) },
  { id: "status", header: "Status", cell: statusCell },
];

const locationColumns: Column<Location>[] = [
  {
    id: "location",
    header: "Location",
    cell: (r) => (
      <>
        <p className="font-medium">{r.city}</p>
        <p className="text-xs text-muted-foreground">{r.state}</p>
      </>
    ),
  },
  { id: "multiplier", header: "Multiplier", align: "right", cell: (r) => `×${num(r.multiplier)}` },
  { id: "cityFee", header: "City fee", align: "right", cell: (r) => formatMoney(num(r.cityFee)) },
  { id: "status", header: "Status", cell: statusCell },
];

const industryColumns: Column<Industry>[] = [
  { id: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
  { id: "weight", header: "Price weight", align: "right", cell: (r) => `×${num(r.priceWeight)}` },
  { id: "status", header: "Status", cell: statusCell },
];

// ── Quote settings ────────────────────────────────────────────────────────────
function QuoteSettings() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiRequest<Setting[]>("/admin/settings"),
  });

  const current = useMemo(() => {
    const map = new Map((settings.data ?? []).map((s) => [s.key, String(s.value)]));
    return {
      quote_validity_days: map.get("quote_validity_days") ?? "30",
      payment_terms_days: map.get("payment_terms_days") ?? "15",
      currency: map.get("currency") ?? "MXN",
    };
  }, [settings.data]);

  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const values = draft ?? current;

  const save = useMutation({
    mutationFn: async (next: Record<string, string>) => {
      const payloads: Array<{ key: string; value: string | number }> = [
        { key: "quote_validity_days", value: Number(next.quote_validity_days) },
        { key: "payment_terms_days", value: Number(next.payment_terms_days) },
        { key: "currency", value: next.currency.toUpperCase() },
      ];
      for (const p of payloads) {
        await apiRequest(`/admin/settings/${p.key}`, { method: "PUT", body: JSON.stringify(p) });
      }
    },
    onSuccess: () => {
      toast.success("Quote settings saved.");
      setDraft(null);
      void client.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error: unknown) => toast.error(messageForError(error, "Could not save settings.")),
  });

  const set = (key: string, value: string) => setDraft({ ...values, [key]: value });

  return (
    <div className="max-w-md rounded-lg border border-border bg-card p-6">
      <p className="mb-5 text-sm text-muted-foreground">
        Defaults applied to new quotations. Validity drives the quote expiry date.
      </p>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="quote-validity">Quote validity (days)</Label>
          <Input
            id="quote-validity"
            type="number"
            min={1}
            max={365}
            value={values.quote_validity_days}
            onChange={(e) => set("quote_validity_days", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payment-terms">Payment terms (days)</Label>
          <Input
            id="payment-terms"
            type="number"
            min={1}
            max={365}
            value={values.payment_terms_days}
            onChange={(e) => set("payment_terms_days", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="currency">Currency (ISO-4217)</Label>
          <Input
            id="currency"
            maxLength={3}
            value={values.currency}
            onChange={(e) => set("currency", e.target.value.toUpperCase())}
          />
          <span className="text-xs text-muted-foreground">Client is Mexican — keep MXN unless told otherwise.</span>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={() => save.mutate(values)} disabled={save.isPending || !draft}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
          {draft && (
            <Button variant="outline" onClick={() => setDraft(null)} disabled={save.isPending}>
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Live estimate preview ─────────────────────────────────────────────────────
function EstimatePreview() {
  const industries = useQuery({ queryKey: ["admin-industries"], queryFn: () => apiRequest<Industry[]>("/admin/industries") });
  const locations = useQuery({ queryKey: ["admin-locations"], queryFn: () => apiRequest<Location[]>("/admin/locations") });
  const services = useQuery({ queryKey: ["admin-services"], queryFn: () => apiRequest<Service[]>("/admin/services") });

  const activeIndustries = (industries.data ?? []).filter((i) => i.isActive);
  const activeLocations = (locations.data ?? []).filter((l) => l.isActive);
  const activeServices = (services.data ?? []).filter((s) => s.isActive);

  const [industryId, setIndustryId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [workerCount, setWorkerCount] = useState<string>("10");
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  const ready = Boolean(industryId && locationId && Number(workerCount) > 0);

  const preview = useQuery({
    queryKey: ["calc-preview", industryId, locationId, workerCount, serviceIds.join(",")],
    enabled: ready,
    queryFn: () =>
      apiRequest<CalcResult>("/public/quotations/calculate", {
        method: "POST",
        body: JSON.stringify({
          industryId,
          locationId,
          workerCount: Number(workerCount),
          serviceIds,
        }),
      }),
    retry: false,
  });

  const toggleService = (id: string) =>
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <aside className="lg:sticky lg:top-6 h-fit rounded-lg border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live estimate</h2>
      <p className="mt-1 text-sm text-muted-foreground">Recomputes against the current rules as you edit them.</p>

      <div className="mt-5 grid gap-4">
        <div className="grid gap-1.5">
          <Label>Industry</Label>
          <Select value={industryId || undefined} onValueChange={setIndustryId}>
            <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
            <SelectContent>
              {activeIndustries.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Location</Label>
          <Select value={locationId || undefined} onValueChange={setLocationId}>
            <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
            <SelectContent>
              {activeLocations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.city}, {l.state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="preview-workers">Worker count</Label>
          <Input id="preview-workers" type="number" min={1} value={workerCount} onChange={(e) => setWorkerCount(e.target.value)} />
        </div>
        {activeServices.length > 0 && (
          <div className="grid gap-2">
            <Label>Services</Label>
            <div className="max-h-40 space-y-2 overflow-auto rounded-md border border-border p-3">
              {activeServices.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={serviceIds.includes(s.id)} onCheckedChange={() => toggleService(s.id)} />
                  <span>{s.nameEn ?? s.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatMoney(s.basePrice)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-5">
        {!ready ? (
          <p className="text-sm text-muted-foreground">Pick an industry and location to see the estimate.</p>
        ) : preview.isPending ? (
          <p className="text-sm text-muted-foreground">Calculating…</p>
        ) : preview.isError ? (
          <p className="text-sm text-destructive">{messageForError(preview.error, "No worker range covers that count.")}</p>
        ) : preview.data ? (
          <dl className="space-y-2 text-sm">
            <Row label={`Worker base × ${preview.data.locationMultiplier} × ${preview.data.industryWeight}`} value={formatMoney(preview.data.workerBasePrice * preview.data.locationMultiplier * preview.data.industryWeight)} />
            {preview.data.serviceCharges.map((c) => (
              <Row key={c.serviceId} label={c.name} value={formatMoney(c.price)} muted />
            ))}
            <Row label="City fee" value={formatMoney(preview.data.cityFee)} muted />
            <div className="my-2 border-t border-border" />
            <Row label="Subtotal" value={formatMoney(preview.data.subtotal)} />
            <div className="flex items-center justify-between pt-2">
              <dt className="text-base font-semibold">Total</dt>
              <dd className="text-xl font-semibold text-primary">{formatMoney(preview.data.total)}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </aside>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={muted ? "text-muted-foreground" : ""}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
