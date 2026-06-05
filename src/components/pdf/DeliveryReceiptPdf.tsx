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

// 에메랄드 그린 테마 색상 (거래명세서와 동일)
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
  logoChip: {
    backgroundColor: "white",
    borderRadius: 4,
    padding: "4 8",
    marginBottom: 8,
    alignSelf: "flex-start",
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
  // 총 수량 박스 (금액 대신)
  totalBox: {
    border: `1.5px solid ${GREEN_BORDER}`,
    padding: "12 20",
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
    fontSize: 18,
    fontWeight: 700,
    color: GREEN,
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
  // 컬럼 너비 (단가/금액 제거 → 품목·규격을 넓게)
  colNo: { width: 28 },
  colName: { flex: 4 },
  colSpec: { flex: 3 },
  colUnit: { width: 50 },
  colQty: { width: 70 },
  // 총 수량 행
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
    width: 70,
    textAlign: "right",
    paddingRight: 4,
  },
  // 비고
  notes: {
    border: `1px solid ${GRAY_BORDER}`,
    padding: "6 8",
    fontSize: 8,
    marginTop: 12,
    color: MUTED,
  },
  // 인수확인란
  receiptBox: {
    border: `1px solid ${GREEN_BORDER}`,
    backgroundColor: GREEN_BG,
    padding: "10 14",
    marginTop: 16,
  },
  receiptTitle: {
    fontSize: 8,
    color: GREEN,
    fontWeight: 700,
    marginBottom: 8,
  },
  receiptRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
  },
  receiptField: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  receiptFieldLabel: {
    fontSize: 8,
    color: MUTED,
  },
  receiptLineWide: {
    borderBottom: `0.7px solid ${MUTED}`,
    width: 150,
    height: 14,
  },
  receiptLine: {
    borderBottom: `0.7px solid ${MUTED}`,
    width: 90,
    height: 14,
  },
  // 푸터
  footer: {
    textAlign: "center",
    fontSize: 8,
    color: GREEN,
    marginTop: 16,
    fontWeight: 700,
  },
});

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

interface Props {
  statement: StatementWithItems;
  companyInfo: CompanyInfo | null;
}

export default function DeliveryReceiptPdf({ statement, companyInfo }: Props) {
  const c = statement.companies;
  const items = statement.statement_items;
  const emptyRows = Math.max(0, 12 - items.length);
  const dateStr = statement.statement_date.replace(/-/g, ". ") + ".";
  const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* 상단 에메랄드 헤더 */}
        <View style={s.header}>
          <View>
            {companyInfo?.logo_image_url && (
              <View style={s.logoChip}>
                <Image src={companyInfo.logo_image_url} style={{ height: 24, objectFit: "contain" }} />
              </View>
            )}
            <Text style={s.headerTitle}>인 수 증</Text>
            <Text style={s.headerSub}>DELIVERY RECEIPT</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerNumber}>{statement.statement_number}</Text>
            <Text style={s.headerDate}>{dateStr}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* 총 수량 */}
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>총 수량 / 품목 수</Text>
            <Text style={s.totalAmount}>{fmt(totalQty)} / {items.length}건</Text>
          </View>

          {/* 공급자 / 인수처 */}
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
                      <Text style={s.infoLabel}>주소</Text>
                      <Text style={s.infoValue}>{companyInfo.address}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>연락처</Text>
                      <Text style={s.infoValue}>{companyInfo.phone}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={{ fontSize: 8, color: "#999" }}>공급자 정보 미등록</Text>
                )}
              </View>
            </View>
            <View style={s.infoBox}>
              <Text style={s.infoTitleReceiver}>인수처 (배송지)</Text>
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

          {/* 품목 테이블 (단가/금액 없음) */}
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={{ ...s.tableHeaderCell, ...s.colNo }}>No</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colName, textAlign: "left" }}>품목</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colSpec, textAlign: "left" }}>규격</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colUnit }}>단위</Text>
              <Text style={{ ...s.tableHeaderCell, ...s.colQty, textAlign: "right" }}>수량</Text>
            </View>
            {items.map((item, i) => (
              <View key={item.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                <Text style={{ ...s.cell, ...s.colNo }}>{i + 1}</Text>
                <Text style={{ ...s.cellLeft, ...s.colName, fontWeight: 700 }}>{item.product_name}</Text>
                <Text style={{ ...s.cellLeft, ...s.colSpec }}>{item.specification || ""}</Text>
                <Text style={{ ...s.cell, ...s.colUnit }}>{item.unit}</Text>
                <Text style={{ ...s.cellRight, ...s.colQty }}>{fmt(item.quantity)}</Text>
              </View>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <View key={`e-${i}`} style={(items.length + i) % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                <Text style={{ ...s.cell, ...s.colNo, color: "#d1d5db" }}>{items.length + i + 1}</Text>
                <Text style={{ ...s.cellLeft, ...s.colName }}> </Text>
                <Text style={{ ...s.cellLeft, ...s.colSpec }}> </Text>
                <Text style={{ ...s.cell, ...s.colUnit }}> </Text>
                <Text style={{ ...s.cellRight, ...s.colQty }}> </Text>
              </View>
            ))}
            {/* 총 수량 행 */}
            <View style={s.totalRow}>
              <Text style={s.totalRowLabel}>총 수량</Text>
              <Text style={s.totalRowValue}>{fmt(totalQty)}</Text>
            </View>
          </View>

          {/* 비고 */}
          {statement.notes && (
            <View style={s.notes}>
              <Text>비고: {statement.notes}</Text>
            </View>
          )}

          {/* 인수확인란 */}
          <View style={s.receiptBox}>
            <Text style={s.receiptTitle}>위 물품을 정히 인수하였음을 확인합니다.</Text>
            <View style={s.receiptRow}>
              <View style={s.receiptField}>
                <Text style={s.receiptFieldLabel}>인수일자</Text>
                <View style={s.receiptLine} />
              </View>
              <View style={s.receiptField}>
                <Text style={s.receiptFieldLabel}>인수자</Text>
                <View style={s.receiptLineWide} />
              </View>
              <View style={s.receiptField}>
                <Text style={s.receiptFieldLabel}>(서명)</Text>
                <View style={s.receiptLine} />
              </View>
            </View>
          </View>

          <Text style={s.footer}>
            위 품목을 인수증과 같이 전달합니다.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
