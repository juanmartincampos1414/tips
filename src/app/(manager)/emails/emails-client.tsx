"use client";

import { useActionState, useState } from "react";

import {
  archiveTemplate,
  createTemplate,
  sendTestEmailAction,
  updateTemplate,
  type EmailActionState,
} from "./actions";
import type { EmailTemplate } from "@/lib/queries";
import { Button } from "@/components/ui/button";

const EMPTY: EmailActionState = {};

const STATUS_CLS: Record<string, string> = {
  draft: "bg-muted/15 text-muted",
  active: "bg-success/15 text-success",
  archived: "bg-dark/10 text-dark/60",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

function Notice({ state }: { state: EmailActionState }) {
  if (state.error)
    return (
      <p className="rounded-lg bg-pink/10 px-3 py-2 text-xs text-pink">{state.error}</p>
    );
  if (state.ok)
    return (
      <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">{state.ok}</p>
    );
  return null;
}

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-dark outline-none focus:border-pink";

export function TemplateCreateForm() {
  const [state, action, pending] = useActionState(createTemplate, EMPTY);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Notice state={state} />
      <div>
        <input name="name" placeholder="Nombre interno (ej: Bienvenida)" className={inputCls} />
        {state.fieldErrors?.name ? (
          <p className="mt-1 text-xs text-pink">{state.fieldErrors.name}</p>
        ) : null}
      </div>
      <div>
        <input name="subject" placeholder="Asunto del email" className={inputCls} />
        {state.fieldErrors?.subject ? (
          <p className="mt-1 text-xs text-pink">{state.fieldErrors.subject}</p>
        ) : null}
      </div>
      <div>
        <textarea
          name="body"
          rows={5}
          placeholder="Cuerpo del email (HTML permitido)"
          className={`${inputCls} resize-y font-mono text-xs`}
        />
        {state.fieldErrors?.body ? (
          <p className="mt-1 text-xs text-pink">{state.fieldErrors.body}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending} className="self-start px-5">
        {pending ? "Creando…" : "Crear template"}
      </Button>
    </form>
  );
}

export function TemplateCard({ template }: { template: EmailTemplate }) {
  const [state, action, pending] = useActionState(updateTemplate, EMPTY);
  const [preview, setPreview] = useState(false);
  const [body, setBody] = useState(template.body);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-dark">{template.name}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[template.status]}`}>
          {STATUS_LABEL[template.status]}
        </span>
      </div>

      <form action={action} className="flex flex-col gap-2">
        <Notice state={state} />
        <input type="hidden" name="id" value={template.id} />
        <input name="name" defaultValue={template.name} className={inputCls} />
        <input name="subject" defaultValue={template.subject} className={inputCls} />
        <textarea
          name="body"
          rows={4}
          defaultValue={template.body}
          onChange={(e) => setBody(e.target.value)}
          className={`${inputCls} resize-y font-mono text-xs`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select name="status" defaultValue={template.status} className="rounded-lg border border-border bg-card px-2 py-2 text-xs text-dark">
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </select>
          <Button type="submit" disabled={pending} className="px-4 text-xs">
            {pending ? "Guardando…" : "Guardar"}
          </Button>
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-dark hover:bg-background"
          >
            {preview ? "Ocultar preview" : "Previsualizar"}
          </button>
        </div>
      </form>

      {preview ? (
        <div className="mt-3 rounded-xl border border-border bg-background p-4">
          <p className="mb-2 text-xs font-medium text-muted">Vista previa</p>
          <div
            className="prose-sm max-w-none text-sm text-dark [&_a]:text-pink"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        </div>
      ) : null}

      {template.status !== "archived" ? (
        <form action={archiveTemplate} className="mt-2">
          <input type="hidden" name="id" value={template.id} />
          <button
            type="submit"
            onClick={(e) => {
              if (!window.confirm(`¿Archivar la plantilla "${template.name}"?`))
                e.preventDefault();
            }}
            className="text-xs font-medium text-muted hover:text-pink"
          >
            Archivar
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function TestSendForm({ ownerEmail }: { ownerEmail: string }) {
  const [state, action, pending] = useActionState(sendTestEmailAction, EMPTY);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Notice state={state} />
      <input name="to" defaultValue={ownerEmail} className={inputCls} />
      <input name="subject" placeholder="Asunto (opcional)" className={inputCls} />
      <textarea
        name="body"
        rows={3}
        placeholder="<p>Cuerpo de prueba (opcional)</p>"
        className={`${inputCls} resize-y font-mono text-xs`}
      />
      <Button type="submit" disabled={pending} className="self-start px-5">
        {pending ? "Enviando…" : "Enviar email de prueba"}
      </Button>
    </form>
  );
}
