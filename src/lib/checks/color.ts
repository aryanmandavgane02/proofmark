// Colour maths for the palette check (VIS-02). Pure functions, no image library needed here.
export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** sRGB to CIE Lab (D65), used to measure how different two colours look. */
export function rgbToLab([r, g, b]: RGB): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference. Under about 10 looks like the same colour at a glance. */
export function deltaE(a: RGB, b: RGB): number {
  const [l1, a1, b1] = rgbToLab(a);
  const [l2, a2, b2] = rgbToLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max === 0 ? 0 : (max - min) / max;
}

/** WCAG relative luminance and contrast ratio. */
export function contrastRatio(a: RGB, b: RGB): number {
  const lum = ([r, g, b]: RGB) => {
    const ch = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export type ColorShare = { rgb: RGB; share: number };

/** Groups pixels into colour buckets and merges similar buckets. Input: raw RGB bytes. */
export function dominantColors(pixels: Uint8Array | Buffer, channels = 3): ColorShare[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  const total = Math.floor(pixels.length / channels);
  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const k = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    k.r += r; k.g += g; k.b += b; k.n++;
    buckets.set(key, k);
  }
  const list = [...buckets.values()].map((k) => ({ rgb: [k.r / k.n, k.g / k.n, k.b / k.n] as RGB, n: k.n })).sort((a, b) => b.n - a.n);
  const merged: { rgb: RGB; n: number }[] = [];
  for (const c of list) {
    const m = merged.find((x) => deltaE(x.rgb, c.rgb) < 8);
    if (m) {
      const n = m.n + c.n;
      m.rgb = [(m.rgb[0] * m.n + c.rgb[0] * c.n) / n, (m.rgb[1] * m.n + c.rgb[1] * c.n) / n, (m.rgb[2] * m.n + c.rgb[2] * c.n) / n];
      m.n = n;
    } else merged.push({ ...c });
  }
  return merged.map((m) => ({ rgb: m.rgb.map(Math.round) as RGB, share: m.n / total })).sort((a, b) => b.share - a.share);
}
