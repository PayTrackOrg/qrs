// Genera un PDF "editable" (QR y texto como objetos vectoriales reales, no
// una imagen) con varios QR por hoja, en los tamaños de pliego típicos de
// litografía en Colombia. Reutiliza exactamente la misma geometría
// (qr-builder.js) que ya usan las exportaciones a SVG/PNG, así que cualquier
// ajuste de layout futuro aplica a los tres formatos por igual.

const PDF_SHEET_SIZES = {
  pliego: { key: "pliego", label: "Pliego completo (70 x 100 cm)", widthCm: 70, heightCm: 100 },
  "medio-pliego": { key: "medio-pliego", label: "1/2 pliego (50 x 70 cm)", widthCm: 50, heightCm: 70 },
  "cuarto-pliego": { key: "cuarto-pliego", label: "1/4 de pliego (35 x 50 cm)", widthCm: 35, heightCm: 50 },
};

const PDF_GRID_PRESETS = [
  { value: "2x2", cols: 2, rows: 2, label: "2 x 2 (4 por hoja)" },
  { value: "3x3", cols: 3, rows: 3, label: "3 x 3 (9 por hoja)" },
  { value: "3x4", cols: 3, rows: 4, label: "3 x 4 (12 por hoja)" },
  { value: "4x5", cols: 4, rows: 5, label: "4 x 5 (20 por hoja)" },
  { value: "4x6", cols: 4, rows: 6, label: "4 x 6 (24 por hoja)" },
  { value: "5x7", cols: 5, rows: 7, label: "5 x 7 (35 por hoja)" },
  { value: "6x8", cols: 6, rows: 8, label: "6 x 8 (48 por hoja)" },
];

const CELL_MARGIN_CM = 0.4;
const PT_PER_CM = 72 / 2.54;

function pxToPt(px, scaleCmPerPx) {
  return px * scaleCmPerPx * PT_PER_CM;
}

function registerPdfFont(doc, dataUri, vfsName, fontName) {
  const base64 = dataUri.split(",")[1];
  doc.addFileToVFS(vfsName, base64);
  doc.addFont(vfsName, fontName, "normal");
}

function drawTextsOnPdf(doc, texts, fontName, originXcm, originYcm, scale) {
  doc.setFont(fontName);
  doc.setTextColor(0, 0, 0);
  texts.forEach((t) => {
    doc.setFontSize(pxToPt(t.fontSize, scale));
    doc.text(t.content, originXcm + t.x * scale, originYcm + t.y * scale, { baseline: "alphabetic" });
  });
}

function drawQrOnPdf(doc, modules, qrX, qrY, qrSizePx, originXcm, originYcm, scale) {
  const moduleSizeCm = QrBuilder.QR_MODULE_SIZE * scale;

  doc.setFillColor(255, 255, 255);
  doc.rect(originXcm + qrX * scale, originYcm + qrY * scale, qrSizePx * scale, qrSizePx * scale, "F");

  doc.setFillColor(0, 0, 0);
  QrBuilder.qrModuleRuns(modules).forEach(({ row, colStart, colEnd }) => {
    const xPx = qrX + (QrBuilder.QR_MARGIN_MODULES + colStart) * QrBuilder.QR_MODULE_SIZE;
    const yPx = qrY + (QrBuilder.QR_MARGIN_MODULES + row) * QrBuilder.QR_MODULE_SIZE;
    const widthPx = (colEnd - colStart) * QrBuilder.QR_MODULE_SIZE;
    doc.rect(originXcm + xPx * scale, originYcm + yPx * scale, widthPx * scale, moduleSizeCm, "F");
  });
}

// El marco decorativo de esquinas (arcos bicolor) del diseño "sin fondo" no
// se replica exactamente en PDF: jsPDF no tiene una API de trazos curvos tan
// directa como SVG. Se simplifica a un marco redondeado de un solo color.
function drawSinFondoItemOnPdf(doc, geo, originXcm, originYcm, scale) {
  doc.setFillColor(255, 255, 255);
  doc.rect(originXcm, originYcm, geo.canvasWidth * scale, geo.canvasHeight * scale, "F");

  drawTextsOnPdf(doc, [geo.header], "Anton", originXcm, originYcm, scale);
  if (geo.mesaTexts) {
    drawTextsOnPdf(doc, geo.mesaTexts, "Anton", originXcm, originYcm, scale);
  }
  drawQrOnPdf(doc, geo.modules, geo.qrX, geo.qrY, geo.qrSizePx, originXcm, originYcm, scale);

  doc.setDrawColor(166, 102, 222);
  doc.setLineWidth(0.04);
  const fx = originXcm + geo.frame.left * scale;
  const fy = originYcm + geo.frame.top * scale;
  const fw = (geo.frame.right - geo.frame.left) * scale;
  const fh = (geo.frame.bottom - geo.frame.top) * scale;
  doc.roundedRect(fx, fy, fw, fh, 0.25, 0.25, "S");
}

function drawConFondoItemOnPdf(doc, geo, originXcm, originYcm, scale) {
  doc.addImage(
    window.BACKGROUND_IMAGE_DATA_URI,
    "JPEG",
    originXcm,
    originYcm,
    geo.bgWidth * scale,
    geo.bgHeight * scale,
    "bgImage",
    "FAST"
  );
  drawQrOnPdf(doc, geo.modules, geo.qrX, geo.qrY, geo.qrSizePx, originXcm, originYcm, scale);
  drawTextsOnPdf(doc, geo.texts, "BreathingRegular", originXcm, originYcm, scale);
}

async function buildStylePdf({ idDisco, nombre, mesas, style, sheet, cols, rows, onProgress, doneRef, total }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "cm", format: [sheet.widthCm, sheet.heightCm] });

  if (style === "con-fondo") {
    registerPdfFont(doc, window.FONT_DATA.breathing, "BreathingRegular.ttf", "BreathingRegular");
  } else {
    registerPdfFont(doc, window.FONT_DATA.anton, "Anton.ttf", "Anton");
  }

  const itemsPerPage = cols * rows;
  const cellW = sheet.widthCm / cols;
  const cellH = sheet.heightCm / rows;
  const totalItems = mesas + 1;

  for (let i = 0; i < totalItems; i++) {
    const isGeneral = i === 0;
    const link = isGeneral
      ? QrBuilder.buildAccessLink(QrBuilder.BASE_URL, idDisco)
      : QrBuilder.buildAccessLink(QrBuilder.BASE_URL, idDisco, i);
    const title = isGeneral ? nombre : String(i);

    const indexInPage = i % itemsPerPage;
    if (i > 0 && indexInPage === 0) {
      doc.addPage([sheet.widthCm, sheet.heightCm]);
    }
    const col = indexInPage % cols;
    const row = Math.floor(indexInPage / cols);
    const cellX = col * cellW;
    const cellY = row * cellH;

    if (style === "con-fondo") {
      const geo = await QrBuilder.qrOnBackgroundGeometry(link, title, isGeneral ? QrBuilder.generalTextLayout : QrBuilder.mesaTextLayout);
      const scale = Math.min((cellW - 2 * CELL_MARGIN_CM) / geo.bgWidth, (cellH - 2 * CELL_MARGIN_CM) / geo.bgHeight);
      const renderW = geo.bgWidth * scale;
      const renderH = geo.bgHeight * scale;
      const originX = cellX + (cellW - renderW) / 2;
      const originY = cellY + (cellH - renderH) / 2;
      drawConFondoItemOnPdf(doc, geo, originX, originY, scale);
    } else {
      const geo = await QrBuilder.plainQrGeometry(link, "PIDE TU CANCIÓN", isGeneral ? null : i);
      const scale = Math.min((cellW - 2 * CELL_MARGIN_CM) / geo.canvasWidth, (cellH - 2 * CELL_MARGIN_CM) / geo.canvasHeight);
      const renderW = geo.canvasWidth * scale;
      const renderH = geo.canvasHeight * scale;
      const originX = cellX + (cellW - renderW) / 2;
      const originY = cellY + (cellH - renderH) / 2;
      drawSinFondoItemOnPdf(doc, geo, originX, originY, scale);
    }

    doneRef.count++;
    if (onProgress) onProgress(doneRef.count, total);
  }

  return doc.output("blob");
}

async function generatePdfOutputs({ idDisco, nombre, mesas, estilo, sheetKey, gridKey, onProgress }) {
  const sheet = PDF_SHEET_SIZES[sheetKey];
  const grid = PDF_GRID_PRESETS.find((g) => g.value === gridKey);
  if (!sheet || !grid) throw new Error("Configuración de tamaño de hoja o grilla inválida.");

  const wantsConFondo = estilo === "con-fondo" || estilo === "ambos";
  const wantsSinFondo = estilo === "sin-fondo" || estilo === "ambos";
  const styles = [];
  if (wantsConFondo) styles.push("con-fondo");
  if (wantsSinFondo) styles.push("sin-fondo");

  const total = (mesas + 1) * styles.length;
  const doneRef = { count: 0 };

  const results = [];
  for (const style of styles) {
    const blob = await buildStylePdf({ idDisco, nombre, mesas, style, sheet, cols: grid.cols, rows: grid.rows, onProgress, doneRef, total });
    results.push({
      folder: style,
      fileName: `${idDisco}-${style}-${sheetKey}-${gridKey}.pdf`,
      label: style === "con-fondo" ? `PDF para imprimir (con fondo) — ${sheet.label}, ${grid.label}` : `PDF para imprimir (sin fondo) — ${sheet.label}, ${grid.label}`,
      blob,
      kind: "pdf",
    });
  }
  return results;
}

// Modo "sencillo": un PDF por QR (uno para el general y uno por mesa), cada
// uno con la página ajustada al tamaño del propio diseño — sin hoja de
// litografía ni grilla. Es el equivalente en PDF de lo que ya hacen los
// formatos SVG y PNG (un archivo por código).
const CM_PER_PX = 2.54 / 96;

async function buildSingleItemPdf(style, link, title, isGeneral) {
  const { jsPDF } = window.jspdf;

  if (style === "con-fondo") {
    const geo = await QrBuilder.qrOnBackgroundGeometry(link, title, isGeneral ? QrBuilder.generalTextLayout : QrBuilder.mesaTextLayout);
    const doc = new jsPDF({ unit: "cm", format: [geo.bgWidth * CM_PER_PX, geo.bgHeight * CM_PER_PX] });
    registerPdfFont(doc, window.FONT_DATA.breathing, "BreathingRegular.ttf", "BreathingRegular");
    drawConFondoItemOnPdf(doc, geo, 0, 0, CM_PER_PX);
    return doc.output("blob");
  }

  const geo = await QrBuilder.plainQrGeometry(link, "PIDE TU CANCIÓN", isGeneral ? null : title);
  const doc = new jsPDF({ unit: "cm", format: [geo.canvasWidth * CM_PER_PX, geo.canvasHeight * CM_PER_PX] });
  registerPdfFont(doc, window.FONT_DATA.anton, "Anton.ttf", "Anton");
  drawSinFondoItemOnPdf(doc, geo, 0, 0, CM_PER_PX);
  return doc.output("blob");
}

async function generateSimplePdfOutputs({ idDisco, nombre, mesas, estilo, onProgress }) {
  const wantsConFondo = estilo === "con-fondo" || estilo === "ambos";
  const wantsSinFondo = estilo === "sin-fondo" || estilo === "ambos";
  const total = (mesas + 1) * (estilo === "ambos" ? 2 : 1);
  let done = 0;

  const results = [];
  for (let i = 0; i <= mesas; i++) {
    const isGeneral = i === 0;
    const link = isGeneral
      ? QrBuilder.buildAccessLink(QrBuilder.BASE_URL, idDisco)
      : QrBuilder.buildAccessLink(QrBuilder.BASE_URL, idDisco, i);
    const title = isGeneral ? nombre : String(i);

    if (wantsConFondo) {
      const blob = await buildSingleItemPdf("con-fondo", link, title, isGeneral);
      results.push({
        folder: "con-fondo",
        fileName: isGeneral ? `${idDisco}-general.pdf` : `${idDisco}-mesa-${i}.pdf`,
        label: isGeneral ? "General (con fondo, PDF)" : `Mesa ${i} (con fondo, PDF)`,
        blob,
        kind: "pdf",
      });
      done++;
      if (onProgress) onProgress(done, total);
    }

    if (wantsSinFondo) {
      const blob = await buildSingleItemPdf("sin-fondo", link, title, isGeneral);
      results.push({
        folder: "sin-fondo",
        fileName: isGeneral ? `${idDisco}-general-sin-fondo.pdf` : `${idDisco}-mesa-${i}-sin-fondo.pdf`,
        label: isGeneral ? "General (sin fondo, PDF)" : `Mesa ${i} (sin fondo, PDF)`,
        blob,
        kind: "pdf",
      });
      done++;
      if (onProgress) onProgress(done, total);
    }
  }

  return results;
}

window.PdfBuilder = {
  PDF_SHEET_SIZES,
  PDF_GRID_PRESETS,
  generatePdfOutputs,
  generateSimplePdfOutputs,
};
