import React, { useEffect, useState } from "react";
import api from "../lib/api";

const reminderTypeLabel = (value) => {
  const labels = {
    HOD1_PENDING: "HOD 1 pending",
    HOD2_PENDING: "HOD 2 pending",
    ENGINEER_PENDING: "Engineer pending",
  };
  return labels[value] || String(value || "-").replaceAll("_", " ");
};

export default function ReminderManagement() {
  const [reminderStatus, setReminderStatus] = useState(null);
  const [reminderTab, setReminderTab] = useState("scheduler");
  const [reminderLogs, setReminderLogs] = useState([]);
  const [reminderLogsLoading, setReminderLogsLoading] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const [logFilters, setLogFilters] = useState({
    search: "",
    ticketType: "",
    status: "",
    from: "",
    to: "",
  });
  const [reminderForm, setReminderForm] = useState({
    enabled: true,
    runTime: "11:00",
    thresholdDays: "1,2",
  });

  const formatDateTime = (value) => {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleString();
  };

  const loadReminderStatus = async () => {
    try {
      const res = await api.get("/api/dashboard/reminders/status");
      const data = res.data?.data || null;
      setReminderStatus(data);
      if (data) {
        setReminderForm({
          enabled: Boolean(data.enabled),
          runTime: data.runTime || "11:00",
          thresholdDays: Array.isArray(data.thresholdDays) ? data.thresholdDays.join(",") : "1,2",
        });
      }
    } catch (e) {
      console.error("Reminder status load failed", e);
      setReminderStatus(null);
    }
  };

  const loadReminderLogs = async (filters = logFilters) => {
    try {
      setReminderLogsLoading(true);
      const params = {
        limit: 50,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      };
      const res = await api.get("/api/dashboard/reminders/logs", { params });
      setReminderLogs(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) {
      console.error("Reminder logs load failed", e);
      setReminderLogs([]);
    } finally {
      setReminderLogsLoading(false);
    }
  };

  useEffect(() => {
    loadReminderStatus();
    loadReminderLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearLogFilters = () => {
    const emptyFilters = { search: "", ticketType: "", status: "", from: "", to: "" };
    setLogFilters(emptyFilters);
    loadReminderLogs(emptyFilters);
  };

  const handleRunReminderCheck = async () => {
    try {
      setReminderLoading(true);
      setReminderMessage("");
      const res = await api.post("/api/dashboard/reminders/run");
      const summary = res.data?.data || {};
      setReminderMessage(
        `Completed: ${summary.sent || 0} sent, ${summary.failed || 0} failed, ${summary.skipped || 0} skipped.`
      );
      await loadReminderStatus();
      await loadReminderLogs();
    } catch (e) {
      const message = e.response?.data?.message || e.message || "Failed to run reminder check.";
      setReminderMessage(message);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleSaveReminderSettings = async () => {
    try {
      setReminderSaving(true);
      setReminderMessage("");
      const thresholdDays = reminderForm.thresholdDays
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);

      const res = await api.put("/api/dashboard/reminders/status", {
        enabled: reminderForm.enabled,
        runTime: reminderForm.runTime,
        thresholdDays,
      });

      const data = res.data?.data || null;
      setReminderStatus(data);
      setReminderForm({
        enabled: Boolean(data?.enabled),
        runTime: data?.runTime || "11:00",
        thresholdDays: Array.isArray(data?.thresholdDays) ? data.thresholdDays.join(",") : "1,2",
      });
      setReminderMessage("Reminder scheduler settings saved.");
    } catch (e) {
      const message = e.response?.data?.message || e.message || "Failed to save reminder settings.";
      setReminderMessage(message);
    } finally {
      setReminderSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    try {
      setTestEmailLoading(true);
      setReminderMessage("");
      const res = await api.post("/api/dashboard/reminders/test-email");
      setReminderMessage(res.data?.message || "Test reminder email sent.");
    } catch (e) {
      const message = e.response?.data?.message || e.message || "Failed to send test reminder email.";
      setReminderMessage(message);
    } finally {
      setTestEmailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reminder Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage reminder timing and check which reminder emails were sent.
        </p>
      </div>

      <div className="rounded-2xl bg-white shadow border border-gray-100">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex rounded-md border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setReminderTab("scheduler")}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${
                reminderTab === "scheduler" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"
              }`}
            >
              Scheduler
            </button>
            <button
              type="button"
              onClick={() => {
                setReminderTab("logs");
                loadReminderLogs();
              }}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${
                reminderTab === "logs" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"
              }`}
            >
              Reminder Logs
            </button>
          </div>
        </div>

        {reminderTab === "scheduler" ? (
          <div className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-gray-500">
                Set daily run time and day thresholds for pending HOD and engineer reminders.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveReminderSettings}
                  disabled={reminderSaving}
                  className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reminderSaving ? "Saving..." : "Save Settings"}
                </button>
                <button
                  type="button"
                  onClick={handleRunReminderCheck}
                  disabled={reminderLoading || reminderStatus?.running}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reminderLoading || reminderStatus?.running ? "Running..." : "Run Reminder Check"}
                </button>
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={testEmailLoading}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testEmailLoading ? "Sending..." : "Send Test Email"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <span className="text-xs text-gray-500">Scheduler</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reminderForm.enabled}
                    onChange={(e) => setReminderForm((form) => ({ ...form, enabled: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    {reminderForm.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </label>

              <label className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <span className="text-xs text-gray-500">Daily Run Time</span>
                <input
                  type="time"
                  value={reminderForm.runTime}
                  onChange={(e) => setReminderForm((form) => ({ ...form, runTime: e.target.value }))}
                  className="mt-2 w-36 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                />
              </label>

              <label className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <span className="text-xs text-gray-500">Threshold Days</span>
                <input
                  type="text"
                  value={reminderForm.thresholdDays}
                  onChange={(e) => setReminderForm((form) => ({ ...form, thresholdDays: e.target.value }))}
                  placeholder="1,2"
                  className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                />
                <span className="mt-2 block text-xs leading-5 text-gray-500">
                  Example: 1,2 means send one reminder after 1 day and another after 2 days if the ticket is still pending.
                </span>
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Status</div>
                <div className="mt-1 font-semibold text-gray-800">
                  {reminderStatus?.enabled ? "Enabled" : "Disabled"}
                </div>
              </div>
              <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Thresholds</div>
                <div className="mt-1 font-semibold text-gray-800">
                  {(reminderStatus?.thresholdDays || [1, 2]).join(", ")} day
                </div>
              </div>
              <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Daily Time</div>
                <div className="mt-1 font-semibold text-gray-800">
                  {reminderStatus?.runTime || "11:00"}
                </div>
              </div>
              <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Last Result</div>
                <div className="mt-1 font-semibold text-gray-800">
                  {reminderStatus?.lastRunSummary
                    ? `${reminderStatus.lastRunSummary.sent || 0} sent / ${reminderStatus.lastRunSummary.failed || 0} failed`
                    : "No run yet"}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-gray-500 md:grid-cols-2">
              <p>Last run: {formatDateTime(reminderStatus?.lastRunAt)}</p>
              <p>Next run: {formatDateTime(reminderStatus?.nextRunAt)}</p>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-4 space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-gray-500">Recent reminder email attempts.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clearLogFilters}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Clear Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => loadReminderLogs()}
                    disabled={reminderLogsLoading}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reminderLogsLoading ? "Refreshing..." : "Apply Filters"}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 md:grid-cols-5">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-medium text-gray-600">Search Ticket / Email</span>
                  <input
                    type="text"
                    value={logFilters.search}
                    onChange={(e) => setLogFilters((filters) => ({ ...filters, search: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    placeholder="Ticket ID or email"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">Ticket Type</span>
                  <select
                    value={logFilters.ticketType}
                    onChange={(e) => setLogFilters((filters) => ({ ...filters, ticketType: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All</option>
                    <option value="complaint">Complaint</option>
                    <option value="request">Request</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">Status</span>
                  <select
                    value={logFilters.status}
                    onChange={(e) => setLogFilters((filters) => ({ ...filters, status: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">From</span>
                  <input
                    type="date"
                    value={logFilters.from}
                    onChange={(e) => setLogFilters((filters) => ({ ...filters, from: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">To</span>
                  <input
                    type="date"
                    value={logFilters.to}
                    onChange={(e) => setLogFilters((filters) => ({ ...filters, to: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="overflow-auto rounded-md border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Ticket</th>
                    <th className="px-3 py-2 text-left">Reminder</th>
                    <th className="px-3 py-2 text-left">To</th>
                    <th className="px-3 py-2 text-left">After</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {reminderLogs.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>
                        {reminderLogsLoading ? "Loading reminder logs..." : "No reminder logs found."}
                      </td>
                    </tr>
                  ) : (
                    reminderLogs.map((log) => (
                      <tr key={log.id} className="border-t border-gray-100">
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatDateTime(log.sentAt || log.createdAt)}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-semibold text-gray-800">
                          {log.ticketId || `${log.ticketType}-${log.entityId}`}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{reminderTypeLabel(log.reminderType)}</td>
                        <td className="px-3 py-2">{log.recipientEmail}</td>
                        <td className="whitespace-nowrap px-3 py-2">{log.thresholdDays} day</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            log.status === "sent" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="min-w-48 px-3 py-2 text-gray-500">{log.errorMessage || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reminderMessage && (
          <div className="mx-4 mb-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {reminderMessage}
          </div>
        )}
      </div>
    </div>
  );
}
