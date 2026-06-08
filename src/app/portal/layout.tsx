import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import PortalNav from "./PortalNav";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSession();
  if (!session) redirect("/login");

  // 회사명 조회 (헤더 표시용)
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (supabase.from("companies") as any)
    .select("name")
    .eq("id", session.companyId)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-bg-dark">
      <PortalNav
        companyName={company?.name || "거래처"}
        userName={session.name}
      />
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10">{children}</main>
    </div>
  );
}
