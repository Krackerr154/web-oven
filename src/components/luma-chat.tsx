"use client";

import { useRef, useState } from "react";
import { Bot, Send, Loader2 } from "lucide-react";

type Msg = {
  role: "user" | "assistant";
  text: string;
};

export function LumaChat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hey. I’m LUMA. Ask me what’s in the lab, your borrowing status, or what’s free right now.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const prior = messages;
    setMessages([...prior, { role: "user", text }, { role: "assistant", text: "" }]);
    setBusy(true);
    setToolStatus(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/luma/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // `prior` is UI state ({role, text}); the API expects {role, content}.
          // Dropping empty assistant bubbles too — they are placeholders.
          messages: [...prior, { role: "user" as const, text }]
            .filter((m) => m.text.trim().length > 0)
            .map((m) => ({ role: m.role, content: m.text })),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") last.text = `⚠ ${res.status}: ${txt}`;
          return next;
        });
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
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") last.text += chunk.text ?? "";
              return next;
            });
          } else if (chunk.type === "tools") {
            setToolStatus(`Fetching ${chunk.names?.join(", ")}…`);
          } else if (chunk.type === "tool_result") {
            setToolStatus(`Got ${chunk.tool}.`);
          } else if (chunk.type === "done") {
            setToolStatus(null);
          } else if (chunk.type === "error") {
            setToolStatus(null);
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") last.text = `⚠ ${chunk.message}`;
              return next;
            });
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") last.text = `⚠ ${String(e)}`;
          return next;
        });
      }
    } finally {
      setBusy(false);
      setToolStatus(null);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">LUMA</h1>
          <p className="text-xs text-slate-400">
            Your lab agent — reads live availability, your bookings, your loans. Read-only for v1.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-orange-500/15 text-white ring-1 ring-orange-500/30"
                    : "bg-slate-900/60 text-slate-200 ring-1 ring-slate-700/60"
                }`}
              >
                {m.text ? (
                  m.text
                ) : busy && i === messages.length - 1 ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                ) : null}
              </div>
            </div>
          ))}
          {toolStatus && (
            <div className="text-center text-xs italic text-slate-500">
              {toolStatus}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Ask about instruments, your bookings, chemicals…"
          className="flex-1 resize-none rounded-lg border border-slate-700/60 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500/50"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-300 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
        {busy && (
          <button
            type="button"
            onClick={cancel}
            className="flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 px-3 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Stop
          </button>
        )}
      </form>
    </div>
  );
}
