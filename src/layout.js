function layoutDocument(paragraphs, pageHeight) {
  let y = pageHeight - 50;
  const positioned = [];

  for (const paragraph of paragraphs) {
    positioned.push({
      y,
      text: paragraph.textRuns.map((r) => r.text).join(""),
    });

    y -= 20;
  }
  console.log("Layout generated and positioned");
  return positioned;
}

module.exports = { layoutDocument };
