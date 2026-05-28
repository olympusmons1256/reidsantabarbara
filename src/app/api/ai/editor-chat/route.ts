import { NextResponse } from "next/server";

type EditorChatBody = {
  message: string;
  chatSessionId?: string;
  chatHistory?: Array<{
    role: "user" | "assistant";
    text: string;
  }>;
  searchOptions?: {
    deepSearch?: boolean;
  };
  focusedField?: {
    path: string;
    label: string;
    value: string;
  } | null;
  selectedFields?: Array<{
    path: string;
    label: string;
    value: string;
  }>;
  profile?: {
    name?: string;
    title?: string;
    summary?: string;
  };
  variant?: {
    id?: string;
    title?: string;
    audience?: string;
  } | null;
  completedResumeContext?: {
    profile?: Record<string, unknown>;
    variants?: unknown[];
  };
  intakeContext?: {
    linkedIn?: string | null;
    webSources?: string | null;
    resumeText?: string | null;
    additionalContext?: string | null;
    documents?: Array<{
      name: string;
      content: string;
      url?: string;
    }>;
  } | null;
};

type ChatFieldUpdate = {
  path: string;
  label: string;
  value: string;
};

type ChatReplyPayload = {
  reply: string;
  fieldUpdates: ChatFieldUpdate[];
};

type RetrievedArchiveItem = {
  title: string;
  date: string;
  url: string;
  source: string;
};

type RetrievalSourceLogEntry = {
  source: string;
  url: string;
  status: "ok" | "error";
  extractedCount: number;
  error?: string;
};

type RetrievalContext = {
  venue: string;
  startYear: number;
  endYear: number;
  items: RetrievedArchiveItem[];
  sourceLog: RetrievalSourceLogEntry[];
};

type EditorChatSuccessPayload = {
  reply: string;
  fieldUpdates: ChatFieldUpdate[];
  items?: Array<{ title?: string; date?: string; url?: string; source?: string }>;
  sourceLog?: Array<{ source?: string; url?: string; status?: string; extractedCount?: number; error?: string }>;
  source?: string;
};

type SessionCacheState = {
  byPromptKey: Map<string, EditorChatSuccessPayload>;
  byScopeKey: Map<string, EditorChatSuccessPayload>;
};

const SESSION_CHAT_CACHE = new Map<string, SessionCacheState>();

type ParsedChatPayload = {
  reply?: string;
  fieldUpdates?: Array<{ path?: string; label?: string; value?: string }>;
  items?: Array<{ title?: string; date?: string; url?: string; source?: string }>;
  sourceLog?: Array<{ source?: string; url?: string; status?: string; extractedCount?: number; error?: string }>;
};

function extractJsonPayload(content: string): ParsedChatPayload {
  const fencedMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? content.trim();

  try {
    return JSON.parse(candidate) as ParsedChatPayload;
  } catch {
    // Continue to brace scan fallback.
  }

  let start = -1;
  let depth = 0;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") {
      if (start === -1) {
        start = i;
      }
      depth += 1;
    } else if (ch === "}") {
      if (depth > 0) {
        depth -= 1;
      }
      if (start !== -1 && depth === 0) {
        const maybeJson = candidate.slice(start, i + 1);
        try {
          return JSON.parse(maybeJson) as ParsedChatPayload;
        } catch {
          // Keep scanning for a parseable object.
        }
      }
    }
  }

  throw new Error("Model did not return parseable JSON content.");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function parseYearRange(text: string): { startYear: number; endYear: number } | null {
  const matches = text.match(/(?:19|20)\d{2}/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  const years = matches.map((value) => Number(value)).filter((year) => Number.isFinite(year));
  if (!years.length) {
    return null;
  }

  return {
    startYear: Math.min(...years),
    endYear: Math.max(...years),
  };
}

function parseExplicitYearRange(text: string): { startYear: number; endYear: number } | null {
  const explicitRangeRegex = /(19|20)\d{2}\s*(?:-|–|—|to|through|thru)\s*(19|20)\d{2}/i;
  const match = text.match(explicitRangeRegex);
  if (!match) {
    return null;
  }

  const years = match[0].match(/(?:19|20)\d{2}/g)?.map((value) => Number(value)) ?? [];
  if (years.length < 2) {
    return null;
  }

  const startYear = Math.min(years[0], years[1]);
  const endYear = Math.max(years[0], years[1]);
  return { startYear, endYear };
}

function resolveRequestedYearRange(body: EditorChatBody): { startYear: number; endYear: number } | null {
  // 1) Prefer explicit range in the current user message.
  const fromMessageExplicit = parseExplicitYearRange(body.message);
  if (fromMessageExplicit) {
    return fromMessageExplicit;
  }

  // 2) If current message contains year references, use those.
  const fromMessageLoose = parseYearRange(body.message);
  if (fromMessageLoose) {
    return fromMessageLoose;
  }

  // 3) Fall back to most recent USER turns only (avoid assistant text polluting bounds).
  const userHistory = (body.chatHistory ?? []).filter((entry) => entry.role === "user");
  for (let index = userHistory.length - 1; index >= 0; index -= 1) {
    const entry = userHistory[index];
    const explicit = parseExplicitYearRange(entry.text ?? "");
    if (explicit) {
      return explicit;
    }

    const loose = parseYearRange(entry.text ?? "");
    if (loose) {
      return loose;
    }
  }

  return null;
}

function normalizePromptKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function isRetryPrompt(text: string): boolean {
  return /^(try again|again|retry|rerun|re-run|one more time|rephrase|reformat)\b/i.test(text.trim());
}

function isListIntent(text: string): boolean {
  return /(generate|create|give|show|compile|update|add|include)?\s*(me\s*)?(a\s*)?(list|show|shows|events|calendar|lineup|productions?|credits?|section)/i.test(text);
}

function hasListStructure(text: string): boolean {
  if (!text.trim()) {
    return false;
  }

  const bulletMatches = text.match(/(^|\n)\s*[-•]\s+/g)?.length ?? 0;
  const numberedMatches = text.match(/(^|\n)\s*\d+[\.)]\s+/g)?.length ?? 0;
  if (bulletMatches + numberedMatches >= 3) {
    return true;
  }

  const semicolonCount = (text.match(/;/g) ?? []).length;
  return semicolonCount >= 6;
}

function isLikelyIncompleteListReply(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const placeholderLeadIn = /(let me|i can now|i now have|here is what i can confirm|based on the search results|i was able to surface)/i.test(normalized);
  const endingWithColon = /[:\u2026]\s*$/.test(normalized);
  return (placeholderLeadIn || endingWithColon) && !hasListStructure(text);
}

function isLikelyPlaceholderReply(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return true;
  }

  const lower = normalized.toLowerCase();
  const startsAsScaffold = /^(good\s*[—-]|great\s*[—-]|thanks|noted|understood|perfect)[^\n]*$/i.test(normalized);
  const leadInOnly = /(let me|i can now|i now have|here(?:'|’)s what (?:the )?(?:research|search|sources?) confirms|based on (?:the )?search results)/i.test(lower);
  const endsWithLeadInPunctuation = /[:\u2026]\s*$/.test(normalized);
  const hasBulletsOrNumbered = /(^|\n)\s*(?:[-•]|\d+[\.)])\s+/m.test(normalized);
  const words = normalized.split(/\s+/).filter(Boolean).length;

  if ((startsAsScaffold || leadInOnly || endsWithLeadInPunctuation) && !hasBulletsOrNumbered && words <= 45) {
    return true;
  }

  const operationalPlanLeadIn = /\b(i(?:'|’)ll|i will)\s+(run|search|gather|look up|check|fetch|compile)\b/i.test(normalized);
  const toolProgressStyle = /\b(in parallel|search(es)? in parallel|gather details|use apply|field update ready)\b/i.test(lower);
  if ((operationalPlanLeadIn || toolProgressStyle) && !hasBulletsOrNumbered && words <= 60) {
    return true;
  }

  return false;
}

function isLikelyUnderansweredReply(reply: string, userMessage: string): boolean {
  const normalizedReply = reply.trim();
  if (!normalizedReply) {
    return true;
  }

  if (isLikelyPlaceholderReply(normalizedReply)) {
    return true;
  }

  const lowerPrompt = userMessage.toLowerCase();
  const asksForSubstantiveOutput = /(suggest|draft|details|improve|rewrite|write|explain|list|research|based on|what did you find)/i.test(lowerPrompt);
  const replyWordCount = normalizedReply.split(/\s+/).filter(Boolean).length;
  const hasBulletOrNumberedList = /(^|\n)\s*(?:[-•]|\d+[\.)])\s+/m.test(normalizedReply);
  const trailsOff = /(?:confirms|shows|includes|that|:|\u2026)\s*$/i.test(normalizedReply);

  if (!asksForSubstantiveOutput) {
    return false;
  }

  if (trailsOff && replyWordCount < 80) {
    return true;
  }

  if (!hasBulletOrNumberedList && replyWordCount < 35) {
    return true;
  }

  return false;
}

function buildScopeKey(body: EditorChatBody): string {
  const focusedPath = body.focusedField?.path ?? "none";
  const selected = (body.selectedFields ?? [])
    .map((field) => `${field.path}=${field.value ?? ""}`)
    .sort()
    .join("||");
  const variantId = body.variant?.id ?? "none";
  return `variant:${variantId}::focus:${focusedPath}::selected:${selected}`;
}

function getSessionCache(sessionId: string): SessionCacheState {
  const existing = SESSION_CHAT_CACHE.get(sessionId);
  if (existing) {
    return existing;
  }

  const created: SessionCacheState = {
    byPromptKey: new Map(),
    byScopeKey: new Map(),
  };
  SESSION_CHAT_CACHE.set(sessionId, created);
  return created;
}

function inferMooreTheatreContext(body: EditorChatBody): boolean {
  const contextChunks = [
    body.message,
    body.focusedField?.label,
    body.focusedField?.value,
    ...(body.selectedFields ?? []).flatMap((field) => [field.label, field.value]),
    body.profile?.title,
    body.profile?.summary,
    body.variant?.title,
    body.variant?.audience,
    body.intakeContext?.additionalContext,
    body.intakeContext?.resumeText,
  ].filter((value): value is string => Boolean(value?.trim()));

  const lightweightCompletedContext = JSON.stringify(body.completedResumeContext ?? {}).slice(0, 12000);
  const searchableContext = [...contextChunks, lightweightCompletedContext].join("\n").toLowerCase();

  return /(moore theatre|the moore|seattle theatre group|stg presents|staff lighting designer.+moore theatre)/i.test(searchableContext);
}

function getYearFromDateString(date: string): number | null {
  const match = date.match(/(19|20)\d{2}$/);
  return match ? Number(match[0]) : null;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dateToSortKey(date: string): number {
  const timestamp = Date.parse(date);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function formatRetrievedListReply(context: RetrievalContext): string {
  const header = [
    `Compiled ${context.items.length} Moore Theatre events from ${context.startYear}–${context.endYear} using programmatic archive retrieval.`,
    "",
    "Source crawl log:",
    ...context.sourceLog.map(
      (entry) =>
        `- ${entry.status.toUpperCase()}: ${entry.source} (${entry.extractedCount} items) ${entry.error ? `— ${entry.error}` : ""}`
    ),
    "",
    "Show list:",
  ];

  const lines = context.items.map((item) => `- ${item.date} — ${item.title}`);
  return [...header, ...lines].join("\n");
}

function parseUpcomingArchivePage(content: string, pageUrl: string): RetrievedArchiveItem[] {
  const items: RetrievedArchiveItem[] = [];
  const source = "Upcoming.org";
  const datePattern =
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+(?:19|20)\d{2}/;

  // Markdown-like blocks (as seen in extracted archive text format)
  const markdownPattern = /####\s*\[([^\]]+)\]\(([^\)]+)\)[^\n]*\n\s*\n\s*([A-Za-z]+\s+\d{1,2},\s+(?:19|20)\d{2})/g;
  let markdownMatch: RegExpExecArray | null;
  while ((markdownMatch = markdownPattern.exec(content)) !== null) {
    const title = markdownMatch[1]?.trim();
    const url = markdownMatch[2]?.trim();
    const date = markdownMatch[3]?.trim();
    if (title && url && date) {
      items.push({ title, url, date, source });
    }
  }

  // HTML blocks from direct page fetch
  const htmlPattern = /<h4[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h4>/gi;
  let htmlMatch: RegExpExecArray | null;
  while ((htmlMatch = htmlPattern.exec(content)) !== null) {
    const rawHref = htmlMatch[1] ?? "";
    const rawTitle = htmlMatch[2] ?? "";
    const windowStart = htmlMatch.index;
    const windowEnd = Math.min(content.length, windowStart + 450);
    const blockWindow = content.slice(windowStart, windowEnd);
    const dateMatch = blockWindow.match(datePattern);
    const title = stripHtmlTags(rawTitle);
    const href = rawHref.startsWith("http") ? rawHref : new URL(rawHref, pageUrl).toString();
    const date = dateMatch?.[0]?.trim();
    if (title && href && date) {
      items.push({ title, url: href, date, source });
    }
  }

  return items;
}

async function retrieveMooreTheatreArchiveItems(startYear: number, endYear: number): Promise<RetrievalContext> {
  const pageNumbers = [1, 2, 3, 4, 5, 6];
  const sourceLog: RetrievalSourceLogEntry[] = [];
  const collected: RetrievedArchiveItem[] = [];

  for (const pageNumber of pageNumbers) {
    const url = `https://archive.upcoming.org/venue/the-moore-theatre-612?page=${pageNumber}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ResumeEditorBot/1.0)",
        },
      });

      if (!response.ok) {
        sourceLog.push({
          source: "Upcoming.org",
          url,
          status: "error",
          extractedCount: 0,
          error: `HTTP ${response.status}`,
        });
        continue;
      }

      const text = await response.text();
      const pageItems = parseUpcomingArchivePage(text, url).filter((item) => {
        const year = getYearFromDateString(item.date);
        return year !== null && year >= startYear && year <= endYear;
      });

      collected.push(...pageItems);
      sourceLog.push({
        source: "Upcoming.org",
        url,
        status: "ok",
        extractedCount: pageItems.length,
      });
    } catch (error) {
      sourceLog.push({
        source: "Upcoming.org",
        url,
        status: "error",
        extractedCount: 0,
        error: error instanceof Error ? error.message : "Unknown fetch error",
      });
    }
  }

  const deduped = new Map<string, RetrievedArchiveItem>();
  for (const item of collected) {
    const key = `${item.date}::${normalizeTitle(item.title)}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  const items = Array.from(deduped.values()).sort((a, b) => {
    const delta = dateToSortKey(a.date) - dateToSortKey(b.date);
    if (delta !== 0) {
      return delta;
    }
    return a.title.localeCompare(b.title);
  });

  return {
    venue: "The Moore Theatre",
    startYear,
    endYear,
    items,
    sourceLog,
  };
}

function fallbackReply(body: EditorChatBody, reason?: "upstream_error" | "no_model_text" | "json_parse_failed"): ChatReplyPayload {
  const fields = body.selectedFields ?? [];
  const labels = fields.length
    ? fields.map((field) => field.label).join(", ")
    : body.focusedField?.label || "selected field";

  const current = fields.length
    ? fields.map((field) => `${field.label}: ${field.value?.trim() || "(empty)"}`).join(" | ")
    : body.focusedField?.value?.trim() || "(empty)";

  const fieldUpdates: ChatFieldUpdate[] = [];

  const reasonLine =
    reason === "upstream_error"
      ? "The model request failed before a usable answer was returned."
      : reason === "no_model_text"
        ? "The model did not return a final text answer after search/tool steps."
        : reason === "json_parse_failed"
          ? "The model returned text that could not be parsed as structured JSON."
          : "A fallback response was generated.";

  return {
    reply: [
      `I couldn't complete the requested update for ${labels}.`,
      reasonLine,
      `Current value: ${current}`,
      `Please retry the request to run the lookup/update flow again.`,
    ].join("\n"),
    fieldUpdates,
  };
}

function buildRetrievalFieldUpdates(
  selectedFields: Array<{ path: string; label: string; value: string }>,
  context: RetrievalContext
): ChatFieldUpdate[] {
  if (!selectedFields.length || !context.items.length) {
    return [];
  }

  const sampleItems = context.items.slice(0, 10);
  const sampleText = sampleItems.map((item) => `${item.title} (${item.date})`).join("; ");
  const summaryDraftValue = [
    `Compiled ${context.items.length} Moore Theatre events (${context.startYear}–${context.endYear}) from public archive records across concerts, comedy, dance, lectures, and theater productions.`,
    `Representative credits: ${sampleText}.`,
  ].join(" ");

  const fullListDraftValue = context.items.map((item) => `${item.title} (${item.date})`).join("; ");

  return selectedFields.map((field) => ({
    path: field.path,
    label: field.label,
    value: field.path.endsWith(":metadataItemsText") ? fullListDraftValue : summaryDraftValue,
  }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EditorChatBody;
    if (!body?.message?.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const sessionId = body.chatSessionId?.trim() || "session-default";
    const scopeKey = buildScopeKey(body);
    const promptKey = `${scopeKey}::${normalizePromptKey(body.message)}`;
    const initialConversationText = [
      ...(body.chatHistory ?? []).map((entry) => entry.text || ""),
      body.message,
    ]
      .join("\n")
      .toLowerCase();
    const likelyListIntent = isListIntent(initialConversationText);
    const sessionCache = getSessionCache(sessionId);

    const rememberAndRespond = (payload: EditorChatSuccessPayload) => {
      if (isLikelyPlaceholderReply(payload.reply ?? "")) {
        return NextResponse.json(payload);
      }

      if (likelyListIntent && isLikelyIncompleteListReply(payload.reply ?? "")) {
        return NextResponse.json(payload);
      }

      sessionCache.byPromptKey.set(promptKey, payload);
      sessionCache.byScopeKey.set(scopeKey, payload);

      // Bound cache growth in long sessions.
      while (sessionCache.byPromptKey.size > 60) {
        const oldestKey = sessionCache.byPromptKey.keys().next().value;
        if (!oldestKey) {
          break;
        }
        sessionCache.byPromptKey.delete(oldestKey);
      }
      while (sessionCache.byScopeKey.size > 30) {
        const oldestKey = sessionCache.byScopeKey.keys().next().value;
        if (!oldestKey) {
          break;
        }
        sessionCache.byScopeKey.delete(oldestKey);
      }

      return NextResponse.json(payload);
    };

    if (isRetryPrompt(body.message)) {
      const cachedByScope = sessionCache.byScopeKey.get(scopeKey);
      if (cachedByScope && !(likelyListIntent && isLikelyIncompleteListReply(cachedByScope.reply ?? ""))) {
        return NextResponse.json({ ...cachedByScope, source: "session-cache" });
      }
    }

    const cachedByPrompt = sessionCache.byPromptKey.get(promptKey);
    if (cachedByPrompt && !(likelyListIntent && isLikelyIncompleteListReply(cachedByPrompt.reply ?? ""))) {
      return NextResponse.json({ ...cachedByPrompt, source: "session-cache" });
    }

    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
      const fallback = fallbackReply(body);
      return rememberAndRespond({ ...fallback, source: "fallback" });
    }

    const model = process.env.LLM_MODEL ?? "claude-sonnet-4-6";
    const apiBase = (process.env.LLM_API_BASE_URL ?? "https://api.anthropic.com/v1").replace(/\/$/, "");
    const isAnthropic = apiBase.includes("anthropic.com");

    if (!isAnthropic) {
      const fallback = fallbackReply(body);
      return rememberAndRespond({ ...fallback, source: "fallback" });
    }

    const selectedFields = body.selectedFields ?? [];
    const deepSearchEnabled = Boolean(body.searchOptions?.deepSearch);
    const allowedFieldMap = new Map(selectedFields.map((field) => [field.path, field]));
    const conversationText = [
      ...(body.chatHistory ?? []).map((entry) => entry.text || ""),
      body.message,
    ]
      .join("\n")
      .toLowerCase();
    const lowerMessage = body.message.toLowerCase();
    const requestedYearRange = resolveRequestedYearRange(body);
    const isShowListRequest = /(generate|create|give|show|compile)?\s*(me\s*)?(a\s*)?(list|show|shows|events|calendar|lineup)/i.test(conversationText);
    const hasMooreContext = inferMooreTheatreContext(body);
    const isYearRangeShowListQuery = Boolean(requestedYearRange) && isShowListRequest;
    // Deterministic behavior for the Moore Theatre retriever only when Moore context is present.
    const shouldRunProgrammaticRetrieval = isYearRangeShowListQuery && hasMooreContext;

    const retrievalContext = shouldRunProgrammaticRetrieval
      ? await retrieveMooreTheatreArchiveItems(requestedYearRange!.startYear, requestedYearRange!.endYear)
      : null;
    const retrievalFieldUpdates = retrievalContext ? buildRetrievalFieldUpdates(selectedFields, retrievalContext) : [];

    if (retrievalContext && retrievalContext.items.length > 0 && isShowListRequest) {
      return rememberAndRespond({
        reply: formatRetrievedListReply(retrievalContext),
        fieldUpdates: retrievalFieldUpdates,
        items: retrievalContext.items,
        sourceLog: retrievalContext.sourceLog,
        source: "retrieval-direct",
      });
    }

    if (retrievalContext && retrievalContext.items.length === 0 && isShowListRequest) {
      const crawlSummary = retrievalContext.sourceLog.length
        ? retrievalContext.sourceLog
            .map((entry) => `- ${entry.status.toUpperCase()}: ${entry.url} (${entry.extractedCount})${entry.error ? ` — ${entry.error}` : ""}`)
            .join("\n")
        : "- No archive pages were crawled.";

      return rememberAndRespond({
        reply: [
          `Programmatic retrieval ran for ${retrievalContext.venue} (${retrievalContext.startYear}–${retrievalContext.endYear}) but returned 0 parsed events.`,
          "",
          "Crawl log:",
          crawlSummary,
          "",
          "No model-generated fallback was used so this can be debugged deterministically.",
        ].join("\n"),
        fieldUpdates: retrievalFieldUpdates,
        items: [],
        sourceLog: retrievalContext.sourceLog,
        source: "retrieval-empty",
      });
    }

    const systemPrompt = [
      "You are a resume and domain-knowledge assistant embedded in a form UI.",
      "Return ONLY valid JSON with this shape:",
      '{"reply":"...","fieldUpdates":[{"path":"...","label":"...","value":"..."}],"items":[{"title":"...","date":"...","url":"...","source":"..."}],"sourceLog":[{"source":"...","url":"...","status":"ok|error","extractedCount":0,"error":"..."}]}',
      "Do not include markdown fences, prefaces, or trailing notes.",
      "Rules:",
      '  - Use chatHistory for context. Follow-up prompts (e.g., "list shows from 2006-2013") refer to the previously discussed subject unless the user changes it.',
      "  - Treat selectedFields and focusedField as highest-priority scope. Do not switch organizations or venues unless the user explicitly requests the switch.",
      "  - Always answer the user's actual question directly. Do not claim the topic is out of scope.",
      "  - If the user asks a technical or domain question (e.g., lighting, HDR, optics, engineering), provide a clear, accurate explanation first.",
      "  - If selected fields are empty and the user asks a knowledge question, return an explanatory answer (and optionally a short resume-ready phrasing at the end).",
      "  - If selected fields are empty and the user asks for writing help, provide ready-to-paste drafts.",
      "  - If selected fields have content, provide improved versions and one short rationale.",
      "  - Keep recommendations internally consistent across selected fields.",
      "- Only provide fieldUpdates for paths present in selectedFields.",
      "  - Timeline field formatting:",
      '    - If selected field path ends with ":timelineTour:stepsJson", return \'value\' as a JSON array string of steps.',
      "      Each step object should include: 'label', 'sectionId', 'itemId', 'durationMs'.",
      '    - If selected field path ends with ":timelineTour:enabled", return \'value\' as "true" or "false".',
      '    - If selected field path ends with ":timelineTour:step:<id>:sectionItem", return \'value\' as "<sectionId>::<itemId>".',
      '    - If selected field path ends with ":timelineTour:step:<id>:durationMs", return a numeric string in milliseconds.',
      "  - Keep answer concise (usually 120-220 words; may exceed when factual detail is needed).",
      "- When the user asks about real-world facts — venues, shows, productions, companies, dates, collaborators, events — USE the web_search tool to look them up before answering. Never refuse a factual lookup; search first.",
      "  - For long historical requests (multi-year lists), run multiple targeted searches (by year ranges and source pages) before responding.",
      "  - Treat paginated public archives as accessible sources; continue searching page-by-page when necessary.",
      '  - If a request asks for "all" items, provide as complete a list as possible and explicitly call out known gaps.',
      "  - In deep-search mode, prioritize completeness: search across multiple sources/pages, then deduplicate and sort results chronologically.",
      "  - If retrievalContext is provided, use retrievalContext.items as the authoritative dataset, preserve coverage, and keep chronological ordering.",
      '  - If retrievalContext is provided, ALWAYS include non-empty "items" and "sourceLog" in your JSON response.',
      "  - After searching, include the results directly in your reply and in fieldUpdates when applicable.",
      "  - Prefer high-confidence claims. If uncertainty remains after searching, state uncertainty briefly and provide the best supported answer.",
      "- If completedResumeContext includes assets, use their label/order/type/url context to reference specific media accurately.",
      "  - If intakeContext is provided, use documents, resumeText, and additionalContext as primary source-of-truth about the person's background and goals.",
      "  - If intakeContext.documents are present, treat them as attached reference material and use them when answering technical or process questions.",
    ].join("\n");

    const tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: deepSearchEnabled ? 20 : 10,
      },
    ];

    // Token budget: use a generous ceiling so complex multi-venue/multi-year lists
    // are never truncated mid-output. Deep search gets double.
    const maxTokens = deepSearchEnabled ? 12000 : 6000;

    // Agentic loop — handle tool_use rounds (web search is server-side but we may
    // need to relay tool_result blocks for multi-step searches).
    type AnthropicMessage = { role: "user" | "assistant"; content: unknown };
    const messages: AnthropicMessage[] = [
      {
        role: "user",
        content: JSON.stringify({
          message: body.message,
          chatHistory: (body.chatHistory ?? []).slice(-30),
          focusedField: body.focusedField,
          selectedFields: body.selectedFields ?? [],
          profile: body.profile,
          variant: body.variant,
          completedResumeContext: body.completedResumeContext ?? {},
          intakeContext: body.intakeContext ?? null,
          retrievalContext,
          searchOptions: {
            deepSearch: deepSearchEnabled,
          },
        }),
      },
    ];

    let text: string | undefined;
    const MAX_ROUNDS = deepSearchEnabled ? 12 : 6;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await fetch(`${apiBase}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "web-search-2025-03-05",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxTokens,
          system: systemPrompt,
          tools,
          messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[editor-chat] Upstream LLM error:", response.status, errorText?.slice(0, 500));
        const fallback = fallbackReply(body, "upstream_error");
        return rememberAndRespond({ ...fallback, source: "fallback" });
      }

      const completion = (await response.json()) as {
        stop_reason?: string;
        content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }>;
      };

      const stopReason = completion.stop_reason;
      const contentBlocks = completion.content ?? [];

      // Extract text from this turn. We intentionally avoid committing tool-use
      // preface text as the final answer.
      const turnText = contentBlocks.find((block) => block.type === "text")?.text?.trim();

      // If model finished, exit loop
      if (stopReason === "end_turn" || stopReason === "stop_sequence") {
        if (turnText) {
          text = turnText;
        }
        break;
      }

      // If model wants to use tools, relay tool_use blocks back as tool_results
      const toolUseBlocks = contentBlocks.filter((block) => block.type === "tool_use");
      if (stopReason === "tool_use" && toolUseBlocks.length > 0) {
        // Append assistant turn
        messages.push({ role: "assistant", content: contentBlocks });

        // Build tool_result blocks — for web_search, Anthropic fills results automatically;
        // we pass back empty content so the loop continues.
        const toolResults = toolUseBlocks.map((block) => ({
          type: "tool_result",
          tool_use_id: block.id,
          content: "",
        }));
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // For any non-tool, non-final stop reason, keep latest text if present.
      if (turnText) {
        text = turnText;
      }

      // Any other stop reason — exit
      break;
    }

    if (!text?.trim()) {
      const finalizeResponse = await fetch(`${apiBase}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "web-search-2025-03-05",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxTokens,
          system: `${systemPrompt}\nAdditional requirement: Do not call tools. Synthesize and return final JSON answer now.`,
          messages: [
            ...messages,
            {
              role: "user",
              content: JSON.stringify({
                instruction: "Return final JSON now without further tool use.",
              }),
            },
          ],
        }),
      });

      if (finalizeResponse.ok) {
        const finalizeCompletion = (await finalizeResponse.json()) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const finalizedText = finalizeCompletion.content?.find((block) => block.type === "text")?.text?.trim();
        if (finalizedText) {
          text = finalizedText;
        }
      }
    }

    if (!text?.trim()) {
      const fallback = fallbackReply(body, "no_model_text");
      return rememberAndRespond({ ...fallback, source: "fallback" });
    }

    let parsed: ParsedChatPayload | null = null;
    try {
      parsed = extractJsonPayload(text);
    } catch (parseError) {
      console.error("[editor-chat] JSON parse error:", parseError, "text:", text?.substring(0, 500));
      if (retrievalContext && retrievalContext.items.length > 0) {
        return rememberAndRespond({
          reply: formatRetrievedListReply(retrievalContext),
          fieldUpdates: retrievalFieldUpdates,
          items: retrievalContext.items,
          sourceLog: retrievalContext.sourceLog,
          source: "retrieval-fallback",
        });
      }

      // First-turn model outputs can occasionally be scaffold text or malformed JSON.
      // Run one focused repair pass before falling back to raw text.
      const repairSystemPrompt = `${systemPrompt}\nAdditional requirement: Return valid JSON only and provide the final complete answer now. Do not output lead-in scaffolding.`;
      const repairResponse = await fetch(`${apiBase}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "web-search-2025-03-05",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxTokens,
          system: repairSystemPrompt,
          tools,
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                message: body.message,
                chatHistory: (body.chatHistory ?? []).slice(-30),
                focusedField: body.focusedField,
                selectedFields: body.selectedFields ?? [],
                profile: body.profile,
                variant: body.variant,
                completedResumeContext: body.completedResumeContext ?? {},
                intakeContext: body.intakeContext ?? null,
                retrievalContext,
                instruction: "Return final answer JSON only.",
              }),
            },
          ],
        }),
      });

      if (repairResponse.ok) {
        const repairCompletion = (await repairResponse.json()) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const repairText = repairCompletion.content?.find((block) => block.type === "text")?.text?.trim();
        if (repairText) {
          try {
            parsed = extractJsonPayload(repairText);
          } catch {
            // Keep fallback behavior below.
          }
        }
      }

      if (!parsed) {
        const fallback = fallbackReply(body, "json_parse_failed");
        return rememberAndRespond({
          reply: text?.trim() || fallback.reply,
          fieldUpdates: retrievalFieldUpdates.length ? retrievalFieldUpdates : fallback.fieldUpdates,
          items: retrievalContext?.items ?? [],
          sourceLog: retrievalContext?.sourceLog ?? [],
          source: "fallback-raw",
        });
      }

    }

    if (!parsed) {
      const fallback = fallbackReply(body, "json_parse_failed");
      return rememberAndRespond({ ...fallback, source: "fallback" });
    }

    if (retrievalContext && retrievalContext.items.length > 0) {
      const parsedItems = (parsed.items ?? [])
        .map((item) => ({
          title: item.title?.trim() ?? "",
          date: item.date?.trim() ?? "",
          url: item.url?.trim() ?? "",
          source: item.source?.trim() ?? "",
        }))
        .filter((item) => item.title && item.date);

      if (parsedItems.length === 0) {
        return rememberAndRespond({
          reply: formatRetrievedListReply(retrievalContext),
          fieldUpdates: retrievalFieldUpdates,
          items: retrievalContext.items,
          sourceLog: retrievalContext.sourceLog,
          source: "retrieval-fallback",
        });
      }
    }

    if (isShowListRequest && isLikelyIncompleteListReply(parsed.reply ?? "")) {
      const repairSystemPrompt = `${systemPrompt}\nAdditional requirement: If the user asked for a list, provide the finalized complete list now. Do not respond with lead-in placeholders.`;
      const repairResponse = await fetch(`${apiBase}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "web-search-2025-03-05",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxTokens,
          system: repairSystemPrompt,
          tools,
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                message: body.message,
                chatHistory: (body.chatHistory ?? []).slice(-30),
                focusedField: body.focusedField,
                selectedFields: body.selectedFields ?? [],
                profile: body.profile,
                variant: body.variant,
                completedResumeContext: body.completedResumeContext ?? {},
                intakeContext: body.intakeContext ?? null,
                retrievalContext,
                instruction: "Return the full finalized list now. No placeholder lead-in.",
              }),
            },
          ],
        }),
      });

      if (repairResponse.ok) {
        const repairCompletion = (await repairResponse.json()) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const repairText = repairCompletion.content?.find((block) => block.type === "text")?.text?.trim();
        if (repairText) {
          try {
            const repairedPayload = extractJsonPayload(repairText);
            if (repairedPayload.reply?.trim() && !isLikelyIncompleteListReply(repairedPayload.reply)) {
              parsed = repairedPayload;
            }
          } catch {
            // Keep original parsed payload if repair parse fails.
          }
        }
      }
    }

    if (!isShowListRequest && isLikelyPlaceholderReply(parsed.reply ?? "")) {
      const repairSystemPrompt = `${systemPrompt}\nAdditional requirement: Provide the final complete answer now. Do not output scaffolding or lead-in-only text.`;
      const repairResponse = await fetch(`${apiBase}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "web-search-2025-03-05",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxTokens,
          system: repairSystemPrompt,
          tools,
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                message: body.message,
                chatHistory: (body.chatHistory ?? []).slice(-30),
                focusedField: body.focusedField,
                selectedFields: body.selectedFields ?? [],
                profile: body.profile,
                variant: body.variant,
                completedResumeContext: body.completedResumeContext ?? {},
                intakeContext: body.intakeContext ?? null,
                retrievalContext,
                instruction: "Return the final answer directly. No preface, no lead-in placeholders.",
              }),
            },
          ],
        }),
      });

      if (repairResponse.ok) {
        const repairCompletion = (await repairResponse.json()) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const repairText = repairCompletion.content?.find((block) => block.type === "text")?.text?.trim();
        if (repairText) {
          try {
            const repairedPayload = extractJsonPayload(repairText);
            if (repairedPayload.reply?.trim() && !isLikelyPlaceholderReply(repairedPayload.reply)) {
              parsed = repairedPayload;
            }
          } catch {
            // Keep original parsed payload if repair parse fails.
          }
        }
      }
    }

    if (isLikelyUnderansweredReply(parsed.reply ?? "", body.message)) {
      const completionSystemPrompt = `${systemPrompt}\nAdditional requirement: Your prior answer was incomplete. Return a complete final answer that fully addresses every part of the user request. Do not use setup phrasing.`;
      const completionResponse = await fetch(`${apiBase}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "web-search-2025-03-05",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxTokens,
          system: completionSystemPrompt,
          tools,
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                message: body.message,
                chatHistory: (body.chatHistory ?? []).slice(-30),
                focusedField: body.focusedField,
                selectedFields: body.selectedFields ?? [],
                profile: body.profile,
                variant: body.variant,
                completedResumeContext: body.completedResumeContext ?? {},
                intakeContext: body.intakeContext ?? null,
                retrievalContext,
                priorReply: parsed.reply ?? "",
                instruction: "Return a complete final answer now.",
              }),
            },
          ],
        }),
      });

      if (completionResponse.ok) {
        const completionPayload = (await completionResponse.json()) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const completionText = completionPayload.content?.find((block) => block.type === "text")?.text?.trim();
        if (completionText) {
          try {
            const completedParsed = extractJsonPayload(completionText);
            if (!isLikelyUnderansweredReply(completedParsed.reply ?? "", body.message)) {
              parsed = completedParsed;
            }
          } catch {
            // keep existing parsed output
          }
        }
      }
    }

    const normalizedUpdates: ChatFieldUpdate[] = (parsed.fieldUpdates ?? [])
      .map((update) => {
        const path = update.path?.trim() ?? "";
        if (!path || !allowedFieldMap.has(path)) {
          return null;
        }

        const sourceField = allowedFieldMap.get(path);
        const candidateValue = update.value?.trim() ?? "";
        if (!candidateValue) {
          return null;
        }

        if (sourceField && candidateValue === (sourceField.value ?? "").trim()) {
          return null;
        }

        return {
          path,
          label: update.label?.trim() || sourceField?.label || path,
          value: candidateValue,
        };
      })
      .filter((update): update is ChatFieldUpdate => Boolean(update));

    const fallback = fallbackReply(body);
    const resolvedFieldUpdates = normalizedUpdates.length
      ? normalizedUpdates
      : retrievalFieldUpdates.length
        ? retrievalFieldUpdates
        : fallback.fieldUpdates;

    return rememberAndRespond({
      reply: parsed.reply?.trim() || fallback.reply,
      fieldUpdates: resolvedFieldUpdates,
      items: parsed.items ?? retrievalContext?.items ?? [],
      sourceLog: parsed.sourceLog ?? retrievalContext?.sourceLog ?? [],
      source: "llm",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[editor-chat] Error:", errorMessage, error);
    return NextResponse.json({ error: "Editor chat request failed: " + errorMessage }, { status: 500 });
  }
}
