// Server-only adapter for the admin assistant's model provider.
//
// Anthropic's Messages API is called with plain fetch so the app gains no new
// dependency and no SDK version to keep in step. Nothing in this file may be
// imported by a client component: it reads the API key.

export const DEFAULT_MODEL = "claude-sonnet-4-5";

export class ProviderError extends Error {
  constructor(kind, message, status = 0) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind; // auth | model | rate | timeout | network | provider
    this.status = status;
  }
}

/** Provider configuration, or the exact reason it is missing. Never returns the key. */
export function agentConfig() {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = (process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim();
  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");

  if (!key || !key.trim()) {
    return {
      configured: false,
      model,
      setup: [
        "Create an API key in the Anthropic Console.",
        "Add it to Vercel → Settings → Environment Variables as ANTHROPIC_API_KEY (Sensitive).",
        "Optionally set ANTHROPIC_MODEL to pin a model; the default is " + DEFAULT_MODEL + ".",
        "Redeploy so the new variable reaches the serverless functions.",
      ],
    };
  }

  return { configured: true, key: key.trim(), model, baseUrl };
}

/**
 * One model turn.
 *
 * @returns the raw Messages API body: { content: [...], stop_reason, usage }
 */
export async function createMessage({ config, system, messages, tools, maxTokens = 1400 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  let response;
  try {
    response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        system,
        messages,
        tools,
        tool_choice: { type: "auto" },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ProviderError("timeout", "The model took too long to answer.");
    }
    throw new ProviderError("network", "Could not reach the model provider.");
  } finally {
    clearTimeout(timer);
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const status = response.status;
    // The provider's message is useful in the server log; it is never sent to
    // the browser, and it never contains our key.
    console.error("agent provider error:", status, body?.error?.type || "unknown");
    if (status === 401 || status === 403) {
      throw new ProviderError("auth", "The model provider rejected the API key.", status);
    }
    if (status === 429) {
      throw new ProviderError("rate", "The model provider is rate-limiting requests.", status);
    }
    if (status === 400 || status === 404) {
      throw new ProviderError("model", "The configured model name or request was rejected.", status);
    }
    throw new ProviderError("provider", "The model provider returned an error.", status);
  }

  if (!Array.isArray(body.content)) {
    throw new ProviderError("provider", "The model returned an unexpected response.");
  }

  return body;
}

/** Plain text from a Messages API content array. */
export function textFromContent(content) {
  return (content || [])
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/** User-facing sentence for a provider failure. */
export function friendlyProviderMessage(error) {
  switch (error?.kind) {
    case "auth":
      return "The AI provider rejected the API key. Check ANTHROPIC_API_KEY in Vercel, then redeploy.";
    case "model":
      return "The configured model was rejected. Check ANTHROPIC_MODEL — the default is " + DEFAULT_MODEL + ".";
    case "rate":
      return "The AI provider is rate-limiting this key. Try again in a minute.";
    case "timeout":
      return "The assistant took too long to answer. Try a narrower question.";
    case "network":
      return "The server could not reach the AI provider. Try again shortly.";
    default:
      return "The assistant could not answer just now. Try again.";
  }
}
