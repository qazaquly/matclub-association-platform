import { authenticateRequest } from "@/lib/auth";
import { canExportReports } from "@/lib/authorization";
import { buildReport, normalizeReportFilters } from "@/db/reports";
import { reportPdf, reportXlsx } from "@/lib/report-export";

export async function GET(request: Request) {
  const actor = await authenticateRequest(request);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (!canExportReports(actor)) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const filters = normalizeReportFilters(Object.fromEntries(url.searchParams));
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const report = await buildReport(actor, filters);
  const body = format === "pdf" ? await reportPdf(report) : reportXlsx(report);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="matclub-${report.kind}-${date}.${format}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
