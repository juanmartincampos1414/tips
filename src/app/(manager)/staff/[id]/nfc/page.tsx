import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getStaffById } from "@/lib/queries";

import { AssignNfcForm } from "./assign-nfc-form";

export default async function AssignNfcPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = await getStaffById(id);
  if (!staff || staff.status === "archived") notFound();

  const activeTag = staff.nfc_tags.find((t) => t.status === "active");

  return (
    <div className="mx-auto w-full max-w-md">
      <Link
        href="/staff"
        className="text-sm font-medium text-muted hover:text-dark"
      >
        ← Volver a camareros
      </Link>

      <h1 className="mb-1 mt-4 text-2xl font-bold tracking-tight text-dark">
        Asignar banda NFC
      </h1>
      <p className="mb-6 text-sm text-muted">
        Vinculá una banda a <span className="font-medium text-dark">{staff.name}</span>.
      </p>

      <Card>
        <AssignNfcForm staffId={staff.id} currentCode={activeTag?.nfc_code} />
      </Card>
    </div>
  );
}
