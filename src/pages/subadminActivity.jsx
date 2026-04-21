// src/pages/SubadminActivity.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/authContext/AuthContext";
import ComplaintDetails from "./ComplaintDetails";
import RequestDetails from "./RequestDetails";

const ACTION_LABELS = {
  REQUEST_HOD1_APPROVE: "Request - HOD1 Approved",
  REQUEST_HOD2_APPROVE_ASSIGN: "Request - HOD2 Approved & Assigned",
  REQUEST_FORWARD: "Request - Forwarded",
  REQUEST_CLOSE: "Request - Closed",

  COMPLAINT_ASSIGNED: "Complaint - Assigned",
  COMPLAINT_FORWARDED: "Complaint - Forwarded",
  COMPLAINT_CLOSED: "Complaint - Closed",
};

const PAGE_SIZE = 10;

const SubadminActivity = () => {
  const { activeDepartmentId } = useAuth();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchName, setSearchName] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  // ✅ State for showing details
  const [selectedEntity, setSelectedEntity] = useState(null); // { type: 'COMPLAINT', id: 123 }
  const [entityData, setEntityData] = useState(null); // The fetched complaint/request object
  const [entityLoading, setEntityLoading] = useState(false);

  // -----------------------------------
  // ✅ Backend se data load (dept ready hone ke baad)
  // -----------------------------------
  useEffect(() => {
    if (!activeDepartmentId) return;

    const controller = new AbortController();

    const fetchActivities = async () => {
      setLoading(true);
      setError("");

      try {
        const params = {};
        if (actionFilter) params.actionTaken = actionFilter;
        if (fromDate) params.from = fromDate;
        if (toDate) params.to = toDate;

        const res = await api.get("/api/subadmin-activities", {
          params,
          signal: controller.signal,
          headers: {
            "x-department-id": String(activeDepartmentId),
          },
        });

        console.log("Subadmin activities RESPONSE =>", res.data);

        if (res.data?.success && Array.isArray(res.data.data)) {
          setActivities(res.data.data);
        } else {
          setActivities([]);
          setError(res.data?.message || "Unexpected response from server.");
        }
      } catch (err) {
        if (err.name === "CanceledError") return;

        const msg =
          err.response?.data?.message ||
          err.message ||
          "Failed to load activities.";

        setError(msg);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();

    return () => controller.abort();
  }, [activeDepartmentId, actionFilter, fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, actionFilter, fromDate, toDate, activeDepartmentId]);

  // -----------------------------------
  // ✅ Client-side filtering
  // -----------------------------------
  const filteredActivities = useMemo(() => {
    if (!Array.isArray(activities)) return [];

    return activities.filter((a) => {
      const fullName =
        `${a.subadmin?.firstname || ""} ${a.subadmin?.middlename || ""} ${a.subadmin?.lastname || ""
          }`
          .trim()
          .toLowerCase();

      if (searchName && !fullName.includes(searchName.toLowerCase())) {
        return false;
      }

      if (fromDate) {
        const act = new Date(a.createdAt);
        if (act < new Date(fromDate)) return false;
      }

      if (toDate) {
        const act = new Date(a.createdAt);
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (act > end) return false;
      }

      return true;
    });
  }, [activities, searchName, fromDate, toDate]);

  const totalPages = Math.ceil(filteredActivities.length / PAGE_SIZE) || 1;

  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, currentPage]);

  const formatDateTime = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const getActionLabel = (code) => ACTION_LABELS[code] || code;

  // -----------------------------------
  // ✅ Fetch entity details (complaint or request)
  // -----------------------------------
  useEffect(() => {
    if (!selectedEntity) {
      setEntityData(null);
      return;
    }

    const fetchEntityDetails = async () => {
      setEntityLoading(true);
      setEntityData(null);

      try {
        let endpoint = "";
        if (selectedEntity.type === "COMPLAINT") {
          endpoint = `/api/complaints/${selectedEntity.id}`;
        } else if (selectedEntity.type === "REQUEST") {
          endpoint = `/api/requests/${selectedEntity.id}`;
        }

        if (!endpoint) {
          console.error("Unknown entity type:", selectedEntity.type);
          setEntityLoading(false);
          return;
        }

        const res = await api.get(endpoint);
        const data = res.data?.data || res.data || null;

        setEntityData(data);
      } catch (err) {
        console.error("Failed to fetch entity details:", err);
        setError(
          err.response?.data?.message ||
          err.message ||
          "Failed to load details."
        );
        setEntityData(null);
      } finally {
        setEntityLoading(false);
      }
    };

    fetchEntityDetails();
  }, [selectedEntity]);

  // -----------------------------------
  // ✅ Handle row click - Set selected entity
  // -----------------------------------
  const handleRowClick = (activity) => {
    if (!activity.entityType || !activity.entityId) {
      console.warn("Missing entityType or entityId");
      return;
    }

    setSelectedEntity({
      type: activity.entityType,
      id: activity.entityId,
    });
  };

  // ✅ Go back to table
  const handleBackToTable = () => {
    setSelectedEntity(null);
    setEntityData(null);
  };

  // -----------------------------------
  // ✅ If details view is active, show that component
  // -----------------------------------
  if (selectedEntity) {
    if (entityLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">Loading details...</p>
        </div>
      );
    }

    if (!entityData) {
      return (
        <div className="text-center py-10 text-red-500">
          Failed to load {selectedEntity.type.toLowerCase()} details.
        </div>
      );
    }

    if (selectedEntity.type === "COMPLAINT") {
      return (
        <div className="p-6">
          <ComplaintDetails complaint={entityData} onClose={handleBackToTable} />
        </div>
      );
    } else if (selectedEntity.type === "REQUEST") {
      return (
        <div className="p-6">
          <RequestDetails request={entityData} onClose={handleBackToTable} />
        </div>
      );
    }
  }

  // -----------------------------------
  // ✅ Default: Show table
  // -----------------------------------
  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">
        Subadmin Activity Log
      </h1>

      {/* ✅ Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-1">
          <label className="block text-xs text-gray-600 mb-1">
            Subadmin Name
          </label>
          <input
            type="text"
            className="w-full border rounded px-2 py-1"
            placeholder="Search name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-600 mb-1">Action</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">All</option>
            {Object.entries(ACTION_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-600 mb-1">From</label>
          <input
            type="date"
            className="w-full border rounded px-2 py-1"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-600 mb-1">To</label>
          <input
            type="date"
            className="w-full border rounded px-2 py-1"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* ✅ Content */}
      {!activeDepartmentId ? (
        <div className="text-center py-10 text-gray-600">
          Please select a department first.
        </div>
      ) : loading ? (
        <div className="text-center py-10 text-gray-600">Loading...</div>
      ) : error ? (
        <div className="text-red-500 text-sm mb-4">{error}</div>
      ) : filteredActivities.length === 0 ? (
        <div className="text-center text-gray-600 py-10">
          No activities found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Subadmin</th>
                  <th className="px-3 py-2 text-left">Department</th>
                  <th className="px-3 py-2 text-left">Entity Type</th>
                  <th className="px-3 py-2 text-left">Entity ID</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {paginatedActivities.map((a, i) => {
                  const name = `${a.subadmin?.firstname || ""} ${a.subadmin?.middlename || ""
                    } ${a.subadmin?.lastname || ""}`.trim();

                  return (
                    <tr
                      key={a.id}
                      onClick={() => handleRowClick(a)}
                      className={`cursor-pointer hover:bg-blue-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                    >
                      <td className="px-3 py-2">
                        {(currentPage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-3 py-2">
                        {formatDateTime(a.createdAt)}
                      </td>
                      <td className="px-3 py-2">{name || a.subadminId}</td>
                      <td className="px-3 py-2">
                        {a.department?.department || "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${a.entityType === "COMPLAINT"
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                            }`}
                        >
                          {a.entityType || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700">
                        {a.entityId || "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          {getActionLabel(a.actionTaken)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ✅ Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-600">
              Showing <b>{(currentPage - 1) * PAGE_SIZE + 1}</b> to{" "}
              <b>
                {Math.min(currentPage * PAGE_SIZE, filteredActivities.length)}
              </b>{" "}
              of <b>{filteredActivities.length}</b>
            </div>

            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:text-gray-400 disabled:border-gray-300"
              >
                Previous
              </button>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:text-gray-400 disabled:border-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SubadminActivity;