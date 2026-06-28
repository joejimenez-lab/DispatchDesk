import { NextResponse } from "next/server";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";
import type { Database } from "@/types/database";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const auth = await createAuthenticatedRouteClient({
    method: request.method,
    path: url.pathname,
    route: "/api/documents/[id]/download",
    kind: "api",
  });
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  const { data: document, error } = await supabase
    .from("documents")
    .select("file_name, storage_path")
    .eq("id", id)
    .single();

  if (error || !document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const row = document as Database["public"]["Tables"]["documents"]["Row"];
  const file = await supabase.storage.from("load-documents").download(row.storage_path);
  if (file.error) return NextResponse.json({ error: file.error.message }, { status: 500 });

  return new Response(await file.data.arrayBuffer(), {
    headers: {
      "Content-Type": file.data.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${row.file_name.replaceAll('"', "")}"`,
    },
  });
}
