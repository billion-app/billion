import QRCode from "qrcode";

export interface QrCode {
  /** Width of the code in modules, including the quiet zone. */
  size: number;
  /** Single SVG path covering every dark module. */
  path: string;
}

/**
 * Build a QR code as one SVG path.
 *
 * Runs on the server and emits plain geometry, so nothing here reaches the
 * browser bundle and the sheet needs no client JavaScript to render.
 *
 * A horizontal run of dark modules becomes a single stroked line at a half-unit
 * offset, which is what makes the path short enough to inline — a code drawn as
 * one rect per module is thousands of elements.
 */
export function buildQr(
  text: string,
  errorCorrectionLevel: "L" | "M" | "Q" | "H",
  margin = 4,
): QrCode {
  const { modules } = QRCode.create(text, { errorCorrectionLevel });
  const { size, data } = modules;

  let path = "";
  for (let y = 0; y < size; y++) {
    let run = 0;
    for (let x = 0; x <= size; x++) {
      const dark = x < size && data[y * size + x];
      if (dark) {
        run++;
        continue;
      }
      if (run > 0) {
        path += `M${x - run + margin} ${y + margin}.5h${run}`;
        run = 0;
      }
    }
  }

  return { size: size + margin * 2, path };
}
