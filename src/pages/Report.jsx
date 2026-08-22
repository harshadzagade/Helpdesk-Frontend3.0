import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../lib/api';
import Table from '../components/Table';
import { useAuth } from '../context/authContext/AuthContext';

const DEFAULT_COLUMNS = {
  complaint: ['ticketId', 'raisedBy', 'subject', 'status', 'priority', 'department', 'category', 'engineer', 'createdAt'],
  request: ['ticketId', 'raisedBy', 'subject', 'status', 'priority', 'department', 'category', 'engineer', 'hod1Department', 'hod1Status', 'hod2Department', 'hod2Status', 'createdAt'],
};

const ESSENTIAL_COLUMNS = {
  complaint: ['ticketId', 'raisedBy', 'subject', 'status', 'department', 'engineer', 'createdAt'],
  request: ['ticketId', 'raisedBy', 'subject', 'status', 'department', 'engineer', 'hod1Department', 'hod1Status', 'hod2Department', 'hod2Status', 'createdAt'],
};

const BACKEND_EXPORT_KEYS = {
  ticketType: 'ticketType',
  ticketId: 'ticketId',
  raisedBy: 'raisedByName',
  raisedByInstitute: 'raisedByInstitute',
  raisedByDepartment: 'raisedByDepartment',
  subject: 'subject',
  status: 'status',
  priority: 'priority',
  department: 'targetDepartment',
  category: 'departmentCategory',
  location: 'location',
  engineer: 'engineerName',
  description: 'description',
  createdAt: 'createdAt',
  assignedAt: 'assignedAt',
  resolvedAt: 'resolvedAt',
  assignedBy: 'assignedByName',
  assignedByRole: 'assignedByRole',
  closedBy: 'closedByName',
  problemDescription: 'problemDescription',
  actionTaken: 'actionTakenComment',
  timeToAssign: 'timeToAssign',
  totalTimeToClose: 'totalTimeToClose',
  hod1Department: 'hod1Department',
  hod1Status: 'hod1Approval',
  hod1Time: 'hod1ApprovedAt',
  hod1ApprovedBy: 'hod1ApprovedByName',
  hod1ApprovedByRole: 'hod1ApprovedByRole',
  hod1Comment: 'hod1Comment',
  hod2Department: 'hod2Department',
  hod2Status: 'hod2Approval',
  hod2Time: 'hod2ApprovedAt',
  hod2ApprovedBy: 'hod2ApprovedByName',
  hod2ApprovedByRole: 'hod2ApprovedByRole',
  hod2Comment: 'hod2Comment',
  timeBetweenApprovals: 'timeBetweenApprovals',
  timeToAssignAfterApproval: 'timeToAssignAfterApproval',
  rejectionLevel: 'rejectedByLevel',
  rejectionComment: 'rejectionComment',
  rejectedAt: 'rejectedAt',
};

const Report = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const role = (user?.role || 'user').toLowerCase();
  const displayRole = user?.label || user?.role || role;
  const canConfigureColumns = ['admin', 'subadmin', 'superadmin'].includes(role);

  // 'complaint' | 'request'
  const [activeModule, setActiveModule] = useState('complaint');
  const columnStorageKey = `helpdesk.reportColumns.${role}.${activeModule}`;

  // 'all' | 'incoming' | 'department' | 'my'
  const [scope, setScope] = useState('incoming');

  // filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [engineerFilter, setEngineerFilter] = useState('all');

  // Department filter
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedColumnIds, setSelectedColumnIds] = useState([]);
  const [reportPresets, setReportPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [reportCalculations, setReportCalculations] = useState({});

  const [rawData, setRawData] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [instituteList, setInstituteList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [deptLoading, setDeptLoading] = useState(false);
  const [instituteLoading, setInstituteLoading] = useState(false);
  const [calculationLoading, setCalculationLoading] = useState(false);
  const [error, setError] = useState('');
  const [preferenceMessage, setPreferenceMessage] = useState('');

  // Role-based default scope
  useEffect(() => {
    if (role === 'admin' || role === 'subadmin' || role === 'superadmin') {
      setScope('all');
    } else if (role === 'engineer' || role === 'engineers' || role === 'user') {
      setScope('my');
    }
  }, [role, activeModule]);

  // Fetch staff list for user name, role, institute, and department mapping.
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setStaffLoading(true);
        const res = await api.get('/api/staff', { params: { limit: 10000 } });
        const list = res.data?.data || res.data || [];
        setStaffList(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Error fetching staff:', err);
        setStaffList([]);
      } finally {
        setStaffLoading(false);
      }
    };

    fetchStaff();
  }, []);

  useEffect(() => {
    const fetchInstitutes = async () => {
      try {
        setInstituteLoading(true);
        const res = await api.get('/api/institutes');
        const list = res.data?.data || res.data || [];
        setInstituteList(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Error fetching institutes:', err);
        setInstituteList([]);
      } finally {
        setInstituteLoading(false);
      }
    };

    fetchInstitutes();
  }, []);

  // Fetch departments list for department name mapping.
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setDeptLoading(true);
        const res = await api.get('/api/departments');
        const list = res.data?.data || res.data || [];
        setDeptList(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Error fetching departments:', err);
        setDeptList([]);
      } finally {
        setDeptLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  // Staff id to staff map.
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

  const getStaffRole = useCallback((id) => {
    if (id == null) return '';
    return staffById[String(id)]?.role || '';
  }, [staffById]);

  // Department id to department name map.
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

  const instituteMap = useMemo(() => {
    const map = {};
    instituteList.forEach((i) => {
      if (i?.id != null) map[String(i.id)] = i.institute || i.name || '';
    });
    return map;
  }, [instituteList]);

  const getInstituteName = useCallback((instituteId) => {
    if (instituteId == null) return '-';
    return instituteMap[String(instituteId)] || `ID: ${instituteId}`;
  }, [instituteMap]);

  const getStaffInstituteName = useCallback((id) => {
    const staff = staffById[String(id)];
    return getInstituteName(staff?.instituteId);
  }, [getInstituteName, staffById]);

  const getStaffDepartmentNames = useCallback((id) => {
    const staff = staffById[String(id)];
    const ids = Array.isArray(staff?.departmentIds) ? staff.departmentIds : [];
    if (!ids.length) return '-';
    return ids.map((deptId) => getDeptName(deptId)).filter(Boolean).join(', ') || '-';
  }, [getDeptName, staffById]);

  const stripHtml = useCallback((value) => {
    if (!value) return '';
    const withoutTags = String(value)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ');

    const textarea = document.createElement('textarea');
    textarea.innerHTML = withoutTags;
    return textarea.value.replace(/[ \t]+\n/g, '\n').replace(/\s+/g, ' ').trim();
  }, []);

  const cleanText = useCallback((value) => stripHtml(value) || '-', [stripHtml]);

  // Endpoint resolver.
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
  const formatDateTime = useCallback((value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  }, []);

  const formatDuration = useCallback((start, end) => {
    if (!start || !end) return '';
    const diff = new Date(end) - new Date(start);
    if (!Number.isFinite(diff) || diff < 0) return '';
    return `${Math.round(diff / 60000)} min`;
  }, []);

  const formatMinutes = useCallback((minutes) => {
    if (minutes == null || minutes === '') return '';
    const value = Number(minutes);
    if (!Number.isFinite(value)) return '';
    if (value < 60) return `${value} min`;

    const hours = Math.floor(value / 60);
    const remainingMinutes = value % 60;
    return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
  }, []);

  const formatStatusBadge = useCallback((value) => {
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
  }, []);

  const formatPriorityBadge = useCallback((value) => {
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
  }, []);

  // Fetch report data.
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        setRawData([]);

        if (canConfigureColumns) {
          const res = await api.get(`/api/reports/data/${activeModule}`, {
            params: {
              scope,
              status: statusFilter,
              priority: priorityFilter,
              departmentId: departmentFilter,
              engineerId: engineerFilter,
              fromDate,
              toDate,
              limit: 10000,
            },
          });
          const data = res.data?.data || [];
          setRawData(Array.isArray(data) ? data : []);
          return;
        }

        const endpoint = resolveEndpoint();
        const res = await api.get(endpoint);
        const data = res.data?.data || res.data || [];
        setRawData(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Report fetch error:', err);
        setError(err.response?.data?.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeModule, canConfigureColumns, departmentFilter, engineerFilter, fromDate, priorityFilter, resolveEndpoint, scope, statusFilter, toDate]);

  useEffect(() => {
    const fetchCalculations = async () => {
      if (!canConfigureColumns || rawData.length === 0 || rawData.every((row) => row?.reportFields)) {
        setReportCalculations({});
        return;
      }

      try {
        setCalculationLoading(true);
        const res = await api.post('/api/reports/calculations/preview', { rows: rawData });
        const list = res.data?.data || [];
        const map = {};
        if (Array.isArray(list)) {
          list.forEach((item) => {
            if (item?.id != null) map[String(item.id)] = item;
          });
        }
        setReportCalculations(map);
      } catch (err) {
        console.error('Report calculation preview error:', err);
        setReportCalculations({});
      } finally {
        setCalculationLoading(false);
      }
    };

    fetchCalculations();
  }, [canConfigureColumns, rawData]);

  const getReportCalculation = useCallback((row, key) => {
    if (row?.reportFields && row.reportFields[key] !== undefined) return row.reportFields[key];
    if (!row?.id) return undefined;
    return reportCalculations[String(row.id)]?.[key];
  }, [reportCalculations]);

  const getReportField = useCallback((row, key, fallback = '') => (
    row?.reportFields?.[key] || fallback
  ), []);

  const getCleanReportText = useCallback((row, sourceKey, calculatedKey) => {
    const calculated = getReportCalculation(row, calculatedKey);
    return calculated !== undefined ? calculated : stripHtml(row[sourceKey]);
  }, [getReportCalculation, stripHtml]);

  const getReportDuration = useCallback((row, calculatedKey, fallbackStart, fallbackEnd) => {
    const calculated = getReportCalculation(row, calculatedKey);
    return calculated !== undefined && calculated !== null
      ? formatMinutes(calculated)
      : formatDuration(fallbackStart, fallbackEnd);
  }, [formatDuration, formatMinutes, getReportCalculation]);

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

    // Department filter.
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(
        (item) =>
          item.departmentId != null &&
          String(item.departmentId) === String(departmentFilter)
      );
    }

    const summaryInfo = { total: filtered.length, open: 0, closed: 0, inProgress: 0, rejected: 0 };

    filtered.forEach((item) => {
      const status = (item.status || '').toLowerCase();
      if (status.includes('closed')) summaryInfo.closed += 1;
      else if (status.includes('progress')) summaryInfo.inProgress += 1;
      else if (status.includes('reject')) summaryInfo.rejected += 1;
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

  const reportColumnOptions = useMemo(() => {
    const ticketType = activeModule === 'request' ? 'Request' : 'Complaint';
    const approvalBadge = (value) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
        {value ? 'Approved' : 'Pending'}
      </span>
    );

    const commonColumns = [
      { id: 'ticketType', label: 'Ticket Type', tableColumn: { key: 'ticketType', label: 'Type', format: () => ticketType }, exportValue: () => ticketType },
      { id: 'ticketId', label: 'Ticket ID', tableColumn: { key: 'ticketId', label: 'Ticket ID' }, exportValue: (row) => row.ticketId || '' },
      { id: 'raisedBy', label: 'Raised By', tableColumn: { key: 'raisedBy', valueKey: 'staffId', label: 'Raised By', format: (_value, row) => getReportField(row, 'raisedByName', getStaffName(row.staffId)) || '-' }, exportValue: (row) => getReportField(row, 'raisedByName', getStaffName(row.staffId)) },
      { id: 'raisedByInstitute', label: 'Raised By Institute', tableColumn: { key: 'raisedByInstitute', valueKey: 'staffId', label: 'Raised By Institute', format: (_value, row) => getReportField(row, 'raisedByInstitute', getStaffInstituteName(row.staffId)) || '-' }, exportValue: (row) => getReportField(row, 'raisedByInstitute', getStaffInstituteName(row.staffId)) },
      { id: 'raisedByDepartment', label: 'Raised By Department', tableColumn: { key: 'raisedByDepartment', valueKey: 'staffId', label: 'Raised By Dept', format: (_value, row) => getReportField(row, 'raisedByDepartment', getStaffDepartmentNames(row.staffId)) || '-' }, exportValue: (row) => getReportField(row, 'raisedByDepartment', getStaffDepartmentNames(row.staffId)) },
      { id: 'subject', label: 'Subject', tableColumn: { key: 'subject', label: 'Subject' }, exportValue: (row) => row.subject || '' },
      { id: 'status', label: 'Status', tableColumn: { key: 'status', label: 'Status', format: formatStatusBadge }, exportValue: (row) => row.status || '' },
      { id: 'priority', label: 'Priority', tableColumn: { key: 'priority', label: 'Priority', format: formatPriorityBadge }, exportValue: (row) => row.priority || '' },
      { id: 'department', label: 'Target Department', tableColumn: { key: 'department', valueKey: 'departmentId', label: 'Department', format: (_value, row) => getReportField(row, 'targetDepartment', getDeptName(row.departmentId)) }, exportValue: (row) => getReportField(row, 'targetDepartment', getDeptName(row.departmentId)) },
      { id: 'category', label: 'Category', tableColumn: { key: 'category', valueKey: 'departmentCategory', label: 'Category' }, exportValue: (row) => row.departmentCategory || '' },
      { id: 'location', label: 'Location', tableColumn: { key: 'location', label: 'Location' }, exportValue: (row) => row.location || '' },
      { id: 'engineer', label: 'Engineer', tableColumn: { key: 'engineer', valueKey: 'assignStaffId', label: 'Engineer', format: (_value, row) => getReportField(row, 'engineerName', getStaffName(row.assignStaffId)) || '-' }, exportValue: (row) => getReportField(row, 'engineerName', getStaffName(row.assignStaffId)) },
      { id: 'description', label: 'Description', tableColumn: { key: 'description', label: 'Description', format: (_value, row) => getCleanReportText(row, 'description', 'description') || '-' }, exportValue: (row) => getCleanReportText(row, 'description', 'description') },
      { id: 'createdAt', label: 'Logged Time', tableColumn: { key: 'createdAt', label: 'Logged Time', format: formatDateTime }, exportValue: (row) => formatDateTime(row.createdAt) },
      { id: 'assignedAt', label: 'Assigned Time', tableColumn: { key: 'assignedAt', label: 'Assigned Time', format: (_value, row) => formatDateTime(row.assignedAt || row.forwardAt) }, exportValue: (row) => formatDateTime(row.assignedAt || row.forwardAt) },
      { id: 'resolvedAt', label: 'Closed Time', tableColumn: { key: 'resolvedAt', label: 'Closed Time', format: formatDateTime }, exportValue: (row) => formatDateTime(row.resolvedAt) },
      { id: 'assignedBy', label: 'Assigned By', tableColumn: { key: 'assignedBy', valueKey: 'assignedById', label: 'Assigned By', format: (_value, row) => getReportField(row, 'assignedByName', getStaffName(row.assignedById)) || '-' }, exportValue: (row) => getReportField(row, 'assignedByName', getStaffName(row.assignedById)) },
      { id: 'closedBy', label: 'Closed By', tableColumn: { key: 'closedBy', valueKey: 'closedById', label: 'Closed By', format: (_value, row) => getReportField(row, 'closedByName', getStaffName(row.closedById)) || '-' }, exportValue: (row) => getReportField(row, 'closedByName', getStaffName(row.closedById)) },
      { id: 'problemDescription', label: 'Problem Description', tableColumn: { key: 'problemDescription', label: 'Problem', format: (_value, row) => getCleanReportText(row, 'problemDescription', 'problemDescription') || '-' }, exportValue: (row) => getCleanReportText(row, 'problemDescription', 'problemDescription') },
      { id: 'actionTaken', label: 'Action Taken', tableColumn: { key: 'actionTaken', valueKey: 'actionTakenComment', label: 'Action Taken', format: (_value, row) => getCleanReportText(row, 'actionTakenComment', 'actionTakenComment') || '-' }, exportValue: (row) => getCleanReportText(row, 'actionTakenComment', 'actionTakenComment') },
      { id: 'timeToAssign', label: 'Time Taken to Assign', tableColumn: { key: 'timeToAssign', label: 'Time to Assign', format: (_value, row) => getReportDuration(row, 'timeToAssignMinutes', row.createdAt, row.assignedAt || row.forwardAt) || '-' }, exportValue: (row) => getReportDuration(row, 'timeToAssignMinutes', row.createdAt, row.assignedAt || row.forwardAt) },
      { id: 'totalTimeToClose', label: 'Total Time to Close', tableColumn: { key: 'totalTimeToClose', label: 'Total Time', format: (_value, row) => getReportDuration(row, 'totalTimeToCloseMinutes', row.createdAt, row.resolvedAt) || '-' }, exportValue: (row) => getReportDuration(row, 'totalTimeToCloseMinutes', row.createdAt, row.resolvedAt) },
    ];

    const requestColumns = [
      { id: 'assignedByRole', label: 'Assigned By Role', tableColumn: { key: 'assignedByRole', valueKey: 'assignedById', label: 'Assigned Role', format: (_value, row) => getReportField(row, 'assignedByRole', getStaffRole(row.assignedById)) || '-' }, exportValue: (row) => getReportField(row, 'assignedByRole', getStaffRole(row.assignedById)) },
      { id: 'hod1Department', label: 'HOD1 Department', tableColumn: { key: 'hod1Department', label: 'HOD1 Dept', format: (_value, row) => getReportField(row, 'hod1Department', getStaffDepartmentNames(row.staffId)) || '-' }, exportValue: (row) => getReportField(row, 'hod1Department', getStaffDepartmentNames(row.staffId)) },
      { id: 'hod1Status', label: 'HOD1 Status - Requester Department', tableColumn: { key: 'hod1Approval', label: 'HOD1 Status', format: approvalBadge }, exportValue: (row) => (row.hod1Approval ? 'Approved' : 'Pending') },
      { id: 'hod1Time', label: 'HOD1 Time', tableColumn: { key: 'hod1ApprovedAt', label: 'HOD1 Time', format: formatDateTime }, exportValue: (row) => formatDateTime(row.hod1ApprovedAt) },
      { id: 'hod1ApprovedBy', label: 'HOD1 Approved By', tableColumn: { key: 'hod1ApprovedBy', valueKey: 'hod1ApprovedById', label: 'HOD1 By', format: (_value, row) => getReportField(row, 'hod1ApprovedByName', getStaffName(row.hod1ApprovedById)) || '-' }, exportValue: (row) => getReportField(row, 'hod1ApprovedByName', getStaffName(row.hod1ApprovedById)) },
      { id: 'hod1ApprovedByRole', label: 'HOD1 Approved By Role', tableColumn: { key: 'hod1ApprovedByRole', valueKey: 'hod1ApprovedById', label: 'HOD1 Role', format: (_value, row) => getReportField(row, 'hod1ApprovedByRole', getStaffRole(row.hod1ApprovedById)) || '-' }, exportValue: (row) => getReportField(row, 'hod1ApprovedByRole', getStaffRole(row.hod1ApprovedById)) },
      { id: 'hod1Comment', label: 'HOD1 Comment', tableColumn: { key: 'hod1Comment', label: 'HOD1 Comment', format: cleanText }, exportValue: (row) => stripHtml(row.hod1Comment) },
      { id: 'hod2Department', label: 'HOD2 Department', tableColumn: { key: 'hod2Department', label: 'HOD2 Dept', format: (_value, row) => getReportField(row, 'hod2Department', getDeptName(row.departmentId)) || '-' }, exportValue: (row) => getReportField(row, 'hod2Department', getDeptName(row.departmentId)) },
      { id: 'hod2Status', label: 'HOD2 Status - Target Department', tableColumn: { key: 'hod2Approval', label: 'HOD2 Status', format: approvalBadge }, exportValue: (row) => (row.hod2Approval ? 'Approved' : 'Pending') },
      { id: 'hod2Time', label: 'HOD2 Time', tableColumn: { key: 'hod2ApprovedAt', label: 'HOD2 Time', format: formatDateTime }, exportValue: (row) => formatDateTime(row.hod2ApprovedAt) },
      { id: 'hod2ApprovedBy', label: 'HOD2 Approved By', tableColumn: { key: 'hod2ApprovedBy', valueKey: 'hod2ApprovedById', label: 'HOD2 By', format: (_value, row) => getReportField(row, 'hod2ApprovedByName', getStaffName(row.hod2ApprovedById)) || '-' }, exportValue: (row) => getReportField(row, 'hod2ApprovedByName', getStaffName(row.hod2ApprovedById)) },
      { id: 'hod2ApprovedByRole', label: 'HOD2 Approved By Role', tableColumn: { key: 'hod2ApprovedByRole', valueKey: 'hod2ApprovedById', label: 'HOD2 Role', format: (_value, row) => getReportField(row, 'hod2ApprovedByRole', getStaffRole(row.hod2ApprovedById)) || '-' }, exportValue: (row) => getReportField(row, 'hod2ApprovedByRole', getStaffRole(row.hod2ApprovedById)) },
      { id: 'hod2Comment', label: 'HOD2 Comment', tableColumn: { key: 'hod2Comment', label: 'HOD2 Comment', format: cleanText }, exportValue: (row) => stripHtml(row.hod2Comment) },
      { id: 'timeBetweenApprovals', label: 'Time Between First and Second Approval', tableColumn: { key: 'timeBetweenApprovals', label: 'Approval Time', format: (_value, row) => getReportDuration(row, 'timeBetweenApprovalsMinutes', row.hod1ApprovedAt, row.hod2ApprovedAt) || '-' }, exportValue: (row) => getReportDuration(row, 'timeBetweenApprovalsMinutes', row.hod1ApprovedAt, row.hod2ApprovedAt) },
      { id: 'timeToAssignAfterApproval', label: 'Time Taken to Assign After Approval', tableColumn: { key: 'timeToAssignAfterApproval', label: 'Approval to Assign', format: (_value, row) => getReportDuration(row, 'timeToAssignAfterApprovalMinutes', row.hod2ApprovedAt, row.assignedAt) || '-' }, exportValue: (row) => getReportDuration(row, 'timeToAssignAfterApprovalMinutes', row.hod2ApprovedAt, row.assignedAt) },
      { id: 'rejectionLevel', label: 'Rejection Level', tableColumn: { key: 'rejectedByLevel', label: 'Rejected By Level' }, exportValue: (row) => row.rejectedByLevel || '' },
      { id: 'rejectionComment', label: 'Rejection Comment', tableColumn: { key: 'rejectionComment', valueKey: 'rejectionComment', label: 'Rejection Comment', format: cleanText }, exportValue: (row) => stripHtml(row.rejectionComment) },
      { id: 'rejectedAt', label: 'Rejected At', tableColumn: { key: 'rejectedAt', label: 'Rejected At', format: formatDateTime }, exportValue: (row) => formatDateTime(row.rejectedAt) },
    ];

    return activeModule === 'request' ? [...commonColumns, ...requestColumns] : commonColumns;
  }, [activeModule, cleanText, formatDateTime, formatPriorityBadge, formatStatusBadge, getCleanReportText, getDeptName, getReportDuration, getReportField, getStaffDepartmentNames, getStaffInstituteName, getStaffName, getStaffRole, stripHtml]);

  const filterPreset = useMemo(() => ({
    scope,
    statusFilter,
    priorityFilter,
    departmentFilter,
    engineerFilter,
    fromDate,
    toDate,
  }), [departmentFilter, engineerFilter, fromDate, priorityFilter, scope, statusFilter, toDate]);

  useEffect(() => {
    const defaultIds = DEFAULT_COLUMNS[activeModule] || [];
    if (!canConfigureColumns) {
      setSelectedColumnIds(defaultIds);
      return;
    }

    const allowedIds = new Set(reportColumnOptions.map((column) => column.id));
    const readLocalColumns = () => {
      let parsed = null;
      try {
        const saved = localStorage.getItem(columnStorageKey);
        parsed = saved ? JSON.parse(saved) : null;
      } catch {
        parsed = null;
      }

      return Array.isArray(parsed) ? parsed.filter((id) => allowedIds.has(id)) : [];
    };

    const loadPreferences = async () => {
      setPreferencesLoading(true);
      setPreferenceMessage('');

      try {
        const res = await api.get(`/api/reports/preferences/${activeModule}`);
        const data = res.data?.data || {};
        const serverColumns = Array.isArray(data.default?.columns)
          ? data.default.columns.filter((id) => allowedIds.has(id))
          : [];

        setSelectedColumnIds(serverColumns.length ? serverColumns : readLocalColumns().length ? readLocalColumns() : defaultIds);
        setReportPresets(Array.isArray(data.presets) ? data.presets : []);
      } catch (err) {
        console.error('Report preference load error:', err);
        const localColumns = readLocalColumns();
        setSelectedColumnIds(localColumns.length ? localColumns : defaultIds);
        setReportPresets([]);
        setPreferenceMessage('Column settings are saved on this browser until backend preferences are available.');
      } finally {
        setPreferencesLoading(false);
      }
    };

    loadPreferences();
  }, [activeModule, canConfigureColumns, columnStorageKey, reportColumnOptions]);

  const selectedColumnOptions = useMemo(() => {
    const selectedSet = new Set(selectedColumnIds);
    const selected = reportColumnOptions.filter((column) => selectedSet.has(column.id));
    if (selected.length) return selected;
    const defaultSet = new Set(DEFAULT_COLUMNS[activeModule] || []);
    return reportColumnOptions.filter((column) => defaultSet.has(column.id));
  }, [activeModule, reportColumnOptions, selectedColumnIds]);

  const columns = useMemo(() => selectedColumnOptions.map((column) => column.tableColumn), [selectedColumnOptions]);

  const persistDefaultColumns = useCallback(async (columnIds) => {
    if (!canConfigureColumns) return;

    try {
      await api.put(`/api/reports/preferences/${activeModule}/default`, { columns: columnIds });
      setPreferenceMessage('Column preference saved.');
    } catch (err) {
      console.error('Report preference save error:', err);
      setPreferenceMessage('Column preference saved in this browser. Backend save failed.');
    }
  }, [activeModule, canConfigureColumns]);

  const saveSelectedColumns = useCallback((nextIds) => {
    const minimumIds = nextIds.length ? nextIds : ['ticketId'];
    setSelectedColumnIds(minimumIds);
    if (canConfigureColumns) {
      localStorage.setItem(columnStorageKey, JSON.stringify(minimumIds));
      persistDefaultColumns(minimumIds);
    }
  }, [canConfigureColumns, columnStorageKey, persistDefaultColumns]);

  const toggleReportColumn = useCallback((columnId) => {
    const nextIds = selectedColumnIds.includes(columnId)
      ? selectedColumnIds.filter((id) => id !== columnId)
      : [...selectedColumnIds, columnId];
    saveSelectedColumns(nextIds);
  }, [saveSelectedColumns, selectedColumnIds]);

  const selectAllReportColumns = useCallback(() => saveSelectedColumns(reportColumnOptions.map((column) => column.id)), [reportColumnOptions, saveSelectedColumns]);
  const resetDefaultReportColumns = useCallback(() => saveSelectedColumns(DEFAULT_COLUMNS[activeModule] || []), [activeModule, saveSelectedColumns]);
  const clearOptionalReportColumns = useCallback(() => saveSelectedColumns(ESSENTIAL_COLUMNS[activeModule] || ['ticketId']), [activeModule, saveSelectedColumns]);

  const saveReportPreset = useCallback(async () => {
    if (!presetName.trim()) {
      setPreferenceMessage('Enter a preset name first.');
      return;
    }

    try {
      const res = await api.post(`/api/reports/preferences/${activeModule}/presets`, {
        name: presetName.trim(),
        columns: selectedColumnIds,
        filters: filterPreset,
      });
      const savedPreset = res.data?.data;
      if (savedPreset) {
        setReportPresets((presets) => {
          const exists = presets.some((preset) => preset.id === savedPreset.id);
          return exists
            ? presets.map((preset) => (preset.id === savedPreset.id ? savedPreset : preset))
            : [...presets, savedPreset];
        });
      }
      setPresetName('');
      setPreferenceMessage('Report preset saved.');
    } catch (err) {
      console.error('Report preset save error:', err);
      setPreferenceMessage(err.response?.data?.message || 'Failed to save report preset.');
    }
  }, [activeModule, filterPreset, presetName, selectedColumnIds]);

  const applyReportPreset = useCallback((preset) => {
    const allowedIds = new Set(reportColumnOptions.map((column) => column.id));
    const presetColumns = Array.isArray(preset?.columns)
      ? preset.columns.filter((id) => allowedIds.has(id))
      : [];
    const presetFilters = preset?.filters || {};

    if (presetColumns.length) saveSelectedColumns(presetColumns);
    setScope(presetFilters.scope || 'all');
    setStatusFilter(presetFilters.statusFilter || 'all');
    setPriorityFilter(presetFilters.priorityFilter || 'all');
    setDepartmentFilter(presetFilters.departmentFilter || 'all');
    setEngineerFilter(presetFilters.engineerFilter || 'all');
    setFromDate(presetFilters.fromDate || '');
    setToDate(presetFilters.toDate || '');
    setPreferenceMessage(`Loaded preset: ${preset.name}`);
  }, [reportColumnOptions, saveSelectedColumns]);

  const deleteReportPreset = useCallback(async (presetId) => {
    try {
      await api.delete(`/api/reports/preferences/${activeModule}/presets/${presetId}`);
      setReportPresets((presets) => presets.filter((preset) => preset.id !== presetId));
      setPreferenceMessage('Report preset deleted.');
    } catch (err) {
      console.error('Report preset delete error:', err);
      setPreferenceMessage(err.response?.data?.message || 'Failed to delete report preset.');
    }
  }, [activeModule]);

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

  const handleExportExcel = () => {
    if (!tableData || tableData.length === 0) {
      alert('Export ke liye koi data nahi mila.');
      return;
    }

    const exportRows = tableData.map((row) => {
      const output = {};
      selectedColumnOptions.forEach((column) => {
        output[column.label] = column.exportValue(row);
      });
      return output;
    });

    const sheetName = activeModule === 'complaint' ? 'Complaint Audit' : 'Request Audit';
    const wb = XLSX.utils.book_new();
    const summaryRows = [
      ['Report Type', activeModule === 'complaint' ? 'Complaint Report' : 'Request Report'],
      ['Generated By', user?.name || user?.email || displayRole],
      ['Generated At', formatDateTime(new Date())],
      ['Role', displayRole],
      ['Scope', getScopeLabel(scope)],
      ['Records Exported', tableData.length],
      ['From Date', fromDate || 'All'],
      ['To Date', toDate || 'All'],
      ['Status Filter', statusFilter === 'all' ? 'All Statuses' : statusFilter],
      ['Priority Filter', priorityFilter === 'all' ? 'All Priorities' : priorityFilter],
      ['Department Filter', departmentFilter === 'all' ? 'All Departments' : getDeptName(departmentFilter)],
      ['Engineer Filter', engineerFilter === 'all' ? 'All Engineers' : getStaffName(engineerFilter) || `Engineer ID: ${engineerFilter}`],
      ['Selected Columns', selectedColumnOptions.map((column) => column.label).join(', ')],
      [],
      ['Total', summary.total],
      ['Open / Pending', summary.open],
      ['In Progress', summary.inProgress],
      ['Closed', summary.closed],
      ['Rejected', summary.rejected],
      [],
      ['Calculation Notes', 'Open/Pending means tickets waiting for action. Time columns are counted in minutes between the two shown timestamps.'],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet['!cols'] = [{ wch: 24 }, { wch: 80 }];

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const headers = selectedColumnOptions.map((column) => column.label);
    ws['!cols'] = headers.map((header) => {
      const maxCellWidth = exportRows.reduce((max, row) => {
        const value = row[header] == null ? '' : String(row[header]);
        return Math.max(max, value.length);
      }, header.length);

      return { wch: Math.min(Math.max(maxCellWidth + 2, 12), 45) };
    });

    if (exportRows.length > 0 && headers.length > 0) {
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: exportRows.length, c: headers.length - 1 },
        }),
      };
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    }

    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${sheetName}-${today}.xlsx`);
  };

  const handleExportBackendCsv = async () => {
    if (!canConfigureColumns) return;

    try {
      const exportColumnKeys = selectedColumnIds
        .map((id) => BACKEND_EXPORT_KEYS[id])
        .filter(Boolean);
      const res = await api.get(`/api/reports/export/${activeModule}.csv`, {
        params: {
          scope,
          status: statusFilter,
          priority: priorityFilter,
          departmentId: departmentFilter,
          engineerId: engineerFilter,
          fromDate,
          toDate,
          columns: exportColumnKeys.join(','),
          limit: 10000,
        },
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `${activeModule}-report-${today}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backend CSV export error:', err);
      alert(err.response?.data?.message || 'Backend CSV export failed.');
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Reports</h2>

      <div className="mb-2 text-xs text-gray-500">
        Role: <span className="font-medium">{displayRole}</span> | Scope:{' '}
        <span className="font-medium">{getScopeLabel(scope)}</span> | Raw: {rawData.length} | Shown:{' '}
        {tableData.length} {staffLoading && '| Loading staff...'} {deptLoading && '| Loading depts...'}{' '}
        {instituteLoading && '| Loading institutes...'} {preferencesLoading && '| Loading report settings...'}{' '}
        {calculationLoading && '| Checking calculations...'}
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

        {/* Department */}
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
          {canConfigureColumns && (
            <button
              type="button"
              onClick={() => setShowColumnPanel((open) => !open)}
              className="px-3 py-2 border border-blue-300 rounded-md text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
            >
              Columns ({selectedColumnOptions.length})
            </button>
          )}

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

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((open) => !open)}
              className="px-3 py-2 rounded-md text-sm bg-green-600 text-white hover:bg-green-700 border border-green-600 transition"
            >
              Export ({tableData.length})
            </button>

            {showExportMenu && (
              <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-gray-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportExcel();
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Export to Excel
                </button>

                {canConfigureColumns && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportBackendCsv();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Export to CSV
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {canConfigureColumns && showColumnPanel && (
        <div className="mb-4 rounded-md border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Report Columns</h3>
              <p className="text-xs text-gray-500">
                These columns will appear in the table and in the Excel export for this {activeModule} report.
              </p>
              {preferenceMessage && (
                <p className="mt-1 text-xs text-blue-600">{preferenceMessage}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={selectAllReportColumns} className="rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
                Select All
              </button>
              <button type="button" onClick={clearOptionalReportColumns} className="rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
                Clear Optional
              </button>
              <button type="button" onClick={resetDefaultReportColumns} className="rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
                Reset Default
              </button>
            </div>
          </div>

          <div className="mb-4 rounded-md border border-gray-100 bg-gray-50 p-3">
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="flex min-w-[220px] flex-col">
                <label className="mb-1 text-xs text-gray-600">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Monthly audit"
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={saveReportPreset}
                className="rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                Save Preset
              </button>
            </div>

            {reportPresets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {reportPresets.map((preset) => (
                  <div key={preset.id} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => applyReportPreset(preset)}
                      className="text-xs font-medium text-gray-700 hover:text-blue-700"
                    >
                      {preset.name || 'Saved Preset'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReportPreset(preset.id)}
                      className="rounded border border-red-200 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {reportColumnOptions.map((column) => (
              <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={selectedColumnIds.includes(column.id)}
                  onChange={() => toggleReportColumn(column.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
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
        <div className="bg-white rounded-md p-3 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500">Rejected</div>
          <div className="text-xl font-semibold text-gray-800">{summary.rejected}</div>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-gray-100 bg-gray-50 px-3 py-3 text-xs text-gray-600">
        <div className="mb-1 font-semibold text-gray-700">How this report is counted</div>
        <div className="grid gap-1 md:grid-cols-2">
          <p>Total = all tickets matching the selected filters.</p>
          <p>Open/Pending = tickets waiting for action.</p>
          <p>In Progress = tickets assigned and being worked on.</p>
          <p>Closed = tickets completed by the helpdesk team.</p>
          <p>Rejected = requests rejected by HOD/admin.</p>
          <p>Time columns are counted in minutes between the two shown timestamps.</p>
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
        <div className="w-full max-w-full min-w-0 overflow-hidden bg-white rounded-md shadow-sm border border-gray-100 p-3">
          <div className="w-full max-w-full min-w-0">
            <Table columns={columns} data={tableData} onRowClick={handleRowClick} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Report;
