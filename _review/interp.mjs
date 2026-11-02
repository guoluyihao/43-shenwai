import fs from 'node:fs';
const html = fs.readFileSync(process.argv[2], 'utf8');
// an-interp blocks
const blocks = [...html.matchAll(/<div class="an-interp">([\s\S]*?)<\/div><\/div>/g)].map((m) => m[1]);
console.log('interp blocks', blocks.length);
const txt = (s) => s.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/\s+/g, ' ').trim();
blocks.forEach((b, i) => console.log(`\n[${i + 1}] ${txt(b).slice(0, 700)}`));
const hits = [...html.matchAll(/摘要|关键发现|一页结论|执行摘要/g)];
console.log('\n摘要 hits:', hits.map((h) => html.slice(h.index - 60, h.index + 40).replace(/<[^>]+>/g, ' ')).join('\n'));
