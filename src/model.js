class Paragraph {
  constructor(textRuns) {
    this.type = "paragraph";
    this.textRuns = textRuns;
  }
}

class TextRun {
  constructor(text) {
    this.text = text;
  }
}

function buildDocumentModel(parsedXml) {
  const body = parsedXml["w:document"]["w:body"]["w:p"];

  if (!body) return [];

  const paragraphs = [];

  const paragraphArray = Array.isArray(body) ? body : [body];

  for (const p of paragraphArray) {
    const runs = p["w:r"];
    if (!runs) continue;

    const runArray = Array.isArray(runs) ? runs : [runs];

    const textRuns = [];

    for (const r of runArray) {
      if (r["w:t"]) {
        const text =
          typeof r["w:t"] === "string" ? r["w:t"] : r["w:t"]["#text"];

        textRuns.push(new TextRun(text));
      }
    }

    paragraphs.push(new Paragraph(textRuns));
  }

  return paragraphs;
}

module.exports = { Paragraph, TextRun, buildDocumentModel };
