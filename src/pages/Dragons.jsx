import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buyEgg, fetchDragons, keepHatches, nameDragon, trainDragon } from "../lib/api";
import { HATCH_DAYS, STAGES, TRAINING, dragonsOf, hatchLine, hatcheryDay, kindOf, paintDragons, stageLine, winsLine } from "../lib/dragons";
import { CATALOG, villageOf } from "../lib/village";
import { todayStr } from "../lib/planDates";
import { countLine } from "../lib/questTasks";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import { rememberDragons } from "../village/Painting";
import "../styles/dragons.css";

// Dragons: tasks build the village; wins raise the dragons. Every win he
// logs puts one in the purse (it started with 100), and here he spends them:
// on eggs, which warm in the hatchery a banked day at a time and hatch on
// the third, and on training the dragons that hatch, a stage at a time
// (fledgling, flier, rider's dragon). He names each one himself.
//
// The rules and the numbers are src/lib/dragons.js; the server keeps the
// prices too and checks every spend (dragon_buy, dragon_train in 0087).
// Spending asks first, in place: one tap opens "Buy a dawn egg for 70?",
// and Yes spends. Nothing here counts down, nags or goes away.

// The stages a hatched dragon goes through, for its four pips.
const GROWN = ["hatchling", "fledgling", "flier", "rider"];
const STAGE_NAME = new Map(STAGES.map((s) => [s.stage, s.name]));
const BECOMES = { fledgling: "a fledgling", flier: "a flier", rider: "a rider's dragon" };

// The sketch's promises, word for word.
const CALM = [
  { title: "Losses cost nothing", line: "A loss never takes a win out of the purse." },
  { title: "Nothing is ever lost", line: "Dragons never go hungry, fall sick or fly away. Miss a week and they are all still there." },
  { title: "No countdowns", line: "No timers, reminders or streaks. The purse just waits until you want something." },
  {
    title: "Room for them",
    line: "The stables hold four dragons, the training ring four, the flight tower two and the citadel six, so there is always room for the next egg.",
  },
];

const portrait = (d) => `/village/dragons/${d.kind}-${d.stage}.jpg`;
const eggPicture = (kind) => `/village/dragons/${kind}-egg.jpg`;
const kindName = (kind) => kindOf(kind).name;
// "Night dragon" -> "night", for "a night egg".
const kindWord = (kind) => kindName(kind).split(" ")[0].toLowerCase();
const who = (d) => d.name ?? `your ${kindName(d.kind).toLowerCase()}`;
// A build in a sentence: "the windmill", "the Title of Liberty".
const PROPER = { liberty: "the Title of Liberty", rampart: "Moroni's rampart" };
const theBuild = (p) => PROPER[p.kind] ?? `the ${p.name.toLowerCase()}`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Choose a build, pointed at the hatchery.
const CHOOSE_HATCHERY = "/village?choose=hatchery";

// What the server said when it refused a spend is already a plain sentence
// ("Not enough wins in the purse for that egg yet."); anything else gets ours.
const said = (err, fallback) => (err?.code === "P0001" && err.message ? err.message : fallback);

export default function Dragons() {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const toast = useToast();

  const { data: raw, error, loading, reload, mutate } = useLoad(() => (userId ? fetchDragons(userId, today) : null), [userId, today]);
  const village = useMemo(() => (raw ? villageOf(raw, today) : null), [raw, today]);
  const hatcheryOn = village ? hatcheryDay(village) : null;
  const state = useMemo(() => (raw ? dragonsOf({ ...raw, hatcheryOn, today }) : null), [raw, hatcheryOn, today]);
  // A hatchery he has chosen that doesn't stand yet, or else the build going
  // up, which the hatchery would take the place of.
  const rising = village?.projects.find((p) => p.kind === "hatchery" && !p.complete) ?? null;
  const going = !rising && village?.current >= 0 ? village.projects[village.current] : null;
  // The build over the quests paints the dragons the village last saw, so an
  // egg bought or a dragon trained here shows there too.
  useEffect(() => {
    if (state) rememberDragons(paintDragons(state));
  }, [state]);
  // An egg seen hatched is kept hatched (keepHatches), so nothing done to
  // the village afterwards turns it back into an egg.
  useEffect(() => {
    const fresh = state?.hatched.filter((d) => !d.kept && d.hatchOn) ?? [];
    if (!fresh.length) return;
    keepHatches(fresh, today).then((rows) => {
      if (!rows.length) return;
      const on = new Map(rows.map((r) => [r.id, r.hatched_on]));
      mutate((r) => r && { ...r, dragons: r.dragons.map((x) => (on.has(x.id) ? { ...x, hatched_on: on.get(x.id) } : x)) });
    });
  }, [state, today, mutate]);

  // One question open at a time: { what: "buy" | "train" | "name", id }.
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const isOpen = (what, id) => open?.what === what && open?.id === id;
  // When a question closes, focus goes back to the button that opened it
  // (it isn't moved anywhere else), so a keyboard or VoiceOver stays put.
  const opener = useRef(null);
  const toggle = (what, id, el) => {
    if (el) opener.current = el;
    setOpen((o) => (o?.what === what && o?.id === id ? null : { what, id }));
  };
  useEffect(() => {
    const el = opener.current;
    if (open || !el?.isConnected) return;
    if (!document.activeElement || document.activeElement === document.body) el.focus({ preventScroll: true });
  }, [open]);

  // `free` is what the question said when he tapped Yes, so a question
  // asked as the free egg never spends wins (the server refuses it instead).
  async function buy(kind, free) {
    const waits = !hatcheryOn;
    setBusy(`buy:${kind}`);
    try {
      await buyEgg({ kind, free, today });
      haptic("success");
      setOpen(null);
      await reload();
      const egg = `${kindWord(kind)} egg`;
      toast.show(waits ? `A ${egg}, waiting for the hatchery.` : free ? `Your free ${egg} is in the hatchery.` : `A ${egg} is in the hatchery.`);
    } catch (err) {
      setOpen(null);
      toast.error(err, said(err, "Couldn't buy that egg."));
      reload();
    } finally {
      setBusy(null);
    }
  }

  async function train(d) {
    const stage = d.next.stage;
    setBusy(`train:${d.id}`);
    try {
      await trainDragon(d.id, today, stage);
      haptic("success");
      setOpen(null);
      await reload();
      const name = who(d);
      toast.show(`${name[0].toUpperCase()}${name.slice(1)} is ${BECOMES[stage]} now.`);
    } catch (err) {
      setOpen(null);
      toast.error(err, said(err, "Couldn't train it."));
      reload();
    } finally {
      setBusy(null);
    }
  }

  async function rename(d, value) {
    const name = value.trim() || null;
    setOpen(null);
    if (name === d.name) return;
    mutate((r) => r && { ...r, dragons: r.dragons.map((x) => (x.id === d.id ? { ...x, name } : x)) });
    try {
      await nameDragon(d.id, name);
      haptic("success");
    } catch (err) {
      toast.error(err, "Couldn't save that name.");
      reload();
    }
  }

  return (
    <div className="page dr">
      <header className="dr-head">
        <div>
          <div className="eyebrow">The village</div>
          <h1 className="page-title">Dragons</h1>
        </div>
        {state && <Purse balance={state.balance} today={state.todayWins} />}
      </header>

      {error && <LoadError what="your dragons" error={error} onRetry={reload} stale={Boolean(raw)} />}
      {loading && !raw && <p className="empty">Loading…</p>}

      {state && (
        <div className="dr-grid">
          <div className="dr-main">
            <figure className="card card--flush dr-hero">
              <img
                src="/village/dragons/hero.jpg"
                width="1200"
                height="800"
                alt="A rider on the black night dragon banks low past the painted armory on its floating island, while a white dawn dragon waits in the yard."
              />
              <figcaption>
                <p className="dr-hero__line">Tasks build the village; wins raise the dragons.</p>
                <p className="dr-hero__sub">Every win you log puts one in the purse, and you spend them here whenever you choose.</p>
              </figcaption>
            </figure>

            {state.hatched.length > 0 && (
              <section className="dr-section" aria-labelledby="dr-yours">
                <h2 className="eyebrow dr-section__h" id="dr-yours">
                  Your dragons
                </h2>
                <ul className="dr-dragons">
                  {state.hatched.map((d) => (
                    <DragonCard
                      key={d.id}
                      d={d}
                      today={today}
                      asking={isOpen("train", d.id)}
                      naming={isOpen("name", d.id)}
                      busy={busy === `train:${d.id}`}
                      onAsk={(e) => toggle("train", d.id, e.currentTarget)}
                      onName={(e) => toggle("name", d.id, e.currentTarget)}
                      onTrain={() => train(d)}
                      onRename={(v) => rename(d, v)}
                      onClose={() => setOpen(null)}
                    />
                  ))}
                </ul>
              </section>
            )}

            {state.eggs.length > 0 && (
              <section className="dr-section" aria-labelledby="dr-hatchery">
                <h2 className="eyebrow dr-section__h" id="dr-hatchery">
                  {state.eggs.every((e) => e.waiting) ? "Waiting for the hatchery" : "In the hatchery"}
                </h2>
                <ul className="dr-warming">
                  {state.eggs.map((e) => (
                    <EggCard key={e.id} e={e} rising={rising} going={going} />
                  ))}
                </ul>
              </section>
            )}

            {!state.dragons.length && state.freeEgg !== "used" && <Start stands={state.freeEgg === "ready"} rising={rising} going={going} />}
          </div>

          <div className="dr-rail">
            <EggShop
              state={state}
              stands={Boolean(hatcheryOn)}
              isOpen={(key) => isOpen("buy", key)}
              busy={busy}
              onAsk={(key, el) => toggle("buy", key, el)}
              onBuy={buy}
              onClose={() => setOpen(null)}
            />
            <Grow />
            <Calm />
          </div>
        </div>
      )}
    </div>
  );
}

// --- The purse -----------------------------------------------------------------

function Purse({ balance, today }) {
  return (
    <div className="dr-purse">
      <span className="dr-purse__pill" aria-label={`${winsLine(balance)} in the purse`}>
        <b>{balance.toLocaleString("en-US")}</b> {balance === 1 ? "win" : "wins"}
      </span>
      {/* The line is kept when there's nothing today, so the title doesn't move. */}
      <span className="dr-purse__today" aria-hidden={today > 0 ? undefined : "true"}>
        {today > 0 ? `+${today} today` : "\u00a0"}
      </span>
    </div>
  );
}

// A row of pips: the four stages of a dragon in ink, or an egg's three days
// of warmth in orange.
function Pips({ n, of, warm = false, label }) {
  return (
    <span className={"dr-pips" + (warm ? " dr-pips--warm" : "")} role="img" aria-label={label}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
    </span>
  );
}

// "Buy a dawn egg for 70?", with what it is underneath and Yes / Not now.
// Focus stays where it was: the question opens under the button he tapped.
function Ask({ id, question, line, busy, busyLabel, onYes, onNo }) {
  return (
    <div className="dr-ask" id={id} role="group" aria-label={question}>
      <div className="dr-ask__words">
        <p className="dr-ask__q">{question}</p>
        {line && <p className="dr-ask__line">{line}</p>}
      </div>
      <div className="dr-ask__actions">
        <button type="button" className="btn btn--sm" onClick={onNo} disabled={busy}>
          Not now
        </button>
        <button type="button" className="btn btn--sm btn--accent" onClick={onYes} disabled={busy}>
          {busy ? busyLabel : "Yes"}
        </button>
      </div>
    </div>
  );
}

// --- His dragons ---------------------------------------------------------------------

function DragonCard({ d, today, asking, naming, busy, onAsk, onName, onTrain, onRename, onClose }) {
  const kind = kindName(d.kind);
  const at = GROWN.indexOf(d.stage) + 1;
  const stageName = STAGE_NAME.get(d.stage) ?? "Dragon";
  const next = d.next ? TRAINING.find((t) => t.stage === d.next.stage) : null;
  const askId = `dr-train-${d.id}`;
  const hatchedToday = d.stage === "hatchling" && d.hatchOn === today;

  return (
    <li className="card dr-dragon">
      <img className="dr-dragon__pic" src={portrait(d)} width="640" height="480" alt={`${d.name ? `${d.name}, the ` : "The "}${kind.toLowerCase()}, ${stageName.toLowerCase()}`} />
      <div className="dr-dragon__body">
        <div className="dr-dragon__name">
          <h3>{d.name ?? kind}</h3>
          <button type="button" className="dr-link" onClick={onName} aria-expanded={naming}>
            {d.name ? "Rename" : "Name it"}
          </button>
        </div>
        {(d.name || hatchedToday) && (
          <div className="dr-dragon__kind">
            {d.name && kind}
            {hatchedToday && <span className="dr-today">{d.name ? " · hatched today" : "Hatched today"}</span>}
          </div>
        )}
        <Pips n={at} of={GROWN.length} label={`${stageName}, stage ${at} of ${GROWN.length}`} />
        <p className="dr-dragon__stage">{stageLine(d)}</p>
        {d.next ? (
          d.short > 0 ? (
            <p className="dr-more">
              {d.short} more {d.short === 1 ? "win" : "wins"}
            </p>
          ) : (
            <button type="button" className="dr-pill" onClick={onAsk} aria-expanded={asking} aria-controls={asking ? askId : undefined}>
              Train · {d.next.cost}
            </button>
          )
        ) : (
          <p className="dr-more">{TRAINING[TRAINING.length - 1].line}</p>
        )}
      </div>
      {asking && next && (
        <Ask
          id={askId}
          question={`Train ${who(d)} to ${BECOMES[next.stage]} for ${next.cost}?`}
          line={next.line}
          busy={busy}
          busyLabel="Training…"
          onYes={onTrain}
          onNo={onClose}
        />
      )}
      {naming && <NameForm d={d} onSave={onRename} onCancel={onClose} />}
    </li>
  );
}

function NameForm({ d, onSave, onCancel }) {
  const [value, setValue] = useState(d.name ?? "");
  return (
    <form
      className="dr-name"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <input
        className="input dr-name__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        maxLength={40}
        placeholder="A name for it"
        aria-label={`A name for your ${kindName(d.kind).toLowerCase()}`}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="done"
        autoFocus
      />
      <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="btn btn--sm btn--accent">
        Save
      </button>
    </form>
  );
}

// --- The hatchery ----------------------------------------------------------------------

function EggCard({ e, rising, going }) {
  const name = `${kindWord(e.kind)[0].toUpperCase()}${kindWord(e.kind).slice(1)} egg`;
  return (
    <li className="card dr-warm">
      <img className="dr-warm__pic" src={eggPicture(e.kind)} width="300" height="360" alt="" />
      <div className="dr-warm__body">
        <h3>{name}</h3>
        <Pips n={e.warmth} of={HATCH_DAYS} warm label={`${e.warmth} of ${HATCH_DAYS} banked days of warmth`} />
        <p className="dr-warm__line">{hatchLine(e)}</p>
        {e.waiting &&
          (rising ? (
            <Link className="dr-link" to={`/village?build=${rising.id}`}>
              It's going up: {rising.done} of {rising.need} tasks
            </Link>
          ) : (
            <Link className="dr-link" to={CHOOSE_HATCHERY}>
              {going ? `Build it instead of ${theBuild(going)}` : "Choose it in the village"}
            </Link>
          ))}
      </div>
    </li>
  );
}

// Before the first egg: what comes first, and where the free egg comes from.
// Once the hatchery stands, a phone shows the eggs straight after the
// picture instead (they say the first is free); a wide screen keeps this
// beside them.
function Start({ stands, rising, going }) {
  const need = CATALOG.find((c) => c.kind === "hatchery")?.need;
  // Only one build goes up at a time, so while another is, the hatchery takes its place.
  const swap = going
    ? going.done
      ? ` ${cap(theBuild(going))} is going up now: the hatchery would take its place, and the ${countLine(going.done, "task", "tasks")} laid on it carry over${need && going.done >= need ? ", so it stands at once" : ""}.`
      : ` ${cap(theBuild(going))} is going up now, with nothing laid on it yet: the hatchery would take its place.`
    : "";
  return (
    <section className={"card card--flush dr-start" + (stands ? " dr-start--wide" : "")} aria-labelledby="dr-start-h">
      <img className="dr-start__pic" src="/village/builds/hatchery.jpg" width="720" height="540" alt="The hatchery: a ring of warm dark stone round a pit of glowing coals." />
      <div className="dr-start__body">
        <div className="eyebrow">Your first dragon</div>
        <h2 id="dr-start-h">{stands ? "The hatchery stands" : rising ? "The hatchery is going up" : "Build the hatchery first"}</h2>
        {stands ? (
          <p>Your first egg is free, any kind you like: choose it from the eggs. It rests in the warm sand, and each day you bank warms it until it hatches on the third.</p>
        ) : rising ? (
          <p>
            {rising.done} of {rising.need} tasks so far. Once it stands, your first egg is free, any kind you like, and each day you bank warms it.
          </p>
        ) : (
          <p>
            A ring of warm dark stone round a pit of glowing coals, where the eggs hatch. {need ? `It takes ${need} tasks, and once` : "Once"} it stands, your first
            egg is free.{swap}
          </p>
        )}
        {!stands && (
          <Link className="btn btn--sm btn--accent dr-start__go" to={rising ? `/village?build=${rising.id}` : CHOOSE_HATCHERY}>
            {rising ? "See it in the village" : going ? `Build it instead of ${theBuild(going)}` : "Choose it in the village"}
          </Link>
        )}
      </div>
    </section>
  );
}

// --- Eggs ------------------------------------------------------------------------------

function EggShop({ state, stands, isOpen, busy, onAsk, onBuy, onClose }) {
  const free = state.freeEgg === "ready";
  return (
    <section className="dr-section" aria-labelledby="dr-eggs">
      <h2 className="eyebrow dr-section__h" id="dr-eggs">
        Eggs
      </h2>
      <div className="card dr-shop">
        {state.freeEgg !== "used" && (
          <div className="dr-free">
            <div>
              <b>Your first egg is free</b>
              <span>{free ? "The hatchery stands. Choose any kind you like." : "Any kind you like, once the hatchery stands."}</span>
            </div>
            <span className="dr-free__tag">free</span>
          </div>
        )}
        <ul className="dr-eggs">
          {state.nextEgg.map(({ kind, cost, short }) => {
            const k = kindOf(kind);
            // The question is the free one or the bought one: if the free egg
            // goes (a tap still loading), the free question closes rather than
            // turning into a price under his thumb.
            const key = `${kind}:${free ? "free" : "buy"}`;
            const asking = isOpen(key);
            const askId = `dr-buy-${kind}`;
            const word = kindWord(kind);
            const waitsLine = stands ? null : state.freeEgg === "locked" ? "It waits until the hatchery stands, and your first egg is still free once it does." : "It waits until the hatchery stands.";
            return (
              <li key={kind} className={"dr-egg" + (asking ? " open" : "")}>
                <img className="dr-egg__pic" src={eggPicture(kind)} width="300" height="360" alt="" loading="lazy" />
                <span className="dr-egg__name">{word[0].toUpperCase() + word.slice(1)}</span>
                {free ? (
                  <span className="dr-egg__price dr-egg__price--free">
                    <s aria-hidden="true">{cost}</s> free
                  </span>
                ) : (
                  <span className="dr-egg__price">{cost}</span>
                )}
                {free ? (
                  <button type="button" className="dr-pill dr-pill--soft" onClick={(e) => onAsk(key, e.currentTarget)} aria-expanded={asking} aria-controls={asking ? askId : undefined}>
                    Choose
                  </button>
                ) : short > 0 ? (
                  <span className="dr-egg__more">{short} more</span>
                ) : (
                  <button type="button" className="dr-pill" onClick={(e) => onAsk(key, e.currentTarget)} aria-expanded={asking} aria-controls={asking ? askId : undefined}>
                    Buy
                  </button>
                )}
                {asking && (
                  <Ask
                    id={askId}
                    question={free ? `Take a ${word} egg for free?` : `Buy a ${word} egg for ${cost}?`}
                    line={waitsLine ?? k.line}
                    busy={busy === `buy:${kind}`}
                    busyLabel={free ? "Taking it…" : "Buying…"}
                    onYes={() => onBuy(kind, free)}
                    onNo={onClose}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <p className="dr-shop__note">
          {state.start} to start, {state.earned.toLocaleString("en-US")} won since, {state.spent.toLocaleString("en-US")} spent.
        </p>
      </div>
    </section>
  );
}

// --- How they grow, and the promises ------------------------------------------------------

function Grow() {
  const rows = [
    { name: "Hatching", n: `${HATCH_DAYS} banked days`, line: `${STAGES[0].line} On days you don't bank, it simply waits.` },
    ...TRAINING.map((t) => ({ name: t.name, n: winsLine(t.cost), line: t.line })),
  ];
  return (
    <section className="card dr-grow" aria-labelledby="dr-grow-h">
      <h2 className="eyebrow" id="dr-grow-h">
        How they grow
      </h2>
      <ol>
        {rows.map((r) => (
          <li key={r.name}>
            <b>{r.name}</b>
            <span className="dr-grow__n">{r.n}</span>
            <p>{r.line}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Calm() {
  return (
    <ul className="dr-calm" aria-label="How the dragons keep">
      {CALM.map((c) => (
        <li key={c.title}>
          <b>{c.title}</b>
          <span>{c.line}</span>
        </li>
      ))}
    </ul>
  );
}

