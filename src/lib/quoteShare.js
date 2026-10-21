import { initials, sourceLine } from "./quotes.js";

// Sharing a quote with a friend: the words as text, or the quote as a picture
// in the Board's look (a black-and-white print taped to grid paper), handed to
// the phone's share sheet. Nothing is sent from here; you pick who gets it.
//
// The layout and wording are pure and tested; drawing needs a browser.

export const CARD_W = 1080;
export const CARD_H = 1350; // 4:5, what Messages and most apps show whole

const PRINT_X = 100;
const PRINT_W = CARD_W - PRINT_X * 2;
const PAD = 40;
const TEXT_W = PRINT_W - PAD * 2;
const TOP = 120;
const BOTTOM = 100;
const PHOTO_MAX = 560;
const PHOTO_MIN = 300;
const LINE = 1.3;
const SIZES = [56, 52, 48, 44, 40, 37, 34, 32];

// The words as a friend reads them in a text.
export function shareText(quote) {
  const text = String(quote?.text ?? "").trim();
  const by = [quote?.author, sourceLine(quote)].filter(Boolean).join(", ");
  return by ? `“${text}”\n— ${by}` : `“${text}”`;
}

// "quote-jeffrey-r-holland.png"
export function shareFileName(quote) {
  const slug = String(quote?.author ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `quote${slug ? `-${slug}` : ""}.png`;
}

// Greedy word wrap. `measure` gives a string's width; a word wider than the
// line gets a line to itself rather than being cut.
export function wrapText(text, measure, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Where everything goes. The words pick the biggest size that still leaves a
// good-sized photo; a very long quote makes the card taller instead of tiny.
// `measureAt(size)` returns a measure function for the serif at that size.
export function layoutCard(quote, measureAt, { hasPhoto = true } = {}) {
  const text = `“${String(quote?.text ?? "").trim()}”`;
  const source = sourceLine(quote);
  const sourceLines = source ? wrapText(source, measureAt("mono"), TEXT_W).slice(0, 2) : [];
  const byH = 34 + (sourceLines.length ? 14 + sourceLines.length * 32 : 0);
  const room = CARD_H - TOP - BOTTOM - PAD - 44 - 36 - byH - 48;

  let size = SIZES[SIZES.length - 1];
  let lines = wrapText(text, measureAt(size), TEXT_W);
  for (const s of SIZES) {
    const l = wrapText(text, measureAt(s), TEXT_W);
    if (room - l.length * s * LINE >= PHOTO_MIN) {
      size = s;
      lines = l;
      break;
    }
  }
  const textH = Math.round(lines.length * size * LINE);
  const photoH = Math.max(PHOTO_MIN, Math.min(PHOTO_MAX, room - textH));
  const printH = PAD + photoH + 44 + textH + 36 + byH + 48;
  const height = Math.max(CARD_H, TOP + printH + BOTTOM);
  const printY = Math.round((height - printH) / 2) + 6;
  const photoY = printY + PAD;
  const textY = photoY + photoH + 44;
  const byY = textY + textH + 36;

  return {
    width: CARD_W,
    height,
    print: { x: PRINT_X, y: printY, w: PRINT_W, h: printH },
    photo: { x: PRINT_X + PAD, y: photoY, w: TEXT_W, h: photoH, hasPhoto },
    text: { x: PRINT_X + PAD, y: textY, size, lineHeight: Math.round(size * LINE), lines },
    author: { x: PRINT_X + PAD, y: byY, text: String(quote?.author ?? "").toUpperCase() },
    source: { x: PRINT_X + PAD, y: byY + 34 + 14, lines: sourceLines },
    initials: initials(quote?.author),
  };
}

// --- Browser only from here down ---------------------------------------

const SERIF = 'Fraunces, Georgia, "Iowan Old Style", serif';
const SANS = '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif';
const MONO = '"DM Mono", ui-monospace, Menlo, monospace';

// The picture, fetched so the canvas may read it. Most come from Wikimedia,
// which allows that; one that doesn't (or is slow) gives the initials block,
// the same fallback the Board uses.
async function loadPhoto(url) {
  if (!url) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    // no-store: the Board already showed this picture without asking for
    // permission to read it, and a cached copy like that would taint the canvas.
    const res = await fetch(url, { mode: "cors", cache: "no-store", referrerPolicy: "no-referrer", signal: ctrl.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (typeof createImageBitmap === "function") return await createImageBitmap(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fontsReady() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`500 48px Fraunces`),
      document.fonts.load(`700 26px "DM Sans"`),
      document.fonts.load(`400 22px "DM Mono"`),
    ]);
  } catch {
    // The fallbacks look fine.
  }
}

// Letter-spaced text, drawn a character at a time (ctx.letterSpacing is too
// new to count on in Safari).
function spaced(ctx, text, x, y, spacing) {
  let at = x;
  for (const ch of text) {
    ctx.fillText(ch, at, y);
    at += ctx.measureText(ch).width + spacing;
  }
}

// Cover-crop the photo into its box, then turn it black and white with a
// little extra contrast, like the prints on the Board.
function drawPhoto(ctx, img, box) {
  const iw = img.width;
  const ih = img.height;
  const scale = Math.max(box.w / iw, box.h / ih);
  const sw = box.w / scale;
  const sh = box.h / scale;
  // Faces sit high in portraits, so crop from a little above the middle.
  const sx = (iw - sw) / 2;
  const sy = Math.max(0, (ih - sh) * 0.3);
  ctx.drawImage(img, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
  const data = ctx.getImageData(box.x, box.y, box.w, box.h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const v = Math.max(0, Math.min(255, (g - 128) * 1.12 + 128 - 3));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, box.x, box.y);
}

// Draws the card and gives back a PNG blob.
export async function renderQuoteCard(quote) {
  const [photo] = await Promise.all([loadPhoto(quote?.image_url), fontsReady()]);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const measureAt = (size) => {
    ctx.font = size === "mono" ? `400 22px ${MONO}` : `500 ${size}px ${SERIF}`;
    const font = ctx.font;
    return (s) => {
      ctx.font = font;
      return ctx.measureText(s).width;
    };
  };
  const L = layoutCard(quote, measureAt, { hasPhoto: Boolean(photo) });
  canvas.width = L.width;
  canvas.height = L.height;

  // Grid paper.
  ctx.fillStyle = "#f2f1ee";
  ctx.fillRect(0, 0, L.width, L.height);
  ctx.strokeStyle = "rgba(20, 20, 20, 0.055)";
  ctx.lineWidth = 1;
  for (let x = 0.5; x < L.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, L.height);
    ctx.stroke();
  }
  for (let y = 0.5; y < L.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(L.width, y);
    ctx.stroke();
  }

  // The print, with a soft shadow under it.
  const p = L.print;
  ctx.save();
  ctx.shadowColor = "rgba(20, 18, 14, 0.18)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.restore();

  // Photo, or the charcoal block with initials.
  const b = L.photo;
  if (photo) {
    drawPhoto(ctx, photo, b);
  } else {
    ctx.fillStyle = "#2b2b2a";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#f2f1ee";
    ctx.font = `500 120px ${SERIF}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(L.initials || "“", b.x + b.w / 2, b.y + b.h / 2);
    ctx.textAlign = "left";
  }

  // Black gaffer tape across the top edge.
  ctx.save();
  ctx.translate(L.width / 2, p.y);
  ctx.rotate((-1.5 * Math.PI) / 180);
  ctx.fillStyle = "rgba(18, 18, 18, 0.9)";
  ctx.fillRect(-120, -26, 240, 54);
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fillRect(-120, -26, 240, 10);
  ctx.restore();

  // The words.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#141414";
  ctx.font = `500 ${L.text.size}px ${SERIF}`;
  L.text.lines.forEach((line, i) => {
    ctx.fillText(line, L.text.x, L.text.y + L.text.size + i * L.text.lineHeight - (L.text.lineHeight - L.text.size) / 2);
  });

  // Who said them: a short orange rule, the name, the source.
  ctx.fillStyle = "#f26a1b";
  ctx.fillRect(L.author.x, L.author.y - 4, 44, 4);
  ctx.fillStyle = "#141414";
  ctx.font = `700 25px ${SANS}`;
  spaced(ctx, L.author.text, L.author.x, L.author.y + 32, 3);
  ctx.fillStyle = "#6b6a66";
  ctx.font = `400 22px ${MONO}`;
  L.source.lines.forEach((line, i) => ctx.fillText(line, L.source.x, L.source.y + 24 + i * 32));

  return await new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't draw the card."))), "image/png")
  );
}

// What this browser can hand to a share sheet.
export function shareSupport(file) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return { files: false, text: false };
  let files = false;
  try {
    files = Boolean(file && navigator.canShare?.({ files: [file] }));
  } catch {
    files = false;
  }
  return { files, text: true };
}
