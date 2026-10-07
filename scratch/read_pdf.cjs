const fs = require("node:fs");
const pdf = require("pdf-parse");

async function parse() {
  const data = fs.readFileSync("scratch/Live_HAIRtamin_Downloaded.pdf");
  const parsed = await pdf(data);
  console.log("Pages:", parsed.numpages);
  console.log("Text:\n", parsed.text);
}

parse().catch(console.error);
