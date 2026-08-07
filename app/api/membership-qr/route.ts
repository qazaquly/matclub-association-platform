import QRCode from "qrcode";

export async function GET(request: Request) {
  const url = new URL("/membership?source=qr", request.url).toString();
  const svg = await QRCode.toString(url, { type: "svg", color: { dark: "#123c34", light: "#ffffff" }, margin: 1, width: 220 });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
