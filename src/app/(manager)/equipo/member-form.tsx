"use client";

import { useActionState, useState } from "react";

import { createMember, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionState = {};

export function MemberForm({
  staff,
}: {
  staff: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createMember, initial);
  const [role, setRole] = useState("manager");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Field label="Email" name="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" placeholder="persona@email.com" required />
      </Field>

      <Field
        label="Contraseña temporal"
        name="password"
        error={state.fieldErrors?.password}
      >
        <Input id="password" name="password" type="text" placeholder="mínimo 8 caracteres" required />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rol" name="role" error={state.fieldErrors?.role}>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-dark outline-none focus:border-pink focus:ring-2 focus:ring-pink/20"
          >
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </select>
        </Field>

        {role === "staff" ? (
          <Field label="Camarero (opcional)" name="staff_id">
            <select
              id="staff_id"
              name="staff_id"
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-dark outline-none focus:border-pink focus:ring-2 focus:ring-pink/20"
            >
              <option value="">—</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Creando…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
