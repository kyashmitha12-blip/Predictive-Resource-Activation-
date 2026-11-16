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
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="dlg-title"
      className="m-auto w-[min(92vw,520px)] rounded-panel border border-line bg-white p-0 text-ink shadow-lift backdrop:bg-night/50">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <h2 id="dlg-title" className="text-lg">{title}</h2>
        <button onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-ink-3 hover:bg-paper-2 hover:text-ink"><X className="h-5 w-5" /></button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper px-5 py-3">{footer}</div>}
    </dialog>
  );
}
