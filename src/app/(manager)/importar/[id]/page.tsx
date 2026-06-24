import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  getCurrentRestaurant,
  getImport,
  getImportRows,
} from "@/lib/queries";
import type { ImportRowAction } from "@/lib/database.types";

import { commitImport } from "../actions";

// Large commits process tens of thousands of rows in batches.
export const maxDuration = 300;

const ACTION: Record<ImportRowAction, { label: string; cls: string }> = {
  create: { label: "Nuevo", cls: "bg-success/10 text-success" },
  update: { label: "Actualizar", cls: "bg-pink/10 text-pink" },
  skip: { label: "Omitido", cls: "bg-background text-muted" },
  invalid: { label: "Inválido", cls: "bg-warning/10 text-warning" },
};

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurant = (await getCurrentRestaurant())!;
  const imp = await getImport(id, restaurant.id);
  if (!imp) notFound();
  const rows = await getImportRows(id, 200);

  const done = imp.status === "completed";

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link href="/importar" className="text-sm font-medium text-muted hover:text-dark">
        ← Volver a importar
      </Link>

      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-dark">
          {imp.filename ?? "Importación"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {imp.source ? `Fuente: ${imp.source} · ` : ""}
          {imp.total_rows} filas
        </p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Summary label={done ? "Creados" : "Se crearán"} value={imp.created_count} />
        <Summary
          label={done ? "Actualizados" : "Se actualizarán"}
          value={imp.updated_count}
        />
        <Summary label="Omitidos" value={imp.skipped_count} />
      </div>

      {done ? (
        <div className="mb-6 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
          ✓ Importación completada. Los clientes ya están en tu CRM.
        </div>
      ) : (
        <Card className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Nada se guardó todavía. Revisá el preview y confirmá para aplicar.
          </p>
          <form action={commitImport}>
            <input type="hidden" name="import_id" value={imp.id} />
            <SubmitButton pendingLabel="Importando…">
              Confirmar importación
            </SubmitButton>
          </form>
        </Card>
      )}

      <p className="mb-2 text-xs text-muted">
        Así van a entrar al CRM. Revisá cada fila antes de confirmar.
      </p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Nombre</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Teléfono</th>
              <th className="px-3 py-3 font-medium">Nacimiento</th>
              <th className="px-3 py-3 font-medium">País</th>
              <th className="px-3 py-3 font-medium">Tags</th>
              <th className="px-3 py-3 font-medium">Segmento</th>
              <th className="px-3 py-3 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = (r.mapped ?? {}) as {
                name?: string;
                email?: string;
                phone?: string;
                birth_date?: string;
                country?: string;
                tags?: string[];
                segment?: string;
              };
              return (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-muted">{r.row_number}</td>
                  <td className="px-3 py-2 font-medium text-dark">{m.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{m.email ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{m.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{m.birth_date ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{m.country ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {m.tags?.length ? m.tags.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{m.segment ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ACTION[r.action].cls}`}>
                      {ACTION[r.action].label}
                    </span>
                    {r.error ? (
                      <span className="ml-1 block text-[11px] text-muted">{r.error}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {imp.total_rows > rows.length ? (
          <p className="border-t border-border px-4 py-2 text-xs text-muted">
            Mostrando {rows.length} de {imp.total_rows} filas.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-dark">{value}</p>
    </Card>
  );
}
