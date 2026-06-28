import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import {
  getStaffBand,
  getStaffById,
  getStaffNfcHistory,
} from "@/lib/queries";
import { requireTenant } from "@/lib/tenant/context";
import type { NfcEventType } from "@/lib/database.types";

const EVENT_LABEL: Record<NfcEventType, string> = {
  created: "Creada",
  assigned: "Asignada",
  replaced: "Reemplazada",
  unassigned: "Liberada",
  lost: "Marcada perdida",
  damaged: "Marcada rota",
  archived: "Archivada",
};

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { restaurantId } = await requireTenant();
  const staff = await getStaffById(restaurantId, id);
  if (!staff || staff.status === "archived") notFound();

  const [band, history] = await Promise.all([
    getStaffBand(restaurantId, id),
    getStaffNfcHistory(restaurantId, id),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/staff" className="text-sm font-medium text-muted hover:text-dark">
        ← Volver a camareros
      </Link>

      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-dark">
          {staff.name}
        </h1>
        <p className="mt-1 text-sm text-muted">{staff.role ?? "—"}</p>
      </header>

      <h2 className="mb-2 text-sm font-semibold text-dark">NFC actual</h2>
      <Card className="mb-6">
        {band ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-dark">{band.serial_number}</p>
              <p className="font-mono text-xs text-muted">{band.uid}</p>
            </div>
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              Asignada
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Sin banda asignada. Asigná una desde{" "}
            <Link href="/nfc" className="font-medium text-pink">
              NFC Inventory
            </Link>
            .
          </p>
        )}
      </Card>

      <h2 className="mb-2 text-sm font-semibold text-dark">Historial NFC</h2>
      <Card className="p-0">
        {history.length === 0 ? (
          <p className="p-6 text-sm text-muted">Sin movimientos todavía.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {history.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium text-dark">
                    {EVENT_LABEL[e.event]}
                  </span>
                  {e.nfc_inventory ? (
                    <span className="ml-2 font-mono text-xs text-muted">
                      {e.nfc_inventory.uid}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-muted">{dateFmt(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
