import Image from "next/image";

import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <Image
        src="/logo.png"
        alt="Tips"
        width={260}
        height={173}
        priority
        className="mb-8 h-auto w-56"
      />

      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted">
        <span className="inline-block h-2 w-2 rounded-full bg-pink" />
        {BRAND.category}
      </div>

      <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-dark sm:text-6xl">
        De atención a{" "}
        <span className="text-pink">fidelización.</span>
      </h1>

      <p className="mt-6 max-w-md text-lg leading-8 text-muted">
        {BRAND.promise}
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <a
          href="/login"
          className="flex h-12 items-center justify-center rounded-full bg-pink px-8 text-base font-semibold text-pink-foreground transition-opacity hover:opacity-90"
        >
          Entrar al Tips Manager
        </a>
      </div>

      <p className="mt-16 text-sm font-medium text-muted">
        {BRAND.mantra.join(" ")}
      </p>
    </main>
  );
}
