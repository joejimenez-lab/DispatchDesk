import type { Metadata } from "next";
import { DispatchAssistant } from "@/components/dispatch-assistant";
import { requireAiAssistantPageAccess } from "@/lib/ai-assistant/access";

export const metadata: Metadata = {
  title: "Dispatch Assistant beta",
  description: "Private read-only operations assistant for DispatchDesk.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function AIAssistantPage() {
  await requireAiAssistantPageAccess();
  return <DispatchAssistant />;
}
