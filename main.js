const fs = require('fs');
const path = require('path');
const core = require('@actions/core');

function extractDataFromSarif(sarifPath) {
  const sarif = JSON.parse(fs.readFileSync(sarifPath, 'utf-8'));
  const results = sarif.runs[0].results || [];
  const rules = sarif.runs[0].tool.driver.rules || [];

  return results.map(result => {
    const rule = rules[result.ruleIndex];
    const loc = result.locations[0].physicalLocation;
    const snippet = loc.region.snippet ? loc.region.snippet.text : '';

    return {
      ruleId: result.ruleId,
      desc: rule.shortDescription.text,
      file: loc.artifactLocation.uri,
      start: loc.region.startLine,
      end: loc.region.endLine,
      level: result.level,
      snippet,
    };
  });
}

function formatMarkdownTable(results) {
  const header = `| Rule ID | Description | File | Start Line | End Line | Severity |\n|---------|-------------|------|------------|----------|----------|`;
  const rows = results.map(r =>
    `| \`${r.ruleId}\` | ${r.desc} | \`${r.file}\` | ${r.start} | ${r.end} | ${r.level} |`
  );
  return [header, ...rows].join('\n');
}

function formatDetailsSection(results) {
  return results.map(r => {
    return `

#### 🔍 ${r.ruleId} — ${r.desc}
- **File:** \`${r.file}\`
- **Lines:** ${r.start} - ${r.end}
- **Severity:** ${r.level}

**Code Snippet:**
\`\`\`yaml
${r.snippet}
\`\`\`
---
`;
  }).join('\n');
}

function writeSummary(summaryPath, table, details) {
  const header = `### 🛡️ Checkov Scan Report\n\n`;
  const detailHeader = `\n### 📄 Detailed Findings\n\n`;
  fs.appendFileSync(summaryPath, header + table + detailHeader + details);
}

function run() {
  const sarifPath = path.resolve('results.sarif');
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  core.info(`[Checkov] SARIF file path: ${sarifPath}`);

  if (!fs.existsSync(sarifPath)) {
    console.error(`[❌] SARIF file not found: ${sarifPath}`);
    process.exit(1);
  }

  if (!summaryPath) {
    console.error(`[❌] GITHUB_STEP_SUMMARY not set.`);
    process.exit(1);
  }

  const data = extractDataFromSarif(sarifPath);
  const table = formatMarkdownTable(data);
  const details = formatDetailsSection(data);

  writeSummary(summaryPath, table, details);

  data.forEach(r => {
    console.log(`[Checkov] ${r.ruleId} - ${r.desc} (${r.file}:${r.start}-${r.end}): ${r.level}`);
  });
}

run();