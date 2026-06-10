"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Header } from "./header";

const NAV = [
  {
    section: "Overview",
    icon: null,
    items: [
      {
        href: "/",
        label: "Executive Hub",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        ),
      },
    ],
  },
  {
    section: "Visibility",
    icon: null,
    items: [
      {
        href: "/network",
        label: "Network Intelligence",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="5" r="3" />
            <circle cx="6" cy="13" r="3" />
            <circle cx="18" cy="13" r="3" />
            <circle cx="12" cy="21" r="3" />
            <path d="M12 8v3m-6 3v2m6 3v-2m6-3v-2" />
          </svg>
        ),
      },
      {
        href: "/transportation",
        label: "Transportation Performance",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 16c0 1.1.9 2 2 2h2v2h12v-2h2c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v9z" />
            <circle cx="7" cy="17" r="2" />
            <circle cx="17" cy="17" r="2" />
            <path d="M6 7h12" />
          </svg>
        ),
      },
      {
        href: "/sustainability",
        label: "Cost & Sustainability",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            <path d="M12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8z" />
            <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    section: "Decisions",
    icon: null,
    items: [
      {
        href: "/scenarios",
        label: "Scenario Planning",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12h6m6 0h6" />
            <path d="M12 3v6m0 6v6" />
            <circle cx="9" cy="9" r="2" />
            <circle cx="15" cy="9" r="2" />
            <circle cx="9" cy="15" r="2" />
            <circle cx="15" cy="15" r="2" />
          </svg>
        ),
      },
      {
        href: "/transition",
        label: "Transition Economics",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3v18h18" />
            <path d="M3 15l4-4 4 4 6-6" />
            <path d="M15 9h6v6" />
          </svg>
        ),
      },
    ],
  },
  {
    section: "Data",
    icon: null,
    items: [
      {
        href: "/data",
        label: "Master Data",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 4h16v16H4z" />
            <path d="M4 10h16M10 4v16" />
          </svg>
        ),
      },
      {
        href: "/ingest",
        label: "Data Ingestion",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 10l5-5 5 5M12 9v9M5 21h14" />
          </svg>
        ),
      },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const path = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-20 flex flex-col transition-all duration-300",
        "bg-gradient-to-b from-slate-950 to-slate-900 dark:from-slate-950 dark:to-slate-900",
        "border-r border-slate-800 dark:border-slate-800",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="px-4 py-5 border-b border-slate-800 dark:border-slate-800 flex items-center justify-between group">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand to-cyan-500 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 17l6-6 4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="21" cy="7" r="2" fill="white" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-base leading-none tracking-tight">LogiTrack</div>
              <div className="text-cyan-400 text-[10px] mt-0.5 tracking-wide truncate">Finance-Native Logistics Intelligence</div>
            </div>
          </Link>
        )}
        
        {collapsed && (
          <Link href="/" className="w-full flex justify-center">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand to-cyan-500 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 17l6-6 4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="21" cy="7" r="2" fill="white" />
              </svg>
            </div>
          </Link>
        )}

        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <style>{`
          nav::-webkit-scrollbar { display: none; }
          nav { -ms-overflow-style: none; }
        `}</style>
        {NAV.map((g) => (
          <div key={g.section} className="mb-6 px-2">
            {!collapsed && (
              <div className="px-2 mb-3 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                {g.section}
              </div>
            )}
            {!collapsed && (
              <div className="px-2 mb-3 opacity-40 text-slate-600">
                <div className="text-slate-600" style={{ color: 'rgba(100, 116, 139, 0.3)' }}>
                  {g.icon}
                </div>
              </div>
            )}
            <div className="space-y-1">
              {g.items.map((it) => {
                const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cn(
                      "mx-0 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-3",
                      "border-l-2 border-transparent",
                      active
                        ? "bg-brand/20 border-l-cyan-400 text-cyan-400 shadow-lg shadow-cyan-500/10"
                        : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
                    )}
                    title={collapsed ? it.label : undefined}
                  >
                    {!collapsed ? (
                      <>
                        <span className="text-base flex-shrink-0">{it.icon}</span>
                        <span className="truncate text-slate-200">{it.label}</span>
                      </>
                    ) : (
                      <div className="w-full flex justify-center text-lg text-slate-400 group-hover:text-slate-300">
                        {it.icon}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-slate-800 dark:border-slate-800">
          <div className="text-[10px] text-slate-500 font-mono">LogiTrack v1.0</div>
          <div className="text-[9px] text-slate-600 mt-1">Finance-Native Logistics</div>
        </div>
      )}
    </aside>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", next.toString());
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className={cn("transition-all duration-300 ease-in-out", collapsed ? "ml-20" : "ml-64")}>
        <Header />
        <main className="px-6 py-6 max-w-full mx-0 animate-fade-up" style={{ scrollbarWidth: 'none' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
