"use client";
import { useEffect, useState } from "react";

/* Shared, cross-page approval state for scenarios (spec: approved scenarios flow
   through to Transition Economics and the Executive Hub). Persisted in localStorage
   so a decision made on /scenarios is visible everywhere. Values: APPROVE | PILOT | DECLINE. */

const KEY = "logitrack-approvals";
const EVT = "logitrack-approvals-changed";
export type ApprovalMap = Record<string, string>;

export function getApprovals(): ApprovalMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function setApproval(id: string, v: string) {
  if (typeof window === "undefined") return;
  const m = getApprovals();
  if (!v || m[id] === v) delete m[id]; else m[id] = v;   // toggle off if same
  localStorage.setItem(KEY, JSON.stringify(m));
  window.dispatchEvent(new Event(EVT));
}

export function isApproved(v?: string) { return v === "APPROVE" || v === "PILOT"; }

/** Live-updating hook: re-renders when an approval changes anywhere in the app. */
export function useApprovals(): ApprovalMap {
  const [m, setM] = useState<ApprovalMap>({});
  useEffect(() => {
    const sync = () => setM(getApprovals());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return m;
}
