const fs = require("fs");
const JSZip = require("jszip");
const { XMLParser } = require("fast-xml-parser");

async function extractDocumentXml(docxPath) {
  const buffer = fs.readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buffer);

  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("document.xml not found inside DOCX");

  const xml = await docFile.async("string");
  console.log("document.xml extracted");

  // ── Relationships ──────────────────────────────────────────────────────────
  // Maps rId → { type, target }
  const relationships = {};
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (relsFile) {
    const relsXml = await relsFile.async("string");
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(relsXml);
    const rels = parsed["Relationships"]?.["Relationship"];
    const relsArray = Array.isArray(rels) ? rels : rels ? [rels] : [];
    for (const rel of relsArray) {
      relationships[rel["@_Id"]] = {
        type: rel["@_Type"],
        target: rel["@_Target"],
      };
    }
  }

  // ── Images ────────────────────────────────────────────────────────────────
  // Maps rId → Buffer (raw image bytes)
  const images = {};
  for (const [rId, rel] of Object.entries(relationships)) {
    if (rel.type.includes("image")) {
      const imgPath = "word/" + rel.target.replace(/^\//, "");
      const imgFile = zip.file(imgPath);
      if (imgFile) {
        images[rId] = await imgFile.async("nodebuffer");
      }
    }
  }

  console.log(
    `Relationships: ${Object.keys(relationships).length}, Images: ${Object.keys(images).length}`,
  );

  return { xml, relationships, images };
}

module.exports = { extractDocumentXml };
