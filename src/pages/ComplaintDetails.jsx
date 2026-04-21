import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import api from '../lib/api';
import { useAuth } from '../context/authContext/AuthContext';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Logo from '../assets/MET-logo.png';


const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const getStaffDeptIds = (staff) =>
  Array.isArray(staff?.departmentIds) ? staff.departmentIds.map(Number) : [];

const isSuperadmin = (staff) =>
  String(staff?.role || '').toLowerCase() === 'superadmin';

const stripHtml = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return (tmp.textContent || tmp.innerText || '').trim();
};

const ComplaintDetails = ({ complaint: initialComplaint, onClose }) => {
  const { user, activeDepartmentId } = useAuth();

  const [complaint, setComplaint] = useState(initialComplaint || null);
  const [staffDetails, setStaffDetails] = useState(null);
  const [behalfStaffDetails, setBehalfStaffDetails] = useState(null);
  const [assignedStaff, setAssignedStaff] = useState(null);
  const [allStaff, setAllStaff] = useState([]);
  const [complaintDeptName, setComplaintDeptName] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [deptNameMap, setDeptNameMap] = useState({});

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [problemDesc, setProblemDesc] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [forwardStaffId, setForwardStaffId] = useState('');
  const [forwardDesc, setForwardDesc] = useState('');

  const apiBaseURL = (api?.defaults?.baseURL || '').replace(/\/$/, '');

  const currentUserId =
    user?.id ?? (Number(localStorage.getItem('staffId')) || null);
  const currentUserRole = (user?.role || '').toLowerCase();

  const isAssignedToCurrent = currentUserId && complaint?.assignStaffId === currentUserId;

  // 🔹 Subadmin + Engineer -> Self-assign allowed
  const canSelfAssign = currentUserRole === 'engineer' || currentUserRole === 'subadmin';


  // ✅ normalize activeDepartmentId (array / single / null safe)
  const activeDeptIds = useMemo(() => {
    if (Array.isArray(activeDepartmentId)) return activeDepartmentId.map(Number);
    if (activeDepartmentId == null) return [];
    return [Number(activeDepartmentId)];
  }, [activeDepartmentId]);

  // ✅ safe department match
  const isSameDepartment = activeDeptIds.includes(
    Number(complaint?.departmentId)
  );


  // 🔹 Admin + Subadmin -> dusrono ko assign kar sakte hain
  const canAssignOthers = (currentUserRole === 'admin' || currentUserRole === 'subadmin') && isSameDepartment;


  // 🔹 PRINTABLE AREA REF
  const printRef = useRef(null);

  // Helpers
  const getFullName = (staff) => {
    if (!staff) return 'N/A';
    return `${staff.firstname || ''} ${staff.middlename || ''} ${staff.lastname || ''
      }`
      .trim()
      .replace(/\s+/g, ' ');
  };

  const getPriorityColor = (priority) => {
    if (!priority) return 'bg-gray-300';
    switch ((priority || '').toLowerCase()) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-300';
    }
  };

  const normalizeStatus = (status) => {
    if (!status) return '';
    return status.toLowerCase().replace(/\s+/g, '-');
  };

  const getStatusBadge = (statusRaw) => {
    const status = normalizeStatus(statusRaw);
    const badges = {
      pending: {
        class: 'bg-yellow-500 text-yellow-900',
        text: 'Pending',
        color: 'yellow',
      },
      'in-progress': {
        class: 'bg-blue-500 text-white',
        text: 'In Progress',
        color: 'blue',
      },
      resolved: {
        class: 'bg-green-500 text-white',
        text: 'Resolved',
        color: 'green',
      },
      closed: {
        class: 'bg-gray-500 text-white',
        text: 'Closed',
        color: 'gray',
      },
    };
    return (
      badges[status] || {
        class: 'bg-gray-300 text-gray-700',
        text: statusRaw || 'N/A',
        color: 'gray',
      }
    );
  };

  const getFullUrl = (path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    if (!apiBaseURL) return path;
    if (path.startsWith('/')) return `${apiBaseURL}${path}`;
    return `${apiBaseURL}/${path}`;
  };

  const attachments = Array.isArray(complaint?.attachments)
    ? complaint.attachments
    : complaint?.attachments
      ? [complaint.attachments]
      : [];

  // forwarded staff (jisko forward kiya gaya)
  const forwardedStaff =
    complaint?.forwardToStaffId && Array.isArray(allStaff)
      ? allStaff.find(
        (s) => String(s.id) === String(complaint.forwardToStaffId)
      )
      : null;

  const formatStaffDepartments = (staff) => {
    const ids = getStaffDeptIds(staff);
    if (!ids.length) return 'N/A';

    const names = ids.map((id) => deptNameMap?.[id]).filter(Boolean);
    if (names.length) return names.join(', ');
    return `Dept IDs: ${ids.join(', ')}`;
  };

  // Fetch staff details, department name, staff list (+ departments map best effort)
  useEffect(() => {
    const fetchData = async () => {
      if (!initialComplaint) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        setComplaint(initialComplaint);

        // optional departments mapping
        try {
          const deptListRes = await api.get('/api/departments');
          const deptList = deptListRes.data?.data || deptListRes.data || [];
          if (Array.isArray(deptList)) {
            const map = {};
            deptList.forEach((d) => {
              const id = toNum(d?.id);
              const name = d?.department || d?.name;
              if (id && name) map[id] = name;
            });
            setDeptNameMap(map);
          }
        } catch (e) {
          console.warn('Failed to fetch departments list', e);
        }

        // filer
        if (initialComplaint.staffId) {
          const staffRes = await api.get(
            `/api/staff/${initialComplaint.staffId}`
          );
          setStaffDetails(staffRes.data?.data || staffRes.data || null);
        }

        // ✅ behalf staff (jiske behalf pe complaint raise hua)
        if (initialComplaint.behalf && initialComplaint.behalfId) {
          try {
            const behalfRes = await api.get(`/api/staff/${initialComplaint.behalfId}`);
            setBehalfStaffDetails(behalfRes.data?.data || behalfRes.data || null);
          } catch (err) {
            console.warn('Failed to fetch behalf staff', err);
            setBehalfStaffDetails(null);
          }
        } else {
          setBehalfStaffDetails(null);
        }


        // assigned
        if (initialComplaint.assignStaffId) {
          try {
            const assignRes = await api.get(
              `/api/staff/${initialComplaint.assignStaffId}`
            );
            setAssignedStaff(assignRes.data?.data || assignRes.data || null);
          } catch (err) {
            console.warn('Failed to fetch assigned staff', err);
            setAssignedStaff(null);
          }
        } else {
          setAssignedStaff(null);
        }

        // complaint dept name
        if (initialComplaint.departmentId) {
          try {
            const deptRes = await api.get(
              `/api/departments/${initialComplaint.departmentId}`
            );
            const deptData = deptRes.data?.data || deptRes.data || null;
            if (deptData?.department) {
              setComplaintDeptName(deptData.department);
              const id = toNum(initialComplaint.departmentId);
              if (id) {
                setDeptNameMap((prev) => ({
                  ...prev,
                  [id]: deptData.department,
                }));
              }
            } else {
              setComplaintDeptName('');
            }
          } catch (err) {
            console.warn('Failed to fetch department name', err);
            setComplaintDeptName('');
          }
        } else {
          setComplaintDeptName('');
        }

        // all staff
        try {
          const staffListRes = await api.get('/api/staff');
          const list = staffListRes.data?.data || staffListRes.data || [];
          setAllStaff(Array.isArray(list) ? list : []);
        } catch (err) {
          console.warn('Failed to fetch staff list', err);
          setAllStaff([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initialComplaint]);

  // SELF ASSIGN – PATCH /api/complaints/:id/assign-self
  const handleSelfAssign = async () => {
    if (!complaint?.id) {
      Swal.fire('Error', 'Invalid complaint ID', 'error');
      return;
    }
    setUpdating(true);
    try {
      const res = await api.patch(`/api/complaints/${complaint.id}/assign-self`);
      const msg = res.data?.message || 'Complaint assigned to you successfully.';
      await Swal.fire('Success', msg, 'success');

      const updated = res.data?.data || null;
      if (updated) setComplaint(updated);

      if (onClose) onClose();
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Failed to assign complaint to self.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // ✅ NEW: ASSIGN TO STAFF (Admin/Subadmin) – PATCH /api/complaints/:id/assign
  const handleAssignToStaff = async (e) => {
    e.preventDefault();
    if (!complaint?.id) {
      Swal.fire('Error', 'Invalid complaint ID', 'error');
      return;
    }
    if (!forwardStaffId) {
      Swal.fire('Error', 'Please select staff.', 'error');
      return;
    }
    if (!forwardDesc.trim()) {
      Swal.fire('Error', 'Please enter description.', 'error');
      return;
    }

    setUpdating(true);
    try {
      const res = await api.patch(`/api/complaints/${complaint.id}/assign`, {
        assignToStaffId: forwardStaffId,
        assignComment: forwardDesc,
      });

      const selectedStaff = allStaff.find(
        (s) =>
          String(s.id) === String(forwardStaffId) ||
          String(s.staffId) === String(forwardStaffId) ||
          String(s._id) === String(forwardStaffId)
      );

      const staffName =
        selectedStaff?.name ||
        selectedStaff?.fullName ||
        `${selectedStaff?.firstname || ''} ${selectedStaff?.lastname || ''}`.trim() ||
        selectedStaff?.username ||
        `Staff (${forwardStaffId})`;

      await Swal.fire(
        'Success',
        `Complaint assigned to ${staffName} successfully.`,
        'success'
      );

      const updated = res.data?.data || null;
      if (updated) setComplaint(updated);

      setShowForwardModal(false);
      setForwardStaffId('');
      setForwardDesc('');
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Failed to assign complaint.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // RESOLVE & CLOSE – PATCH /api/complaints/:id/close
  const handleResolve = async (e) => {
    e.preventDefault();
    if (!complaint?.id) {
      Swal.fire('Error', 'Invalid complaint ID', 'error');
      return;
    }
    if (!problemDesc.trim() || !actionComment.trim()) {
      Swal.fire('Error', 'Both fields required.', 'error');
      return;
    }

    setUpdating(true);
    try {
      const res = await api.patch(`/api/complaints/${complaint.id}/close`, {
        problemDescription: problemDesc,
        actionTakenComment: actionComment,
      });

      const msg = res.data?.message || 'Complaint closed successfully.';
      await Swal.fire('Success', msg, 'success');

      const updated = res.data?.data || null;
      if (updated) setComplaint(updated);

      setShowResolveModal(false);
      setProblemDesc('');
      setActionComment('');
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Failed to close complaint.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // FORWARD – PATCH /api/complaints/:id/forward
  const handleForward = async (e) => {
    e.preventDefault();
    if (!complaint?.id) {
      Swal.fire('Error', 'Invalid complaint ID', 'error');
      return;
    }
    if (!forwardStaffId) {
      Swal.fire('Error', 'Please select staff.', 'error');
      return;
    }
    if (!forwardDesc.trim()) {
      Swal.fire('Error', 'Please enter description.', 'error');
      return;
    }

    setUpdating(true);
    try {
      const res = await api.patch(`/api/complaints/${complaint.id}/forward`, {
        forwardToStaffId: forwardStaffId,
        forwardComment: forwardDesc,
      });

      const selectedStaff = allStaff.find(
        (s) =>
          String(s.id) === String(forwardStaffId) ||
          String(s.staffId) === String(forwardStaffId) ||
          String(s._id) === String(forwardStaffId)
      );

      const staffName =
        selectedStaff?.name ||
        selectedStaff?.fullName ||
        `${selectedStaff?.firstname || ''} ${selectedStaff?.lastname || ''}`.trim() ||
        selectedStaff?.username ||
        `Staff (${forwardStaffId})`;

      await Swal.fire(
        'Success',
        `Complaint forwarded to ${staffName} successfully.`,
        'success'
      );

      const updated = res.data?.data || null;
      if (updated) setComplaint(updated);

      setShowForwardModal(false);
      setForwardStaffId('');
      setForwardDesc('');
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Failed to forward complaint.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // ✅ Dropdown options based on mode
  const complaintDeptId = toNum(complaint?.departmentId);
  const isAssignMode = !complaint?.assignStaffId;

  const staffDropdownOptions = useMemo(() => {
    return (allStaff || [])
      .filter((staff) => {
        // exclude self
        const notSelf = currentUserId
          ? Number(staff.id) !== Number(currentUserId)
          : true;

        const role = String(staff.role || '').toLowerCase();
        const staffDeptIds = getStaffDeptIds(staff);

        // department filter
        const deptOk = isSuperadmin(staff)
          ? true
          : complaintDeptId
            ? staffDeptIds.includes(Number(complaintDeptId))
            : true;

        if (!notSelf || !deptOk) return false;

        // ✅ Assign mode: Admin/Subadmin can assign to admin/subadmin/engineer
        if (isAssignMode) {
          return ['admin', 'subadmin', 'engineer'].includes(role);
        }

        // ✅ Forward mode: only engineer/subadmin (as backend rule)
        return ['engineer', 'subadmin'].includes(role);
      })
      .map((staff) => staff);
  }, [allStaff, currentUserId, complaintDeptId, isAssignMode]);

  // --- PRINT / PDF HANDLERS ---
  const handlePrint = () => {
    if (!printRef.current) return;

    const printContents = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=650');

    win.document.write(`
     <html>
      <head>
        <title>Request - MET HELPDESK Complaint TICKET</title>
        <style>
          body {
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            margin: 0;
            padding: 20px;
            background: #fff;
          }
    
          .print-container {
            width: 750px;
            margin: 0 auto;
            padding: 20px;
          }
    
          .print-logo {
            width: 100%;
            text-align: center;
            margin-bottom: 12px;
          }
    
          .print-logo img {
            height: 90px;
            width: auto;
            object-fit: contain;
            display: inline-block;
          }
    
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
    
          td,
          th {
            padding: 6px 10px;
            border: 1px solid #d1d5db;
            font-size: 13px;
            font-weight: 400;
          }
    
          tr:nth-child(even) {
            background: #f9fafb;
          }
    
          /* ✅ ONLY FIRST ROW BOLD (for every table) */
          .print-container table tr:first-child td,
          .print-container table tr:first-child th {
            font-weight: 700;
          }
        </style>
      </head>
    
      <body>
        <div class="print-container">
          <div class="print-logo">
            <img src="${Logo}" alt="MET Logo" />
          </div>
    
          ${printContents}
        </div>
      </body>
    </html>
    
    `);

    win.document.close();
    win.focus();
    win.print();
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;

    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const imgRatio = imgProps.width / imgProps.height;
      let renderWidth = pdfWidth - 20;
      let renderHeight = renderWidth / imgRatio;

      if (renderHeight > pdfHeight - 20) {
        renderHeight = pdfHeight - 20;
        renderWidth = renderHeight * imgRatio;
      }

      const x = (pdfWidth - renderWidth) / 2;
      const y = 10;

      pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
      pdf.save(`complaint-${complaint.ticketId || complaint.id}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      Swal.fire('Error', 'Failed to generate PDF. Please try again.', 'error');
    }
  };

  // --- PRINTABLE CONTENT ---
  const renderPrintableContent = () => {
    if (!complaint || !staffDetails) return null;

    const raisedDate = new Date(complaint.createdAt || Date.now());
    const statusBadge = getStatusBadge(complaint.status);

    return (
      <div className="max-w-4xl mx-auto p-10 bg-white font-sans text-gray-800 text-sm leading-relaxed border border-gray-300 rounded-2xl [&_table_tr:first-child]:font-bold">

        {/* Ticket Info */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-blue-700 pl-4">
            Ticket Information
          </h2>
          <table className="w-full border border-gray-300 table-auto text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr className="bg-gray-50">
                <td className="px-5 py-3 font-semibold text-gray-700 w-52 align-top">
                  Ticket ID
                </td>
                <td className="px-5 py-3 font-medium text-gray-900">
                  {complaint.ticketId || complaint.id}
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-gray-700 align-top">
                  Status
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wide ${statusBadge.color === 'green'
                      ? 'bg-green-100 text-green-800'
                      : statusBadge.color === 'yellow'
                        ? 'bg-yellow-100 text-yellow-800'
                        : statusBadge.color === 'blue'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                  >
                    {statusBadge.text}
                  </span>
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-5 py-3 font-semibold text-gray-700 align-top">
                  Submitted On
                </td>
                <td className="px-5 py-3 text-gray-900">
                  {raisedDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}{' '}
                  at{' '}
                  {raisedDate.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Raised By */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-blue-700 pl-4">
            Complaint Raised By
          </h2>
          <table className="w-full border border-gray-300 table-auto text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr className="bg-gray-50">
                <td className="px-5 py-3 font-semibold w-52 text-gray-700">
                  Name
                </td>
                <td className="px-5 py-3 text-gray-900">
                  {getFullName(staffDetails)}
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-gray-700">
                  Email
                </td>
                <td className="px-5 py-3 text-gray-900">
                  {staffDetails.email || 'N/A'}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-5 py-3 font-semibold text-gray-700">
                  Phone
                </td>
                <td className="px-5 py-3 text-gray-900">
                  {staffDetails.phoneNumber ||
                    staffDetails.contactExtension ||
                    'N/A'}
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-gray-700">
                  Department(s)
                </td>
                <td className="px-5 py-3 text-gray-900">
                  {formatStaffDepartments(staffDetails)}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-5 py-3 font-semibold text-gray-700">
                  Complaint Department
                </td>
                <td className="px-5 py-3 text-gray-900">
                  {complaintDeptName || 'N/A'}{' '}
                  {complaint.departmentCategory
                    ? `- ${complaint.departmentCategory}`
                    : ''}
                </td>
              </tr>
            </tbody>
          </table>

          {complaint.behalf && behalfStaffDetails && (
            <p className="text-xs text-gray-700 mt-2 italic text-right">
              On behalf of: {getFullName(behalfStaffDetails)} • {behalfStaffDetails.email || 'N/A'}
            </p>
          )}

        </section>

        {/* Complaint Details */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-blue-700 pl-4">
            Complaint Details
          </h2>
          <table className="w-full border border-gray-300 table-auto text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr className="bg-gray-50">
                <td className="px-5 py-3 font-semibold w-52 text-gray-700">
                  Subject
                </td>
                <td className="px-5 py-3 font-medium text-gray-900">
                  {complaint.subject}
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-gray-700">
                  Description
                </td>
                <td className="px-5 py-3 text-gray-900 whitespace-pre-wrap">
                  {stripHtml(complaint.description)}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-5 py-3 font-semibold text-gray-700">
                  Priority
                </td>
                <td className="px-5 py-3 text-gray-900">
                  {(complaint.priority || 'N/A').toUpperCase()}
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-gray-700">
                  Location
                </td>
                <td className="px-5 py-3 text-gray-900">
                  {complaint.location || 'Not specified'}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-5 py-3 font-semibold text-gray-700">
                  Repeated
                </td>
                <td className="px-5 py-3 text-gray-900">
                  {complaint.isRepeated ? 'Yes' : 'No'}
                </td>
              </tr>

              {attachments.length > 0 && (
                <tr>
                  <td className="px-5 py-3 font-semibold text-gray-700">
                    Attachments
                  </td>
                  <td className="px-5 py-3 text-gray-900">
                    <ul className="list-disc list-inside space-y-1">
                      {attachments.map((att, idx) => (
                        <li key={idx}>{String(att).split('/').pop()}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Assignment & Resolution */}
        {(complaint.assignStaffId ||
          complaint.forwardToStaffId ||
          complaint.problemDescription ||
          complaint.actionTakenComment ||
          complaint.resolvedAt) && (
            <section className="mb-10">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-green-700 pl-4">
                Assignment & Resolution
              </h2>

              <table className="w-full border border-gray-300 table-auto text-sm">
                <tbody className="divide-y divide-gray-200">

                  {complaint.assignStaffId && (
                    <tr className="bg-gray-50">
                      <td className="px-5 py-3 font-semibold w-52 text-gray-700">
                        Assigned To
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {assignedStaff
                          ? getFullName(assignedStaff)
                          : `Staff ID: ${complaint.assignStaffId}`}
                        {assignedStaff?.role && (
                          <span className="text-xs text-gray-600 ml-1">
                            ({assignedStaff.role})
                          </span>
                        )}
                      </td>
                    </tr>
                  )}

                  {complaint.forwardToStaffId && (
                    <tr>
                      <td className="px-5 py-3 font-semibold text-gray-700">
                        Forwarded To
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {forwardedStaff
                          ? `${getFullName(forwardedStaff)} (${forwardedStaff.email || 'No email'
                          })`
                          : `Staff ID: ${complaint.forwardToStaffId}`}

                        {complaint.forwardComment && (
                          <div className="mt-1 italic text-gray-800">
                            Comment: {complaint.forwardComment}
                          </div>
                        )}

                        {complaint.forwardAt && (
                          <div className="mt-1 text-xs text-gray-500">
                            Forwarded at:{' '}
                            {new Date(complaint.forwardAt).toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                  {complaint.problemDescription && (
                    <tr className="bg-gray-50">
                      <td className="px-5 py-3 font-semibold text-gray-700">
                        Problem Description
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {complaint.problemDescription}
                      </td>
                    </tr>
                  )}

                  {complaint.actionTakenComment && (
                    <tr>
                      <td className="px-5 py-3 font-semibold text-gray-700">
                        Action Taken
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {complaint.actionTakenComment}
                      </td>
                    </tr>
                  )}

                  {complaint.resolvedAt && (
                    <tr className="bg-gray-50">
                      <td className="px-5 py-3 font-semibold text-gray-700">
                        Resolved At
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {new Date(complaint.resolvedAt).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t-2 border-dashed border-gray-500 text-center">
          <p className="text-sm font-medium text-gray-700">
            System Generated on: {new Date().toLocaleString('en-IN')}
          </p>
          <p className="text-base font-bold text-gray-800 mt-4">
            This is a digitally generated document • No signature required
          </p>
        </div>
      </div>

    );
  };

  // --- NORMAL SCREEN UI ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">Loading complaint details...</p>
      </div>
    );
  }

  if (!complaint || !staffDetails) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-500">Complaint or staff details not found.</p>
      </div>
    );
  }

  const statusBadgeUI = getStatusBadge(complaint.status);
  const normalizedStatus = normalizeStatus(complaint.status);

  return (
    <div className="p-6 bg-white shadow-lg rounded-lg border border-gray-200 relative">
      {/* Hidden printable area (off-screen) */}
      <div
        ref={printRef}
        style={{
          position: 'absolute',
          left: '-99999px',
          top: 0,
        }}
      >
        {renderPrintableContent()}
      </div>

      {/* Top actions: Print / Download PDF */}
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={handlePrint}
          className="px-3 py-2 text-xs md:text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Print
        </button>
        <button
          onClick={handleDownloadPdf}
          className="px-3 py-2 text-xs md:text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
        >
          Download PDF
        </button>
      </div>

      {/* Header */}
      <div className="border-b border-gray-200 pb-4 mb-6">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {complaint.subject}
          </h1>
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusBadgeUI.class}`}
          >
            {statusBadgeUI.text}
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Ticket ID: {complaint.ticketId || complaint.id}</span>
          <span>
            Submitted on {new Date(complaint.createdAt).toLocaleDateString()} at{' '}
            {new Date(complaint.createdAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* From / Dept */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-gray-600">
        <div>
          <label className="font-medium text-gray-700">From:</label>
          <div className="mt-1 space-y-1">
            <p className="font-medium text-gray-900">
              {getFullName(staffDetails)}
            </p>
            <p className="text-gray-500">{staffDetails.email}</p>
            <p className="text-gray-500">
              {staffDetails.phoneNumber || staffDetails.contactExtension}
            </p>
          </div>
          {complaint.behalf && (
            <div className="text-xs text-gray-400 mt-2 space-y-1">
              <p>On behalf of another staff</p>

              {behalfStaffDetails ? (
                <div className="text-gray-600">
                  <p className="font-medium text-gray-700">
                    {getFullName(behalfStaffDetails)}
                  </p>
                  <p>{behalfStaffDetails.email || 'N/A'}</p>
                  <p>
                    {behalfStaffDetails.phoneNumber ||
                      behalfStaffDetails.contactExtension ||
                      'N/A'}
                  </p>
                </div>
              ) : (
                <p className="italic">
                  Behalf staff details not available (ID: {complaint.behalfId || 'N/A'})
                </p>
              )}
            </div>
          )}

        </div>
        <div>
          <label className="font-medium text-gray-700">Department:</label>
          <p className="mt-1">
            {complaintDeptName || 'N/A'}{' '}
            {complaint.departmentCategory
              ? `- ${complaint.departmentCategory}`
              : ''}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Raised By Departments: {formatStaffDepartments(staffDetails)}
          </p>
        </div>
      </div>

      {/* Priority & Basics */}
      <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
        <div>
          <label className="font-medium text-gray-700 block mb-1">
            Priority:
          </label>
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(
              complaint.priority
            )} text-white`}
          >
            {(complaint.priority || '').toUpperCase() || 'N/A'}
          </span>
        </div>
        <div>
          <label className="font-medium text-gray-700 block mb-1">
            Location:
          </label>
          <p>{complaint.location || 'Not specified'}</p>
        </div>
        <div>
          <label className="font-medium text-gray-700 block mb-1">
            Repeated:
          </label>
          <p>{complaint.isRepeated ? 'Yes' : 'No'}</p>
        </div>
        {complaint.assignStaffId && (
          <div>
            <label className="font-medium text-gray-700 block mb-1">
              Assigned To:
            </label>
            <p className="font-medium text-gray-900">
              {assignedStaff
                ? getFullName(assignedStaff)
                : `Staff ID: ${complaint.assignStaffId}`}
              {isAssignedToCurrent && (
                <span className="text-xs text-green-600 ml-1">(You)</span>
              )}
            </p>
            {assignedStaff?.email && (
              <p className="text-gray-500 text-sm">{assignedStaff.email}</p>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="font-medium text-gray-700 block mb-2">
          Description:
        </label>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 prose max-w-none">
          {/* ✅ HTML tags removed */}
          <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
            {stripHtml(complaint.description)}
          </p>
        </div>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mb-6">
          <label className="font-medium text-gray-700 block mb-2">
            Attachments:
          </label>
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <a
                key={index}
                href={getFullUrl(attachment)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-500"
              >
                📎 {String(attachment).split('/').pop()}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Extra sections */}
      {complaint.forwardToStaffId && (
        <div className="mb-4">
          <label className="font-medium text-gray-700 block mb-2">
            Forwarded To:
          </label>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-800">
            <p className="font-medium">
              {forwardedStaff
                ? `${getFullName(forwardedStaff)} (${forwardedStaff.email || 'No email'
                })`
                : `Staff ID: ${complaint.forwardToStaffId}`}
            </p>

            {complaint.forwardComment && (
              <p className="mt-1">
                <span className="font-semibold">Comment: </span>
                {complaint.forwardComment}
              </p>
            )}

            {complaint.forwardAt && (
              <p className="mt-1 text-xs text-gray-500">
                Forwarded at: {new Date(complaint.forwardAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {complaint.problemDescription && (
        <div className="mb-4">
          <label className="font-medium text-gray-700 block mb-2">
            Problem Description:
          </label>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-800">
            <p>{complaint.problemDescription}</p>
          </div>
        </div>
      )}

      {complaint.actionTakenComment && (
        <div className="mb-6">
          <label className="font-medium text-gray-700 block mb-2">
            Action Taken:
          </label>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-gray-800">
            <p>{complaint.actionTakenComment}</p>
          </div>
        </div>
      )}

      {complaint.resolvedAt && (
        <div className="mb-6">
          <label className="font-medium text-gray-700 block mb-2">
            Resolved:
          </label>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800">
            <p>
              Resolved at: {new Date(complaint.resolvedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-200">
        {/* Self Assign */}
        {!complaint.assignStaffId && canSelfAssign && (
          <button
            onClick={handleSelfAssign}
            disabled={updating}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {updating ? 'Assigning...' : 'Assign to Self'}
          </button>
        )}

        {/* Admin/Subadmin -> Assign to Staff */}
        {!complaint.assignStaffId && canAssignOthers && (
          <button
            onClick={() => setShowForwardModal(true)}
            disabled={updating}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {updating ? 'Opening…' : 'Assign to Staff'}
          </button>
        )}


        {/* Assigned badge */}
        {complaint.assignStaffId && canAssignOthers && (
          <button
            disabled
            className="px-4 py-2 bg-gray-300 text-gray-600 rounded-md text-sm font-medium"
          >
            Assigned
          </button>
        )}

        {/* Resolve & Forward (only assignee, not closed) */}
        {complaint.assignStaffId &&
          normalizedStatus !== 'closed' &&
          isAssignedToCurrent && (
            <>
              <button
                onClick={() => setShowResolveModal(true)}
                disabled={updating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {updating ? 'Processing...' : 'Resolve & Close'}
              </button>
              <button
                onClick={() => setShowForwardModal(true)}
                disabled={updating}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {updating ? 'Processing...' : 'Forward'}
              </button>
            </>
          )}

        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm font-medium transition-colors"
        >
          Back
        </button>
      </div>

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Resolve & Close Ticket</h2>
            <form onSubmit={handleResolve}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Problem Description:
                </label>
                <textarea
                  value={problemDesc}
                  onChange={(e) => setProblemDesc(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the problem in detail..."
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Taken Comment:
                </label>
                <textarea
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What actions were taken to resolve..."
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResolveModal(false);
                    setProblemDesc('');
                    setActionComment('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? 'Resolving...' : 'Resolve & Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign / Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {isAssignMode ? 'Assign Ticket' : 'Forward Ticket'}
            </h2>

            {/* ✅ IMPORTANT: Assign mode -> handleAssignToStaff, Forward mode -> handleForward */}
            <form onSubmit={isAssignMode ? handleAssignToStaff : handleForward}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isAssignMode ? 'Assign to Staff:' : 'Forward to Staff:'}
                </label>

                <select
                  value={forwardStaffId}
                  onChange={(e) => setForwardStaffId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">
                    {isAssignMode
                      ? 'Choose staff to assign...'
                      : 'Choose staff to forward...'}
                  </option>

                  {staffDropdownOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {getFullName(staff)} ({staff.email})
                    </option>
                  ))}
                </select>

                {!complaintDeptId && (
                  <p className="text-xs text-red-500 mt-2">
                    complaint.departmentId missing, department filter skipped.
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isAssignMode
                    ? 'Assignment Description:'
                    : 'Forward Description:'}
                </label>
                <textarea
                  value={forwardDesc}
                  onChange={(e) => setForwardDesc(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    isAssignMode
                      ? 'Reason / note for assigning...'
                      : 'Reason for forwarding...'
                  }
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForwardModal(false);
                    setForwardStaffId('');
                    setForwardDesc('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updating || !forwardStaffId}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
                >
                  {updating
                    ? isAssignMode
                      ? 'Assigning...'
                      : 'Forwarding...'
                    : isAssignMode
                      ? 'Assign'
                      : 'Forward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

ComplaintDetails.propTypes = {
  complaint: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    ticketId: PropTypes.string,
    createdAt: PropTypes.string,
    subject: PropTypes.string,
    description: PropTypes.string,
    departmentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    departmentCategory: PropTypes.string,
    priority: PropTypes.string,
    status: PropTypes.string,
    location: PropTypes.string,
    isRepeated: PropTypes.bool,
    behalf: PropTypes.bool,
    behalfId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    attachments: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]),
    staffId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    assignStaffId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    problemDescription: PropTypes.string,
    actionTakenComment: PropTypes.string,
    forwardToStaffId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    forwardComment: PropTypes.string,
    forwardAt: PropTypes.string,
    resolvedAt: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
};

export default ComplaintDetails;
