"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/staff", label: "Camareros" },
  { href: "/clientes", label: "Clientes" },
  { href: "/recompensas", label: "Recompensas" },
];

export function Sidebar({ restaurantName }: { restaurantName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-border bg-card px-4 py-6 md:w-60 md:border-r">
      <div className="px-2">
        <p className="text-lg font-bold text-pink">Tips</p>
        <p className="mt-0.5 truncate text-xs text-muted">{restaurantName}</p>
      </div>

      <nav className="flex gap-1 md:flex-col">
        {NAV.map((item) => {
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
