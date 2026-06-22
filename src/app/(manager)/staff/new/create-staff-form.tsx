"use client";

import { useActionState } from "react";
import Link from "next/link";

import { createStaff, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionState = {};

export function CreateStaffForm() {
  const [state, formAction, pending] = useActionState(createStaff, initial);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Field label="Nombre" name="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" placeholder="Tano" required />
      </Field>

      <Field label="Cargo" name="role">
        <Input id="role" name="role" placeholder="Camarero" />
      </Field>

      <Field label="Email" name="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" placeholder="tano@latrufa.com" />
      </Field>

      <Field label="Teléfono" name="phone">
        <Input id="phone" name="phone" placeholder="+54 11 1234 5678" />
      </Field>

      <Field label="Foto (opcional)" name="photo">
        <Input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          className="h-auto py-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-pink/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-pink"
        />
      </Field>

      <div className="mt-2 flex gap-3">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Creando…" : "Crear camarero"}
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
