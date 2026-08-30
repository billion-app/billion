import QRCode from "qrcode";

import { sanitizeCampaignCode } from "../../r/campaigns";
import { isTrackedDestination } from "../../r/destinations";

export const runtime = "nodejs";

const SITE = "https://billion-news.app";

function error(message: string) {
  return new Response(message, {
    status: 400,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = sanitizeCampaignCode(searchParams.get("p") ?? "");
  const dest = searchParams.get("dest") ?? "";
  const format = searchParams.get("format") ?? "png";

  if (!code) return error("Invalid campaign code.");
  if (!isTrackedDestination(dest)) return error("Invalid destination.");
  if (format !== "png" && format !== "svg") {
    return error("Format must be png or svg.");
  }

  const trackedUrl = `${SITE}/r?dest=${dest}&p=${code}`;
  const filename = `${code}-${dest}-qr.${format}`;
  const headers = {
    "cache-control": "public, max-age=86400",
    "content-disposition": `attachment; filename="${filename}"`,
  };

  if (format === "svg") {
    const svg = await QRCode.toString(trackedUrl, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 4,
      color: { dark: "#0E1530", light: "#FFFFFF" },
    });
    return new Response(svg, {
      headers: { ...headers, "content-type": "image/svg+xml; charset=utf-8" },
    });
  }

  const png = await QRCode.toBuffer(trackedUrl, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 4,
    width: 1200,
    color: { dark: "#0E1530", light: "#FFFFFF" },
  });
  return new Response(new Uint8Array(png), {
    headers: { ...headers, "content-type": "image/png" },
  });
}
