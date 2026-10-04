"use client";

import { useEffect, useState } from "react";

export interface AuthInfo {
  authenticated: boolean;
  role?: string;
  name?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  approval_status?: string; // none | pending | approved | rejected
  has_cert?: boolean;
}

export interface CompanyPricing {
  loading: boolean;
  auth: AuthInfo;
  /** 승인된 업체일 때만 채워진다: 상품 id → 적용 단가 */
  prices: Record<string, number>;
  isApprovedCompany: boolean;
}

/**
 * 홈페이지(상품 목록·상세)에서 로그인 상태와 승인 업체 단가를 가져온다.
 * 단가는 서버(/api/portal/products)가 세션의 거래처 기준으로 확정해 준다.
 */
export function useCompanyPricing(): CompanyPricing {
  const [state, setState] = useState<CompanyPricing>({
    loading: true,
    auth: { authenticated: false },
    prices: {},
    isApprovedCompany: false,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const auth: AuthInfo = await fetch("/api/auth", { cache: "no-store" }).then((r) => r.json());
        const prices: Record<string, number> = {};
        const approved = !!auth.authenticated && auth.role === "company" && !!auth.company_id;
        if (approved) {
          const res = await fetch("/api/portal/products", { cache: "no-store" });
          const data = await res.json();
          if (data.ok) {
            // 단가 0(미설정) 상품은 '가격문의'로 두기 위해 제외
            for (const p of data.products as { id: string; price: number }[]) if (p.price > 0) prices[p.id] = p.price;
          }
        }
        if (alive) setState({ loading: false, auth, prices, isApprovedCompany: approved });
      } catch {
        if (alive) setState((s) => ({ ...s, loading: false }));
      }
    })();
    return () => { alive = false; };
  }, []);

  return state;
}
