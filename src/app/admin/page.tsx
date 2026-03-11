import { Building2, Package, ShoppingCart, TrendingUp } from "lucide-react";

const stats = [
  {
    label: "거래처",
    value: "—",
    icon: Building2,
    color: "text-primary bg-primary/10",
  },
  {
    label: "상품",
    value: "—",
    icon: Package,
    color: "text-accent bg-accent/10",
  },
  {
    label: "이번 달 주문",
    value: "—",
    icon: ShoppingCart,
    color: "text-emerald-400 bg-emerald-400/10",
  },
  {
    label: "이번 달 매출",
    value: "—",
    icon: TrendingUp,
    color: "text-red-400 bg-red-400/10",
  },
];

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-8">대시보드</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-bg-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-text-secondary">{stat.label}</span>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}
              >
                <stat.icon size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-bg-card p-8 text-center">
        <p className="text-text-secondary">
          Supabase 연동 후 실시간 데이터가 표시됩니다.
        </p>
        <p className="text-sm text-text-muted mt-2">
          .env.local 파일에 Supabase URL과 ANON KEY를 설정해주세요.
        </p>
      </div>
    </div>
  );
}
