import fs from 'fs';

let sql = fs.readFileSync('netlify/database/migrations/20260620143000_rich_tinyverse_islands.sql', 'utf8');

function patchWorld(sqlText, slug, addCells) {
  const re = new RegExp(`VALUES \\([^,]+, [^,]+, [^,]+, '${slug}'[^;]+?::jsonb`, 'i');
  const m = sqlText.match(re);
  if (!m) return sqlText;
  const full = m[0];
  const jsonMatch = full.match(/'(\{.+?\})'::jsonb/);
  if (!jsonMatch) return sqlText;
  let jsonStr = jsonMatch[1].replace(/\\"/g, '"');
  let data;
  try { data = JSON.parse(jsonStr); } catch(e) { return sqlText; }
  if (!data.cells) data.cells = [];
  addCells.forEach(c => data.cells.unshift(c));
  const newJson = JSON.stringify(data).replace(/"/g, '\\"');
  const newFull = full.replace(jsonMatch[0], `'${newJson}'::jsonb`);
  return sqlText.replace(full, newFull);
}

sql = patchWorld(sql, 'tinyverse-nexus', [
  {x:2,z:2,terrain:'grass',kind:'stargate',dest:'tidewater-bay'},
  {x:4,z:3,terrain:'grass',kind:'stargate',dest:'iron-ridge'},
  {x:6,z:2,terrain:'grass',kind:'stargate',dest:'crystal-canyon'}
]);

sql = patchWorld(sql, 'tidewater-bay', [
  {x:0,z:0,terrain:'grass',kind:'stargate',dest:'tinyverse-nexus'}
]);
sql = patchWorld(sql, 'iron-ridge', [
  {x:0,z:0,terrain:'grass',kind:'stargate',dest:'tinyverse-nexus'}
]);

fs.writeFileSync('netlify/database/migrations/20260620143000_rich_tinyverse_islands.sql', sql);
const count = (sql.match(/"kind":"stargate"/g) || []).length;
console.log('Stargate count:', count);
console.log('Sample:', (sql.match(/"kind":"stargate"[^}]+}/g) || []).slice(0,2));
