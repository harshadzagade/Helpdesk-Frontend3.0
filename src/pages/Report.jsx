import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../lib/api';
import Table from '../components/Table';
import { useAuth } from '../context/authContext/AuthContext';

const Report = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const role = (user?.role || 'user').toLowerCase();
  const displayRole = user?.label || user?.role || role;

  // 'complaint' | 'request'
  const [activeModule, setActiveModule] = useState('complaint');

  // 'all' | 'incoming' | 'department' | 'my'
  const [scope, setScope] = useState('incoming');

  // filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [engineerFilter, setEngineerFilter] = useState('all');

  // ✅ NEW: Department filter
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [rawData, setRawData] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [deptList, setDeptList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [deptLoading, setDeptLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ role ke hisaab se default scope
  useEffect(() => {
    if (role === 'admin' || role === 'subadmin' || role === 'superadmin') {
      setScope('all');
    } else if (role === 'engineer' || role === 'engineers' || role === 'user') {
      setScope('my');
    }
  }, [role, activeModule]);

  // ✅ fetch staff list (engineer name mapping)
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setStaffLoading(true);
        const res = await api.get('/api/staff');
        const list = res.data?.data || res.data || [];
        setStaffList(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('❌ Error fetching staff:', err);
        setStaffList([]);
      } finally {
        setStaffLoading(false);
      }
    };

    fetchStaff();
  }, []);

  // ✅ fetch departments list (deptId -> deptName mapping)
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setDeptLoading(true);
        const res = await api.get('/api/departments');
        const list = res.data?.data || res.data || [];
        setDeptList(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('❌ Error fetching departments:', err);
        setDeptList([]);
      } finally {
        setDeptLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  // ✅ staffId -> staff map
  const staffById = useMemo(() => {
    const map = {};
    staffList.forEach((s) => {
      if (s?.id != null) map[String(s.id)] = s;
    });
    return map;
  }, [staffList]);

  const getStaffName = useCallback((id) => {
    if (id == null) return null;
    const s = staffById[String(id)];
    if (!s) return null;
    const full = `${s.firstname || ''} ${s.middlename || ''} ${s.lastname || ''}`.trim();
    return full || s.email || `ID: ${id}`;
  }, [staffById]);

  // ✅ deptId -> deptName map
  const deptMap = useMemo(() => {
    const map = {};
    deptList.forEach((d) => {
      if (d?.id != null) map[String(d.id)] = d.department || d.name || '';
    });
    return map;
  }, [deptList]);

  const getDeptName = useCallback((deptId) => {
    if (deptId == null) return '-';
    return deptMap[String(deptId)] || `ID: ${deptId}`;
  }, [deptMap]);

  // ✅ endpoint resolver
  const resolveEndpoint = useCallback(() => {
    // Complaints
    if (activeModule === 'complaint') {
      if (role === 'superadmin') return '/api/complaints';

      if (role === 'admin' || role === 'subadmin') {
        if (scope === 'incoming') return '/api/complaints/incomming';
        if (scope === 'department') return '/api/complaints/department-complaints';
        if (scope === 'my') return '/api/complaints/my-complaints';
        return '/api/complaints/incomming';
      }

      // engineer / user
      return '/api/complaints/my-complaints';
    }

    // Requests
    if (role === 'superadmin') return '/api/requests';

    if (role === 'admin' || role === 'subadmin') {
      if (scope === 'incoming') return '/api/requests/incoming';
      if (scope === 'department') return '/api/requests/department-requests';
      if (scope === 'my') return '/api/requests/my-requests';
      return '/api/requests/incoming';
    }

    return '/api/requests/my-requests';
  }, [activeModule, role, scope]);

  // formatting
  const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  const formatStatusBadge = (value) => {
    const status = (value || '').toLowerCase();
    let color = 'bg-gray-100 text-gray-700';

    if (status.includes('pending')) color = 'bg-yellow-100 text-yellow-800';
    else if (status.includes('progress')) color = 'bg-blue-100 text-blue-800';
    else if (status.includes('closed') || status.includes('close'))
      color = 'bg-green-100 text-green-800';
    else if (status.includes('reject')) color = 'bg-red-100 text-red-800';

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        {value || '-'}
      </span>
    );
  };

  const formatPriorityBadge = (value) => {
    const priority = (value || '').toLowerCase();
    let color = 'bg-gray-100 text-gray-700';

    if (priority.includes('high')) color = 'bg-red-100 text-red-800';
    else if (priority.includes('medium')) color = 'bg-yellow-100 text-yellow-800';
    else if (priority.includes('low')) color = 'bg-green-100 text-green-800';

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        {value || '-'}
      </span>
    );
  };

  // ✅ fetch report data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        setRawData([]);

        // admin/subadmin + scope=all => merge endpoints
        if ((role === 'admin' || role === 'subadmin') && scope === 'all') {
          let endpoints = [];

          if (activeModule === 'complaint') {
            endpoints = [
              '/api/complaints/incomming',
              '/api/complaints/department-complaints',
              '/api/complaints/my-complaints',
            ];
          } else {
            endpoints = [
              '/api/requests/incoming',
              '/api/requests/department-requests',
              '/api/requests/my-requests',
            ];
          }

          const responses = await Promise.all(
            endpoints.map((ep) =>
              api.get(ep).catch((err) => {
                console.error('Error fetching', ep, err);
                return null;
              })
            )
          );

          let combined = [];
          responses.forEach((res) => {
            if (!res?.data) return;
            const arr = res.data?.data || res.data || [];
            if (Array.isArray(arr)) combined = combined.concat(arr);
          });

          // unique by id
          const seen = new Set();
          const unique = combined.filter((item) => {
            if (!item?.id) return false;
            const key = String(item.id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          setRawData(unique);
          return;
        }

        const endpoint = resolveEndpoint();
        const res = await api.get(endpoint);
        const data = res.data?.data || res.data || [];
        setRawData(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('❌ Report fetch error:', err);
        setError(err.response?.data?.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolveEndpoint, activeModule, role, scope]);

  // date filter
  const applyDateFilter = useCallback((items) => {
    if (!fromDate && !toDate) return items;

    return items.filter((item) => {
      if (!item.createdAt) return false;
      const created = new Date(item.createdAt);
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;

      if (from && created < from) return false;
      if (to) {
        const endOfTo = new Date(to);
        endOfTo.setHours(23, 59, 59, 999);
        if (created > endOfTo) return false;
      }
      return true;
    });
  }, [fromDate, toDate]);

  // dropdown options
  const dropdownOptions = useMemo(() => {
    const statusesSet = new Set();
    const prioritiesSet = new Set();
    const engineersSet = new Set();
    const deptsSet = new Set();

    rawData.forEach((item) => {
      if (item.status) statusesSet.add(item.status);
      if (item.priority) prioritiesSet.add(item.priority);
      if (item.assignStaffId != null) engineersSet.add(String(item.assignStaffId));
      if (item.departmentId != null) deptsSet.add(String(item.departmentId));
    });

    return {
      statusOptions: ['all', ...Array.from(statusesSet)],
      priorityOptions: ['all', ...Array.from(prioritiesSet)],
      engineerOptions: ['all', ...Array.from(engineersSet)],
      departmentOptions: ['all', ...Array.from(deptsSet)],
    };
  }, [rawData]);

  const { statusOptions, priorityOptions, engineerOptions, departmentOptions } = dropdownOptions;

  // filtered data + summary
  const { tableData, summary } = useMemo(() => {
    let filtered = applyDateFilter(rawData);

    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (item) => (item.status || '').toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(
        (item) => (item.priority || '').toLowerCase() === priorityFilter.toLowerCase()
      );
    }

    if (engineerFilter !== 'all') {
      filtered = filtered.filter(
        (item) =>
          item.assignStaffId != null &&
          String(item.assignStaffId) === String(engineerFilter)
      );
    }

    // ✅ department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(
        (item) =>
          item.departmentId != null &&
          String(item.departmentId) === String(departmentFilter)
      );
    }

    const summaryInfo = { total: filtered.length, open: 0, closed: 0, inProgress: 0 };

    filtered.forEach((item) => {
      const status = (item.status || '').toLowerCase();
      if (status.includes('closed')) summaryInfo.closed += 1;
      else if (status.includes('progress')) summaryInfo.inProgress += 1;
      else summaryInfo.open += 1;
    });

    return { tableData: filtered, summary: summaryInfo };
  }, [
    rawData,
    applyDateFilter,
    statusFilter,
    priorityFilter,
    engineerFilter,
    departmentFilter,
  ]);

  // columns (complaint vs request)
  const columns = useMemo(() => {
    const deptColumn = {
      key: 'departmentId',
      label: 'Department',
      format: (value) => getDeptName(value),
    };

    if (activeModule === 'complaint') {
      return [
        { key: 'ticketId', label: 'Ticket ID' },
        { key: 'subject', label: 'Subject' },
        { key: 'status', label: 'Status', format: formatStatusBadge },
        { key: 'priority', label: 'Priority', format: formatPriorityBadge },
        deptColumn,
        { key: 'departmentCategory', label: 'Category' },
        { key: 'location', label: 'Location' },
        {
          key: 'assignStaffId',
          label: 'Engineer',
          format: (value) => getStaffName(value) || '-',
        },
        { key: 'createdAt', label: 'Created At', format: formatDateTime },
      ];
    }

    // requests
    return [
      { key: 'ticketId', label: 'Ticket ID' },
      { key: 'subject', label: 'Subject' },
      { key: 'status', label: 'Status', format: formatStatusBadge },
      { key: 'priority', label: 'Priority', format: formatPriorityBadge },
      deptColumn,
      { key: 'departmentCategory', label: 'Category' },
      {
        key: 'assignStaffId',
        label: 'Engineer',
        format: (value) => getStaffName(value) || '-',
      },
      {
        key: 'hod1Approval',
        label: 'HOD1',
        format: (value) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}
          >
            {value ? 'Approved' : 'Pending'}
          </span>
        ),
      },
      {
        key: 'hod2Approval',
        label: 'HOD2',
        format: (value) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}
          >
            {value ? 'Approved' : 'Pending'}
          </span>
        ),
      },
      { key: 'createdAt', label: 'Created At', format: formatDateTime },
    ];
  }, [activeModule, getDeptName, getStaffName]);

  const handleRowClick = (row) => {
    if (!row?.id) return;
    if (activeModule === 'complaint') navigate(`/complaints/${row.id}`);
    else navigate(`/requests/${row.id}`);
  };

  const getScopeLabel = (scopeKey) => {
    if (scopeKey === 'all') return activeModule === 'complaint' ? 'All Complaints' : 'All Requests';

    if (activeModule === 'complaint') {
      if (scopeKey === 'incoming') return 'Incoming Complaints';
      if (scopeKey === 'department') return 'Department Complaints';
      if (scopeKey === 'my') return 'My Complaints';
    } else {
      if (scopeKey === 'incoming') return 'Incoming Requests';
      if (scopeKey === 'department') return 'Department Requests';
      if (scopeKey === 'my') return 'My Requests';
    }
    return scopeKey;
  };

  const scopeOptions = useMemo(() => {
    if (role === 'admin' || role === 'subadmin') return ['all', 'incoming', 'department', 'my'];
    if (role === 'superadmin') return ['all'];
    return ['my'];
  }, [role]);

  // ✅ Excel export (adds department name)
  const formatDuration = (start, end) => {
    if (!start || !end) return '';
    const diff = new Date(end) - new Date(start);

    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');

    return `${h}:${m}:${s}`;
  };

  const handleExportExcel = () => {
    if (!tableData || tableData.length === 0) {
      alert('Export ke liye koi data nahi mila.');
      return;
    }

    const exportRows = tableData.map((row) => {
      const isRequest = activeModule === 'request';

      return {
        // 🔹 BASIC
        "Ticket Type": isRequest ? "Request" : "Complaint",
        "Ticket ID": row.ticketId,
        "Raised By": getStaffName(row.staffId),
        "Engineer": getStaffName(row.assignStaffId),
        "Department": getDeptName(row.departmentId),
        "Category": row.departmentCategory,
        "Priority": row.priority,
        "Subject": row.subject,
        "Description": row.description,
        "Status": row.status,

        // 🔹 TIME
        "Logged Time": formatDateTime(row.createdAt),
        "Assigned Time": formatDateTime(row.assignedAt || row.forwardAt),
        "Forward Time": formatDateTime(row.forwardAt),
        "Closed Time": formatDateTime(row.resolvedAt),
        "Last Updated": formatDateTime(row.updatedAt),

        // 🔹 AUDIT USERS
        "Assigned By": getStaffName(row.assignedById),
        "Closed By": getStaffName(row.closedById),

        // 🔹 WORK DETAILS
        "Problem Description": row.problemDescription || '',
        "Action Taken": row.actionTakenComment || '',
        "Forward Comment": row.forwardComment || '',

        // 🔹 DURATIONS (REAL AUDIT VALUE)
        "Logged → Assigned": formatDuration(row.createdAt, row.assignedAt || row.forwardAt),
        "Assigned → Closed": formatDuration(row.assignedAt || row.forwardAt, row.resolvedAt),
        "Total Resolution Time": formatDuration(row.createdAt, row.resolvedAt),

        // 🔹 REQUEST ONLY
        ...(isRequest && {
          "HOD1 Status": row.hod1Approval ? "Approved" : "Pending",
          "HOD1 Time": formatDateTime(row.hod1ApprovedAt),
          "HOD1 Approved By": getStaffName(row.hod1ApprovedById),
          "HOD1 Comment": row.hod1Comment || '',

          "HOD2 Status": row.hod2Approval ? "Approved" : "Pending",
          "HOD2 Time": formatDateTime(row.hod2ApprovedAt),
          "HOD2 Approved By": getStaffName(row.hod2ApprovedById),
          "HOD2 Comment": row.hod2Comment || '',

          "HOD1 → HOD2 Duration": formatDuration(row.hod1ApprovedAt, row.hod2ApprovedAt),
          "HOD2 → Assigned Duration": formatDuration(row.hod2ApprovedAt, row.assignedAt),
          "Assigned → Closed Duration": formatDuration(row.assignedAt, row.resolvedAt),

          "Rejection Level": row.rejectedByLevel || '',
          "Rejection Comment": row.rejectionComment || '',
          "Rejected At": formatDateTime(row.rejectedAt),
        })
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();

    const sheetName = activeModule === 'complaint' ? 'Complaint Audit' : 'Request Audit';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${sheetName}-${today}.xlsx`);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Reports</h2>

      <div className="mb-2 text-xs text-gray-500">
        Role: <span className="font-medium">{displayRole}</span> | Scope:{' '}
        <span className="font-medium">{getScopeLabel(scope)}</span> | Raw: {rawData.length} | Shown:{' '}
        {tableData.length} {staffLoading && '| Loading staff...'} {deptLoading && '| Loading depts...'}
      </div>

      {/* Toggle */}
      <div className="mb-4 flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveModule('complaint')}
          className={`px-4 py-2 rounded-md border text-sm font-medium transition ${activeModule === 'complaint'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
        >
          Complaint Reports
        </button>
        <button
          type="button"
          onClick={() => setActiveModule('request')}
          className={`px-4 py-2 rounded-md border text-sm font-medium transition ${activeModule === 'request'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
        >
          Request Reports
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-4 items-end bg-white rounded-md p-4 shadow-sm border border-gray-100">
        {/* Scope */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Scope</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            {scopeOptions.map((s) => (
              <option key={s} value={s}>
                {getScopeLabel(s)}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {st === 'all' ? 'All Statuses' : st}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Priority</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            {priorityOptions.map((pr) => (
              <option key={pr} value={pr}>
                {pr === 'all' ? 'All Priorities' : pr}
              </option>
            ))}
          </select>
        </div>

        {/* ✅ Department */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Department</label>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            {departmentOptions.map((dep) => (
              <option key={dep} value={dep}>
                {dep === 'all' ? 'All Departments' : getDeptName(dep)}
              </option>
            ))}
          </select>
        </div>

        {/* Engineer */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Engineer</label>
          <select
            value={engineerFilter}
            onChange={(e) => setEngineerFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            {engineerOptions.map((eng) => (
              <option key={eng} value={eng}>
                {eng === 'all' ? 'All Engineers' : getStaffName(eng) || `Engineer ID: ${eng}`}
              </option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setStatusFilter('all');
              setPriorityFilter('all');
              setEngineerFilter('all');
              setDepartmentFilter('all');
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-700 hover:bg-gray-100 transition"
          >
            Clear Filters
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 rounded-md text-sm bg-green-600 text-white hover:bg-green-700 border border-green-600 transition"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-md p-3 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-xl font-semibold text-gray-800">{summary.total}</div>
        </div>
        <div className="bg-white rounded-md p-3 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500">Open / Pending</div>
          <div className="text-xl font-semibold text-gray-800">{summary.open}</div>
        </div>
        <div className="bg-white rounded-md p-3 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500">In Progress</div>
          <div className="text-xl font-semibold text-gray-800">{summary.inProgress}</div>
        </div>
        <div className="bg-white rounded-md p-3 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500">Closed</div>
          <div className="text-xl font-semibold text-gray-800">{summary.closed}</div>
        </div>
      </div>

      {/* Error / loading */}
      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {loading && <div className="text-sm text-gray-600 mb-2">Loading...</div>}

      {/* Table */}
      {!loading && (
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-3">
          <Table columns={columns} data={tableData} onRowClick={handleRowClick} />
        </div>
      )}
    </div>
  );
};

export default Report;
