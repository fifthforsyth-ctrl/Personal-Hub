import { Moon } from "lucide-react";
import "../../styles/honest.css";

// Going to bed: stops whatever is running and starts Sleep, so the morning
// knows when the lights went out without being told.
export default function BedButton({ onClick, busy }) {
  return (
    <button type="button" className="btn btn--block bed-btn" onClick={onClick} disabled={busy}>
      <Moon size={14} />
      Going to bed
    </button>
  );
}
