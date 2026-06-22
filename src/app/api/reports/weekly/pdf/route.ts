import { NextResponse } from "next/server";
import { getWeeklyDriverFinancialSummary, type WeeklyFinancialPeriod } from "@/lib/data/weekly-financials";
import { createClient } from "@/lib/supabase/server";
import { renderWeeklySummaryPdf } from "@/lib/weekly-summary-pdf";

export const runtime = "nodejs";

const PERIODS: WeeklyFinancialPeriod[] = ["this", "last", "all", "custom"];

function normalizePeriod(value: string | null): WeeklyFinancialPeriod {
  return PERIODS.includes(value as WeeklyFinancialPeriod) ? (value as WeeklyFinancialPeriod) : "all";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const { summaries, range } = await getWeeklyDriverFinancialSummary({
      period: normalizePeriod(searchParams.get("period")),
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      driver: searchParams.get("driver") ?? undefined,
    });
    const pdf = await renderWeeklySummaryPdf(summaries, range);
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dispatchdesk-financial-summary-${stamp}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not create PDF report." }, { status: 500 });
  }
}
