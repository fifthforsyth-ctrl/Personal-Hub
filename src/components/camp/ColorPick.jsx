import { Check } from "lucide-react";

// Colours a step or a quest line can wear (0088): the row takes a soft wash
// of it and its box a ring in it. The database takes any short lowercase
// name, so a colour added here needs nothing else ("none", which no colour
// here is, keeps a step plain in a section with a colour).
export const STEP_COLORS = [
  { key: "red", label: "Red", hex: "#d64541" },
  { key: "orange", label: "Orange", hex: "#f26a1b" },
  { key: "yellow", label: "Yellow", hex: "#e2a72e" },
  { key: "green", label: "Green", hex: "#3d9a5b" },
  { key: "teal", label: "Teal", hex: "#23948c" },
  { key: "blue", label: "Blue", hex: "#3b6fd8" },
  { key: "purple", label: "Purple", hex: "#8a55c9" },
  { key: "slate", label: "Slate", hex: "#5d6470" },
];
const HEX = Object.fromEntries(STEP_COLORS.map((c) => [c.key, c.hex]));

// The class and style a row needs to wear its colour (none when it has none,
// or one this palette doesn't know).
export function tintOf(color) {
  const hex = color ? HEX[color] : null;
  return hex ? { className: " tinted", style: { "--tint": hex } } : { className: "", style: undefined };
}

// "Color": a row of swatches, the first taking the colour off. Tapping the
// one it has takes it off too. With `inherited` ({ color, from }: the colour
// a step takes on from its section, or the step it's under), the first is
// that one, "Same as its section", and "No color" (stored as "none") comes
// next, for one that should have none even there.
export function ColorPick({ value, inherited = null, onChange }) {
  const from = inherited && HEX[inherited.color] ? inherited : null;
  const own = !from && value === "none" ? null : value;
  const same = from ? STEP_COLORS.find((c) => c.key === from.color) : null;
  return (
    <div className={"field camp-color-pick" + (from ? " camp-color-pick--same" : "")} role="radiogroup" aria-label="Color">
      <span>
        Color
        {from && !own && <small className="camp-color-pick__from"> · same as its {from.from}</small>}
      </span>
      <div className="camp-color-pick__opts">
        {from && (
          <button
            type="button"
            role="radio"
            aria-checked={!own}
            className={"camp-swatch camp-swatch--same" + (!own ? " on" : "")}
            style={{ "--swatch": same.hex }}
            title={`Same as its ${from.from} (${same.label})`}
            aria-label={`Same as its ${from.from}`}
            onClick={() => onChange(null)}
          >
            {!own && <Check size={14} strokeWidth={3} aria-hidden="true" />}
          </button>
        )}
        <button
          type="button"
          role="radio"
          aria-checked={from ? own === "none" : !own}
          className={"camp-swatch camp-swatch--none" + ((from ? own === "none" : !own) ? " on" : "")}
          title="No color"
          aria-label="No color"
          onClick={() => onChange(from ? (own === "none" ? null : "none") : null)}
        />
        {STEP_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={own === c.key}
            className={"camp-swatch" + (own === c.key ? " on" : "")}
            style={{ "--swatch": c.hex }}
            title={c.label}
            aria-label={c.label}
            onClick={() => onChange(own === c.key ? null : c.key)}
          >
            {own === c.key && <Check size={14} strokeWidth={3} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
