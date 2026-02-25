const { PDFDocument, StandardFonts } = require("pdf-lib");
const fs = require("fs");

async function renderPdf(positionedContent, outputPath) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const item of positionedContent) {
    page.drawText(item.text, {
      x: 50,
      y: item.y,
      size: 12,
      font,
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

module.exports = { renderPdf };
