"use client";

import { useRef, useState } from "react";
import type { RosterPayload } from "@/types";

interface Msg { role: "user" | "assistant"; content: string }

const QUICK = [
  "Suggest improvements to my roster",
  "Why is my roster illegal?",
  "Am I spending my budget efficiently?",
];

export default function CoachChat({ payload }: { payload: RosterPayload }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Coach unavailable");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setTimeout(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coach unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <h2 className="font-semibold">Ask the coach</h2>
        <span className="text-xs text-gray-400">{open ? "hide" : "show"}</span>
      </button>

      {open && (
        <div className="mt-3">
          <div ref={scroller} className="max-h-72 space-y-2 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-xs text-gray-500">Ask about your roster — improvements, why it&apos;s illegal, efficient buys. The coach sees your current roster and the ruleset. Suggestions, not gospel.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <div className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-lion-red text-white" : "bg-gray-100 text-gray-800"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-gray-400">Coach is thinking…</div>}
          </div>

          {messages.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button key={q} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-200" onClick={() => send(q)} disabled={busy}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {error && <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}

          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input className="input flex-1 py-1.5 text-sm" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the coach…" disabled={busy} />
            <button className="btn btn-primary py-1.5" type="submit" disabled={busy || !input.trim()}>Send</button>
          </form>
        </div>
      )}
    </div>
  );
}
