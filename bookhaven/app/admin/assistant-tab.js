"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// The assistant is deliberately a plain request/response panel: no streaming,
// no optimistic "AI is typing" story. It shows exactly what was read, and the
// copy states that nothing can be changed from here.

const SUGGESTIONS = [
  "What needs my attention today?",
  "Summarise the last 7 days.",
  "Which titles are low on stock?",
  "Show orders awaiting dispatch that are unpaid.",
];

function Token({ children }) {
  return (
    <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.85em] text-ink">{children}</code>
  );
}

/** Inline emphasis only — **bold** and `code`. React escapes everything. */
function inline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key} className="font-semibold text-navy">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <Token key={key}>{part.slice(1, -1)}</Token>;
    }
    return <span key={key}>{part}</span>;
  });
}

/** Line-based formatter: paragraphs and bullet lists. No HTML, no tables. */
function MessageBody({ text }) {
  const blocks = useMemo(() => {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let list = null;
    for (const raw of lines) {
      const line = raw.replace(/^\s*#{1,6}\s+/, "").trimEnd();
      if (!line.trim()) {
        if (list) { out.push(list); list = null; }
        continue;
      }
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      if (bullet) {
        if (!list) list = { type: "ul", items: [] };
        list.items.push(bullet[1]);
      } else {
        if (list) { out.push(list); list = null; }
        out.push({ type: "p", text: line });
      }
    }
    if (list) out.push(list);
    return out;
  }, [text]);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, index) =>
        block.type === "ul" ? (
          <ul key={index} className="list-disc space-y-1 pl-5 marker:text-muted">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{inline(item, `${index}-${itemIndex}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{inline(block.text, String(index))}</p>
        )
      )}
    </div>
  );
}

function SnapshotCard({ label, value, hint }) {
  return (
    <div className="rounded-card border border-line bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function ksh(value) {
  return `KSh ${Number(value || 0).toLocaleString("en-KE")}`;
}

export default function AssistantTab() {
  const [state, setState] = useState({ loading: true, error: null, meta: null });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef(null);
  const inputRef = useRef(null);

  // Bumped by "Try again". Kept in state so the effect below owns the request
  // and can ignore a response that arrives after the tab has gone.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Your session has expired. Refresh the page and sign in again.");

        const res = await fetch("/api/admin/agent", {
          headers: { authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Could not load the assistant (${res.status}).`);
        if (!cancelled) setState({ loading: false, error: null, meta: json });
      } catch (err) {
        if (!cancelled) {
          setState({ loading: false, error: err.message || "Could not load the assistant.", meta: null });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setState({ loading: true, error: null, meta: null });
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, busy]);

  const meta = state.meta;
  const configured = Boolean(meta?.configured);
  const snapshot = meta?.snapshot;
  const counts = snapshot?.counts;
  const money = snapshot?.money;
  const inventory = snapshot?.inventory;

  const send = useCallback(
    async (question) => {
      const text = String(question ?? input).trim();
      if (!text || busy || !configured) return;

      const next = [...messages, { role: "user", content: text }];
      setMessages(next);
      setInput("");
      setBusy(true);
      setError("");

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Your session has expired. Refresh the page and sign in again.");

        const res = await fetch("/api/admin/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: next.map(({ role, content }) => ({ role, content })),
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `The assistant could not answer (${res.status}).`);

        setMessages((current) => [
          ...current,
          { role: "assistant", content: json.reply, tools: json.tools || [] },
        ]);
      } catch (err) {
        setError(err.message || "The assistant could not answer just now.");
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, configured, input, messages]
  );

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  if (state.loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3" aria-busy="true" aria-live="polite">
        <div className="h-8 w-56 rounded bg-white border border-line animate-pulse" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-card border border-line bg-white" />
          ))}
        </div>
        <span className="sr-only">Loading the assistant…</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="mx-auto max-w-3xl rounded-card border border-error/30 bg-white p-8 text-center">
        <h2 className="text-lg font-bold text-navy">The assistant didn’t load</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{state.error}</p>
        <button type="button" onClick={retry} className="btn-primary mt-5 min-h-11 text-sm">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.5rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-playfair text-xl font-bold text-navy sm:text-2xl">Store assistant</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-0.5 text-[11px] font-semibold text-muted">
              <span aria-hidden="true">🔒</span> Read-only
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Ask about orders, stock, customers and sales. It reads the live database and cites the
            window it used. It cannot change anything.
          </p>
        </div>
        {meta?.model && (
          <p className="text-[11px] text-muted">
            Model <span className="font-mono text-ink">{meta.model}</span>
          </p>
        )}
      </div>

      {/* Snapshot — real data, no model involved */}
      {snapshot && !snapshot.metrics_error && (
        <section aria-label="Store snapshot" className="mb-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <SnapshotCard
              label="Paid, 7 days"
              value={ksh(money?.net_revenue)}
              hint="Paid and not cancelled"
            />
            <SnapshotCard
              label="Awaiting dispatch"
              value={counts?.awaiting_dispatch ?? 0}
              hint="Pending, processing or packed"
            />
            <SnapshotCard
              label="Low stock"
              value={inventory?.low_stock ?? 0}
              hint="At or below threshold"
            />
            <SnapshotCard
              label="Out of stock"
              value={inventory?.out_of_stock ?? 0}
              hint={`${inventory?.titles ?? 0} live titles`}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Snapshot uses a rolling 7-day window and is computed without the model.
          </p>
        </section>
      )}

      {!configured && (
        <section className="mb-4 rounded-card border border-warning/40 bg-white p-4 sm:p-5">
          <h2 className="font-playfair text-lg font-bold text-navy">The assistant is not switched on yet</h2>
          <p className="mt-1 text-sm text-muted">
            The dashboard is ready, but no model provider key is present in this environment, so the
            chat stays disabled rather than inventing answers. To enable it:
          </p>
          <ol className="mt-3 space-y-2 text-sm text-ink">
            {(meta?.setup || []).map((step, index) => (
              <li key={index} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">
            The key is read only in server code and never reaches the browser. The snapshot above
            keeps working without it.
          </p>
        </section>
      )}

      {/* Conversation */}
      <section
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation with the store assistant"
        aria-busy={busy}
        className="flex-1 space-y-4 overflow-y-auto pb-2"
      >
        {messages.length === 0 && configured && (
          <div className="rounded-card border border-line bg-white p-4 sm:p-5">
            <h2 className="font-playfair text-base font-bold text-navy">Start with a question</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  disabled={busy}
                  className="min-h-11 rounded-full border border-line bg-cream px-3.5 py-2 text-left text-sm text-ink transition hover:border-navy hover:bg-subtle disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === "user";
          return (
            <div key={index} className={`flex gap-2.5 ${isUser ? "justify-end" : ""}`}>
              {!isUser && (
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white"
                >
                  BH
                </span>
              )}
              <div className={`min-w-0 max-w-[92%] sm:max-w-[85%] ${isUser ? "rounded-card bg-navy px-3.5 py-2.5 text-white" : "rounded-card border border-line bg-white px-3.5 py-3"}`}>
                {isUser ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                ) : (
                  <>
                    <MessageBody text={message.content} />
                    {message.tools?.length > 0 && (
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2 text-[11px] text-muted">
                        <span>Read:</span>
                        {message.tools.map((tool) => (
                          <span key={tool} className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-ink">
                            {tool}
                          </span>
                        ))}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex items-center gap-2.5" role="status">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
              BH
            </span>
            <span className="rounded-card border border-line bg-white px-3.5 py-2.5 text-sm text-muted">
              Reading the store…
            </span>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="mt-3 rounded-control border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {/* Composer */}
      <div className="sticky bottom-0 mt-3 bg-stone-50 pb-1 pt-2">
        <label htmlFor="assistant-input" className="sr-only">
          Ask the store assistant
        </label>
        <div className="flex items-end gap-2 rounded-card border border-line bg-white p-2 focus-within:border-navy">
          <textarea
            id="assistant-input"
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, 2000))}
            onKeyDown={onKeyDown}
            disabled={!configured || busy}
            placeholder={
              configured
                ? "Ask about orders, stock, customers or sales…"
                : "Add ANTHROPIC_API_KEY to this environment to enable chat."
            }
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-muted/70 disabled:cursor-not-allowed"
            aria-describedby="assistant-hint"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!configured || busy || !input.trim()}
            className="btn-primary min-h-11 shrink-0 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Working…" : "Send"}
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 px-1">
          <p id="assistant-hint" className="text-[11px] text-muted">
            Enter to send · Shift+Enter for a new line · read-only
          </p>
          <div className="flex items-center gap-3">
            {input.length > 0 && <span className="text-[11px] text-muted">{input.length}/2000</span>}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => { setMessages([]); setError(""); }}
                disabled={busy}
                className="min-h-9 text-[11px] font-semibold text-muted underline underline-offset-2 hover:text-navy disabled:opacity-50"
              >
                Clear conversation
              </button>
            )}
          </div>
        </div>
      </div>

      {meta?.tools?.length > 0 && (
        <details className="mt-3 rounded-card border border-line bg-white px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-ink">
            What the assistant can read ({meta.tools.length} tools)
          </summary>
          <ul className="mt-2 space-y-1.5">
            {meta.tools.map((tool) => (
              <li key={tool.name} className="text-xs text-muted">
                <span className="font-mono text-[11px] text-ink">{tool.name}</span> — {tool.summary}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            There is no write tool. Status changes, stock adjustments and role changes stay in their
            own screens, with confirmation.
          </p>
        </details>
      )}
    </div>
  );
}
