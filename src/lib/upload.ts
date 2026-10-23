import { ApiError } from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export interface UploadOptions {
  /** Path after the API base, e.g. `/documents/:id/approved-upload`. */
  path: string;
  file: File;
  /** Multipart field name the route expects (the document routes use `file`). */
  field?: string;
  /** Bearer access token from the current session. */
  token: string | null;
  /** Fired with 0–100 as the bytes go up. */
  onProgress?: (percent: number) => void;
  /** Abort the in-flight upload (cancel button). */
  signal?: AbortSignal;
}

/**
 * Multipart upload with a real progress bar.
 *
 * `apiRequest` uses `fetch`, which cannot report upload progress, so document uploads go
 * through `XMLHttpRequest` here instead. It still attaches the same Bearer token and
 * parses the same `{ success:false, error:{ code, message, requestId } }` envelope into an
 * `ApiError`, so callers handle failures exactly as they do elsewhere.
 */
export function uploadWithProgress<T>({
  path,
  file,
  field = "file",
  token,
  onProgress,
  signal,
}: UploadOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Do NOT set Content-Type: the browser sets the multipart boundary itself.

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException("Upload cancelled", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("abort", () =>
      reject(new DOMException("Upload cancelled", "AbortError")),
    );
    xhr.addEventListener("error", () =>
      reject(new ApiError("The upload failed. Check your connection and try again.", 0)),
    );

    xhr.addEventListener("load", () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        const data =
          payload && typeof payload === "object" && "data" in payload
            ? (payload as { data: T }).data
            : (payload as T);
        resolve(data);
        return;
      }

      const errObj =
        payload && typeof payload === "object" && "error" in payload
          ? (payload as { error?: { code?: string; message?: string; requestId?: string } }).error
          : undefined;
      reject(
        new ApiError(errObj?.message ?? "The upload failed.", xhr.status, {
          code: errObj?.code,
          requestId: errObj?.requestId,
        }),
      );
    });

    const form = new FormData();
    form.append(field, file);
    xhr.send(form);
  });
}
