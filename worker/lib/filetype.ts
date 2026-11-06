export type AllowedFile = { mime: string; ext: string };

const ALLOWED: Record<string, AllowedFile> = {
  pdf: { mime: 'application/pdf', ext: 'pdf' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  png: { mime: 'image/png', ext: 'png' },
  jpg: { mime: 'image/jpeg', ext: 'jpg' },
};

function startsWith(b: Uint8Array, sig: number[]): boolean {
  return sig.every((v, i) => b[i] === v);
}

function containsAscii(b: Uint8Array, needle: string, limit = b.length): boolean {
  const n = new TextEncoder().encode(needle);
  outer: for (let i = 0; i <= Math.min(limit, b.length) - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (b[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * Identify a file by its signature (magic bytes), not by its name or the client-declared MIME type.
 * Returns null for anything unsupported, including executables, archives that are not DOCX, HTML and SVG.
 */
export function sniffFile(bytes: Uint8Array, filename: string): AllowedFile | null {
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return ext === 'pdf' ? ALLOWED.pdf : null; // %PDF-
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // DOCX is a ZIP containing word/document.xml; reject macro-enabled documents.
    if (ext !== 'docx') return null;
    if (!containsAscii(bytes, 'word/')) return null;
    if (containsAscii(bytes, 'vbaProject.bin')) return null;
    return ALLOWED.docx;
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return ext === 'png' ? ALLOWED.png : null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return ext === 'jpg' || ext === 'jpeg' ? ALLOWED.jpg : null;
  return null;
}

export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'document';
  const cleaned = base
    .replace(/[^\w.\- ()]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(-120);
  return cleaned || 'document';
}
