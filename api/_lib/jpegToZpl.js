import jpeg from "jpeg-js";

/**
 * Converte JPEG (etiqueta ME) em ZPL com grafico ASCII hex.
 * A Elgin L42 nao processa bem ^GFA :Z64: do Melhor Envio — sai "ok" e nao imprime.
 *
 * Alvo: bobina 100x150 mm @ 203 dpi ≈ 812 x 1218 dots.
 */

export const ELGIN_LABEL = {
  width: 812,
  height: 1218,
  dpi: 203,
};

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

/** Remove bordas brancas do JPEG do ME (evita topo vazio + rodape cortado). */
function trimWhite(rgba, width, height, threshold = 245, pad = 4) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = rgba[i + 3];
      if (a < 128) continue;
      const lum = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
      if (lum < threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return { data: rgba, width, height };
  }

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = ((minY + y) * width + (minX + x)) * 4;
      const di = (y * tw + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return { data: out, width: tw, height: th };
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

function alignWidth(w) {
  return w + ((8 - (w % 8)) % 8);
}

/**
 * @param {Buffer|Uint8Array} jpegBuffer
 * @param {{ maxWidth?: number, maxHeight?: number, threshold?: number, trim?: boolean }} [opts]
 */
export function jpegToElginZpl(jpegBuffer, opts = {}) {
  const maxWidth = opts.maxWidth || ELGIN_LABEL.width;
  const maxHeight = opts.maxHeight || ELGIN_LABEL.height;
  const threshold = opts.threshold ?? 200;
  const doTrim = opts.trim !== false;

  const decoded = jpeg.decode(Buffer.from(jpegBuffer), {
    useTArray: true,
    maxMemoryUsageInMB: 128,
  });
  let { width, height, data } = decoded;
  if (!width || !height) throw new Error("JPEG invalido para conversao ZPL.");

  if (doTrim) {
    const trimmed = trimWhite(data, width, height);
    data = trimmed.data;
    width = trimmed.width;
    height = trimmed.height;
  }

  // Encaixa 100% do conteudo no rotulo 100x150 (sem cortar)
  const scale = Math.min(maxWidth / width, maxHeight / height);
  let dw = Math.max(8, Math.floor(width * scale));
  let dh = Math.max(8, Math.floor(height * scale));
  dw = alignWidth(dw);

  let rgba = resizeNearest(data, width, height, dw, dh);

  // Centraliza em canvas do tamanho da etiqueta (evita deslocar e cortar no gap)
  const canvasW = alignWidth(maxWidth);
  const canvasH = maxHeight;
  const canvas = new Uint8ClampedArray(canvasW * canvasH * 4);
  canvas.fill(255);
  const ox = Math.max(0, Math.floor((canvasW - dw) / 2));
  const oy = Math.max(0, Math.floor((canvasH - dh) / 2));
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const si = (y * dw + x) * 4;
      const di = ((oy + y) * canvasW + (ox + x)) * 4;
      canvas[di] = rgba[si];
      canvas[di + 1] = rgba[si + 1];
      canvas[di + 2] = rgba[si + 2];
      canvas[di + 3] = rgba[si + 3];
    }
  }

  const { bytes, bytesPerRow } = rgbaToMonoBytes(canvas, canvasW, canvasH, threshold);
  const hex = toHex(bytes);
  const total = bytes.length;

  return `^XA
^CI28
^PW${canvasW}
^LL${canvasH}
^LH0,0
^LS0
^LT0
^FO0,0^GFA,${total},${total},${bytesPerRow},${hex}^FS
^XZ
`;
}

export function zplLooksLikeUnsupportedZ64(zpl) {
  return /:Z64:/i.test(String(zpl || ""));
}
