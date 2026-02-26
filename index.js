const { extractDocumentXml } = require("./src/unzip");
const { parseXml } = require("./src/parser");
const { buildDocumentModel } = require("./src/model");
const { layoutDocument } = require("./src/layout");
const { renderPdf } = require("./src/renderer");

async function convertDocxToPdf(inputPath, outputPath) {
  // 1. Unzip — extract XML, relationships, and image buffers
  const { xml, images } = await extractDocumentXml(inputPath);

  // 2. Parse XML into a JS object
  const parsed = parseXml(xml);

  // 3. Build a rich document model (paragraphs, tables, images)
  const model = buildDocumentModel(parsed);

  // 4. Layout — compute x/y positions, handle multi-page, wrapping
  const layoutResult = layoutDocument(model);

  // 5. Render to PDF
  await renderPdf(layoutResult, outputPath, images);

  console.log("PDF generated successfully:", outputPath);
}

// CLI usage: node index.js [input.docx] [output.pdf]
const args = process.argv.slice(2);
const input = args[0] || "test.docx";
const output = args[1] || "output.pdf";

convertDocxToPdf(input, output).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

module.exports = { convertDocxToPdf };
