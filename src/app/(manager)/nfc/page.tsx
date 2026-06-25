import Link from "next/link";

import { assignNfcBand, markNfcStatus } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  getCurrentRestaurant,
  getNfcInventory,
  getNfcKpis,
  getStaffOptions,
} from "@/lib/queries";
import type { NfcInventoryStatus } from "@/lib/database.types";

import { CreateNfcForm } from "./create-nfc-form";

const dateFmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const STATUS: Record<NfcInventoryStatus, { label: string; cls: string }> = {
  stock: { label: "Stock", cls: "bg-success/10 text-success" },
  assigned: { label: "Asignado", cls: "bg-pink/10 text-pink" },
  lost: { label: "Perdido", cls: "bg-warning/10 text-warning" },
  damaged: { label: "Roto", cls: "bg-warning/10 text-warning" },
  archived: { label: "Archivado", cls: "bg-background text-muted" },
};

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "stock", label: "Stock" },
  { key: "assigned", label: "Asignados" },
  { key: "lost", label: "Perdidos" },
  { key: "damaged", label: "Rotos" },
  { key: "archived", label: "Archivados" },
];

export default async function NfcPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const restaurant = (await getCurrentRestaurant())!;
  const [bands, kpis, staff] = await Promise.all([
    getNfcInventory(restaurant.id, status),
    getNfcKpis(restaurant.id),
    getStaffOptions(restaurant.id),
  ]);

  const kpiCards = [
    { label: "Totales", value: kpis.total },
    { label: "Asignados", value: kpis.assigned },
    { label: "Disponibles", value: kpis.stock },
    { label: "Perdidos", value: kpis.lost },
    { label: "Rotos", value: kpis.damaged },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-dark">
          NFC Inventory
        </h1>
        <p className="mt-1 text-sm text-muted">
          Inventario, asignación y ciclo de vida de las bandas físicas.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpiCards.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-xs font-medium text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-dark">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = (status ?? "") === f.key;
              return (
                <Link
                  key={f.key}
                  href={f.key ? `/nfc?status=${f.key}` : "/nfc"}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "bg-pink text-pink-foreground"
                      : "bg-card text-muted hover:bg-background"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          {bands.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="text-sm text-muted">No hay bandas en esta vista.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Serial / UID</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Asignado</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((b) => (
                    <tr key={b.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-dark">{b.serial_number}</div>
                        <div className="font-mono text-xs text-muted">{b.uid}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[b.status].cls}`}>
                          {STATUS[b.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {b.staff?.name ?? "—"}
                        {b.assigned_at ? (
                          <div className="text-xs">{dateFmt(b.assigned_at)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {b.status === "stock" ? (
                            <form action={assignNfcBand} className="flex items-center gap-1.5">
                              <input type="hidden" name="nfc_id" value={b.id} />
                              <select
                                name="staff_id"
                                required
                                defaultValue=""
                                className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-dark outline-none"
                              >
                                <option value="" disabled>
                                  Asignar a…
                                </option>
                                {staff.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              <SubmitButton
                                pendingLabel="…"
                                className="h-8 bg-pink/10 px-3 py-0 text-xs font-semibold text-pink hover:bg-pink/20"
                              >
                                Asignar
                              </SubmitButton>
                            </form>
                          ) : null}

                          {b.status === "assigned" ? (
                            <>
                              <a
                                href={`/t/${restaurant.slug}/${encodeURIComponent(b.uid)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-background hover:text-dark"
                              >
                                Perfil ↗
                              </a>
                              <MarkButton id={b.id} status="lost" label="Perdido" />
                              <MarkButton id={b.id} status="damaged" label="Roto" />
                            </>
                          ) : null}

                          {b.status !== "archived" ? (
                            <MarkButton id={b.id} status="archived" label="Archivar" />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-dark">Agregar banda</h2>
          <Card>
            <CreateNfcForm />
          </Card>
        </div>
      </div>
    </div>
  );
}

function MarkButton({
  id,
  status,
  label,
}: {
  id: string;
  status: string;
  label: string;
}) {
  return (
    <form action={markNfcStatus}>
      <input type="hidden" name="nfc_id" value={id} />
      <input type="hidden" name="status" value={status} />
      <ConfirmSubmit
        message={`¿Marcar esta banda como "${label}"? Se desasigna del camarero.`}
        className="h-8 rounded bg-transparent px-2 py-0 text-xs font-semibold text-muted hover:bg-background hover:text-dark"
      >
        {label}
      </ConfirmSubmit>
    </form>
  );
}
