"use client";

import { useActionState } from "react";

import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Field label="Email" name="email">
        <Input id="email" name="email" type="email" placeholder="hola@latrufa.com" autoFocus required />
      </Field>

      <Field label="Contraseña" name="password">
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
      </Field>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
