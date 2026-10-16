import { useState } from "react";
import { Link } from "react-router-dom";
import { ScanEye, ArrowRight, X } from "lucide-react";
import { mirrorSeen, markMirrorSeen } from "../lib/mirror";
import "../styles/mirror.css";

// Sunday's way into the weekly mirror.
//
// On Today it's one quiet line that goes once last week has been looked at,
// or when you put it away until next Sunday. At the top of Week it stays,
// just above the focus review, since that's where the week gets planned.
export default function MirrorLink({ weekStart, closable = false, className = "" }) {
  const [hidden, setHidden] = useState(() => closable && mirrorSeen(weekStart));
  if (hidden) return null;

  return (
    <div className={`mirror-link${closable ? " mirror-link--close" : ""} ${className}`}>
      <Link to="/mirror" className="mirror-link__go">
        <ScanEye size={16} />
        <span className="mirror-link__text">
          <span className="mirror-link__title">Weekly mirror</span>
          <span className="mirror-link__sub">Last week, seen clearly</span>
        </span>
        <ArrowRight size={15} />
      </Link>
      {closable && (
        <button
          type="button"
          className="btn-icon mirror-link__close"
          aria-label="Hide until next Sunday"
          title="Hide until next Sunday"
          onClick={() => {
            markMirrorSeen(weekStart);
            setHidden(true);
          }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
