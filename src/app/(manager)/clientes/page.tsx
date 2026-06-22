import { Card } from "@/components/ui/card";
import {
  getCaptureStats,
  getCurrentRestaurant,
  getGuests,
} from "@/lib/queries";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default async function ClientesPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const [guests, capture] = await Promise.all([
    getGuests(restaurant.id),
    getCaptureStats(restaurant.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-dark">Clientes</h1>
        <p className="mt-1 text-sm text-muted">
          Tu base propia de clientes, capturada en el reconocimiento.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-muted">Clientes capturados</p>
          <p className="mt-2 text-3xl font-bold text-dark">
            {capture.guestsCaptured}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-muted">Recognition events</p>
          <p className="mt-2 text-3xl font-bold text-dark">
            {capture.recognitionEvents}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-muted">Guest Capture Rate</p>
          <p className="mt-2 text-3xl font-bold text-dark">
            {capture.captureRate == null
              ? "—"
              : `${Math.round(capture.captureRate * 100)}%`}
          </p>
        </Card>
      </div>

      {guests.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted">
            Todavía no capturaste clientes. Cuando un cliente complete el
            reconocimiento y deje sus datos, va a aparecer acá.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Teléfono</th>
                <th className="px-5 py-3 font-medium">Atendido por</th>
                <th className="px-5 py-3 font-medium">Novedades</th>
                <th className="px-5 py-3 font-medium">Alta</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr
                  key={guest.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-dark">
                      {guest.name ?? "—"}
                    </div>
                    <div className="text-xs text-muted">{guest.email ?? "—"}</div>
                  </td>
                  <td className="px-5 py-3 text-muted">{guest.phone ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">
                    {guest.staff?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {guest.marketing_consent ? (
                      <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                        Sí
                      </span>
                    ) : (
                      <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {dateFmt(guest.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
