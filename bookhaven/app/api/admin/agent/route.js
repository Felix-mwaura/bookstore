import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { TOOL_DEFINITIONS, storeSnapshot } from "../../../lib/admin-agent-tools";
import { runAgentTurn } from "../../../lib/agent-runner";
import { agentConfig, friendlyProviderMessage, ProviderError } from "../../../lib/agent-provider";
import { readJsonBody, isJsonObject, ADMIN_BODY } from "../../../lib/request-guard";

// Admin-only. The assistant can READ the store and explain it; it cannot
// change anything. Every write on this dashboard still goes through the
// existing audited endpoints, their confirmation dialogs and set_order_status
// / adjust_book_stock, so a bad model output (or a prompt-injected order note)
// cannot mark an order paid, delete a book or move stock.

const MAX_MESSAGES = 14;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 20000;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map();

function rateLimited(userId) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);

  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

/** Merge same-role turns and clamp size. Returns null when unusable. */
function cleanMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const messages = [];
  for (const entry of raw.slice(-MAX_MESSAGES)) {
    const role = entry?.role === "assistant" ? "assistant" : "user";
    const content = typeof entry?.content === "string" ? entry.content.trim().slice(0, MAX_MESSAGE_CHARS) : "";
    if (!content) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n\n${content}`;
    else messages.push({ role, content });
  }

  if (messages.length === 0) return null;
  if (messages[0].role !== "user") messages.shift();
  if (messages.length === 0) return null;

  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (total > MAX_TOTAL_CHARS) return null;

  return messages;
}

// GET — readiness, the available tools, and a real snapshot. Needs no model.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient } = auth;
  const config = agentConfig();

  let snapshot = null;
  try {
    snapshot = await storeSnapshot(adminClient);
  } catch (error) {
    console.error("GET /api/admin/agent snapshot:", error.message);
  }

  return NextResponse.json(
    {
      configured: config.configured,
      model: config.model,
      setup: config.configured ? null : config.setup,
      read_only: true,
      tools: TOOL_DEFINITIONS.map(({ name, description }) => ({
        name,
        summary: description.split(". ")[0],
      })),
      snapshot,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// POST — one turn of the tool-using conversation.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { adminClient, user } = auth;

  const config = agentConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        error: "The assistant is not configured yet. Add ANTHROPIC_API_KEY to this environment.",
        code: "NOT_CONFIGURED",
        setup: config.setup,
      },
      { status: 503 }
    );
  }

  if (rateLimited(user.id)) {
    return NextResponse.json(
      { error: "That is a lot of questions in a short time. Please wait a few minutes." },
      { status: 429 }
    );
  }

  const parsed = await readJsonBody(request, { maxBytes: ADMIN_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const messages = cleanMessages(body.messages);
  if (!messages) {
    return NextResponse.json(
      { error: "Send at least one question, under 20,000 characters in total." },
      { status: 400 }
    );
  }

  try {
    const turn = await runAgentTurn({ config, db: adminClient, messages });
    return NextResponse.json(
      {
        reply: turn.reply,
        tools: turn.tools,
        stopped: turn.stopped,
        model: config.model,
        usage: turn.usage,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error("POST /api/admin/agent provider failure:", error.kind, error.status);
      const status = error.kind === "rate" ? 429 : error.kind === "timeout" ? 504 : 502;
      return NextResponse.json({ error: friendlyProviderMessage(error) }, { status });
    }
    console.error("POST /api/admin/agent:", error?.message);
    return NextResponse.json(
      { error: "The assistant hit an unexpected error. Nothing was changed." },
      { status: 500 }
    );
  }
}
