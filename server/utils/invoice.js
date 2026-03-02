const { jsPDF } = require("jspdf");

function generateInvoice(invoiceData) {
    const summary = {};
    invoiceData.rows.forEach(trip => {
      const key = trip.description;
      if (!summary[key]) {

        summary[key] = {
          description: trip.description,
          qty: trip.qty,
          rate: trip.rate
        };

      }else {
        summary[key].qty += Number(trip.qty) || 0;
      }
    });
  const doc = new jsPDF();

  const blue = [41, 76, 121];

  const logo = "data:image/png;base64,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";

  // ======================
  // HEADER
  // ======================

  doc.addImage(logo, "PNG", 14, 10, 60, 25);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...blue);

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text("TAX INVOICE", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  doc.text("1688 Sundut street", 140, 20);
  doc.text("Witsand, Atlantis", 140, 25);
  doc.text("Cape Town, WC", 140, 30);
  doc.text("7349", 140, 35);
  doc.text("Tel: +27 72 196 8752", 140, 40);
  doc.text("Email: kostilet@gmail.com", 140, 45);

  doc.setTextColor(...blue);
  doc.text("Reg no: 2015/219746/07", 14, 40);

  // ======================
  // CLIENT HEADER
  // ======================

    doc.setFillColor(...blue);

    // CLIENT header (left)
    doc.rect(14, 55, 90, 8, "F");

    // INVOICE NO header
    doc.rect(110, 55, 40, 8, "F");

    // DATE header
    doc.rect(155, 55, 40, 8, "F");

    // CUSTOMER ID header
    doc.rect(110, 70, 40, 8, "F");

    // TERMS header
    doc.rect(155, 70, 40, 8, "F");

    // Header labels (WHITE text on BLUE)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);

    doc.text("CLIENT", 16, 61);
    doc.text("INVOICE NO.", 112, 61);
    doc.text("DATE", 157, 61);

    doc.text("CUSTOMER ID", 112, 76);
    doc.text("TERMS", 157, 76);

  // ======================
  // CLIENT DETAILS
  // ======================

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    // Left side CLIENT details
    if (invoiceData.client === "Atlantis Foundaries") {
      doc.text("ATT: Charlene Adams", 14, 70);
      doc.text("ATLANTIS FOUNDRIES PTY LTD", 14, 75);
      doc.text("William Gourlay Street", 14, 80);
      doc.text("Atlantis Industria, Atlantis", 14, 85);
      doc.text("7349", 14, 90);
      doc.text("Vat No. 4950102162", 14, 95);
    } else if (invoiceData.client === "CSV") {
      doc.text("ATT: Errol Sedras", 14, 70);
      doc.text("CSV Construction (PTY) LTD", 14, 75);
      doc.text("487 Old Main Road", 14, 80);
      doc.text("Firgrove, Somerset West", 14, 85);
      doc.text("7130", 14, 90);
    }

    // Right side INVOICE details
    doc.text(`INV-${invoiceData.invoiceNo || ""}`, 112, 66);
    doc.text(new Date().toLocaleDateString(), 157, 66);

    if (invoiceData.client === "Atlantis Foundaries") {
      doc.text("AF005", 112, 81);
    } else if (invoiceData.client === "CSV") {
      doc.text("-", 112, 81);
    }
    doc.text("On Receipt", 157, 81);

  // ======================
  // SECTION TITLE
  // ======================

    doc.setFont("helvetica", "bold");

    if (invoiceData.client === "Atlantis Foundaries") {
    doc.text(
      "EMPLOYEE TRANSPORT - WITSAND ROUTE",
      195,
      95,
      { align: "right" }
    );
  }else if (invoiceData.client === "CSV") {
    doc.text(
      "EMPLOYEE TRANSPORT - WITSAND/ATLANTIS ROUTE",
      195,
      95,
      { align: "right" }
    );
  }

  // ======================
  // TABLE HEADER
  // ======================

  let y = 105;

  doc.setFillColor(...blue);
  doc.rect(14, y, 181, 8, "F");

  doc.setTextColor(255, 255, 255);

  doc.text("DESCRIPTION", 16, y + 6);
  doc.text("RATE", 100, y + 6);
  doc.text("QTY", 130, y + 6);
  doc.text("AMOUNT", 160, y + 6);

  y += 15;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

    // ======================
    // TABLE LAYOUT (MATCH HEADER EXACTLY)
    // ======================

    const tableLeft = 14;
    const tableRight = 195;

    const col1 = tableLeft;     // DESCRIPTION
    const col2 = 95;            // RATE
    const col3 = 125;           // QTY
    const col4 = 155;           // AMOUNT
    const colEnd = tableRight;

    const rowHeight = 10;

    let subTotal = 0;

    // Draw vertical column lines (FULL HEIGHT)
    const tableTop = y - 8;
    const tableBottom = tableTop + (Object.values(invoiceData.rows).length * rowHeight);

    doc.setDrawColor(180,180,180);

    doc.line(col1, tableTop, col1, tableBottom);
    doc.line(col2, tableTop, col2, tableBottom);
    doc.line(col3, tableTop, col3, tableBottom);
    doc.line(col4, tableTop, col4, tableBottom);
    doc.line(colEnd, tableTop, colEnd, tableBottom);

    // Draw rows
    Object.values(summary).forEach((row, index) => {
      const total = row.qty * Number(row.rate).toFixed(2);
      const label = String(row.description || "");
      const rate = Number(row.rate) || 0;
      const qty = Number(row.qty) || 0;

      const rowY = y + (index * rowHeight);

      // Text
      doc.setTextColor(0,0,0);

      doc.text(label, col1 + 2, rowY);
      doc.text(`R ${rate.toFixed(2)}`, col2 + 2, rowY);
      doc.text(`${qty}`, col3 + 2, rowY);
      doc.text(`R ${total.toFixed(2)}`, col4 + 2, rowY);

      // Horizontal line
      doc.line(col1, rowY + 4, colEnd, rowY + 4);

      subTotal += total;

    });

    y += Object.values(summary).length * rowHeight;


      // ======================
    // BLUE SEPARATOR BAR
    // ======================

    const separatorY = y + 5;

    doc.setFillColor(...blue);
    doc.rect(14, separatorY, 181, 6, "F");


    // ======================
    // REMARKS (LEFT SIDE)
    // ======================

    const remarksY = separatorY + 12;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0,0,0);

    doc.text("Remarks / Instructions:", 14, remarksY);

    doc.setTextColor(0,102,204);

    doc.text("Bank Name : Nedbank", 14, remarksY + 8);

    doc.text("Account Number : 1144969719", 14, remarksY + 16);


    // ======================
    // TOTALS BOX (RIGHT SIDE, PERFECT ALIGNMENT)
    // ======================

    const pageRight = 195;   // same right edge used everywhere
    const labelW1 = 50;
    const currencyW1 = 12;
    const valueW1= 33;
    const boxWidth = labelW1 + currencyW1 + valueW1;

    const boxX = pageRight - boxWidth;
    const boxY = remarksY - 6;

    const labelW = 50;
    const currencyW = 12;
    const valueW = 33;

    const rowH = 9;

    const rows = [
      { label: "SUBTOTAL", value: subTotal.toFixed(2) },
      { label: "VAT (15%)", value: "-" },
      { label: "TAX", value: "-" },
      { label: "TOTAL", value: subTotal.toFixed(2) }
    ];

    const boxW = labelW + currencyW + valueW;
    const boxH = rows.length * rowH;


    // blue background
    doc.setFillColor(...blue);
    doc.rect(boxX, boxY, boxW, boxH, "F");


    // white grid lines
    doc.setDrawColor(255,255,255);
    doc.setLineWidth(0.5);

    // outer border
    doc.rect(boxX, boxY, boxW, boxH);


    // vertical lines
    doc.line(boxX + labelW, boxY, boxX + labelW, boxY + boxH);

    doc.line(
      boxX + labelW + currencyW,
      boxY,
      boxX + labelW + currencyW,
      boxY + boxH
    );


    // horizontal lines
    rows.forEach((_, i) => {

      if (i > 0)
        doc.line(
          boxX,
          boxY + (i * rowH),
          boxX + boxW,
          boxY + (i * rowH)
        );

    });


    // text
    doc.setTextColor(255,255,255);

    rows.forEach((row, i) => {

      const rowY = boxY + (i * rowH) + 6;

      doc.setFont(
        "helvetica",
        row.label === "TOTAL" ? "bold" : "bold"
      );

      doc.text(row.label, boxX + 3, rowY);

      doc.text("R", boxX + labelW + 3, rowY);

      doc.text(
        row.value,
        boxX + boxW - 3,
        rowY,
        { align: "right" }
      );

    });

    // ======================
    // BOTTOM BLUE LINE
    // ======================

    doc.setDrawColor(...blue);
    doc.setLineWidth(1);
    doc.line(14, boxY + 50, 195, boxY + 50);


  // SAVE
  return Buffer.from(doc.output("arraybuffer"));

}

module.exports = { generateInvoice };
  