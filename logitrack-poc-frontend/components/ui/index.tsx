import { type ReactNode, type ButtonHTMLAttributes, forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-white/95 dark:bg-slate-950/55 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl shadow-card dark:shadow-[0_20px_80px_-40px_rgba(0,0,0,0.7)] hover:shadow-elevated dark:hover:shadow-black/40 transition-shadow backdrop-blur-xl", className)} {...p} />;
}
export function CardHeader({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap", className)} {...p} />;
}
export function CardTitle({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-ink-900 dark:text-white", className)} {...p} />;
}
export function CardBody({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...p} />;
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
const vcx: Record<Variant, string> = {
  primary: "bg-brand dark:bg-cyan-500 text-white hover:bg-brand-600 dark:hover:bg-cyan-600 shadow-sm dark:shadow-cyan-500/20",
  secondary: "bg-white dark:bg-slate-800 text-ink-900 dark:text-white border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700",
  ghost: "bg-transparent text-slate-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800",
  danger: "bg-danger text-white hover:brightness-95 shadow-sm dark:shadow-danger/20",
};
const scx: Record<Size, string> = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-sm" };

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  ({ className, variant = "primary", size = "md", ...p }, ref) => (
    <button ref={ref} className={cn("inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50 disabled:cursor-not-allowed",
      scx[size], vcx[variant], className)} {...p} />
  ),
);
Button.displayName = "Button";

type BV = "blue" | "green" | "amber" | "red" | "slate";
const bcx: Record<BV, string> = {
  blue: "bg-brand-50 dark:bg-cyan-500/10 text-brand-700 dark:text-cyan-400 border-brand-200 dark:border-cyan-500/20", 
  green: "bg-positive/10 dark:bg-positive/10 text-positive dark:text-positive border-positive/20 dark:border-positive/30",
  amber: "bg-warning/10 dark:bg-warning/10 text-warning dark:text-warning border-warning/20 dark:border-warning/30", 
  red: "bg-danger/10 dark:bg-danger/10 text-danger dark:text-danger border-danger/20 dark:border-danger/30",
  slate: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600",
};
export function Badge({ children, variant = "slate", className }: { children: ReactNode; variant?: BV; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border", bcx[variant], className)}>{children}</span>;
}

export function KPI({ label, value, sub, accent, desc }: { label: string; value: string; sub?: string; accent?: "blue" | "green" | "red" | "amber" | "default"; desc?: string }) {
  const ac = { blue: "text-brand dark:text-cyan-400", green: "text-positive dark:text-positive", red: "text-danger dark:text-danger", amber: "text-warning dark:text-warning", default: "text-ink-900 dark:text-white" }[accent || "default"];
  return (
    <Card className="relative overflow-hidden hover:shadow-elevated dark:hover:shadow-black/40 transition-all duration-200">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand to-brand-600 dark:from-cyan-400 dark:to-cyan-600 opacity-80" />
      <CardBody className="pl-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</div>
            {desc && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</div>}
          </div>
        </div>
        <div className={cn("text-2xl font-bold numeric", ac)}>{value}</div>
        {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">{sub}</div>}
      </CardBody>
    </Card>
  );
}

export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow?: string; title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
      <div>
        {eyebrow && <div className="text-xs font-semibold text-brand dark:text-cyan-400 uppercase tracking-wider mb-2">{eyebrow}</div>}
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">{title}</h1>
        {desc && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-3xl">{desc}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
      <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-brand dark:border-t-brand-400 rounded-full animate-spin" />
      {label && <div className="text-sm mt-3">{label}</div>}
    </div>
  );
}

export function ApiError({ retry }: { retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-12 h-12 rounded-full bg-danger/10 dark:bg-danger/20 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="1.8" />
          <path d="M12 8v4m0 4h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-ink-900 dark:text-white">Could not connect to the API</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Make sure the backend is running on{" "}
          <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">localhost:8000</code>
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Run: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">dotnet run</code> inside{" "}
          <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">backend/LogiTrack.Api</code>
        </div>
      </div>
      {retry && (
        <button onClick={retry}
          className="px-4 py-2 text-sm font-medium bg-brand dark:bg-brand-600 text-white rounded-lg hover:bg-brand-600 dark:hover:bg-brand-500 transition-colors">
          Retry
        </button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 flex-wrap">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            value === o.value ? "bg-white dark:bg-slate-700 text-ink-900 dark:text-cyan-400 shadow-sm dark:shadow-black/20 dark:border dark:border-slate-600" : "text-slate-500 dark:text-slate-500 hover:text-ink-900 dark:hover:text-slate-300")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ className, ...p }: import("react").SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-ink-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/30 dark:focus:ring-brand-400/30 cursor-pointer", className)} {...p} />;
}
