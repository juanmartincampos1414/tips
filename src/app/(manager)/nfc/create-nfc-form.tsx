"use client";

import { useActionState } from "react";

import { createNfc, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionState = {};

export function CreateNfcForm() {
  const [state, formAction, pending] = useActionState(createNfc, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Field label="Serial" name="serial_number" error={state.fieldErrors?.serial_number}>
        <Input id="serial_number" name="serial_number" placeholder="TIPS-0003" required />
      </Field>

      <Field label="UID (hardware)" name="uid" error={state.fieldErrors?.uid}>
        <Input id="uid" name="uid" placeholder="04:A2:3F:…" required />
      </Field>

      <p className="text-xs text-muted">
        El UID es lo que codifica la banda física y resuelve el tap del cliente.
      </p>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Agregando…" : "Agregar al inventario"}
      </Button>
    </form>
  );
}
