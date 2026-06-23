"use client";

import { useActionState } from "react";

import { updateSettings, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function SettingsForm({
  placeId,
  reviewUrl,
  senderName,
  senderEmail,
  replyToEmail,
  emailEnabled,
}: {
  placeId: string;
  reviewUrl: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  emailEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateSettings,
    {} as ActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Field label="Google Place ID" name="google_place_id">
        <Input
          id="google_place_id"
          name="google_place_id"
          defaultValue={placeId}
          placeholder="ChIJ..."
        />
      </Field>

      <Field
        label="URL directa de reseña de Google"
        name="google_review_url"
        error={state.fieldErrors?.google_review_url}
      >
        <Input
          id="google_review_url"
          name="google_review_url"
          defaultValue={reviewUrl}
          placeholder="https://search.google.com/local/writereview?placeid=…"
        />
      </Field>

      <p className="text-xs text-muted">
        Si la completás, el botón &quot;Dejar reseña en Google&quot; lleva directo
        a tu ficha en vez de una búsqueda genérica.
      </p>

      <div className="my-2 border-t border-border" />
      <h3 className="text-sm font-semibold text-dark">Email (remitente)</h3>
      <p className="-mt-2 text-xs text-muted">
        Identidad de envío para futuras comunicaciones. Gestioná los templates
        en la sección Emails.
      </p>

      <Field label="Nombre del remitente" name="sender_name">
        <Input
          id="sender_name"
          name="sender_name"
          defaultValue={senderName}
          placeholder="Tano Restaurante"
        />
      </Field>

      <Field
        label="Email del remitente"
        name="sender_email"
        error={state.fieldErrors?.sender_email}
      >
        <Input
          id="sender_email"
          name="sender_email"
          defaultValue={senderEmail}
          placeholder="hola@turestaurante.com"
        />
      </Field>

      <Field
        label="Reply-to (opcional)"
        name="reply_to_email"
        error={state.fieldErrors?.reply_to_email}
      >
        <Input
          id="reply_to_email"
          name="reply_to_email"
          defaultValue={replyToEmail}
          placeholder="reservas@turestaurante.com"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-dark">
        <input
          type="checkbox"
          name="email_enabled"
          defaultChecked={emailEnabled}
          className="h-4 w-4 rounded border-border accent-pink"
        />
        Habilitar envío de emails
      </label>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Guardando…" : "Guardar configuración"}
      </Button>
    </form>
  );
}
