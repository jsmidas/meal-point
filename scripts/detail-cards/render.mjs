/**
 * 상세페이지 카드 이미지 생성기
 *
 * 사용법
 *   node scripts/detail-cards/render.mjs scripts/detail-cards/configs/heater-30g.json           # 이미지만 생성
 *   node scripts/detail-cards/render.mjs scripts/detail-cards/configs/heater-30g.json --upload  # 생성 + 스토리지 업로드 + product_pages.feature_images 갱신
 *
 * - template.html 을 로컬 Chrome(headless)으로 렌더해 카드별 JPG(2688×3438, 기존 상세 이미지와 같은 비율)를 만든다.
 * - 결과: scripts/detail-cards/out/<config 이름>/001.jpg … (git 제외)
 * - --upload 시 관리자 상세페이지 편집기가 쓰는 것과 같은 경로(logos/pages/<product_id>/feature-N-<ts>.jpg)에 올리고
 *   feature_images 를 교체한다. 다른 필드(히어로·사양 등)는 건드리지 않는다. config 에 specs 가 있으면 specs 도 갱신.
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error("Chrome/Edge 실행 파일을 찾지 못했습니다.");

const CARD_W = 1344, CARD_H = 1719, SCALE = 2;
const CARD_COUNT = 8; // template.html 의 cards 배열 길이와 맞출 것

const configPath = process.argv[2];
if (!configPath) throw new Error("config JSON 경로를 지정하세요.");
const upload = process.argv.includes("--upload");
const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
const name = path.basename(configPath, ".json");
const outDir = path.join(HERE, "out", name);
fs.mkdirSync(outDir, { recursive: true });

// 에셋 경로를 file:// 절대 URL로 치환
const assets = Object.fromEntries(Object.entries(cfg.assets).map(([k, v]) => [k, pathToFileURL(path.resolve(HERE, v)).href]));
const data = { ...cfg, assets, packs: Math.round(cfg.boxQty / cfg.packQty) };

const template = fs.readFileSync(path.join(HERE, "template.html"), "utf8");
const html = template.replace("/*__DATA__*/null", JSON.stringify(data));
const buildPath = path.join(outDir, "build.html");
fs.writeFileSync(buildPath, html);

const files = [];
for (let i = 0; i < CARD_COUNT; i++) {
  const png = path.join(outDir, `card-${i}.png`);
  const url = pathToFileURL(buildPath).href + `#${i}`;
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--force-device-scale-factor=${SCALE}`, `--window-size=${CARD_W},${CARD_H}`,
    "--virtual-time-budget=4000", `--screenshot=${png}`, url,
  ], { stdio: "ignore", timeout: 60000 });
  const jpg = path.join(outDir, `${String(i + 1).padStart(3, "0")}.jpg`);
  await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(jpg);
  fs.unlinkSync(png);
  files.push(jpg);
  console.log("rendered", path.relative(ROOT, jpg));
}

if (!upload) {
  console.log(`\n이미지 ${files.length}장 생성 완료. 업로드하려면 --upload 를 붙이세요.`);
  process.exit(0);
}

// ── 업로드 ──
const { createClient } = await import("@supabase/supabase-js");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const pid = cfg.productId;
if (!pid) throw new Error("config 에 productId 가 없습니다.");
const ts = Date.now();
const urls = [];
for (let i = 0; i < files.length; i++) {
  const key = `pages/${pid}/feature-${i}-${ts}.jpg`;
  const { error } = await db.storage.from("logos").upload(key, fs.readFileSync(files[i]), { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`upload ${files[i]}: ${error.message}`);
  urls.push(db.storage.from("logos").getPublicUrl(key).data.publicUrl);
}
const patch = { feature_image: urls[0], feature_images: urls };
if (cfg.specs) patch.specs = cfg.specs;
const { data: existing } = await db.from("product_pages").select("id").eq("product_id", pid).maybeSingle();
if (existing) {
  const { error } = await db.from("product_pages").update(patch).eq("id", existing.id);
  if (error) throw new Error("update: " + error.message);
  console.log("product_pages 갱신:", existing.id);
} else {
  const { data: row, error } = await db.from("product_pages").insert({ product_id: pid, ...patch, is_published: false }).select("id").single();
  if (error) throw new Error("insert: " + error.message);
  console.log("product_pages 생성(미게시):", row.id, "→ 관리자에서 히어로 지정 후 게시하세요.");
}
console.log(`feature_images ${urls.length}장 교체 완료.`);
