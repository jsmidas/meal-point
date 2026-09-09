// Storage 버킷 전체 복사 (구 프로젝트 → 신 프로젝트). 버킷이 없으면 public 으로 생성.
// 사용: node scripts/migrate-supabase/copy-storage.mjs <OLD_URL> <OLD_SERVICE_KEY> <NEW_URL> <NEW_SERVICE_KEY> [bucket=logos]
const [oldUrl, oldKey, newUrl, newKey, bucket = "logos"] = process.argv.slice(2);
if (!oldUrl || !oldKey || !newUrl || !newKey) { console.error("usage: copy-storage.mjs <OLD_URL> <OLD_SK> <NEW_URL> <NEW_SK> [bucket]"); process.exit(1); }
const h = (k) => ({ apikey: k, Authorization: `Bearer ${k}` });

async function listAll(prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const r = await fetch(`${oldUrl}/storage/v1/object/list/${bucket}`, {
      method: "POST", headers: { ...h(oldKey), "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    const items = await r.json();
    if (!Array.isArray(items)) throw new Error(`list failed: ${JSON.stringify(items)}`);
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null) out.push(...(await listAll(path))); // 폴더
      else out.push({ path, type: it.metadata?.mimetype || "application/octet-stream" });
    }
    if (items.length < 1000) break;
    offset += 1000;
  }
  return out;
}

// 신 프로젝트 버킷 확보
const bk = await fetch(`${newUrl}/storage/v1/bucket/${bucket}`, { headers: h(newKey) });
if (bk.status === 404 || bk.status === 400) {
  const c = await fetch(`${newUrl}/storage/v1/bucket`, { method: "POST", headers: { ...h(newKey), "Content-Type": "application/json" }, body: JSON.stringify({ id: bucket, name: bucket, public: true }) });
  console.log("bucket create:", c.status, await c.text());
}

const files = await listAll();
console.log(`objects: ${files.length}`);
let ok = 0, fail = 0;
for (const f of files) {
  const src = await fetch(`${oldUrl}/storage/v1/object/${bucket}/${encodeURI(f.path)}`, { headers: h(oldKey) });
  if (!src.ok) { console.log("DL FAIL", f.path, src.status); fail++; continue; }
  const buf = Buffer.from(await src.arrayBuffer());
  const up = await fetch(`${newUrl}/storage/v1/object/${bucket}/${encodeURI(f.path)}`, {
    method: "POST", headers: { ...h(newKey), "Content-Type": f.type, "x-upsert": "true" }, body: buf,
  });
  if (up.ok) ok++; else { fail++; console.log("UP FAIL", f.path, up.status, await up.text()); }
  process.stdout.write(`\r${ok + fail}/${files.length}`);
}
console.log(`\ndone: ok ${ok}, fail ${fail}`);
