import Sidebar from "@/components/admin/Sidebar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "밀포인트 관리자",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-bg-dark">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 p-6 lg:p-8 overflow-auto print:p-0">{children}</main>
    </div>
  );
}
