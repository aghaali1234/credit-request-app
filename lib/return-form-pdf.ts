import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReturnFormRow = {
  itemNo: string;
  caseQty: string;
  pieceQty: string;
  description: string;
  invoiceNo: string;
  reason: string;
};

export type ReturnFormData = {
  customerCode: string;
  customerName: string;
  date: string;
  rows: ReturnFormRow[];
};

const COMPANY_LINES = [
  "125 Michigan Ave",
  "Kenilworth, NJ 07033 USA",
  "Tel: 908-810-8800",
  "Fax: 908-810-8820",
  "Web: www.turkanafood.com",
];

// Fetch the public logo and convert it to a data URL for embedding in the PDF.
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch("/turkana-logo.png", { cache: "force-cache" });
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateReturnFormPdf(data: ReturnFormData): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 32;
  const contentWidth = pageWidth - marginX * 2;

  // --- Header: logo, title, company contact ---
  const logo = await loadLogoDataUrl();
  const headerTop = 30;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", marginX, headerTop, 60, 60);
    } catch {
      // Ignore logo failures and continue rendering the form.
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("TURKANA FOOD - RETURN FORM", pageWidth / 2, headerTop + 26, { align: "center" });
  // Underline for the title.
  const titleWidth = doc.getTextWidth("TURKANA FOOD - RETURN FORM");
  doc.setLineWidth(0.8);
  doc.line(pageWidth / 2 - titleWidth / 2, headerTop + 29, pageWidth / 2 + titleWidth / 2, headerTop + 29);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  let contactY = headerTop + 6;
  COMPANY_LINES.forEach((line) => {
    doc.text(line, pageWidth - marginX, contactY, { align: "right" });
    contactY += 10;
  });

  // --- Customer / Date band ---
  const bandTop = headerTop + 70;
  autoTable(doc, {
    startY: bandTop,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
    head: [["CUSTOMER #", "CUSTOMER NAME", "DATE"]],
    body: [[data.customerCode || "-", data.customerName || "-", data.date]],
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.22 },
      1: { cellWidth: contentWidth * 0.55 },
      2: { cellWidth: contentWidth * 0.23, halign: "center" },
    },
  });

  // --- Items table ---
  // Ensure a consistent minimum number of rows so the form looks like the template.
  const MIN_ROWS = 12;
  const bodyRows = data.rows.map((row) => [
    row.itemNo,
    row.caseQty,
    row.pieceQty,
    row.description,
    row.invoiceNo,
    row.reason,
    "Yes",
  ]);
  while (bodyRows.length < MIN_ROWS) {
    bodyRows.push(["", "", "", "", "", "", ""]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterBand = (doc as any).lastAutoTable?.finalY ?? bandTop + 30;

  autoTable(doc, {
    startY: afterBand + 8,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      minCellHeight: 18,
      valign: "middle",
    },
    head: [
      [
        { content: "ITEM #", rowSpan: 2 },
        { content: "QUANTITY", colSpan: 2, styles: { halign: "center" } },
        { content: "DESCRIPTION", rowSpan: 2 },
        { content: "INVOICE #", rowSpan: 2 },
        { content: "REASON", rowSpan: 2 },
        { content: "PICK-UP\nNEEDED", rowSpan: 2, styles: { halign: "center" } },
      ],
      [
        { content: "CASE", styles: { halign: "center" } },
        { content: "PIECE", styles: { halign: "center" } },
      ],
    ],
    body: bodyRows,
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 8, halign: "left" },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.12 },
      1: { cellWidth: contentWidth * 0.09, halign: "center" },
      2: { cellWidth: contentWidth * 0.09, halign: "center" },
      3: { cellWidth: contentWidth * 0.34 },
      4: { cellWidth: contentWidth * 0.14 },
      5: { cellWidth: contentWidth * 0.12 },
      6: { cellWidth: contentWidth * 0.1, halign: "center" },
    },
  });

  // --- Signature footer ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterItems = (doc as any).lastAutoTable?.finalY ?? afterBand + 60;
  const sigTop = afterItems + 12;
  const sigColWidth = contentWidth / 4;
  const sigHeaderHeight = 20;
  const sigBoxHeight = 46;

  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);

  const sigTitles = ["CUSTOMER SIGN", "SALESMAN SIGN", "DRIVER SIGN", "W.H. CONTROL"];
  sigTitles.forEach((title, index) => {
    const x = marginX + sigColWidth * index;
    // Header cell (grey).
    doc.setFillColor(230, 230, 230);
    doc.rect(x, sigTop, sigColWidth, sigHeaderHeight, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(title, x + 6, sigTop + 13);
    // Signature box.
    doc.rect(x, sigTop + sigHeaderHeight, sigColWidth, sigBoxHeight, "S");
  });

  // "DIGITALLY SIGNED" stamp inside the SALESMAN SIGN box.
  const salesmanX = marginX + sigColWidth * 1;
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(11);
  doc.setTextColor(200, 30, 30);
  doc.text("DIGITALLY SIGNED", salesmanX + sigColWidth / 2, sigTop + sigHeaderHeight + sigBoxHeight / 2 + 3, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);

  return doc.output("blob");
}

export function buildReturnFormFileName(customerCode: string, date: string): string {
  const safeCode = (customerCode || "CUSTOMER").replace(/[^A-Za-z0-9_-]/g, "");
  const safeDate = date.replace(/[^0-9]/g, "");
  return `Turkana-Return-Form-${safeCode}-${safeDate}.pdf`;
}
