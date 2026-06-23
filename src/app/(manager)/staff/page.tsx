import Image from "next/image";
import Link from "next/link";

import { archiveStaff } from "@/app/actions";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  getCurrentRestaurant,
  getStaffMetrics,
  getStaffWithBand,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

const money = (n: number) => "$" + n.toLocaleString("es-AR");

export default async function StaffPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const staff = await getStaffWithBand(restaurant.id);
  const metrics = await getStaffMetrics(staff.map((s) => s.id));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">
            Camareros
          </h1>
          <p className="mt-1 text-sm text-muted">
            Tu equipo reconocible. Cada banda NFC pertenece a una persona.
          </p>
        </div>
        <Link href="/staff/new" className={buttonClass()}>
          Agregar camarero
        </Link>
      </header>

      {staff.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted">
            Todavía no agregaste a nadie a tu equipo.
          </p>
          <Link href="/staff/new" className={buttonClass()}>
            Agregar el primero
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Camarero</th>
                <th className="px-5 py-3 font-medium">Cargo</th>
                <th className="px-5 py-3 font-medium">Rating</th>
                <th className="px-5 py-3 font-medium">Propinas</th>
                <th className="px-5 py-3 font-medium">Reconoc.</th>
                <th className="px-5 py-3 font-medium">NFC</th>
                <th className="px-5 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => {
                const band = member.band;
                return (
                  <tr
                    key={member.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={member.photo_url} name={member.name} />
                        <span className="font-medium text-dark">
                          {member.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {member.role ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {metrics[member.id]?.averageRating != null ? (
                        <span className="font-medium text-dark">
                          ★ {metrics[member.id].averageRating!.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-dark">
                      {money(metrics[member.id]?.totalTips ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {metrics[member.id]?.recognitionEvents ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      {band ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          {band.uid}
                        </span>
                      ) : (
                        <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                          Sin asignar
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {band ? (
                          <a
                            href={`/t/${restaurant.slug}/${encodeURIComponent(band.uid)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:bg-background hover:text-dark"
                          >
                            Perfil público ↗
                          </a>
                        ) : null}
                        <Link
                          href={`/staff/${member.id}`}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-pink hover:bg-pink/5"
                        >
                          Ver perfil
                        </Link>
                        <form action={archiveStaff}>
                          <input type="hidden" name="id" value={member.id} />
                          <SubmitButton
                            pendingLabel="…"
                            className="h-auto bg-transparent px-3 py-1.5 text-xs font-semibold text-muted hover:bg-background hover:text-dark"
                          >
                            Archivar
                          </SubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-pink/10 text-xs font-semibold text-pink",
      )}
    >
      {initials}
    </span>
  );
}
