// ===============================
// ✅ FRONTEND: components/TicketTable.jsx
// Admin: Shows Pending + In-Progress tickets with Age (from createdAt)
// ===============================
import React, { useMemo } from "react";

const badge = (status = "") => {
  const s = String(status).toLowerCase();
  if (s.includes("closed")) return "bg-green-50 text-green-700";
  if (s.includes("progress")) return "bg-yellow-50 text-yellow-700";
  if (s.includes("hod1")) return "bg-indigo-50 text-indigo-700";
  if (s.includes("reject")) return "bg-red-50 text-red-700";
  return "bg-gray-50 text-gray-700";
};

const msToAge = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
};

export default function TicketTable({
  rows = [],
  title = "Pending / In-Progress Tickets",
  filterActiveOnly = true, // ✅ default: show only pending + inprogress
  onRowClick,
}) {
  const now = useMemo(() => Date.now(), []);

  const filteredRows = useMemo(() => {
    const list = rows || [];
    if (!filterActiveOnly) return list;

    return list.filter((r) => {
      const s = String(r?.status || "")
        .toLowerCase()
        .replace(/[_-]/g, " ")
        .trim();

      const isPending =
        s.includes("pending") ||
        s.includes("hod") ||          // hod, hod1, hod2, hod approval
        s.includes("approval");

      const isInProgress =
        s.includes("progress");       // in progress / in-progress

      const isClosed =
        s.includes("closed") ||
        s.includes("reject");

      return (isPending || isInProgress) && !isClosed;
    });
  }, [rows, filterActiveOnly]);
  
//only pending and in-progress tickets are shown
  // const filteredRows = useMemo(() => {
  //   const list = rows || [];
  //   if (!filterActiveOnly) return list;

  //   return list.filter((r) => {
  //     const s = String(r?.status || "")
  //       .toLowerCase()
  //       .replace(/_/g, " ")
  //       .replace(/-/g, " ")
  //       .trim();

  //     // ✅ FIX: include "pending" in any form (pending, pending approval, etc.)
  //     const isPending = s.includes("pending");

  //     // ✅ include both "in progress" & "in-progress" etc.
  //     const isInProgress = s.includes("progress");

  //     return isPending || isInProgress;
  //   });
  // }, [rows, filterActiveOnly]);

  return (
    <div className="rounded-2xl bg-white shadow border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">Age is calculated from Created time.</p>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Ticket</th>
              <th className="text-left px-4 py-3">Subject</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Time</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={7}>
                  No pending / in-progress tickets in this range.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const createdMs = r.createdAt ? new Date(r.createdAt).getTime() : null;
                const age = createdMs ? msToAge(now - createdMs) : "-";

                return (
                  <tr
                    key={`${r.type}-${r.id}`}
                    className={`border-t border-gray-100 ${onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    onClick={() => onRowClick?.(r)}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-700">{r.type}</td>
                    <td className={`px-4 py-3 ${onRowClick ? "font-semibold text-blue-700" : ""}`}>{r.ticketId}</td>
                    <td className="px-4 py-3">{r.subject || "-"}</td>
                    <td className="px-4 py-3">{r.priority || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 font-semibold">{age}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
