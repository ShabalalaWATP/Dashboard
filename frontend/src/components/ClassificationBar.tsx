import type { PublicSettings } from "../types";

// Known handling caveats → colour. Anything custom (e.g. "TS//SCI",
// "UK EYES ONLY", project-specific caveats) falls through to the TOP SECRET
// palette so it's visually treated with maximum caution by default.
const KNOWN_STYLES: Record<string, string> = {
  "OFFICIAL":           "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  "OFFICIAL-SENSITIVE": "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  "SECRET":             "bg-rose-500/10 text-rose-300 border-rose-500/30",
  "TOP SECRET":         "bg-pink-500/10 text-pink-300 border-pink-500/30",
  "TOP-SECRET":         "bg-pink-500/10 text-pink-300 border-pink-500/30",
};

const CUSTOM_FALLBACK = KNOWN_STYLES["TOP SECRET"];

function toneFor(level: string): string {
  const key = (level || "").trim().toUpperCase();
  return KNOWN_STYLES[key] || CUSTOM_FALLBACK;
}


export function ClassificationBar({ settings }: { settings: PublicSettings }) {
  const text = (settings.classification_text || settings.classification_level || "OFFICIAL").trim();
  const tone = toneFor(settings.classification_level || text);

  return (
    <div className={`w-full border-b text-center py-1.5 ${tone}`}>
      <span className="mono text-[11px] font-semibold tracking-[0.32em] uppercase">
        {text}
      </span>
    </div>
  );
}
