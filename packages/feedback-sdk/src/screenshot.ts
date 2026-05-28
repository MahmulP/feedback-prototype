/**
 * Optional screenshot capture for new pins.
 *
 * `html2canvas` is **dynamically imported** so prototypes that never create
 * a pin don't pay for it. Capture is best-effort: any failure logs and
 * resolves to null rather than blocking pin creation.
 */

const HOST_ATTR = "data-mahmulp-feedback-host";

export interface CaptureOptions {
  /** Output mime type. Defaults to image/png. */
  mimeType?: "image/png" | "image/jpeg" | "image/webp";
  /** Quality (0..1) used for jpeg/webp. Ignored for png. */
  quality?: number;
  /** Viewport scale. Defaults to 1 to keep file sizes small. */
  scale?: number;
}

const DEFAULT_OPTIONS: Required<CaptureOptions> = {
  mimeType: "image/png",
  quality: 0.92,
  scale: 1,
};

/**
 * Capture a screenshot of the current viewport.
 *
 * Hides the SDK's own overlay host before capture and restores it after,
 * so the screenshot reflects the prototype, not the SDK chrome.
 */
export async function captureViewport(options: CaptureOptions = {}): Promise<Blob | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const html2canvas = await loadHtml2Canvas();
  if (!html2canvas) return null;

  const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement | null;
  const previousVisibility = host?.style.visibility ?? "";
  if (host) host.style.visibility = "hidden";

  try {
    const canvas: HTMLCanvasElement = await html2canvas(document.documentElement, {
      backgroundColor: null,
      scale: opts.scale,
      width: window.innerWidth,
      height: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      logging: false,
      useCORS: true,
      allowTaint: false,
    });

    return await canvasToBlob(canvas, opts.mimeType, opts.quality);
  } catch {
    return null;
  } finally {
    if (host) host.style.visibility = previousVisibility;
  }
}

let html2canvasPromise: Promise<Html2CanvasFn | null> | null = null;
let html2canvasMissingWarned = false;

async function loadHtml2Canvas(): Promise<Html2CanvasFn | null> {
  if (html2canvasPromise) return html2canvasPromise;
  html2canvasPromise = (async () => {
    try {
      const mod = (await import("html2canvas")) as { default?: Html2CanvasFn } & Html2CanvasFn;
      return (mod.default ?? (mod as unknown as Html2CanvasFn)) ?? null;
    } catch (err) {
      if (!html2canvasMissingWarned && typeof console !== "undefined") {
        html2canvasMissingWarned = true;
        // html2canvas is bundled with the SDK — if the dynamic import still
        // fails, something is wrong with the consumer's bundler config.
        console.warn(
          "[feedback-sdk] screenshot capture disabled: failed to load `html2canvas`. " +
            "This shouldn't normally happen — html2canvas is a direct dependency of the SDK. " +
            "Pass `captureScreenshots: false` to silence this warning if intended.",
          err
        );
      }
      return null;
    }
  })();
  return html2canvasPromise;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob(resolve, mimeType, quality);
    } else {
      // Fallback: data URL â†’ Blob.
      try {
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const [meta, b64] = dataUrl.split(",");
        const bin = atob(b64 ?? "");
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const detectedMime = meta?.match(/data:([^;]+);/)?.[1] ?? mimeType;
        resolve(new Blob([arr], { type: detectedMime }));
      } catch {
        resolve(null);
      }
    }
  });
}

// Loose type â€” html2canvas's published .d.ts is broad; we don't need most of it.
type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>
) => Promise<HTMLCanvasElement>;

/** @internal â€” exposed for tests. */
export function _resetForTests() {
  html2canvasPromise = null;
  html2canvasMissingWarned = false;
}
