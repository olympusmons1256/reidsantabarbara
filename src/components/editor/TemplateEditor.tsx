"use client";

import { useEffect, useState } from "react";
import { blankTemplate } from "@/data/blankTemplate";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getTemplateById, listTemplates, saveTemplate, uploadTemplateAsset } from "@/lib/supabase/templateStore";
import { normalizeTemplate } from "@/lib/template/transformTemplate";
import type {
  ResumeTemplate,
  StoredTemplateRecord,
  TemplateAsset,
  TemplateConnection,
  TemplateItem,
  TemplateSection,
  TemplateTourStep,
  TemplateVariant,
} from "@/types/template";

const LOCAL_TEMPLATE_KEY = "resume-template-draft";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function TemplateEditor() {
  const [template, setTemplate] = useState<ResumeTemplate>(blankTemplate);
  const [activeVariantId, setActiveVariantId] = useState(blankTemplate.defaultVariantId ?? blankTemplate.variants[0]?.id ?? "");
  const [status, setStatus] = useState("Idle");
  const [email, setEmail] = useState("");
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<StoredTemplateRecord[]>([]);
  const [openVariantByTemplateId, setOpenVariantByTemplateId] = useState<Record<string, string>>({});

  const supabaseEnabled = Boolean(getSupabaseBrowserClient());
  const activeVariant = template.variants.find((variant) => variant.id === activeVariantId) ?? template.variants[0] ?? null;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(LOCAL_TEMPLATE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = normalizeTemplate(JSON.parse(raw) as ResumeTemplate);
      setTemplate(parsed);
      setActiveVariantId(parsed.defaultVariantId ?? parsed.variants[0]?.id ?? "");
      setStatus("Loaded local draft.");
    } catch {
      // Ignore malformed local draft.
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_TEMPLATE_KEY, JSON.stringify(template));
    }
  }, [template]);

  const updateTemplate = (updater: (current: ResumeTemplate) => ResumeTemplate) => {
    setTemplate((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }));
  };

  const updateActiveVariant = (updater: (variant: TemplateVariant) => TemplateVariant) => {
    if (!activeVariant) {
      return;
    }

    updateTemplate((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.id === activeVariant.id ? updater(variant) : variant
      ),
    }));
  };

  const updateSection = (sectionId: string, updater: (section: TemplateSection) => TemplateSection) => {
    updateActiveVariant((variant) => ({
      ...variant,
      sections: variant.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
    }));
  };

  const updateItem = (sectionId: string, itemId: string, updater: (item: TemplateItem) => TemplateItem) => {
    updateSection(sectionId, (section) => ({
      ...section,
      items: section.items.map((item) => (item.id === itemId ? updater(item) : item)),
    }));
  };

  const sendMagicLink = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      setIsSendingMagicLink(true);
      setStatus("Sending magic link...");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/editor` },
      });
      if (error) {
        throw error;
      }
      setStatus("Magic link sent. Check your email.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to send magic link.");
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handleSaveTemplate = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      setStatus("Saving template...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Sign in first to save templates.");
        return;
      }

      const saved = await saveTemplate({
        id: template.id.startsWith("template-") ? undefined : template.id,
        ownerId: user.id,
        title: template.title,
        template,
      });

      const normalized = normalizeTemplate(saved.data);
      setTemplate({ ...normalized, id: saved.id });
      setStatus("Template saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    }
  };

  const handleLoadTemplates = async () => {
    try {
      setStatus("Loading templates...");
      const rows = await listTemplates();
      setSavedTemplates(rows);
      setOpenVariantByTemplateId(
        Object.fromEntries(
          rows.map((row) => {
            const normalized = normalizeTemplate(row.data);
            return [row.id, normalized.defaultVariantId ?? normalized.variants[0]?.id ?? ""];
          })
        )
      );
      setStatus("Templates loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Load failed.");
    }
  };

  const loadTemplateIntoEditor = async (id: string) => {
    try {
      setStatus("Loading template...");
      const row = await getTemplateById(id);
      if (!row) {
        setStatus("Template not found.");
        return;
      }
      const normalized = normalizeTemplate(row.data);
      setTemplate(normalized);
      setActiveVariantId(normalized.defaultVariantId ?? normalized.variants[0]?.id ?? "");
      setStatus("Template loaded into editor.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Template load failed.");
    }
  };

  const uploadAssetFile = async (file: File, sectionId: string, itemId: string, assetId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      setStatus("Uploading media...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Sign in first to upload media.");
        return;
      }

      const uploaded = await uploadTemplateAsset({ ownerId: user.id, file });
      updateItem(sectionId, itemId, (current) => ({
        ...current,
        assets: current.assets.map((asset) =>
          asset.id === assetId ? { ...asset, url: uploaded.publicUrl, preview: uploaded.publicUrl } : asset
        ),
      }));
      setStatus("Media uploaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const addVariant = () => {
    const variantId = uid("variant");
    const variant: TemplateVariant = {
      id: variantId,
      title: `Variant ${template.variants.length + 1}`,
      audience: "",
      tagDimensions: [
        { id: "company", label: "Company", allowMultiple: false, options: [] },
        { id: "activation", label: "Activation Type", allowMultiple: false, options: [] },
        { id: "role", label: "Role", allowMultiple: true, options: [] },
      ],
      sections: [],
      timelineTour: { enabled: true, steps: [] },
    };

    updateTemplate((current) => ({
      ...current,
      defaultVariantId: current.defaultVariantId ?? variantId,
      variants: [...current.variants, variant],
    }));
    setActiveVariantId(variantId);
  };

  const addDimension = () => {
    updateActiveVariant((variant) => ({
      ...variant,
      tagDimensions: [
        ...variant.tagDimensions,
        { id: uid("dimension"), label: "New Dimension", allowMultiple: false, options: [] },
      ],
    }));
  };

  const addSection = () => {
    updateActiveVariant((variant) => ({
      ...variant,
      sections: [...variant.sections, { id: uid("section"), title: "New Section", subtitle: "", description: "", items: [] }],
    }));
  };

  const addItem = (sectionId: string) => {
    const tagDefaults = Object.fromEntries((activeVariant?.tagDimensions ?? []).map((dimension) => [dimension.id, []]));
    updateSection(sectionId, (section) => ({
      ...section,
      items: [...section.items, { id: uid("item"), title: "New Item", summary: "", detail: "", tags: tagDefaults, assets: [] }],
    }));
  };

  const addAsset = (sectionId: string, itemId: string) => {
    updateItem(sectionId, itemId, (item) => ({
      ...item,
      assets: [...item.assets, { id: uid("asset"), label: "New Asset", type: "image", url: "", preview: "" }],
    }));
  };

  const addTourStep = () => {
    const first = activeVariant?.sections.flatMap((section) => section.items.map((item) => ({ section, item })))[0];
    if (!activeVariant || !first) {
      return;
    }

    const step: TemplateTourStep = {
      id: uid("step"),
      label: `Step ${activeVariant.timelineTour.steps.length + 1}`,
      sectionId: first.section.id,
      itemId: first.item.id,
      durationMs: 1800,
    };

    updateActiveVariant((variant) => ({
      ...variant,
      timelineTour: { ...variant.timelineTour, steps: [...variant.timelineTour.steps, step] },
    }));
  };

  const addConnection = () => {
    if (template.variants.length < 2) {
      setStatus("Add at least two variants before creating a connection.");
      return;
    }

    const sourceVariant = template.variants[0];
    const targetVariant = template.variants[1];
    const sourceSection = sourceVariant.sections[0];
    const targetSection = targetVariant.sections[0];
    const sourceItem = sourceSection?.items[0];
    const targetItem = targetSection?.items[0];
    if (!sourceSection || !targetSection || !sourceItem || !targetItem) {
      setStatus("Each of two variants needs at least one item before creating a connection.");
      return;
    }

    const connection: TemplateConnection = {
      id: uid("connection"),
      label: "Shared Thread",
      type: "career pivot",
      narrative: "Describe the connective tissue between these two resume items.",
      sourceVariantId: sourceVariant.id,
      sourceSectionId: sourceSection.id,
      sourceItemId: sourceItem.id,
      targetVariantId: targetVariant.id,
      targetSectionId: targetSection.id,
      targetItemId: targetItem.id,
    };

    updateTemplate((current) => ({ ...current, connections: [...current.connections, connection] }));
  };

  const getVariantItemOptions = (variantId: string) => {
    const variant = template.variants.find((entry) => entry.id === variantId);
    if (!variant) {
      return [] as Array<{ value: string; label: string }>;
    }
    return variant.sections.flatMap((section) =>
      section.items.map((item) => ({ value: `${section.id}::${item.id}`, label: `${section.title} — ${item.title}` }))
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-10">
      <header className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--label)" }}>Template Builder</p>
        <h1 className="mt-2 text-2xl font-light" style={{ color: "#f0f0f0" }}>Generic Resume Collection Editor</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--label)" }}>
          Build shared identity, multiple resume variants, explicit connections, media, and guided timeline tours.
        </p>
      </header>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Auth + Supabase</p>
        {!supabaseEnabled ? (
          <p className="mt-3 text-sm" style={{ color: "#fda4af" }}>Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email for magic link" className="min-w-64 flex-1 border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
            <button type="button" disabled={!email || isSendingMagicLink} onClick={sendMagicLink} className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Send Link</button>
            <button type="button" onClick={handleLoadTemplates} className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Load Templates</button>
            <button type="button" onClick={handleSaveTemplate} className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a" }}>Save Template</button>
          </div>
        )}
        <p className="mt-2 text-xs" style={{ color: "var(--label)" }}>{status}</p>
        {savedTemplates.length ? (
          <ul className="mt-3 space-y-2 text-xs" style={{ color: "var(--label)" }}>
            {savedTemplates.map((row) => {
              const normalizedRow = normalizeTemplate(row.data);
              const selectedVariantId =
                openVariantByTemplateId[row.id] ?? normalizedRow.defaultVariantId ?? normalizedRow.variants[0]?.id ?? "";

              return (
                <li key={row.id} className="flex items-center justify-between gap-2 border px-3 py-2" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                  <span>{row.title}</span>
                  <span className="flex items-center gap-2">
                    {normalizedRow.variants.length ? (
                    <select
                      value={selectedVariantId}
                      onChange={(event) =>
                        setOpenVariantByTemplateId((current) => ({
                          ...current,
                          [row.id]: event.target.value,
                        }))
                      }
                      className="px-2 py-1 uppercase tracking-[0.12em]"
                      style={{ border: "1px solid var(--border)", borderRadius: "2px", background: "transparent", color: "#e4e4e7" }}
                    >
                      {normalizedRow.variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.title}
                        </option>
                      ))}
                    </select>
                    ) : null}
                    <button type="button" onClick={() => { void loadTemplateIntoEditor(row.id); }} className="px-2 py-1 uppercase tracking-[0.14em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Load</button>
                    <a href={`/?templateId=${row.id}&variantId=${encodeURIComponent(selectedVariantId)}`} target="_blank" rel="noreferrer" className="px-2 py-1 uppercase tracking-[0.14em]" style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a" }}>Open Resume</a>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Shared Profile</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[ ["name", template.profile.name], ["title", template.profile.title], ["location", template.profile.location], ["email", template.profile.email], ["heroImage", template.profile.heroImage ?? ""] ].map(([field, value]) => (
            <input key={field} value={value} onChange={(event) => updateTemplate((current) => ({ ...current, profile: { ...current.profile, [field]: event.target.value } }))} placeholder={field === "heroImage" ? "Hero image URL" : String(field)} className="border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
          ))}
        </div>
        <textarea value={template.profile.summary} onChange={(event) => updateTemplate((current) => ({ ...current, profile: { ...current.profile, summary: event.target.value } }))} placeholder="Profile summary" className="mt-3 w-full border bg-transparent px-3 py-2 text-sm" rows={4} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Resume Variants</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--label)" }}>Create separate creative, technical, or audience-specific resume narratives.</p>
          </div>
          <button type="button" onClick={addVariant} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Variant</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {template.variants.map((variant) => (
            <button key={variant.id} type="button" onClick={() => setActiveVariantId(variant.id)} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: activeVariantId === variant.id ? "#f0f0f0" : "var(--label)", background: activeVariantId === variant.id ? "rgba(255,255,255,0.08)" : "transparent" }}>{variant.title}</button>
          ))}
        </div>
        {activeVariant ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input value={activeVariant.title} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, title: event.target.value }))} placeholder="Variant title" className="border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
            <input value={activeVariant.audience ?? ""} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, audience: event.target.value }))} placeholder="Audience / perspective" className="border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
          </div>
        ) : null}
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Sort Dimensions · {activeVariant?.title ?? "No Variant"}</h2>
          <button type="button" onClick={addDimension} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Dimension</button>
        </div>
        <div className="mt-4 space-y-3">
          {(activeVariant?.tagDimensions ?? []).map((dimension) => (
            <div key={dimension.id} className="border p-3" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={dimension.label} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, tagDimensions: variant.tagDimensions.map((item) => item.id === dimension.id ? { ...item, label: event.target.value } : item) }))} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <input value={dimension.id} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, tagDimensions: variant.tagDimensions.map((item) => item.id === dimension.id ? { ...item, id: event.target.value } : item) }))} placeholder="dimension-id" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--label)" }}><input type="checkbox" checked={dimension.allowMultiple} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, tagDimensions: variant.tagDimensions.map((item) => item.id === dimension.id ? { ...item, allowMultiple: event.target.checked } : item) }))} />Allow multiple values</label>
              </div>
              <input value={dimension.options.join(", ")} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, tagDimensions: variant.tagDimensions.map((item) => item.id === dimension.id ? { ...item, options: event.target.value.split(",").map((token) => token.trim()).filter(Boolean) } : item) }))} placeholder="option-a, option-b" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
            </div>
          ))}
        </div>
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Sections + Items + Media</h2>
          <button type="button" onClick={addSection} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Section</button>
        </div>
        <div className="mt-4 space-y-4">
          {(activeVariant?.sections ?? []).map((section) => (
            <article key={section.id} className="border p-4" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={section.title} onChange={(event) => updateSection(section.id, (current) => ({ ...current, title: event.target.value }))} placeholder="Section title" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <input value={section.subtitle} onChange={(event) => updateSection(section.id, (current) => ({ ...current, subtitle: event.target.value }))} placeholder="Section subtitle" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              </div>
              <textarea value={section.description} onChange={(event) => updateSection(section.id, (current) => ({ ...current, description: event.target.value }))} placeholder="Section description" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" rows={2} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              <button type="button" onClick={() => addItem(section.id)} className="mt-3 px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Item</button>
              <div className="mt-3 space-y-3">
                {section.items.map((item) => (
                  <div key={item.id} className="border p-3" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                    <input value={item.title} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, title: event.target.value }))} placeholder="Item title" className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                    <textarea value={item.summary} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, summary: event.target.value }))} placeholder="Item summary" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" rows={3} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                    <textarea value={item.detail} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, detail: event.target.value }))} placeholder="Detailed narrative / impact" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" rows={4} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(activeVariant?.tagDimensions ?? []).map((dimension) => (
                        <input key={`${item.id}-${dimension.id}`} value={(item.tags[dimension.id] ?? []).join(", ")} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, tags: { ...current.tags, [dimension.id]: event.target.value.split(",").map((token) => token.trim()).filter(Boolean) } }))} placeholder={`${dimension.label} values`} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--label)" }}>Media Assets</p>
                      <button type="button" onClick={() => addAsset(section.id, item.id)} className="px-2 py-1 text-[10px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Asset</button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {item.assets.map((asset) => (
                        <div key={asset.id} className="grid gap-2 sm:grid-cols-4">
                          <input value={asset.label} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id === asset.id ? { ...token, label: event.target.value } : token) }))} placeholder="Label" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                          <select value={asset.type} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id === asset.id ? { ...token, type: event.target.value as TemplateAsset["type"] } : token) }))} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}><option value="image">image</option><option value="video">video</option><option value="doc">doc</option></select>
                          <input value={asset.url} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id === asset.id ? { ...token, url: event.target.value } : token) }))} placeholder="https://..." className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                          <input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void uploadAssetFile(file, section.id, item.id, asset.id); }} className="border bg-transparent px-2 py-1 text-xs" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Timeline Tour Configuration</h2>
          <button type="button" onClick={addTourStep} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Tour Step</button>
        </div>
        <div className="mt-3 space-y-2">
          {(activeVariant?.timelineTour.steps ?? []).map((step, index) => {
            const options = getVariantItemOptions(activeVariant?.id ?? "");
            return (
              <div key={step.id} className="grid gap-2 border p-3 sm:grid-cols-4" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                <input value={step.label} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, timelineTour: { ...variant.timelineTour, steps: variant.timelineTour.steps.map((token, tokenIndex) => tokenIndex === index ? { ...token, label: event.target.value } : token) } }))} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <select value={`${step.sectionId}::${step.itemId}`} onChange={(event) => { const [sectionId, itemId] = event.target.value.split("::"); updateActiveVariant((variant) => ({ ...variant, timelineTour: { ...variant.timelineTour, steps: variant.timelineTour.steps.map((token, tokenIndex) => tokenIndex === index ? { ...token, sectionId, itemId } : token) } })); }} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                <input type="number" value={step.durationMs} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, timelineTour: { ...variant.timelineTour, steps: variant.timelineTour.steps.map((token, tokenIndex) => tokenIndex === index ? { ...token, durationMs: Number(event.target.value) || 0 } : token) } }))} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--label)" }}><input type="checkbox" checked={activeVariant?.timelineTour.enabled ?? true} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, timelineTour: { ...variant.timelineTour, enabled: event.target.checked } }))} />Tour enabled</label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Resume Connections</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--label)" }}>Bridge items across creative, technical, or audience-specific resumes.</p>
          </div>
          <button type="button" onClick={addConnection} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Connection</button>
        </div>
        <div className="mt-4 space-y-3">
          {template.connections.map((connection) => {
            const sourceOptions = getVariantItemOptions(connection.sourceVariantId);
            const targetOptions = getVariantItemOptions(connection.targetVariantId);
            return (
              <div key={connection.id} className="border p-3" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={connection.label} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, label: event.target.value } : token) }))} placeholder="Connection label" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                  <input value={connection.type} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, type: event.target.value } : token) }))} placeholder="Connection type" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                </div>
                <textarea value={connection.narrative} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, narrative: event.target.value } : token) }))} placeholder="Narrative bridge between these two resume items" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" rows={3} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Source</p>
                    <select value={connection.sourceVariantId} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, sourceVariantId: event.target.value } : token) }))} className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{template.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.title}</option>)}</select>
                    <select value={`${connection.sourceSectionId}::${connection.sourceItemId}`} onChange={(event) => { const [sourceSectionId, sourceItemId] = event.target.value.split("::"); updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, sourceSectionId, sourceItemId } : token) })); }} className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Target</p>
                    <select value={connection.targetVariantId} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, targetVariantId: event.target.value } : token) }))} className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{template.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.title}</option>)}</select>
                    <select value={`${connection.targetSectionId}::${connection.targetItemId}`} onChange={(event) => { const [targetSectionId, targetItemId] = event.target.value.split("::"); updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, targetSectionId, targetItemId } : token) })); }} className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>JSON Preview</h2>
        <pre className="mt-3 overflow-x-auto text-xs" style={{ color: "#c4c4c8" }}>{JSON.stringify(template, null, 2)}</pre>
      </section>
    </main>
  );
}
