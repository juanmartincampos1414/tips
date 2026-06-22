"use client";

import { useActionState } from "react";

import { createRewardTemplate, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { REWARD_TYPES } from "@/lib/rewards";

const initial: ActionState = {};

export function TemplateForm() {
  const [state, formAction, pending] = useActionState(
    createRewardTemplate,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Field label="Nombre del beneficio" name="title" error={state.fieldErrors?.title}>
        <Input id="title" name="title" placeholder="10% de descuento" required />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo" name="reward_type" error={state.fieldErrors?.reward_type}>
          <select
            id="reward_type"
            name="reward_type"
            defaultValue="cashback_percentage"
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-dark outline-none focus:border-pink focus:ring-2 focus:ring-pink/20"
          >
            {REWARD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Valor" name="value" error={state.fieldErrors?.value}>
          <Input id="value" name="value" type="number" min={0} defaultValue={10} />
        </Field>
      </div>

      <Field
        label="Vencimiento (días)"
        name="expiration_days"
        error={state.fieldErrors?.expiration_days}
      >
        <Input
          id="expiration_days"
          name="expiration_days"
          type="number"
          min={1}
          defaultValue={30}
        />
      </Field>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Guardando…" : "Crear template"}
      </Button>
    </form>
  );
}
