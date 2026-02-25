const { XMLParser } = require("fast-xml-parser");

function parseXml(xmlString) {
  const parser = new XMLParser({
    ignoreAttributes: false,
  });

  return parser.parse(xmlString);
}

module.exports = { parseXml };
