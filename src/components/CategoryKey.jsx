import { useEffect, useState } from "react";
import { Palette, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchCategories } from "../lib/api";
import { FAMILIES, familyFor, colorFor, setCategoryColors } from "../lib/categories";

// What the colours on every ring in this tab actually mean.
//
// Grouped by family rather than listed alphabetically, because that is how
// the palette was built and how it is meant to be read: you learn nine
// hues, and the shade inside one tells you which kind of Body or Spirit or
// Work it was. An alphabetical list of twenty-five swatches would teach
// nobody anything.
export default function CategoryKey({ defaultOpen = true }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!user?.id) return;
    fetchCategories(user.id)
      .then((cats) => {
        setCategoryColors(cats);
        setCategories(cats);
      })
      .catch(() => {});
  }, [user?.id]);

  if (categories.length === 0) return null;

  const groups = FAMILIES.map((f) => ({
    ...f,
    items: categories.filter((c) => (c.family ?? familyFor(c.name)) === f.key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="row"
        style={{ gap: 7, width: "100%", background: "none", border: "none", color: "inherit", padding: 0, textAlign: "left" }}
      >
        {open ? <ChevronDown size={14} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} style={{ flexShrink: 0 }} />}
        <span className="card-title" style={{ margin: 0 }}><Palette size={14} />Colour key</span>
        <span className="faint" style={{ fontSize: 11.5, marginLeft: "auto" }}>
          {categories.length} categories, {groups.length} families
        </span>
      </button>

      {open && (
        <div className="category-key">
          {groups.map((g) => (
            <div key={g.key} className="category-key__family">
              <div className="category-key__label">
                <span className="category-key__hue" style={{ background: g.hue }} />
                {g.label}
              </div>
              {g.items.map((c) => (
                <div key={c.id ?? c.name} className="category-key__item">
                  <span className="category-key__swatch" style={{ background: c.color || colorFor(c.name) }} />
                  <span className="truncate">{c.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
