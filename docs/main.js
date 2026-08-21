const nombreInput = document.getElementById("nombre-input");
const idDiscoInput = document.getElementById("id-disco-input");
const mesasInput = document.getElementById("mesas-input");
const form = document.getElementById("qr-form");
const generateBtn = document.getElementById("generate-btn");
const statusEl = document.getElementById("status");
const resultsSection = document.getElementById("results");
const resultsGrid = document.getElementById("results-grid");
const downloadZipBtn = document.getElementById("download-zip-btn");

let lastResults = [];
let lastIdDisco = "";

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
    const img = document.createElement("img");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(r.svg);
    img.alt = r.label;
    const caption = document.createElement("span");
    caption.textContent = r.label;
    card.appendChild(img);
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
      zip.folder(r.folder).file(r.fileName, r.svg);
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

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

async function handleSubmit(event) {
  event.preventDefault();
  clearResults();

  const nombre = nombreInput.value.trim();
  const idDiscoRaw = idDiscoInput.value.trim();
  const idDisco = idDiscoRaw || slugify(nombre);
  const mesas = parseInt(mesasInput.value, 10);
  const estilo = form.querySelector('input[name="estilo"]:checked').value;

  if (!nombre) {
    setStatus("Ingresa el nombre de la discoteca.", true);
    return;
  }
  if (!idDisco) {
    setStatus("Ingresa el ID de la discoteca (idDisco).", true);
    return;
  }
  if (!mesas || mesas < 1) {
    setStatus("Ingresa un número de mesas válido.", true);
    return;
  }

  generateBtn.disabled = true;
  setStatus("Generando códigos QR...");

  try {
    const results = await QrBuilder.generateAllQrCodes({
      idDisco,
      nombre,
      mesas,
      estilo,
      onProgress: (done, total) => setStatus(`Generando códigos QR... (${done}/${total})`),
    });

    lastResults = results;
    lastIdDisco = idDisco;
    renderResults(results);
    setStatus(`Listo: ${results.length} códigos QR generados para ${nombre}.`);
  } catch (err) {
    console.error(err);
    setStatus(`Error generando los QR: ${err.message}`, true);
  } finally {
    generateBtn.disabled = false;
  }
}

form.addEventListener("submit", handleSubmit);
downloadZipBtn.addEventListener("click", downloadZip);
