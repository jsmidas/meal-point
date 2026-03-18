"use client";

import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from "@react-pdf/renderer";
import type { QuoteWithItems, CompanyInfo } from "@/lib/supabase/types";

Font.register({
  family: "NotoSansKR",
  fonts: [
    { src: "https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLTq8H4hfaN.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuozb7Tq8H4hfaN.ttf", fontWeight: 700 },
  ],
});

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansKR", fontSize: 9, padding: 40, color: "#111" },
  title: { fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 20, letterSpacing: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, fontSize: 8 },
  infoGrid: { flexDirection: "row", gap: 8, marginBottom: 14 },
  infoBox: { flex: 1, border: "1px solid #ccc", padding: 8 },
  infoTitle: { fontWeight: 700, textAlign: "center", backgroundColor: "#f3f4f6", padding: 4, marginBottom: 6, fontSize: 9 },
  infoRow: { flexDirection: "row", marginBottom: 3 },
  infoLabel: { width: 52, color: "#666", fontSize: 8 },
  infoValue: { flex: 1, fontSize: 8 },
  summaryRow: { flexDirection: "row", border: "1px solid #ccc", marginBottom: 14, textAlign: "center" },
  summaryCell: { flex: 1, padding: 6, borderRight: "1px solid #ccc" },
  summaryCellLast: { flex: 1, padding: 6 },
  summaryLabel: { fontSize: 7, color: "#666", marginBottom: 2 },
  summaryValue: { fontWeight: 700, fontSize: 10 },
  table: { marginBottom: 14 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", borderTop: "1px solid #ccc", borderBottom: "1px solid #ccc" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee" },
  cellNo: { width: 24, padding: 4, textAlign: "center", borderRight: "1px solid #eee" },
  cellName: { flex: 3, padding: 4, borderRight: "1px solid #eee" },
  cellSpec: { flex: 2, padding: 4, borderRight: "1px solid #eee" },
  cellUnit: { width: 36, padding: 4, textAlign: "center", borderRight: "1px solid #eee" },
  cellQty: { width: 44, padding: 4, textAlign: "right", borderRight: "1px solid #eee" },
  cellPrice: { width: 60, padding: 4, textAlign: "right", borderRight: "1px solid #eee" },
  cellAmount: { width: 68, padding: 4, textAlign: "right" },
  footer: { textAlign: "center", fontSize: 8, color: "#999", marginTop: 20 },
});

function fmt(n: number) { return n.toLocaleString("ko-KR"); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("ko-KR"); }

interface Props { quote: QuoteWithItems; companyInfo: CompanyInfo | null; }

export default function QuotePdf({ quote, companyInfo }: Props) {
  const c = quote.companies;
  const items = quote.quote_items;
  const emptyRows = Math.max(0, 10 - items.length);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {companyInfo?.logo_image_url && (
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <Image src={companyInfo.logo_image_url} style={{ height: 40, objectFit: "contain" }} />
          </View>
        )}
        <Text style={s.title}>견 적 서</Text>
        <View style={s.headerRow}>
          <Text>작성일: {fmtDate(quote.quote_date)}</Text>
          <Text>No. {quote.quote_number}{quote.valid_until ? ` | 유효기간: ${fmtDate(quote.valid_until)}` : ""}</Text>
        </View>

        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>공급자</Text>
            {companyInfo ? (<>
              <View style={s.infoRow}><Text style={s.infoLabel}>상호</Text><Text style={{...s.infoValue, fontWeight: 700}}>{companyInfo.name}</Text></View>
              <View style={s.infoRow}><Text style={s.infoLabel}>대표자</Text><Text style={s.infoValue}>{companyInfo.ceo_name}</Text></View>
              <View style={s.infoRow}><Text style={s.infoLabel}>사업자번호</Text><Text style={s.infoValue}>{companyInfo.biz_number}</Text></View>
              <View style={s.infoRow}><Text style={s.infoLabel}>업태/종목</Text><Text style={s.infoValue}>{companyInfo.biz_type} / {companyInfo.biz_category}</Text></View>
              <View style={s.infoRow}><Text style={s.infoLabel}>주소</Text><Text style={s.infoValue}>{companyInfo.address}</Text></View>
              <View style={s.infoRow}><Text style={s.infoLabel}>연락처</Text><Text style={s.infoValue}>{companyInfo.phone}</Text></View>
            </>) : <Text style={{fontSize: 8, color: "#999"}}>공급자 정보 미등록</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>공급받는자</Text>
            <View style={s.infoRow}><Text style={s.infoLabel}>상호</Text><Text style={{...s.infoValue, fontWeight: 700}}>{c.name}</Text></View>
            <View style={s.infoRow}><Text style={s.infoLabel}>대표자</Text><Text style={s.infoValue}>{c.ceo_name}</Text></View>
            <View style={s.infoRow}><Text style={s.infoLabel}>사업자번호</Text><Text style={s.infoValue}>{c.biz_number}</Text></View>
            <View style={s.infoRow}><Text style={s.infoLabel}>업태/종목</Text><Text style={s.infoValue}>{c.biz_type || "—"} / {c.biz_category || "—"}</Text></View>
            <View style={s.infoRow}><Text style={s.infoLabel}>주소</Text><Text style={s.infoValue}>{c.address || "—"}</Text></View>
            <View style={s.infoRow}><Text style={s.infoLabel}>연락처</Text><Text style={s.infoValue}>{c.phone || "—"}</Text></View>
          </View>
        </View>

        <View style={s.summaryRow}>
          <View style={s.summaryCell}><Text style={s.summaryLabel}>공급가액</Text><Text style={s.summaryValue}>{fmt(quote.supply_amount)}원</Text></View>
          <View style={s.summaryCell}><Text style={s.summaryLabel}>세액</Text><Text style={s.summaryValue}>{fmt(quote.tax_amount)}원</Text></View>
          <View style={s.summaryCellLast}><Text style={s.summaryLabel}>합계금액</Text><Text style={{...s.summaryValue, fontSize: 12}}>{fmt(quote.total_amount)}원</Text></View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={s.cellNo}>No</Text><Text style={s.cellName}>품목</Text><Text style={s.cellSpec}>규격</Text>
            <Text style={s.cellUnit}>단위</Text><Text style={s.cellQty}>수량</Text><Text style={s.cellPrice}>단가</Text><Text style={s.cellAmount}>금액</Text>
          </View>
          {items.map((item, i) => (
            <View key={item.id} style={s.tableRow}>
              <Text style={s.cellNo}>{i+1}</Text><Text style={s.cellName}>{item.product_name}</Text>
              <Text style={s.cellSpec}>{item.specification || ""}</Text><Text style={s.cellUnit}>{item.unit}</Text>
              <Text style={s.cellQty}>{fmt(item.quantity)}</Text><Text style={s.cellPrice}>{fmt(item.unit_price)}</Text>
              <Text style={s.cellAmount}>{fmt(item.amount)}</Text>
            </View>
          ))}
          {Array.from({length: emptyRows}).map((_, i) => (
            <View key={`e-${i}`} style={s.tableRow}>
              <Text style={s.cellNo}>{items.length+i+1}</Text><Text style={s.cellName}> </Text><Text style={s.cellSpec}> </Text>
              <Text style={s.cellUnit}> </Text><Text style={s.cellQty}> </Text><Text style={s.cellPrice}> </Text><Text style={s.cellAmount}> </Text>
            </View>
          ))}
        </View>

        {quote.notes && <View style={{border: "1px solid #ccc", padding: 6, fontSize: 8, marginBottom: 14}}><Text>비고: {quote.notes}</Text></View>}
        <Text style={s.footer}>위 금액으로 견적합니다.</Text>
      </Page>
    </Document>
  );
}
