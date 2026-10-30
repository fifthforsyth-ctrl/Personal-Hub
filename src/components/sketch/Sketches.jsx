import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Maximize2, PenTool, Sparkles, Trash2 } from "lucide-react";
import { addSketch, analyzeSketch, deleteSketch, fetchCampSketches, fetchQuestSketches, updateSketch, uploadSectionPicture } from "../../lib/api";
import { pageOf, pastedImage, readyPhoto } from "../../lib/photo";
import { prime, useSignedUrl } from "../../lib/useSignedUrl";
import { drawStrokes, fitPage, inkFrame, plainSummary, sketchPng, staleSummary } from "../../lib/sketch";
import { fmtShortDate, toDateStr } from "../../lib/planDates";
import { useLoad } from "../../lib/useLoad";
import { useConfirm, useToast } from "../ui/Feedback";
import Sheet from "../ascent/Sheet";
import { PlanNotes } from "../camp/Rich";
import SketchPad from "./SketchPad";
import { usePhotos } from "../photos/context";
import PinDots from "../photos/PinDots";
import Viewer from "../photos/Viewer";
import "../../styles/sketch.css";

// Sketches on a quest's lines or a camp's steps (0088). The page wraps its
// list in a SketchProvider; each row shows its sketches small under its
// words (SketchStrip) and, open, a Sketch button (SketchButton). Tapping a
// sketch opens it large with what it says; Analyze has the sketch reader
// look at it with what it's on and sum up what he jotted down. Tapping it
// there enlarges it over the whole screen, to zoom in and pin (0096).
//
// A picture pasted into a row (0098) is kept as one of its sketches with
// nothing drawn on it, its file in his folder of the bucket. It shows large
// under the row's words and opens straight up close, to zoom in and pin.
//
//   <SketchProvider kind="task" userId={userId} scopeId={questId} about={(id) => text} onAddToNote={(id, text) => …}>
//
// `scopeId` can be a list (a quest's Today board holds steps from all its
// camps). Where one provider's rows sit inside another's, `useSketchScope()`
// reads the outer one and `<SketchScope value>` hands it back to them.

const Ctx = createContext(null);

export function useSketchScope() {
  return useContext(Ctx);
}

export function SketchScope({ value, children }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function SketchProvider({ kind, userId, scopeId, about, onAddToNote, children }) {
  const toast = useToast();
  const confirm = useConfirm();
  const key = kind === "step" ? "camp_step_id" : "quest_task_id";
  const scopes = (Array.isArray(scopeId) ? scopeId : [scopeId]).filter(Boolean);
  const scopeKey = scopes.join(",");
  const { data, mutate, reload } = useLoad(
    () =>
      userId && scopes.length
        ? Promise.all(scopes.map((id) => (kind === "step" ? fetchCampSketches(userId, id) : fetchQuestSketches(userId, id)))).then((all) => all.flat())
        : [],
    [userId, scopeKey, kind]
  );
  const [pad, setPad] = useState(null); // { itemId, sketch }
  const [viewing, setViewing] = useState(null); // a sketch's id
  const [reading, setReading] = useState(() => new Set()); // ids being read
  const [adding, setAdding] = useState(() => new Map()); // row id → pictures on their way
  // Up close (0096): with the page's photos and pins, there; else on its own.
  const photos = usePhotos();
  const [big, setBig] = useState(null);

  const list = data ?? [];
  const byItem = useMemo(() => {
    const m = new Map();
    for (const s of [...(data ?? [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
      const id = s[key];
      if (!m.has(id)) m.set(id, []);
      m.get(id).push(s);
    }
    return m;
  }, [data, key]);

  const setOne = (id, fields) => mutate((l) => (l ?? []).map((s) => (s.id === id ? { ...s, ...fields } : s)));

  async function analyze(sketch) {
    if (reading.has(sketch.id)) return;
    setReading((r) => new Set(r).add(sketch.id));
    try {
      const out = await analyzeSketch(sketch.id, sketchPng(sketch));
      setOne(sketch.id, out);
    } catch (err) {
      toast.error(err, "Couldn't read that sketch.");
    } finally {
      setReading((r) => {
        const next = new Set(r);
        next.delete(sketch.id);
        return next;
      });
    }
  }

  // `drawing` is null when a sketch was opened to draw on and left as it was:
  // nothing to keep, so it goes back to the sketch (read, if Analyze).
  async function save(drawing, andAnalyze) {
    if (!drawing && pad.sketch) {
      const row = pad.sketch;
      setPad(null);
      setViewing(row.id);
      if (andAnalyze) analyze(list.find((x) => x.id === row.id) ?? row);
      return true;
    }
    try {
      let row;
      if (pad.sketch) {
        const updated_at = new Date().toISOString();
        await updateSketch(pad.sketch.id, { ...drawing, updated_at });
        row = { ...pad.sketch, ...drawing, updated_at };
        setOne(row.id, row);
      } else {
        row = await addSketch(userId, { [key]: pad.itemId, ...drawing });
        mutate((l) => [...(l ?? []), row]);
      }
      setPad(null);
      setViewing(row.id);
      if (andAnalyze) analyze(row);
      return true;
    } catch (err) {
      toast.error(err, "Couldn't keep that sketch.");
      return false;
    }
  }

  async function remove(sketch) {
    const picture = Boolean(sketch.image_path);
    const ok = await confirm({
      title: picture ? "Delete this picture?" : "Delete this sketch?",
      body: sketch.summary ? "What it says goes with it." : undefined,
      confirmLabel: "Delete",
    });
    if (!ok) return false;
    setViewing(null);
    setBig(null);
    mutate((l) => (l ?? []).filter((s) => s.id !== sketch.id));
    try {
      await deleteSketch(sketch.id, sketch.image_path ?? null);
    } catch (err) {
      toast.error(err, picture ? "Couldn't delete that picture." : "Couldn't delete that sketch.");
      reload();
    }
    return true;
  }

  // A picture pasted or picked onto a row (0098): made ready (no bigger than
  // it needs to be), kept in his folder, and put on the row. It shows from
  // the device at once while the page is open.
  async function addImage(itemId, file) {
    const bump = (by) =>
      setAdding((m) => {
        const next = new Map(m);
        const n = (next.get(itemId) ?? 0) + by;
        if (n > 0) next.set(itemId, n);
        else next.delete(itemId);
        return next;
      });
    bump(1);
    try {
      const ready = await readyPhoto(file);
      const path = await uploadSectionPicture(userId, ready.blob, ready.extension, kind === "step" ? "step" : "task");
      try {
        prime(path, URL.createObjectURL(ready.blob));
      } catch {
        /* it signs a link instead */
      }
      const row = await addSketch(userId, { [key]: itemId, ...pageOf(ready.width, ready.height), strokes: [], image_path: path });
      mutate((l) => [...(l ?? []), row]);
      return row;
    } catch (err) {
      toast.error(err, "Couldn't add that picture.");
      return null;
    } finally {
      bump(-1);
    }
  }

  // A picture opens straight up close (with the page's pins, if it has
  // them), with a way to delete it there.
  function openPicture(k) {
    if (photos) photos.openSketch(k, about?.(k[key]), { onRemove: () => remove(k) });
    else setBig(k);
  }

  const ctx = {
    byItem,
    adding,
    draw: (itemId) => setPad({ itemId, sketch: null }),
    view: (id) => setViewing(id),
    addImage,
    openPicture,
  };
  const open = viewing ? list.find((s) => s.id === viewing) : null;

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {pad && (
        <SketchPad
          key={pad.sketch?.id ?? `new-${pad.itemId}`}
          sketch={pad.sketch}
          about={about?.(pad.itemId)}
          onSave={save}
          onClose={() => {
            const back = pad.sketch?.id;
            setPad(null);
            if (back) setViewing(back);
          }}
        />
      )}
      {open && !pad && (
        <SketchSheet
          sketch={open}
          about={about?.(open[key])}
          reading={reading.has(open.id)}
          onAnalyze={() => analyze(open)}
          onDraw={() => {
            setViewing(null);
            setPad({ itemId: open[key], sketch: open });
          }}
          onAddToNote={
            onAddToNote && open.summary
              ? () => {
                  const status = onAddToNote(open[key], plainSummary(open.summary));
                  if (status === "full") toast.show("Its notes are full, so nothing was added.", { tone: "error" });
                  else if (status === "cut") toast.show("Added to its notes, but they ran out of room, so the end was cut off.");
                  else if (status !== "gone") toast.show("Added to its notes");
                }
              : null
          }
          onEnlarge={() => (photos ? photos.openSketch(open, about?.(open[key])) : setBig(open))}
          onRemove={() => remove(open)}
          onClose={() => setViewing(null)}
        />
      )}
      {big && <BigOne sketch={big} onRemove={() => remove(big)} onClose={() => setBig(null)} />}
    </Ctx.Provider>
  );
}

// A sketch drawn to fit its box, sharp on any screen, no line thinner than
// `minPx` on screen. With `frame` (from inkFrame), only that part of the page.
export function SketchImage({ sketch, className, pad = 0, minPx = 1.2, frame = null }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const r = c.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      const ctx = c.getContext("2d");
      const f = frame ?? { x: 0, y: 0, width: sketch.width, height: sketch.height };
      const fit = fitPage(f.width, f.height, r.width, r.height, pad);
      ctx.setTransform(dpr * fit.scale, 0, 0, dpr * fit.scale, dpr * (fit.x - f.x * fit.scale), dpr * (fit.y - f.y * fit.scale));
      drawStrokes(ctx, sketch.strokes ?? [], minPx / fit.scale);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [sketch.strokes, sketch.width, sketch.height, pad, minPx, frame]);
  return <canvas ref={ref} className={className} role="img" aria-label={sketch.title ? `Sketch: ${sketch.title}` : "Sketch"} />;
}

// A sketch or picture up close where the page has no photos of its own.
function BigOne({ sketch, onRemove, onClose }) {
  const src = useSignedUrl(sketch.image_path ?? null);
  const picture = Boolean(sketch.image_path);
  return (
    <Viewer
      title={sketch.title || (picture ? "Picture" : "Sketch")}
      src={picture ? src : null}
      sketch={picture ? null : sketch}
      width={picture ? sketch.width : null}
      height={picture ? sketch.height : null}
      tools={
        picture ? (
          <button type="button" className="iv-btn" onClick={onRemove} aria-label="Delete this picture" title="Delete this picture">
            <Trash2 size={16} />
          </button>
        ) : null
      }
      onClose={onClose}
    />
  );
}

// A row's sketches and pictures, under its words: big enough to read.
export function SketchStrip({ itemId }) {
  const s = useContext(Ctx);
  const list = s?.byItem.get(itemId);
  const waiting = s?.adding.get(itemId) ?? 0;
  if (!list?.length && !waiting) return null;
  return (
    <div className="sk-strip">
      {(list ?? []).map((k) =>
        k.image_path ? <PictureChip key={k.id} sketch={k} onOpen={() => s.openPicture(k)} /> : <SketchChip key={k.id} sketch={k} onOpen={() => s.view(k.id)} />
      )}
      {Array.from({ length: waiting }, (_, i) => (
        <span key={`wait-${i}`} className="sk-pic sk-pic--wait" role="status" aria-label="Adding the picture">
          <Loader2 size={18} className="spin" aria-hidden="true" />
        </span>
      ))}
    </div>
  );
}

// A picture on a row (0098), as large as the row lets it be, with its pins
// on it (each opens it up close there). A step carried onto it is pinned
// where it's let go (Photos.jsx reads the data-pin-* marks).
function PictureChip({ sketch, onOpen }) {
  const src = useSignedUrl(sketch.image_path);
  const photos = usePhotos();
  const pins = photos?.pinsOf({ sketch }) ?? [];
  const drops = Boolean(photos?.drops && src);
  return (
    <span
      className="sk-pic"
      data-pin-sketch={drops ? sketch.id : undefined}
      data-pin-step={drops ? sketch.camp_step_id ?? "" : undefined}
      data-pin-line={drops ? sketch.quest_task_id ?? "" : undefined}
    >
      <button type="button" className="sk-pic__open" onClick={onOpen} aria-label={pins.length ? `Open the picture and its ${pins.length === 1 ? "pin" : `${pins.length} pins`}` : "Open the picture"}>
        {src ? (
          <img src={src} alt="" width={sketch.width} height={sketch.height} draggable={false} />
        ) : (
          <span className="sk-pic__wait" style={{ aspectRatio: `${sketch.width} / ${sketch.height}` }} aria-hidden="true" />
        )}
      </button>
      {src && pins.length > 0 && <PinDots pins={pins} fit={{ w: sketch.width, h: sketch.height }} onOpen={photos.openPin} />}
      {drops && (
        <span className="pin-dot drop-mark" aria-hidden="true">
          <span className="pin-dot__head">+</span>
        </span>
      )}
    </span>
  );
}

// One sketch, small: just the part with ink on it, so a few words in a
// corner of a big iPad page still show; its pins too, where they fall on it.
function SketchChip({ sketch, onOpen }) {
  const frame = useMemo(() => inkFrame(sketch), [sketch]);
  const f = frame ?? sketch;
  const photos = usePhotos();
  const pins = photos?.pinsOf({ sketch }) ?? [];
  // the whole chip opens it up close, under its pins, which answer on their own
  return (
    <span className="sk-chip">
      <button type="button" className="sk-chip__open" onClick={onOpen} aria-label={sketch.title ? `Open sketch: ${sketch.title}` : "Open sketch"} />
      <span className="sk-chip__img" style={{ aspectRatio: `${Math.round(f.width)} / ${Math.round(f.height)}` }}>
        <SketchImage sketch={sketch} frame={frame} pad={3} minPx={1.3} />
        {pins.length > 0 && <PinDots pins={pins} fit={{ w: sketch.width, h: sketch.height, frame, pad: 3 }} onOpen={photos.openPin} />}
      </span>
      {sketch.title && (
        <span className="sk-chip__title">
          <Sparkles size={11} aria-hidden="true" />
          {sketch.title}
        </span>
      )}
    </span>
  );
}

// "Sketch", among an open row's tools, and "Picture" beside it (0098): one
// taken or chosen, for when there's nothing to paste (on a phone).
export function SketchButton({ itemId }) {
  const s = useContext(Ctx);
  const file = useRef(null);
  if (!s) return null;
  return (
    <>
      <button type="button" className="btn btn--sm sk-add" onClick={() => s.draw(itemId)}>
        <PenTool size={14} />
        Sketch
      </button>
      <label className="btn btn--sm sk-add" title="Add a picture. You can paste one here too.">
        <ImagePlus size={14} aria-hidden="true" />
        Picture
        <input
          ref={file}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            for (const f of files) s.addImage(itemId, f);
          }}
        />
      </label>
    </>
  );
}

// Pasting a picture into a row (0098): `onPaste` for anything inside an
// open row, putting it on `itemId`. Text pastes as it always has.
export function usePastePicture(itemId) {
  const s = useContext(Ctx);
  return (e) => {
    if (!s || !itemId) return;
    const f = pastedImage(e.clipboardData);
    if (!f) return;
    e.preventDefault();
    s.addImage(itemId, f);
  };
}

// One sketch, large, with what it says once it's been read.
function SketchSheet({ sketch, about, reading, onAnalyze, onDraw, onAddToNote, onEnlarge, onRemove, onClose }) {
  const stale = staleSummary(sketch);
  return (
    <Sheet title={sketch.title || "Sketch"} onClose={onClose}>
      <div className="sk-view">
        <button type="button" className="sk-view__img sk-view__big" style={{ aspectRatio: `${sketch.width} / ${sketch.height}` }} onClick={onEnlarge} aria-label="Enlarge the sketch" title="Enlarge, zoom in and pin">
          <SketchImage sketch={sketch} pad={6} />
          <span className="sk-view__zoom" aria-hidden="true">
            <Maximize2 size={14} />
          </span>
        </button>
        <p className="ascent-mini sk-view__on">
          {about ? <>On “{about}” · </> : null}
          {sketch.created_at ? fmtShortDate(toDateStr(new Date(sketch.created_at))) : null}
        </p>
        {reading ? (
          <p className="sk-reading" role="status">
            <Loader2 size={15} className="spin" aria-hidden="true" />
            Reading your sketch…
          </p>
        ) : sketch.summary ? (
          <section className="sk-summary" aria-label="What you jotted down">
            <h3 className="eyebrow">What you jotted down</h3>
            <PlanNotes text={sketch.summary} />
            {stale && <p className="ascent-mini sk-stale">You've drawn on it since this was written. Analyze it again to catch up.</p>}
          </section>
        ) : (
          <p className="sk-hint">Analyze reads the sketch with what it's on and sums up what you jotted down.</p>
        )}
        <div className="ascent-sheet__actions sk-view__acts">
          <button type="button" className="btn-link" onClick={onRemove}>
            Delete
          </button>
          <span className="spacer" />
          {onAddToNote && !reading && (
            <button type="button" className="btn btn--sm" onClick={onAddToNote}>
              Add to notes
            </button>
          )}
          <button type="button" className="btn btn--sm" onClick={onDraw} disabled={reading}>
            <PenTool size={14} />
            Draw on it
          </button>
          <button type="button" className="btn btn--sm btn--accent" onClick={onAnalyze} disabled={reading}>
            <Sparkles size={14} />
            {sketch.summary ? "Analyze again" : "Analyze"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
