import { createClient } from "@/lib/supabase/server";
import { getAccountingCompanies } from "@/lib/company-scope";

export async function getLoadCompanies() {
  return getAccountingCompanies(await createClient());
}
