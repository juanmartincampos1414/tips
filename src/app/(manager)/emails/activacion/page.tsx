import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getEmailReadiness } from "@/lib/email/readiness";
import { getCurrentRestaurant, getRecentEmailLogs } from "@/lib/queries";

import { createTestLog, retryEmailAction, simulateEvent } from "./actions";

export const dynamic = "force-dynamic";

const SIM_EVENTS = ["delivered", "opened", "clicked", "bounced", "complained"] as const;

const STATUS_CLS: Record<string, string> = {
  pending: "bg-muted/15 text-muted",
  processing: "bg-amber-100 text-amber-700",
  sent: "bg-success/15 text-success",
  failed: "bg-pink/10 text-pink",
  skipped: "bg-muted/15 text-muted",
};

export default async function ActivacionPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const [r, logs] = await Promise.all([
    getEmailReadiness(restaurant.id),
    getRecentEmailLogs(restaurant.id),
  ]);
  const h = r.health;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link href="/emails" className="text-sm font-medium text-muted hover:text-dark">
        ← Volver a Emails
      </Link>
      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-dark">
          Activación de email
        </h1>
        <p className="mt-1 text-sm text-muted">
          Estado de la infraestructura de Resend. Cuando todo esté en verde, el
          envío real funciona sin tocar código.
        </p>
      </header>

      {/* Activation banner */}
      <Card
        className={`mb-6 p-4 ${r.activated ? "border-success/30 bg-success/5" : "border-amber-200 bg-amber-50"}`}
      >
        <p className={`text-sm font-semibold ${r.activated ? "text-success" : "text-amber-700"}`}>
          {r.activated
            ? "✓ Email activado — enviando en modo real (Resend)."
            : `Modo ${r.provider === "resend" ? "Resend (incompleto)" : "mock"} — falta configuración para activar.`}
        </p>
      </Card>

      {/* Configuration validation */}
      <h2 className="mb-3 text-sm font-semibold text-dark">Validación de configuración</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusCard label="Resend (API key)" ok={r.hasApiKey} okText="Configurado" noText="No configurado" />
        <StatusCard label="Webhook" ok={r.webhookActive} okText="Activo" noText="Sin secret" />
        <StatusCard label="Sender" ok={r.senderConfigured} okText={r.senderEmail ?? "OK"} noText="Sin definir" />
        <StatusCard
          label="Dominio"
          ok={!!r.domain?.verified}
          okText={r.domain?.name ?? "Verificado"}
          noText={
            !r.domainChecked
              ? "No verificable (sin API key)"
              : r.domain
                ? `${r.domain.name} sin verificar`
                : "Sin dominio"
          }
          neutral={!r.domainChecked}
        />
      </div>

      {/* Environment readiness checklist */}
      <h2 className="mb-3 text-sm font-semibold text-dark">Checklist de entorno</h2>
      <Card className="mb-6 p-0">
        <ul className="divide-y divide-border/60">
          {r.checklist.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className={c.ok ? "text-success" : "text-muted"}>{c.ok ? "✓" : "○"}</span>
                <code className="text-sm text-dark">{c.label}</code>
              </div>
              <span className="text-xs text-muted">{c.ok ? "Listo" : c.hint}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Email health */}
      <h2 className="mb-3 text-sm font-semibold text-dark">Salud de email</h2>
      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
        <Metric label="Enviados" value={h.sent} />
        <Metric label="Entregados" value={h.delivered} />
        <Metric label="Abiertos" value={h.opened} />
        <Metric label="Clickeados" value={h.clicked} />
        <Metric label="Rebotes" value={h.bounced} tone="warn" />
        <Metric label="Quejas" value={h.complained} tone="warn" />
        <Metric label="Errores" value={h.failed} tone="warn" />
        <Metric label="Procesando" value={h.processing} />
        <Metric label="Omitidos" value={h.skipped} />
      </div>

      {/* Testing utilities */}
      <h2 className="mb-1 text-sm font-semibold text-dark">Testing utilities</h2>
      <p className="mb-3 text-xs text-muted">
        Validá tracking y atribución sin Resend real: creá un log de prueba y
        dispará eventos simulados (corren el mismo pipeline que el webhook).
      </p>
      <Card className="mb-4">
        <form action={createTestLog} className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">
              Email de prueba (opcional)
            </label>
            <input
              name="to"
              placeholder="test@tips.local"
              className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-dark outline-none focus:border-pink"
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-lg bg-pink px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            Crear log de prueba
          </button>
        </form>
      </Card>

      <Card className="p-0">
        {logs.length === 0 ? (
          <p className="p-5 text-sm text-muted">Sin logs de email todavía.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-dark">{l.recipient_email}</p>
                  <p className="truncate text-xs text-muted">
                    {l.subject}
                    {l.retry_count > 0 ? ` · ${l.retry_count} reintentos` : ""}
                    {l.error_message ? ` · ${l.error_message}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[l.status] ?? "bg-muted/15 text-muted"}`}>
                    {l.status}
                  </span>
                  {SIM_EVENTS.map((ev) => (
                    <form key={ev} action={simulateEvent}>
                      <input type="hidden" name="log_id" value={l.id} />
                      <input type="hidden" name="event" value={ev} />
                      <button
                        type="submit"
                        className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted hover:bg-background hover:text-dark"
                      >
                        {ev}
                      </button>
                    </form>
                  ))}
                  {l.status === "failed" ? (
                    <form action={retryEmailAction}>
                      <input type="hidden" name="log_id" value={l.id} />
                      <button type="submit" className="rounded bg-pink/10 px-1.5 py-0.5 text-[10px] font-semibold text-pink hover:bg-pink/20">
                        retry
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusCard({
  label,
  ok,
  okText,
  noText,
  neutral,
}: {
  label: string;
  ok: boolean;
  okText: string;
  noText: string;
  neutral?: boolean;
}) {
  const tone = ok ? "text-success" : neutral ? "text-muted" : "text-amber-700";
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${tone}`}>
        {ok ? `✓ ${okText}` : noText}
      </p>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${tone === "warn" && value > 0 ? "text-pink" : "text-dark"}`}>
        {value}
      </p>
    </Card>
  );
}
