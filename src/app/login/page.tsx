import { Card } from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8 text-center">
        <p className="text-lg font-bold text-pink">Tips</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-dark">
          Entrá al Tips Manager
        </h1>
        <p className="mt-2 text-sm text-muted">
          Gestioná tu equipo, NFC y reconocimiento.
        </p>
      </div>

      <Card>
        <LoginForm />
      </Card>
    </main>
  );
}
