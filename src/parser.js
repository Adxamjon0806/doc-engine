const { XMLParser } = require("fast-xml-parser");

function parseXml(xmlString) {
  const parser = new XMLParser({
    ignoreAttributes: false,
  });
  console.log("XML parsed");
  return parser.parse(xmlString);
}

module.exports = { parseXml };
