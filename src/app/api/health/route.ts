import { createClient } from "@supabase/supabase-js";

// TEMP diagnostic endpoint — verifies env wiring in the deployed environment
// without leaking secrets. Remove after debugging.
export const dynamic = "force-dynamic";

function fingerprint(v: string | undefined) {
  if (!v) return { present: false };
  return {
    present: true,
    length: v.length,
    last4: v.slice(-4),
    looksJwt: v.startsWith("eyJ"),
  };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: Record<string, unknown> = {
    NEXT_PUBLIC_SUPABASE_URL: url ?? null,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: fingerprint(anon),
    SUPABASE_SERVICE_ROLE_KEY: fingerprint(service),
  };

  // Live ping with the anon key.
  try {
    const c = createClient(url ?? "", anon ?? "");
    const { error } = await c.from("restaurants").select("id").limit(1);
    result.anonPing = error ? `ERROR: ${error.message}` : "OK";
  } catch (e) {
    result.anonPing = `THROW: ${(e as Error).message}`;
  }

  // Live ping with the service role key.
  try {
    const c = createClient(url ?? "", service ?? "", {
      auth: { persistSession: false },
    });
    const { error } = await c.from("restaurants").select("id").limit(1);
    result.servicePing = error ? `ERROR: ${error.message}` : "OK";
  } catch (e) {
    result.servicePing = `THROW: ${(e as Error).message}`;
  }

  return Response.json(result);
}
