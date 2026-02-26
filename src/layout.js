// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_WIDTH = 595; // A4 points
const PAGE_HEIGHT = 842; // A4 points
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Heading font sizes (pt)
const HEADING_SIZES = {
  heading1: 24,
  heading2: 18,
  heading3: 14,
  normal: null, // use run's own fontSize
};

// Twips → PDF points  (1 pt = 20 twips)
function twipsToPt(twips) {
  return twips / 20;
}

// Estimate text width (rough monospace approximation, good enough for layout)
function estimateTextWidth(text, fontSize) {
  // Average character width ≈ 0.5 * fontSize for proportional fonts
  return text.length * fontSize * 0.5;
}

// Wrap a single string into lines that fit within maxWidth
function wrapText(text, fontSize, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Word itself too long? Force-break it (overflow fix)
      if (estimateTextWidth(word, fontSize) > maxWidth) {
        let remaining = word;
        while (estimateTextWidth(remaining, fontSize) > maxWidth) {
          let splitAt = Math.floor(maxWidth / (fontSize * 0.5));
          lines.push(remaining.slice(0, splitAt));
          remaining = remaining.slice(splitAt);
        }
        current = remaining;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// ─── Layout a paragraph into positioned line items ────────────────────────────

function layoutParagraph(paragraph, startY, pageIndex) {
  const items = [];
  let y = startY;
  let page = pageIndex;

  const headingSize = HEADING_SIZES[paragraph.style];
  const isHeading = paragraph.style !== "normal";
  const listInfo = paragraph.listInfo;

  // List indentation
  const indent = listInfo ? 20 + listInfo.level * 15 : 0;
  const availableWidth = CONTENT_WIDTH - indent;

  // Spacing before (twips → pt)
  const spaceBefore = twipsToPt(paragraph.spacing.before);
  const spaceAfter = twipsToPt(paragraph.spacing.after);

  y -= spaceBefore;
  if (y < MARGIN_BOTTOM) {
    page++;
    y = PAGE_HEIGHT - MARGIN_TOP;
  }

  // Flatten runs into {text, fontSize, bold, italic, underline, color} segments
  // For headings, override fontSize
  let segments = paragraph.textRuns.map((run) => {
    if (run.type === "image") {
      return run; // pass through images
    }
    return {
      ...run,
      fontSize: headingSize || run.fontSize || 12,
      bold: isHeading ? true : run.bold,
    };
  });

  if (segments.length === 0) {
    // Empty paragraph — just add spacing
    y -= 14; // default line height for empty line
    if (y < MARGIN_BOTTOM) {
      page++;
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
    return { items, endY: y - spaceAfter, endPage: page };
  }

  // Process each segment (could be image or text)
  // For simplicity, we handle text segments by line-wrapping per run.
  // A full implementation would reflow across runs — this handles the common case.

  let listBulletDrawn = false;

  for (const seg of segments) {
    if (seg.type === "image") {
      // Check if image fits on current page
      if (y - seg.height < MARGIN_BOTTOM) {
        page++;
        y = PAGE_HEIGHT - MARGIN_TOP;
      }
      items.push({
        type: "image",
        rId: seg.rId,
        x: MARGIN_LEFT + indent,
        y: y - seg.height,
        width: Math.min(seg.width, availableWidth),
        height: seg.height,
        page,
      });
      y -= seg.height + 4;
      continue;
    }

    const fontSize = seg.fontSize || 12;
    const lineHeight = fontSize * 1.4;
    const text = seg.text;

    if (!text) continue;

    const lines = wrapText(text, fontSize, availableWidth);

    for (let i = 0; i < lines.length; i++) {
      if (y < MARGIN_BOTTOM) {
        page++;
        y = PAGE_HEIGHT - MARGIN_TOP;
      }

      // List bullet/number on first line of paragraph, first segment
      if (listInfo && !listBulletDrawn && i === 0) {
        const bullet = listInfo.type === "number" ? "1." : "•";
        items.push({
          type: "text",
          text: bullet,
          x: MARGIN_LEFT + indent - 15,
          y,
          fontSize,
          bold: false,
          italic: false,
          underline: false,
          color: seg.color,
          alignment: "left",
          page,
        });
        listBulletDrawn = true;
      }

      // Compute x for alignment
      let x = MARGIN_LEFT + indent;
      const lineWidth = estimateTextWidth(lines[i], fontSize);
      if (paragraph.alignment === "center") {
        x = MARGIN_LEFT + (CONTENT_WIDTH - lineWidth) / 2;
      } else if (paragraph.alignment === "right") {
        x = MARGIN_LEFT + CONTENT_WIDTH - lineWidth;
      }

      items.push({
        type: "text",
        text: lines[i],
        x,
        y,
        fontSize,
        bold: seg.bold,
        italic: seg.italic,
        underline: seg.underline,
        color: seg.color,
        alignment: paragraph.alignment,
        page,
      });

      y -= lineHeight;
    }
  }

  y -= spaceAfter;
  if (y < MARGIN_BOTTOM) {
    page++;
    y = PAGE_HEIGHT - MARGIN_TOP;
  }

  return { items, endY: y, endPage: page };
}

// ─── Layout a table ───────────────────────────────────────────────────────────

function layoutTable(table, startY, pageIndex) {
  const items = [];
  let y = startY;
  let page = pageIndex;

  const colCount = Math.max(...table.rows.map((r) => r.cells.length));
  const colWidth = CONTENT_WIDTH / colCount;
  const cellPadding = 4;
  const borderColor = "888888";

  for (const row of table.rows) {
    // First pass: figure out row height by laying out cells virtually
    let rowHeight = 0;

    const cellLayouts = row.cells.map((cell, ci) => {
      const cellItems = [];
      let cellY = 0; // relative
      for (const para of cell.paragraphs) {
        const result = layoutParagraph(para, cellY, 0);
        cellItems.push(...result.items);
        cellY = result.endY;
      }
      const cellHeight = Math.abs(cellY) + cellPadding * 2;
      rowHeight = Math.max(rowHeight, cellHeight);
      return { cellItems, ci };
    });

    rowHeight = Math.max(rowHeight, 20); // min row height

    // Page break if needed
    if (y - rowHeight < MARGIN_BOTTOM) {
      page++;
      y = PAGE_HEIGHT - MARGIN_TOP;
    }

    // Draw cells
    row.cells.forEach((cell, ci) => {
      const cellX = MARGIN_LEFT + ci * colWidth;
      const cellTopY = y;

      // Border rect (drawn as 4 lines via border items)
      items.push({
        type: "rect",
        x: cellX,
        y: cellTopY - rowHeight,
        width: colWidth,
        height: rowHeight,
        borderColor,
        page,
      });

      // Re-layout cell content with proper coordinates
      let cellContentY = cellTopY - cellPadding - 12; // start of text inside cell
      for (const para of cell.paragraphs) {
        const result = layoutParagraph(para, cellContentY, page);
        // Offset x by cell position
        for (const item of result.items) {
          items.push({
            ...item,
            x: cellX + cellPadding + (item.x - MARGIN_LEFT),
            page,
          });
        }
        cellContentY = result.endY;
      }
    });

    y -= rowHeight;
  }

  return { items, endY: y, endPage: page };
}

// ─── Main entry ──────────────────────────────────────────────────────────────

function layoutDocument(blocks) {
  const allItems = [];
  let y = PAGE_HEIGHT - MARGIN_TOP;
  let page = 0;

  for (const block of blocks) {
    if (block.type === "paragraph") {
      const result = layoutParagraph(block, y, page);
      allItems.push(...result.items);
      y = result.endY;
      page = result.endPage;
    } else if (block.type === "table") {
      const result = layoutTable(block, y, page);
      allItems.push(...result.items);
      y = result.endY;
      page = result.endPage;
    }
  }

  console.log(
    `Layout complete: ${allItems.length} items across ${page + 1} page(s)`,
  );
  return { items: allItems, pageCount: page + 1 };
}

module.exports = {
  layoutDocument,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN_LEFT,
  MARGIN_BOTTOM,
};
