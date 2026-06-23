import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getCurrentMembership } from "@/lib/auth";
import {
  getCurrentRestaurant,
  getMembers,
  getStaffOptions,
} from "@/lib/queries";

import { MemberForm } from "./member-form";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

export default async function EquipoPage() {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "owner") redirect("/dashboard");

  const restaurant = (await getCurrentRestaurant())!;
  const [members, staff] = await Promise.all([
    getMembers(restaurant.id),
    getStaffOptions(restaurant.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-dark">Equipo</h1>
        <p className="mt-1 text-sm text-muted">
          Cuentas con acceso a {restaurant.name} y su rol.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Rol</th>
                  <th className="px-5 py-3 font-medium">Camarero</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-5 py-3 font-medium text-dark">
                      {m.email ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-pink/10 px-2.5 py-1 text-xs font-medium text-pink">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {m.staffName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-dark">Nueva cuenta</h2>
          <Card>
            <MemberForm staff={staff} />
          </Card>
          <p className="mt-3 text-xs text-muted">
            Manager: gestión operativa, rewards y camareros. Staff: validación de
            beneficios.
          </p>
        </div>
      </div>
    </div>
  );
}
