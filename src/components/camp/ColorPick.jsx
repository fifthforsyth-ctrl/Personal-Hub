import { Check } from "lucide-react";

// Colours a step or a quest line can wear (0088): the row takes a soft wash
// of it and its box a ring in it. The database takes any short lowercase
// name, so a colour added here needs nothing else.
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
// one it has takes it off too.
export function ColorPick({ value, onChange }) {
  return (
    <div className="field camp-color-pick" role="radiogroup" aria-label="Color">
      <span>Color</span>
      <div className="camp-color-pick__opts">
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          className={"camp-swatch camp-swatch--none" + (!value ? " on" : "")}
          title="No color"
          aria-label="No color"
          onClick={() => onChange(null)}
        />
        {STEP_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={value === c.key}
            className={"camp-swatch" + (value === c.key ? " on" : "")}
            style={{ "--swatch": c.hex }}
            title={c.label}
            aria-label={c.label}
            onClick={() => onChange(value === c.key ? null : c.key)}
          >
            {value === c.key && <Check size={14} strokeWidth={3} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
