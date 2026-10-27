"use client";

import { useEffect, useRef, useState } from "react";
import type { CmsSettings, HeroSlide, HeroTransition } from "@/lib/cms";
import { resolveImageUrl } from "@/lib/media";

export interface PreviewSlide {
  imageUrl: string;
  headline: string | null;
  subheadline: string | null;
  ctaLabel: string | null;
  durationMs: number | null;
  transition: HeroTransition;
  overlayOpacity: number;
  focalX: number;
  focalY: number;
}

/** Maps an admin HeroSlide to the preview shape for a given locale (same fallback as the API). */
export function toPreviewSlide(slide: HeroSlide, locale: "en" | "es"): PreviewSlide {
  const pick = (en: string | null, es: string | null) => (locale === "en" ? en ?? es : es ?? en);
  return {
    imageUrl: resolveImageUrl(slide.imageUrl) ?? "",
    headline: pick(slide.headlineEn, slide.headlineEs),
    subheadline: pick(slide.subheadlineEn, slide.subheadlineEs),
    ctaLabel: pick(slide.ctaLabelEn, slide.ctaLabelEs),
    durationMs: slide.durationMs,
    transition: slide.transition,
    overlayOpacity: slide.overlayOpacity,
    focalX: slide.focalX,
    focalY: slide.focalY,
  };
}

function enterClass(transition: HeroTransition): string {
  if (transition === "zoom") return "scale-105";
  if (transition === "slide") return "translate-x-4";
  return "opacity-0";
}

/**
 * A faithful-enough live preview of the public hero carousel: it cycles the given slides
 * using the real per-slide duration (or the global default), the configured transition
 * style and overlay, and the chosen heading/body fonts and text scale. It renders from the
 * CURRENT unsaved values so the admin sees exactly what publishing will produce.
 */
export function HeroPreview({
  slides,
  settings,
  width,
}: {
  slides: PreviewSlide[];
  settings: CmsSettings;
  width: "desktop" | "mobile";
}) {
  const [index, setIndex] = useState(0);
  const [entering, setEntering] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (index > slides.length - 1) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (slides.length <= 1 || !settings.heroAutoplay) return;
    const current = slides[index];
    const duration = current?.durationMs ?? settings.heroDefaultDurationMs;
    timer.current = setTimeout(() => {
      setIndex((i) => (settings.heroLoop ? (i + 1) % slides.length : Math.min(i + 1, slides.length - 1)));
    }, duration);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [index, slides, settings.heroAutoplay, settings.heroDefaultDurationMs, settings.heroLoop]);

  // Trigger the enter animation each time the active slide changes.
  useEffect(() => {
    setEntering(true);
    const raf = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(raf);
  }, [index]);

  if (slides.length === 0) {
    return (
      <div
        className="grid place-items-center rounded-md border border-dashed border-border bg-muted/40 text-sm text-muted-foreground"
        style={{ aspectRatio: width === "mobile" ? "9 / 16" : "16 / 9" }}
      >
        No slides yet — add one to see the preview.
      </div>
    );
  }

  const slide = slides[index];
  const transitionMs = settings.heroTransitionMs;

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-md border border-border bg-black"
      style={{
        aspectRatio: width === "mobile" ? "9 / 16" : "16 / 9",
        maxWidth: width === "mobile" ? 280 : "100%",
        fontSize: `${settings.baseTextScale}rem`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={slide.imageUrl + index}
        src={slide.imageUrl}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-all ease-out ${entering ? enterClass(slide.transition) : "translate-x-0 scale-100 opacity-100"}`}
        style={{ objectPosition: `${slide.focalX}% ${slide.focalY}%`, transitionDuration: `${transitionMs}ms` }}
      />
      <div className="absolute inset-0 bg-black" style={{ opacity: slide.overlayOpacity }} />
      <div className="absolute inset-0 flex flex-col justify-end gap-2 p-4 text-white sm:p-6">
        {slide.headline && (
          <p
            className="font-semibold leading-tight"
            style={{ fontFamily: `'${settings.headingFont}', sans-serif`, fontSize: width === "mobile" ? "1.1rem" : "1.6rem" }}
          >
            {slide.headline}
          </p>
        )}
        {slide.subheadline && (
          <p
            className="max-w-md text-white/85"
            style={{ fontFamily: `'${settings.bodyFont}', sans-serif`, fontSize: width === "mobile" ? "0.7rem" : "0.85rem" }}
          >
            {slide.subheadline}
          </p>
        )}
        {slide.ctaLabel && (
          <span
            className="mt-1 inline-flex w-fit rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            style={{ fontFamily: `'${settings.bodyFont}', sans-serif` }}
          >
            {slide.ctaLabel}
          </span>
        )}
      </div>
      {/* dots */}
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
