"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/login/actions";
import type { Role } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", ownerOnly: false },
  { href: "/staff", label: "Camareros", ownerOnly: false },
  { href: "/impacto", label: "Impacto", ownerOnly: false },
  { href: "/clientes", label: "Clientes", ownerOnly: false },
  { href: "/importar", label: "Importar", ownerOnly: false },
  { href: "/recompensas", label: "Recompensas", ownerOnly: false },
  { href: "/nfc", label: "NFC", ownerOnly: false },
  { href: "/emails", label: "Emails", ownerOnly: true },
  { href: "/equipo", label: "Equipo", ownerOnly: true },
  { href: "/configuracion", label: "Configuración", ownerOnly: true },
];

export function Sidebar({
  restaurantName,
  role,
}: {
  restaurantName: string;
  role: Role;
}) {
  const pathname = usePathname();
  const nav = NAV.filter((item) => !item.ownerOnly || role === "owner");

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-border bg-card px-4 py-6 md:w-60 md:border-r">
      <div className="px-2">
        <p className="text-lg font-bold text-pink">Tips</p>
        <p className="mt-0.5 truncate text-xs text-muted">{restaurantName}</p>
        <p className="mt-1 inline-block rounded-full bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
          {role}
        </p>
      </div>

      <nav className="flex gap-1 md:flex-col">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-pink/10 text-pink"
                  : "text-muted hover:bg-background hover:text-dark",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action={signOut} className="md:mt-auto">
        <button
          type="submit"
          className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-background hover:text-dark"
        >
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}
