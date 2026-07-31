import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

export type BusinessReportMetric = {
  label: string;
  value: string;
};

export type BusinessReportColumn = {
  label: string;
  width: string;
  align?: "left" | "right";
};

export type BusinessReportPdfData = {
  title: string;
  subtitle: string;
  metrics: BusinessReportMetric[];
  columns: BusinessReportColumn[];
  rows: string[][];
  emptyMessage: string;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#f8fafc",
    color: "#18181b",
    fontFamily: "Helvetica",
    fontSize: 8,
    paddingTop: 34,
    paddingRight: 34,
    paddingBottom: 46,
    paddingLeft: 34,
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  brand: { color: "#2563eb", fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1.1, marginBottom: 7 },
  title: { color: "#172554", fontSize: 21, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  subtitle: { color: "#64748b", fontSize: 8.5 },
  generated: { color: "#64748b", fontSize: 7.5, textAlign: "right", lineHeight: 1.45 },
  metrics: { flexDirection: "row", gap: 8, marginBottom: 18 },
  metric: { flexGrow: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 5, backgroundColor: "#ffffff", padding: 9 },
  metricLabel: { color: "#64748b", fontSize: 6.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, marginBottom: 5 },
  metricValue: { color: "#172554", fontSize: 13, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, overflow: "hidden", backgroundColor: "#ffffff" },
  row: { flexDirection: "row", minHeight: 24, alignItems: "center", paddingHorizontal: 7, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  rowLast: { borderBottomWidth: 0 },
  tableHeader: { minHeight: 25, backgroundColor: "#172554" },
  headerText: { color: "#ffffff", fontSize: 6.4, fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },
  cell: { color: "#334155", fontSize: 7.2, lineHeight: 1.25, paddingRight: 5 },
  right: { textAlign: "right" },
  empty: { color: "#64748b", padding: 16, textAlign: "center" },
  footer: { position: "absolute", left: 34, right: 34, bottom: 20, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 6 },
  footerText: { color: "#64748b", fontSize: 6.8 },
});

const generatedFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

export function BusinessReportPdf({
  data,
  generatedAt = new Date(),
}: {
  data: BusinessReportPdfData;
  generatedAt?: Date;
}) {
  const landscape = data.columns.length > 5;

  return (
    <Document title={`DispatchDesk ${data.title}`} author="DispatchDesk" subject={data.subtitle}>
      <Page size="LETTER" orientation={landscape ? "landscape" : "portrait"} style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>DISPATCHDESK</Text>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.subtitle}>{data.subtitle}</Text>
          </View>
          <Text style={styles.generated}>PREPARED{`\n`}{generatedFormatter.format(generatedAt)}</Text>
        </View>

        {data.metrics.length ? (
          <View style={styles.metrics} wrap={false}>
            {data.metrics.map((metric) => (
              <View key={metric.label} style={styles.metric}>
                <Text style={styles.metricLabel}>{metric.label.toUpperCase()}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.table}>
          <View style={[styles.row, styles.tableHeader]} fixed>
            {data.columns.map((column) => (
              <Text
                key={column.label}
                style={[styles.headerText, { width: column.width }, column.align === "right" ? styles.right : {}]}
              >
                {column.label.toUpperCase()}
              </Text>
            ))}
          </View>
          {data.rows.length ? data.rows.map((row, rowIndex) => (
            <View key={`${rowIndex}:${row.join(":")}`} style={[styles.row, rowIndex === data.rows.length - 1 ? styles.rowLast : {}]} wrap={false}>
              {data.columns.map((column, columnIndex) => (
                <Text
                  key={`${column.label}:${columnIndex}`}
                  style={[styles.cell, { width: column.width }, column.align === "right" ? styles.right : {}]}
                >
                  {row[columnIndex] || "—"}
                </Text>
              ))}
            </View>
          )) : <Text style={styles.empty}>{data.emptyMessage}</Text>}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>DispatchDesk - Internal business report</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function renderBusinessReportPdf(data: BusinessReportPdfData, generatedAt = new Date()) {
  return renderToBuffer(<BusinessReportPdf data={data} generatedAt={generatedAt} />);
}
