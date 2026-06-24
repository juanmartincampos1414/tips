import Image from "next/image";

import { Card } from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8 text-center">
        <Image
          src="/logo.png"
          alt="Tips"
          width={200}
          height={133}
          priority
          className="mx-auto h-auto w-44"
        />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-dark">
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
