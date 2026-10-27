"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UploadPanel } from "@/components/upload-panel";
import { HeroPreview, toPreviewSlide } from "@/components/hero-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api";
import { resolveImageUrl } from "@/lib/media";
import { useAuth } from "@/lib/auth-context";
import {
  BODY_FONTS,
  HEADING_FONTS,
  TEXT_SCALES,
  type CmsSettings,
  type HeroSlide,
  type HeroSlidePatch,
  type HeroTransition,
  createHeroSlide,
  deleteHeroSlide,
  getCmsSettings,
  listHeroSlides,
  putCmsSettings,
  reorderHeroSlides,
  toggleHeroSlide,
  updateHeroSlide,
} from "@/lib/cms";

const TRANSITIONS: HeroTransition[] = ["fade", "slide", "zoom"];

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminHomepagePage() {
  const client = useQueryClient();
  const { session } = useAuth();
  const token = session?.accessToken ?? null;

  const slidesQuery = useQuery({ queryKey: ["cms-hero"], queryFn: listHeroSlides });
  const settingsQuery = useQuery({ queryKey: ["cms-settings"], queryFn: getCmsSettings });

  const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");
  const [previewLocale, setPreviewLocale] = useState<"en" | "es">("es");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ["cms-hero"] });
  };

  const slides = slidesQuery.data ?? [];
  const settings = settingsQuery.data;
  const editingSlide = slides.find((s) => s.id === editingId) ?? null;

  // Open the edit dialog automatically for a freshly uploaded slide.
  useEffect(() => {
    if (justCreatedId && slides.some((s) => s.id === justCreatedId)) {
      setEditingId(justCreatedId);
      setJustCreatedId(null);
    }
  }, [justCreatedId, slides]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleHeroSlide(id, isActive),
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(e, "Could not update the slide.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHeroSlide(id),
    onSuccess: () => {
      toast.success("Slide deleted.");
      setDeletingId(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Could not delete the slide.")),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorderHeroSlides(ids),
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(e, "Could not reorder slides.")),
  });

  function move(index: number, direction: -1 | 1) {
    const next = [...slides];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorderMutation.mutate(next.map((s) => s.id));
  }

  const previewSlides = useMemo(
    () => slides.filter((s) => s.isActive).map((s) => toPreviewSlide(s, previewLocale)),
    [slides, previewLocale],
  );

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Homepage"
        title="Hero carousel"
        description="Manage the rotating images and text at the top of the public homepage. Changes publish immediately."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        {/* ── Left: slides + settings ─────────────────────────────────────────── */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Add a slide</CardTitle>
              <CardDescription>JPG, PNG or WebP, up to 8 MB. You can edit its text and timing right after.</CardDescription>
            </CardHeader>
            <CardContent>
              <UploadPanel
                title="Hero image"
                description="Drop an image or choose a file"
                token={token}
                upload={async (file, { onProgress, signal }) => {
                  const slide = await createHeroSlide(file, token, onProgress, signal);
                  setJustCreatedId(slide.id);
                }}
                onDone={invalidate}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slides {slides.length > 0 && <span className="text-muted-foreground">({slides.length})</span>}</CardTitle>
              <CardDescription>Drag order via the arrows. Toggle a slide off to hide it without deleting.</CardDescription>
            </CardHeader>
            <CardContent>
              {slidesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : slidesQuery.isError ? (
                <div className="grid gap-2">
                  <p className="text-sm text-destructive">{errorMessage(slidesQuery.error, "Could not load slides.")}</p>
                  <Button variant="outline" size="sm" onClick={() => slidesQuery.refetch()}>Retry</Button>
                </div>
              ) : slides.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slides yet. Add one above.</p>
              ) : (
                <ul className="grid gap-3">
                  {slides.map((slide, index) => (
                    <li key={slide.id} className="flex items-center gap-3 border border-border p-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveImageUrl(slide.imageUrl) ?? ""}
                        alt={slide.altEs ?? slide.altEn ?? ""}
                        className="h-14 w-24 shrink-0 rounded object-cover"
                        style={{ objectPosition: `${slide.focalX}% ${slide.focalY}%` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {slide.headlineEs || slide.headlineEn || <span className="text-muted-foreground">Untitled slide</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {slide.transition} · {(slide.durationMs ?? settings?.heroDefaultDurationMs ?? 6000) / 1000}s
                          {slide.startsAt || slide.endsAt ? " · scheduled" : ""}
                        </p>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs">
                        <Checkbox
                          checked={slide.isActive}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: slide.id, isActive: v === true })}
                        />
                        Active
                      </label>
                      <div className="flex items-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                          <ArrowUp size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Move down" disabled={index === slides.length - 1} onClick={() => move(index, 1)}>
                          <ArrowDown size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit slide" onClick={() => setEditingId(slide.id)}>
                          <Pencil size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete slide" onClick={() => setDeletingId(slide.id)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {settings && <SettingsCard settings={settings} onSaved={() => client.invalidateQueries({ queryKey: ["cms-settings"] })} />}
        </div>

        {/* ── Right: live preview ─────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>Exactly how the carousel will behave, with the current timing and fonts.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex overflow-hidden rounded border border-border text-xs">
                  <button type="button" onClick={() => setPreviewWidth("desktop")} className={`px-3 py-1.5 ${previewWidth === "desktop" ? "bg-primary text-primary-foreground" : "bg-background"}`}>Desktop</button>
                  <button type="button" onClick={() => setPreviewWidth("mobile")} className={`px-3 py-1.5 ${previewWidth === "mobile" ? "bg-primary text-primary-foreground" : "bg-background"}`}>Mobile</button>
                </div>
                <div className="flex overflow-hidden rounded border border-border text-xs">
                  <button type="button" onClick={() => setPreviewLocale("es")} className={`px-3 py-1.5 ${previewLocale === "es" ? "bg-primary text-primary-foreground" : "bg-background"}`}>ES</button>
                  <button type="button" onClick={() => setPreviewLocale("en")} className={`px-3 py-1.5 ${previewLocale === "en" ? "bg-primary text-primary-foreground" : "bg-background"}`}>EN</button>
                </div>
              </div>
              {settings && <HeroPreview slides={previewSlides} settings={settings} width={previewWidth} />}
            </CardContent>
          </Card>
        </div>
      </div>

      {editingSlide && (
        <SlideDialog
          key={editingSlide.id}
          slide={editingSlide}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            invalidate();
          }}
        />
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete this slide?"
        description="The image and its text are removed from the homepage. This cannot be undone."
        confirmLabel="Delete slide"
        variant="destructive"
        isPending={deleteMutation.isPending}
        error={deleteMutation.error}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
      />
    </div>
  );
}

// ── Global timing settings ───────────────────────────────────────────────────

function SettingsCard({ settings, onSaved }: { settings: CmsSettings; onSaved: () => void }) {
  const [form, setForm] = useState<CmsSettings>(settings);
  useEffect(() => setForm(settings), [settings]);

  const save = useMutation({
    mutationFn: () => putCmsSettings(form),
    onSuccess: () => {
      toast.success("Carousel settings saved.");
      onSaved();
    },
    onError: (e) => toast.error(errorMessage(e, "Could not save settings.")),
  });

  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const set = <K extends keyof CmsSettings>(key: K, value: CmsSettings[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carousel behaviour</CardTitle>
        <CardDescription>Timing and typography applied across every slide.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <Checkbox checked={form.heroAutoplay} onCheckedChange={(v) => set("heroAutoplay", v === true)} />
          Autoplay (advance slides automatically)
        </label>
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <Checkbox checked={form.heroPauseOnHover} onCheckedChange={(v) => set("heroPauseOnHover", v === true)} />
          Pause on hover / focus
        </label>
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <Checkbox checked={form.heroLoop} onCheckedChange={(v) => set("heroLoop", v === true)} />
          Loop back to the first slide
        </label>

        <div className="grid gap-1.5">
          <Label>Default slide duration: {(form.heroDefaultDurationMs / 1000).toFixed(1)}s</Label>
          <input type="range" min={2000} max={15000} step={500} value={form.heroDefaultDurationMs} onChange={(e) => set("heroDefaultDurationMs", Number(e.target.value))} className="accent-primary" />
        </div>
        <div className="grid gap-1.5">
          <Label>Transition duration: {form.heroTransitionMs}ms</Label>
          <input type="range" min={200} max={2000} step={50} value={form.heroTransitionMs} onChange={(e) => set("heroTransitionMs", Number(e.target.value))} className="accent-primary" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Heading font</Label>
            <Select value={form.headingFont} onValueChange={(v) => set("headingFont", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{HEADING_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Body font</Label>
            <Select value={form.bodyFont} onValueChange={(v) => set("bodyFont", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BODY_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Base text scale</Label>
            <Select value={String(form.baseTextScale)} onValueChange={(v) => set("baseTextScale", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TEXT_SCALES.map((s) => <SelectItem key={s} value={String(s)}>{s.toFixed(2)}×</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Slide edit dialog ──────────────────────────────────────────────────────────

function SlideDialog({ slide, onClose, onSaved }: { slide: HeroSlide; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<HeroSlide>(slide);
  const set = <K extends keyof HeroSlide>(key: K, value: HeroSlide[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const patch: HeroSlidePatch = {
        altEn: form.altEn, altEs: form.altEs,
        headlineEn: form.headlineEn, headlineEs: form.headlineEs,
        subheadlineEn: form.subheadlineEn, subheadlineEs: form.subheadlineEs,
        ctaLabelEn: form.ctaLabelEn, ctaLabelEs: form.ctaLabelEs,
        ctaUrl: form.ctaUrl?.trim() ? form.ctaUrl.trim() : null,
        durationMs: form.durationMs, transition: form.transition,
        overlayOpacity: form.overlayOpacity, focalX: form.focalX, focalY: form.focalY,
        startsAt: form.startsAt, endsAt: form.endsAt,
      };
      return updateHeroSlide(slide.id, patch);
    },
    onSuccess: () => {
      toast.success("Slide saved.");
      onSaved();
    },
    onError: (e) => toast.error(errorMessage(e, "Could not save the slide.")),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit slide</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5">
          <Tabs defaultValue="es">
            <TabsList>
              <TabsTrigger value="es">Spanish</TabsTrigger>
              <TabsTrigger value="en">English</TabsTrigger>
            </TabsList>
            {(["es", "en"] as const).map((loc) => {
              const suffix = loc === "es" ? "Es" : "En";
              return (
                <TabsContent key={loc} value={loc} className="grid gap-3">
                  <Field label="Headline">
                    <Input value={form[`headline${suffix}` as keyof HeroSlide] as string ?? ""} maxLength={200}
                      onChange={(e) => set(`headline${suffix}` as keyof HeroSlide, e.target.value as never)} />
                  </Field>
                  <Field label="Subheadline">
                    <Textarea rows={2} value={form[`subheadline${suffix}` as keyof HeroSlide] as string ?? ""} maxLength={400}
                      onChange={(e) => set(`subheadline${suffix}` as keyof HeroSlide, e.target.value as never)} />
                  </Field>
                  <Field label="Button label">
                    <Input value={form[`ctaLabel${suffix}` as keyof HeroSlide] as string ?? ""} maxLength={80}
                      onChange={(e) => set(`ctaLabel${suffix}` as keyof HeroSlide, e.target.value as never)} />
                  </Field>
                  <Field label="Alt text (for screen readers)">
                    <Input value={form[`alt${suffix}` as keyof HeroSlide] as string ?? ""} maxLength={255}
                      onChange={(e) => set(`alt${suffix}` as keyof HeroSlide, e.target.value as never)} />
                  </Field>
                </TabsContent>
              );
            })}
          </Tabs>

          <Field label="Button link (CTA URL)">
            <Input placeholder="/services or https://…" value={form.ctaUrl ?? ""} onChange={(e) => set("ctaUrl", e.target.value)} />
            <span className="text-xs text-muted-foreground">A site path like <code>/services</code> or a full <code>https://</code> URL.</span>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Transition">
              <Select value={form.transition} onValueChange={(v) => set("transition", v as HeroTransition)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRANSITIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label={`Duration: ${form.durationMs ? (form.durationMs / 1000).toFixed(1) + "s" : "default"}`}>
              <input type="range" min={2000} max={15000} step={500} value={form.durationMs ?? 6000} onChange={(e) => set("durationMs", Number(e.target.value))} className="accent-primary" />
              <button type="button" className="w-fit text-xs text-primary underline" onClick={() => set("durationMs", null)}>Use global default</button>
            </Field>
          </div>

          <Field label={`Overlay darkness: ${Math.round(form.overlayOpacity * 100)}%`}>
            <input type="range" min={0} max={0.8} step={0.05} value={form.overlayOpacity} onChange={(e) => set("overlayOpacity", Number(e.target.value))} className="accent-primary" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Focal point X: ${form.focalX}%`}>
              <input type="range" min={0} max={100} value={form.focalX} onChange={(e) => set("focalX", Number(e.target.value))} className="accent-primary" />
            </Field>
            <Field label={`Focal point Y: ${form.focalY}%`}>
              <input type="range" min={0} max={100} value={form.focalY} onChange={(e) => set("focalY", Number(e.target.value))} className="accent-primary" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Show from (optional)">
              <Input type="datetime-local" value={toDatetimeLocal(form.startsAt)}
                onChange={(e) => set("startsAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </Field>
            <Field label="Show until (optional)">
              <Input type="datetime-local" value={toDatetimeLocal(form.endsAt)}
                onChange={(e) => set("endsAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save slide"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
