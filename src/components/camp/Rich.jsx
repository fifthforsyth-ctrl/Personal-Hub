import { boldRuns, noteBlocks } from "../../lib/camp";

// Text from a plan, with its **bold** lead-ins kept bold and nothing else
// read as markup.
export function Rich({ text }) {
  return boldRuns(text).map((r, i) => (r.bold ? <b key={i}>{r.text}</b> : <span key={i}>{r.text}</span>));
}

// A plan's notes: its reference tables, principles and lists, drawn as
// headings, paragraphs, lists and tables. Tables scroll inside their own box
// on a phone.
export function PlanNotes({ text }) {
  const blocks = noteBlocks(text);
  if (!blocks.length) return null;
  return (
    <div className="plan-notes">
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          const Tag = b.level <= 2 ? "h3" : "h4";
          return (
            <Tag key={i}>
              <Rich text={b.text} />
            </Tag>
          );
        }
        if (b.kind === "ul")
          return (
            <ul key={i}>
              {b.items.map((t, j) => (
                <li key={j}>
                  <Rich text={t} />
                </li>
              ))}
            </ul>
          );
        if (b.kind === "table")
          return (
            <div key={i} className="plan-notes__table">
              <table>
                <thead>
                  <tr>
                    {b.head.map((c, j) => (
                      <th key={j} scope="col">
                        <Rich text={c} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j}>
                      {r.map((c, k) => (
                        <td key={k}>
                          <Rich text={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return (
          <p key={i}>
            <Rich text={b.text} />
          </p>
        );
      })}
    </div>
  );
}
