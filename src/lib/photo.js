import { shrinkTo } from "./zoom.js";

// A photo for a section (0096), made ready to keep: no bigger than it needs
// to be to read a whiteboard up close (its longer side `max` pixels), as a
// JPEG on white, the right way up. A small PNG (a screenshot) is kept as it
// is, so its text stays crisp. One this browser can't open (a HEIC outside
// Safari) is kept as it is too, if the bucket takes it.
//
// Resolves to { blob, width, height, extension }.
const KEEPS = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
const MAX_BYTES = 8 * 1024 * 1024;

export async function readyPhoto(file, max = 2560, quality = 0.86) {
  let bmp = null;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bmp = null;
  }
  if (!bmp) {
    if (!KEEPS.includes(file.type) || file.size > MAX_BYTES) throw new Error("That picture can't be opened here. Try a JPEG or PNG under 8 MB.");
    return { blob: file, width: null, height: null, extension: extensionOf(file) };
  }
  const small = shrinkTo(bmp.width, bmp.height, max);
  if (file.type === "image/png" && file.size <= 2 * 1024 * 1024 && small.width === bmp.width) {
    const out = { blob: file, width: bmp.width, height: bmp.height, extension: "png" };
    bmp.close?.();
    return out;
  }
  const canvas = document.createElement("canvas");
  canvas.width = small.width;
  canvas.height = small.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, small.width, small.height);
  ctx.drawImage(bmp, 0, 0, small.width, small.height);
  bmp.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't get that picture ready.");
  return { blob, width: small.width, height: small.height, extension: "jpg" };
}

function extensionOf(file) {
  const fromName = (file.name?.split(".").pop() || "").toLowerCase();
  if (/^(jpe?g|png|webp|gif|heic)$/.test(fromName)) return fromName;
  return (file.type?.split("/")[1] || "jpg").replace("jpeg", "jpg");
}

// The picture in a paste (0098), or null when there's text to paste
// instead (copying cells from a spreadsheet brings a picture of them along).
export function pastedImage(data) {
  if (!data) return null;
  if (String(data.getData?.("text/plain") ?? "").trim()) return null;
  for (const f of Array.from(data.files ?? [])) if (f?.type?.startsWith("image/")) return f;
  for (const it of Array.from(data.items ?? [])) {
    if (it?.kind !== "file" || !it.type?.startsWith("image/")) continue;
    const f = it.getAsFile?.();
    if (f) return f;
  }
  return null;
}

// A picture's size as a sketch's page (0098: 50 to 10000 each way), its
// shape kept; a size not known (a file this browser can't open) is 4 by 3.
export function pageOf(width, height) {
  if (!width || !height) return { width: 1200, height: 900 };
  const k = Math.min(Math.max(1, 50 / Math.min(width, height)), 10000 / Math.max(width, height));
  const fit = (n) => Math.max(50, Math.min(10000, Math.round(n * k)));
  return { width: fit(width), height: fit(height) };
}

