import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getCrmData, getCurrentRestaurant, type CrmGuest } from "@/lib/queries";
import { SEGMENT_CLS, SEGMENT_LABEL } from "@/lib/segments";

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

const LISTS = [
  { key: "", label: "Todos" },
  { key: "vip", label: "VIP" },
  { key: "returning", label: "Recurrentes" },
  { key: "new", label: "Nuevos" },
  { key: "at_risk", label: "En riesgo" },
  { key: "lost", label: "Perdidos" },
  { key: "active_rewards", label: "Con reward activa" },
  { key: "no_return", label: "Sin return visit" },
  { key: "con_email", label: "Con email" },
  { key: "con_whatsapp", label: "Con WhatsApp" },
  { key: "imported", label: "Importados" },
  { key: "tips", label: "Por Tips" },
];

function applyFilters(guests: CrmGuest[], q: string, list: string): CrmGuest[] {
  let r = guests;
  if (q) {
    const s = q.toLowerCase();
    r = r.filter((g) =>
      [g.name, g.email, g.phone, ...g.tags].some((v) =>
        v?.toLowerCase().includes(s),
      ),
    );
  }
  switch (list) {
    case "vip":
    case "returning":
    case "new":
    case "at_risk":
    case "lost":
      return r.filter((g) => g.segment === list);
    case "active_rewards":
      return r.filter((g) => g.activeRewards > 0);
    case "no_return":
      return r.filter((g) => g.returnVisits === 0);
    case "con_email":
      return r.filter((g) => !!g.email);
    case "con_whatsapp":
      return r.filter((g) => !!g.phone);
    case "imported":
      return r.filter((g) => g.source === "import");
    case "tips":
      return r.filter((g) => g.source !== "import");
    default:
      return r;
  }
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; list?: string }>;
}) {
  const { q = "", list = "" } = await searchParams;
  const restaurant = (await getCurrentRestaurant())!;
  const { guests, kpis } = await getCrmData(restaurant.id);
  const filtered = applyFilters(guests, q, list);

  const segKpis = [
    { label: "Total", value: kpis.total },
    { label: "Nuevos", value: kpis.newCount },
    { label: "Recurrentes", value: kpis.returning },
    { label: "VIP", value: kpis.vip },
    { label: "En riesgo", value: kpis.atRisk },
    { label: "Perdidos", value: kpis.lost },
    { label: "Importados", value: kpis.imported },
    { label: "Por Tips", value: kpis.tips },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">Clientes</h1>
          <p className="mt-1 text-sm text-muted">
            Buscá, filtrá y exportá tu base de clientes.
          </p>
        </div>
        <ExportMenu />
      </header>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Rate label="Guest Capture Rate" value={pct(kpis.captureRate)} />
        <Rate label="Return Visit Rate" value={pct(kpis.returnVisitRate)} />
        <Rate label="Reward Redemption" value={pct(kpis.rewardRedemptionRate)} />
      </div>
      <div className="mb-6 grid grid-cols-4 gap-3 sm:grid-cols-8">
        {segKpis.map((k) => (
          <Card key={k.label} className="p-3">
            <p className="text-[11px] font-medium text-muted">{k.label}</p>
            <p className="mt-0.5 text-xl font-bold text-dark">{k.value}</p>
          </Card>
        ))}
      </div>

      <form className="mb-3" action="/clientes">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, email, teléfono o tag…"
          className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-dark outline-none focus:border-pink"
        />
        {list ? <input type="hidden" name="list" value={list} /> : null}
      </form>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {LISTS.map((l) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (l.key) params.set("list", l.key);
          const active = (list ?? "") === l.key;
          return (
            <Link
              key={l.key}
              href={`/clientes${params.toString() ? `?${params}` : ""}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                active
                  ? "bg-pink text-pink-foreground"
                  : "bg-card text-muted hover:bg-background"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm text-muted">Sin resultados para este filtro.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
                <th className="px-5 py-3 font-medium">Segmento</th>
                <th className="px-5 py-3 font-medium">Origen</th>
                <th className="px-5 py-3 font-medium">Visitas</th>
                <th className="px-5 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-dark">{g.name ?? "—"}</div>
                    <div className="text-xs text-muted">
                      {g.email ?? g.phone ?? "—"}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {g.email ? (
                        <span title="Email" className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                          ✉
                        </span>
                      ) : null}
                      {g.phone ? (
                        <span title="WhatsApp" className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                          WA
                        </span>
                      ) : null}
                      {!g.email && !g.phone ? (
                        <span className="text-xs text-muted">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${SEGMENT_CLS[g.segment]}`}>
                      {SEGMENT_LABEL[g.segment]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {g.source === "import" ? "Importado" : "Tips"}
                  </td>
                  <td className="px-5 py-3 text-muted">{g.returnVisits}</td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/clientes/${g.id}`}
                      className="text-xs font-semibold text-pink hover:underline"
                    >
                      Ver perfil →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-5 py-2 text-xs text-muted">
            {filtered.length} de {guests.length} clientes
          </p>
        </Card>
      )}
    </div>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-pink/30 bg-pink/5 p-4">
      <p className="text-xs font-medium text-dark">{label}</p>
      <p className="mt-1 text-2xl font-bold text-pink">{value}</p>
    </Card>
  );
}

function ExportMenu() {
  const exports = [
    { type: "guests", label: "Clientes" },
    { type: "rewards", label: "Rewards" },
    { type: "reviews", label: "Reviews" },
    { type: "return_visits", label: "Return visits" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted">Exportar CSV:</span>
      {exports.map((e) => (
        <a
          key={e.type}
          href={`/api/export/${e.type}`}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-dark hover:bg-background"
        >
          {e.label}
        </a>
      ))}
    </div>
  );
}
