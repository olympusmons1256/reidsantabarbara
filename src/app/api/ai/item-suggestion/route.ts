import { NextResponse } from "next/server";

type SuggestionAsset = {
  id: string;
  label: string;
  type: "image" | "video" | "doc" | "iframe" | "gallery";
  description?: string;
};

type SuggestionItem = {
  title: string;
  dateRange?: string;
  summary: string;
  detail: string;
  assets?: SuggestionAsset[];
  credits?: Array<{ role: string; name: string }>;
};

type SuggestionBody = {
  profile?: {
    name?: string;
    title?: string;
    summary?: string;
  };
  variant?: {
    title?: string;
    audience?: string;
  };
  section?: {
    title?: string;
    subtitle?: string;
    description?: string;
  };
  item: SuggestionItem;
  peerItems?: Array<{
    title?: string;
    summary?: string;
    detail?: string;
  }>;
};

type SuggestionResponse = {
  sectionDescription?: string;
  summary?: string;
  detail?: string;
  assetDescriptions?: Array<{
    assetId: string;
    description: string;
  }>;
};

function extractJsonObject(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Model did not return JSON content.");
  }
  return content.slice(start, end + 1);
}

function fallbackSuggestion(body: SuggestionBody): SuggestionResponse {
  const sectionTitle = body.section?.title?.trim() || "Experience";
  const itemTitle = body.item.title?.trim() || "Role";

  return {
    sectionDescription: body.section?.description?.trim()
      ? ""
      : `Highlights and outcomes for ${sectionTitle.toLowerCase()}.`,
    summary: body.item.summary?.trim()
      ? ""
      : `${itemTitle} contributions with measurable impact and clear responsibilities.`,
    detail: body.item.detail?.trim()
      ? ""
      : `${itemTitle}: include scope, execution approach, and measurable outcomes.`,
    assetDescriptions: (body.item.assets ?? [])
      .filter((asset) => !asset.description?.trim())
      .map((asset) => ({
        assetId: asset.id,
        description: `${asset.type === "video" ? "Video" : asset.type === "image" ? "Image" : asset.type === "gallery" ? "Gallery" : asset.type === "iframe" ? "Embed" : "Document"} supporting ${itemTitle.toLowerCase()} work.`,
      })),
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.LLM_API_KEY;
    const body = (await request.json()) as SuggestionBody;

    if (!body?.item) {
      return NextResponse.json({ error: "Missing item payload." }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ suggestion: fallbackSuggestion(body), source: "fallback" });
    }

    const model = process.env.LLM_MODEL ?? "claude-sonnet-4-6";
    const apiBase = (process.env.LLM_API_BASE_URL ?? "https://api.anthropic.com/v1").replace(/\/$/, "");
    const isAnthropic = apiBase.includes("anthropic.com");

    if (!isAnthropic) {
      return NextResponse.json({ suggestion: fallbackSuggestion(body), source: "fallback" });
    }

    const systemPrompt = `You improve resume draft fields using ONLY provided context.
Return strict JSON with keys:
- sectionDescription (string)
- summary (string)
- detail (string)
- assetDescriptions (array of {assetId,description})
Rules:
- Keep outputs concise and professional.
- If a field is already strong, return empty string for that field.
- Never invent employers, dates, or achievements not implied by context.
- Asset descriptions should explain what the asset shows and why it matters.`;

    const response = await fetch(`${apiBase}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              target: body.item,
              section: body.section,
              variant: body.variant,
              profile: body.profile,
              peerItems: (body.peerItems ?? []).slice(0, 8),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ suggestion: fallbackSuggestion(body), source: "fallback" });
    }

    const completion = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = completion.content?.find((entry) => entry.type === "text")?.text;

    if (!text?.trim()) {
      return NextResponse.json({ suggestion: fallbackSuggestion(body), source: "fallback" });
    }

    const parsed = JSON.parse(extractJsonObject(text)) as SuggestionResponse;
    return NextResponse.json({
      suggestion: {
        sectionDescription: parsed.sectionDescription ?? "",
        summary: parsed.summary ?? "",
        detail: parsed.detail ?? "",
        assetDescriptions: Array.isArray(parsed.assetDescriptions)
          ? parsed.assetDescriptions
              .filter((entry) => entry?.assetId && entry?.description)
              .map((entry) => ({ assetId: entry.assetId, description: entry.description }))
          : [],
      } satisfies SuggestionResponse,
      source: "llm",
    });
  } catch {
    return NextResponse.json({ error: "Suggestion request failed." }, { status: 500 });
  }
}
