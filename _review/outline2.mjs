// 抽取已分页 A4 HTML 的结构：每页所属章 / 节 / 块，及章节页数统计
import fs from 'node:fs';
const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
const body = html.slice(html.indexOf('<div class="pages"'));
const pages = body.split(/<div class="pg(?:\s[^"]*)?"[^>]*>/).slice(1);
const out = [];
pages.forEach((p, i) => {
  const kickers = [...p.matchAll(/class="an-chapter-kicker"[^>]*>([^<]*)</g)].map((m) => m[1]);
  const chTitle = [...p.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => m[1]);
  const secs = [...p.matchAll(/class="an-section-no"[^>]*>([^<]*)</g)].map((m) => m[1]);
  const secTitles = [...p.matchAll(/<h3>([^<]*)<\/h3>/g)].map((m) => m[1]);
  const cardTitles = [...p.matchAll(/class="an-card-title"[^>]*>([^<]*)</g)].map((m) => m[1]);
  const h4 = [...p.matchAll(/<h4[^>]*>([^<]*)<\/h4>/g)].map((m) => m[1]);
  const tables = (p.match(/<table/g) || []).length;
  const text = p.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  out.push({ page: i + 1, ch: kickers[0] || '', chTitle: chTitle[0] || '', secs, secTitles, cardTitles, h4, tables, chars: text.length, text: text.slice(0, 120) });
});
for (const p of out) {
  const head = p.ch ? `[CH ${p.ch} ${p.chTitle}]` : '';
  console.log(`p${p.page} ${head} 表${p.tables} ${p.chars}字 ${p.secs.length ? '| 节:' + p.secs.join(',') : ''} ${p.cardTitles.length ? '| 块:' + p.cardTitles.slice(0, 4).join(' / ') : ''}`);
}
console.log('TOTAL PAGES', out.length);
