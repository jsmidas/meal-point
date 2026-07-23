// 제품 카테고리 체계 — 랜딩 쇼케이스 · /products 카탈로그 · 관리자 화면에서 공용
export type GroupKey = "heating" | "lunchbox" | "ticketing";

export interface ProductGroup {
  key: GroupKey;
  label: string;
  categories: string[];
}

export const productGroups: ProductGroup[] = [
  {
    key: "heating",
    label: "발열도시락 · 주변 제품",
    categories: ["inner", "outer", "heater", "film", "set"],
  },
  {
    key: "lunchbox",
    label: "도시락 용기",
    categories: ["lunchbox"],
  },
  {
    key: "ticketing",
    label: "식권발행기",
    categories: ["ticket_printer"],
  },
];

export const categoryLabels: Record<string, string> = {
  inner: "내피",
  outer: "외피",
  heater: "발열제",
  film: "필름",
  set: "세트",
  lunchbox: "도시락 용기",
  ticket_printer: "식권발행기",
};

// 배지 색상 — 한글 라벨 기준
export const badgeColors: Record<string, string> = {
  내피: "bg-primary/20 text-primary",
  외피: "bg-accent/20 text-accent",
  발열제: "bg-red-500/20 text-red-400",
  필름: "bg-emerald-500/20 text-emerald-400",
  세트: "bg-emerald-500/20 text-emerald-400",
  "도시락 용기": "bg-sky-500/20 text-sky-400",
  식권발행기: "bg-accent/20 text-accent",
};
