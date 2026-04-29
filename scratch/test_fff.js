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
  console.log("Found", projects ? projects.length : 0, "projects");
  if (!projects) {
      console.log("Raw Data:", data);
      return;
  }
  const fff = projects.find(p => p.domain === 'fatherfigureformula.com');
  console.log("FFF Project data:", fff);

  // Let's also fetch the full project data to see what other metrics are there
  if (fff) {
    const pRes = await fetch("https://app.neilpatel.com/api/projects/" + fff.id, {
      headers: {
        "Authorization": "Bearer " + token
      }
    });
    const full = await pRes.json();
    console.log("FFF Full Project metrics:");
    console.log(JSON.stringify(full, null, 2).substring(0, 1500));
  }
}
test();
