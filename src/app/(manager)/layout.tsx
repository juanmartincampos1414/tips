import { redirect } from "next/navigation";

import { Sidebar } from "@/components/manager/sidebar";
import { getCurrentRestaurant } from "@/lib/queries";

// Manager pages read per-request DB state — never prerender them statically.
export const dynamic = "force-dynamic";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/setup");

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar restaurantName={restaurant.name} />
      <div className="flex-1 px-6 py-8 md:px-10">{children}</div>
    </div>
  );
}
