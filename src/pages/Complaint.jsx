import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Swal from 'sweetalert2';
import api from '../lib/api';
import Table from '../components/Table';
import Searchbar from '../components/Searchbar';
import Select from 'react-select';
import FormInput from '../components/FormInput';
import ComplaintDetails from '../pages/ComplaintDetails';
import { useAuth } from '../context/authContext/AuthContext';
import JoditEditor from 'jodit-react';
import { floorOptions } from '../constants/floorOptions';
import { rephraseHtmlDescription, rephraseSentence } from '../utils/rephraseText';

const Complaint = () => {
  const { user, activeDepartmentId } = useAuth();

  const editor = useRef(null);

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [complaints, setComplaints] = useState([]);

  // ✅ Separate states (filter vs form)
  const [selectedDeptFilter, setSelectedDeptFilter] = useState(null);
  const [selectedDeptForm, setSelectedDeptForm] = useState(null);

  // ✅ JODIT FIX states
  const [content, setContent] = useState('');
  const contentRef = useRef(''); // ✅ typing time ref me save hoga

  const [attachmentFiles, setAttachmentFiles] = useState([]);

  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);

  const [complaintView, setComplaintView] = useState(() => {
    const role = String(user?.role || '').toLowerCase();
    if (role === 'superadmin') return 'all';
    if (role === 'user') return 'mycomplaints';
    // admin/subadmin/engineer ke liye mycomplaints safe default
    // activeDeptType baad mein load hoga
    if (['admin', 'subadmin', 'engineer'].includes(role)) return 'mycomplaints';
    return 'all';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filters, setFilters] = useState({
    department: '',
    status: '',
    complaint_type: '',
  });

  const [newComplaint, setNewComplaint] = useState({
    departmentId: '',
    departmentCategory: '',
    priority: '',
    location: '',
    subject: '',
    isRepeated: false,
    behalf: false,
    behalfId: null,
  });

  const isSuperadmin = String(user?.role || '').toLowerCase() === 'superadmin';

  // ------------------ API: fetch complaints by view ------------------
  const fetchComplaints = useCallback(async (view = 'all') => {
    try {
      let url = '/api/complaints';

      if (view === 'mycomplaints') url = '/api/complaints/my-complaints';
      else if (view === 'incomming') url = '/api/complaints/incomming';
      else if (view === 'departmentComplaints') url = '/api/complaints/department-complaints';

      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setComplaints(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to load complaints';
      console.error(msg);
      setComplaints([]);
    }
  }, []);

  useEffect(() => {
    if (!complaintView) return;
    fetchComplaints(complaintView);
  }, [complaintView, fetchComplaints, activeDepartmentId]);



  const activeDeptType = useMemo(() => {
    if (!activeDepartmentId || !Array.isArray(departments)) return null;

    const dept = (departments || []).find(
      (d) => String(d.id) === String(activeDepartmentId)
    );

    return String(dept?.type || "").toLowerCase(); // "service" | "regular" | null
  }, [activeDepartmentId, departments]);

  useEffect(() => {
    const role = String(user?.role || '').toLowerCase();
    if (!['admin', 'subadmin', 'engineer'].includes(role)) return;
    if (!activeDeptType) return;

    // sirf agar abhi bhi default pe hai tab switch karo
    if (complaintView === 'mycomplaints') {
      if (activeDeptType === 'service') setComplaintView('incomming');
      else if (activeDeptType === 'regular') setComplaintView('departmentComplaints');
    }
  }, [activeDeptType]); // eslint-disable-line


  const complaintViewOptions = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();

    if (role === 'superadmin') return [{ value: 'all', label: 'All Complaints' }];
    if (role === 'user') return [{ value: 'mycomplaints', label: 'My Complaints' }];

    if (['admin', 'subadmin', 'engineer'].includes(role)) {
      const opts = [];

      // ✅ Incoming ONLY service dept
      if (activeDeptType === 'service') {
        opts.push({ value: 'incomming', label: 'Incomming' });
      }

      // ✅ Department Complaints service + regular
      if (activeDeptType === 'service' || activeDeptType === 'regular') {
        opts.push({ value: 'departmentComplaints', label: 'Department Complaints' });
      }

      opts.push({ value: 'mycomplaints', label: 'My Complaints' });
      return opts;
    }

    return [
      { value: 'all', label: 'All Complaints' },
      { value: 'mycomplaints', label: 'My Complaints' },
      { value: 'incomming', label: 'Incomming' },
      { value: 'departmentComplaints', label: 'Department Complaints' },
    ];
  }, [user, activeDeptType]);


  const handleComplaintViewChange = (selectedOption) => {
    const value = selectedOption?.value;
    if (!value) return;

    const allowed = complaintViewOptions.some(opt => opt.value === value);
    if (!allowed) return;

    setComplaintView(value);
  };

  // ------------------ Fetch lists (departments + staff) ------------------
  const fetchLists = async () => {
    try {
      setStaffLoading(true);

      const [deptRes, staffRes] = await Promise.all([
        api.get('/api/departments'),
        api.get('/api/staff'),
      ]);

      const deptData = deptRes?.data
        ? (Array.isArray(deptRes.data) ? deptRes.data : (deptRes.data.data || deptRes.data.departments || []))
        : [];

      let staff = [];
      if (staffRes?.data) {
        if (Array.isArray(staffRes.data)) staff = staffRes.data;
        else if (Array.isArray(staffRes.data.data)) staff = staffRes.data.data;
        else if (Array.isArray(staffRes.data.staff)) staff = staffRes.data.staff;
      }

      setDepartments(Array.isArray(deptData) ? deptData : []);
      setStaffList(Array.isArray(staff) ? staff : []);
    } catch (e) {
      console.error('Failed to load lists', e);
      setStaffList([]);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [user?.role]);

  // ------------------ Options ------------------
  const departmentNameOptions = useMemo(() => {
    return (departments || [])
      .filter(x => String(x?.type || '').toLowerCase() === 'service')
      .map(x => ({ value: Number(x.id), label: x.department }));
  }, [departments]);

  const categoryOptionsForFilter = useMemo(() => {
    if (!selectedDeptFilter) return [];
    const dept = (departments || []).find(d => Number(d.id) === Number(selectedDeptFilter.value));
    const cats = new Set();

    (dept?.category || []).forEach(str => {
      String(str).split(',').forEach(c => {
        const v = c.trim();
        if (v && v.toLowerCase() !== 'n/a') cats.add(v);
      });
    });

    return Array.from(cats).map(v => ({ value: v, label: v }));
  }, [departments, selectedDeptFilter]);

  const categoryOptionsForForm = useMemo(() => {
    if (!selectedDeptForm) return [];
    const dept = (departments || []).find(d => Number(d.id) === Number(selectedDeptForm.value));
    const cats = new Set();

    (dept?.category || []).forEach(str => {
      String(str).split(',').forEach(c => {
        const v = c.trim();
        if (v && v.toLowerCase() !== 'n/a') cats.add(v);
      });
    });

    return Array.from(cats).map(v => ({ value: v, label: v }));
  }, [departments, selectedDeptForm]);

  const staffOptions = useMemo(() => {
    if (!Array.isArray(staffList)) return [];
    return staffList
      .filter(staff => (staff.departmentIds || []).some(id => String(id) === String(activeDepartmentId)))
      .map(staff => ({
        value: Number(staff.id),
        label: `${staff.firstname || ''} ${staff.middlename || ''} ${staff.lastname || ''}`.trim() || staff.email,
        email: staff.email,
      }));
  }, [staffList, activeDepartmentId]);

  const priorityOptions = [
    { value: '', label: 'Select Priority' },
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' },
  ];

  const uniqueStatuses = useMemo(() => {
    return [
      { value: '', label: 'Select Status' },
      ...[...new Set((complaints || []).map((item) => item.status).filter(Boolean))].map((status) => ({
        value: status,
        label: status,
      })),
    ];
  }, [complaints]);

  // ------------------ Format date ------------------
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const renderPriority = (priority) => {
    if (!priority) return "-";

    const base = "px-2 py-1 rounded-full text-xs font-semibold inline-block";

    switch (priority.toLowerCase()) {
      case "high":
        return <span className={`${base} bg-red-100 text-red-700`}>High</span>;
      case "medium":
        return <span className={`${base} bg-yellow-100 text-yellow-700`}>Medium</span>;
      case "low":
        return <span className={`${base} bg-green-100 text-green-700`}>Low</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-700`}>{priority}</span>;
    }
  };

  const renderStatus = (status) => {
    if (!status) return "-";

    const base = "px-2 py-1 rounded-full text-xs font-semibold inline-block capitalize";
    const s = status.toLowerCase();

    if (s === "pending") return <span className={`${base} bg-orange-100 text-orange-700`}>Pending</span>;
    if (s === "in-progress" || s === "in progress") return <span className={`${base} bg-blue-100 text-blue-700`}>In Progress</span>;
    if (s === "closed") return <span className={`${base} bg-green-100 text-green-700`}>Closed</span>;
    if (s === "rejected") return <span className={`${base} bg-red-100 text-red-700`}>Rejected</span>;
    if (s.includes("hod")) return <span className={`${base} bg-purple-100 text-purple-700`}>{status}</span>;

    return <span className={`${base} bg-gray-100 text-gray-700`}>{status}</span>;
  };

  const columns = [
    { key: "ticketId", label: "Ticket ID" },
    { key: "createdAt", label: "Date", format: formatDate },
    { key: "subject", label: "Subject" },
    { key: "priority", label: "Priority", format: renderPriority },
    { key: "status", label: "Status", format: renderStatus },
    { key: "location", label: "Location" },
  ];

  // ------------------ Details ------------------
  const handleRowClick = async (row) => {
    try {
      const id = row.id || complaints.find(c => c.ticketId === row.ticketId)?.id;
      if (!id) return;

      const res = await api.get(`/api/complaints/${id}`);
      const fullComplaint = res.data?.data || res.data;
      setSelectedComplaint(fullComplaint);
    } catch (err) {
      console.error('Failed to load complaint details:', err);
    }
  };

  const handleBack = () => setSelectedComplaint(null);

  // ------------------ Filter handlers ------------------
  const handleFilterChange = (selectedOption, { name }) => {
    if (name === 'department') {
      setSelectedDeptFilter(selectedOption || null);
      setFilters(prev => ({
        ...prev,
        department: selectedOption ? selectedOption.value : '',
        complaint_type: '',
      }));
      return;
    }

    setFilters(prev => ({ ...prev, [name]: selectedOption ? selectedOption.value : '' }));
  };

  const clearFilters = () => {
    setFilters({ department: '', status: '', complaint_type: '' });
    setSelectedDeptFilter(null);
  };

  // ------------------ ✅ Editor (FINAL FIX) ------------------
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const config = useMemo(
    () => ({
      readonly: false,
      placeholder: 'Start typing...',
    }),
    []
  );

  // ✅ no setState on every keypress
  const handleEditorChange = useCallback((newContent) => {
    contentRef.current = newContent;
  }, []);

  // ✅ update state only when editor loses focus
  const handleEditorBlur = useCallback((newContent) => {
    setContent(newContent);
    contentRef.current = newContent;
  }, []);

  // ------------------ Search ------------------
  const handleSearchChange = (e) => setSearchTerm(e.target.value);
  const handleClearSearch = () => setSearchTerm('');

  // ------------------ Form handlers ------------------
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewComplaint((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (selectedOption, { name }) => {
    setNewComplaint((prev) => ({ ...prev, [name]: selectedOption ? selectedOption.value : '' }));
  };

  const handleRephraseSubject = () => {
    setNewComplaint((prev) => ({
      ...prev,
      subject: rephraseSentence(prev.subject),
    }));
  };

  const handleRephraseDescription = () => {
    const nextContent = rephraseHtmlDescription(contentRef.current || content);
    setContent(nextContent);
    contentRef.current = nextContent;
  };

  const handleToggleChange = (field) => {
    if (field === 'behalf') {
      setNewComplaint((prev) => ({
        ...prev,
        behalf: !prev.behalf,
        behalfId: !prev.behalf ? prev.behalfId : null,
      }));
    } else {
      setNewComplaint((prev) => ({ ...prev, [field]: !prev[field] }));
    }
  };

  // ------------------ Submit ------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.id) {
      Swal.fire('Error', 'User not authenticated', 'error');
      return;
    }

    if (newComplaint.behalf && !newComplaint.behalfId) {
      Swal.fire('Error', 'Please select a staff member for "On Behalf Of"', 'error');
      return;
    }

    const latestContent = (contentRef.current || '').trim();
    if (!newComplaint.departmentId || !newComplaint.subject || !latestContent) {
      Swal.fire('Error', 'Please fill all required fields', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      Swal.fire({
        title: 'Submitting complaint...',
        text: 'Please wait',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const formData = new FormData();

      formData.append('staffId', String(user.id));
      formData.append('behalf', newComplaint.behalf ? 'true' : 'false');
      if (newComplaint.behalf && newComplaint.behalfId) {
        formData.append('behalfId', String(newComplaint.behalfId));
      }

      formData.append('departmentId', String(newComplaint.departmentId));
      if (newComplaint.departmentCategory) formData.append('departmentCategory', newComplaint.departmentCategory);
      if (newComplaint.priority) formData.append('priority', newComplaint.priority);

      formData.append('subject', newComplaint.subject);
      formData.append('description', contentRef.current || ''); // ✅ always latest
      formData.append('location', newComplaint.location || '');
      formData.append('isRepeated', newComplaint.isRepeated ? 'true' : 'false');

      if (attachmentFiles && attachmentFiles.length > 0) {
        attachmentFiles.forEach((file) => formData.append('attachments', file));
      }

      await api.post('/api/complaints/send-complaint', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Swal.fire('Success', 'Complaint created successfully!', 'success');
      resetForm();
      fetchComplaints(complaintView);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error?.response?.data?.message || 'Failed to create complaint', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewComplaint({
      departmentId: '',
      departmentCategory: '',
      priority: '',
      location: '',
      subject: '',
      isRepeated: false,
      behalf: false,
      behalfId: null,
    });
    setSelectedDeptForm(null);
    setContent('');
    contentRef.current = ''; // ✅ reset ref also
    setAttachmentFiles([]);
    setIsFormVisible(false);
  };

  // ------------------ Filtered data ------------------
  const filteredData = useMemo(() => {
    const searchLower = (searchTerm || '').toLowerCase();

    return (complaints || []).filter((item) => {
      const matchesFilters = Object.keys(filters).every((key) => {
        const val = filters[key];
        if (!val) return true;

        if (key === 'department') return String(item.departmentId) === String(val);
        if (key === 'complaint_type') return String(item.departmentCategory) === String(val);

        return String(item[key]) === String(val);
      });

      const matchesSearch =
        (item.subject || '').toLowerCase().includes(searchLower) ||
        String(item.ticketId || item.id || '').toLowerCase().includes(searchLower) ||
        String(item.employee_name || '').toLowerCase().includes(searchLower);

      return matchesFilters && matchesSearch;
    });
  }, [complaints, filters, searchTerm]);

  const selectedStatus = uniqueStatuses.find(opt => opt.value === filters.status) || null;
  const selectedPriority = priorityOptions.find(opt => opt.value === newComplaint.priority) || null;
  const selectedFloor = floorOptions.find(opt => opt.value === newComplaint.location) || null;

  const selectedCategoryFilter =
    categoryOptionsForFilter.find(opt => opt.value === filters.complaint_type) || null;

  const selectedCategoryForm =
    categoryOptionsForForm.find(opt => opt.value === newComplaint.departmentCategory) || null;

  return (
    <>
      <h1 className="text-xl font-bold mb-4">Complaints</h1>

      {selectedComplaint ? (
        <ComplaintDetails complaint={selectedComplaint} onClose={handleBack} />
      ) : (
        <>
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {/* View selector */}
                <div className="flex flex-col">
                  {complaintViewOptions.length > 1 ? (
                    <Select
                      options={complaintViewOptions}
                      value={complaintViewOptions.find(opt => opt.value === complaintView) || complaintViewOptions[0]}
                      onChange={handleComplaintViewChange}
                      placeholder="Filter Complaints"
                      className="w-full md:w-56"
                      isClearable={false}
                    />
                  ) : (
                    <span className="text-sm font-semibold">
                      {complaintViewOptions[0]?.label || 'Complaints'}
                    </span>
                  )}
                </div>

                <Searchbar value={searchTerm} onChange={handleSearchChange} onClear={handleClearSearch} />

                <button
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`w-full rounded px-4 py-2 text-sm font-bold transition-colors md:w-auto ${isFilterVisible
                    ? 'bg-brand-secondary text-white hover:bg-brand-secondary-200'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    }`}
                >
                  {isFilterVisible ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>

              {/* superadmin hide add complaint */}
              {!isSuperadmin && (
                <button
                  onClick={() => setIsFormVisible(!isFormVisible)}
                  className="w-full rounded bg-brand-secondary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-secondary-200 md:w-auto"
                >
                  {isFormVisible ? 'Close Form' : 'Add Complaint'}
                </button>
              )}
            </div>

            {isFilterVisible && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-gray-800">Filter Complaints</h2>
                  <p className="text-xs text-gray-500">Use these options to narrow the complaint list.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-gray-600">Department</span>
                    <Select
                      name="department"
                      options={departmentNameOptions}
                      value={selectedDeptFilter}
                      onChange={handleFilterChange}
                      placeholder="Select Department"
                      isClearable
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium text-gray-600">Complaint Type</span>
                    <Select
                      name="complaint_type"
                      options={categoryOptionsForFilter}
                      value={selectedCategoryFilter}
                      onChange={handleFilterChange}
                      placeholder="Select Complaint Type"
                      isDisabled={!selectedDeptFilter}
                      isClearable
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium text-gray-600">Status</span>
                    <Select
                      name="status"
                      options={uniqueStatuses}
                      value={selectedStatus}
                      onChange={handleFilterChange}
                      placeholder="Select Status"
                      isClearable
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      className="w-full rounded bg-red-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FORM */}
          {isFormVisible && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3 md:px-6">
                <div>
                  <h2 className="text-base md:text-lg font-semibold text-gray-800">New Complaint</h2>
                  <p className="text-xs md:text-sm text-gray-500">
                    Please fill the complaint details in the following sections.
                  </p>
                </div>

                {newComplaint.behalf && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                    On Behalf
                  </span>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 px-4 py-4 md:px-6 md:py-5">
                {/* SECTION 1 */}
                <section className="space-y-4 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">
                      1
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Basic Details</h3>
                      <p className="text-xs text-gray-500">Select department and basic information of the complaint.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Department<span className="text-red-500">*</span>
                      </label>
                      <Select
                        name="departmentId"
                        options={departmentNameOptions}
                        value={selectedDeptForm}
                        onChange={(opt) => {
                          setSelectedDeptForm(opt);
                          setNewComplaint((prev) => ({
                            ...prev,
                            departmentId: opt ? opt.value : '',
                            departmentCategory: '',
                          }));
                        }}
                        placeholder="Select department"
                        isClearable
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="mb-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Complaint Type
                      </label>
                      <Select
                        name="departmentCategory"
                        options={categoryOptionsForForm}
                        value={selectedCategoryForm}
                        onChange={handleSelectChange}
                        placeholder="Select complaint type"
                        isDisabled={!selectedDeptForm}
                        isClearable
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="mb-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Priority
                      </label>
                      <Select
                        name="priority"
                        options={priorityOptions}
                        value={selectedPriority}
                        onChange={handleSelectChange}
                        placeholder="Select priority"
                        isClearable
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="mb-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Floor / Building
                      </label>
                      <Select
                        name="location"
                        options={floorOptions}
                        value={selectedFloor}
                        onChange={handleSelectChange}
                        placeholder="Select floor or building"
                        isClearable
                      />
                    </div>
                  </div>
                </section>

                {/* SECTION 2 */}
                <section className="space-y-4 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">
                      2
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Options & On Behalf</h3>
                      <p className="text-xs text-gray-500">Configure filing options and select staff if filing on behalf.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
                    <div className="space-y-3 rounded-lg border border-gray-100 bg-white p-3.5 shadow-sm">
                      <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 border border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-800">File on Behalf</p>
                          <p className="text-xs text-gray-500">Create complaint for another staff member.</p>
                        </div>
                        <label className="relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full bg-gray-300 transition">
                          <input
                            className="peer sr-only"
                            type="checkbox"
                            checked={newComplaint.behalf}
                            onChange={() => handleToggleChange('behalf')}
                          />
                          <span className="absolute inset-y-0 left-0 m-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all peer-checked:translate-x-5 peer-checked:bg-brand-secondary" />
                        </label>
                      </div>

                      <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 border border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-800">Repeated Issue</p>
                          <p className="text-xs text-gray-500">Mark if this complaint has been raised earlier.</p>
                        </div>
                        <label className="relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full bg-gray-300 transition">
                          <input
                            className="peer sr-only"
                            type="checkbox"
                            checked={newComplaint.isRepeated}
                            onChange={() => handleToggleChange('isRepeated')}
                          />
                          <span className="absolute inset-y-0 left-0 m-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all peer-checked:translate-x-5 peer-checked:bg-brand-secondary" />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {newComplaint.behalf && (
                        <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3.5">
                          <label className="mb-1 block text-xs font-semibold text-amber-800 uppercase tracking-wide">
                            Select Staff (On Behalf Of)
                          </label>

                          {staffLoading ? (
                            <div className="text-xs text-amber-700">Loading staff list...</div>
                          ) : staffOptions.length === 0 ? (
                            <div className="text-xs text-red-600">No staff found. Please contact admin.</div>
                          ) : (
                            <Select
                              options={staffOptions}
                              value={staffOptions.find((opt) => opt.value === newComplaint.behalfId) || null}
                              onChange={(selected) => {
                                setNewComplaint((prev) => ({
                                  ...prev,
                                  behalfId: selected ? Number(selected.value) : null,
                                }));
                              }}
                              placeholder="Search & select staff member..."
                              isSearchable
                              isClearable
                              isDisabled={staffLoading}
                              classNamePrefix="react-select"
                            />
                          )}

                          {newComplaint.behalfId === user?.id && (
                            <p className="mt-1 text-[11px] text-red-600">You are filing on your own behalf.</p>
                          )}
                        </div>
                      )}

                      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3.5">
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                          Attachments
                        </label>

                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-200">
                          <span className="truncate">
                            {attachmentFiles?.length
                              ? `${attachmentFiles.length} file(s) selected`
                              : 'Click to browse files'}
                          </span>
                          <span className="rounded-full bg-brand-secondary px-3 py-1 text-xs font-semibold text-white">
                            Choose Files
                          </span>
                          <input
                            type="file"
                            name="attachments"
                            multiple
                            className="hidden"
                            onChange={(e) => setAttachmentFiles(Array.from(e.target.files || []))}
                          />
                        </label>

                        <p className="mt-1 text-[11px] text-gray-500">
                          Allowed: images, PDF, DOC, DOCX (max 5 MB each)
                        </p>

                        {attachmentFiles?.length > 0 && (
                          <ul className="mt-2 max-h-24 space-y-1 overflow-auto text-[11px] text-gray-600">
                            {attachmentFiles.map((file, idx) => (
                              <li key={idx} className="flex items-center justify-between">
                                <span className="truncate">{file.name}</span>
                                <span className="ml-2 text-[10px] text-gray-400">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* SECTION 3 */}
                <section className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">
                      3
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Complaint Subject</h3>
                      <p className="text-xs text-gray-500">Provide a short and clear subject for the complaint.</p>
                    </div>
                  </div>

                  <FormInput
                    label="Subject"
                    name="subject"
                    value={newComplaint.subject}
                    onChange={handleInputChange}
                    required
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleRephraseSubject}
                      disabled={!newComplaint.subject.trim()}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Rephrase Subject
                    </button>
                  </div>
                </section>

                {/* SECTION 4 */}
                <section className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">
                      4
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Detailed Description</h3>
                      <p className="text-xs text-gray-500">Explain the issue in detail to help us resolve it faster.</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    <JoditEditor
                      ref={editor}
                      value={content}
                      config={config}
                      onChange={handleEditorChange} // ✅ no setState here
                      onBlur={handleEditorBlur}     // ✅ setState only here
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleRephraseDescription}
                      disabled={!((contentRef.current || content || '').replace(/<[^>]+>/g, '').trim())}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Rephrase Description
                    </button>
                  </div>
                </section>

                {/* Actions */}
                <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-gray-500">
                    Fields marked with <span className="text-red-500">*</span> are mandatory.
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-secondary hover:bg-brand-secondary-200'
                        }`}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <Table data={filteredData} columns={columns} onRowClick={handleRowClick} />
        </>
      )}
    </>
  );
};

export default Complaint;
