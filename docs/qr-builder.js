// Puerto a SVG vectorial (editable en Illustrator) de la lógica de script.py.
// Cada QR se genera como texto SVG: los módulos del QR, el marco y los
// textos son elementos reales (rect/path/text), no una imagen rasterizada.
// Solo el fondo (Background.png) queda embebido como imagen dentro del SVG,
// igual que en cualquier archivo de diseño real.

const BASE_URL = "https://users.paytrack.com.co/";
const QR_MODULE_SIZE = 10;
const QR_MARGIN_MODULES = 2;

function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_");
}

function buildAccessLink(baseUrl, idDisco, table) {
  const payload = { idDisco, v: 1 };
  if (table !== undefined && table !== null && String(table).trim() !== "") {
    payload.table = String(table).trim();
  }
  const session = base64UrlEncode(JSON.stringify(payload));
  const url = new URL(baseUrl);
  url.searchParams.set("session", session);
  return url.toString();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function ensureFontLoaded(fontSpec) {
  try {
    await document.fonts.load(fontSpec);
    await document.fonts.ready;
  } catch (e) {
    // Si la fuente no carga, se usará la fuente de reemplazo para medir/mostrar.
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen de fondo."));
    img.src = src;
  });
}

const measureCtx = document.createElement("canvas").getContext("2d");
function measureText(text, font) {
  measureCtx.font = font;
  return measureCtx.measureText(text);
}

function getQrModules(link) {
  return QRCode.create(link, { errorCorrectionLevel: "H" }).modules;
}

function qrModulesToSvg(modules, originX, originY, fillColor = "#000000") {
  const size = modules.size;
  const totalModules = size + QR_MARGIN_MODULES * 2;
  const sizePx = totalModules * QR_MODULE_SIZE;

  let markup = `<rect x="${originX}" y="${originY}" width="${sizePx}" height="${sizePx}" fill="#ffffff"/>`;
  // Los módulos oscuros contiguos de una fila se fusionan en un solo <rect>
  // en vez de uno por módulo: miles de rects individuales son lo que hace que
  // Illustrator/Inkscape tarden en abrir o seleccionar el archivo.
  for (let row = 0; row < size; row++) {
    let col = 0;
    while (col < size) {
      if (!modules.get(row, col)) {
        col++;
        continue;
      }
      const runStart = col;
      while (col < size && modules.get(row, col)) col++;
      const runLength = col - runStart;
      const x = originX + (QR_MARGIN_MODULES + runStart) * QR_MODULE_SIZE;
      const y = originY + (QR_MARGIN_MODULES + row) * QR_MODULE_SIZE;
      const width = runLength * QR_MODULE_SIZE;
      markup += `<rect x="${x}" y="${y}" width="${width}" height="${QR_MODULE_SIZE}" fill="${fillColor}"/>`;
    }
  }
  return { markup, sizePx };
}

function cornerFramesSvg(left, top, right, bottom) {
  const cornerSize = 140;
  const lineWidth = 4;
  const radius = 20;
  const cyan = "#6fe6ff";
  const purple = "#a666de";
  let svg = "";

  const line = (x1, y1, x2, y2, color) => {
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${lineWidth}" stroke-linecap="round"/>`;
  };
  const arc = (cx, cy, r, startDeg, endDeg, color) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const x1 = (cx + r * Math.cos(toRad(startDeg))).toFixed(2);
    const y1 = (cy + r * Math.sin(toRad(startDeg))).toFixed(2);
    const x2 = (cx + r * Math.cos(toRad(endDeg))).toFixed(2);
    const y2 = (cy + r * Math.sin(toRad(endDeg))).toFixed(2);
    svg += `<path d="M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}" stroke="${color}" stroke-width="${lineWidth}" fill="none" stroke-linecap="round"/>`;
  };
  const joint = (x, y, color) => {
    svg += `<circle cx="${x}" cy="${y}" r="${Math.max(1, lineWidth / 2)}" fill="${color}"/>`;
  };

  const tlStart = left + radius, tlEnd = left + cornerSize;
  const tlSplit = tlStart + (tlEnd - tlStart) * 0.5;
  const trStart = right - cornerSize, trEnd = right - radius;
  const trSplit = trStart + (trEnd - trStart) * 0.5;
  const brStart = right - cornerSize, brEnd = right - radius;
  const brSplit = brStart + (brEnd - brStart) * 0.5;
  const blStart = left + radius, blEnd = left + cornerSize;
  const blSplit = blStart + (blEnd - blStart) * 0.5;

  // Superior izquierda
  line(left, top + cornerSize, left, top + radius, purple);
  line(tlStart, top, tlSplit, top, cyan);
  line(tlSplit, top, tlEnd, top, purple);
  arc(left + radius, top + radius, radius, 180, 225, purple);
  arc(left + radius, top + radius, radius, 225, 270, cyan);
  joint(left, top + radius, purple);
  joint(left + radius, top, cyan);
  joint(tlSplit, top, purple);

  // Superior derecha
  line(trStart, top, trSplit, top, purple);
  line(trSplit, top, trEnd, top, cyan);
  line(right, top + radius, right, top + cornerSize, cyan);
  arc(right - radius, top + radius, radius, 270, 360, cyan);
  joint(trSplit, top, cyan);
  joint(right - radius, top, cyan);
  joint(right, top + radius, cyan);

  // Inferior izquierda
  line(left, bottom - cornerSize, left, bottom - radius, purple);
  line(blStart, bottom, blSplit, bottom, purple);
  line(blSplit, bottom, blEnd, bottom, cyan);
  arc(left + radius, bottom - radius, radius, 90, 135, purple);
  arc(left + radius, bottom - radius, radius, 135, 180, cyan);
  joint(left, bottom - radius, purple);
  joint(blSplit, bottom, cyan);

  // Inferior derecha
  line(brStart, bottom, brSplit, bottom, purple);
  line(brSplit, bottom, brEnd, bottom, cyan);
  line(right, bottom - cornerSize, right, bottom - radius, cyan);
  arc(right - radius, bottom - radius, radius, 0, 90, cyan);
  joint(brSplit, bottom, cyan);
  joint(right - radius, bottom, cyan);
  joint(right, bottom - radius, cyan);

  return svg;
}

function svgDocument(width, height, fontFaceCss, bodyMarkup) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style type="text/css"><![CDATA[
${fontFaceCss}
    ]]></style>
  </defs>
${bodyMarkup}
</svg>`;
}

async function buildPlainQrSvg(link, headerText = "PIDE TU CANCIÓN") {
  const modules = getQrModules(link);
  const qrSizePx = (modules.size + QR_MARGIN_MODULES * 2) * QR_MODULE_SIZE;

  await ensureFontLoaded("60px Anton");
  const header = headerText.toUpperCase();
  const headerFont = '60px Anton, Impact, "Arial Black", sans-serif';
  const metrics = measureText(header, headerFont);
  const headerWidth = metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || 46;
  const descent = metrics.actualBoundingBoxDescent || 14;
  const headerHeight = ascent + descent;

  const framePadding = 6;
  const canvasWidth = Math.round(Math.max(qrSizePx + framePadding * 2 + 120, headerWidth + 90));
  const canvasHeight = Math.round(qrSizePx + framePadding * 2 + headerHeight + 66);

  const headerX = (canvasWidth - headerWidth) / 2;
  const headerTopY = 8;
  const headerBaselineY = headerTopY + ascent;

  const qrX = (canvasWidth - qrSizePx) / 2;
  const qrY = headerTopY + headerHeight + 16 + framePadding;

  const { markup: qrMarkup } = qrModulesToSvg(modules, qrX, qrY);
  const frameMarkup = cornerFramesSvg(
    qrX - framePadding,
    qrY - framePadding,
    qrX + qrSizePx + framePadding,
    qrY + qrSizePx + framePadding
  );

  const fontFaceCss = `@font-face { font-family: "Anton"; src: url("${window.FONT_DATA.anton}") format("truetype"); }`;
  const body = `  <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="#ffffff"/>
  <text x="${headerX}" y="${headerBaselineY}" font-family="Anton, Impact, 'Arial Black', sans-serif" font-size="60" fill="#000000">${escapeXml(header)}</text>
  ${qrMarkup}
  ${frameMarkup}`;

  return svgDocument(canvasWidth, canvasHeight, fontFaceCss, body);
}

async function buildQrOnBackgroundSvg(link, title, layoutFn) {
  const modules = getQrModules(link);
  const qrSizePx = (modules.size + QR_MARGIN_MODULES * 2) * QR_MODULE_SIZE;

  const bgImg = await loadImage(window.BACKGROUND_IMAGE_DATA_URI);
  const bgWidth = bgImg.naturalWidth;
  const bgHeight = bgImg.naturalHeight;

  await ensureFontLoaded('65px "BreathingRegular"');
  const font = '65px "BreathingRegular", cursive';

  const { qrX, qrY, textMarkup } = layoutFn(font, qrSizePx, bgWidth, bgHeight, title);

  const { markup: qrMarkup } = qrModulesToSvg(modules, qrX, qrY);

  const fontFaceCss = `@font-face { font-family: "BreathingRegular"; src: url("${window.FONT_DATA.breathing}") format("truetype"); }`;
  const body = `  <image x="0" y="0" width="${bgWidth}" height="${bgHeight}" href="${window.BACKGROUND_IMAGE_DATA_URI}"/>
  ${qrMarkup}
  ${textMarkup}`;

  return svgDocument(bgWidth, bgHeight, fontFaceCss, body);
}

// Zona segura dentro de Background.png (1080x1080) que evita el título superior,
// el logo "Pay/Track" (ocupa aprox. x 0-222, y 458-612) y la barra/íconos del
// reproductor (aprox. y 820-1046). Medida directamente sobre la imagen.
const SAFE_TOP = 250;
const SAFE_BOTTOM = 800;
const SAFE_LEFT = 260;
const SAFE_RIGHT_MARGIN = 40;

const TEXT_FONT_FAMILY = "BreathingRegular, cursive";
const TEXT_BASE_SIZE = 65;
const TEXT_MIN_SIZE = 24;

function fitFontSize(measureFn, baseSize, minSize) {
  let size = baseSize;
  let extent = measureFn(size);
  while (extent.overflow > 0 && size > minSize) {
    size -= 2;
    extent = measureFn(size);
  }
  return { size, ...extent };
}

// Mantiene el QR dentro de la franja vertical segura (evita superponerse al
// título arriba o a la barra del reproductor abajo), sin dejar de intentar
// centrarlo verticalmente en el fondo cuando cabe.
function clampQrY(qrSizePx, bgHeight) {
  let qrY = (bgHeight - qrSizePx) / 2;
  qrY = Math.min(qrY, SAFE_BOTTOM - qrSizePx);
  qrY = Math.max(qrY, SAFE_TOP);
  return qrY;
}

function generalTextLayout(font, qrSizePx, bgWidth, bgHeight, title) {
  const spacing = 30;
  const safeRight = bgWidth - SAFE_RIGHT_MARGIN;
  const availableWidth = safeRight - SAFE_LEFT;
  const maxTextWidth = Math.max(availableWidth - qrSizePx - spacing, 80);

  const { size: fontSize, metrics } = fitFontSize((size) => {
    const m = measureText(title, `${size}px ${TEXT_FONT_FAMILY}`);
    return { metrics: m, overflow: m.width - maxTextWidth };
  }, TEXT_BASE_SIZE, TEXT_MIN_SIZE);

  const textWidth = metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.77;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.23;
  const textHeight = ascent + descent;

  const totalContentWidth = qrSizePx + spacing + textWidth;
  const startX = Math.max(SAFE_LEFT + (availableWidth - totalContentWidth) / 2, SAFE_LEFT);

  const qrX = startX;
  const qrY = clampQrY(qrSizePx, bgHeight);
  const qrCenterY = qrY + qrSizePx / 2;
  const textBaselineY = qrCenterY - textHeight / 2 + ascent;
  const textX = startX + qrSizePx + spacing;

  const textMarkup = `<text x="${textX}" y="${textBaselineY}" font-family="${TEXT_FONT_FAMILY}" font-size="${fontSize}" fill="#000000">${escapeXml(title)}</text>`;
  return { qrX, qrY, textMarkup };
}

function mesaTextLayout(font, qrSizePx, bgWidth, bgHeight, title) {
  const spacing = 30;
  const mesaOffset = 10;
  const numberOffset = 60;
  const safeRight = bgWidth - SAFE_RIGHT_MARGIN;
  const availableWidth = safeRight - SAFE_LEFT;
  const maxTextWidth = Math.max(availableWidth - qrSizePx - spacing, 80);

  const { size: fontSize, metrics, extent } = fitFontSize((size) => {
    const mesaMetrics = measureText("Mesa", `${size}px ${TEXT_FONT_FAMILY}`);
    const numberMetrics = measureText(title, `${size}px ${TEXT_FONT_FAMILY}`);
    const extent = Math.max(mesaOffset + mesaMetrics.width, numberOffset + numberMetrics.width);
    return { metrics: numberMetrics, extent, overflow: extent - maxTextWidth };
  }, TEXT_BASE_SIZE, TEXT_MIN_SIZE);

  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.77;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.23;
  const textHeight = ascent + descent;

  const totalContentWidth = qrSizePx + spacing + extent;
  const startX = Math.max(SAFE_LEFT + (availableWidth - totalContentWidth) / 2, SAFE_LEFT);

  const qrX = startX;
  const qrY = clampQrY(qrSizePx, bgHeight);
  const qrCenterY = qrY + qrSizePx / 2;

  // "Mesa" queda arriba y el número abajo, superpuestos como una firma
  // manuscrita: mismo ritmo vertical relativo que el diseño original.
  const textTopY = qrCenterY - (textHeight + 130) / 2;
  const text2TopY = qrCenterY - (textHeight - 40) / 2;
  const textX = startX + qrSizePx + spacing + mesaOffset;
  const text2X = startX + qrSizePx + spacing + numberOffset;
  const textBaselineY = textTopY + ascent;
  const text2BaselineY = text2TopY + ascent;

  const textMarkup =
    `<text x="${textX}" y="${textBaselineY}" font-family="${TEXT_FONT_FAMILY}" font-size="${fontSize}" fill="#000000">Mesa</text>` +
    `<text x="${text2X}" y="${text2BaselineY}" font-family="${TEXT_FONT_FAMILY}" font-size="${fontSize}" fill="#000000">${escapeXml(title)}</text>`;
  return { qrX, qrY, textMarkup };
}

function generateQrWithLogoAndGeneralSvg(link, title) {
  return buildQrOnBackgroundSvg(link, title, generalTextLayout);
}

function generateQrWithLogoAndTextSvg(link, title) {
  return buildQrOnBackgroundSvg(link, title, mesaTextLayout);
}

async function generateAllQrCodes({ idDisco, nombre, mesas, estilo, onProgress }) {
  const results = [];
  const total = (mesas + 1) * (estilo === "ambos" ? 2 : 1);
  let done = 0;

  const wantsConFondo = estilo === "con-fondo" || estilo === "ambos";
  const wantsSinFondo = estilo === "sin-fondo" || estilo === "ambos";

  for (let i = 0; i <= mesas; i++) {
    const isGeneral = i === 0;
    const link = isGeneral
      ? buildAccessLink(BASE_URL, idDisco)
      : buildAccessLink(BASE_URL, idDisco, i);
    const title = isGeneral ? nombre : String(i);

    if (wantsConFondo) {
      const svg = isGeneral
        ? await generateQrWithLogoAndGeneralSvg(link, title)
        : await generateQrWithLogoAndTextSvg(link, title);
      results.push({
        folder: "con-fondo",
        fileName: isGeneral ? `${idDisco}-general.svg` : `${idDisco}-mesa-${i}.svg`,
        label: isGeneral ? "General (con fondo)" : `Mesa ${i} (con fondo)`,
        svg,
      });
      done++;
      if (onProgress) onProgress(done, total);
    }

    if (wantsSinFondo) {
      const svg = await buildPlainQrSvg(link);
      results.push({
        folder: "sin-fondo",
        fileName: isGeneral ? `${idDisco}-general-sin-fondo.svg` : `${idDisco}-mesa-${i}-sin-fondo.svg`,
        label: isGeneral ? "General (sin fondo)" : `Mesa ${i} (sin fondo)`,
        svg,
      });
      done++;
      if (onProgress) onProgress(done, total);
    }
  }

  return results;
}

window.QrBuilder = {
  BASE_URL,
  buildAccessLink,
  generateAllQrCodes,
};
