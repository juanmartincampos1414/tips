import Link from "next/link";
import { notFound } from "next/navigation";

import { addGuestNote, addGuestTag, removeGuestTag } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  getGuestCommunications,
  getGuestProfile,
  getGuestTimeline,
} from "@/lib/queries";
import {
  CHANNEL_LABEL,
  CONVERSION_LABEL,
  engagementScore,
} from "@/lib/campaigns";
import { formatPhone } from "@/lib/phone";
import {
  computeScore,
  computeSegment,
  SEGMENT_CLS,
  SEGMENT_LABEL,
} from "@/lib/segments";

const dateFmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const dateTimeFmt = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function GuestProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getGuestProfile(id);
  if (!profile) notFound();

  const { guest, stats, lastStaffName, notes, tags } = profile;
  const segment = computeSegment(stats);
  const score = computeScore(stats);
  const engagement = engagementScore({
    recognitions: stats.recognitionEvents,
    rewardsClaimed: stats.rewardsClaimed,
    returnVisits: stats.returnVisits,
  });
  const timeline = await getGuestTimeline(id);
  const communications = await getGuestCommunications(id);

  const statCards = [
    { label: "Recognition events", value: stats.recognitionEvents },
    { label: "Reviews", value: stats.reviews },
    {
      label: "Rating promedio",
      value: stats.avgRating != null ? `★ ${stats.avgRating.toFixed(1)}` : "—",
    },
    { label: "Rewards emitidas", value: stats.rewardsIssued },
    { label: "Rewards reclamadas", value: stats.rewardsClaimed },
    { label: "Return visits", value: stats.returnVisits },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link href="/clientes" className="text-sm font-medium text-muted hover:text-dark">
        ← Volver a clientes
      </Link>

      <header className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">
            {guest.name ?? "—"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {guest.email ?? "—"} ·{" "}
            {formatPhone(guest.phone_normalized) ?? formatPhone(guest.phone) ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {guest.email ? (
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              ✉ Email
            </span>
          ) : null}
          {guest.phone_normalized ? (
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              WhatsApp
            </span>
          ) : null}
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${SEGMENT_CLS[segment]}`}>
            {SEGMENT_LABEL[segment]}
          </span>
          <span className="rounded-full bg-dark px-3 py-1 text-xs font-medium text-white">
            Score {score}
          </span>
          <span className="rounded-full bg-pink/10 px-3 py-1 text-xs font-medium text-pink">
            Engagement {engagement}
          </span>
        </div>
      </header>

      {(() => {
        const meta = (guest.metadata ?? {}) as Record<string, unknown>;
        const hasImported =
          guest.source === "import" ||
          meta.country ||
          meta.imported_visits ||
          meta.imported_segment;
        if (!hasImported) return null;
        return (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label="País" value={(meta.country as string) ?? "—"} />
            <Info
              label="Visitas históricas"
              value={meta.imported_visits != null ? String(meta.imported_visits) : "—"}
            />
            <Info
              label="Última visita (origen)"
              value={(meta.imported_last_visit as string) ?? "—"}
            />
            <Info
              label="Segmento original"
              value={(meta.imported_segment as string) ?? "—"}
            />
          </div>
        );
      })()}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs font-medium text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-dark">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Info label="Alta" value={dateFmt(guest.created_at)} />
        <Info label="Última actividad" value={dateFmt(stats.lastActivity)} />
        <Info label="Último staff" value={lastStaffName ?? "—"} />
        <Info label="Novedades" value={guest.marketing_consent ? "Sí" : "No"} />
      </div>

      {/* Communications (Sprint 7.5) */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-dark">Comunicaciones</h2>
        <Card className="p-0">
          {communications.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              Este cliente todavía no recibió campañas.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {communications.map((cm) => (
                <li key={cm.campaignId} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-dark">
                      {cm.name}{" "}
                      <span className="text-xs font-normal text-muted">
                        · {CHANNEL_LABEL[cm.channel]}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      {cm.status}
                      {cm.conversions.length > 0
                        ? " → " +
                          cm.conversions.map((c) => CONVERSION_LABEL[c]).join(", ")
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {cm.sentAt ? dateFmt(cm.sentAt) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tags + Notes */}
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-dark">Tags</h2>
            <Card>
              <div className="flex flex-wrap gap-2">
                {tags.length === 0 ? (
                  <span className="text-sm text-muted">Sin tags.</span>
                ) : (
                  tags.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 rounded-full bg-pink/10 px-2.5 py-1 text-xs font-medium text-pink"
                    >
                      {t.tag}
                      <form action={removeGuestTag}>
                        <input type="hidden" name="tag_id" value={t.id} />
                        <input type="hidden" name="guest_id" value={guest.id} />
                        <button type="submit" className="text-pink/60 hover:text-pink">
                          ×
                        </button>
                      </form>
                    </span>
                  ))
                )}
              </div>
              <form action={addGuestTag} className="mt-3 flex gap-2">
                <input type="hidden" name="guest_id" value={guest.id} />
                <input
                  name="tag"
                  placeholder="Agregar tag…"
                  required
                  className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-dark outline-none focus:border-pink"
                />
                <SubmitButton pendingLabel="…" className="h-9 px-4 text-xs">
                  Agregar
                </SubmitButton>
              </form>
            </Card>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-dark">Notas internas</h2>
            <Card>
              <form action={addGuestNote} className="flex flex-col gap-2">
                <input type="hidden" name="guest_id" value={guest.id} />
                <textarea
                  name="body"
                  rows={2}
                  required
                  placeholder="Ej: le gusta mesa ventana, fan vino tinto…"
                  className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-dark outline-none focus:border-pink"
                />
                <Button type="submit" className="h-9 self-end px-4 text-xs">
                  Guardar nota
                </Button>
              </form>
              <ul className="mt-3 flex flex-col gap-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-background px-3 py-2 text-sm text-dark">
                    {n.body}
                    <span className="ml-2 text-xs text-muted">
                      {dateTimeFmt(n.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>

        {/* Timeline */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dark">Timeline</h2>
          <Card className="p-0">
            {timeline.length === 0 ? (
              <p className="p-6 text-sm text-muted">Sin actividad todavía.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {timeline.map((item, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-dark">{item.label}</p>
                      {item.detail ? (
                        <p className="text-xs text-muted">{item.detail}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {dateTimeFmt(item.at)}
                    </span>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-dark">{value}</p>
    </Card>
  );
}
