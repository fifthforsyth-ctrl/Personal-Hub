import { useMemo } from "react";
import { ImagePlus, MapPin } from "lucide-react";
import { inkFrame } from "../../lib/sketch";
import { SketchImage } from "../sketch/Sketches";
import { usePhotos } from "./context";
import PinDots from "./PinDots";

// The small pieces of photos and pins (0096) that rows and sections wear,
// read from the page's PhotoProvider (Photos.jsx). Without one they show
// nothing.

// A section's photos, small, in a row.
export function SectionPhotos({ sectionId }) {
  const ph = usePhotos();
  const list = ph?.photosOf(sectionId) ?? [];
  if (!list.length) return null;
  return (
    <div className="ph-strip">
      {list.map((p) => (
        <PhotoThumb key={p.id} photo={p} url={ph.urlOf(p)} pins={ph.pinsOf({ photo: p })} onOpen={() => ph.open(p)} />
      ))}
    </div>
  );
}

function PhotoThumb({ photo, url, pins, onOpen }) {
  const sketch = photo.sketch;
  const frame = useMemo(() => (sketch ? inkFrame(sketch) : null), [sketch]);
  const f = sketch ? frame ?? sketch : photo.width && photo.height ? { width: photo.width, height: photo.height } : { width: 4, height: 3 };
  const ratio = Math.min(2.2, Math.max(0.5, f.width / f.height));
  // its pins where they fall on it: a sketch fitted in whole, a photo cut to fill
  const fit = sketch ? { w: sketch.width, h: sketch.height, frame, pad: 3 } : { w: photo.width ?? 4, h: photo.height ?? 3, cover: true };
  return (
    <button type="button" className={"ph-thumb" + (sketch ? " ph-thumb--sketch" : "")} style={{ aspectRatio: String(ratio) }} onClick={onOpen} aria-label={photo.caption ? `Open ${photo.caption}` : sketch ? "Open sketch" : "Open photo"}>
      {sketch ? <SketchImage sketch={sketch} frame={frame} pad={3} minPx={1.2} /> : url ? <img src={url} alt="" loading="lazy" draggable={false} /> : <span className="ph-thumb__wait" />}
      {pins.length > 0 && (sketch || (url && photo.width && photo.height)) && <PinDots pins={pins} fit={fit} small />}
      {pins.length > 0 && (
        <span className="ph-thumb__pins">
          <MapPin size={10} aria-hidden="true" />
          {pins.length}
        </span>
      )}
    </button>
  );
}

// "Add a photo", beside a section's box for new steps.
export function PhotoButton({ sectionId, title }) {
  const ph = usePhotos();
  if (!ph || !sectionId) return null;
  return (
    <button type="button" className="btn-icon ph-add" onClick={() => ph.add(sectionId, title)} aria-label={`Add a photo to ${title}`} title="Add a photo or a sketch">
      <ImagePlus size={16} />
    </button>
  );
}

// On a step made on a pin: which pin, and (open) a way back to it.
export function PinTag({ pinId }) {
  const ph = usePhotos();
  const label = pinId && ph?.pinLabel(pinId);
  if (!label) return null;
  return (
    <span className="pin-tag">
      <MapPin size={10} aria-hidden="true" />
      {label}
    </span>
  );
}

export function ShowPin({ pinId }) {
  const ph = usePhotos();
  const label = pinId && ph?.pinLabel(pinId);
  if (!label) return null;
  return (
    <button type="button" className="btn btn--sm ph-show" onClick={() => ph.openPin(pinId)}>
      <MapPin size={14} aria-hidden="true" />
      Show {label.toLowerCase()}
    </button>
  );
}
