/**
 * Extracts the text layer from a PDF entirely in the browser.
 *
 * pdf.js is loaded on demand: it is far larger than the rest of this app, and
 * most visitors paste text instead of opening a PDF, so it must not sit in the
 * initial bundle.
 *
 * This reads the existing text layer only. A transcript that is a photograph
 * or a flatbed scan has no text layer and needs OCR, which is not implemented;
 * `extractPdfText` reports that case rather than returning an empty string
 * that would look like a parsing failure.
 */

export type PdfExtraction = {
  text: string;
  pages: number;
  /** True when the PDF has no usable text layer, i.e. it is a scanned image. */
  imageOnly: boolean;
};

/** Turbopack and webpack both resolve this to a bundled asset URL. */
function workerUrl(): string {
  return new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
}

/**
 * Loads pdf.js once and remembers the promise.
 *
 * Shared by `extractPdfText` and `warmPdfEngine` so that warming the engine
 * ahead of time and using it later hit the same module instance.
 */
let enginePromise: Promise<typeof import("pdfjs-dist")> | null = null;

function loadEngine(): Promise<typeof import("pdfjs-dist")> {
  enginePromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl();
    return pdfjs;
  });
  return enginePromise;
}

/**
 * Downloads the PDF engine before anyone asks for it, so that importing a
 * transcript still works after the network is gone.
 *
 * This exists because warming the wrapper module is not enough: pdf.js is a
 * ~440KB chunk behind its own dynamic import, and the worker is a separate
 * asset again. A student who loaded the app online and only *then* went offline
 * would otherwise find PDF import broken, which is precisely the case offline
 * support is meant to cover.
 */
export async function warmPdfEngine(): Promise<void> {
  await loadEngine();
  // Pull the worker through the network layer too, so the service worker
  // caches it. pdf.js only requests this when a document is actually opened.
  await fetch(workerUrl(), { cache: "force-cache" }).catch(() => {});
}

export async function extractPdfText(file: File): Promise<PdfExtraction> {
  const pdfjs = await loadEngine();

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const document = await loadingTask.promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();

    // Group items into visual lines by their y position. A transcript is a
    // table, and the parser is line-oriented, so joining every item with a
    // space would collapse whole terms onto one line.
    const lines = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || item.str.trim() === "") continue;
      // transform[5] is the y offset; round so items on one row group together.
      const y = Math.round(item.transform[5]);
      const row = lines.get(y) ?? [];
      row.push({ x: item.transform[4], text: item.str });
      lines.set(y, row);
    }

    const ordered = [...lines.entries()]
      .sort((a, b) => b[0] - a[0]) // PDF y grows upward, so descending is top-down
      .map(([, row]) =>
        row
          .sort((a, b) => a.x - b.x)
          .map((cell) => cell.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      );

    pages.push(ordered.join("\n"));
  }

  const pageCount = document.numPages;
  // Releases the worker; the document proxy itself only exposes cleanup().
  await loadingTask.destroy();

  const text = pages.join("\n");
  return {
    text,
    pages: pageCount,
    imageOnly: text.trim().length === 0,
  };
}
