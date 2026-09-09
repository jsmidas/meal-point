// 테이블별 행 수 집계 — 이관 전/후 비교용
// 사용: node scripts/migrate-supabase/count-rows.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY>
const [url, key] = process.argv.slice(2);
if (!url || !key) { console.error("usage: count-rows.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY>"); process.exit(1); }
const TABLES = ["company_info","companies","products","company_prices","company_price_history","orders","order_items",
  "quotes","quote_items","quote_send_logs","statements","statement_items","statement_send_logs","billings","payments",
  "payment_requests","inventory","inventory_logs","expenses","product_pages","members","popups","sale_checks",
  "meal_guest_accounts","meal_trial_grants"];
let total = 0;
for (const t of TABLES) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*`, { method: "HEAD", headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" } });
  const n = r.headers.get("content-range")?.split("/")[1];
  const count = r.ok ? Number(n) : NaN;
  if (!Number.isNaN(count)) total += count;
  console.log(`${t.padEnd(24)} ${r.ok ? count : "ERR " + r.status}`);
}
console.log(`${"TOTAL".padEnd(24)} ${total}`);
