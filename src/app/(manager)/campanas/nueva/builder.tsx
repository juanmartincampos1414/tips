"use client";

import { useActionState, useState } from "react";

import { createCampaign, type CampaignActionState } from "../actions";
import { CHANNEL_LABEL, SEGMENT_OPTIONS } from "@/lib/campaigns";
import { Button } from "@/components/ui/button";

type Tpl = { id: string; name: string; subject: string; body: string };
type Counts = Record<string, { email: number; whatsapp: number; total: number }>;

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-dark outline-none focus:border-pink";

export function CampaignBuilder({
  counts,
  templates,
}: {
  counts: Counts;
  templates: Tpl[];
}) {
  const [state, action, pending] = useActionState(
    createCampaign,
    {} as CampaignActionState,
  );
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [segment, setSegment] = useState(SEGMENT_OPTIONS[0].key);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");

  const reachable = counts[segment]?.[channel] ?? 0;
  const total = counts[segment]?.total ?? 0;
  const tpl = templates.find((t) => t.id === templateId);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-lg bg-pink/10 px-3 py-2 text-sm text-pink">{state.error}</p>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Nombre</label>
        <input name="name" placeholder="Ej: Volvé a visitarnos" className={inputCls} />
        {state.fieldErrors?.name ? (
          <p className="mt-1 text-xs text-pink">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Descripción (opcional)
        </label>
        <input name="description" placeholder="Objetivo interno de la campaña" className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Canal</label>
        <div className="flex gap-2">
          {(["email", "whatsapp"] as const).map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setChannel(c)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                channel === c
                  ? "border-pink bg-pink/10 text-pink"
                  : "border-border text-dark hover:bg-background"
              }`}
            >
              {CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
        <input type="hidden" name="channel" value={channel} />
        {channel === "whatsapp" ? (
          <p className="mt-1 text-xs text-amber-700">
            WhatsApp está preparado pero sin proveedor: los envíos se registran en
            modo mock.
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Segmento</label>
        <select
          name="segment"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className={inputCls}
        >
          {SEGMENT_OPTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} ({counts[s.key]?.total ?? 0})
            </option>
          ))}
        </select>
      </div>

      {channel === "email" ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Plantilla</label>
          {templates.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              No tenés plantillas. Creá una en <strong>Emails</strong> primero.
            </p>
          ) : (
            <select
              name="template_id"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={inputCls}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {state.fieldErrors?.template_id ? (
            <p className="mt-1 text-xs text-pink">{state.fieldErrors.template_id}</p>
          ) : null}
        </div>
      ) : null}

      {/* Audience projection */}
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-xs font-medium text-muted">Audiencia contactable</p>
        <p className="mt-1 text-2xl font-bold text-dark">
          {reachable}{" "}
          <span className="text-sm font-normal text-muted">
            de {total} en el segmento
          </span>
        </p>
        {reachable === 0 ? (
          <p className="mt-1 text-xs text-pink">
            Nadie en este segmento es contactable por {CHANNEL_LABEL[channel]} (requiere{" "}
            {channel === "email" ? "email" : "teléfono"} + consentimiento).
          </p>
        ) : null}
      </div>

      {/* Template preview */}
      {channel === "email" && tpl ? (
        <details className="rounded-xl border border-border bg-background p-4">
          <summary className="cursor-pointer text-xs font-medium text-muted">
            Vista previa · {tpl.subject}
          </summary>
          <div
            className="prose-sm mt-3 max-w-none text-sm text-dark [&_a]:text-pink"
            dangerouslySetInnerHTML={{ __html: tpl.body }}
          />
        </details>
      ) : null}

      <Button type="submit" disabled={pending || reachable === 0} className="self-start px-6">
        {pending ? "Creando…" : "Crear campaña"}
      </Button>
    </form>
  );
}
