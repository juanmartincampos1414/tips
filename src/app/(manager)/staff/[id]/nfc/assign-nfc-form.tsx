"use client";

import { useActionState } from "react";
import Link from "next/link";

import { assignNfc, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionState = {};

export function AssignNfcForm({
  staffId,
  currentCode,
}: {
  staffId: string;
  currentCode?: string;
}) {
  const action = assignNfc.bind(null, staffId);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Field label="Código NFC" name="nfc_code" error={state.fieldErrors?.nfc_code}>
        <Input
          id="nfc_code"
          name="nfc_code"
          placeholder="TIPS-0001"
          defaultValue={currentCode}
          autoFocus
          required
        />
      </Field>

      <p className="text-xs text-muted">
        Un camarero sólo puede tener una banda activa. Reasignar desactiva la
        anterior.
      </p>

      <div className="mt-2 flex gap-3">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Asignando…" : "Asignar NFC"}
        </Button>
        <Link
          href="/staff"
          className="inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-muted hover:bg-background hover:text-dark"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
