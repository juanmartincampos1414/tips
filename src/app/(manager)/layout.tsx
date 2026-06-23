import { redirect } from "next/navigation";

import { Sidebar } from "@/components/manager/sidebar";
import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { getCurrentRestaurant } from "@/lib/queries";

// Manager pages read per-request DB state — never prerender them statically.
export const dynamic = "force-dynamic";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/setup");

  // Staff role has no manager-UI access (limited to claim validation).
  if (!MANAGER_ROLES.includes(membership.role)) redirect("/validar");

  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/setup");

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar restaurantName={restaurant.name} role={membership.role} />
      <div className="flex-1 px-6 py-8 md:px-10">{children}</div>
    </div>
  );
}
