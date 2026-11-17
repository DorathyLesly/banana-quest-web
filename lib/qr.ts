import QRCode from "qrcode";

/** Generate a local SVG without sending authenticator secrets to a service. */
export function generateQRSvg(data: string, size = 220): string {
  const { modules } = QRCode.create(data, { errorCorrectionLevel: "M" });
  const quiet = 4;
  const extent = modules.size + quiet * 2;
  const paths: string[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) paths.push(`M${col + quiet},${row + quiet}h1v1h-1z`);
    }
  }
  const width = Number.isFinite(size) ? Math.max(64, Math.round(size)) : 220;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}" width="${width}" height="${width}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path fill="black" d="${paths.join("")}"/></svg>`;
}

export function getManualEntryInfo(secret: string, uri: string) {
  return { secret, uri };
}
