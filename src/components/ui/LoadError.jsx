import { RotateCw } from "lucide-react";
import { friendlyError } from "../../lib/errors";

// The one way a page or card says it couldn't load: what didn't load, why in
// plain words, and a way to try again. Inline, never an alert().
//
//   <LoadError what="today" error={error} onRetry={reload} />
//
// With `stale`, it's the quieter line for when older data is still showing.
export default function LoadError({ what = "this", error, onRetry, stale = false, className = "" }) {
  const why = friendlyError(error, "");
  return (
    <div className={`load-error ${stale ? "load-error--stale" : ""} ${className}`} role="alert">
      <span>
        {stale ? "Showing what was here a moment ago." : `Couldn't load ${what}.`}
        {why && <span className="load-error__why"> {why}</span>}
      </span>
      {onRetry && (
        <button type="button" className="btn btn--sm" onClick={onRetry}>
          <RotateCw size={13} />
          Try again
        </button>
      )}
    </div>
  );
}
