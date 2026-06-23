import { NextResponse, type NextRequest } from "next/server";

/**
 * Google Wallet endpoint — placeholder (Sprint 04 Fase B, web-pass mode).
 * Native Google Wallet JWT emission plugs in here once an Issuer account +
 * service account are available; for now it falls back to the web pass.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pass: string }> },
) {
  const { pass } = await params;
  return NextResponse.redirect(new URL(`/w/${pass}`, _req.url));
}
