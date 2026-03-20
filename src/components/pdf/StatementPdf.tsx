"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import type { StatementWithItems, CompanyInfo } from "@/lib/supabase/types";

Font.register({
  family: "NotoSansKR",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-Regular.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-Bold.ttf",
      fontWeight: 700,
    },
  ],
});

// 에메랄드 그린 테마 색상
const GREEN = "#047857";
const GREEN_LIGHT = "#059669";
const GREEN_BG = "#ecfdf5";
const GREEN_BORDER = "#a7f3d0";
const GRAY_BG = "#f9fafb";
const GRAY_BORDER = "#e5e7eb";
const DARK = "#111827";
const MUTED = "#6b7280";

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansKR",
    fontSize: 9,
    padding: 0,
    color: DARK,
  },
  // 상단 헤더 바
  header: {
    backgroundColor: GREEN,
    padding: "24 32",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 6,
  },
  headerSub: {
    color: "#d1fae5",
    fontSize: 8,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerNumber: {
    color: "white",
    fontSize: 11,
    fontWeight: 700,
  },
  headerDate: {
    color: "#d1fae5",
    fontSize: 8,
    marginTop: 2,
  },
  // 본문 영역
  body: {
    padding: "20 32 32 32",
  },
  // 합계 금액 박스
  totalBox: {
    border: `1.5px solid ${GREEN_BORDER}`,
    borderRadius: 6,
    padding: "14 20",
    marginBottom: 16,
    alignItems: "center",
    backgroundColor: GREEN_BG,
  },
  totalLabel: {
    fontSize: 8,
    color: GREEN,
    fontWeight: 700,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: 700,
    color: GREEN,
  },
  totalSub: {
    flexDirection: "row",
    gap: 20,
    marginTop: 4,
  },
  totalSubText: {
    fontSize: 8,
    color: MUTED,
  },
  // 공급자/공급받는자 그리드
  infoGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  infoBox: {
    flex: 1,
    border: `1px solid ${GRAY_BORDER}`,
    borderRadius: 4,
    overflow: "hidden",
  },
  infoTitleSupplier: {
    fontWeight: 700,
    textAlign: "center",
    backgroundColor: GREEN,
    color: "white",
    padding: "5 4",
    fontSize: 9,
  },
  infoTitleReceiver: {
    fontWeight: 700,
    textAlign: "center",
    backgroundColor: GREEN_LIGHT,
    color: "white",
    padding: "5 4",
    fontSize: 9,
  },
  infoContent: {
    padding: "6 8",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  infoLabel: {
    width: 52,
    color: MUTED,
    fontSize: 7.5,
  },
  infoValue: {
    flex: 1,
    fontSize: 7.5,
  },
  // 품목 테이블
  table: {
    marginBottom: 0,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: GREEN,
    borderRadius: 0,
  },
  tableHeaderCell: {
    color: "white",
    fontWeight: 700,
    fontSize: 8,
    padding: "5 4",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `0.5px solid ${GRAY_BORDER}`,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottom: `0.5px solid ${GRAY_BORDER}`,
    backgroundColor: GRAY_BG,
  },
  cell: {
    fontSize: 8,
    padding: "4 4",
    textAlign: "center",
  },
  cellLeft: {
    fontSize: 8,
    padding: "4 4",
    textAlign: "left",
  },
  cellRight: {
    fontSize: 8,
    padding: "4 4",
    textAlign: "right",
  },
  // 컬럼 너비
  colNo: { width: 24 },
  colName: { flex: 3 },
  colSpec: { flex: 2 },
  colUnit: { width: 36 },
  colQty: { width: 44 },
  colPrice: { width: 60 },
  colAmount: { width: 72 },
  // 합계 행
  totalRow: {
    flexDirection: "row",
    backgroundColor: GREEN,
    padding: "6 4",
  },
  totalRowLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "white",
    textAlign: "right",
    flex: 1,
    paddingRight: 8,
  },
  totalRowValue: {
    fontSize: 11,
    fontWeight: 700,
    color: "white",
    width: 72,
    textAlign: "right",
    paddingRight: 4,
  },
  // 비고
  notes: {
    border: `1px solid ${GRAY_BORDER}`,
    borderRadius: 4,
    padding: "6 8",
    fontSize: 8,
    marginTop: 12,
    color: MUTED,
  },
  // 푸터
  footer: {
    textAlign: "center",
    fontSize: 8,
    color: GREEN,
    marginTop: 16,
    fontWeight: 700,
  },
  // 은행 정보
  bankInfo: {
    marginTop: 12,
    border: `1px solid ${GREEN_BORDER}`,
    borderRadius: 4,
    padding: "6 10",
    backgroundColor: GREEN_BG,
    fontSize: 8,
    color: DARK,
  },
});

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

interface Props {
  statement: StatementWithItems;
  companyInfo: CompanyInfo | null;
}

export default function StatementPdf({ statement, companyInfo }: Props) {
  const c = statement.companies;
  const items = statement.statement_items;
  const emptyRows = Math.max(0, 10 - items.length);
  const dateStr = statement.statement_date.replace(/-/g, ". ") + ".";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* 상단 에메랄드 헤더 */}
        <View style={s.header}>
          <View>
            {companyInfo?.logo_image_url && (
              <Image src={companyInfo.logo_image_url} style={{ height: 28, objectFit: "contain", marginBottom: 4 }} />
            )}
            <Text style={s.headerTitle}>거 래 명 세 서</Text>
            <Text style={s.headerSub}>TRANSACTION STATEMENT</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerNumber}>{statement.statement_number}</Text>
            <Text style={s.headerDate}>{dateStr}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* 합계 금액 */}
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>합계금액 (VAT 포함)</Text>
            <Text style={s.totalAmount}>{fmt(statement.total_amount)}원</Text>
            <View style={s.totalSub}>
              <Text style={s.totalSubText}>공급가액: {fmt(statement.supply_amount)}원</Text>
              <Text style={s.totalSubText}>세액: {fmt(statement.tax_amount)}원</Text>
              {(statement as any).shipping_fee > 0 && (
                <Text style={s.totalSubText}>배송비: {fmt((statement as any).shipping_fee)}원</Text>
              )}
            </View>
          </View>

          {/* 공급자 / 공급받는자 */}
          <View style={s.infoGrid}>
            <View style={s.infoBox}>
              <Text style={s.infoTitleSupplier}>공급자</Text>
              <View style={s.infoContent}>
                {companyInfo ? (
                  <>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>상호</Text>
                      <Text style={{ ...s.infoValue, fontWeight: 700 }}>{companyInfo.name}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>대표자</Text>
                      <Text style={s.infoValue}>{companyInfo.ceo_name}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>사업자번호</Text>
                      <Text style={s.infoValue}>{companyInfo.biz_number}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>업태/종목</Text>
                      <Text style={s.infoValue}>{companyInfo.biz_type} / {companyInfo.biz_category}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>주소</Text>
                      <Text style={s.infoValue}>{companyInfo.address}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>연락처</Text>
                      <Text style={s.infoValue}>{companyInfo.phone}</Text>
                    </View>
                    {companyInfo.email && (
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>이메일</Text>
                        <Text style={s.infoValue}>{companyInfo.email}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={{ fontSize: 8, color: "#999" }}>공급자 정보 미등록</Text>
                )}
              </View>
            </View>
            <View style={s.infoBox}>
              <Text style={s.infoTitleReceiver}>공급받는자 (귀하)</Text>
              <View style={s.infoContent}>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>상호</Text>
                  <Text style={{ ...s.infoValue, fontWeight: 700 }}>{c.name}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>대표자</Text>
                  <Text style={s.infoValue}>{c.ceo_name}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>사업자번호</Text>
                  <Text style={s.infoValue}>{c.biz_number}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>업태/종목</Text>
                  <Text style={s.infoValue}>{c.biz_type || "—"} / {c.biz_category || "—"}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>주소</Text>
                  <Text style={s.infoValue}>{c.address || "—"}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>연락처</Text>
                  <Text style={s.infoValue}>{c.phone || "—"}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 품목 테이블 */}
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={{ ...s.tableHeaderCell, ...s.colNo }}>No</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colName, textAlign: "left" }}>품목</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colSpec, textAlign: "left" }}>규격</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colUnit }}>단위</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colQty, textAlign: "right" }}>수량</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colPrice, textAlign: "right" }}>단가</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colAmount, textAlign: "right" }}>금액</Text>
            </View>
            {items.map((item, i) => (
              <View key={item.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                <Text style={{ ...s.cell, ...s.colNo }}>{i + 1}</Text>
                <Text style={{ ...s.cellLeft, ...s.colName, fontWeight: 700 }}>{item.product_name}</Text>
                <Text style={{ ...s.cellLeft, ...s.colSpec }}>{item.specification || ""}</Text>
                <Text style={{ ...s.cell, ...s.colUnit }}>{item.unit}</Text>
                <Text style={{ ...s.cellRight, ...s.colQty }}>{fmt(item.quantity)}</Text>
                <Text style={{ ...s.cellRight, ...s.colPrice }}>{fmt(item.unit_price)}</Text>
                <Text style={{ ...s.cellRight, ...s.colAmount, fontWeight: 700 }}>{fmt(item.amount)}</Text>
              </View>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <View key={`e-${i}`} style={(items.length + i) % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                <Text style={{ ...s.cell, ...s.colNo, color: "#d1d5db" }}>{items.length + i + 1}</Text>
                <Text style={{ ...s.cellLeft, ...s.colName }}> </Text>
                <Text style={{ ...s.cellLeft, ...s.colSpec }}> </Text>
                <Text style={{ ...s.cell, ...s.colUnit }}> </Text>
                <Text style={{ ...s.cellRight, ...s.colQty }}> </Text>
                <Text style={{ ...s.cellRight, ...s.colPrice }}> </Text>
                <Text style={{ ...s.cellRight, ...s.colAmount }}> </Text>
              </View>
            ))}
            {/* 합계 행 */}
            <View style={s.totalRow}>
              <Text style={s.totalRowLabel}>합 계</Text>
              <Text style={s.totalRowValue}>{fmt(statement.total_amount)}원</Text>
            </View>
          </View>

          {/* 비고 */}
          {statement.notes && (
            <View style={s.notes}>
              <Text>비고: {statement.notes}</Text>
            </View>
          )}

          {/* 은행 정보 */}
          {companyInfo?.bank_name && companyInfo?.bank_account && (
            <View style={s.bankInfo}>
              <Text>입금계좌: {companyInfo.bank_name} {companyInfo.bank_account}</Text>
            </View>
          )}

          <Text style={s.footer}>
            위 금액을 명세서와 같이 거래합니다.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
