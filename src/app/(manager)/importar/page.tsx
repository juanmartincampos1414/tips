import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getCurrentRestaurant, getImports } from "@/lib/queries";

import { UploadForm } from "./upload-form";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_LABEL: Record<string, string> = {
  previewed: "Preview",
  completed: "Completada",
  failed: "Falló",
};

export default async function ImportarPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const imports = await getImports(restaurant.id);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-dark">
          Importar clientes
        </h1>
        <p className="mt-1 text-sm text-muted">
          Cargá tu base existente (Maitre, OpenTable, SevenRooms, PMS, Google
          Sheets…) en CSV o Excel.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-dark">Nueva importación</h2>
          <Card>
            <UploadForm />
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-dark">Historial</h2>
          {imports.length === 0 ? (
            <Card className="py-10 text-center">
              <p className="text-sm text-muted">Todavía no hiciste importaciones.</p>
            </Card>
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-border/60">
                {imports.map((imp) => (
                  <li key={imp.id}>
                    <Link
                      href={`/importar/${imp.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-background"
                    >
                      <div>
                        <p className="text-sm font-medium text-dark">
                          {imp.filename ?? "Importación"}
                        </p>
                        <p className="text-xs text-muted">
                          {imp.total_rows} filas · {dateFmt(imp.created_at)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          imp.status === "completed"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        {STATUS_LABEL[imp.status] ?? imp.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
