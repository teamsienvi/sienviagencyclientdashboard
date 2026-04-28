// inspect_xlsx.cjs
const fs = require("fs");
const path = require("path");

// Find xlsx in node_modules
let xl;
try {
  xl = require("xlsx");
} catch(e) {
  try {
    xl = require(path.join(__dirname, "..", "node_modules", "xlsx"));
  } catch(e2) {
    console.error("xlsx not found:", e2.message);
    process.exit(1);
  }
}

const wb = xl.read(fs.readFileSync("C:/Users/Iris/Downloads/BulkSheetExport.xlsx"));
console.log("Sheets:", wb.SheetNames);

wb.SheetNames.slice(0, 5).forEach(name => {
  const rows = xl.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
  console.log(`\n── Sheet: "${name}" (${rows.length} rows) ──`);
  rows.slice(0, 6).forEach((r, i) => {
    const s = JSON.stringify(r);
    console.log(`  row${i}: ${s.length > 250 ? s.slice(0, 250) + "..." : s}`);
  });
});
