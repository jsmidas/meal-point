/**
 * 사업자등록증 파일 저장 — 비공개 버킷(biz-certs). 서버(service_role)에서만 다룬다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const BIZ_CERT_BUCKET = "biz-certs";
export const MAX_CERT_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;

/** 버킷이 없으면 만든다 (마이그레이션 미적용 환경 대비). */
export async function ensureBizCertBucket(admin: Admin): Promise<void> {
  const { data } = await admin.storage.getBucket(BIZ_CERT_BUCKET);
  if (data) return;
  await admin.storage.createBucket(BIZ_CERT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_CERT_BYTES,
    allowedMimeTypes: Object.keys(EXT),
  });
}

export function validateCertFile(file: File): string | null {
  if (!EXT[file.type]) return "사업자등록증은 JPG, PNG, WEBP 이미지 또는 PDF 파일만 올릴 수 있습니다.";
  if (file.size > MAX_CERT_BYTES) return "파일 크기는 10MB 이하여야 합니다.";
  if (file.size === 0) return "빈 파일입니다.";
  return null;
}

/** 업로드 후 버킷 내 경로를 돌려준다. */
export async function uploadBizCert(admin: Admin, memberId: string, file: File): Promise<{ path: string } | { error: string }> {
  const invalid = validateCertFile(file);
  if (invalid) return { error: invalid };
  await ensureBizCertBucket(admin);
  const path = `${memberId}/${Date.now()}.${EXT[file.type]}`;
  const { error } = await admin.storage
    .from(BIZ_CERT_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return { error: `파일 업로드 실패: ${error.message}` };
  return { path };
}

/** 관리자·본인 열람용 서명 URL (기본 5분) */
export async function bizCertSignedUrl(admin: Admin, path: string, expiresSec = 300): Promise<string | null> {
  const { data } = await admin.storage.from(BIZ_CERT_BUCKET).createSignedUrl(path, expiresSec);
  return data?.signedUrl ?? null;
}

export async function removeBizCert(admin: Admin, path: string): Promise<void> {
  await admin.storage.from(BIZ_CERT_BUCKET).remove([path]);
}
