import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { windDown, fmtClock, isSleep, MORNING_FROM_HOUR } from "../../lib/honest";
import { timeOf } from "./minutes";
import "../../styles/honest.css";

// One quiet line on Today as the evening comes: when the lights should go
// out for tomorrow's alarm (set in the evening check-in). It shows from
// forty-five minutes before then, and not once Sleep is running. Past
// midnight "tomorrow" has become today, so until three it reads today's.
export default function WindDown({ date, tomorrow, todayAlarm, tomorrowAlarm, running }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const sleeping = Boolean(running && isSleep(running));
  const line =
    windDown({ tomorrow, alarm: tomorrowAlarm, now, sleeping }) ??
    (now.getHours() < MORNING_FROM_HOUR ? windDown({ tomorrow: date, alarm: todayAlarm, now, sleeping }) : null);
  if (!line) return null;
  return (
    <div className="morning-summary wind-down">
      <Moon size={14} className="morning-summary__mark" />
      <span className="morning-summary__text">
        Lights out at {timeOf(line.lightsOut.toISOString())} for your {fmtClock(line.alarm)} alarm.
      </span>
    </div>
  );
}
