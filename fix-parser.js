const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Find the parseCSV function block
  const parseCsvRegex = /function parseCSV\([^)]+\): [^{]+\{[\s\S]*?(?=function parseCSVLine)/;
  
  const optimizedParser = `function parseCSV(csvContent: any[] | string): any[] {
  // Ensure we are working with a string
  const text = typeof csvContent === 'string' ? csvContent : '';
  if (!text) return [];

  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  const records: string[] = [];
  let currentRecord = "";
  let inQuotes = false;
  
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentRecord += char;
    } else if (char === "\\n" && !inQuotes) {
      if (currentRecord.trim()) records.push(currentRecord);
      currentRecord = "";
    } else {
      currentRecord += char;
    }
  }
  if (currentRecord.trim()) records.push(currentRecord);

  if (records.length < 2) return [];

  const headerLine = records[0].replace(/^\\uFEFF/, "").trim();
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase());
  
  const rows: any[] = [];
  
  for (let i = 1; i < records.length; i++) {
    const line = records[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    const post: any = {
      title: row["content"] || row["title"] || row["caption"] || row["message"] || null,
      date: row["timestamp"] || row["date"] || row["published"] || null,
      type: row["type"] || row["format"] || null,
      reach: parseInt(row["reach (organic)"] || row["reach"] || row["organic reach"] || "0", 10) || 0,
      impressions: parseInt(row["views (organic)"] || row["views"] || row["video views"] || row["videoviews"] || row["impressions"] || row["organic views"] || row["organic impressions"] || "0", 10) || 0,
      views: parseInt(row["video views"] || row["views"] || row["videoviews"] || row["views (organic)"] || row["organic views"] || "0", 10) || 0,
      likes: parseInt(row["likes (organic)"] || row["likes"] || "0", 10) || 0,
      comments: parseInt(row["comments (organic)"] || row["comments"] || "0", 10) || 0,
      shares: parseInt(row["shares (organic)"] || row["shares"] || row["shared"] || "0", 10) || 0,
      saves: parseInt(row["saved (organic)"] || row["saved"] || row["saves"] || "0", 10) || 0,
      interactions: parseInt(row["interactions (organic)"] || row["interactions"] || row["engagements"] || "0", 10) || 0,
      engagement: parseFloat(row["engagement (organic)"] || row["engagement"] || "0") || 0,
      url: row["url"] || row["postlink"] || row["link"] || null,
      link: row["link"] || null,
      image: row["image"] || null,
    };
    
    rows.push(post);
  }
  return rows;
}
`;

  content = content.replace(parseCsvRegex, optimizedParser + '\n');
  fs.writeFileSync(file, content, 'utf8');
}

fixFile('./supabase/functions/sync-metricool-instagram/index.ts');
fixFile('./supabase/functions/sync-metricool-facebook/index.ts');
