"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  Loader2,
  ChevronRight,
  FlaskConical,
  CalendarDays,
  Package,
  Beaker,
  Users,
  CircleAlert,
  Paperclip,
  X,
  LineChart,
  FileText,
  RotateCcw,
} from "lucide-react";

/* ------------------------------------------------------------------ types */

type ToolPayload = Record<string, any>;

type Step = {
  tool: string;
  data: ToolPayload | null;
  open: boolean;
  running: boolean;
};

type Attachment = { name: string; mime: string; data: string; size: number };

type Msg = {
  role: "user" | "assistant";
  text: string;
  steps: Step[];
  /** Figures rendered server-side, shown inline under the answer. */
  images?: { mime: string; data: string; caption?: string }[];
  /** What the user attached to this turn, echoed back as chips. */
  files?: { name: string; mime: string }[];
};

const MAX_ATTACHMENTS = 2;
const MAX_FILE_BYTES = 3_000_000;

/** Browsers report "" for .xy/.dat, so fall back to the extension. */
function guessMime(name: string, reported: string): string {
  if (reported) return reported;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  }
  if (ext === "csv") return "text/csv";
  return "text/plain";
}

function isImageMime(mime: string): boolean {
  return /^image\//.test(mime);
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------------------------------------------------------- persistence */

/**
 * The thread lives in sessionStorage: it survives a reload, but dies with the
 * tab, so a shared bench machine never accumulates someone else's conversation.
 *
 * Deliberately NOT stored:
 *   - attachment bytes. 3 MB of base64 would blow the ~5 MB quota and a silent
 *     save failure is worse than not offering one. Only the filename survives.
 *   - anything secret — this is a transcript of a chat, nothing more.
 */
const THREAD_KEY = (userId: string) => `luma:thread:${userId}`;
const THREAD_VERSION = 1;

type StoredThread = {
  v: number;
  at: number;
  messages: Msg[];
};

/** sessionStorage is user-editable, so treat what comes back as untrusted. */
function isValidMsg(m: any): m is Msg {
  if (!m || typeof m !== "object") return false;
  if (m.role !== "user" && m.role !== "assistant") return false;
  if (typeof m.text !== "string") return false;
  if (!Array.isArray(m.steps)) return false;
  if (m.images !== undefined) {
    if (!Array.isArray(m.images)) return false;
    for (const img of m.images) {
      if (!img || typeof img.data !== "string" || typeof img.mime !== "string") return false;
    }
  }
  return true;
}

function loadThread(userId: string): Msg[] | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.sessionStorage.getItem(THREAD_KEY(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredThread;
    if (!parsed || parsed.v !== THREAD_VERSION) return null;
    if (!Array.isArray(parsed.messages) || parsed.messages.length < 2) return null;
    if (!parsed.messages.every(isValidMsg)) return null;
    return parsed.messages;
  } catch {
    // Corrupt or blocked storage must not break the page.
    return null;
  }
}

function saveThread(userId: string, messages: Msg[]): void {
  if (typeof window === "undefined" || !userId) return;
  const write = (msgs: Msg[]) => {
    const payload: StoredThread = { v: THREAD_VERSION, at: Date.now(), messages: msgs };
    window.sessionStorage.setItem(THREAD_KEY(userId), JSON.stringify(payload));
  };
  try {
    write(messages);
  } catch {
    // Over quota. Figures are the bulk of it, so drop the oldest ones first and
    // keep the conversation text rather than losing the whole thread.
    try {
      let trimmed = messages.map((m) => ({ ...m }));
      for (let guard = 0; guard < 12; guard += 1) {
        const idx = trimmed.findIndex((m) => (m.images?.length ?? 0) > 0);
        if (idx < 0) break;
        trimmed[idx] = { ...trimmed[idx], images: [] };
        try {
          write(trimmed);
          return;
        } catch {
          /* keep trimming */
        }
      }
      // Still too big: keep the text only.
      write(trimmed.map((m) => ({ ...m, images: [] })));
    } catch {
      // Give up quietly; a persisted thread is a nicety, not a requirement.
    }
  }
}

function clearThread(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.sessionStorage.removeItem(THREAD_KEY(userId));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------- tool meta */

const TOOL_META: Record<string, { label: string; icon: typeof FlaskConical }> = {
  get_instrument_availability: { label: "Instrument availability", icon: FlaskConical },
  get_my_bookings: { label: "Your bookings", icon: CalendarDays },
  get_my_glassware_loans: { label: "Glassware on loan", icon: Package },
  search_reagents: { label: "Chemical inventory", icon: Beaker },
  list_supervisors: { label: "Supervisors", icon: Users },
  render_plot: { label: "Figure", icon: LineChart },
};

function metaFor(tool: string) {
  return TOOL_META[tool] ?? { label: tool.replace(/_/g, " "), icon: FlaskConical };
}

/** One-line result of a tool, in the same units the answer uses. */
function summarize(tool: string, data: ToolPayload | null): string {
  if (!data) return "";
  if (data.error) return "failed";
  switch (tool) {
    case "get_instrument_availability":
      return `${data.freeNow ?? "?"} of ${data.total ?? "?"} free`;
    case "get_my_bookings":
      return `${data.count ?? 0} booking${data.count === 1 ? "" : "s"}`;
    case "get_my_glassware_loans":
      return `${data.count ?? 0} on loan`;
    case "search_reagents":
      return `${data.count ?? 0} match${data.count === 1 ? "" : "es"}`;
    case "list_supervisors":
      return `${data.count ?? 0} listed`;
    case "render_plot": {
      if (!data.rendered) return "failed";
      // "CV · Current (A) vs Potential (V) · file.csv" → "CV"
      const kind = String(data.caption ?? "").split("·")[0]?.trim();
      return kind || "rendered";
    }
    default:
      return "";
  }
}

/* --------------------------------------------------------------- dates */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic date text — same output on server and client, so no hydration drift. */
function fmtDay(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function fmtRange(start?: string | null, end?: string | null): string {
  if (!start) return "—";
  const a = fmtDay(start);
  const b = fmtDay(end);
  return a === b || b === "—" ? a : `${a} – ${b}`;
}

/* --------------------------------------------------------- formatting */

const CATEGORY_LABEL: Record<string, string> = {
  NON_AQUEOUS: "Non-aqueous",
  AQUEOUS: "Aqueous",
};

/** Database enums are SCREAMING_SNAKE; nobody should read them on screen. */
function humanize(value?: string | null): string {
  if (!value) return "—";
  if (CATEGORY_LABEL[value]) return CATEGORY_LABEL[value];
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Minimal inline formatter. The model writes **bold** and `code`; rendering it
 * raw puts literal asterisks on screen, which reads as broken output.
 */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <strong key={k++} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <code key={k++} className="rounded bg-slate-800/80 px-1 py-0.5 text-[12px] text-slate-300">
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function RichText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key} className="my-1 space-y-1 pl-4">
        {bullets.map((b, i) => (
          <li key={i} className="list-disc text-sm leading-relaxed text-slate-200">
            {inline(b)}
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  text.split("\n").forEach((line, i) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flush(`ul-${i}`);
    if (!line.trim()) return;
    blocks.push(
      <p key={i} className="text-sm leading-relaxed text-slate-200">
        {inline(line)}
      </p>,
    );
  });
  flush("ul-end");

  return <div className="mt-2 space-y-1">{blocks}</div>;
}

/* --------------------------------------------------------- data rows */

function Dot({ tone }: { tone: "free" | "busy" | "yours" }) {
  const bg =
    tone === "yours" ? "bg-orange-400" : tone === "busy" ? "bg-amber-400" : "bg-emerald-400";
  return <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${bg}`} aria-hidden />;
}

const TONE_TEXT = {
  yours: "text-orange-300",
  busy: "text-amber-300",
  free: "text-emerald-300",
} as const;

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-t border-slate-700/40 py-2 first:border-t-0">
      {children}
    </div>
  );
}

function Empty({ what }: { what: string }) {
  return <p className="py-2 text-[12px] text-slate-500">Nothing found — {what}</p>;
}

function StepDetail({ tool, data }: { tool: string; data: ToolPayload }) {
  if (data?.error) {
    return (
      <p className="flex items-center gap-2 py-2 text-[12px] text-amber-300">
        <CircleAlert className="h-3.5 w-3.5" />
        {String(data.error)}
      </p>
    );
  }

  if (tool === "get_instrument_availability") {
    const rows: any[] = data.instruments ?? [];
    if (!rows.length) return <Empty what="the lab has no instruments on record" />;
    return (
      <div>
        {rows.map((i, n) => {
          const tone: "free" | "busy" | "yours" = i.booked_by_you ? "yours" : i.booked_now ? "busy" : "free";
          const label = tone === "yours" ? "Yours" : tone === "busy" ? "In use" : "Free";
          return (
            <Row key={`${i.name}-${n}`}>
              <Dot tone={tone} />
              {/* Sample type belongs beside the name; the right column is for
                  availability only, so each row has one right-hand signal. */}
              <span className="min-w-0 flex-1 truncate text-[12px] text-slate-200">
                {i.name}
                {i.category ? (
                  <span className="ml-2 hidden text-[11px] text-slate-500 sm:inline">
                    {humanize(i.category)}
                  </span>
                ) : null}
              </span>
              <span className={`shrink-0 text-[11px] font-medium ${TONE_TEXT[tone]}`}>{label}</span>
            </Row>
          );
        })}
      </div>
    );
  }

  if (tool === "get_my_bookings") {
    const rows: any[] = data.bookings ?? [];
    if (!rows.length) return <Empty what="you have no bookings yet" />;
    return (
      <div>
        {rows.map((b, n) => (
          <Row key={`${b.instrument}-${n}`}>
            <span className="flex-1 truncate text-[12px] text-slate-200">{b.instrument}</span>
            <span className="text-[11px] tabular-nums text-slate-400">
              {fmtRange(b.start, b.end)}
            </span>
            <span className="text-[11px] text-slate-500">{humanize(b.status)}</span>
          </Row>
        ))}
      </div>
    );
  }

  if (tool === "get_my_glassware_loans") {
    const rows: any[] = data.loans ?? [];
    if (!rows.length) return <Empty what="nothing is checked out to you" />;
    return (
      <div>
        {rows.map((l, n) => (
          <Row key={`${l.name}-${n}`}>
            <span className="flex-1 truncate text-[12px] text-slate-200">{l.name}</span>
            {l.code ? <span className="text-[11px] text-slate-500">{l.code}</span> : null}
            <span className="text-[11px] tabular-nums text-slate-400">×{l.quantity}</span>
            <span className="text-[11px] text-slate-500">{fmtDay(l.borrowed)}</span>
          </Row>
        ))}
      </div>
    );
  }

  if (tool === "search_reagents") {
    const rows: any[] = data.matches ?? [];
    if (!rows.length) return <Empty what="no chemical matched that name" />;
    return (
      <div>
        {rows.map((r, n) => (
          <Row key={`${r.name}-${n}`}>
            <span className="flex-1 truncate text-[12px] text-slate-200">{r.name}</span>
            <span className="text-[11px] text-slate-500">
              {[r.size, r.unit].filter(Boolean).join(" ")}
            </span>
            <span className="hidden text-[11px] text-slate-500 sm:inline">{r.location ?? "—"}</span>
          </Row>
        ))}
      </div>
    );
  }

  if (tool === "list_supervisors") {
    const rows: any[] = data.supervisors ?? [];
    if (!rows.length) return <Empty what="no supervisors on record" />;
    const shown = rows.slice(0, 8);
    return (
      <div>
        {shown.map((s, n) => (
          <Row key={`${s.name}-${n}`}>
            <span className="flex-1 truncate text-[12px] text-slate-200">{s.name}</span>
            <span className="hidden text-[11px] text-slate-500 sm:inline">
              {s.researchGroup ?? "—"}
            </span>
            <span className="text-[11px] tabular-nums text-slate-500">{s.nip ?? "no NIP"}</span>
          </Row>
        ))}
        {rows.length > shown.length ? (
          <p className="pt-1 text-[11px] text-slate-500">+{rows.length - shown.length} more</p>
        ) : null}
      </div>
    );
  }

  return <p className="py-2 text-[12px] text-slate-500">No preview available.</p>;
}

function StepBlock({ step, onToggle }: { step: Step; onToggle: () => void }) {
  const { label, icon: Icon } = metaFor(step.tool);
  const summary = step.running ? "checking…" : summarize(step.tool, step.data);
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/50">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={step.open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-800/50"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        {/* Past tense makes this read as work that happened, not as a static card. */}
        <span className="text-[11px] font-medium text-slate-300">Checked {label.toLowerCase()}</span>
        <span className="truncate text-[11px] text-slate-400">· {summary}</span>
        {step.running ? (
          <Loader2 className="ml-auto h-3 w-3 shrink-0 animate-spin text-orange-400" />
        ) : (
          <ChevronRight
            className={`ml-auto h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform ${
              step.open ? "rotate-90" : ""
            }`}
          />
        )}
      </button>
      {step.open && step.data ? (
        <div className="border-t border-slate-700/50 px-3 pb-1">
          {/* Cap the measure: a name on the far left and a status 900px away is
              not a row, it is two labels with a corridor between them. */}
          <div className="max-w-3xl">
            <StepDetail tool={step.tool} data={step.data} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- starters */

const STARTERS = [
  { icon: FlaskConical, label: "What's free right now?", hint: "Live instrument status", prompt: "Which instruments are free right now?" },
  { icon: CalendarDays, label: "What are my bookings?", hint: "Your reservations", prompt: "Show me my instrument bookings." },
  { icon: Package, label: "What do I still have out?", hint: "Glassware on loan", prompt: "What glassware do I still have on loan?" },
  { icon: Beaker, label: "Find a chemical", hint: "Inventory search", prompt: "Do we have any acetic acid in the inventory?" },
];

const GREETING =
  "Hey, I'm LUMA — your lab agent. Ask me anything about the lab, or start with one of these.";

/** Mirrors the five read tools in src/lib/luma-tools.ts — keep them in step. */
const CAPABILITIES = [
  { name: "Instrument availability", detail: "every instrument, free or in use" },
  { name: "Your bookings", detail: "dates, instrument, status" },
  { name: "Glassware loans", detail: "what you still have out" },
  { name: "Chemical inventory", detail: "stock, size, location" },
  { name: "Supervisors", detail: "name, NIP, research group" },
];

/* --------------------------------------------------------------- screen */

export function LumaChat({
  onOpenRail,
  userId,
}: {
  onOpenRail?: () => void;
  /** Used to key stored threads so one account never inherits another's. */
  userId?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: GREETING, steps: [] },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  /** False until the stored thread has been read, so we never save over it. */
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const started = messages.length > 1;

  /* Restore the thread on mount. Runs once; storage is per-tab and per-user. */
  useEffect(() => {
    if (!userId) {
      setHydrated(true);
      return;
    }
    const restored = loadThread(userId);
    if (restored) setMessages(restored);
    setHydrated(true);
  }, [userId]);

  /* Persist on every change, but only after hydration — otherwise the initial
     greeting would overwrite a stored thread before it is read. */
  useEffect(() => {
    if (!hydrated || !userId) return;
    if (messages.length < 2) {
      clearThread(userId);
      return;
    }
    saveThread(userId, messages);
  }, [messages, hydrated, userId]);

  /**
   * Files stay attached until removed, and are re-sent with every turn. That is
   * what makes "now plot it" work as a follow-up: the server keeps nothing, so
   * the client is the only place the file can live.
   */
  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    setAttachError(null);
    const list = Array.from(incoming);
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setAttachError(`Up to ${MAX_ATTACHMENTS} files per message.`);
      return;
    }
    const accepted: Attachment[] = [];
    for (const f of list.slice(0, room)) {
      if (f.size > MAX_FILE_BYTES) {
        setAttachError(`${f.name} is ${humanSize(f.size)} — the limit is 3 MB.`);
        continue;
      }
      try {
        const data = await readAsBase64(f);
        accepted.push({
          name: f.name,
          mime: guessMime(f.name, f.type),
          data,
          size: f.size,
        });
      } catch {
        setAttachError(`${f.name} could not be read.`);
      }
    }
    if (accepted.length) setAttachments((cur) => [...cur, ...accepted].slice(0, MAX_ATTACHMENTS));
  }, [attachments.length]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((cur) => cur.filter((_, i) => i !== index));
    setAttachError(null);
  }, []);

  /** Start over. Deliberately two-step: a mis-tap should not cost a thread. */
  const startNewThread = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
    setMessages([{ role: "assistant", text: GREETING, steps: [] }]);
    setInput("");
    setAttachments([]);
    setAttachError(null);
    setConfirmNew(false);
    if (userId) clearThread(userId);
  }, [userId]);

  /* keep the newest content in view */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* grow the composer with its content, up to a ceiling */
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const toggleStep = useCallback((msgIndex: number, stepIndex: number) => {
    setMessages((cur) => {
      const next = [...cur];
      const msg = { ...next[msgIndex], steps: [...next[msgIndex].steps] };
      msg.steps[stepIndex] = { ...msg.steps[stepIndex], open: !msg.steps[stepIndex].open };
      next[msgIndex] = msg;
      return next;
    });
  }, []);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (busy) return;
    // A file on its own is a valid turn — "here is my scan" needs no words.
    if (!text && attachments.length === 0) return;
    if (!textOverride) setInput("");

    const sent = attachments;
    const prior = messages;
    setMessages([
      ...prior,
      {
        role: "user",
        text,
        steps: [],
        files: sent.map((a) => ({ name: a.name, mime: a.mime })),
      },
      { role: "assistant", text: "", steps: [] },
    ]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    /* patch the trailing assistant message */
    const patchLast = (fn: (m: Msg) => Msg) =>
      setMessages((cur) => {
        const next = [...cur];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") next[next.length - 1] = fn(last);
        return next;
      });

    try {
      const res = await fetch("/api/luma/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...prior, { role: "user" as const, text: text || "Here is an attached file." }]
            .filter((m) => m.text.trim().length > 0)
            .map((m) => ({ role: m.role, content: m.text })),
          attachments: sent.map((a) => ({ name: a.name, mime: a.mime, data: a.data })),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let msg = `Request failed (${res.status})`;
        try {
          const j = await res.json();
          msg = j?.message ?? j?.error ?? msg;
        } catch {
          const txt = await res.text().catch(() => "");
          if (txt) msg = txt.slice(0, 300);
        }
        patchLast((m) => ({ ...m, text: msg }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let chunk: any;
          try {
            chunk = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (chunk.type === "token") {
            const t = chunk.text ?? "";
            if (t) patchLast((m) => ({ ...m, text: m.text + t }));
          } else if (chunk.type === "tools") {
            // Show each tool as a pending step the moment it is called.
            const names: string[] = chunk.names ?? [];
            patchLast((m) => ({
              ...m,
              steps: [
                ...m.steps,
                ...names.map((tool) => ({ tool, data: null, open: false, running: true })),
              ],
            }));
          } else if (chunk.type === "tool_result") {
            patchLast((m) => {
              const steps = [...m.steps];
              // Fill the newest matching running step; otherwise append.
              const idx = [...steps].reverse().findIndex((s) => s.tool === chunk.tool && s.running);
              if (idx >= 0) {
                const real = steps.length - 1 - idx;
                steps[real] = { ...steps[real], data: chunk.data ?? null, running: false };
              } else {
                steps.push({ tool: chunk.tool, data: chunk.data ?? null, open: false, running: false });
              }
              return { ...m, steps };
            });
          } else if (chunk.type === "image") {
            // A figure rendered server-side. It arrives as base64 so there is
            // no file to store, serve, or clean up.
            patchLast((m) => ({
              ...m,
              images: [
                ...(m.images ?? []),
                {
                  mime: chunk.mime ?? "image/png",
                  data: chunk.data ?? "",
                  caption: chunk.caption,
                },
              ],
            }));
          } else if (chunk.type === "done") {
            patchLast((m) => ({ ...m, steps: m.steps.map((s) => ({ ...s, running: false })) }));
          } else if (chunk.type === "error") {
            patchLast((m) => ({
              ...m,
              text: m.text || `⚠ ${chunk.message}`,
              steps: m.steps.map((s) => ({ ...s, running: false })),
            }));
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        patchLast((m) => ({ ...m, text: m.text || `⚠ ${String(e)}` }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header — no card, no repetition of the nav label */}
      <header className="flex shrink-0 items-center gap-3 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight text-white">LUMA</h1>
          <p className="truncate text-xs text-slate-400">
            <span className="sm:hidden">Lab agent · read-only</span>
            <span className="hidden sm:inline">
              Lab agent · reads live availability, your bookings and loans
            </span>
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Read-only
          </span>
          {/* Only offered when there is something to clear. */}
          {started ? (
            <button
              type="button"
              onClick={() => setConfirmNew(true)}
              disabled={busy}
              aria-label="Start a new chat"
              title="Start a new chat"
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:text-white disabled:opacity-40 sm:min-h-0 sm:px-2.5 sm:py-1"
            >
              <RotateCcw className="h-3 w-3" />
              New
            </button>
          ) : null}
          {/* The rail is hidden below xl, so it must stay reachable here. */}
          {onOpenRail ? (
            <button
              type="button"
              onClick={onOpenRail}
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:text-white sm:min-h-0 sm:px-2.5 sm:py-1 xl:hidden"
            >
              <FlaskConical className="h-3 w-3" />
              Lab status
            </button>
          ) : null}
        </div>
      </header>

      {/* Two-step reset: keeps a mis-tap from destroying the thread. */}
      {confirmNew ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">Start a new chat? This clears the current one.</span>
          <button
            type="button"
            onClick={startNewThread}
            className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setConfirmNew(false)}
            className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:text-white"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* conversation */}
      <div
        ref={scrollRef}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          // Only clear when the pointer actually leaves the panel, not when it
          // crosses a child element.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
        }}
        className={`relative min-h-0 flex-1 overflow-y-auto rounded-xl border bg-slate-800/30 p-4 sm:p-5 ${
          dragging ? "border-orange-500/60 ring-2 ring-orange-500/20" : "border-slate-700/60"
        }`}
      >
        {dragging ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-900/80">
            <p className="flex items-center gap-2 text-sm font-medium text-orange-300">
              <Paperclip className="h-4 w-4" />
              Drop to attach
            </p>
          </div>
        ) : null}
        {!started ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-700/40 text-slate-400">
                <Bot className="h-4 w-4" />
              </div>
              <p className="text-sm leading-relaxed text-slate-300">{GREETING}</p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => void send(s.prompt)}
                  disabled={busy}
                  className="group flex items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-left transition-colors hover:border-orange-500/40 hover:bg-orange-500/[0.06] disabled:opacity-50"
                >
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-orange-300" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-slate-200">
                      {s.label}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">{s.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Real content, not filler: this is exactly what the tools read,
                and it fills the panel that would otherwise be a hole. */}
            <div className="mt-5 rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                What I can read
              </p>
              {/* Phones: one wrapping line. A five-row list costs ~150px and
                  pushes the starter chips below the fold on a 640px screen. */}
              <p className="mt-2 text-[12px] leading-relaxed text-slate-400 sm:hidden">
                {CAPABILITIES.map((c) => c.name.toLowerCase()).join(" · ")}
              </p>
              <ul className="mt-2 hidden space-y-1.5 sm:block">
                {CAPABILITIES.map((c) => (
                  <li
                    key={c.name}
                    className="flex flex-col text-[12px] sm:flex-row sm:items-baseline sm:gap-2"
                  >
                    <span className="shrink-0 text-slate-300 sm:w-[132px] sm:truncate">
                      {c.name}
                    </span>
                    <span className="min-w-0 text-slate-500 sm:flex-1 sm:truncate">
                      {c.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* anchors the bottom edge so the panel closes deliberately */}
            <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-slate-700/40 pt-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                Live lab data
              </span>
              <span aria-hidden>·</span>
              <span>plots your data files</span>
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <span className="hidden sm:inline">remembers your past questions</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="flex max-w-[85%] flex-col items-end gap-1.5">
                      {m.files?.length ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {m.files.map((f, fi) => (
                            <span
                              key={fi}
                              className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/70 px-2 py-1 text-[11px] text-slate-300"
                            >
                              <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                              <span className="max-w-[180px] truncate">{f.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {m.text ? (
                        <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-orange-500/15 px-4 py-2.5 text-sm text-white ring-1 ring-orange-500/25">
                          {m.text}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }

              const isPlaceholder = !m.text && m.steps.length === 0;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-700/40 text-slate-400">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* the work behind the answer */}
                    {m.steps.map((s, si) => (
                      <StepBlock key={`${s.tool}-${si}`} step={s} onToggle={() => toggleStep(i, si)} />
                    ))}

                    {m.text ? (
                      <RichText text={m.text} />
                    ) : isPlaceholder ? (
                      <div className="flex items-center gap-2 py-1 text-xs text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Working…
                      </div>
                    ) : null}

                    {/* Figures. Rendered by the Python sidecar and streamed in
                        as base64, so they need no storage or cleanup. */}
                    {m.images?.length ? (
                      <div className="mt-2 space-y-2">
                        {m.images.map((img, ii) => (
                          <figure
                            key={ii}
                            className="overflow-hidden rounded-xl border border-slate-700/60 bg-white"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`data:${img.mime};base64,${img.data}`}
                              alt={img.caption ?? "Figure"}
                              className="block h-auto w-full"
                            />
                            {img.caption ? (
                              <figcaption className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
                                {img.caption}
                              </figcaption>
                            ) : null}
                          </figure>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mt-3 shrink-0"
      >
        {attachments.length > 0 || attachError ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Paperclip className="h-3 w-3" />
              Attached
              <span className="hidden text-slate-600 sm:inline">
                · re-sent with each message
              </span>
            </span>
            {attachments.map((a, i) => (
              <span
                key={`${a.name}-${i}`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/70 py-1 pl-2 pr-1 text-[11px] text-slate-300"
              >
                <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                <span className="max-w-[150px] truncate">{a.name}</span>
                <span className="shrink-0 text-slate-500">{humanSize(a.size)}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Remove ${a.name}`}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {attachError ? (
              <span className="text-[11px] text-amber-400">{attachError}</span>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-xl border border-slate-700/60 bg-slate-900/70 p-2 transition-colors focus-within:border-orange-500/50">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".csv,.txt,.xy,.dat,.tsv,.asc,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Attach a data file or image"
            title="Attach a data file or image"
            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40 sm:h-9"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files ?? []);
              if (files.length) {
                e.preventDefault();
                void addFiles(files);
              }
            }}
            rows={1}
            placeholder="Ask about the lab, or attach a scan…"
            aria-label="Message LUMA"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-base text-white placeholder-slate-500 outline-none sm:text-sm"
            disabled={busy}
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 sm:h-9"
            >
              <span className="h-2.5 w-2.5 rounded-[2px] bg-current" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() && attachments.length === 0}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:h-9"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-slate-500">
          Enter to send · Shift+Enter for a new line
        </p>
      </form>
    </div>
  );
}
