import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toolList, validateToolArgs, executeTool } from "@/lib/luma-tools";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_TURNS = 5;

const inputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "tool"]),
        content: z.string().max(8000),
        tool_call_id: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
});

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

function encoder() {
  return new TextEncoder();
}

function sseLine(obj: any): Uint8Array {
  return encoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

import { getToken } from "next-auth/jwt";

// ...

async function resolveCaller(req: NextRequest): Promise<{ id: string; name: string } | null> {
  const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) ??
    (await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: "__Secure-next-auth.session-token" }));
  if (!token) return null;
  const userId = (token.userId as string) ?? (token.sub as string);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, status: true, roles: true },
  });
  if (!user) return null;
  if (user.status !== "APPROVED") return null;
  return { id: user.id, name: user.name };
}

export async function POST(req: NextRequest) {
  const caller = await resolveCaller(req);
  if (!caller) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.LU_API_KEY || process.env.RDHX_API_KEY;
  const baseUrl = (process.env.LUMA_BASE_URL ?? "http://host.docker.internal:20128/v1").replace(/\/$/, "");
  const model = process.env.LUMA_MODEL ?? "deepseek-v4.1-flash";
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "provider not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sys: ChatMessage = {
    role: "system",
    content: [
      `You are LUMA, the lab assistant for AP-Lab, owned by ${caller.name}.`,
      "You help with scheduling, inventory, instruments, reagents, glassware and navigating the app.",
      "You can read live lab data via tools. Use tools when the user asks about their own bookings, glassware, instrument availability, reagents or supervisors.",
      "Be concise. When listing items, lead with a plain sentence of what matters, then give a compact list.",
      "Never invent instrument statuses, stock counts or bookings — fetch the tool first.",
      "This is phase 1: you read only. If a user asks to book or modify, say that web booking actions land soon and point them to the existing /book page for now.",
      "Answer in the user's language (English or Indonesian).",
    ].join(" "),
  };

  const history: ChatMessage[] = [sys, ...parsed.data.messages as ChatMessage[]];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = encoder();
      const write = (o: any) => controller.enqueue(sseLine(o));
      try {
        let turns = 0;
        while (turns < MAX_TURNS) {
          turns += 1;
          const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "text/event-stream",
            },
            body: JSON.stringify({
              model,
              messages: history,
              tools: toolList(),
              tool_choice: "auto",
              stream: true,
              temperature: 0.4,
              max_tokens: 900,
            }),
          });

          if (!res.ok || !res.body) {
            const txt = await res.text().catch(() => res.statusText);
            write({ type: "error", message: `provider ${res.status}: ${txt.slice(0, 300)}` });
            controller.close();
            return;
          }

          // Parse SSE from upstream into OpenAI chunks, accumulating assistant deltas.
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let assistantContent = "";
          let toolCalls: any[] = [];
          let currentToolCall: any = null;
          let finishReason: string | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const raw of lines) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              if (!payload) continue;
              let chunk: any;
              try {
                chunk = JSON.parse(payload);
              } catch {
                continue;
              }
              const choice = (chunk.choices ?? [])[0];
              if (!choice) continue;
              const delta = choice.delta ?? {};
              if (typeof delta.content === "string" && delta.content) {
                assistantContent += delta.content;
                write({ type: "token", text: delta.content });
              }
              if (Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCalls[idx]) toolCalls[idx] = { id: "", type: "function", function: { name: "", arguments: "" } };
                  if (tc.id) toolCalls[idx].id = tc.id;
                  if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                  if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                  currentToolCall = toolCalls[idx];
                }
              }
              if (choice.finish_reason) finishReason = choice.finish_reason;
            }
          }

          // If there are tool calls, run them and continue the loop.
          const validCalls = toolCalls.filter((t) => t && t.function?.name);
          if (validCalls.length > 0) {
            // Emit that tools are being invoked.
            write({ type: "tools", names: validCalls.map((c) => c.function.name) });

            const assistantMsg: ChatMessage = {
              role: "assistant",
              content: assistantContent || "",
              tool_calls: validCalls,
            };
            history.push(assistantMsg);

            // Preserve order; run independent tools in parallel.
            const results = await Promise.all(
              validCalls.map(async (call) => {
                let parsedArgs: any = {};
                try {
                  parsedArgs = JSON.parse(call.function.arguments || "{}");
                } catch {
                  parsedArgs = {};
                }
                const v = validateToolArgs(call.function.name, parsedArgs);
                const output = v.ok
                  ? await executeTool(call.function.name, v.value, { userId: caller.id, prisma })
                  : JSON.stringify({ error: "invalid args", detail: (v as any).error });
                return { call, output };
              }),
            );

            for (const { call, output } of results) {
              write({ type: "tool_result", tool: call.function.name, preview: output.slice(0, 160) });
              history.push({
                role: "tool",
                tool_call_id: call.id || call.function.name,
                name: call.function.name,
                content: output,
              });
            }
            continue; // next turn to get the rendered answer
          }

          // No tool calls, final answer already streamed. Emit done.
          if (!assistantContent) write({ type: "token", text: "" });
          write({ type: "done" });
          controller.close();
          return;
        }

        // turn cap exceeded
        write({ type: "token", text: "\n(I stopped after several tool steps. Please try a more specific question.)" });
        write({ type: "done" });
        controller.close();
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        write({ type: "error", message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
