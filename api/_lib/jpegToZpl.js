import jpeg from "jpeg-js";

/**
 * Converte JPEG (etiqueta ME) em ZPL ASCII hex para Elgin L42 100x150 @ 203dpi.
 *
 * - Remove margens brancas
 * - Se vier etiqueta+canhoto lado a lado, fica so a etiqueta (esquerda)
 * - Escala para caber na area util (sem centralizar — centralizar gerava topo vazio)
 */

/** Area util um pouco menor que 812x1218 para nao cortar no gap da bobina. */
export const ELGIN_LABEL = {
  width: 800,
  height: 1100,
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

function copyRect(src, sw, sx, sy, tw, th) {
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = ((sy + y) * sw + (sx + x)) * 4;
      const di = (y * tw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}

/** Remove bordas quase brancas. */
function trimWhite(rgba, width, height, threshold = 248, pad = 2) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] < 128) continue;
      const lum = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
      if (lum < threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return { data: rgba, width, height };

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  return {
    data: copyRect(rgba, width, minX, minY, tw, th),
    width: tw,
    height: th,
  };
}

/**
 * JPEG do ME as vezes vem com etiqueta + canhoto/recibo na horizontal.
 * Recorta a esquerda para ficar no aspecto ~100x150.
 */
function cropSideBySideIfNeeded(rgba, width, height) {
  const aspect = width / height;
  const targetAspect = 100 / 150; // 0.666...
  if (aspect <= 0.85) return { data: rgba, width, height };

  // Largura da etiqueta = altura * (100/150), a partir da esquerda
  let keep = Math.floor(height * targetAspect);
  keep = Math.min(width, Math.max(8, keep));
  keep = keep - (keep % 8 || 0) || keep;
  return {
    data: copyRect(rgba, width, 0, 0, keep, height),
    width: keep,
    height,
  };
}

function rgbaToMonoBytes(rgba, width, height, threshold = 190) {
  const bytesPerRow = Math.ceil(width / 8);
  const bytes = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = rgba[i + 3];
      const lum = a < 128 ? 255 : (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
      if (lum < threshold) {
        bytes[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
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

function align8(w) {
  return w + ((8 - (w % 8)) % 8);
}

/**
 * @param {Buffer|Uint8Array} jpegBuffer
 * @param {{ maxWidth?: number, maxHeight?: number, threshold?: number }} [opts]
 */
export function jpegToElginZpl(jpegBuffer, opts = {}) {
  const maxWidth = opts.maxWidth || ELGIN_LABEL.width;
  const maxHeight = opts.maxHeight || ELGIN_LABEL.height;
  const threshold = opts.threshold ?? 190;

  const decoded = jpeg.decode(Buffer.from(jpegBuffer), {
    useTArray: true,
    maxMemoryUsageInMB: 128,
  });
  let { width, height, data } = decoded;
  if (!width || !height) throw new Error("JPEG invalido para conversao ZPL.");

  ({ data, width, height } = trimWhite(data, width, height));
  ({ data, width, height } = cropSideBySideIfNeeded(data, width, height));
  ({ data, width, height } = trimWhite(data, width, height));

  // Cabe inteiro na area util, alinhado no TOPO-ESQUERDA (sem “centralizar”)
  const scale = Math.min(maxWidth / width, maxHeight / height);
  let dw = Math.max(8, Math.floor(width * scale));
  let dh = Math.max(8, Math.floor(height * scale));
  dw = align8(dw);

  const rgba = resizeNearest(data, width, height, dw, dh);
  const { bytes, bytesPerRow } = rgbaToMonoBytes(rgba, dw, dh, threshold);
  const hex = toHex(bytes);
  const total = bytes.length;

  // ^LL = altura do conteudo (nao forca 1218 com espaco vazio em cima)
  return `^XA
^CI28
^PW${dw}
^LL${dh}
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
