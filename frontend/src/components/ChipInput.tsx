import { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";

/** Chip input with autocomplete. Accepts a canonical suggestions list plus an
 *  unlimited number of write-in values. */
export function ChipInput({
  label, value, onChange, suggestions, placeholder = "type to add…", max,
}: {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  max?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function add(v: string) {
    const s = v.trim();
    if (!s) return;
    if (value.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    if (max && value.length >= max) return;
    onChange([...value, s]);
    setQ("");
    setFocusedIdx(0);
  }

  function remove(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  const matches = suggestions
    .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    .filter((s) => !q || s.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 10);

  const hasExact = suggestions.some((s) => s.toLowerCase() === q.toLowerCase())
                  || value.some((v) => v.toLowerCase() === q.toLowerCase());
  const showAddNew = q.trim() && !hasExact;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (matches[focusedIdx]) add(matches[focusedIdx]);
      else if (q.trim()) add(q);
    } else if (e.key === "Backspace" && !q && value.length > 0) {
      remove(value[value.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(matches.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {label && <label className="block text-xs text-slate-400 mb-1">{label}</label>}
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        className="min-h-[38px] flex flex-wrap items-center gap-1 bg-bg0 border border-white/10 rounded-md px-2 py-1 focus-within:border-accent/50"
      >
        {value.map((v) => (
          <span key={v}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]
                           bg-accent/20 border border-accent/40 text-accent font-mono">
            {v}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(v); }}
                    className="hover:text-red-400">
              <X size={10}/>
            </button>
          </span>
        ))}
        <input ref={inputRef} value={q}
               onFocus={() => setOpen(true)}
               onChange={(e) => { setQ(e.target.value); setOpen(true); setFocusedIdx(0); }}
               onKeyDown={onKeyDown}
               placeholder={value.length === 0 ? placeholder : ""}
               className="flex-1 min-w-[80px] bg-transparent outline-none text-xs py-1" />
      </div>
      {open && (matches.length > 0 || showAddNew) && (
        <div className="absolute z-40 left-0 right-0 mt-1 panel rounded-md p-1 max-h-56 overflow-auto shadow-lg">
          {matches.map((m, i) => (
            <button type="button" key={m}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(m)}
                    onMouseEnter={() => setFocusedIdx(i)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono
                      ${i === focusedIdx
                        ? "bg-accent/20 text-accent"
                        : "text-slate-200 hover:bg-white/5"}`}>
              {m}
            </button>
          ))}
          {showAddNew && (
            <button type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(q)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2
                               text-magenta/90 hover:bg-white/5 font-mono">
              <Plus size={12}/> add “{q}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
