import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { fetchQuoteLinks, linkQuote, relinkQuotes, unlinkQuote } from "../../lib/api";
import { refOf } from "../../lib/ladder";
import { useLoad } from "../../lib/useLoad";
import { haptic } from "../../lib/haptics";
import { announceChange } from "../today/announce";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import QuoteCard from "../board/QuoteCard";
import { PaperNote } from "../board/CorkBoard";
import QuotePicker from "./QuotePicker";

// "Quotes" on a target: the words he's linked to it, as the Board shows
// them (a print taped down, or his own written-down quote on an index card),
// each with Unlink. "Link a quote" opens the picker, where a tap links or
// unlinks one at once. A focus reads its whole line: a quote linked in an
// earlier week of it is here too, and Unlink takes every week's link.
//
//   target    { kind, id, key } as resolveRef gives it
//   name      its short name; title and why, what "Find new quotes" asks about
//   lineage   a focus's earlier weeks (ids)
//   picking   the picker is open; onPicking opens or closes it

export default function LinkedQuotes({ userId, today, target, name, title, why = "", lineage = null, picking = false, onPicking }) {
  const toast = useToast();
  const navigate = useNavigate();
  const ref = useMemo(() => refOf(target), [target]);
  const refKey = JSON.stringify(ref);
  const lineageKey = (lineage ?? []).join(",");
  const isFocus = target.kind === "focus";

  const links = useLoad(
    () => (userId && ref ? fetchQuoteLinks(userId, ref, { focusLineage: isFocus ? lineage ?? [] : undefined }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, refKey, lineageKey]
  );
  const list = links.data ?? NONE;
  const { mutate } = links;
  const linkedQuotes = useMemo(() => new Set(list.map((l) => l.quote_id).filter(Boolean)), [list]);
  const linkedNotes = useMemo(() => new Set(list.map((l) => l.note_id).filter(Boolean)), [list]);

  // Off the target at once, and back with Undo.
  async function unlink(link, { quiet = false } = {}) {
    if (!link.linkIds?.length) return;
    mutate((l) => (l ?? []).filter((x) => x.id !== link.id));
    haptic("tap");
    try {
      const rows = await unlinkQuote(link.linkIds);
      announceChange();
      if (!quiet)
        toast.show("Unlinked", {
          actionLabel: "Undo",
          onAction: async () => {
            try {
              await relinkQuotes(rows);
              await links.reload();
              announceChange();
            } catch (err) {
              toast.error(err, "Couldn't link it again.");
            }
          },
        });
    } catch (err) {
      mutate((l) => [...(l ?? []).filter((x) => x.id !== link.id), link].sort(byPlace));
      toast.error(err, "Couldn't unlink that.");
    }
  }

  // On the target at once; the saved row takes its place. Linked already
  // (on another device, a moment ago) just reads the list again.
  async function link(item, isNote) {
    const temp = {
      id: `tmp:${item.id}`,
      quote_id: isNote ? null : item.id,
      note_id: isNote ? item.id : null,
      quote: isNote ? null : item,
      note: isNote ? item : null,
      why: null,
      position: list.length,
      created_at: new Date().toISOString(),
      linkIds: [],
    };
    mutate((l) => [...(l ?? []), temp]);
    haptic("tap");
    try {
      const row = await linkQuote(userId, ref, isNote ? { noteId: item.id, position: temp.position } : { quoteId: item.id, position: temp.position });
      if (row) mutate((l) => (l ?? []).map((x) => (x.id === temp.id ? { ...row, linkIds: [row.id] } : x)));
      else await links.reload();
      announceChange();
    } catch (err) {
      mutate((l) => (l ?? []).filter((x) => x.id !== temp.id));
      toast.error(err, "Couldn't link that quote.");
    }
  }

  function toggle(item, isNote) {
    const hit = list.find((l) => (isNote ? l.note_id === item.id : l.quote_id === item.id));
    if (hit) unlink(hit, { quiet: true });
    else link(item, isNote);
  }

  const unlinkBtn = (l) => (
    <button type="button" className="qprint__save tg-unlink" onClick={() => unlink(l)} disabled={!l.linkIds?.length}>
      Unlink
    </button>
  );

  return (
    <section className="card tg-quotes" id="quotes" aria-labelledby="tg-quotes-h">
      <div className="tg-sec__head">
        <h2 className="eyebrow" id="tg-quotes-h">
          Quotes
        </h2>
        {list.length > 0 && (
          <button type="button" className="btn-link tg-sec__link" onClick={() => onPicking(true)}>
            <Plus size={13} aria-hidden="true" />
            Link a quote
          </button>
        )}
      </div>

      {links.error && <LoadError what="the quotes linked here" error={links.error} onRetry={links.reload} stale={Boolean(links.data)} />}

      {!links.data && links.loading ? (
        <p className="tg-quiet">Loading…</p>
      ) : list.length ? (
        <div className="picks__strip tg-quotes__strip">
          {list.map((l) =>
            l.quote ? (
              <QuoteCard
                key={l.id}
                variant="pick"
                quote={l.quote}
                reason={l.why ?? undefined}
                onChange={(row) => mutate((all) => (all ?? []).map((x) => (x.quote?.id === row.id ? { ...x, quote: { ...x.quote, ...row } } : x)))}
                extra={unlinkBtn(l)}
              />
            ) : (
              <div key={l.id} className="tg-qnote">
                <PaperNote note={l.note} onOpen={(id) => navigate(`/study?note=${id}`)} onChanged={links.reload} />
                <div className="qprint__foot tg-qnote__foot">{unlinkBtn(l)}</div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="tg-empty">
          <p>No quotes on this yet.</p>
          <div className="tg-empty__btns">
            <button type="button" className="btn btn--sm btn--on-page" onClick={() => onPicking(true)}>
              <Plus size={14} aria-hidden="true" />
              Link a quote
            </button>
          </div>
        </div>
      )}

      {picking && (
        <QuotePicker
          userId={userId}
          today={today}
          target={target}
          name={name}
          title={title}
          why={why}
          linkedQuotes={linkedQuotes}
          linkedNotes={linkedNotes}
          linkedOrder={list.map((l) => l.quote_id).filter(Boolean)}
          onToggle={toggle}
          onClose={() => onPicking(false)}
        />
      )}
    </section>
  );
}

const NONE = [];
const byPlace = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
