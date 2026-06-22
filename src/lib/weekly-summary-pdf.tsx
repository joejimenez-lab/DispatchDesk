import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { WeeklyDriverFinancialSummary, WeeklyFinancialRange } from "./data/weekly-financials";

const colors = {
  ink: "#18181b",
  muted: "#64748b",
  line: "#e2e8f0",
  paper: "#ffffff",
  canvas: "#f8fafc",
  navy: "#172554",
  blue: "#2563eb",
  blueSoft: "#dbeafe",
  green: "#15803d",
  greenSoft: "#dcfce7",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 38,
    paddingRight: 40,
    paddingBottom: 48,
    paddingLeft: 40,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 },
  brand: { color: colors.blue, fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, marginBottom: 8 },
  title: { color: colors.navy, fontSize: 23, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  subtitle: { color: colors.muted, fontSize: 9.5 },
  generated: { color: colors.muted, fontSize: 8, textAlign: "right", lineHeight: 1.5 },
  metrics: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  metric: { width: "23.5%", borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: 11 },
  metricAccent: { backgroundColor: colors.greenSoft, borderColor: "#bbf7d0" },
  metricLabel: { color: colors.muted, fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.7, marginBottom: 7 },
  metricValue: { color: colors.navy, fontSize: 15, fontFamily: "Helvetica-Bold" },
  metricValueAccent: { color: colors.green },
  section: { marginBottom: 22 },
  sectionHeading: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
  sectionRule: { width: 4, height: 14, borderRadius: 2, backgroundColor: colors.blue, marginRight: 7 },
  sectionTitle: { color: colors.navy, fontSize: 12, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: 5, overflow: "hidden", backgroundColor: colors.paper },
  row: { flexDirection: "row", minHeight: 25, alignItems: "center", paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLast: { borderBottomWidth: 0 },
  tableHeader: { minHeight: 27, backgroundColor: colors.navy },
  headerText: { color: "#ffffff", fontSize: 6.8, fontFamily: "Helvetica-Bold", letterSpacing: 0.25 },
  cell: { fontSize: 8, color: "#334155" },
  cellStrong: { color: colors.ink, fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  empty: { color: colors.muted, fontSize: 9, padding: 16, textAlign: "center" },
  note: { color: colors.muted, fontSize: 7.5, lineHeight: 1.45, marginTop: 9 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 22, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7 },
  footerText: { color: colors.muted, fontSize: 7 },
});

const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "America/Los_Angeles" });

function money(value: number) {
  return moneyFormatter.format(value);
}

function dateLabel(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

function rangeLabel(range: WeeklyFinancialRange) {
  if (range.from && range.to) return `${dateLabel(range.from)} - ${dateLabel(range.to)}`;
  if (range.from) return `From ${dateLabel(range.from)}`;
  if (range.to) return `Through ${dateLabel(range.to)}`;
  return "All available dates";
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.metric, accent ? styles.metricAccent : {}]}>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.metricValue, accent ? styles.metricValueAccent : {}]}>{value}</Text>
    </View>
  );
}

type Column = { label: string; width: string; right?: boolean };

function TableHeader({ columns }: { columns: Column[] }) {
  return (
    <View style={[styles.row, styles.tableHeader]} fixed>
      {columns.map((column) => (
        <Text key={column.label} style={[styles.headerText, { width: column.width }, column.right ? styles.right : {}]}>{column.label}</Text>
      ))}
    </View>
  );
}

export function WeeklySummaryPdf({
  summaries,
  range,
  generatedAt = new Date(),
}: {
  summaries: WeeklyDriverFinancialSummary[];
  range: WeeklyFinancialRange;
  generatedAt?: Date;
}) {
  const totals = summaries.reduce(
    (result, summary) => ({
      loads: result.loads + summary.loadCount,
      revenue: result.revenue + summary.loadRateTotal,
      driverPay: result.driverPay + summary.driverPayTotal,
      dispatcherFees: result.dispatcherFees + summary.dispatcherFeeTotal,
      fuel: result.fuel + summary.fuelCostTotal,
      profit: result.profit + summary.estimatedProfitTotal,
    }),
    { loads: 0, revenue: 0, driverPay: 0, dispatcherFees: 0, fuel: 0, profit: 0 },
  );

  const weeks = new Map<string, typeof totals & { weekEnd: string }>();
  const drivers = new Map<string, { name: string; loads: number; pay: number; revenue: number }>();
  for (const summary of summaries) {
    const week = weeks.get(summary.weekStart) ?? { loads: 0, revenue: 0, driverPay: 0, dispatcherFees: 0, fuel: 0, profit: 0, weekEnd: summary.weekEnd };
    week.loads += summary.loadCount;
    week.revenue += summary.loadRateTotal;
    week.driverPay += summary.driverPayTotal;
    week.dispatcherFees += summary.dispatcherFeeTotal;
    week.fuel += summary.fuelCostTotal;
    week.profit += summary.estimatedProfitTotal;
    weeks.set(summary.weekStart, week);

    const driverKey = summary.driverId ?? "unassigned";
    const driver = drivers.get(driverKey) ?? { name: summary.driverName, loads: 0, pay: 0, revenue: 0 };
    driver.loads += summary.loadCount;
    driver.pay += summary.driverPayTotal;
    driver.revenue += summary.loadRateTotal;
    drivers.set(driverKey, driver);
  }

  const weeklyRows = [...weeks.entries()].sort(([a], [b]) => b.localeCompare(a));
  const driverRows = [...drivers.entries()].sort(([, a], [, b]) => b.pay - a.pay || a.name.localeCompare(b.name));
  const margin = totals.revenue ? (totals.profit / totals.revenue) * 100 : 0;

  const weeklyColumns: Column[] = [
    { label: "WEEK", width: "23%" },
    { label: "LOADS", width: "9%", right: true },
    { label: "REVENUE", width: "17%", right: true },
    { label: "DRIVER PAY", width: "17%", right: true },
    { label: "OTHER COSTS", width: "17%", right: true },
    { label: "PROFIT", width: "17%", right: true },
  ];
  const driverColumns: Column[] = [
    { label: "DRIVER", width: "42%" },
    { label: "LOADS", width: "16%", right: true },
    { label: "LOAD REVENUE", width: "21%", right: true },
    { label: "GROSS PAY", width: "21%", right: true },
  ];

  return (
    <Document title="DispatchDesk Weekly Financial Summary" author="DispatchDesk" subject={rangeLabel(range)}>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>DISPATCHDESK</Text>
            <Text style={styles.title}>Financial Summary</Text>
            <Text style={styles.subtitle}>{rangeLabel(range)}</Text>
          </View>
          <Text style={styles.generated}>PREPARED{`\n`}{dateFormatter.format(generatedAt)}</Text>
        </View>

        <View style={styles.metrics} wrap={false}>
          <Metric label="Loads" value={String(totals.loads)} />
          <Metric label="Revenue" value={money(totals.revenue)} />
          <Metric label="Total costs" value={money(totals.driverPay + totals.dispatcherFees + totals.fuel)} />
          <Metric label="Est. profit" value={money(totals.profit)} accent />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading} wrap={false} minPresenceAhead={60}>
            <View style={styles.sectionRule} />
            <Text style={styles.sectionTitle}>Weekly performance</Text>
          </View>
          <View style={styles.table}>
            <TableHeader columns={weeklyColumns} />
            {weeklyRows.length ? weeklyRows.map(([weekStart, week], index) => (
              <View key={weekStart} style={[styles.row, index === weeklyRows.length - 1 ? styles.rowLast : {}]} wrap={false}>
                <Text style={[styles.cell, styles.cellStrong, { width: "23%" }]}>{dateLabel(weekStart)} - {dateLabel(week.weekEnd)}</Text>
                <Text style={[styles.cell, styles.right, { width: "9%" }]}>{week.loads}</Text>
                <Text style={[styles.cell, styles.right, { width: "17%" }]}>{money(week.revenue)}</Text>
                <Text style={[styles.cell, styles.right, { width: "17%" }]}>{money(week.driverPay)}</Text>
                <Text style={[styles.cell, styles.right, { width: "17%" }]}>{money(week.dispatcherFees + week.fuel)}</Text>
                <Text style={[styles.cell, styles.cellStrong, styles.right, { width: "17%" }]}>{money(week.profit)}</Text>
              </View>
            )) : <Text style={styles.empty}>No reportable loads in this period.</Text>}
          </View>
        </View>

        <View style={styles.section} break={weeklyRows.length > 15}>
          <View style={styles.sectionHeading} wrap={false} minPresenceAhead={60}>
            <View style={styles.sectionRule} />
            <Text style={styles.sectionTitle}>Driver payroll summary</Text>
          </View>
          <View style={styles.table}>
            <TableHeader columns={driverColumns} />
            {driverRows.length ? driverRows.map(([driverKey, driver], index) => (
              <View key={driverKey} style={[styles.row, index === driverRows.length - 1 ? styles.rowLast : {}]} wrap={false}>
                <Text style={[styles.cell, styles.cellStrong, { width: "42%" }]}>{driver.name}</Text>
                <Text style={[styles.cell, styles.right, { width: "16%" }]}>{driver.loads}</Text>
                <Text style={[styles.cell, styles.right, { width: "21%" }]}>{money(driver.revenue)}</Text>
                <Text style={[styles.cell, styles.cellStrong, styles.right, { width: "21%" }]}>{money(driver.pay)}</Text>
              </View>
            )) : <Text style={styles.empty}>No driver payroll in this period.</Text>}
          </View>
          <Text style={styles.note}>Estimated profit is revenue less driver pay, dispatcher fees, and recorded fuel costs. Profit margin for this period: {margin.toFixed(1)}%.</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>DispatchDesk - Internal business report</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderWeeklySummaryPdf(
  summaries: WeeklyDriverFinancialSummary[],
  range: WeeklyFinancialRange,
  generatedAt = new Date(),
) {
  return renderToBuffer(<WeeklySummaryPdf summaries={summaries} range={range} generatedAt={generatedAt} />);
}
