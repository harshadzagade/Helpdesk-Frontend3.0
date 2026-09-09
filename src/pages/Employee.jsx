// src/pages/Employee.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import Table from '../components/Table';
import Searchbar from '../components/Searchbar';
import FormInput from '../components/FormInput';
import EmployeeDetails from './EmployeeDetailsV2';
import api from '../lib/api';
import { useAuth } from '../context/authContext/AuthContext';
import Swal from 'sweetalert2';

const toStr = (v) => (v == null ? '' : String(v));
const toInt = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const ROLE_OPTIONS = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'subadmin', label: 'Sub Admin' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'user', label: 'User' },
];

// ✅ Admin can assign only these (matches controller rule)
const ADMIN_ASSIGNABLE_ROLES = [
  { value: 'user', label: 'User' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'subadmin', label: 'Sub Admin' },
];

const EmployeeTypes = [
  { value: 'Teaching', label: 'Teaching' },
  { value: 'Non-Teaching', label: 'Non-Teaching' },
];

const normalizeIntArray = (v) => {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',') : []);
  return arr
    .map(x => Number(String(x).trim()))
    .filter(n => Number.isInteger(n));
};


const Employee = () => {
  // NOTE: many auth contexts expose `user` (or `authUser`). If your context uses different name, change here.
 const { hasRole, activeDepartmentId, canManageExtensions } = useAuth();

  const isSuperadmin = hasRole('superadmin');
  const isAdmin = hasRole('admin');
  const isSubadmin = hasRole('subadmin');

  const canViewRole = isSuperadmin;
  const canManage = isSuperadmin; // only superadmin can create/update/delete
  const canChangeRole = isAdmin || isSuperadmin; // both can change role, but admins have restrictions in onChangeRole handler
  const canEditExtension = isSuperadmin || canManageExtensions;
  const canUseEmployeeActions = isSuperadmin;

  const activeDeptId = activeDepartmentId != null ? Number(activeDepartmentId) : null;
  const formRoleOptions = ROLE_OPTIONS;


  // ui state
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'archived'
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const employeeFormRef = useRef(null);

  // data
  const [staff, setStaff] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [departments, setDepartments] = useState([]);

  // filters & search (IDs)
  const [filters, setFilters] = useState({
    instituteId: null,
    role: '',
    departmentId: null,
    employeeType: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  // form (IDs)
  const [form, setForm] = useState({
    id: null,
    firstname: '',
    middlename: '',
    lastname: '',
    email: '',
    role: null, // react-select option
    institute: null, // option: {value:id,label:name}
    department: [], // multi options: [{value:id,label:name}]
    employeeType: null, // option
    phoneNumber: '',
    contactExtension: '',
    _isEditingSuper: false,
  });

  const resetForm = () => {
    setForm({
      id: null,
      firstname: '',
      middlename: '',
      lastname: '',
      email: '',
      role: null,
      institute: null,
      department: [],
      employeeType: null,
      phoneNumber: '',
      contactExtension: '',
      _isEditingSuper: false,
    });
    setIsEditing(false);
  };

  const canSubmitEmployeeForm = canManage;

  // load lists
  const fetchLists = async () => {
    try {
      const [i, d] = await Promise.all([
        api.get('/api/institutes'),
        api.get('/api/departments'),
      ]);

      const inst = i.data || [];
      const dept = d.data || d || [];

      setInstitutes(Array.isArray(inst) ? inst : []);
      setDepartments(Array.isArray(dept) ? dept : []);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to load lists';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Load Failed', text: msg });
    }
  };

  // build lookup maps
  const instituteById = useMemo(() => {
    const map = new Map();
    (institutes || []).forEach(x => {
      const id = toInt(x?.id ?? x?.instituteId);
      if (id != null) map.set(id, x?.institute ?? x?.name ?? String(id));
    });
    return map;
  }, [institutes]);

  const departmentById = useMemo(() => {
    const map = new Map();
    (departments || []).forEach(x => {
      const id = toInt(x?.id ?? x?.departmentId);
      if (id != null) map.set(id, x?.department ?? x?.name ?? String(id));
    });
    return map;
  }, [departments]);

  // load staff
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoints =
        viewMode === 'archived'
          ? ['/api/staffArchive/archiveStaff', '/api/staffArchive/archivedStaff', '/api/staffArchive']
          : ['/api/staff'];

      let res = null;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          res = await api.get(endpoint);
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!res) throw lastError || new Error('Failed to load staff');

      let staffRows = [];
      if (Array.isArray(res.data?.data)) staffRows = res.data.data;
      else if (Array.isArray(res.data?.rows)) staffRows = res.data.rows;
      else if (Array.isArray(res.data)) staffRows = res.data;
      else if (Array.isArray(res.data?.staff)) staffRows = res.data.staff;

      // ✅ enrich rows: fullName + instituteName + departmentNames
      const enriched = staffRows.map(row => {
        const instId = toInt(row?.instituteId ?? row?.institute); // fallback
        const deptIds = Array.isArray(row?.departmentIds)
          ? row.departmentIds.map(toInt).filter(n => n != null)
          : (Array.isArray(row?.department)
            ? row.department.map(toInt).filter(n => n != null)
            : []);

        const instituteName =
          (instId != null && instituteById.get(instId)) ||
          (typeof row?.institute === 'string' ? row.institute : '');

        const departmentNames =
          deptIds.length
            ? deptIds.map(id => departmentById.get(id) || String(id))
            : (Array.isArray(row?.department)
              ? row.department.map(x => String(x))
              : []);

        return {
          ...row,
          instituteId: instId ?? row?.instituteId ?? null,
          departmentIds: deptIds.length ? deptIds : (row?.departmentIds ?? []),
          instituteName,
          departmentNames,
          fullName: `${toStr(row?.firstname)} ${toStr(row?.middlename ?? '')} ${toStr(row?.lastname)}`.trim(),
        };
      });

      setStaff(enriched);
    } catch (e) {
      console.error('Fetch error:', e);
      const msg = e?.response?.data?.message || e.message || 'Failed to load staff';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Load Failed', text: msg });
    } finally {
      setLoading(false);
    }
  }, [departmentById, instituteById, viewMode]);

  useEffect(() => { fetchLists(); }, []);
  // important: refresh staff after lists loaded so names resolve
  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // options built from data (IDs as value)
  const instituteOptions = useMemo(
    () => (institutes || []).map(x => ({
      value: toInt(x?.id ?? x?.instituteId),
      label: x?.institute ?? x?.name ?? 'Institute'
    })).filter(o => o.value != null),
    [institutes]
  );

  const departmentOptions = useMemo(
    () => (departments || []).map(x => ({
      value: toInt(x?.id ?? x?.departmentId),
      label: x?.department ?? x?.name ?? 'Department'
    })).filter(o => o.value != null),
    [departments]
  );

  // filters
  const handleFilterChange = (opt, { name }) => {
    if (name === 'instituteId') {
      setFilters(prev => ({ ...prev, instituteId: opt ? opt.value : null }));
      return;
    }
    if (name === 'departmentId') {
      setFilters(prev => ({ ...prev, departmentId: opt ? opt.value : null }));
      return;
    }
    setFilters(prev => ({ ...prev, [name]: opt ? opt.value : '' }));
  };

  const clearFilters = () =>
    setFilters({ instituteId: null, role: '', departmentId: null, employeeType: '' });

  const baseStaff = useMemo(() => {
    if (viewMode === 'myDepartment' && isAdmin) {
      return (staff || []).filter(emp => {
        const empDeptIds = normalizeIntArray(emp.departmentIds);
        return activeDeptId != null && empDeptIds.includes(activeDeptId);
      });
    }
    return staff || [];
  }, [staff, viewMode, isAdmin, activeDeptId]);

  const filteredData = useMemo(() => {
    const q = toStr(searchTerm).trim().toLowerCase();

    return (baseStaff || []).filter(emp => {
      const deptIds = Array.isArray(emp.departmentIds)
        ? emp.departmentIds.map(toInt).filter(v => v != null)
        : [];

      const deptNames = Array.isArray(emp.departmentNames)
        ? emp.departmentNames
        : [];

      const empRole = toStr(emp.role).toLowerCase();
      const empEmployeeType = toStr(emp.employeeType);

      const matchesFilters =
        (filters.instituteId == null) &&
        (filters.role === '' || empRole === toStr(filters.role).toLowerCase()) &&
        (filters.departmentId == null || deptIds.includes(toInt(filters.departmentId))) &&
        (filters.employeeType === '' || empEmployeeType === toStr(filters.employeeType));

      if (!matchesFilters) return false;
      if (!q) return true;

      return (
        toStr(emp.fullName).toLowerCase().includes(q) ||
        toStr(emp.email).toLowerCase().includes(q) ||
        deptNames.join(', ').toLowerCase().includes(q) ||
        (isSuperadmin && empRole.includes(q)) ||
        toStr(emp.phoneNumber).toLowerCase().includes(q) ||
        toStr(emp.contactExtension).toLowerCase().includes(q)
      );
    });
  }, [baseStaff, filters, searchTerm]);

  // columns
  const columns = [
    { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'departmentNames',
      label: 'Department(s)',
      format: (_value, row) => Array.isArray(row.departmentNames) ? row.departmentNames.join(', ') : ''
    },
  ];

  if (canViewRole) columns.push({ key: 'role', label: 'Role' });

  columns.push(
    {
      key: 'phoneNumber',
      label: 'Contact No',
      format: (_value, row) => toStr(row.phoneNumber)
    },
    {
      key: 'contactExtension',
      label: 'Extension',
      format: (_value, row) => toStr(row.contactExtension)
    },
  );

  const isSuper = (r) => String(r || '').toLowerCase() === 'superadmin';
  const isAdminRole = (r) => String(r || '').toLowerCase() === 'admin';

  const sharesDeptWithLoggedInAdmin = (row) => {
    if (!isAdmin) return true;
    if (activeDeptId == null) return true;

    const targetDeptIds = normalizeIntArray(row?.departmentIds);
    return targetDeptIds.includes(activeDeptId);
  };

  const getRoleChangeDepartmentId = (row) => {
    const targetDeptIds = normalizeIntArray(row?.departmentIds);
    if (isAdmin && activeDeptId != null && targetDeptIds.includes(activeDeptId)) {
      return activeDeptId;
    }
    return targetDeptIds[0] || activeDeptId || null;
  };

  const onUpdateExtension = async (row) => {
    if (!canEditExtension) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'You do not have permission to update extension numbers.' });
      return;
    }
    if (viewMode !== 'active' && viewMode !== 'myDepartment') {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Extension update is only available for active employees.' });
      return;
    }

    const currentValue = toStr(row.contactExtension);
    const result = await Swal.fire({
      title: `Update Extension: ${toStr(row.fullName)}`,
      input: 'text',
      inputValue: currentValue,
      inputLabel: 'Extension Number',
      inputPlaceholder: 'Enter extension number, or leave blank to clear',
      showCancelButton: true,
      confirmButtonText: 'Update',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      inputValidator: (value) => {
        const normalized = toStr(value).trim();
        if (!normalized) return undefined;
        if (!/^\d+$/.test(normalized)) return 'Extension should contain only digits';
        return undefined;
      },
    });

    if (!result.isConfirmed) return;
    const nextExtension = toStr(result.value).trim();

    try {
      setLoading(true);
      Swal.fire({ title: 'Updating extension…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await api.patch(`/api/staff/${row.id}/contact-extension`, {
        contactExtension: nextExtension,
      });
      await Swal.fire({
        icon: 'success',
        title: 'Updated',
        text: nextExtension ? 'Extension number updated successfully.' : 'Extension number cleared successfully.',
      });
      fetchStaff();
      setSelectedEmployee((prev) => (
        prev && prev.id === row.id
          ? { ...prev, contactExtension: nextExtension || null }
          : prev
      ));
    } catch (e) {
      const msg = e?.response?.data?.message || 'Extension update failed';
      Swal.fire({ icon: 'error', title: 'Update Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (row) => {
    if (!isSuperadmin) return;

    const fullName = toStr(row.fullName) || `${toStr(row.firstname)} ${toStr(row.lastname)}`.trim() || toStr(row.email);
    const confirm = await Swal.fire({
      icon: 'warning',
      title: `Reset password for ${fullName}?`,
      text: 'The user will receive a temporary password and must set a new password on next login.',
      showCancelButton: true,
      confirmButtonText: 'Reset Password',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);
      Swal.fire({ title: 'Resetting password...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const res = await api.patch(`/api/staff/${row.id}/reset-password`);
      const temporaryPassword = res.data?.temporaryPassword;
      const mailSent = Boolean(res.data?.mailSent);
      const mailWarning = res.data?.mailWarning;

      await Swal.fire({
        icon: mailSent ? 'success' : 'warning',
        title: 'Password Reset',
        html: `
          <div style="text-align:left">
            <p>The user must login with the temporary password and create a new password.</p>
            ${temporaryPassword ? `<p><strong>Temporary Password:</strong> ${temporaryPassword}</p>` : ''}
            ${
              mailSent
                ? '<p style="color:#047857;"><strong>Email sent to user.</strong></p>'
                : `<p style="color:#b45309;"><strong>Email not sent.</strong> ${mailWarning || 'Please share the temporary password manually.'}</p>`
            }
          </div>
        `,
      });
      fetchStaff();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Password reset failed';
      Swal.fire({ icon: 'error', title: 'Reset Password Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const onManagePermissions = async (row) => {
    if (!isSuperadmin) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Only superadmin can manage staff permissions.' });
      return;
    }
    if (viewMode !== 'active') {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Permission updates are only available in active view.' });
      return;
    }

    const result = await Swal.fire({
      title: `Permissions: ${toStr(row.fullName)}`,
      html: `
        <div class="text-left space-y-4">
          <label style="display:flex;gap:8px;align-items:center;">
            <input id="swal-can-manage-extensions" type="checkbox" ${(row.canManageExtensions || row.canUpdateExtensions) ? 'checked' : ''} />
            <span>Can manage extension numbers</span>
          </label>
          <label style="display:flex;gap:8px;align-items:center;">
            <input id="swal-can-manage-policies" type="checkbox" ${(row.canManagePolicies || row.canUploadPolicies) ? 'checked' : ''} />
            <span>Can manage policies</span>
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Save',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusConfirm: false,
      preConfirm: () => ({
        canManageExtensions: !!document.getElementById('swal-can-manage-extensions')?.checked,
        canManagePolicies: !!document.getElementById('swal-can-manage-policies')?.checked,
      }),
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      Swal.fire({ title: 'Saving permissions…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const payload = {
        canManageExtensions: !!result.value.canManageExtensions,
        canManagePolicies: !!result.value.canManagePolicies,
      };
      await api.patch(`/api/staff/permissions/${row.id}`, payload);
      await Swal.fire({ icon: 'success', title: 'Updated', text: 'Staff permissions updated successfully.' });
      fetchStaff();
      setSelectedEmployee((prev) => (
        prev && prev.id === row.id
          ? { ...prev, ...payload }
          : prev
      ));
    } catch (e) {
      const msg = e?.response?.data?.message || 'Permission update failed';
      Swal.fire({ icon: 'error', title: 'Update Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Change Role (Admin scoped endpoint)
  const onChangeRole = async (row) => {
    if (!canChangeRole) return;

    if (!(viewMode === 'active' || viewMode === 'myDepartment')) {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Role change is only in active or my department view.' });
      return;
    }

    // admin restrictions (UI-side)
    if (isAdmin) {
      if (!sharesDeptWithLoggedInAdmin(row)) {
        Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'You can change role only for your department staff.' });
        return;
      }
      if (isSuper(row.role) || isAdminRole(row.role)) {
        Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Admin cannot change admin/superadmin roles.' });
        return;
      }
    }

    const options = (isAdmin ? ADMIN_ASSIGNABLE_ROLES : ROLE_OPTIONS)
      .reduce((acc, x) => {
        acc[x.value] = x.label;
        return acc;
      }, {});

    const currentRole = String(row.role || '').toLowerCase();

    const { value: selectedRole } = await Swal.fire({
      title: `Change Role: ${toStr(row.fullName)}`,
      input: 'select',
      inputOptions: options,
      inputValue: options[currentRole] ? currentRole : (isAdmin ? 'user' : currentRole),
      inputPlaceholder: 'Select new role',
      showCancelButton: true,
      confirmButtonText: 'Update',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      preConfirm: (val) => {
        if (!val) {
          Swal.showValidationMessage('Please select a role');
          return false;
        }
        if (val === currentRole) {
          Swal.showValidationMessage('Selected role is same as current');
          return false;
        }
        return val;
      },
    });

    if (!selectedRole) return;

    try {
      setLoading(true);
      Swal.fire({ title: 'Updating role…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      // ✅ NEW endpoint
      const roleChangeDepartmentId = getRoleChangeDepartmentId(row);
      const config = roleChangeDepartmentId
        ? { headers: { 'x-department-id': String(roleChangeDepartmentId) } }
        : undefined;

      await api.patch(`/api/staff/role/${row.id}`, { role: selectedRole }, config);

      await Swal.fire({ icon: 'success', title: 'Updated', text: 'Role updated successfully.' });
      fetchStaff();

      // If details panel open, refresh selected row in it too
      setSelectedEmployee(prev => (prev && prev.id === row.id ? { ...prev, role: selectedRole } : prev));
    } catch (e) {
      const msg = e?.response?.data?.message || 'Role update failed';
      Swal.fire({ icon: 'error', title: 'Role Update Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Edit
  const onEdit = (row) => {
    if (!canManage) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Only superadmin can edit.' });
      return;
    }
    if (viewMode !== 'active') {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Edit archived employees via Recover.' });
      return;
    }
    if (isSuper(row.role) && !isSuperadmin) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Only superadmin can edit superadmin.' });
      return;
    }

    const roleOption = row.role ? ROLE_OPTIONS.find(r => r.value === String(row.role).toLowerCase()) : null;

    const instId = toInt(row.instituteId);
    const instOpt =
      instId != null
        ? instituteOptions.find(o => o.value === instId) ||
        { value: instId, label: row.instituteName || `Institute #${instId}` }
        : null;

    const deptIds = Array.isArray(row.departmentIds) ? row.departmentIds.map(toInt).filter(n => n != null) : [];
    const deptOpts = deptIds.map(id => (
      departmentOptions.find(o => o.value === id) || { value: id, label: departmentById.get(id) || `Dept #${id}` }
    ));

    const empTypeOpt =
      row.employeeType ? EmployeeTypes.find(o => o.value === row.employeeType) || { value: row.employeeType, label: row.employeeType } : null;

    setForm({
      id: row.id,
      firstname: toStr(row.firstname),
      middlename: toStr(row.middlename),
      lastname: toStr(row.lastname),
      email: toStr(row.email),
      role: roleOption,
      institute: instOpt,
      department: deptOpts,
      employeeType: empTypeOpt,
      phoneNumber: toStr(row.phoneNumber),
      contactExtension: toStr(row.contactExtension),
      _isEditingSuper: isSuper(row.role),
    });

    setIsEditing(true);
    setIsFormVisible(true);
    setTimeout(() => {
      employeeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  // Delete
  const onDelete = async (row) => {
    if (!canManage) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Only superadmin can delete.' });
      return;
    }
    if (viewMode !== 'active') {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Delete archived employees via Permanent Delete.' });
      return;
    }
    if (isSuper(row.role)) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Superadmin cannot be deleted.' });
      return;
    }

    const fullName = toStr(row.fullName);
    const confirm = await Swal.fire({
      title: `Delete "${fullName}"?`,
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);
      Swal.fire({ title: 'Deleting…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await api.delete(`/api/staff/${row.id}`);
      await Swal.fire({ icon: 'success', title: 'Deleted', text: 'Employee deleted.' });
      fetchStaff();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Delete failed';
      Swal.fire({ icon: 'error', title: 'Delete Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Recover
  const onRecover = async (row) => {
    if (!canManage) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Only superadmin can recover.' });
      return;
    }
    if (viewMode !== 'archived') {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Recover only available in archived view.' });
      return;
    }

    const fullName = toStr(row.fullName);
    const confirm = await Swal.fire({
      title: `Recover "${fullName}"?`,
      text: 'This will restore the employee to the active list.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, recover',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);
      Swal.fire({ title: 'Recovering…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await api.post(`/api/staffArchive/recover/${row.id}`);
      await Swal.fire({ icon: 'success', title: 'Recovered', text: 'Employee recovered successfully.' });
      fetchStaff();
      setViewMode('active');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Recover failed';
      Swal.fire({ icon: 'error', title: 'Recover Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Permanent Delete
  const onPermanentDelete = async (row) => {
    if (!canManage) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Only superadmin can permanently delete.' });
      return;
    }
    if (viewMode !== 'archived') {
      Swal.fire({ icon: 'info', title: 'Read only', text: 'Permanent delete only available in archived view.' });
      return;
    }

    const fullName = toStr(row.fullName);
    const confirm = await Swal.fire({
      title: `Permanently delete "${fullName}"?`,
      text: 'This action cannot be undone and will remove the record forever.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, permanently delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);
      Swal.fire({ title: 'Permanently deleting…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await api.delete(`/api/staffArchive/permanent/${row.id}`);
      await Swal.fire({ icon: 'success', title: 'Permanently Deleted', text: 'Employee permanently deleted.' });
      fetchStaff();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Permanent delete failed';
      Swal.fire({ icon: 'error', title: 'Permanent Delete Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const actions = (() => {
    const list = [];

    // ✅ Admin + Superadmin: role change (active view only)
    if (canChangeRole && (viewMode === 'myDepartment' || (isSuperadmin && viewMode === 'active'))) {
      list.push({
        label: 'Change Role',
        onClick: onChangeRole,
        className: 'bg-indigo-800 hover:bg-indigo-600',
        disabled: (row) => {
          // archived view already blocked by viewMode condition
          if (isAdmin) {
            if (isSuper(row.role) || isAdminRole(row.role)) return true;
            if (!sharesDeptWithLoggedInAdmin(row)) return true;
          }
          return false;
        },
      });
    }

    if (canEditExtension && (viewMode === 'active' || viewMode === 'myDepartment')) {
      list.push({
        label: 'Update Extension',
        onClick: onUpdateExtension,
        className: 'bg-teal-700 hover:bg-teal-600',
      });
    }

    if (isSuperadmin && viewMode === 'active') {
      list.push({
        label: 'Permissions',
        onClick: onManagePermissions,
        className: 'bg-amber-700 hover:bg-amber-600',
        disabled: (row) => isSuper(row.role),
      });
      list.push({
        label: 'Reset Password',
        onClick: onResetPassword,
        className: 'bg-slate-700 hover:bg-slate-600',
        disabled: (row) => isSuper(row.role),
      });
    }

    // Superadmin normal actions
    if (!canManage) return list;

    if (viewMode === 'active') {
      list.push(
        { label: 'Edit', onClick: onEdit, className: 'bg-blue-800 hover:bg-blue-600' },
        {
          label: 'Delete',
          onClick: onDelete,
          className: 'bg-red-800 hover:bg-red-600',
          disabled: (row) => isSuper(row.role),
        },
      );
      return list;
    }

    list.push(
      { label: 'Recover', onClick: onRecover, className: 'bg-green-800 hover:bg-green-600' },
      { label: 'Permanent Delete', onClick: onPermanentDelete, className: 'bg-red-800 hover:bg-red-600' },
    );

    return list;
  })();

  const handleRowClick = (row) => setSelectedEmployee(row);
  const handleBack = () => setSelectedEmployee(null);

  // submit create/update (superadmin only)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (viewMode !== 'active') {
      Swal.fire({ icon: 'info', title: 'Not allowed', text: 'Create/Update only in active view.' });
      return;
    }
    if (!canSubmitEmployeeForm) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Only superadmin can create or update employees.' });
      return;
    }
    setError('');

    const payload = {
      firstname: form.firstname.trim(),
      middlename: form.middlename.trim(),
      lastname: form.lastname.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role?.value || '',

      instituteId: form.institute?.value ?? null,
      departmentIds: (form.department || []).map(d => d.value).filter(v => v != null),

      employeeType: form.employeeType?.value || '',
      phoneNumber: form.phoneNumber || null,
      contactExtension: form.contactExtension || null,
    };

    if (isEditing && form._isEditingSuper && payload.role && payload.role !== 'superadmin') {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Cannot downgrade a superadmin.' });
      return;
    }

    if (!isEditing) {
      const missing = [];
      if (!payload.firstname) missing.push('First Name');
      if (!payload.lastname) missing.push('Last Name');
      if (!payload.email) missing.push('Email');
      if (!payload.role) missing.push('Role');
      if (payload.instituteId == null) missing.push('Institute');
      if (!payload.departmentIds?.length) missing.push('Department(s)');
      if (!payload.employeeType) missing.push('Employee Type');
      // 📱 Mobile number validation
      if (payload.phoneNumber) {
        const mobile = String(payload.phoneNumber).replace(/\D/g, '');

        if (mobile.length > 10) {
          Swal.fire({
            icon: 'warning',
            title: 'Invalid Mobile Number',
            text: 'Mobile number must be exactly 10 digits',
          });
          return;
        }

        if (mobile.length < 10) {
          Swal.fire({
            icon: 'warning',
            title: 'Invalid Mobile Number',
            text: 'Mobile number must be 10 digits',
          });
          return;
        }
      }


      if (missing.length) {
        Swal.fire({ icon: 'warning', title: 'Missing fields', html: missing.join(', ') });
        return;
      }
    }

    try {
      setLoading(true);
      Swal.fire({ title: 'Saving…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      if (isEditing && form.id) {
        await api.put(`/api/staff/${form.id}`, payload);
        await Swal.fire({ icon: 'success', title: 'Updated', text: 'Employee updated successfully.' });
      } else {
        await api.post('/api/staff/createstaff', payload);
        await Swal.fire({ icon: 'success', title: 'Created', text: 'Employee created successfully.' });
      }

      resetForm();
      setIsFormVisible(false);
      fetchStaff();
    } catch (e2) {
      const msg = e2?.response?.data?.message || 'Save failed';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Save Failed', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (v) => setSearchTerm(v?.target ? v.target.value : toStr(v));
  const handleClearSearch = () => setSearchTerm('');

  const emptyText =
    viewMode === 'active'
      ? 'No employees found'
      : viewMode === 'myDepartment'
        ? 'No department employees found'
        : 'No archived employees found';

  console.log('viewMode:', viewMode);
  console.log('activeDeptId:', activeDeptId);
  console.log('staff count:', staff?.length);
  console.log('baseStaff count:', baseStaff?.length);
  console.log('filteredData count:', filteredData?.length);
  console.log('filters:', filters);
  console.log('searchTerm:', searchTerm);
  console.log('baseStaff sample:', baseStaff?.[0]);

  return (
    <>
      <h1>
        {viewMode === 'active' && 'All Employees'}
        {viewMode === 'myDepartment' && 'My Department Employees'}
        {viewMode === 'archived' && 'Archived Employees'}
      </h1>

      {selectedEmployee ? (
        <EmployeeDetails
          employee={selectedEmployee}
          onClose={handleBack}
          onEdit={isSuperadmin && viewMode === 'active' ? () => onEdit(selectedEmployee) : undefined}
          onDelete={isSuperadmin && viewMode === 'active' ? () => onDelete(selectedEmployee) : undefined}
          onRecover={isSuperadmin && viewMode === 'archived' ? () => onRecover(selectedEmployee) : undefined}
          onPermanentDelete={isSuperadmin && viewMode === 'archived' ? () => onPermanentDelete(selectedEmployee) : undefined}
          // ✅ new optional action for details page

        />
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <Searchbar
                value={searchTerm}
                onChange={handleSearchChange}
                onClear={handleClearSearch}
                placeholder="Search by name, email, department, extension, mobile..."
              />

              <button
                onClick={() => setIsFilterVisible(!isFilterVisible)}
                className={`px-4 py-2 text-sm font-bold rounded transition-colors ${isFilterVisible
                  ? 'bg-brand-secondary text-white hover:bg-brand-secondary-200'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
              >
                {isFilterVisible ? 'Hide Filters' : 'Show Filters'}
              </button>

              {isFilterVisible && (
                <div className="flex flex-wrap gap-3">
                  {isSuperadmin && (
                    <div className="min-w-[180px]">
                      <Select
                        name="role"
                        options={ROLE_OPTIONS}
                        value={ROLE_OPTIONS.find(o => o.value === filters.role) || null}
                        onChange={(opt) => handleFilterChange(opt, { name: 'role' })}
                        placeholder="Select Role"
                        isClearable
                      />
                    </div>
                  )}

                  <div className="min-w-[220px]">
                    <Select
                      name="departmentId"
                      options={departmentOptions}
                      value={departmentOptions.find(o => o.value === filters.departmentId) || null}
                      onChange={(opt) => handleFilterChange(opt, { name: 'departmentId' })}
                      placeholder="Select Department"
                      isClearable
                    />
                  </div>

                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm font-bold bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              )}

              {(isSuperadmin || isAdmin) && (
                <div className="flex items-center space-x-2">
                  {(isSuperadmin || isAdmin) && (
                    <button
                      onClick={() => {
                        setViewMode('active');
                        clearFilters();
                        setSearchTerm('');
                      }}
                      className={`px-4 py-2 text-sm font-bold rounded transition-colors ${viewMode === 'active'
                        ? 'bg-brand-secondary text-white'
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                    >
                      All Employees
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setViewMode('myDepartment');
                        clearFilters();
                        setSearchTerm('');
                      }}
                      className={`px-4 py-2 text-sm font-bold rounded transition-colors ${viewMode === 'myDepartment'
                        ? 'bg-indigo-700 text-white'
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                    >
                      My Department
                    </button>
                  )}

                  {isSuperadmin && (
                    <button
                      onClick={() => {
                        setViewMode(viewMode === 'archived' ? 'active' : 'archived');
                        clearFilters();
                        setSearchTerm('');
                      }}
                      className={`px-4 py-2 text-sm font-bold rounded transition-colors ${viewMode === 'archived'
                        ? 'bg-brand-secondary text-white'
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                    >
                      {viewMode === 'archived' ? 'Active Employees' : 'Archived Employees'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {canManage && viewMode === 'active' && (
              <button
                onClick={() => {
                  if (isFormVisible && isEditing) resetForm();
                  setIsFormVisible(!isFormVisible);
                }}
                className="px-4 py-2 text-sm font-bold bg-brand-secondary text-white rounded hover:bg-brand-secondary-200 transition-colors"
              >
                {isFormVisible ? 'Close Form' : 'Add Employee'}
              </button>
            )}
          </div>

          {isFormVisible && viewMode === 'active' && (
            <div ref={employeeFormRef} className="p-4 border bg-white border-gray-300 rounded shadow mb-4 scroll-mt-24">
              {!canManage && (
                <div className="mb-3 text-sm text-orange-700 bg-orange-50 p-2 rounded">
                  Only superadmin can submit changes. You’re in read-only mode.
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormInput
                  label="First Name"
                  name="firstname"
                  type="text"
                  required
                  value={form.firstname}
                  onChange={(e) => setForm(f => ({ ...f, firstname: e.target.value }))}
                  disabled={!canSubmitEmployeeForm || loading}
                />

                <FormInput
                  label="Middle Name"
                  name="middlename"
                  type="text"
                  value={form.middlename}
                  onChange={(e) => setForm(f => ({ ...f, middlename: e.target.value }))}
                  disabled={!canSubmitEmployeeForm || loading}
                />

                <FormInput
                  label="Last Name"
                  name="lastname"
                  type="text"
                  required
                  value={form.lastname}
                  onChange={(e) => setForm(f => ({ ...f, lastname: e.target.value }))}
                  disabled={!canSubmitEmployeeForm || loading}
                />

                <FormInput
                  label="Email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  disabled={!canSubmitEmployeeForm || loading || isEditing}
                />

                <div className="flex flex-col">
                  <label className="text-sm font-bold">Institute</label>
                  <Select
                    name="institute"
                    options={instituteOptions}
                    value={form.institute}
                    onChange={(opt) => setForm(f => ({ ...f, institute: opt }))}
                    placeholder="Select Institute"
                    isClearable
                    isDisabled={!canSubmitEmployeeForm || loading}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-bold">Role</label>
                  <Select
                    name="role"
                    options={formRoleOptions}
                    value={form.role}
                    onChange={(opt) => setForm(f => ({ ...f, role: opt }))}
                    placeholder="Select Role"
                    isClearable
                    isDisabled={!canSubmitEmployeeForm || loading || form._isEditingSuper}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-bold">Employee Type</label>
                  <Select
                    name="employeeType"
                    options={EmployeeTypes}
                    value={form.employeeType}
                    onChange={(opt) => setForm(f => ({ ...f, employeeType: opt }))}
                    placeholder="Select Employee Type"
                    isClearable
                    isDisabled={!canSubmitEmployeeForm || loading}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-bold">Department(s)</label>
                  <Select
                    name="department"
                    options={departmentOptions}
                    value={form.department}
                    onChange={(opt) => setForm(f => ({ ...f, department: opt || [] }))}
                    placeholder="Select Department(s)"
                    isMulti
                    isClearable
                    isDisabled={!canSubmitEmployeeForm || loading}
                  />
                </div>

                <FormInput
                  label="Contact No"
                  name="phoneNumber"
                  type="text"
                  value={form.phoneNumber}
                  onChange={(e) => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                  disabled={!canSubmitEmployeeForm || loading}
                />

                <FormInput
                  label="Extension No"
                  name="contactExtension"
                  type="text"
                  value={form.contactExtension}
                  onChange={(e) => setForm(f => ({ ...f, contactExtension: e.target.value }))}
                  disabled={!canSubmitEmployeeForm || loading}
                />

                {error && <div className="md:col-span-3 text-sm text-red-600 self-center">{error}</div>}

                {canSubmitEmployeeForm && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-bold bg-brand-secondary text-white rounded hover:bg-gray-500 transition-colors disabled:opacity-60 self-end mb-4"
                  >
                    {loading ? (isEditing ? 'Updating…' : 'Creating…') : (isEditing ? 'Update' : 'Submit')}
                  </button>
                )}
              </form>
            </div>

          )}



          <Table
            data={filteredData}
            columns={columns}
            actions={canUseEmployeeActions ? actions : []}
            onRowClick={handleRowClick}
            isFormVisible={isFormVisible}
            setIsFormVisible={setIsFormVisible}
            loading={loading}
            emptyText={emptyText}
          />

        </>
      )}
    </>
  );
};

export default Employee;
