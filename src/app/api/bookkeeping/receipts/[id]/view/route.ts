import { NextResponse } from "next/server";
import { documentViewHeaders } from "@/lib/document-security";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";
import type { Database } from "@/types/database";

const receiptBucket = "bookkeeping-receipts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const auth = await createAuthenticatedRouteClient({
    method: request.method,
    path: url.pathname,
    route: "/api/bookkeeping/receipts/[id]/view",
    kind: "api",
  });
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { data: receipt, error } = await supabase
    .from("bookkeeping_receipts")
    .select("file_name, storage_path")
    .eq("id", id)
    .single();

  if (error || !receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

  const row = receipt as Database["public"]["Tables"]["bookkeeping_receipts"]["Row"];
  const file = await supabase.storage.from(receiptBucket).download(row.storage_path);
  if (file.error) return NextResponse.json({ error: file.error.message }, { status: 500 });

  return new Response(await file.data.arrayBuffer(), {
    headers: documentViewHeaders(row.file_name, file.data.type),
  });
}
