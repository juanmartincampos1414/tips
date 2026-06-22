import Link from "next/link";

import { Card } from "@/components/ui/card";

import { CreateStaffForm } from "./create-staff-form";

export default function NewStaffPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Link
        href="/staff"
        className="text-sm font-medium text-muted hover:text-dark"
      >
        ← Volver a camareros
      </Link>

      <h1 className="mb-1 mt-4 text-2xl font-bold tracking-tight text-dark">
        Nuevo camarero
      </h1>
      <p className="mb-6 text-sm text-muted">
        Creá un perfil para que pueda ser reconocido.
      </p>

      <Card>
        <CreateStaffForm />
      </Card>
    </div>
  );
}
