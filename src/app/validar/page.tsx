import { signOut } from "@/app/login/actions";
import { Card } from "@/components/ui/card";
import { getCurrentMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ValidarPage() {
  const membership = await getCurrentMembership();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-6 text-center">
        <p className="text-lg font-bold text-pink">Tips</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-dark">
          Validación de beneficios
        </h1>
      </div>

      <Card className="text-center">
        <p className="text-sm text-dark">
          Escaneá con la cámara de tu teléfono el <strong>QR del beneficio</strong>{" "}
          que muestra el cliente para validarlo y reclamarlo.
        </p>
        <p className="mt-3 text-xs text-muted">
          {membership
            ? `Conectado como ${membership.role}.`
            : "Iniciá sesión para validar beneficios."}
        </p>
      </Card>

      <form action={signOut} className="mt-6 text-center">
        <button
          type="submit"
          className="text-sm font-medium text-muted hover:text-dark"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
