import clsx from "clsx";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { ReactNode, createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
const Ctx = createContext<{ success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }>({ success() {}, error() {}, info() {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);
  const api = { success: (t: string) => push("success", t), error: (t: string) => push("error", t), info: (t: string) => push("info", t) };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2.5 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={clsx(
              "pointer-events-auto flex max-w-md items-start gap-3 rounded-ctl border bg-white/95 backdrop-blur-md px-4 py-3 text-sm font-medium shadow-lift transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-3",
              t.kind === "error" ? "border-alert/30 text-ink shadow-alert/5" : t.kind === "success" ? "border-go/30 text-ink shadow-go/5" : "border-cobalt/30 text-ink shadow-cobalt/5"
            )}
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-go" />
            ) : t.kind === "error" ? (
              <XCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-alert" />
            ) : (
              <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-cobalt" />
            )}
            <span className="leading-snug">{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
