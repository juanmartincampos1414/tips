"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import { previewImport, type ImportState } from "./actions";

const initial: ImportState = {};

export function UploadForm() {
  const [state, formAction, pending] = useActionState(previewImport, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Field label="Archivo (CSV o Excel)" name="file">
        <Input
          id="file"
          name="file"
          type="file"
          accept=".csv,.xlsx,.xls"
          required
          className="h-auto py-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-pink/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-pink"
        />
      </Field>

      <Field label="Fuente (opcional)" name="source">
        <Input id="source" name="source" placeholder="Maitre, OpenTable, SevenRooms…" />
      </Field>

      <p className="text-xs text-muted">
        Detectamos automáticamente columnas de nombre, email, teléfono, fecha de
        nacimiento, notas, tags, visitas, última visita y segmento. Vas a ver un
        preview antes de confirmar.
      </p>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Procesando…" : "Subir y previsualizar"}
      </Button>
    </form>
  );
}
