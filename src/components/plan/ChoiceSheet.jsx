import { useCallback, useEffect, useId, useRef, useState } from "react";

// A confirm sheet with more than one way forward ("Replace the day" / "Add
// on top" / Cancel). Same look as the shared confirm; the shared one only
// answers yes or no.
//
//   const [choose, choiceSheet] = useChoiceSheet();
//   const pick = await choose({ title, body, options: [{ value: "replace", label: "Replace the day", danger: true }, …] });
//   …render {choiceSheet} somewhere; pick is the option's value, or null for Cancel.
export function useChoiceSheet() {
  const [ask, setAsk] = useState(null);

  const choose = useCallback((opts) => new Promise((resolve) => setAsk({ ...opts, resolve })), []);

  const answer = useCallback(
    (value) => {
      ask?.resolve(value);
      setAsk(null);
    },
    [ask]
  );

  const sheet = ask ? <ChoiceSheet title={ask.title} body={ask.body} options={ask.options} onAnswer={answer} /> : null;
  return [choose, sheet];
}

function ChoiceSheet({ title, body, options, onAnswer }) {
  const cancelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onAnswer(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnswer]);

  return (
    <div className="sheet-backdrop" onClick={() => onAnswer(null)}>
      <div className="sheet confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className="confirm-sheet__title">{title}</h2>
        {body && <div className="confirm-sheet__body">{body}</div>}
        {/* Listed first so a phone stacks them top-down with Cancel last;
            on a desk the row reverses, putting Cancel on the left. */}
        <div className="choice-sheet__actions">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`btn ${o.danger ? "btn--danger-solid" : o.primary ? "btn--accent" : ""}`}
              onClick={() => onAnswer(o.value)}
            >
              {o.label}
            </button>
          ))}
          <button ref={cancelRef} type="button" className="btn" onClick={() => onAnswer(null)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
