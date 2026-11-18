import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toolList, toToolDef, validateToolArgs, executeTool } from "@/lib/luma-tools";
import { resolveLumaAccess } from "@/lib/luma-access";
import { recallMemories, retainMemory, formatMemories } from "@/lib/hindsight";
import {
  MAX_ATTACHMENTS,
  describeAttachments,
  isImage,
  parseTabular,
  type Attachment,
} from "@/lib/luma-files";
import { PlotSpec, executePlot } from "@/lib/luma-plot";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tools return JSON strings. The client needs the fields, not a truncated
 * string, so parse before forwarding. A malformed payload degrades to an
 * error object the UI can render as a failed step instead of crashing.
 */
function parseToolPayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { error: "unreadable tool output", detail: raw.slice(0, 160) };
  }
}

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
  /**
   * Files ride along with the request and are never persisted. The client
   * re-sends them while the attachment chip is on screen, which is what makes
   * a follow-up turn ("now plot it") work without any server-side storage.
   */
  attachments: z
    .array(
      z.object({
        name: z.string().max(200),
        mime: z.string().max(120),
        data: z.string().max(6_000_000),
      }),
    )
    .max(MAX_ATTACHMENTS)
    .optional(),
});

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  /** A string, or an OpenAI content-part array when images are attached. */
  content: string | any[];
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

/**
 * Read the caller's id straight from the cookie.
 *
 * getServerSession returns null inside a Route Handler here, so the token is
 * decoded directly. The returned id is then handed to resolveLumaAccess, which
 * owns every access decision — this function only answers "who".
 */
async function callerIdFromRequest(req: NextRequest): Promise<string | null> {
  const token =
    (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) ??
    (await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: "__Secure-next-auth.session-token",
    }));
  if (!token) return null;
  return (token.userId as string) ?? (token.sub as string) ?? null;
}

export async function POST(req: NextRequest) {
  const callerId = await callerIdFromRequest(req);
  const access = await resolveLumaAccess(prisma, callerId);

  if (!access.allowed) {
    return new Response(
      JSON.stringify({ error: access.reason, message: access.message }),
      {
        status: access.reason === "signed-out" ? 401 : 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const caller = { id: access.userId, name: access.name };

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

  // Files are parsed once, here. Images go to the model as vision parts;
  // tabular files become datasets the plot tool can address by column name.
  const attachments = (parsed.data.attachments ?? []) as Attachment[];
  const report = parseTabular(attachments);
  const hasData = report.datasets.length > 0;
  const hasImages = report.images.length > 0;

  // Recall the caller's own memory bank before answering. Failure here is
  // non-fatal by design: a chat without memory beats no chat at all.
  const lastUserText =
    [...parsed.data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const memories = await recallMemories(access.bankId, lastUserText, 6);

  const sys: ChatMessage = {
    role: "system",
    content: [
      `You are LUMA, the lab assistant for AP-Lab, owned by ${caller.name} (agent handle: ${access.handle}).`,
      ...(memories.length > 0 ? [formatMemories(memories)] : []),
      "You help with scheduling, inventory, instruments, reagents, glassware and navigating the app.",
      "You can read live lab data via tools. Use tools when the user asks about their own bookings, glassware, instrument availability, reagents or supervisors.",
      "The interface already renders every tool result as its own structured panel of rows — instruments, bookings, loans, chemicals, supervisors. The user can see that data.",
      "So do NOT re-list the rows you just fetched. Answer in one or two sentences: state the headline fact, add any judgement or caveat the rows do not show (for example which item suits their purpose), and stop. Listing the same items again as bullets is a defect, not thoroughness.",
      "Use plain prose. Avoid markdown tables and avoid heading syntax. A short list is acceptable only for things that are NOT already in a panel.",
      "Never invent instrument statuses, stock counts or bookings — fetch the tool first.",
      "This is phase 1: you read only. If a user asks to book or modify, say that web booking actions land soon and point them to the existing /book page for now.",
      ...(hasData || hasImages
        ? ["", "ATTACHMENTS IN THIS MESSAGE:", describeAttachments(report)]
        : []),
      ...(hasData
        ? [
            "To show a figure, call render_plot with the dataset index and the exact column names listed above. The figure is rendered server-side and appears in the chat by itself.",
            "Never paste raw numbers, long tables or the data itself into your reply — the figure carries them. After rendering, say in one sentence what the figure shows and stop.",
            "If the user asks for a plot and no dataset is attached, say so plainly and ask them to attach the file.",
          ]
        : []),
      ...(hasImages
        ? [
            "The user attached an image and you can see it. Read what matters from it — labels, readings, error codes, peak positions — and answer. Do not transcribe the whole image.",
          ]
        : []),
      "Answer in the user's language (English or Indonesian).",
    ].join(" "),
  };

  const history: ChatMessage[] = [sys, ...(parsed.data.messages as ChatMessage[])];

  // Attach images to the most recent user turn as vision content parts. Only
  // that turn carries them: replaying the same photo on every turn would
  // multiply the token cost for no benefit.
  if (hasImages) {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (lastUser) {
      const parts: any[] = [{ type: "text", text: String(lastUser.content) }];
      for (const img of report.images) {
        const att = attachments[img.index];
        if (!att) continue;
        parts.push({
          type: "image_url",
          image_url: { url: `data:${att.mime};base64,${att.data}` },
        });
      }
      lastUser.content = parts;
    }
  }

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
              tools: hasData ? [...toolList(), toToolDef(PlotSpec as any)] : toolList(),
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
            type Rendered = { png: string; caption: string } | null;
            const results = await Promise.all(
              validCalls.map(async (call) => {
                let parsedArgs: any = {};
                try {
                  parsedArgs = JSON.parse(call.function.arguments || "{}");
                } catch {
                  parsedArgs = {};
                }

                // render_plot is handled here, not in executeTool: it needs the
                // parsed datasets and it returns an image, not JSON rows.
                if (call.function.name === PlotSpec.name) {
                  // Models occasionally send a numeric index as a string.
                  if (typeof parsedArgs?.dataset === "string" && /^\d+$/.test(parsedArgs.dataset)) {
                    parsedArgs.dataset = Number(parsedArgs.dataset);
                  }
                  const v = PlotSpec.schema.safeParse(parsedArgs);
                  if (!v.success) {
                    return {
                      call,
                      output: JSON.stringify({
                        error: "invalid args",
                        detail: v.error.issues.map((i) => i.message).join("; "),
                      }),
                      image: null as Rendered,
                    };
                  }
                  const r = await executePlot(v.data as any, report.datasets);
                  if (!r.ok) {
                    return { call, output: JSON.stringify({ error: r.error }), image: null as Rendered };
                  }
                  return {
                    call,
                    // The model gets a receipt, never the base64 — echoing a
                    // 60 kB image back into the prompt would blow the context.
                    output: JSON.stringify({ rendered: true, caption: r.caption, bytes: r.bytes }),
                    image: { png: r.png, caption: r.caption } as Rendered,
                  };
                }

                const v = validateToolArgs(call.function.name, parsedArgs);
                const output = v.ok
                  ? await executeTool(call.function.name, v.value, { userId: caller.id, prisma })
                  : JSON.stringify({ error: "invalid args", detail: (v as any).error });
                return { call, output, image: null as Rendered };
              }),
            );

            for (const { call, output, image } of results) {
              // Send the parsed payload, not a 160-char string: the client renders
              // instrument rows, bookings and reagent hits from these fields.
              write({ type: "tool_result", tool: call.function.name, data: parseToolPayload(output) });
              if (image) {
                write({ type: "image", mime: "image/png", data: image.png, caption: image.caption });
              }
              history.push({
                role: "tool",
                tool_call_id: call.id || call.function.name,
                name: call.function.name,
                content: output,
              });
            }
            continue; // next turn to get the rendered answer
          }

          // No tool calls: this is the final answer.
          // Retain the exchange in the caller's own bank so tomorrow's session
          // starts where this one ended. Deliberately fire-and-forget — the
          // reply must not wait on an extraction pass.
          if (assistantContent.trim() && lastUserText.trim()) {
            void retainMemory(
              access.bankId,
              `User asked: ${lastUserText}\nLUMA answered: ${assistantContent}`,
              "AP-Lab web chat conversation",
              { timestamp: new Date().toISOString() },
            );
          }
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
