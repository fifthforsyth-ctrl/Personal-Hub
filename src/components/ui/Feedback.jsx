import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { friendlyError } from "../../lib/errors";

// Toasts, undo and confirm, shared by every page.
//
//   const toast = useToast();
//   toast.show("Saved");
//   toast.show("Win logged", { actionLabel: "Undo", onAction: () => deleteWinLoss(id) });
//   toast.error(err, "Couldn't save that win.");
//
//   // Delete now on screen, for real in six seconds unless Undo is tapped.
//   toast.undoable({ message: "Note deleted", run: () => deleteNote(id), onUndo: () => putBack(note) });
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Delete “Alma 32”?", body: "Its highlights go too.", confirmLabel: "Delete" }))) return;
//
// An undoable action that's still waiting runs at once when another one
// starts, or when the app is hidden or closed, so nothing is ever lost by
// switching apps in the six seconds.

const FeedbackContext = createContext(null);

const UNDO_MS = 6000;
const TOAST_MS = 3200;

export function FeedbackProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [ask, setAsk] = useState(null);
  const hideTimer = useRef(null);
  const pending = useRef(null); // { run, onUndo, timer }

  const hide = useCallback(() => {
    clearTimeout(hideTimer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (message, { actionLabel, onAction, tone = "plain", duration } = {}) => {
      clearTimeout(hideTimer.current);
      const id = Math.random();
      setToast({ id, message, actionLabel, onAction, tone });
      hideTimer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), duration ?? (onAction ? UNDO_MS : TOAST_MS));
    },
    []
  );

  const error = useCallback(
    (err, fallback = "Something went wrong. Try again.") => show(friendlyError(err, fallback), { tone: "error", duration: 5000 }),
    [show]
  );

  const flush = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    clearTimeout(p.timer);
    try {
      await p.run();
    } catch (err) {
      p.onUndo?.();
      error(err, "That didn't go through, so it's back.");
    }
  }, [error]);

  const undoable = useCallback(
    ({ message, run, onUndo, actionLabel = "Undo", delay = UNDO_MS }) => {
      flush();
      const entry = { run, onUndo };
      entry.timer = setTimeout(() => {
        if (pending.current === entry) flush();
      }, delay);
      pending.current = entry;
      show(message, {
        actionLabel,
        duration: delay,
        onAction: () => {
          if (pending.current !== entry) return;
          clearTimeout(entry.timer);
          pending.current = null;
          onUndo?.();
        },
      });
    },
    [flush, show]
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setAsk({ ...opts, resolve });
      }),
    []
  );

  const answer = (yes) => {
    ask?.resolve(yes);
    setAsk(null);
  };

  return (
    <FeedbackContext.Provider value={{ show, error, undoable, hide, confirm }}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div key={toast.id} className={`toast ${toast.tone === "error" ? "toast--error" : ""}`} role="status">
            <span className="toast__message">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.onAction?.();
                  hide();
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
      {ask && <ConfirmSheet {...ask} onAnswer={answer} />}
    </FeedbackContext.Provider>
  );
}

function ConfirmSheet({ title, body, confirmLabel = "Delete", cancelLabel = "Cancel", danger = true, onAnswer }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onAnswer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnswer]);

  return (
    <div className="sheet-backdrop" onClick={() => onAnswer(false)}>
      <div className="sheet confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="confirm-sheet__title">{title}</h2>
        {body && <p className="confirm-sheet__body">{body}</p>}
        <div className="confirm-sheet__actions">
          <button ref={cancelRef} type="button" className="btn" onClick={() => onAnswer(false)}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? "btn--danger-solid" : "btn--accent"}`} onClick={() => onAnswer(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useToast needs FeedbackProvider above it.");
  return ctx;
}

export function useConfirm() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useConfirm needs FeedbackProvider above it.");
  return ctx.confirm;
}
