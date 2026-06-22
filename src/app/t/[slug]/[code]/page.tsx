import Image from "next/image";
import { notFound } from "next/navigation";

import { recordVisit, resolvePublicStaff } from "@/lib/queries";

import { RecognitionForm } from "./recognition-form";

// Reached by a real NFC tap (full page load) — always render fresh and record
// the visit on open.
export const dynamic = "force-dynamic";

export default async function PublicStaffProfile({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  const resolved = await resolvePublicStaff(slug, decodeURIComponent(code));
  if (!resolved) notFound();

  const { restaurant, staff } = resolved;

  // FR-005 / AC-006: opening a profile registers a Visit.
  await recordVisit(restaurant.id, staff.id);

  const initials = staff.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      {staff.photo_url ? (
        <Image
          src={staff.photo_url}
          alt={staff.name}
          width={128}
          height={128}
          className="h-32 w-32 rounded-full object-cover shadow-sm ring-4 ring-card"
          priority
        />
      ) : (
        <span className="flex h-32 w-32 items-center justify-center rounded-full bg-pink/10 text-4xl font-bold text-pink ring-4 ring-card">
          {initials}
        </span>
      )}

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-dark">
        {staff.name}
      </h1>
      {staff.role ? (
        <p className="mt-1 text-lg font-semibold text-pink">{staff.role}</p>
      ) : null}
      <p className="mt-1 text-sm text-muted">{restaurant.name}</p>

      <RecognitionForm
        staffId={staff.id}
        restaurantId={restaurant.id}
        firstName={staff.name.split(" ")[0]}
        restaurantName={restaurant.name}
      />

      <p className="mt-8 text-xs font-medium text-muted">Tips</p>
    </main>
  );
}
