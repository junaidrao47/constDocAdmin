"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api";
import {
  BODY_FONTS,
  HEADING_FONTS,
  SIZE_STEPS,
  type ContentEntry,
  type ContentHistoryEntry,
  contentHistory,
  listContent,
  putContent,
} from "@/lib/cms";

const FONT_OPTIONS = ["(default)", ...HEADING_FONTS, ...BODY_FONTS];
const WEIGHTS = [400, 500, 600, 700];
const SIZE_REM: Record<string, string> = { sm: "0.9rem", md: "1rem", lg: "1.25rem", xl: "1.6rem" };

export default function AdminContentPage() {
  const query = useQuery({ queryKey: ["cms-content"], queryFn: listContent });
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, ContentEntry[]>();
    for (const entry of query.data ?? []) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return [...map.entries()];
  }, [query.data]);

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Homepage"
        title="Site content"
        description="Edit the headlines and text shown across the public website, in both languages. Both languages are required before a text can be published."
      />

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <div className="grid gap-2">
          <p className="text-sm text-destructive">{errorMessage(query.error, "Could not load content.")}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="grid gap-8">
          {groups.map(([group, entries]) => (
            <section key={group} className="grid gap-4">
              <h2 className="text-lg font-semibold">{group}</h2>
              {entries.map((entry) => (
                <ContentCard key={entry.key} entry={entry} onHistory={() => setHistoryKey(entry.key)} />
              ))}
            </section>
          ))}
        </div>
      )}

      {historyKey && <HistoryDialog contentKey={historyKey} onClose={() => setHistoryKey(null)} />}
    </div>
  );
}

function ContentCard({ entry, onHistory }: { entry: ContentEntry; onHistory: () => void }) {
  const client = useQueryClient();
  const [en, setEn] = useState(entry.en);
  const [es, setEs] = useState(entry.es);
  const [fontFamily, setFontFamily] = useState(entry.style.fontFamily ?? "(default)");
  const [fontWeight, setFontWeight] = useState<number | null>(entry.style.fontWeight ?? null);
  const [sizeStep, setSizeStep] = useState<string | null>(entry.style.sizeStep ?? null);

  useEffect(() => {
    setEn(entry.en);
    setEs(entry.es);
    setFontFamily(entry.style.fontFamily ?? "(default)");
    setFontWeight(entry.style.fontWeight ?? null);
    setSizeStep(entry.style.sizeStep ?? null);
  }, [entry]);

  const style = {
    fontFamily: fontFamily === "(default)" ? null : fontFamily,
    fontWeight,
    sizeStep,
  };

  const save = useMutation({
    mutationFn: (publish: boolean) => putContent(entry.key, { en, es, style, publish }),
    onSuccess: (_data, publish) => {
      toast.success(publish ? "Published." : "Draft saved.");
      void client.invalidateQueries({ queryKey: ["cms-content"] });
    },
    onError: (e) => toast.error(errorMessage(e, "Could not save.")),
  });

  const dirty =
    en !== entry.en ||
    es !== entry.es ||
    (style.fontFamily ?? null) !== (entry.style.fontFamily ?? null) ||
    (style.fontWeight ?? null) !== (entry.style.fontWeight ?? null) ||
    (style.sizeStep ?? null) !== (entry.style.sizeStep ?? null);
  const canPublish = en.trim().length > 0 && es.trim().length > 0;
  const multiline = entry.type === "multiline";
  const previewFont = fontFamily === "(default)" ? undefined : `'${fontFamily}', sans-serif`;
  const previewSize = sizeStep ? SIZE_REM[sizeStep] : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{entry.label}</CardTitle>
            <CardDescription className="font-mono text-xs">{entry.key}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={entry.status === "published" ? "default" : "secondary"}>{entry.status}</Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="History" onClick={onHistory}>
              <History size={15} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <LocaleField label="Spanish" value={es} onChange={setEs} max={entry.maxLength} multiline={multiline} />
          <LocaleField label="English" value={en} onChange={setEn} max={entry.maxLength} multiline={multiline} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Font</Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{FONT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Weight</Label>
            <Select value={fontWeight ? String(fontWeight) : "default"} onValueChange={(v) => setFontWeight(v === "default" ? null : Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                {WEIGHTS.map((w) => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Size</Label>
            <Select value={sizeStep ?? "default"} onValueChange={(v) => setSizeStep(v === "default" ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                {SIZE_STEPS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(es || en) && (
          <div className="rounded border border-dashed border-border bg-muted/30 p-3">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Preview (Spanish)</p>
            <p className="whitespace-pre-wrap" style={{ fontFamily: previewFont, fontWeight: fontWeight ?? undefined, fontSize: previewSize }}>
              {es || en}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending || !dirty}>Save draft</Button>
          <Button onClick={() => save.mutate(true)} disabled={save.isPending || !canPublish}>Publish</Button>
          {!canPublish && <span className="text-xs text-muted-foreground">Both languages are required to publish.</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function LocaleField({
  label,
  value,
  onChange,
  max,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  multiline: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className={`text-xs ${value.length > max ? "text-destructive" : "text-muted-foreground"}`}>{value.length}/{max}</span>
      </div>
      {multiline ? (
        <Textarea rows={5} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function HistoryDialog({ contentKey, onClose }: { contentKey: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ["cms-content-history", contentKey], queryFn: () => contentHistory(contentKey) });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish history — {contentKey}</DialogTitle>
        </DialogHeader>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (query.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No published versions yet.</p>
        ) : (
          <ul className="grid gap-3">
            {(query.data as ContentHistoryEntry[]).map((h) => (
              <li key={h.id} className="border border-border p-2.5">
                <p className="text-xs text-muted-foreground">
                  v{h.version} · {h.locale.toUpperCase()} · {new Date(h.publishedAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{h.value}</p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
