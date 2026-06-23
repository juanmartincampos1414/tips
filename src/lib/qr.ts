import "server-only";

import QRCode from "qrcode";

/** Render a QR code as an inline SVG string (brand-colored). */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    width: 220,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
}
