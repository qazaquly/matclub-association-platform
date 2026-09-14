import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ReportData } from "@/db/reports";

pdfMake.addVirtualFileSystem(pdfFonts);

const encoder = new TextEncoder();

function xml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

function columnName(index: number) {
  let result = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  return result;
}

function uint16(value: number) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function uint32(value: number) {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function concat(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
  return current >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Array<{ name: string; content: string }>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    const local = concat([uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0), uint32(crc), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0), name, data]);
    const central = concat([uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0), uint32(crc), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), name]);
    localParts.push(local); centralParts.push(central); offset += local.length;
  }
  const central = concat(centralParts);
  return concat([...localParts, central, uint32(0x06054b50), uint16(0), uint16(0), uint16(entries.length), uint16(entries.length), uint32(central.length), uint32(offset), uint16(0)]);
}

export function reportXlsx(report: ReportData) {
  const widths = report.columns.map((column) => {
    const longest = Math.max(column.label.length, ...report.rows.slice(0, 250).map((row) => String(row[column.key] ?? "").length));
    return Math.min(42, Math.max(10, longest + 2));
  });
  const cell = (value: string | number, reference: string, style = 0, numeric = false) => numeric && typeof value === "number"
    ? `<c r="${reference}" s="${style}"><v>${value}</v></c>`
    : `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const heading = report.columns.map((column, index) => cell(column.label, `${columnName(index)}4`, 2)).join("");
  const rows = report.rows.map((row, rowIndex) => `<row r="${rowIndex + 5}">${report.columns.map((column, columnIndex) => cell(row[column.key] ?? "", `${columnName(columnIndex)}${rowIndex + 5}`, 1, column.numeric)).join("")}</row>`).join("");
  const lastColumn = columnName(report.columns.length - 1);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData><row r="1" ht="28" customHeight="1">${cell(report.title, "A1", 3)}</row><row r="2">${cell(`Кезең: ${report.periodLabel}`, "A2", 1)}</row><row r="4" ht="24" customHeight="1">${heading}</row>${rows}</sheetData><mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells><autoFilter ref="A4:${lastColumn}${Math.max(4, report.rows.length + 4)}"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FF14382B"/><sz val="16"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E5B45"/><bgColor indexed="64"/></patternFill></fill><borders count="2"><border/><border><left style="thin"><color rgb="FFD8E2DD"/></left><right style="thin"><color rgb="FFD8E2DD"/></right><top style="thin"><color rgb="FFD8E2DD"/></top><bottom style="thin"><color rgb="FFD8E2DD"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zip([
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: "docProps/core.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:title>${xml(report.title)}</dc:title><dc:creator>Республикалық математиктер бірлестігі</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${new Date().toISOString()}</dcterms:created></cp:coreProperties>` },
    { name: "docProps/app.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>matclub.kz</Application></Properties>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Есеп" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: styles },
    { name: "xl/worksheets/sheet1.xml", content: sheet },
  ]);
}

export async function reportPdf(report: ReportData) {
  const header: TableCell[] = report.columns.map((column) => ({ text: column.label, style: "tableHeader" }));
  const body: TableCell[][] = [header, ...report.rows.map((row) => report.columns.map((column) => ({ text: String(row[column.key] ?? ""), style: "tableCell", alignment: column.numeric ? "right" : "left" })) as TableCell[])];
  const summary: Content = { columns: report.summary.map((item) => ({ stack: [{ text: String(item.value), style: "metricValue" }, { text: item.label, style: "metricLabel" }], margin: [0, 0, 12, 12] })) };
  const definition: TDocumentDefinitions = {
    pageSize: "A3", pageOrientation: "landscape", pageMargins: [28, 34, 28, 34],
    info: { title: report.title, author: "Республикалық математиктер бірлестігі" },
    content: [
      { text: "РЕСПУБЛИКАЛЫҚ МАТЕМАТИКТЕР БІРЛЕСТІГІ", style: "eyebrow" },
      { text: report.title, style: "title" },
      { text: `Кезең: ${report.periodLabel} · Жасалған күні: ${new Date().toLocaleDateString("kk-KZ", { timeZone: "Asia/Almaty" })}`, style: "meta" },
      summary,
      { table: { headerRows: 1, widths: report.columns.map((column) => column.numeric ? 44 : "*"), body }, layout: { fillColor: (rowIndex: number) => rowIndex === 0 ? "#1E5B45" : rowIndex % 2 === 0 ? "#F2F7F4" : null, hLineColor: () => "#CAD9D2", vLineColor: () => "#CAD9D2", paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 4, paddingBottom: () => 4 } },
    ],
    footer: (currentPage, pageCount) => ({ text: `${currentPage} / ${pageCount}`, alignment: "right", margin: [0, 8, 28, 0], color: "#64736C", fontSize: 8 }),
    defaultStyle: { font: "Roboto", fontSize: 8, color: "#17211D" },
    styles: {
      eyebrow: { fontSize: 8, bold: true, color: "#1E5B45", characterSpacing: 1.2 }, title: { fontSize: 20, bold: true, color: "#14382B", margin: [0, 6, 0, 4] },
      meta: { fontSize: 9, color: "#64736C", margin: [0, 0, 0, 14] }, metricValue: { fontSize: 15, bold: true, color: "#14382B" }, metricLabel: { fontSize: 8, color: "#64736C" },
      tableHeader: { bold: true, color: "#FFFFFF", fontSize: 7 }, tableCell: { fontSize: 7 },
    },
  };
  return new Uint8Array(await pdfMake.createPdf(definition).getBuffer());
}
