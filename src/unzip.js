const fs = require("fs");
const JSZip = require("jszip");

async function extractDocumentXml(path) {
  const buffer = fs.readFileSync(path);
  const zip = await JSZip.loadAsync(buffer);

  const file = zip.file("word/document.xml");

  if (!file) {
    throw new Error("document.xml not found inside DOCX");
  }

  return await file.async("string");
}

module.exports = { extractDocumentXml };
