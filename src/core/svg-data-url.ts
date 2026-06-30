export function svgToDataUrl(svgText: string) {
  const bytes = new TextEncoder().encode(svgText);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
