"use client";

import { useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";

type ChartSpec = {
  type: "bar" | "line";
  title: string;
  data: { label: string; value: number }[];
};

type DisplayMessage = {
  role: "user" | "assistant";
  text: string;
  chart?: ChartSpec;
  error?: boolean;
};

function MiniChart({ chart }: { chart: ChartSpec }) {
  const width = 320;
  const height = 140;
  const padding = 24;
  const max = Math.max(1, ...chart.data.map((d) => d.value));

  return (
    <div className="mt-2 rounded-md border border-kemble-ink/10 bg-white p-3">
      <p className="mb-2 text-xs font-medium text-kemble-ink/70">{chart.title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {chart.type === "bar" ? (
          chart.data.map((d, i) => {
            const barWidth = (width - padding * 2) / chart.data.length - 8;
            const barHeight = (d.value / max) * (height - padding * 2);
            const x = padding + i * ((width - padding * 2) / chart.data.length);
            const y = height - padding - barHeight;
            return (
              <g key={d.label}>
                <rect x={x} y={y} width={barWidth} height={barHeight} className="fill-kemble-coral" />
                <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="fill-kemble-ink/60 text-[8px]">
                  {d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label}
                </text>
              </g>
            );
          })
        ) : (
          <polyline
            fill="none"
            className="stroke-kemble-coral"
            strokeWidth={2}
            points={chart.data
              .map((d, i) => {
                const x = padding + (i * (width - padding * 2)) / Math.max(1, chart.data.length - 1);
                const y = height - padding - (d.value / max) * (height - padding * 2);
                return `${x},${y}`;
              })
              .join(" ")}
          />
        )}
      </svg>
    </div>
  );
}

export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const apiHistory = useRef<Anthropic.MessageParam[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setDisplayMessages((prev) => [...prev, { role: "user", text }]);
    scrollToBottom();

    apiHistory.current = [...apiHistory.current, { role: "user", content: [{ type: "text", text }] }];

    // Placeholder assistant bubble that fills in as text streams.
    setDisplayMessages((prev) => [...prev, { role: "assistant", text: "" }]);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiHistory.current }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim());

          if (event.type === "text_delta") {
            setDisplayMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, text: last.text + event.text };
              return next;
            });
            scrollToBottom();
          } else if (event.type === "chart") {
            setDisplayMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { ...next[next.length - 1], chart: event.chart };
              return next;
            });
            scrollToBottom();
          } else if (event.type === "done") {
            apiHistory.current = event.messages;
          } else if (event.type === "error") {
            setDisplayMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", text: event.message, error: true };
              return next;
            });
          }
        }
      }
    } catch (err) {
      setDisplayMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          text: err instanceof Error ? err.message : "Something went wrong",
          error: true,
        };
        return next;
      });
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[28rem] w-96 flex-col overflow-hidden rounded-lg border border-kemble-ink/10 bg-kemble-cream shadow-xl">
          <div className="flex items-center justify-between border-b border-kemble-ink/10 bg-white px-4 py-3">
            <p className="text-sm font-medium text-kemble-ink">Ask about a user</p>
            <button onClick={() => setOpen(false)} className="text-kemble-ink/40 hover:text-kemble-ink">
              ×
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {displayMessages.length === 0 && (
              <p className="text-sm text-kemble-ink/40">
                Try “find jane@example.com” or “compare session counts for jane and sam”.
              </p>
            )}
            {displayMessages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-kemble-ink text-white"
                      : m.error
                        ? "bg-red-50 text-red-700"
                        : "bg-white text-kemble-ink"
                  }`}
                >
                  {m.text || (sending && i === displayMessages.length - 1 ? "…" : "")}
                </div>
                {m.chart && <MiniChart chart={m.chart} />}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-kemble-ink/10 bg-white p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask a question…"
              disabled={sending}
              className="flex-1 rounded-md border border-kemble-ink/20 px-3 py-1.5 text-sm disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="rounded-md bg-kemble-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="ml-auto block rounded-full bg-kemble-ink px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-kemble-navy"
      >
        {open ? "Close" : "Ask AI"}
      </button>
    </div>
  );
}
