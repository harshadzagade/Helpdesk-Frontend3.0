// ===============================
// ✅ FRONTEND: components/ActivityFeed.jsx
// For Admin/Subadmin activities
// ===============================
import React from "react";

export default function ActivityFeed({ items = [] }) {
  return (
    <div className="rounded-2xl bg-white shadow border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold">Subadmin Activities</h3>
      </div>
      <div className="p-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">No activities found.</p>
        ) : (
          items.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">{a.actionTaken}</p>
                <p className="text-xs text-gray-500">Subadmin ID: {a.subadminId}</p>
              </div>
              <p className="text-xs text-gray-500">
                {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
