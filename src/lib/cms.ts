import { apiRequest } from "./api";
import { uploadWithProgress } from "./upload";

// ── Types (mirror the backend serializers in modules/cms) ────────────────────────

export type HeroTransition = "fade" | "slide" | "zoom";

export interface HeroSlide {
  id: string;
  imageUrl: string;
  imageKey: string;
  altEn: string | null;
  altEs: string | null;
  headlineEn: string | null;
  headlineEs: string | null;
  subheadlineEn: string | null;
  subheadlineEs: string | null;
  ctaLabelEn: string | null;
  ctaLabelEs: string | null;
  ctaUrl: string | null;
  position: number;
  isActive: boolean;
  durationMs: number | null;
  transition: HeroTransition;
  overlayOpacity: number;
  focalX: number;
  focalY: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HeroSlidePatch {
  altEn?: string | null;
  altEs?: string | null;
  headlineEn?: string | null;
  headlineEs?: string | null;
  subheadlineEn?: string | null;
  subheadlineEs?: string | null;
  ctaLabelEn?: string | null;
  ctaLabelEs?: string | null;
  ctaUrl?: string | null;
  isActive?: boolean;
  durationMs?: number | null;
  transition?: HeroTransition;
  overlayOpacity?: number;
  focalX?: number;
  focalY?: number;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CmsSettings {
  heroAutoplay: boolean;
  heroDefaultDurationMs: number;
  heroTransitionMs: number;
  heroPauseOnHover: boolean;
  heroLoop: boolean;
  headingFont: string;
  bodyFont: string;
  baseTextScale: number;
}

export const HEADING_FONTS = ["Roboto Condensed", "Oswald", "Archivo", "Hanken Grotesk", "Inter Tight"];
export const BODY_FONTS = ["Inter", "Source Sans 3", "Roboto", "Public Sans"];
export const TEXT_SCALES = [0.95, 1.0, 1.05, 1.1];
export const SIZE_STEPS = ["sm", "md", "lg", "xl"] as const;

export interface ContentStyle {
  fontFamily: string | null;
  fontWeight: number | null;
  sizeStep: string | null;
}

export interface ContentEntry {
  key: string;
  label: string;
  group: string;
  type: "text" | "multiline";
  maxLength: number;
  en: string;
  es: string;
  status: "draft" | "published";
  version: number;
  style: ContentStyle;
  updatedAt: string | null;
}

export interface ContentHistoryEntry {
  id: string;
  locale: string;
  value: string;
  version: number;
  publishedAt: string;
  publishedBy: string | null;
}

// ── Hero API ─────────────────────────────────────────────────────────────────

export function listHeroSlides() {
  return apiRequest<HeroSlide[]>("/admin/cms/hero-slides");
}

/** Creates a slide from an image upload (defaults applied); edit the rest with a PATCH after. */
export function createHeroSlide(
  file: File,
  token: string | null,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
) {
  return uploadWithProgress<HeroSlide>({
    path: "/admin/cms/hero-slides",
    file,
    field: "image",
    token,
    onProgress,
    signal,
  });
}

export function updateHeroSlide(id: string, patch: HeroSlidePatch) {
  return apiRequest<HeroSlide>(`/admin/cms/hero-slides/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function toggleHeroSlide(id: string, isActive: boolean) {
  return apiRequest<HeroSlide>(`/admin/cms/hero-slides/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function deleteHeroSlide(id: string) {
  return apiRequest<{ id: string; deleted: boolean }>(`/admin/cms/hero-slides/${id}`, { method: "DELETE" });
}

export function reorderHeroSlides(ids: string[]) {
  return apiRequest<HeroSlide[]>("/admin/cms/hero-slides/reorder", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

// ── Settings API ───────────────────────────────────────────────────────────────

export function getCmsSettings() {
  return apiRequest<CmsSettings>("/admin/cms/settings");
}

export function putCmsSettings(patch: Partial<CmsSettings>) {
  return apiRequest<CmsSettings>("/admin/cms/settings", { method: "PUT", body: JSON.stringify(patch) });
}

// ── Content API ────────────────────────────────────────────────────────────────

export function listContent() {
  return apiRequest<ContentEntry[]>("/admin/cms/content");
}

export function putContent(
  key: string,
  body: { en: string; es: string; style?: Partial<ContentStyle>; publish?: boolean },
) {
  return apiRequest<ContentEntry>(`/admin/cms/content/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function publishContent(key: string, publish: boolean) {
  return apiRequest<ContentEntry>(`/admin/cms/content/${encodeURIComponent(key)}/publish`, {
    method: "POST",
    body: JSON.stringify({ publish }),
  });
}

export function contentHistory(key: string) {
  return apiRequest<ContentHistoryEntry[]>(`/admin/cms/content/${encodeURIComponent(key)}/history`);
}
