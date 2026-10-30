import { shrinkTo } from "./zoom";

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
