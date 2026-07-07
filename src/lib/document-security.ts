const mebibyte = 1024 * 1024;

export const maxDocumentUploadBytes = 10 * mebibyte;

export const allowedDocumentMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
] as const;

type AllowedDocumentMimeType = (typeof allowedDocumentMimeTypes)[number];

type DocumentTypeRule = {
  extensions: string[];
  mimeType: AllowedDocumentMimeType;
  matchesSignature: (bytes: Uint8Array) => boolean;
};

const documentTypeRules: DocumentTypeRule[] = [
  {
    extensions: ["pdf"],
    mimeType: "application/pdf",
    matchesSignature: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  },
  {
    extensions: ["png"],
    mimeType: "image/png",
    matchesSignature: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    extensions: ["jpg", "jpeg"],
    mimeType: "image/jpeg",
    matchesSignature: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  },
  {
    extensions: ["heic"],
    mimeType: "image/heic",
    matchesSignature: (bytes) => hasIsoBrand(bytes, ["heic", "heix", "hevc", "hevx"]),
  },
  {
    extensions: ["heif"],
    mimeType: "image/heif",
    matchesSignature: (bytes) => hasIsoBrand(bytes, ["heif", "mif1", "msf1"]),
  },
];

const allowedDescription = "PDF, PNG, JPEG, HEIC, or HEIF";
const maxUploadDescription = "10 MB";

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function hasIsoBrand(bytes: Uint8Array, brands: string[]) {
  return bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp" && brands.includes(ascii(bytes, 8, 4));
}

function extensionFor(fileName: string) {
  const name = fileName.trim().toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === name.length - 1) return "";
  return name.slice(dotIndex + 1);
}

function normalizeMimeType(mimeType: string) {
  return mimeType.split(";")[0].trim().toLowerCase();
}

export function safeDocumentFileName(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "");
  return safeName || "document";
}

function contentDispositionFileName(fileName: string) {
  const safeName = fileName.replace(/[\\/"\r\n]/g, "_").trim();
  return safeName || "document";
}

function validationError() {
  return new Error(`Upload ${allowedDescription} files up to ${maxUploadDescription}.`);
}

export async function validateUploadedDocument(file: File) {
  if (file.size <= 0) {
    throw new Error("Choose a document before uploading.");
  }

  if (file.size > maxDocumentUploadBytes) {
    throw validationError();
  }

  const extension = extensionFor(file.name);
  const mimeType = normalizeMimeType(file.type);
  const rule = documentTypeRules.find((typeRule) => (
    typeRule.mimeType === mimeType && typeRule.extensions.includes(extension)
  ));

  if (!rule) {
    throw validationError();
  }

  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!rule.matchesSignature(signature)) {
    throw validationError();
  }

  return {
    mimeType: rule.mimeType,
    safeName: safeDocumentFileName(file.name),
  };
}

export function inlineDocumentContentType(fileName: string, reportedMimeType: string) {
  const extension = extensionFor(fileName);
  const mimeType = normalizeMimeType(reportedMimeType);
  const rule = documentTypeRules.find((typeRule) => (
    typeRule.mimeType === mimeType && typeRule.extensions.includes(extension)
  ));

  return rule?.mimeType ?? null;
}

export function documentSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'",
    "Referrer-Policy": "no-referrer",
  };
}

export function documentViewHeaders(fileName: string, reportedMimeType: string) {
  const contentType = inlineDocumentContentType(fileName, reportedMimeType);
  const disposition = contentType ? "inline" : "attachment";

  return {
    ...documentSecurityHeaders(),
    "Content-Type": contentType ?? "application/octet-stream",
    "Content-Disposition": `${disposition}; filename="${contentDispositionFileName(fileName)}"`,
    "Cache-Control": "private, max-age=60",
  };
}

export function documentDownloadHeaders(fileName: string) {
  return {
    ...documentSecurityHeaders(),
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${contentDispositionFileName(fileName)}"`,
  };
}
