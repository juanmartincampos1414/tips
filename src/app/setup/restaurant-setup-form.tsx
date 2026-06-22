"use client";

import { useActionState } from "react";

import { createRestaurant, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionState = {};

export function RestaurantSetupForm() {
  const [state, formAction, pending] = useActionState(createRestaurant, initial);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Field label="Nombre del restaurante" name="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" placeholder="La Trufa" required />
      </Field>

      <Field label="Email" name="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" placeholder="hola@latrufa.com" />
      </Field>

      <Field label="Teléfono" name="phone">
        <Input id="phone" name="phone" placeholder="+54 11 1234 5678" />
      </Field>

      <Field label="Logo (opcional)" name="logo">
        <Input
          id="logo"
          name="logo"
          type="file"
          accept="image/*"
          className="h-auto py-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-pink/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-pink"
        />
      </Field>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Creando…" : "Crear restaurante"}
      </Button>
    </form>
  );
}
