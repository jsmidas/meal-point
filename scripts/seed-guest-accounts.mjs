// 게스트 체험 계정 풀 시드 (meal_guest_accounts)
// 사용: node scripts/seed-guest-accounts.mjs <accounts.json>
//   accounts.json = [{"login_id":"trial11","login_pw":"1234","label":"체험계정 1"}, ...]
// 같은 login_id 가 이미 있으면 비번/라벨만 갱신(멱등). service_role 키 필요(.env.local).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// .env.local 로드 (dotenv 없이 최소 파서)
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf-8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE env 누락 (.env.local 확인)");

const file = process.argv[2];
if (!file) throw new Error("사용법: node scripts/seed-guest-accounts.mjs <accounts.json>");
const accounts = JSON.parse(readFileSync(file, "utf-8"));

const db = createClient(url, key, { auth: { persistSession: false } });

let inserted = 0, updated = 0;
for (const a of accounts) {
  const { data: existing } = await db
    .from("meal_guest_accounts").select("id").eq("login_id", a.login_id).maybeSingle();
  if (existing) {
    const { error } = await db.from("meal_guest_accounts")
      .update({ login_pw: a.login_pw, label: a.label ?? null, is_active: true })
      .eq("id", existing.id);
    if (error) throw error;
    updated++;
  } else {
    const { error } = await db.from("meal_guest_accounts")
      .insert({ login_id: a.login_id, login_pw: a.login_pw, label: a.label ?? null });
    if (error) throw error;
    inserted++;
  }
}
const { count } = await db.from("meal_guest_accounts").select("*", { count: "exact", head: true });
console.log(`시드 완료 — 신규 ${inserted}, 갱신 ${updated}, 풀 전체 ${count}개`);
