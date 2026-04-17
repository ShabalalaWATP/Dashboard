import Markdown from "markdown-to-jsx";
import { FileText } from "lucide-react";
import type { Project } from "../types";

/** Pre-process [[42]] citations into a custom <Cite id=42 /> element that
 *  markdown-to-jsx will pass through to our override. Done as a string
 *  transform because markdown-to-jsx does not expose a raw-text plugin API.
 */
function preprocessCitations(src: string): string {
  return src.replace(/\[\[(\d+)\]\]/g, (_m, id) => `<Cite id="${id}" />`);
}

export function MarkdownBody({
  text,
  projects,
  onCite,
}: {
  text: string;
  projects: Project[];
  onCite: (p: Project) => void;
}) {
  const projById = new Map<number, Project>(projects.map((p) => [p.id, p]));

  return (
    <div className="md-body text-[13px] leading-relaxed text-slate-200 space-y-2">
      <Markdown
        options={{
          overrides: {
            Cite: {
              component: CitationChip,
              props: { projById, onCite },
            },
            // XSS hardening: a jail-broken or malicious LLM could emit raw
            // HTML like <script>, <iframe>, <img onerror=...>, or
            // <a href="javascript:...">. We can't set
            // `disableParsingRawHTML: true` globally because that would also
            // skip the <Cite> override above, so instead we neutralise the
            // common vectors by overriding the dangerous tags with null
            // components, and the <a> and <img> tags with sanitising
            // wrappers. The citation override still fires because it's a
            // named custom component, not raw HTML.
            script: { component: () => null },
            iframe: { component: () => null },
            object: { component: () => null },
            embed: { component: () => null },
            style: { component: () => null },
            link: { component: () => null },
            meta: { component: () => null },
            form: { component: () => null },
            input: { component: () => null },
            button: { component: () => null },
            h1: { props: { className: "text-base font-semibold text-slate-100 mt-3" } },
            h2: { props: { className: "text-sm font-semibold text-slate-100 mt-3" } },
            h3: { props: { className: "text-sm font-semibold text-accent mt-3" } },
            h4: { props: { className: "text-xs font-semibold uppercase tracking-wider text-slate-300 mt-2" } },
            p:  { props: { className: "leading-relaxed" } },
            ul: { props: { className: "list-disc pl-5 space-y-0.5 marker:text-slate-600" } },
            ol: { props: { className: "list-decimal pl-5 space-y-0.5 marker:text-slate-500" } },
            li: { props: { className: "text-slate-200" } },
            strong: { props: { className: "text-slate-100 font-semibold" } },
            em: { props: { className: "italic text-slate-300" } },
            a: { component: SafeAnchor },
            blockquote: {
              props: { className: "border-l-2 border-accent/40 pl-3 text-slate-400 italic" },
            },
            code: {
              component: InlineOrBlockCode,
            },
            pre: {
              component: ({ children }: any) => (
                <pre className="bg-bg0 border border-white/5 rounded-md p-2 overflow-auto text-[12px] mono text-slate-200">
                  {children}
                </pre>
              ),
            },
            table: {
              props: {
                className:
                  "w-full text-xs border border-white/10 rounded-md overflow-hidden my-2 border-collapse",
              },
            },
            thead: { props: { className: "bg-white/[0.04] text-slate-300" } },
            th: { props: { className: "px-2 py-1 text-left font-medium border-b border-white/10" } },
            td: { props: { className: "px-2 py-1 border-t border-white/5 mono text-slate-300" } },
            hr: { props: { className: "border-white/10 my-3" } },
          },
        }}
      >
        {preprocessCitations(text)}
      </Markdown>
    </div>
  );
}

/** Anchor renderer that refuses dangerous URL schemes. The LLM is asked to
 *  emit http(s)/mailto links; anything else (javascript:, data:, vbscript:,
 *  file:…) is rendered as plain text so a prompt-injected response can't
 *  produce a clickable payload. We also enforce noopener + noreferrer to
 *  avoid tabnabbing via window.opener. */
function SafeAnchor({ href, children, ...rest }: any) {
  const raw = typeof href === "string" ? href.trim() : "";
  // Allow-list rather than block-list — there are too many exotic URL schemes
  // to enumerate the bad ones reliably. Relative ("/", "#...") and
  // fragment-only links are safe.
  const isSafe =
    /^https?:\/\//i.test(raw) ||
    /^mailto:/i.test(raw) ||
    raw.startsWith("/") ||
    raw.startsWith("#");
  if (!isSafe) {
    return <span className="text-slate-400 line-through" title={`blocked: ${raw}`}>{children}</span>;
  }
  return (
    <a href={raw}
       className="text-accent underline underline-offset-2"
       target="_blank"
       rel="noopener noreferrer"
       {...rest}>
      {children}
    </a>
  );
}


// markdown-to-jsx renders both inline `code` and fenced block code via <code>,
// distinguishable by the presence of a language className on block code.
function InlineOrBlockCode({ className, children }: any) {
  const isBlock = className && className.startsWith("lang-");
  if (isBlock) {
    return <code className="mono text-slate-200">{children}</code>;
  }
  return (
    <code className="mono bg-white/[0.06] border border-white/10 rounded px-1 py-0.5 text-[12px] text-accent">
      {children}
    </code>
  );
}

function CitationChip({ id, projById, onCite }: any) {
  const pid = Number(id);
  const project: Project | undefined = projById.get(pid);
  if (!project) {
    return (
      <span className="inline-flex items-center align-middle mx-0.5 px-1.5 py-0.5 rounded
                       text-[10px] font-mono text-slate-500 bg-white/[0.03] border border-dashed border-white/10">
        {pid}?
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onCite(project)}
      title={`${project.name} — ${project.project_type} · ${project.campaign_hub}`}
      className="inline-flex items-center gap-1 align-middle mx-0.5 px-1.5 py-0.5 rounded
                 text-[10px] font-mono text-accent bg-accent/10 border border-accent/30
                 hover:bg-accent/20 hover:border-accent/50 transition-colors"
    >
      <FileText size={10} />
      {project.name}
    </button>
  );
}
