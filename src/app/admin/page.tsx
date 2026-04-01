"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { Building2, Package, ShoppingCart, TrendingUp } from "lucide-react";

interface DashboardStats {
  companies: number;
  products: number;
  monthOrders: number;
  monthRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    companies: 0,
    products: 0,
    monthOrders: 0,
    monthRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

      const [compRes, prodRes, orderRes] = await Promise.all([
        db.from("companies").select("id", { count: "exact", head: true }).eq("is_active", true),
        db.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        db.from("orders").select("id, total_amount").gte("order_date", monthStart).lte("order_date", monthEnd),
      ]);

      const orders = orderRes.data || [];
      const monthRevenue = orders.reduce((sum: number, o: { total_amount: number }) => sum + (o.total_amount || 0), 0);

      setStats({
        companies: compRes.count || 0,
        products: prodRes.count || 0,
        monthOrders: orders.length,
        monthRevenue,
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  const cards = [
    {
      label: "거래처",
      value: loading ? "—" : `${formatNumber(stats.companies)}개`,
      icon: Building2,
      color: "text-primary bg-primary/10",
    },
    {
      label: "상품",
      value: loading ? "—" : `${formatNumber(stats.products)}개`,
      icon: Package,
      color: "text-accent bg-accent/10",
    },
    {
      label: "이번 달 주문",
      value: loading ? "—" : `${formatNumber(stats.monthOrders)}건`,
      icon: ShoppingCart,
      color: "text-emerald-400 bg-emerald-400/10",
    },
    {
      label: "이번 달 매출",
      value: loading ? "—" : `${formatNumber(stats.monthRevenue)}원`,
      icon: TrendingUp,
      color: "text-red-400 bg-red-400/10",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-8">대시보드</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((stat) => (
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
    </div>
  );
}
