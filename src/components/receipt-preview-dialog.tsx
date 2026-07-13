"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/button";

type ReceiptPreviewDialogProps = {
  fileName: string;
  viewHref: string;
};

function receiptPreviewType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "heic", "heif"].includes(extension ?? "")) return "image";
  return "file";
}

export function ReceiptPreviewDialog({ fileName, viewHref }: ReceiptPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewType = useMemo(() => receiptPreviewType(fileName), [fileName]);

  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (!open || !dialogNode) return;

    const triggerNode = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogNode.showModal();
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialogNode.open) dialogNode.close();
      triggerNode?.focus();
    };
  }, [open]);

  return (
    <>
      <Button ref={triggerRef} type="button" variant="secondary" onClick={() => setOpen(true)}>
        View
      </Button>

      {open ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          className="fixed inset-0 m-auto max-h-[calc(100vh-1.5rem)] w-[calc(100%-1.5rem)] max-w-5xl overflow-hidden rounded-lg bg-white p-0 shadow-2xl backdrop:bg-zinc-950/65 sm:max-h-[min(48rem,calc(100vh-3rem))] sm:w-[calc(100%-3rem)]"
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
        >
          <div className="flex max-h-[inherit] min-h-0 flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 id={titleId} className="truncate text-base font-semibold text-zinc-950">
                  {fileName}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">Receipt preview</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={viewHref}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open receipt in new tab"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  <ExternalLink aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">Open in new tab</span>
                </a>
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Close receipt preview"
                  className="inline-flex size-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
                  onClick={() => setOpen(false)}
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 bg-zinc-100 p-3 sm:p-4">
              {previewType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewHref}
                  alt={`Receipt preview for ${fileName}`}
                  className="mx-auto max-h-[calc(100vh-10rem)] max-w-full rounded-md bg-white object-contain shadow-sm"
                />
              ) : null}
              {previewType === "pdf" ? (
                <iframe
                  src={viewHref}
                  title={`Receipt preview for ${fileName}`}
                  className="h-[calc(100vh-10rem)] min-h-96 w-full rounded-md border border-zinc-200 bg-white"
                />
              ) : null}
              {previewType === "file" ? (
                <div className="flex min-h-96 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white p-6 text-center">
                  <div>
                    <p className="text-sm font-medium text-zinc-950">Preview is not available for this file type.</p>
                    <p className="mt-1 text-sm text-zinc-500">Open it in a new tab or download it to view the receipt.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
