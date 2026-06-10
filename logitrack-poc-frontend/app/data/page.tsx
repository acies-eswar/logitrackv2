"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fmtUSD, fmtNum } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, PageHeader, Spinner, ApiError, Badge } from "@/components/ui";

const DATASETS = [
  { key: "suppliers",  label: "Suppliers" },
  { key: "plants",     label: "Plants" },
  { key: "dcs",        label: "Distribution Centers" },
  { key: "lanes",      label: "Transportation Lanes" },
  { key: "categories", label: "Product Categories" },
  { key: "contracts",  label: "Contracts" },
  { key: "trade",      label: "Trade" },
  { key: "packaging",  label: "Packaging" },
  { key: "capacity",   label: "Capacity" },
];

export default function DataPage() {
  const [active,  setActive]  = useState("suppliers");
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [search,  setSearch]  = useState("");

  const load = useCallback((key: string) => {
    setLoading(true);
    setError(false);
    api.master(key)
      .then((r) => { setRows(r); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { load(active); }, [active, load]);

  const cols = rows[0]
    ? Object.keys(rows[0]).filter((c) => !["Origin_Lat", "Origin_Lng", "Dest_Lat", "Dest_Lng"].includes(c))
    : [];

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, search]);

  const fmtCell = (v: any) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "number") {
      if (Math.abs(v) >= 100_000) return fmtUSD(v);
      return fmtNum(v, Number.isInteger(v) ? 0 : 2);
    }
    return String(v);
  };

  return (
    <>
      <PageHeader
        eyebrow="Data"
        title="Master Data"
        desc="Browse the active datasets powering the platform. Upload your own CSV via the ingestion layer to replace any table."
      />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex flex-wrap gap-1.5">
          {DATASETS.map((d) => (
            <button
              key={d.key}
              onClick={() => { setActive(d.key); setSearch(""); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                active === d.key
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-slate-600 border-slate-200 hover:border-brand"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rows…"
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{DATASETS.find((d) => d.key === active)?.label}</CardTitle>
          <Badge variant="blue">{filtered.length} rows</Badge>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {loading ? (
            <Spinner />
          ) : error ? (
            <ApiError retry={() => load(active)} />
          ) : (
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-left">
                    {cols.map((c) => (
                      <th key={c} className="px-4 py-2.5 text-xs font-semibold text-slate-500">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 300).map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      {cols.map((c) => (
                        <td key={c} className="px-4 py-2 font-mono text-xs text-ink-800">{fmtCell(row[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 300 && (
                <div className="px-4 py-3 text-xs text-slate-400 text-center border-t border-slate-100">
                  Showing 300 of {filtered.length} rows. Use search to narrow results.
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
