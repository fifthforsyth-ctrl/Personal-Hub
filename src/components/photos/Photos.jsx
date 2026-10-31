import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, Loader2, NotebookPen, Trash2, X } from "lucide-react";
import {
  addPin,
  addSectionPhoto,
  deletePin,
  deleteSectionPhoto,
  fetchPins,
  fetchRecentSketches,
  fetchSectionPhoto,
  fetchSectionPhotos,
  fetchSketch,
  signedImageUrl,
  updatePin,
  uploadSectionPicture,
} from "../../lib/api";
import { readyPhoto } from "../../lib/photo";
import { signPicture } from "../../lib/useSignedUrl";
import { pinNumbers } from "../../lib/zoom";
import { inkFrame } from "../../lib/sketch";
import { fmtShortDate, toDateStr } from "../../lib/planDates";
import { useLoad } from "../../lib/useLoad";
import { haptic } from "../../lib/haptics";
import { useConfirm, useToast } from "../ui/Feedback";
import Sheet from "../ascent/Sheet";
import { AddStep } from "../camp/Steps";
import { SketchImage } from "../sketch/Sketches";
import { PhotoCtx, usePhotos } from "./context";
export { PhotoButton, PinTag, SectionPhotos, ShowPin } from "./Bits";
import Viewer from "./Viewer";
import "../../styles/photos.css";

// Photos on sections, and pins on photos and sketches (0096, Aaron
// 2026-10-30): "allow me to add photos to sections", "allow me to use a
// recent sketch as a photo", "allow me to add pins to any image and
// sketch. There I can add notes and tasks. When I add a task to a pin it
// shows up in the same section the image is from."
//
// A page wraps everything in a PhotoProvider. A section shows its photos
// small (SectionPhotos) and has a button to add one (PhotoButton); tapping
// one opens it up close (Viewer), where pins go on it, each with a note and
// tasks. A pin's tasks are the page's own steps (or a quest's lines), in
// the section the picture belongs to, so the page says what they are and
// makes them:
//
//   <PhotoProvider userId sectionIds
//     tasksOf={(pinId) => rows}            the steps and lines made on a pin
//     place={({ photo } | { sketch }) => "UI changes" | null}
//                                          where its tasks go (null: they can't, from here)
//     addTasks={({ pin, photo, sketch }, texts) => Promise<boolean>}
//     tick={(row) => …}                    ticks one
//     side="Clipboard"                     offers the page's clipboard beside a picture up close
//     attach={({ photo } | { sketch }, pin, ids) => { undo, moved } | null}
//                                          steps dropped on a pin: they wear it (and go
//                                          where its tasks go, `moved`); `undo()` puts them back
//     handle={ref}>                        ref.current.dropOnPicture(phase, x, y, ids), for the page's drags
//
// A step made on a pin wears a PinTag and, open, a ShowPin button that
// opens its picture on that pin.
//
// Steps dropped on a picture (Aaron, 2026-10-30: "when I drag and drop a
// task onto the image it creates a pin in that spot") are pinned there: on
// a pin already there, or on a new one. That's the picture up close, with
// the clipboard beside it (<PhotoSide>, which the page puts its clipboard
// in), or a picture on a row (0098) on the page. The page's own drag hands
// each move to `handle.current.dropOnPicture`, which says whether it's over
// a picture (true: it lights the spot, and on "drop" pins them).

export { usePhotos };

const byOrder = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));

const SIDE_KEY = "hub:iv-side";

function readSide() {
  try {
    return localStorage.getItem(SIDE_KEY) === "1";
  } catch {
    return false;
  }
}

// The page's clipboard (its children), in the box beside a picture up close
// while it's showing there.
export function PhotoSide({ children }) {
  const ph = usePhotos();
  return ph?.sideEl ? createPortal(children, ph.sideEl) : null;
}

// Where a step carried to (x, y) would be pinned (see the top). Over the
// picture up close: on one of its pins, at a spot on it, or `off` it (its
// dark surround, where nothing lands); over the rest of the viewer, `none`
// unless it's a box the step can go into there (null: the page's own drop).
// With the page showing: a picture on a row, the same way. `skip` is the
// rows being carried, whose own pictures don't count.
function spotAt(x, y, skip) {
  const within = (el) => {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  const on = (el, page, target) => {
    const pin = [...el.querySelectorAll("[data-pin]")].find(within);
    if (pin) return { el, target, pinEl: pin, pinId: pin.dataset.pin };
    const r = page?.getBoundingClientRect();
    const fx = r?.width ? (x - r.left) / r.width : -1;
    const fy = r?.height ? (y - r.top) / r.height : -1;
    if (!(fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1)) return { el, target, off: true };
    const box = el.getBoundingClientRect();
    return { el, target, x: fx, y: fy, at: { x: x - box.left, y: y - box.top } };
  };
  const viewer = document.querySelector(".iv");
  const under = document.elementsFromPoint(x, y).filter((e) => !e.classList.contains("drag-ghost") && !(skip && e.closest(skip)));
  if (viewer) {
    const stage = viewer.querySelector(".iv-stage");
    if (stage && within(stage)) return on(stage, stage.querySelector(".iv-page"), null);
    const top = under[0];
    return top && viewer.contains(top) && top.closest("[data-drop]") ? null : { none: true };
  }
  const pic = under.map((e) => e.closest("[data-pin-sketch]")).find(Boolean);
  if (!pic) return null;
  const sketch = { id: pic.dataset.pinSketch, camp_step_id: pic.dataset.pinStep || null, quest_task_id: pic.dataset.pinLine || null };
  return on(pic, pic.querySelector("img"), { sketch });
}

// Lights where it would go: the pin it would join, or a pin's shadow at the spot.
let lit = null;
function markSpot(hit) {
  const el = hit && !hit.none ? hit.el : null;
  if (lit && lit !== el) {
    lit.classList.remove("pin-drop");
    lit.querySelector(".drop-mark")?.classList.remove("show");
  }
  document.querySelectorAll(".pin-into").forEach((e) => e !== hit?.pinEl && e.classList.remove("pin-into"));
  // what's carried fades, so the picture under it shows
  document.documentElement.classList.toggle("pin-dropping", Boolean(el && !hit.off));
  lit = el;
  if (!el) return;
  el.classList.toggle("pin-drop", !hit.off);
  hit.pinEl?.classList.add("pin-into");
  const mark = el.querySelector(".drop-mark");
  if (!mark) return;
  const show = !hit.off && !hit.pinEl;
  mark.classList.toggle("show", show);
  if (show) mark.style.transform = `translate3d(${hit.at.x}px, ${hit.at.y}px, 0)`;
}

export function PhotoProvider({ userId, sectionIds = [], tasksOf, place, addTasks, tick, side = null, attach, handle, children }) {
  const toast = useToast();
  const confirm = useConfirm();
  const ids = [...new Set(sectionIds.filter(Boolean))].sort();
  const idsKey = ids.join(",");
  const photos = useLoad(() => (userId && ids.length ? fetchSectionPhotos(userId, ids) : []), [userId, idsKey]);
  const pins = useLoad(() => (userId ? fetchPins(userId) : []), [userId]);
  const [urls, setUrls] = useState({}); // image_path → a URL to show it
  const [adding, setAdding] = useState(null); // { sectionId, title }
  const [look, setLook] = useState(null); // { photo } | { sketch, about }, with { pin, focus }
  const [pinning, setPinning] = useState(false);
  const [sideOn, setSideOn] = useState(readSide);
  const [sideEl, setSideEl] = useState(null); // the box beside a picture up close

  const photoList = photos.data ?? [];
  const pinList = pins.data ?? [];

  // A short-lived link to each photo's picture, once.
  const asked = useRef(new Set());
  useEffect(() => {
    for (const p of photoList) {
      const path = p.image_path;
      if (!path || asked.current.has(path)) continue;
      asked.current.add(path);
      signedImageUrl(path, 6 * 3600).then((url) => url && setUrls((u) => (u[path] ? u : { ...u, [path]: url })));
    }
  }, [photoList]);

  const bySection = useMemo(() => {
    const m = new Map();
    for (const p of [...photoList].sort(byOrder)) {
      if (!m.has(p.section_id)) m.set(p.section_id, []);
      m.get(p.section_id).push(p);
    }
    return m;
  }, [photoList]);

  const pinsOn = (target) => pinList.filter((p) => (target.photo ? p.photo_id === target.photo.id : p.sketch_id === target.sketch?.id));
  const numbers = useMemo(() => {
    const m = new Map();
    const groups = new Map();
    for (const p of pinList) {
      const k = p.photo_id ?? p.sketch_id;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    for (const g of groups.values()) for (const [id, n] of pinNumbers(g)) m.set(id, n);
    return m;
  }, [pinList]);

  // --- Adding photos ------------------------------------------------------------

  async function addFiles(files) {
    const { sectionId } = adding;
    const start = (bySection.get(sectionId) ?? []).reduce((m, p) => Math.max(m, (p.position ?? 0) + 1), 0);
    let made = 0;
    for (const [i, file] of [...files].entries()) {
      try {
        const ready = await readyPhoto(file);
        const path = await uploadSectionPicture(userId, ready.blob, ready.extension);
        const row = await addSectionPhoto(userId, { section_id: sectionId, image_path: path, width: ready.width, height: ready.height, position: start + i });
        setUrls((u) => ({ ...u, [path]: URL.createObjectURL(ready.blob) }));
        asked.current.add(path);
        photos.mutate((l) => [...(l ?? []), row]);
        made++;
      } catch (err) {
        toast.error(err, files.length > 1 ? `Couldn't add ${file.name || "one of them"}.` : "Couldn't add that photo.");
      }
    }
    if (made) {
      haptic("tap");
      setAdding(null);
    }
  }

  async function addSketchPhoto(sketch) {
    const { sectionId, title } = adding;
    const position = (bySection.get(sectionId) ?? []).reduce((m, p) => Math.max(m, (p.position ?? 0) + 1), 0);
    try {
      const row = await addSectionPhoto(userId, {
        section_id: sectionId,
        sketch: { width: sketch.width, height: sketch.height, strokes: sketch.strokes ?? [] },
        sketch_id: sketch.id,
        width: sketch.width,
        height: sketch.height,
        caption: sketch.title ?? null,
        position,
      });
      photos.mutate((l) => [...(l ?? []), row]);
      haptic("tap");
      setAdding(null);
      toast.show(`Sketch added to ${title}`);
    } catch (err) {
      toast.error(err, "Couldn't add that sketch.");
    }
  }

  async function removePhoto(photo) {
    const n = pinsOn({ photo }).length;
    const ok = await confirm({
      title: "Remove this photo?",
      body: n ? `Its ${n === 1 ? "pin goes" : `${n} pins go`} with it. Tasks made on them stay where they are.` : undefined,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setLook(null);
    photos.mutate((l) => (l ?? []).filter((p) => p.id !== photo.id));
    pins.mutate((l) => (l ?? []).filter((p) => p.photo_id !== photo.id));
    try {
      await deleteSectionPhoto(photo);
    } catch (err) {
      toast.error(err, "Couldn't remove that photo.");
      photos.reload();
      pins.reload();
    }
  }

  // --- Pins -----------------------------------------------------------------------

  async function putPin(x, y) {
    const target = look;
    try {
      const row = await addPin(userId, { ...(target.photo ? { photo_id: target.photo.id } : { sketch_id: target.sketch.id }), x, y });
      pins.mutate((l) => [...(l ?? []), row]);
      haptic("tap");
      setPinning(false);
      setLook((l) => l && { ...l, pin: row.id });
    } catch (err) {
      toast.error(err, "Couldn't put a pin there.");
    }
  }

  function saveNote(pin, note) {
    pins.mutate((l) => (l ?? []).map((p) => (p.id === pin.id ? { ...p, note } : p)));
    updatePin(pin.id, { note }).catch((err) => {
      toast.error(err, "Couldn't save that note.");
      pins.reload();
    });
  }

  async function removePin(pin) {
    const n = tasksOf?.(pin.id)?.length ?? 0;
    const ok = await confirm({
      title: `Remove pin ${numbers.get(pin.id) ?? ""}?`.replace(" ?", "?"),
      body: n ? `Its ${n === 1 ? "task stays" : `${n} tasks stay`} where ${n === 1 ? "it is" : "they are"}.` : pin.note ? "Its note goes with it." : undefined,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setLook((l) => l && { ...l, pin: null });
    pins.mutate((l) => (l ?? []).filter((p) => p.id !== pin.id));
    try {
      await deletePin(pin.id);
    } catch (err) {
      toast.error(err, "Couldn't remove that pin.");
      pins.reload();
    }
  }

  // Steps let go on a picture (`hit` from spotAt): on its pin there, or on
  // a new one at that spot, with Undo (which takes a new pin off again).
  async function dropSteps(hit, ids) {
    const target = hit.target ?? (look?.photo ? { photo: look.photo } : look ? { sketch: look.sketch } : null);
    if (!target || !attach) return;
    let pin = hit.pinId ? pinList.find((p) => p.id === hit.pinId) : null;
    const made = !pin;
    if (made) {
      try {
        pin = await addPin(userId, { ...(target.photo ? { photo_id: target.photo.id } : { sketch_id: target.sketch.id }), x: hit.x, y: hit.y });
      } catch (err) {
        toast.error(err, "Couldn't put a pin there.");
        return;
      }
      pins.mutate((l) => [...(l ?? []), pin]);
    }
    const n = pinNumbers([...pinsOn(target).filter((p) => p.id !== pin.id), pin]).get(pin.id);
    const takeOff = () => {
      pins.mutate((l) => (l ?? []).filter((p) => p.id !== pin.id));
      setLook((l) => (l && l.pin === pin.id ? { ...l, pin: null } : l));
      return deletePin(pin.id).catch((err) => {
        toast.error(err, "Couldn't take that pin off.");
        pins.reload();
      });
    };
    const done = attach(target, pin, ids);
    if (!done) {
      if (made) takeOff();
      toast.show(ids.length === 1 ? `It's on pin ${n} already.` : `They're on pin ${n} already.`);
      return;
    }
    haptic("tap");
    const where = done.moved && place ? place(target) : null;
    toast.show(`${ids.length === 1 ? "Pinned" : `${ids.length} pinned`} to pin ${n}${where ? `, in ${where}` : ""}`, {
      actionLabel: "Undo",
      onAction: async () => {
        await done.undo();
        if (made) takeOff();
      },
    });
  }

  function dropOnPicture(phase, x, y, ids) {
    const hit = phase === "move" || phase === "drop" ? spotAt(x, y, ids.map((k) => `#step-${k}`).join(", ")) : null;
    markSpot(phase === "move" ? hit : null);
    if (!hit) return false;
    if (phase === "drop" && !hit.none && !hit.off) dropSteps(hit, ids);
    return true;
  }
  if (handle) handle.current = { dropOnPicture };

  // A step's pin, from the step: its picture, up close on it.
  async function openPin(pinId) {
    const pin = pinList.find((p) => p.id === pinId);
    if (!pin) return;
    try {
      if (pin.photo_id) {
        const photo = photoList.find((p) => p.id === pin.photo_id) ?? (await fetchSectionPhoto(pin.photo_id));
        if (!photo) throw new Error("That photo is gone.");
        if (photo.image_path && !urls[photo.image_path]) {
          const url = await signedImageUrl(photo.image_path, 6 * 3600);
          if (url) setUrls((u) => ({ ...u, [photo.image_path]: url }));
        }
        setPinning(false);
        setLook({ photo, pin: pin.id, focus: { x: pin.x, y: pin.y } });
      } else {
        const sketch = await fetchSketch(pin.sketch_id);
        if (!sketch) throw new Error("That sketch is gone.");
        const src = sketch.image_path ? await signPicture(sketch.image_path) : null;
        setPinning(false);
        setLook({ sketch, src, pin: pin.id, focus: { x: pin.x, y: pin.y } });
      }
    } catch (err) {
      toast.error(err, "Couldn't open its pin.");
    }
  }

  const ctx = {
    photosOf: (sectionId) => bySection.get(sectionId) ?? [],
    urlOf: (photo) => (photo.image_path ? urls[photo.image_path] ?? null : null),
    add: (sectionId, title) => setAdding({ sectionId, title }),
    open: (photo) => {
      setPinning(false);
      setLook({ photo, pin: null });
    },
    // A sketch, or a picture pasted on a row (0098), which can be deleted
    // from here (`onRemove` resolves true once it's gone).
    openSketch: async (sketch, about, { onRemove = null } = {}) => {
      const src = sketch.image_path ? await signPicture(sketch.image_path) : null;
      setPinning(false);
      setLook({ sketch, about, src, onRemove, pin: null });
    },
    openPin,
    pinLabel: (pinId) => (numbers.has(pinId) ? `Pin ${numbers.get(pinId)}` : null),
    // A picture's pins, numbered, with their tasks and how many.
    pinsOf: (target) =>
      pinsOn(target).map((p) => {
        const tasks = tasksOf?.(p.id) ?? [];
        return { ...p, n: numbers.get(p.id) ?? 0, count: tasks.length, tasks };
      }),
    // pictures on rows take steps dropped on them only where they can be pinned
    drops: Boolean(attach),
    sideEl,
  };

  // What's open up close.
  let viewer = null;
  if (look) {
    const target = look.photo ? { photo: look.photo } : { sketch: look.sketch };
    const here = pinsOn(target).map((p) => ({ ...p, n: numbers.get(p.id) ?? 0, count: tasksOf?.(p.id)?.length ?? 0 }));
    const open = here.find((p) => p.id === look.pin) ?? null;
    const where = place ? place(target) : null;
    const picture = !look.photo && Boolean(look.sketch.image_path);
    const what = picture ? "Picture" : "Sketch";
    const title = look.photo ? look.photo.caption || "Photo" : look.sketch.title || (look.about ? `${what} on “${short(look.about)}”` : what);
    viewer = (
      <Viewer
        key={look.photo?.id ?? look.sketch.id}
        title={title}
        src={look.photo ? ctx.urlOf(look.photo) : picture ? look.src ?? null : null}
        sketch={look.photo ? look.photo.sketch : picture ? null : look.sketch}
        width={look.photo ? look.photo.width ?? null : picture ? look.sketch.width : null}
        height={look.photo ? look.photo.height ?? null : picture ? look.sketch.height : null}
        pins={here}
        openPin={open?.id ?? null}
        pinning={pinning}
        onPinning={(on) => {
          setPinning(on);
          if (on) setLook((l) => ({ ...l, pin: null }));
        }}
        onPlace={putPin}
        onPin={(id) => setLook((l) => ({ ...l, pin: id }))}
        focus={look.focus}
        side={side}
        sideOn={sideOn}
        onSide={(on) => {
          setSideOn(on);
          try {
            localStorage.setItem(SIDE_KEY, on ? "1" : "0");
          } catch {
            /* remembering is a nicety */
          }
        }}
        sideRef={setSideEl}
        tools={
          look.photo ? (
            <button type="button" className="iv-btn" onClick={() => removePhoto(look.photo)} aria-label="Remove this photo" title="Remove this photo">
              <Trash2 size={16} />
            </button>
          ) : look.onRemove ? (
            <button
              type="button"
              className="iv-btn"
              onClick={async () => {
                if (await look.onRemove()) setLook(null);
              }}
              aria-label="Delete this picture"
              title="Delete this picture"
            >
              <Trash2 size={16} />
            </button>
          ) : null
        }
        panel={
          open ? (
            <PinPanel
              key={open.id}
              pin={open}
              tasks={tasksOf?.(open.id) ?? []}
              where={where}
              onNote={(note) => saveNote(open, note)}
              onAdd={addTasks && where ? (texts) => addTasks({ pin: open, ...target }, texts) : null}
              onTick={tick}
              onRemove={() => removePin(open)}
              onClose={() => setLook((l) => ({ ...l, pin: null }))}
            />
          ) : null
        }
        onClose={() => {
          setPinning(false);
          setLook(null);
        }}
      />
    );
  }

  return (
    <PhotoCtx.Provider value={ctx}>
      {children}
      {adding && <AddPhotoSheet userId={userId} title={adding.title} onFiles={addFiles} onSketch={addSketchPhoto} onClose={() => setAdding(null)} />}
      {viewer}
    </PhotoCtx.Provider>
  );
}

const short = (t) => {
  const s = String(t ?? "");
  return s.length > 40 ? `${s.slice(0, 40).trimEnd()}…` : s;
};

// A photo taken or chosen, or one of his latest sketches.
function AddPhotoSheet({ userId, title, onFiles, onSketch, onClose }) {
  const recent = useLoad(() => fetchRecentSketches(userId, 12), [userId]);
  const [busy, setBusy] = useState(0);
  return (
    <Sheet title={`A photo for ${title}`} onClose={onClose}>
      <div className="ph-add-sheet">
        <label className={"btn btn--accent ph-pick" + (busy ? " busy" : "")}>
          {busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
          {busy ? (busy > 1 ? `Adding ${busy} photos…` : "Adding it…") : "Take or choose a photo"}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={busy > 0}
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (!files.length) return;
              setBusy(files.length);
              await onFiles(files);
              setBusy(0);
            }}
          />
        </label>
        <p className="eyebrow">Or one of your sketches</p>
        {recent.loading ? (
          <p className="ascent-mini">Finding your sketches…</p>
        ) : !(recent.data ?? []).length ? (
          <p className="ascent-mini">No sketches yet. Draw one on any step with Sketch.</p>
        ) : (
          <div className="ph-recent">
            {recent.data.map((k) => (
              <RecentSketch key={k.id} sketch={k} onPick={() => onSketch(k)} />
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function RecentSketch({ sketch, onPick }) {
  const frame = useMemo(() => inkFrame(sketch), [sketch]);
  const f = frame ?? sketch;
  return (
    <button type="button" className="ph-recent__one" onClick={onPick}>
      <span className="ph-recent__img" style={{ aspectRatio: String(Math.min(2, Math.max(0.6, f.width / f.height))) }}>
        <SketchImage sketch={sketch} frame={frame} pad={3} minPx={1.2} />
      </span>
      <small>{sketch.title || fmtShortDate(toDateStr(new Date(sketch.updated_at ?? sketch.created_at)))}</small>
    </button>
  );
}

// An open pin: its note, its tasks (in the picture's section), and taking it off.
function PinPanel({ pin, tasks, where, onNote, onAdd, onTick, onRemove, onClose }) {
  const [note, setNote] = useState(pin.note ?? "");
  const saved = useRef(pin.note ?? "");
  const latest = useRef(note);
  latest.current = note;
  const save = () => {
    const n = latest.current.trim() || null;
    if (n !== (saved.current || null)) {
      saved.current = n ?? "";
      onNote(n);
    }
  };
  // what was typed is kept when the panel closes, too
  useEffect(() => () => save(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="iv-pinp">
      <div className="iv-pinp__head">
        <span className="iv-pinp__n" aria-hidden="true">
          {pin.n}
        </span>
        <h3>Pin {pin.n}</h3>
        <span className="spacer" />
        <button type="button" className="iv-btn" onClick={onClose} aria-label="Close this pin" title="Close">
          <X size={16} />
        </button>
      </div>
      <label className="field">
        <span>Note</span>
        <textarea className="textarea" rows={3} value={note} maxLength={4000} placeholder="What's here…" onChange={(e) => setNote(e.target.value)} onBlur={save} />
      </label>
      <div className="iv-pinp__tasks">
        <p className="eyebrow">{where ? `Tasks · in ${where}` : "Tasks"}</p>
        {tasks.length > 0 && (
          <ul>
            {tasks.map((t) => (
              <li key={t.id} className={t.done_on ? "done" : ""}>
                {t.kind === "note" ? (
                  <span className="qs-pen" aria-hidden="true">
                    <NotebookPen size={13} />
                  </span>
                ) : (
                  <button type="button" className="camp-check" role="checkbox" aria-checked={Boolean(t.done_on)} aria-label={t.done_on ? "Done. Tap to open it again" : "Mark done"} onClick={() => onTick?.(t)}>
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  </button>
                )}
                <span className="iv-pinp__text">{t.text}</span>
              </li>
            ))}
          </ul>
        )}
        {onAdd ? <AddStep label="Add a task to this pin" onAdd={onAdd} /> : <p className="ascent-mini">Its tasks can be added where its picture is.</p>}
      </div>
      <div className="iv-pinp__acts">
        <button type="button" className="btn-link btn-link--danger" onClick={onRemove}>
          Remove pin
        </button>
      </div>
    </div>
  );
}
