const { PDFDocument } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const fs = require("fs");
const path = require("path");

async function renderPdf(positionedContent, outputPath) {
  const pdfDoc = await PDFDocument.create();

  pdfDoc.registerFontkit(fontkit);

  const fontPath = path.join(__dirname, "../fonts/DejaVuSans.ttf");
  const fontBytes = fs.readFileSync(fontPath);

  const customFont = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage();

  for (const item of positionedContent) {
    page.drawText(item.text, {
      x: 50,
      y: item.y,
      size: 12,
      font: customFont,
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

module.exports = { renderPdf };
