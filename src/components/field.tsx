import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "mt-1.5 h-10 w-full rounded-xl border border-[#dfe1ed] bg-white px-3 text-sm text-[#24263a] shadow-sm outline-none transition placeholder:text-[#9a9caf] hover:border-[#b9bbcd] focus:border-[#6757e8] focus:ring-2 focus:ring-[#dcd7ff]/70";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("field-label block text-[13px] font-semibold text-[#45475d]", className)}>
      {label}
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "min-h-24 py-2", className)} />;
}

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-center gap-2.5 text-sm font-medium text-[#45475d]">
      <input type="checkbox" className="size-4 rounded border-[#dfe1ed] text-[#6757e8] focus:ring-[#6757e8]" {...props} />
      {label}
    </label>
  );
}
