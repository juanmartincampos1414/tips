import { NextResponse, type NextRequest } from "next/server";

/**
 * Apple Wallet endpoint — placeholder (Sprint 04 Fase B, web-pass mode).
 * Native .pkpass emission plugs in here once an Apple Pass Type ID certificate
 * is available; for now it falls back to the web pass.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pass: string }> },
) {
  const { pass } = await params;
  return NextResponse.redirect(new URL(`/w/${pass}`, _req.url));
}
