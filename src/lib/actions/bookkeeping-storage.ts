import { validateUploadedDocument } from "@/lib/document-security";
import { logError } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

export const bookkeepingReceiptBucket = "bookkeeping-receipts";

type AuthenticatedSupabase = SupabaseClient<Database>;

export type PreparedReceipt = {
  metadata: Json;
  storagePath: string;
};

export function optionalReceipt(formData: FormData) {
  const file = formData.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}

export async function prepareBookkeepingReceipt(
  supabase: AuthenticatedSupabase,
  groupId: string,
  formData: FormData,
  options: { idempotencyKey?: string } = {},
): Promise<PreparedReceipt | null> {
  const file = optionalReceipt(formData);
  if (!file) return null;
  const document = await validateUploadedDocument(file);
  const storagePath = `${groupId}/${options.idempotencyKey ?? crypto.randomUUID()}-${document.safeName}`;
  const { error } = await supabase.storage.from(bookkeepingReceiptBucket).upload(storagePath, file, {
    contentType: document.mimeType,
    upsert: Boolean(options.idempotencyKey),
  });
  if (error) throw error;
  return {
    storagePath,
    metadata: {
      file_name: file.name,
      storage_path: storagePath,
      content_type: document.mimeType,
      file_size: file.size,
    },
  };
}

export async function compensateReceiptUpload(
  supabase: AuthenticatedSupabase,
  prepared: PreparedReceipt | null,
  cause: unknown,
) {
  if (!prepared) return;
  const { error } = await supabase.storage.from(bookkeepingReceiptBucket).remove([prepared.storagePath]);
  if (!error) return;
  logError("bookkeeping.receipt.compensation_failed", error, { storagePath: prepared.storagePath, cause });
  await supabase.from("storage_cleanup_jobs").insert({
    bucket_id: bookkeepingReceiptBucket,
    storage_path: prepared.storagePath,
    source: "upload_receipt",
    last_error: error instanceof Error ? error.message : String(error),
    last_attempted_at: new Date().toISOString(),
  });
}

export type ReceiptCleanupJob = {
  job_id: string;
  bucket_id: string;
  storage_path: string;
  expense_group_id: string;
};

export async function removeReceiptCleanupJobs(supabase: AuthenticatedSupabase, jobs: ReceiptCleanupJob[]) {
  if (!jobs.length) return null;
  const pathsByBucket = new Map<string, string[]>();
  for (const job of jobs) pathsByBucket.set(job.bucket_id, [...(pathsByBucket.get(job.bucket_id) ?? []), job.storage_path]);
  for (const [bucket, paths] of pathsByBucket) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      await supabase.from("storage_cleanup_jobs").update({
        last_error: error instanceof Error ? error.message : String(error),
        last_attempted_at: new Date().toISOString(),
      }).in("id", jobs.map((job) => job.job_id));
      return error;
    }
  }
  const { error } = await supabase.from("storage_cleanup_jobs").delete().in("id", jobs.map((job) => job.job_id));
  return error;
}
