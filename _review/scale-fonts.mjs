import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const cssDir = path.join(ROOT, 'assets/css');
const files = [
  ...fs.readdirSync(cssDir).filter((f) => f.endsWith('.css')).map((f) => path.join(cssDir, f)),
  path.join(ROOT, 'assets/js/pages/basic.js'),
  path.join(ROOT, 'assets/js/pages/exams.js')
];

let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  let count = 0;
  const out = src.replace(/font-size\s*:\s*([0-9]*\.?[0-9]+)px/g, (m, n) => {
    count++;
    return `font-size: calc(${n}px * 1.3)`;
  });
  if (count) {
    fs.writeFileSync(file, out, 'utf8');
    console.log(path.basename(file), count);
    total += count;
  }
}
console.log('total', total);
