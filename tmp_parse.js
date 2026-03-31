function parseCSV(csvText) {
  const normalizedText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "\n" && !inQuotes) {
      if (current.trim()) records.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) records.push(current);
  if (records.length < 2) return [];

  const headerLine = records[0].replace(/^\uFEFF/, "").trim();
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase());
  const rows = [];
  console.log("Headers:", headers);

  for (let i = 1; i < records.length; i++) {
    const line = records[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, idx) => { row[header] = values[idx] || ""; });
    
    // My fix:
    const url = row["postlink"] || row["reel_link"] || row["url"] || null;
    rows.push({ title: row["content"], url: url });
  }
  return rows;
}
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

const csv = `thumbnail_url,reel_link,content,date,video_views,reach,likes,comments,engagement,video_view_time_(seconds),avg._time_watched_(seconds)
"https://scontent-lhr6-1.xx.fbcdn.net/v/..","https://www.facebook.com/reel/944454447948586/","The best toys spark ideas right away 💡 I love how...",2026-03-30 17:49,189,192,1,0,0.52,373.1,2.05`;

console.log(parseCSV(csv));
