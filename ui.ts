// UI script — runs inside the plugin iframe.
// Receives PNG bytes from the sandbox, builds a PDF with jsPDF, triggers download.

import { jsPDF } from "jspdf";

interface LayerImage {
  name: string;
  bytes: number[];
  width: number;
  height: number;
}

// A4 dimensions in mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// A4 dimensions in points (jsPDF default unit when using mm)
const MARGIN_MM = 0; // default no margin for "fill" mode

function uint8ToBase64(bytes: number[]): string {
  const uint8 = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

type FitMode = "fill" | "fit" | "stretch";

function calculateDimensions(
  imgW: number,
  imgH: number,
  pageW: number,
  pageH: number,
  margin: number,
  fitMode: FitMode
): { x: number; y: number; w: number; h: number } {
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;

  if (fitMode === "stretch") {
    return { x: margin, y: margin, w: availW, h: availH };
  }

  const imgRatio = imgW / imgH;
  const pageRatio = availW / availH;

  let w: number;
  let h: number;

  if (fitMode === "fill") {
    // Fill: cover entire page, crop overflow (maintain ratio)
    if (imgRatio > pageRatio) {
      // Image is wider — match height, overflow width
      h = availH;
      w = h * imgRatio;
    } else {
      // Image is taller — match width, overflow height
      w = availW;
      h = w / imgRatio;
    }
  } else {
    // Fit: contain within page, no crop (maintain ratio)
    if (imgRatio > pageRatio) {
      w = availW;
      h = w / imgRatio;
    } else {
      h = availH;
      w = h * imgRatio;
    }
  }

  // Center on page
  const x = margin + (availW - w) / 2;
  const y = margin + (availH - h) / 2;

  return { x, y, w, h };
}

function buildPdf(layers: LayerImage[], fitMode: FitMode, margin: number): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  layers.forEach((layer, i) => {
    if (i > 0) doc.addPage("a4", "portrait");

    const base64 = uint8ToBase64(layer.bytes);
    const dims = calculateDimensions(
      layer.width,
      layer.height,
      A4_WIDTH_MM,
      A4_HEIGHT_MM,
      margin,
      fitMode
    );

    doc.addImage(
      `data:image/png;base64,${base64}`,
      "PNG",
      dims.x,
      dims.y,
      dims.w,
      dims.h
    );
  });

  return doc;
}

// ── UI wiring ──────────────────────────────────────────────

const btnExport = document.getElementById("btn-export") as HTMLButtonElement;
const btnCancel = document.getElementById("btn-cancel") as HTMLButtonElement;
const selectFit = document.getElementById("select-fit") as HTMLSelectElement;
const selectScale = document.getElementById("select-scale") as HTMLSelectElement;
const selectMargin = document.getElementById("select-margin") as HTMLSelectElement;
const chkSelected = document.getElementById("chk-selected") as HTMLInputElement;
const progressWrap = document.getElementById("progress-wrap") as HTMLDivElement;
const progressBar = document.getElementById("progress-bar") as HTMLDivElement;
const progressText = document.getElementById("progress-text") as HTMLSpanElement;
const statusText = document.getElementById("status-text") as HTMLParagraphElement;

btnExport.addEventListener("click", () => {
  btnExport.disabled = true;
  progressWrap.style.display = "block";
  statusText.textContent = "레이어를 내보내는 중...";

  parent.postMessage(
    {
      pluginMessage: {
        type: "export",
        fitMode: selectFit.value,
        scale: Number(selectScale.value),
        selectedOnly: chkSelected.checked,
      },
    },
    "*"
  );
});

btnCancel.addEventListener("click", () => {
  parent.postMessage({ pluginMessage: { type: "cancel" } }, "*");
});

window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === "progress") {
    const pct = Math.round((msg.current / msg.total) * 100);
    progressBar.style.width = `${pct}%`;
    progressText.textContent = `${msg.current} / ${msg.total}`;
  }

  if (msg.type === "error") {
    statusText.textContent = msg.message;
    btnExport.disabled = false;
    progressWrap.style.display = "none";
  }

  if (msg.type === "layers") {
    statusText.textContent = "PDF를 생성하는 중...";

    const layers: LayerImage[] = msg.layers;
    const fitMode = selectFit.value as FitMode;
    const margin = Number(selectMargin.value);

    try {
      const doc = buildPdf(layers, fitMode, margin);
      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "figma-export.pdf";
      a.click();
      URL.revokeObjectURL(url);

      statusText.textContent = `완료! ${layers.length}페이지 PDF가 다운로드됩니다.`;
    } catch (err) {
      statusText.textContent = `PDF 생성 실패: ${err}`;
    }

    btnExport.disabled = false;
    progressWrap.style.display = "none";
  }
};
