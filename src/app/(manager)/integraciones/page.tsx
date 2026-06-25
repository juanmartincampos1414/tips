import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { getCurrentMembership } from "@/lib/auth";
import { getRecentEvents } from "@/lib/integrations/events";
import {
  getIntegrationsView,
  getSyncJobs,
  type IntegrationCard,
} from "@/lib/integrations/manager";
import { getCurrentRestaurant } from "@/lib/queries";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  type IntegrationCategory,
} from "@/lib/integrations/types";

import {
  connectProvider,
  disconnectProvider,
  syncNowAction,
  testConnectionAction,
  toggleSandbox,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  connected: "bg-success/15 text-success",
  disconnected: "bg-muted/15 text-muted",
  needs_configuration: "bg-muted/15 text-muted",
  sync_error: "bg-pink/10 text-pink",
  disabled: "bg-dark/10 text-dark/60",
};

const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const CATEGORY_ORDER: IntegrationCategory[] = [
  "pos",
  "pms",
  "reservations",
  "payments",
  "crm",
  "email",
  "whatsapp",
  "marketing",
  "wallet",
  "analytics",
  "identity",
];

export default async function IntegracionesPage() {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "owner") redirect("/dashboard");

  const restaurant = (await getCurrentRestaurant())!;
  const [{ cards, summary }, jobs, events] = await Promise.all([
    getIntegrationsView(restaurant.id),
    getSyncJobs(restaurant.id),
    getRecentEvents(restaurant.id),
  ]);

  const byCat = new Map<IntegrationCategory, IntegrationCard[]>();
  for (const c of cards) {
    if (!byCat.has(c.category)) byCat.set(c.category, []);
    byCat.get(c.category)!.push(c);
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-dark">Integraciones</h1>
        <p className="mt-1 text-sm text-muted">
          Conectá cualquier POS, PMS, reservas, CRM, pagos o comunicaciones. Todo
          en modo sandbox: arquitectura lista, sin credenciales reales todavía.
        </p>
      </header>

      {/* Health dashboard */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Conectadas" value={summary.connected} />
        <Kpi label="Con error" value={summary.errors} tone={summary.errors > 0 ? "warn" : undefined} />
        <Kpi label="Health prom." value={summary.avgHealth == null ? "—" : `${summary.avgHealth}%`} highlight />
        <Kpi label="Proveedores" value={cards.length} />
      </div>

      {/* Provider cards by category */}
      {CATEGORY_ORDER.filter((cat) => byCat.has(cat)).map((cat) => (
        <section key={cat} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-dark">{CATEGORY_LABEL[cat]}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {byCat.get(cat)!.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink/10 text-sm font-bold text-pink">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-dark">{c.name}</p>
                      <p className="text-xs text-muted">{c.description}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>

                {c.connection ? (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                    <span>Health {c.connection.health}%</span>
                    <span>Últ. sync {dt(c.connection.last_sync)}</span>
                    <span>{c.connection.sandbox ? "Sandbox" : "Producción"}</span>
                    {c.connection.last_error ? (
                      <span className="text-pink">Error: {c.connection.last_error.slice(0, 40)}</span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {!c.connection || c.status === "disconnected" ? (
                    <form action={connectProvider}>
                      <input type="hidden" name="provider" value={c.id} />
                      <button className="rounded-lg bg-pink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                        Conectar
                      </button>
                    </form>
                  ) : (
                    <>
                      <form action={testConnectionAction}>
                        <input type="hidden" name="provider" value={c.id} />
                        <button className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-dark hover:bg-background">
                          Probar
                        </button>
                      </form>
                      <form action={syncNowAction}>
                        <input type="hidden" name="connection_id" value={c.connection!.id} />
                        <button className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-dark hover:bg-background">
                          Sincronizar
                        </button>
                      </form>
                      <form action={toggleSandbox}>
                        <input type="hidden" name="provider" value={c.id} />
                        <button className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-background">
                          {c.connection.sandbox ? "→ Producción" : "→ Sandbox"}
                        </button>
                      </form>
                      <form action={disconnectProvider}>
                        <input type="hidden" name="provider" value={c.id} />
                        <ConfirmSubmit
                          message={`¿Desconectar ${c.name}?`}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-pink"
                        >
                          Desconectar
                        </ConfirmSubmit>
                      </form>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {/* Observability: sync jobs + event bus */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dark">Sync jobs</h2>
          <Card className="p-0">
            {jobs.length === 0 ? (
              <p className="p-5 text-sm text-muted">Sin sincronizaciones todavía.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <div>
                      <span className="font-medium text-dark">{j.provider}</span>{" "}
                      <span className="text-xs text-muted">
                        {j.direction} · {j.rows_processed} filas
                        {j.duration_ms != null ? ` · ${j.duration_ms}ms` : ""}
                      </span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${j.status === "completed" ? "bg-success/15 text-success" : j.status === "failed" ? "bg-pink/10 text-pink" : "bg-amber-100 text-amber-700"}`}>
                      {j.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-dark">Event bus</h2>
          <Card className="p-0">
            {events.length === 0 ? (
              <p className="p-5 text-sm text-muted">Sin eventos todavía.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
                    <span className="font-medium text-dark">{e.type}</span>
                    <span className="text-xs text-muted">{e.source} · {dt(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  tone?: "warn";
}) {
  return (
    <Card className={highlight ? "border-pink/30 bg-pink/5 p-4" : "p-4"}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "warn" ? "text-pink" : highlight ? "text-pink" : "text-dark"}`}>
        {value}
      </p>
    </Card>
  );
}
