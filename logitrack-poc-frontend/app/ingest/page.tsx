"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, PageHeader, Spinner, Button, Badge } from "@/components/ui";

export default function IngestPage() {
  const [samples,   setSamples]   = useState<any[]>([]);
  const [status,    setStatus]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.samples().then(setSamples).catch(() => setSamples([]));
  }, []);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(api.uploadUrl(), { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || "Upload failed");
      setStatus({ ok: true, msg: body.message });
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = useCallback(async () => {
    setResetting(true);
    setStatus(null);
    try {
      await api.reset();
      setStatus({ ok: true, msg: "Reset to default sample dataset. All modules are now using the built-in data." });
    } catch {
      setStatus({ ok: false, msg: "Could not connect to backend. Make sure the server is running." });
    } finally {
      setResetting(false);
    }
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Data"
        title="Data Ingestion Layer"
        desc="Upload any required dataset as CSV. Columns are auto-detected and mapped to the correct master table, powering every module live."
        actions={
          <Button variant="secondary" onClick={reset} disabled={resetting}>
            {resetting ? "Resetting…" : "Reset to sample data"}
          </Button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        {/* Upload zone */}
        <Card>
          <CardHeader><CardTitle>Upload a dataset</CardTitle></CardHeader>
          <CardBody>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-brand transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-sm font-medium text-ink-900 mb-1">Drop a CSV here or click to browse</div>
              <div className="text-xs text-slate-400 mb-4">
                Auto-detected: supplier, plant, DC, transportation, product category, contract, trade, packaging, capacity
              </div>
              <Button disabled={uploading} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                {uploading ? "Uploading…" : "Select CSV file"}
              </Button>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {uploading && <Spinner label="Uploading and processing…" />}
            {status && (
              <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${status.ok ? "bg-positive/10 text-positive" : "bg-danger/10 text-danger"}`}>
                {status.msg}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Sample templates */}
        <Card>
          <CardHeader>
            <CardTitle>Sample templates</CardTitle>
            <Badge variant="blue">{samples.length} datasets</Badge>
          </CardHeader>
          <CardBody className="space-y-2 max-h-[340px] overflow-y-auto">
            {samples.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">Connect the backend to see sample downloads</div>
            ) : (
              samples.map((s) => (
                <a key={s.key} href={api.sampleUrl(s.key)} download
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 hover:border-brand hover:bg-brand-50 transition-colors">
                  <span className="text-sm font-medium text-ink-900">{s.label}</span>
                  <span className="text-xs text-brand font-medium">CSV ↓</span>
                </a>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* Schema reference */}
      <Card>
        <CardHeader><CardTitle>Required Dataset Schemas</CardTitle></CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Dataset</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Key Fields</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {[
                ["Supplier Master",      "Supplier_ID, Supplier_Name, Country, Product_Category, Annual_Volume_Units, Lead_Time_Days, Annual_Spend_USD"],
                ["Plant Master",         "Plant_ID, Country, Capacity_Units_Year, Utilization_Pct, Annual_Cost_USD"],
                ["DC Master",            "DC_ID, Location, Capacity_Units, Inventory_Value_USD"],
                ["Transportation Master","Lane_ID, Origin, Destination, Carrier, Mode, Distance_KM, Transit_Time_Days, Freight_Cost_USD, Shipments_Per_Year, OTIF_Pct"],
                ["Product Category",     "Product_Category, Annual_Volume_Units, Revenue_USD, Avg_Weight_KG"],
                ["Contract Master",      "Contract_ID, Carrier, Start_Date, End_Date, Volume_Commitment_Shipments, Exit_Penalty_USD"],
                ["Trade Dataset",        "Origin_Country, Destination_Country, Duty_Rate_Pct, Tariff_Rate_Pct"],
                ["Financial Dataset",    "Revenue_USD, Gross_Margin_Pct, Cost_Of_Capital_Pct, WACC_Pct, DIO_Days, DSO_Days, DPO_Days"],
                ["Packaging Master",     "Product_Family, Corrugate_KG, EPS_Foam_KG, Wood_Pallet_KG, LDPE_Wrap_KG, Steel_Strapping_KG, Total_Packaging_KG, Embodied_CO2e_KG"],
                ["Capacity Master",      "Product_Family, Bare_Weight_KG, Packaged_Weight_KG, Packaged_Volume_M3, Load_Factor, Units_Per_Container, Container_Fill_Pct, Container_Size_Ft, Binding_Constraint"],
              ].map(([d, f]) => (
                <tr key={d} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-semibold text-ink-900 whitespace-nowrap">{d}</td>
                  <td className="px-5 py-2.5 font-mono text-slate-500">{f}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
