import fs from 'fs';

async function test() {
  const token = "app#tier2__d4253034417d729b238c9dea7707ab0624ac5012";
  const res = await fetch("https://app.neilpatel.com/api/projects", {
    headers: {
      "Authorization": "Bearer " + token
    }
  });
  const data = await res.json();
  const projects = Array.isArray(data) ? data : data.projects;
  
  if (!projects || projects.length === 0) {
      console.log("No projects or unauthorized.", data);
      return;
  }
  console.log(`Found ${projects.length} projects`);
  
  // Find a project with a score or some data
  const sample = projects.find(p => p.score > 0) || projects[0];
  console.log("Sample Project:", sample.domain);
  
  const pRes = await fetch("https://app.neilpatel.com/api/projects/" + sample.id, {
    headers: {
      "Authorization": "Bearer " + token
    }
  });
  const full = await pRes.json();
  console.log("Full Project metrics keys:", Object.keys(full.project || {}));
  console.log("Full Project payload sample:", JSON.stringify({
    domain: full.project.domain,
    score: full.project.score,
    backlinks: full.project.backlinks,
    traffic: full.project.traffic,
    seo_opportunities: full.project.seo_opportunities,
    crawled_pages: full.project.crawled_pages
  }, null, 2));
}
test();
