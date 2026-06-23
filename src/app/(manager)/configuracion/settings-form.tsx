"use client";

import { useActionState } from "react";

import { updateSettings, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function SettingsForm({
  placeId,
  reviewUrl,
}: {
  placeId: string;
  reviewUrl: string;
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

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Guardando…" : "Guardar configuración"}
      </Button>
    </form>
  );
}
