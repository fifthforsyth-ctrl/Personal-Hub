// The home screen widget, as a script for the free Scriptable app.
//
// An app added to the iPhone home screen from Safari can't put a widget
// there (Apple keeps widgets for App Store apps), so the widget runs in
// Scriptable, which exists to draw widgets from a few lines of JavaScript.
// The Hub writes the script with your key already in it; you paste it in
// once and pick a size. It asks the `widget` edge function for today's
// numbers and draws them in the Hub's look: white card, black type, the
// crossed swords in orange, losses in small grey type beside the wins.
//
// Sizes: small (wins, losses, minutes), medium (plus the top categories),
// large (plus the wins you named), and on the lock screen a line, a
// rectangle, or a circle with the win count.

export function buildWidgetScript({ appUrl, apiUrl, key }) {
  return `// Personal Hub: today's wins, losses and minutes.
// Written by the Hub for you. The key below opens your numbers, so keep it
// to yourself; you can turn it off any time in the Hub (More > On your phone).

const HUB = ${JSON.stringify(appUrl)};
const API = ${JSON.stringify(apiUrl)};
const KEY = ${JSON.stringify(key)};

const INK = Color.dynamic(new Color("#141414"), new Color("#f2f1ee"));
const MUTED = Color.dynamic(new Color("#8a877f"), new Color("#9a978f"));
const BG = Color.dynamic(new Color("#ffffff"), new Color("#141414"));
const ORANGE = new Color("#f26a1b");
const TRACK = new Color("#8a877f", 0.18);

const fm = FileManager.local();
const dir = fm.joinPath(fm.documentsDirectory(), "personal-hub");
if (!fm.fileExists(dir)) fm.createDirectory(dir);

function zone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver";
  } catch (e) {
    return "America/Denver";
  }
}

async function load() {
  const cache = fm.joinPath(dir, "today.json");
  try {
    const req = new Request(API + "?tz=" + encodeURIComponent(zone()));
    req.headers = { "x-widget-key": KEY };
    req.timeoutInterval = 20;
    const data = await req.loadJSON();
    if (req.response.statusCode !== 200) return { error: data.error || "The Hub said no." };
    fm.writeString(cache, JSON.stringify(data));
    return data;
  } catch (e) {
    if (fm.fileExists(cache)) {
      const old = JSON.parse(fm.readString(cache));
      old.stale = true;
      return old;
    }
    return { error: "Couldn't reach the Hub." };
  }
}

async function swords() {
  const file = fm.joinPath(dir, "swords.png");
  if (fm.fileExists(file)) return fm.readImage(file);
  try {
    const img = await new Request(HUB + "/widget/swords.png").loadImage();
    fm.writeImage(file, img);
    return img;
  } catch (e) {
    return null;
  }
}

function fmtMin(m) {
  m = Math.round(m || 0);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? h + "h " + r + "m" : h + "h";
}

function color(hex) {
  try {
    return hex ? new Color(hex) : MUTED;
  } catch (e) {
    return MUTED;
  }
}

// The day's minutes as one bar: a rounded segment per category, a hair
// apart, on a faint track.
function bar(cats, width, height) {
  const dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const pill = (x, w, col) => {
    const p = new Path();
    p.addRoundedRect(new Rect(x, 0, w, height), height / 2, height / 2);
    dc.addPath(p);
    dc.setFillColor(col);
    dc.fillPath();
  };
  pill(0, width, TRACK);
  const total = cats.reduce((s, c) => s + c.minutes, 0);
  let x = 0;
  for (const c of cats) {
    const w = total ? (c.minutes / total) * width : 0;
    if (w >= 1) pill(x, Math.max(w - 2, Math.min(w, height)), color(c.color));
    x += w;
  }
  return dc.getImage();
}

function text(stack, s, font, col, lines) {
  const t = stack.addText(String(s));
  t.font = font;
  t.textColor = col || INK;
  t.lineLimit = lines || 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

function eyebrow(stack, s) {
  const t = text(stack, s.toUpperCase(), Font.semiboldMonospacedSystemFont(10), MUTED);
  return t;
}

function lossLine(n) {
  return n === 1 ? "1 loss" : n + " losses";
}

// Wins: the swords, the count, and the losses under it in grey.
function winsBlock(stack, d, icon, big) {
  const head = stack.addStack();
  head.centerAlignContent();
  if (icon) {
    const im = head.addImage(icon);
    im.imageSize = new Size(14, 14);
    im.tintColor = ORANGE;
    head.addSpacer(5);
  }
  eyebrow(head, "Wins");
  stack.addSpacer(2);
  text(stack, d.wins, Font.boldSystemFont(big), INK);
  text(stack, lossLine(d.losses), Font.mediumSystemFont(12), MUTED);
}

function runningRow(stack, run) {
  const row = stack.addStack();
  row.centerAlignContent();
  const dot = row.addText("●");
  dot.font = Font.systemFont(9);
  dot.textColor = ORANGE;
  row.addSpacer(5);
  text(row, run.category, Font.semiboldSystemFont(12), INK);
  row.addSpacer(6);
  const since = row.addDate(new Date(run.startedAt));
  since.applyTimerStyle();
  since.font = Font.mediumMonospacedSystemFont(12);
  since.textColor = MUTED;
  row.addSpacer();
}

function minutesBlock(stack, d, width, rows) {
  const head = stack.addStack();
  head.centerAlignContent();
  eyebrow(head, "Minutes");
  head.addSpacer();
  text(head, d.trackedMinutes ? fmtMin(d.trackedMinutes) : "–", Font.semiboldMonospacedSystemFont(13), INK);
  stack.addSpacer(6);
  stack.addImage(bar(d.categories, width, 7)).imageSize = new Size(width, 7);
  for (const c of d.categories.slice(0, rows)) {
    stack.addSpacer(4);
    const r = stack.addStack();
    r.centerAlignContent();
    const dot = r.addText("●");
    dot.font = Font.systemFont(8);
    dot.textColor = color(c.color);
    r.addSpacer(5);
    text(r, c.name, Font.mediumSystemFont(12), INK);
    r.addSpacer();
    text(r, fmtMin(c.minutes), Font.mediumMonospacedSystemFont(12), MUTED);
  }
  if (d.running) {
    stack.addSpacer(6);
    runningRow(stack, d.running);
  }
}

function footer(w, d) {
  if (!d.stale) return;
  w.addSpacer(4);
  const f = w.addStack();
  const t = f.addText("Offline · as of ");
  t.font = Font.systemFont(9);
  t.textColor = MUTED;
  const at = f.addDate(new Date(d.asOf));
  at.applyTimeStyle();
  at.font = Font.systemFont(9);
  at.textColor = MUTED;
}

async function build() {
  const d = await load();
  const family = config.widgetFamily || "medium";
  const w = new ListWidget();
  w.url = HUB;
  w.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);

  if (d.error) {
    w.backgroundColor = BG;
    text(w, "Personal Hub", Font.semiboldSystemFont(13), INK);
    w.addSpacer(4);
    text(w, d.error, Font.systemFont(11), MUTED, 4);
    return w;
  }

  const icon = await swords();

  // Lock screen: no background, the system tints everything.
  if (family === "accessoryInline") {
    w.addText("⚔ " + d.wins + " · " + lossLine(d.losses) + " · " + fmtMin(d.trackedMinutes));
    return w;
  }
  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack();
    s.layoutVertically();
    s.centerAlignContent();
    if (icon) {
      const r = s.addStack();
      r.addSpacer();
      r.addImage(icon).imageSize = new Size(14, 14);
      r.addSpacer();
    }
    const r2 = s.addStack();
    r2.addSpacer();
    r2.addText(String(d.wins)).font = Font.boldSystemFont(20);
    r2.addSpacer();
    return w;
  }
  if (family === "accessoryRectangular") {
    const top = w.addStack();
    top.centerAlignContent();
    if (icon) {
      top.addImage(icon).imageSize = new Size(14, 14);
      top.addSpacer(5);
    }
    top.addText(d.wins + (d.wins === 1 ? " win" : " wins")).font = Font.boldSystemFont(15);
    top.addSpacer(6);
    const l = top.addText(lossLine(d.losses));
    l.font = Font.systemFont(12);
    l.textOpacity = 0.6;
    w.addText(fmtMin(d.trackedMinutes) + " tracked").font = Font.mediumSystemFont(13);
    if (d.categories[0]) {
      const c = w.addText(d.categories.slice(0, 2).map((c) => c.name + " " + fmtMin(c.minutes)).join(" · "));
      c.font = Font.systemFont(11);
      c.textOpacity = 0.7;
      c.lineLimit = 1;
    }
    return w;
  }

  w.backgroundColor = BG;

  if (family === "small") {
    w.setPadding(14, 14, 14, 14);
    winsBlock(w, d, icon, 40);
    w.addSpacer();
    const head = w.addStack();
    head.centerAlignContent();
    eyebrow(head, "Min");
    head.addSpacer();
    text(head, d.trackedMinutes ? fmtMin(d.trackedMinutes) : "–", Font.semiboldMonospacedSystemFont(13), INK);
    w.addSpacer(5);
    w.addImage(bar(d.categories, 120, 6)).imageSize = new Size(120, 6);
    footer(w, d);
    return w;
  }

  w.setPadding(16, 16, 16, 16);
  const body = w.addStack();
  body.layoutHorizontally();
  const left = body.addStack();
  left.layoutVertically();
  left.size = new Size(92, 0);
  winsBlock(left, d, icon, family === "medium" ? 44 : 52);
  left.addSpacer();
  body.addSpacer(14);
  const right = body.addStack();
  right.layoutVertically();
  minutesBlock(right, d, 184, family === "medium" ? (d.running ? 2 : 3) : 7);

  if (family !== "medium" && d.winLabels && d.winLabels.length) {
    w.addSpacer(14);
    eyebrow(w, "Latest wins");
    for (const label of d.winLabels) {
      w.addSpacer(3);
      const r = w.addStack();
      r.centerAlignContent();
      if (icon) {
        const im = r.addImage(icon);
        im.imageSize = new Size(10, 10);
        im.tintColor = MUTED;
        r.addSpacer(6);
      }
      text(r, label, Font.mediumSystemFont(13), INK);
    }
  }
  w.addSpacer();
  footer(w, d);
  return w;
}

const widget = await build();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
`;
}
