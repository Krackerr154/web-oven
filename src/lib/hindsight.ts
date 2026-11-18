/**
 * Hindsight memory client.
 *
 * Hindsight is the same memory service the WhatsApp LUMA profile already uses
 * (`res-gerald-bank`). Pointing the web chat at the same bank per person is
 * what turns "a chat I have to re-explain myself to" into "my assistant that
 * knows my work" — without touching Hermes or opening any inbound door.
 *
 * Bank naming is deliberate: `res-<handle>-bank` is exactly the convention the
 * Hermes profiles use, so a member's web chat and their WhatsApp agent read and
 * write one shared memory. Handle is frozen at grant, which is why it is safe
 * to derive a durable storage key from it.
 *
 * Nothing here is authoritative. If Hindsight is down, chat still works — it
 * just answers without memory. Memory must never be a hard dependency of the
 * conversation.
 */

const BASE = (process.env.HINDSIGHT_URL ?? "http://host.docker.internal:8888").replace(/\/$/, "");
const API_KEY = process.env.HINDSIGHT_API_KEY ?? "";

/** `gerald` -> `res-gerald-bank`. Matches the Hermes profile convention. */
export function bankIdForHandle(handle: string): string {
  return `res-${handle}-bank`;
}

export type MemoryHit = {
  text: string;
  type?: string;
  occurred?: string | null;
  score?: number;
};

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fn(ctl.signal);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Recall memories relevant to a query.
 * Returns [] on any failure — a memory lookup must never break a reply.
 */
export async function recallMemories(
  bankId: string,
  query: string,
  limit = 6,
): Promise<MemoryHit[]> {
  if (!query.trim()) return [];
  try {
    return await withTimeout(7000, async (signal) => {
      const res = await fetch(`${BASE}/v1/default/banks/${encodeURIComponent(bankId)}/memories/recall`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ query, limit, prefer_observations: true }),
        signal,
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      return results.map((r: any) => ({
        text: String(r?.text ?? ""),
        type: r?.type,
        occurred: r?.occurred_start ?? null,
        score: r?.scores?.final,
      })).filter((m: MemoryHit) => m.text.length > 0);
    });
  } catch {
    return [];
  }
}

/**
 * Store one memory. Fire-and-forget by default: Hindsight runs an LLM
 * extraction pass, which is far too slow to sit inside a chat reply.
 */
export async function retainMemory(
  bankId: string,
  content: string,
  context: string,
  opts: { timestamp?: string; wait?: boolean } = {},
): Promise<boolean> {
  if (!content.trim()) return false;
  try {
    return await withTimeout(opts.wait ? 45000 : 20000, async (signal) => {
      const res = await fetch(`${BASE}/v1/default/banks/${encodeURIComponent(bankId)}/memories`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          items: [
            {
              content,
              context,
              ...(opts.timestamp ? { timestamp: opts.timestamp } : {}),
              metadata: { source: "ap-lab-web" },
            },
          ],
          async: !opts.wait,
        }),
        signal,
      });
      return res.ok;
    });
  } catch {
    return false;
  }
}

/** Turn recalled hits into a compact system-prompt block. */
export function formatMemories(hits: MemoryHit[]): string {
  if (hits.length === 0) return "";
  const lines = hits.map((h) => `- ${h.text.replace(/\s+/g, " ").trim()}`);
  return [
    "Things you already remember about this person and their work (from your long-term memory — treat as background knowledge, not as something they just said):",
    ...lines,
  ].join("\n");
}
