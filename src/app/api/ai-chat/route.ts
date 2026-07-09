import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { AI_CHAT_TOOLS, runTool } from "@/lib/ai/tools";

export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";
const MAX_TOOL_ITERATIONS = 8;

const SYSTEM_PROMPT = `You are an internal assistant embedded in the Kemble admin dashboard. You help admins look up information about users unified from Amplitude, Wix, and Typeform.

Use the available tools to look up real data rather than guessing — call search_users first if you don't already have a userId. Keep responses concise; admins are scanning quickly, not reading reports. When comparing a numeric value across a few users, consider using render_chart instead of a text table.`;

function sseLine(event: Record<string, unknown>) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const history = body.messages as Anthropic.MessageParam[] | undefined;
  if (!Array.isArray(history) || history.length === 0) {
    return new Response(JSON.stringify({ error: "messages is required" }), { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
      status: 500,
    });
  }

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [...history];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(sseLine(event)));

      try {
        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
          const modelStream = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            thinking: { type: "adaptive" },
            system: SYSTEM_PROMPT,
            tools: AI_CHAT_TOOLS,
            messages,
          });

          modelStream.on("text", (delta) => {
            send({ type: "text_delta", text: delta });
          });

          const finalMessage = await modelStream.finalMessage();
          messages.push({ role: "assistant", content: finalMessage.content });

          if (finalMessage.stop_reason !== "tool_use") {
            send({ type: "done", messages });
            controller.close();
            return;
          }

          const toolUseBlocks = finalMessage.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of toolUseBlocks) {
            if (block.name === "render_chart") {
              send({ type: "chart", chart: block.input });
            }
            const result = await runTool(block.name, block.input, block.id);
            toolResults.push({
              type: "tool_result",
              tool_use_id: result.toolUseId,
              content: result.content,
              is_error: result.isError,
            });
          }

          messages.push({ role: "user", content: toolResults });
        }

        send({ type: "error", message: "Reached the tool-call limit for this turn." });
        controller.close();
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
