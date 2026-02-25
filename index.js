const { extractDocumentXml } = require("./src/unzip");
const { parseXml } = require("./src/parser");
const { buildDocumentModel } = require("./src/model");
const { layoutDocument } = require("./src/layout");
const { renderPdf } = require("./src/renderer");

async function main() {
  try {
    const xml = await extractDocumentXml("test.docx");
    const parsed = parseXml(xml);
    const model = buildDocumentModel(parsed);
    const positioned = layoutDocument(model, 800);

    await renderPdf(positioned, "output.pdf");

    console.log("PDF generated successfully.");
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
