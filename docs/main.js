const discoSearch = document.getElementById("disco-search");
const discoOptionsEl = document.getElementById("disco-options");
const discoCombobox = document.getElementById("disco-combobox");
const mesasInput = document.getElementById("mesas-input");
const form = document.getElementById("qr-form");
const generateBtn = document.getElementById("generate-btn");
const statusEl = document.getElementById("status");
const resultsSection = document.getElementById("results");
const resultsGrid = document.getElementById("results-grid");
const downloadZipBtn = document.getElementById("download-zip-btn");
const pdfOptionsEl = document.getElementById("pdf-options");
const pdfGridOptionsEl = document.getElementById("pdf-grid-options");
const pdfSheetSizeSelect = document.getElementById("pdf-sheet-size");
const pdfGridSelect = document.getElementById("pdf-grid");

const DISCOTECAS_ENDPOINT = "https://getdiscotecas-mi7qt2fccq-uc.a.run.app";

let lastResults = [];
let lastIdDisco = "";
let discotecas = [];
let selectedDisco = null;
let activeOptionIndex = -1;

function setStatus(message, isError = false) {
  statusEl.hidden = !message;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function clearResults() {
  resultsGrid.innerHTML = "";
  lastResults = [];
  resultsSection.hidden = true;
  downloadZipBtn.disabled = true;
}

function renderResults(results) {
  resultsGrid.innerHTML = "";
  results.forEach((r) => {
    const card = document.createElement("div");
    card.className = "qr-card";
    if (r.kind === "pdf") {
      const link = document.createElement("a");
      link.className = "file-icon";
      link.textContent = "PDF";
      link.href = URL.createObjectURL(r.blob);
      link.target = "_blank";
      link.rel = "noopener";
      card.appendChild(link);
    } else {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(r.blob);
      img.alt = r.label;
      card.appendChild(img);
    }
    const caption = document.createElement("span");
    caption.textContent = r.label;
    card.appendChild(caption);
    resultsGrid.appendChild(card);
  });
  resultsSection.hidden = false;
  downloadZipBtn.disabled = results.length === 0;
}

async function downloadZip() {
  if (lastResults.length === 0) return;

  downloadZipBtn.disabled = true;
  downloadZipBtn.textContent = "Empaquetando...";

  try {
    const zip = new JSZip();
    for (const r of lastResults) {
      zip.folder(r.folder).file(r.fileName, r.blob);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${lastIdDisco || "qrs"}-qrs.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error(err);
    setStatus("Ocurrió un error generando el .zip.", true);
  } finally {
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = "Descargar todo (.zip)";
  }
}

async function loadDiscotecas() {
  discoSearch.disabled = true;
  discoSearch.placeholder = "Cargando discotecas...";
  try {
    const res = await fetch(DISCOTECAS_ENDPOINT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    discotecas = (json.response || [])
      .map((d) => ({ nombre: (d.name || d.idDisco || "").trim(), idDisco: d.idDisco }))
      .filter((d) => d.idDisco)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    discoSearch.placeholder = "Busca por nombre o ID...";
  } catch (err) {
    console.error(err);
    discoSearch.placeholder = "Error al cargar discotecas";
    setStatus("No se pudo cargar la lista de discotecas. Intenta recargar la página.", true);
  } finally {
    discoSearch.disabled = false;
  }
}

function filterDiscotecas(query) {
  const q = query.trim().toLowerCase();
  if (!q) return discotecas.slice(0, 50);
  return discotecas
    .filter((d) => d.nombre.toLowerCase().includes(q) || d.idDisco.toLowerCase().includes(q))
    .slice(0, 50);
}

function renderOptions(items) {
  activeOptionIndex = -1;
  discoOptionsEl.innerHTML = "";

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Sin resultados";
    discoOptionsEl.appendChild(li);
  } else {
    items.forEach((disco) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      const nameSpan = document.createElement("span");
      nameSpan.textContent = disco.nombre;
      const idSpan = document.createElement("span");
      idSpan.className = "id-disco";
      idSpan.textContent = disco.idDisco;
      li.appendChild(nameSpan);
      li.appendChild(idSpan);
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectDisco(disco);
      });
      discoOptionsEl.appendChild(li);
    });
  }

  discoOptionsEl.hidden = false;
}

function selectDisco(disco) {
  selectedDisco = disco;
  discoSearch.value = disco.nombre;
  discoOptionsEl.hidden = true;
}

function openOptions() {
  renderOptions(filterDiscotecas(discoSearch.value));
}

discoSearch.addEventListener("input", () => {
  selectedDisco = null;
  openOptions();
});

discoSearch.addEventListener("focus", openOptions);

document.addEventListener("click", (e) => {
  if (!discoCombobox.contains(e.target)) {
    discoOptionsEl.hidden = true;
  }
});

discoSearch.addEventListener("keydown", (e) => {
  const options = Array.from(discoOptionsEl.querySelectorAll("li:not(.empty)"));
  if (discoOptionsEl.hidden || options.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeOptionIndex = Math.min(activeOptionIndex + 1, options.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeOptionIndex = Math.max(activeOptionIndex - 1, 0);
  } else if (e.key === "Enter") {
    if (activeOptionIndex >= 0) {
      e.preventDefault();
      options[activeOptionIndex].dispatchEvent(new Event("mousedown"));
    }
    return;
  } else if (e.key === "Escape") {
    discoOptionsEl.hidden = true;
    return;
  } else {
    return;
  }

  options.forEach((el, i) => el.classList.toggle("active", i === activeOptionIndex));
  options[activeOptionIndex].scrollIntoView({ block: "nearest" });
});

function populatePdfOptions() {
  pdfSheetSizeSelect.innerHTML = "";
  Object.values(PdfBuilder.PDF_SHEET_SIZES).forEach((sheet) => {
    const option = document.createElement("option");
    option.value = sheet.key;
    option.textContent = sheet.label;
    pdfSheetSizeSelect.appendChild(option);
  });

  pdfGridSelect.innerHTML = "";
  PdfBuilder.PDF_GRID_PRESETS.forEach((grid) => {
    const option = document.createElement("option");
    option.value = grid.value;
    option.textContent = grid.label;
    pdfGridSelect.appendChild(option);
  });
}

function updateFormatoVisibility() {
  const formato = form.querySelector('input[name="formato"]:checked').value;
  pdfOptionsEl.hidden = formato !== "pdf";
  updatePdfModoVisibility();
}

function updatePdfModoVisibility() {
  const pdfModo = form.querySelector('input[name="pdf-modo"]:checked').value;
  pdfGridOptionsEl.hidden = pdfModo !== "cuadricula";
}

form.querySelectorAll('input[name="formato"]').forEach((input) => {
  input.addEventListener("change", updateFormatoVisibility);
});

form.querySelectorAll('input[name="pdf-modo"]').forEach((input) => {
  input.addEventListener("change", updatePdfModoVisibility);
});

async function handleSubmit(event) {
  event.preventDefault();
  clearResults();

  const mesas = parseInt(mesasInput.value, 10);
  const estilo = form.querySelector('input[name="estilo"]:checked').value;
  const formato = form.querySelector('input[name="formato"]:checked').value;
  const pdfModo = form.querySelector('input[name="pdf-modo"]:checked').value;

  if (!selectedDisco) {
    setStatus("Selecciona una discoteca de la lista.", true);
    return;
  }
  if (!mesas || mesas < 1) {
    setStatus("Ingresa un número de mesas válido.", true);
    return;
  }

  const { nombre, idDisco } = selectedDisco;

  generateBtn.disabled = true;
  setStatus("Generando códigos QR...");

  try {
    let results;
    if (formato === "pdf" && pdfModo === "cuadricula") {
      results = await PdfBuilder.generatePdfOutputs({
        idDisco,
        nombre,
        mesas,
        estilo,
        sheetKey: pdfSheetSizeSelect.value,
        gridKey: pdfGridSelect.value,
        onProgress: (done, total) => setStatus(`Generando PDF... (${done}/${total})`),
      });
    } else if (formato === "pdf") {
      results = await PdfBuilder.generateSimplePdfOutputs({
        idDisco,
        nombre,
        mesas,
        estilo,
        onProgress: (done, total) => setStatus(`Generando PDF... (${done}/${total})`),
      });
    } else {
      results = await QrBuilder.generateAllQrCodes({
        idDisco,
        nombre,
        mesas,
        estilo,
        formato,
        onProgress: (done, total) => setStatus(`Generando códigos QR... (${done}/${total})`),
      });
    }

    lastResults = results;
    lastIdDisco = idDisco;
    renderResults(results);
    setStatus(`Listo: ${results.length} archivo(s) generados para ${nombre}.`);
  } catch (err) {
    console.error(err);
    setStatus(`Error generando los QR: ${err.message}`, true);
  } finally {
    generateBtn.disabled = false;
  }
}

form.addEventListener("submit", handleSubmit);
downloadZipBtn.addEventListener("click", downloadZip);
populatePdfOptions();
updateFormatoVisibility();
loadDiscotecas();
