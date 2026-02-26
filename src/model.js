class TextRun {
  constructor({ text, bold, italic, underline, fontSize, color }) {
    this.text = text || "";
    this.bold = bold || false;
    this.italic = italic || false;
    this.underline = underline || false;
    this.fontSize = fontSize || 12;
    this.color = color || "000000";
  }
}

class Paragraph {
  constructor({ textRuns, alignment, style, listInfo, spacing }) {
    this.type = "paragraph";
    this.textRuns = textRuns || [];
    this.alignment = alignment || "left"; // left | center | right | justify
    this.style = style || "normal"; // normal | heading1 | heading2 | heading3
    this.listInfo = listInfo || null; // { type: "bullet"|"number", level, numId, ilvl }
    this.spacing = spacing || { before: 0, after: 200 }; // in twips
  }
}

class TableCell {
  constructor({ paragraphs, colSpan, rowSpan }) {
    this.type = "tableCell";
    this.paragraphs = paragraphs || [];
    this.colSpan = colSpan || 1;
    this.rowSpan = rowSpan || 1;
  }
}

class TableRow {
  constructor({ cells }) {
    this.type = "tableRow";
    this.cells = cells || [];
  }
}

class Table {
  constructor({ rows }) {
    this.type = "table";
    this.rows = rows || [];
  }
}

class ImageBlock {
  constructor({ rId, width, height }) {
    this.type = "image";
    this.rId = rId; // relationship ID to resolve actual image bytes
    this.width = width || 100;
    this.height = height || 100;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function getText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (node["#text"] !== undefined) return String(node["#text"]);
  return "";
}

/** Convert half-points (w:sz) to PDF points */
function halfPointsToPt(hp) {
  return hp ? hp / 2 : 12;
}

/** Convert EMUs to PDF points (1 pt = 12700 EMU) */
function emuToPt(emu) {
  return emu ? emu / 12700 : 0;
}

// ─── Run properties ─────────────────────────────────────────────────────────

function parseRunProperties(rPr) {
  if (!rPr) return {};
  return {
    bold: rPr["w:b"] !== undefined,
    italic: rPr["w:i"] !== undefined,
    underline: rPr["w:u"] !== undefined,
    fontSize: rPr["w:sz"]
      ? halfPointsToPt(Number(rPr["w:sz"]["@_w:val"] ?? rPr["w:sz"]))
      : null,
    color: rPr["w:color"]
      ? String(rPr["w:color"]["@_w:val"] ?? "000000")
      : null,
  };
}

// ─── Paragraph properties ────────────────────────────────────────────────────

const HEADING_STYLES = {
  Heading1: "heading1",
  "heading 1": "heading1",
  Heading2: "heading2",
  "heading 2": "heading2",
  Heading3: "heading3",
  "heading 3": "heading3",
};

function parseParagraphProperties(pPr) {
  if (!pPr) return {};

  const styleId = pPr["w:pStyle"]?.["@_w:val"] ?? "";
  const style = HEADING_STYLES[styleId] || "normal";

  const jc = pPr["w:jc"]?.["@_w:val"];
  const alignment =
    jc === "center"
      ? "center"
      : jc === "right"
        ? "right"
        : jc === "both"
          ? "justify"
          : "left";

  const spacingNode = pPr["w:spacing"];
  const spacing = {
    before: spacingNode?.["@_w:before"] ? Number(spacingNode["@_w:before"]) : 0,
    after: spacingNode?.["@_w:after"] ? Number(spacingNode["@_w:after"]) : 200,
  };

  // List info
  const numPr = pPr["w:numPr"];
  let listInfo = null;
  if (numPr) {
    const ilvl = Number(numPr["w:ilvl"]?.["@_w:val"] ?? 0);
    const numId = String(numPr["w:numId"]?.["@_w:val"] ?? "");
    // type will be resolved later if numbering.xml is parsed; default bullet
    listInfo = { type: "bullet", level: ilvl, numId, ilvl };
  }

  return { style, alignment, spacing, listInfo };
}

// ─── Parse a single <w:p> ────────────────────────────────────────────────────

function parseParagraphNode(p, inheritedFontSize) {
  const pPr = p["w:pPr"];
  const { style, alignment, spacing, listInfo } = parseParagraphProperties(pPr);

  const runs = toArray(p["w:r"]);
  const textRuns = [];

  for (const r of runs) {
    const rPr = parseRunProperties(r["w:rPr"]);
    const fontSize = rPr.fontSize ?? inheritedFontSize ?? 12;

    // Check for images inside the run (w:drawing)
    const drawings = toArray(r["w:drawing"]);
    for (const drawing of drawings) {
      const inline = drawing["wp:inline"] || drawing["wp:anchor"];
      if (!inline) continue;

      const extent = inline["wp:extent"];
      const width = extent ? emuToPt(Number(extent["@_cx"])) : 100;
      const height = extent ? emuToPt(Number(extent["@_cy"])) : 100;

      const blip =
        inline?.["a:graphic"]?.["a:graphicData"]?.["pic:pic"]?.[
          "pic:blipFill"
        ]?.["a:blip"];
      const rId = blip?.["@_r:embed"] ?? null;

      textRuns.push(new ImageBlock({ rId, width, height }));
    }

    // Normal text
    if (r["w:t"] !== undefined) {
      const text = getText(r["w:t"]);
      textRuns.push(
        new TextRun({
          text,
          bold: rPr.bold,
          italic: rPr.italic,
          underline: rPr.underline,
          fontSize,
          color: rPr.color ?? "000000",
        }),
      );
    }
  }

  return new Paragraph({ textRuns, alignment, style, listInfo, spacing });
}

// ─── Parse <w:tbl> ──────────────────────────────────────────────────────────

function parseTableNode(tbl, inheritedFontSize) {
  const rows = toArray(tbl["w:tr"]).map((tr) => {
    const cells = toArray(tr["w:tc"]).map((tc) => {
      const paragraphs = toArray(tc["w:p"]).map((p) =>
        parseParagraphNode(p, inheritedFontSize),
      );
      return new TableCell({ paragraphs });
    });
    return new TableRow({ cells });
  });
  return new Table({ rows });
}

// ─── Main entry ─────────────────────────────────────────────────────────────

function buildDocumentModel(parsedXml) {
  const body = parsedXml["w:document"]?.["w:body"];
  if (!body) return [];

  // Try to read default font size from document defaults
  const defaultFontSize = 12;

  const blocks = [];

  // Body can contain w:p and w:tbl mixed — iterate all known keys
  const paragraphs = toArray(body["w:p"]);
  const tables = toArray(body["w:tbl"]);

  // We need to preserve order, so we reconstruct from raw body node
  // fast-xml-parser puts repeated keys as arrays but loses interleaving order.
  // We handle this by collecting all w:p and w:tbl in a flat ordered list.
  // Since fast-xml-parser merges them, we use a trick: rebuild from "#items" if available,
  // otherwise fall back to paragraphs-first then tables.

  // Best effort ordered traversal:
  const orderedBody = body["#items"] ?? null;
  if (orderedBody) {
    for (const item of orderedBody) {
      if (item["w:p"])
        blocks.push(parseParagraphNode(item["w:p"], defaultFontSize));
      if (item["w:tbl"])
        blocks.push(parseTableNode(item["w:tbl"], defaultFontSize));
    }
  } else {
    // Fallback: paragraphs, then tables (order may differ from original doc)
    for (const p of paragraphs)
      blocks.push(parseParagraphNode(p, defaultFontSize));
    for (const tbl of tables) blocks.push(parseTableNode(tbl, defaultFontSize));
  }

  console.log(`Document model built: ${blocks.length} top-level blocks`);
  return blocks;
}

module.exports = {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageBlock,
  buildDocumentModel,
};
