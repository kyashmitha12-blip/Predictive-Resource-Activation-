import { X } from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";

/** Modal built on the native <dialog>: focus trapping, Escape to close and inert background come from the browser. */
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
    if (!open && d.open) { if (d.close) d.close(); else d.removeAttribute("open"); }
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dlg-title"
      className="m-auto w-[min(92vw,540px)] rounded-panel-lg border border-line bg-white p-0 text-ink shadow-lift-lg backdrop:bg-night/60 backdrop:backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line/80 px-6 py-4.5">
        <h2 id="dlg-title" className="text-lg font-bold tracking-tight text-ink">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-full p-1.5 text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2.5 border-t border-line/70 bg-paper-2/30 px-6 py-3.5">{footer}</div>}
    </dialog>
  );
}
