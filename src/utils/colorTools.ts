export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface PaletteChange {
  from: Color;
  to: Color;
}

export function colorToKey(c: Color): string {
  return `${c.r},${c.g},${c.b},${c.a}`;
}

export function colorToHex(c: Color): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

export function hexToColor(hex: string, alpha = 255): Color {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);

  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b, a: alpha };
  }

  if (h.length >= 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b, a: alpha };
  }

  return { r: 0, g: 0, b: 0, a: alpha };
}

function quantizeColor(r: number, g: number, b: number, a: number): string {
  const qr = (r >> 4) & 0x0f;
  const qg = (g >> 4) & 0x0f;
  const qb = (b >> 4) & 0x0f;
  const qa = (a >> 4) & 0x0f;
  return `${qr},${qg},${qb},${qa}`;
}

function dequantizeColor(key: string): Color {
  const [qr, qg, qb, qa] = key.split(",").map((v) => parseInt(v, 10));
  const expand = (v: number) => (v << 4) | (v & 0x0f);
  return {
    r: expand(qr),
    g: expand(qg),
    b: expand(qb),
    a: expand(qa),
  };
}

export function extractDominantColors(
  imageData: ImageData,
  maxColors = 16,
  sampleStep = 4
): Color[] {
  const { data, width, height } = imageData;
  const counts: Record<string, number> = {};

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a === 0) continue;

      const key = quantizeColor(r, g, b, a);
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topKeys = entries.slice(0, maxColors).map(([key]) => key);
  return topKeys.map((key) => dequantizeColor(key));
}

export function colorDistanceSq(c1: Color, c2: Color): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  const da = c1.a - c2.a;
  return dr * dr + dg * dg + db * db + da * da;
}

export function applyColorMappingsToImageData(
  baseImageData: ImageData,
  changes: PaletteChange[],
  useTolerance = false,
  toleranceSq = 20 * 20
): ImageData {
  const out = new ImageData(
    new Uint8ClampedArray(baseImageData.data),
    baseImageData.width,
    baseImageData.height
  );

  const { data } = out;
  const fromKeys = changes.map((c) => colorToKey(c.from));

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    const pixelColor: Color = { r, g, b, a };
    let replacement: Color | null = null;

    if (useTolerance) {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let j = 0; j < changes.length; j++) {
        const dist = colorDistanceSq(pixelColor, changes[j].from);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }
      if (bestIdx >= 0 && bestDist <= toleranceSq) {
        replacement = changes[bestIdx].to;
      }
    } else {
      const key = colorToKey(pixelColor);
      const idx = fromKeys.indexOf(key);
      if (idx !== -1) {
        replacement = changes[idx].to;
      }
    }

    if (replacement) {
      data[i] = replacement.r;
      data[i + 1] = replacement.g;
      data[i + 2] = replacement.b;
      data[i + 3] = replacement.a;
    }
  }

  return out;
}