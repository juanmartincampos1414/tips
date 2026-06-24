import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getCurrentMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentRestaurant,
  getEmailTemplates,
  getSettings,
} from "@/lib/queries";

import { TemplateCard, TemplateCreateForm, TestSendForm } from "./emails-client";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "owner") redirect("/dashboard");

  const restaurant = (await getCurrentRestaurant())!;
  const [templates, settings] = await Promise.all([
    getEmailTemplates(restaurant.id),
    getSettings(restaurant.id),
  ]);
  const providerConfigured = !!process.env.RESEND_API_KEY;

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  const ownerEmail = user?.email ?? "";

  const senderReady = !!settings?.sender_email;
  const emailEnabled = settings?.email_enabled ?? false;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">Emails</h1>
          <p className="mt-1 text-sm text-muted">
            Infraestructura de comunicación. Creá y gestioná templates; las
            campañas llegan más adelante.
          </p>
        </div>
        <Link
          href="/emails/activacion"
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-dark hover:bg-background"
        >
          Activación & salud →
        </Link>
      </header>

      {/* Provider + config status */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatusCard
          label="Proveedor"
          value={providerConfigured ? "Resend conectado" : "No configurado"}
          ok={providerConfigured}
          hint={providerConfigured ? undefined : "Falta RESEND_API_KEY"}
        />
        <StatusCard
          label="Remitente"
          value={senderReady ? settings!.sender_email! : "Sin definir"}
          ok={senderReady}
          hint={senderReady ? undefined : "Configurá el remitente en Configuración"}
        />
        <StatusCard
          label="Envío de emails"
          value={emailEnabled ? "Habilitado" : "Deshabilitado"}
          ok={emailEnabled}
          hint={emailEnabled ? undefined : "Activalo en Configuración"}
        />
      </div>

      {!providerConfigured ? (
        <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200">
          <strong>Email provider not configured.</strong> Podés crear y previsualizar
          templates igual; el envío real queda en modo mock hasta cargar{" "}
          <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code>.
        </div>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-dark">Nuevo template</h2>
        <Card>
          <TemplateCreateForm />
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-dark">
          Templates ({templates.length})
        </h2>
        {templates.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Todavía no creaste templates.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-dark">Email de prueba</h2>
        <Card>
          <p className="mb-3 text-xs text-muted">
            Enviá un email de prueba a tu propia casilla para validar la
            configuración.
          </p>
          <TestSendForm ownerEmail={ownerEmail} />
        </Card>
      </section>
    </div>
  );
}

function StatusCard({
  label,
  value,
  ok,
  hint,
}: {
  label: string;
  value: string;
  ok: boolean;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${ok ? "text-success" : "text-dark"}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </Card>
  );
}
