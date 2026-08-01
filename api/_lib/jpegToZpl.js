import jpeg from "jpeg-js";

/**
 * Converte JPEG (etiqueta ME) em ZPL com grafico ASCII hex.
 * A Elgin L42 nao processa bem ^GFA :Z64: do Melhor Envio — sai "ok" e nao imprime.
 */

function resizeNearest(src, sw, sh, dw, dh) {
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}

function rgbaToMonoBytes(rgba, width, height, threshold = 200) {
  const bytesPerRow = Math.ceil(width / 8);
  const total = bytesPerRow * height;
  const bytes = new Uint8Array(total);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const a = rgba[i + 3];
      // fundo transparente = branco (nao imprime)
      const lum = a < 128 ? 255 : (r * 299 + g * 587 + b * 114) / 1000;
      const black = lum < threshold;
      if (black) {
        const byteIndex = y * bytesPerRow + (x >> 3);
        bytes[byteIndex] |= 0x80 >> (x & 7);
      }
    }
  }
  return { bytes, bytesPerRow };
}

function toHex(bytes) {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0").toUpperCase();
  }
  return hex;
}

/**
 * @param {Buffer|Uint8Array} jpegBuffer
 * @param {{ maxWidth?: number, maxHeight?: number, threshold?: number }} [opts]
 */
export function jpegToElginZpl(jpegBuffer, opts = {}) {
  const maxWidth = opts.maxWidth || 800; // ~100mm @ 203dpi
  const maxHeight = opts.maxHeight || 1200; // ~150mm @ 203dpi
  const threshold = opts.threshold ?? 200;

  const decoded = jpeg.decode(Buffer.from(jpegBuffer), {
    useTArray: true,
    maxMemoryUsageInMB: 128,
  });
  let { width, height, data } = decoded;
  if (!width || !height) throw new Error("JPEG invalido para conversao ZPL.");

  // Caber no rotulo 100x150 mantendo proporcao
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  const dw = Math.max(8, Math.floor(width * scale));
  const dh = Math.max(8, Math.floor(height * scale));
  // largura multipla de 8 para ^GFA
  const widthAligned = dw + ((8 - (dw % 8)) % 8);

  let rgba = data;
  if (dw !== width || dh !== height) {
    rgba = resizeNearest(data, width, height, dw, dh);
  }
  // pad horizontal se alinhamos
  if (widthAligned !== dw) {
    const padded = new Uint8ClampedArray(widthAligned * dh * 4);
    padded.fill(255);
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const si = (y * dw + x) * 4;
        const di = (y * widthAligned + x) * 4;
        padded[di] = rgba[si];
        padded[di + 1] = rgba[si + 1];
        padded[di + 2] = rgba[si + 2];
        padded[di + 3] = rgba[si + 3];
      }
    }
    rgba = padded;
  }

  const { bytes, bytesPerRow } = rgbaToMonoBytes(rgba, widthAligned, dh, threshold);
  const hex = toHex(bytes);
  const total = bytes.length;

  return `^XA
^CI28
^PW${widthAligned}
^LL${dh}
^LH0,0
^FO0,0^GFA,${total},${total},${bytesPerRow},${hex}^FS
^XZ
`;
}

export function zplLooksLikeUnsupportedZ64(zpl) {
  return /:Z64:/i.test(String(zpl || ""));
}
