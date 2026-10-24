"use client";

import { UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { messageForError } from "@/lib/errors";
import { uploadWithProgress } from "@/lib/upload";

export interface UploadPanelProps {
  title: string;
  description: string;
  token: string | null;
  onDone: () => void;
  /** Single-POST multipart upload to this API path (the common case). */
  path?: string;
  /** Multipart field name; defaults to `file`. */
  field?: string;
  /**
   * A custom upload routine, used when the upload is more than one request — e.g. the
   * phase-result flow (intent → bytes → confirm). Given the file plus progress/abort
   * wiring, it resolves on success and rejects (optionally with an `AbortError`) otherwise.
   * Takes precedence over `path`.
   */
  upload?: (file: File, opts: { onProgress: (percent: number) => void; signal: AbortSignal }) => Promise<void>;
}

/**
 * Drag-drop upload with a real progress bar, cancel and retry. Extracted so the document
 * drawer, the document page and the phase-result uploader all share one implementation
 * (the repo rule: build the upload UI once, never copy-paste it).
 */
export function UploadPanel({ title, description, token, onDone, path, field, upload }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function start(selected: File) {
    setFile(selected);
    setError(null);
    setProgress(0);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      if (upload) {
        await upload(selected, { onProgress: setProgress, signal: controller.signal });
      } else if (path) {
        await uploadWithProgress({ path, file: selected, field, token, onProgress: setProgress, signal: controller.signal });
      }
      toast.success(`${title} uploaded.`);
      setProgress(null);
      setFile(null);
      onDone();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setProgress(null);
        return;
      }
      setError(messageForError(err, "The upload failed."));
      setProgress(null);
    }
  }

  const uploading = progress !== null;

  return (
    <div
      className={`grid gap-2 border border-dashed p-3 ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const dropped = event.dataTransfer.files?.[0];
        if (dropped) void start(dropped);
      }}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) void start(chosen);
          event.target.value = "";
        }}
      />

      {!uploading && (
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => inputRef.current?.click()}>
          <UploadCloud size={15} /> Choose or drop a file
        </Button>
      )}

      {uploading && (
        <div className="grid gap-1">
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">
              {file?.name} · {progress}%
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              aria-label="Cancel upload"
              onClick={() => controllerRef.current?.abort()}
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="grid gap-1">
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
          {file && (
            <Button type="button" size="sm" variant="outline" onClick={() => void start(file)}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
