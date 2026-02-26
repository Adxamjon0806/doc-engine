const { PDFDocument, rgb, LineCapStyle } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const fs = require("fs");
const path = require("path");

// ─── Font loading ─────────────────────────────────────────────────────────────

const FONT_DIR = path.join(__dirname, "../fonts");

// We need 4 variants. Provide whatever .ttf files you have in /fonts.
// Fallback: use the same file for all variants if variants aren't available.
const FONT_FILES = {
  normal: "DejaVuSans.ttf",
  bold: "DejaVuSans-Bold.ttf",
  italic: "DejaVuSans-Oblique.ttf",
  boldItalic: "DejaVuSans-BoldOblique.ttf",
};

function fontFilePath(name) {
  const full = path.join(FONT_DIR, name);
  return fs.existsSync(full) ? full : path.join(FONT_DIR, FONT_FILES.normal);
}

// ─── Color helper ─────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  if (!hex || hex === "auto") return rgb(0, 0, 0);
  const cleaned = hex.replace("#", "").padStart(6, "0");
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

// ─── Render ───────────────────────────────────────────────────────────────────

async function renderPdf(layoutResult, outputPath, images = {}) {
  const { items, pageCount } = layoutResult;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load font variants
  const fontBytesNormal = fs.readFileSync(fontFilePath(FONT_FILES.normal));
  const fontBytesBold = fs.readFileSync(fontFilePath(FONT_FILES.bold));
  const fontBytesItalic = fs.readFileSync(fontFilePath(FONT_FILES.italic));
  const fontBytesBoldItalic = fs.readFileSync(
    fontFilePath(FONT_FILES.boldItalic),
  );

  const fonts = {
    normal: await pdfDoc.embedFont(fontBytesNormal),
    bold: await pdfDoc.embedFont(fontBytesBold),
    italic: await pdfDoc.embedFont(fontBytesItalic),
    boldItalic: await pdfDoc.embedFont(fontBytesBoldItalic),
  };

  // Embed images (rId → PDFImage)
  const embeddedImages = {};
  for (const [rId, buffer] of Object.entries(images)) {
    try {
      // Detect format by magic bytes
      if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        embeddedImages[rId] = await pdfDoc.embedJpg(buffer);
      } else if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        embeddedImages[rId] = await pdfDoc.embedPng(buffer);
      }
      // Other formats (webp, bmp etc.) are skipped — extend as needed
    } catch (e) {
      console.warn(`Could not embed image ${rId}:`, e.message);
    }
  }

  // Create all pages up front
  const { PAGE_WIDTH, PAGE_HEIGHT } = require("./layout");
  const pages = [];
  for (let i = 0; i < pageCount; i++) {
    pages.push(pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
  }

  // Draw each item
  for (const item of items) {
    const page = pages[item.page] || pages[pages.length - 1];

    if (item.type === "text") {
      const font =
        item.bold && item.italic
          ? fonts.boldItalic
          : item.bold
            ? fonts.bold
            : item.italic
              ? fonts.italic
              : fonts.normal;

      const color = hexToRgb(item.color);
      const fontSize = item.fontSize || 12;

      // Sanitize text — remove non-printable chars that could crash pdf-lib
      const safeText = String(item.text).replace(
        /[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
        "",
      );
      if (!safeText) continue;

      try {
        page.drawText(safeText, {
          x: item.x,
          y: item.y,
          size: fontSize,
          font,
          color,
        });

        // Underline: draw a line just below the text baseline
        if (item.underline) {
          const textWidth = font.widthOfTextAtSize(safeText, fontSize);
          const underlineY = item.y - 2;
          page.drawLine({
            start: { x: item.x, y: underlineY },
            end: { x: item.x + textWidth, y: underlineY },
            thickness: 1,
            color,
          });
        }
      } catch (e) {
        console.warn(
          "Skipping text item due to render error:",
          e.message,
          "|",
          safeText,
        );
      }
    } else if (item.type === "image") {
      const img = embeddedImages[item.rId];
      if (img) {
        page.drawImage(img, {
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        });
      }
    } else if (item.type === "rect") {
      // Table cell border
      page.drawRectangle({
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        borderColor: hexToRgb(item.borderColor),
        borderWidth: 0.5,
        opacity: 0, // transparent fill
        borderOpacity: 1,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`PDF written to ${outputPath} (${pageCount} page(s))`);
}

module.exports = { renderPdf };
