import fs from "fs";
import * as XLSX from "xlsx";

const FILE_PATH = "C:\\Users\\Iris\\Downloads\\BulkSheetExport.xlsx";
const fileBuffer = fs.readFileSync(FILE_PATH);
const workbook = XLSX.read(fileBuffer, { type: "buffer" });

console.log("Sheet names:", workbook.SheetNames);

for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n── Sheet: "${name}" (${rows.length} rows) ──`);
  // Print first 3 rows to see headers/structure
  rows.slice(0, 3).forEach((row, i) => console.log(`  Row ${i}:`, row));
}
