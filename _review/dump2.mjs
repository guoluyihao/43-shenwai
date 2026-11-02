import fs from 'node:fs';
const file = process.argv[2];
const from = Number(process.argv[3] || 1), to = Number(process.argv[4] || 99);
const h = fs.readFileSync(file, 'utf8');
const b = h.slice(h.indexOf('<div class="pages"'));
const pages = b.split(/<div class="pg(?:\s[^"]*)?"[^>]*>/).slice(1);
pages.forEach((p, i) => {
  if (i + 1 < from || i + 1 > to) return;
  const t = p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`\n### p${i + 1}\n${t.slice(0, 1500)}`);
});
