import Link from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const styles =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6757e8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }
>(function Button({ className, variant = "primary", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        styles,
        variant === "primary" && "bg-[#6757e8] text-white shadow-[0_8px_18px_rgba(103,87,232,0.18)] hover:bg-[#5143c2]",
        variant === "secondary" && "border border-[#dfe1ed] bg-white text-[#45475d] shadow-sm hover:border-[#b9bbcd] hover:bg-[#f7f6fc]",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...props}
    />
  );
});

export function LinkButton({
  className,
  variant = "primary",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
}) {
  return (
    <Link
      className={cn(
        styles,
        variant === "primary" && "bg-[#6757e8] text-white shadow-[0_8px_18px_rgba(103,87,232,0.18)] hover:bg-[#5143c2]",
        variant === "secondary" && "border border-[#dfe1ed] bg-white text-[#45475d] shadow-sm hover:border-[#b9bbcd] hover:bg-[#f7f6fc]",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
