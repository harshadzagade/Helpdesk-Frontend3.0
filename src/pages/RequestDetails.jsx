import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import api from '../lib/api';
import { useAuth } from '../context/authContext/AuthContext';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Logo from '../assets/MET-logo.png';

/** ✅ NEW: DepartmentIds helper */
const getStaffDepartmentIds = (staff) => {
  if (!staff) return [];
  if (Array.isArray(staff.departmentIds)) return staff.departmentIds;
  return [];
};

/** ✅ NEW: normalize id to number safely */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const RequestDetails = ({ request: initialRequest, onClose }) => {
  const { user } = useAuth();

  const [request, setRequest] = useState(initialRequest || null);
  const [requesterStaff, setRequesterStaff] = useState(null);
  const [assignedStaff, setAssignedStaff] = useState(null);
  const [allStaff, setAllStaff] = useState([]);
  const [staffById, setStaffById] = useState({});
  const [behalfStaffDetails, setBehalfStaffDetails] = useState(null);
  const [currentStaff, setCurrentStaff] = useState(null);
  const [targetDeptName, setTargetDeptName] = useState('');

  /** ✅ NEW: deptId -> deptName mapping */
  const [deptMap, setDeptMap] = useState({}); // { [id]: "IT" }

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modals
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showHod1Modal, setShowHod1Modal] = useState(false);
  const [showHod2Modal, setShowHod2Modal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Close fields
  const [problemDesc, setProblemDesc] = useState('');
  const [actionComment, setActionComment] = useState('');

  // HOD1 approve
  const [hod1Comment, setHod1Comment] = useState('');

  // HOD2 approve + assign
  const [hod2Comment, setHod2Comment] = useState('');
  const [hod2AssignStaffId, setHod2AssignStaffId] = useState('');

  // Forward
  const [forwardStaffId, setForwardStaffId] = useState('');
  const [forwardDesc, setForwardDesc] = useState('');

  // Reject
  const [rejectComment, setRejectComment] = useState('');

  const apiBaseURL = (api?.defaults?.baseURL || '').replace(/\/$/, '');

  const currentUserId = user?.id ?? (Number(localStorage.getItem('staffId')) || null);
  const currentUserRole = (user?.role || '').toLowerCase();

  // Printable ref
  const printRef = useRef(null);

  const getFullName = (staff) => {
    if (!staff) return 'N/A';
    return `${staff.firstname || ''} ${staff.middlename || ''} ${staff.lastname || ''}`
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
      pending: { class: 'bg-yellow-500 text-yellow-900', text: 'Pending' },
      'hod1-approved': { class: 'bg-indigo-500 text-white', text: 'HOD1 Approved' },
      'hod2-approved': { class: 'bg-purple-500 text-white', text: 'HOD2 Approved' },
      'in-progress': { class: 'bg-blue-500 text-white', text: 'In Progress' },
      closed: { class: 'bg-gray-600 text-white', text: 'Closed' },
      rejected: { class: 'bg-red-600 text-white', text: 'Rejected' },
    };
    return (
      badges[status] || {
        class: 'bg-gray-300 text-gray-700',
        text: statusRaw || 'N/A',
      }
    );
  };

  // ✅ HTML tags remove + entities decode (basic)
  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = String(html);
    // textContent will remove tags and keep only text
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  };


  const getFullUrl = (p) => {
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    if (!apiBaseURL) return p;
    if (p.startsWith('/')) return `${apiBaseURL}${p}`;
    return `${apiBaseURL}/${p}`;
  };

  /** ✅ NEW: convert deptIds -> dept names for display */
  const idsToNames = (ids) => (ids || []).map((id) => deptMap[id]).filter(Boolean);

  const attachments = Array.isArray(request?.attachments)
    ? request.attachments
    : request?.attachments
      ? [request.attachments]
      : [];

  const forwardedStaff =
    request?.forwardToStaffId && Array.isArray(allStaff)
      ? allStaff.find((s) => String(s.id) === String(request.forwardToStaffId))
      : null;

  /** ✅ NEW: Fetch all departments once for mapping */
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get('/api/departments');
        const list = res.data?.data || res.data || [];
        const map = {};
        (Array.isArray(list) ? list : []).forEach((d) => {
          if (d?.id != null) map[d.id] = d.department;
        });
        setDeptMap(map);
      } catch (err) {
        console.warn('Failed to fetch departments list', err);
        setDeptMap({});
      }
    };
    fetchDepts();
  }, []);

  // --- DATA FETCH ---
  useEffect(() => {
    const fetchData = async () => {
      if (!initialRequest) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        setRequest(initialRequest);

        // 1) requester staff
        if (initialRequest.staffId) {
          const res = await api.get(`/api/staff/${initialRequest.staffId}`);
          setRequesterStaff(res.data?.data || res.data || null);
        }

        // 2) assigned staff
        if (initialRequest.assignStaffId) {
          try {
            const res = await api.get(`/api/staff/${initialRequest.assignStaffId}`);
            setAssignedStaff(res.data?.data || res.data || null);
          } catch (err) {
            console.warn('Failed to fetch assigned staff', err);
            setAssignedStaff(null);
          }
        } else {
          setAssignedStaff(null);
        }

        // ✅ behalf staff (jiske behalf pe complaint raise hua)
        if (initialRequest.behalf && initialRequest.behalfId) {
          try {
            const behalfRes = await api.get(`/api/staff/${initialRequest.behalfId}`);
            setBehalfStaffDetails(behalfRes.data?.data || behalfRes.data || null);
          } catch (err) {
            console.warn('Failed to fetch behalf staff', err);
            setBehalfStaffDetails(null);
          }
        } else {
          setBehalfStaffDetails(null);
        }

        // 3) current staff
        if (currentUserId) {
          try {
            const meRes = await api.get(`/api/staff/${currentUserId}`);
            setCurrentStaff(meRes.data?.data || meRes.data || null);
          } catch (err) {
            console.warn('Failed to fetch current staff record', err);
            setCurrentStaff(null);
          }
        }

        // 4) target department name (for display only)
        if (initialRequest.departmentId) {
          try {
            const deptRes = await api.get(`/api/departments/${initialRequest.departmentId}`);
            const deptData = deptRes.data?.data || deptRes.data || null;
            setTargetDeptName(deptData?.department || '');
          } catch (err) {
            console.warn('Failed to fetch target department', err);
            setTargetDeptName('');
          }
        } else {
          setTargetDeptName('');
        }

        // 5) all staff list
        try {
          const staffRes = await api.get('/api/staff');
          const list = staffRes.data?.data || staffRes.data || [];
          setAllStaff(Array.isArray(list) ? list : []);
        } catch (err) {
          console.warn('Failed to fetch staff list', err);
          setAllStaff([]);
        }

        const approverIds = [
          initialRequest.hod1ApprovedById,
          initialRequest.hod2ApprovedById,
          initialRequest.rejectedById,
          initialRequest.assignedById,
        ].filter(Boolean);

        if (approverIds.length > 0) {
          const fetchedStaff = await Promise.all(
            [...new Set(approverIds.map(String))].map(async (id) => {
              try {
                const res = await api.get(`/api/staff/${id}`);
                return [String(id), res.data?.data || res.data || null];
              } catch (err) {
                console.warn(`Failed to fetch staff ${id}`, err);
                return [String(id), null];
              }
            })
          );
          setStaffById(Object.fromEntries(fetchedStaff.filter(([, value]) => value)));
        } else {
          setStaffById({});
        }
      } catch (err) {
        console.error('Error in RequestDetails fetchData', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initialRequest, currentUserId]);

  // --- ELIGIBILITY FLAGS (UPDATED: departmentIds based) ---

  const isAdminOrSubadmin = currentUserRole === 'admin' || currentUserRole === 'subadmin';

  /** ✅ FIX: engineer vs engineers */
  const isResolverRole =
    currentUserRole === 'engineer' ||
    currentUserRole === 'engineers' ||
    currentUserRole === 'subadmin';

  const statusNorm = normalizeStatus(request?.status);
  const isBlocked = ['closed', 'rejected'].includes(statusNorm);

  const isAssignee = currentUserId && request?.assignStaffId === currentUserId;

  const currentDeptIds = getStaffDepartmentIds(currentStaff);
  const requesterDeptIds = getStaffDepartmentIds(requesterStaff);

  const targetDeptId = toNum(request?.departmentId);

  /** ✅ HOD1: requester dept ka admin/subadmin */
  const isHodOfRequester =
    isAdminOrSubadmin &&
    currentDeptIds.length > 0 &&
    requesterDeptIds.length > 0 &&
    currentDeptIds.some((id) => requesterDeptIds.includes(id));

  /** ✅ HOD2: target deptId ka admin/subadmin */
  const isHodOfTarget =
    isAdminOrSubadmin &&
    targetDeptId != null &&
    currentDeptIds.includes(targetDeptId);

  // phases
  const isHod1Phase = isHodOfRequester && request && !request.hod1Approval;
  const isHod2Phase = isHodOfTarget && request && request.hod1Approval && !request.hod2Approval;

  const canHod1Approve = isHod1Phase && !isBlocked;
  const canHod2Approve = isHod2Phase && !isBlocked;

  const canEngineerActOnRequest = isResolverRole && isAssignee && !isBlocked;

  const canRejectRequest =
    isAdminOrSubadmin && request && !isBlocked && (isHod1Phase || isHod2Phase);

  const statusBadge = getStatusBadge(request?.status);
  const requesterDeptLabel = idsToNames(requesterDeptIds).length
    ? idsToNames(requesterDeptIds).join(', ')
    : 'Requester Department';
  const targetDeptLabel = targetDeptName || (request?.departmentId ? `Department ID: ${request.departmentId}` : 'Target Department');

  const isHod1AutoApproved =
    request?.hod1Approval &&
    !request?.hod1ApprovedById &&
    /auto-approved/i.test(String(request?.hod1Comment || ''));

  const hod1ApprovedByStaff =
    request?.hod1ApprovedById
      ? staffById[String(request.hod1ApprovedById)] ||
        (Array.isArray(allStaff)
          ? allStaff.find((s) => String(s.id) === String(request.hod1ApprovedById))
          : null) ||
        (String(currentStaff?.id) === String(request.hod1ApprovedById) ? currentStaff : null)
      : isHod1AutoApproved
        ? { firstname: 'System', middlename: 'Auto', lastname: 'Approval', role: 'Auto' }
        : null;

  const hod2ApprovedByStaff =
    request?.hod2ApprovedById
      ? staffById[String(request.hod2ApprovedById)] ||
        (Array.isArray(allStaff)
          ? allStaff.find((s) => String(s.id) === String(request.hod2ApprovedById))
          : null) ||
        (String(currentStaff?.id) === String(request.hod2ApprovedById) ? currentStaff : null)
      : null;

  const rejectedByStaff =
    request?.rejectedById
      ? staffById[String(request.rejectedById)] ||
        (Array.isArray(allStaff)
          ? allStaff.find((s) => String(s.id) === String(request.rejectedById))
          : null) ||
        (String(currentStaff?.id) === String(request.rejectedById) ? currentStaff : null)
      : null;

  // --- ACTIONS ---
  const handleHod1Approve = async (e) => {
    e.preventDefault();
    if (!request?.id) return Swal.fire('Error', 'Invalid request ID', 'error');
    if (!hod1Comment.trim()) return Swal.fire('Error', 'Please enter approval comment.', 'error');

    setUpdating(true);
    try {
      const res = await api.patch(`/api/requests/${request.id}/hod1-approve`, {
        comment: hod1Comment,
      });

      await Swal.fire('Success', res.data?.message || 'HOD1 approved', 'success');
      const updated = res.data?.data || null;
      if (updated) setRequest(updated);

      setShowHod1Modal(false);
      setHod1Comment('');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to approve as HOD1.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleHod2Approve = async (e) => {
    e.preventDefault();
    if (!request?.id) return Swal.fire('Error', 'Invalid request ID', 'error');
    if (!hod2AssignStaffId) return Swal.fire('Error', 'Please select engineer/subadmin to assign.', 'error');
    if (!hod2Comment.trim()) return Swal.fire('Error', 'Please enter approval comment.', 'error');

    setUpdating(true);
    try {
      const res = await api.patch(`/api/requests/${request.id}/hod2-approve`, {
        comment: hod2Comment,
        assignStaffId: hod2AssignStaffId,
      });

      await Swal.fire('Success', res.data?.message || 'HOD2 approved', 'success');
      const updated = res.data?.data || null;
      if (updated) setRequest(updated);

      setShowHod2Modal(false);
      setHod2Comment('');
      setHod2AssignStaffId('');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to approve as HOD2.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    if (!request?.id) return Swal.fire('Error', 'Invalid request ID', 'error');
    if (!problemDesc.trim() || !actionComment.trim()) {
      return Swal.fire('Error', 'Problem description and action taken are required.', 'error');
    }

    setUpdating(true);
    try {
      const res = await api.patch(`/api/requests/${request.id}/close`, {
        problemDescription: problemDesc,
        actionTakenComment: actionComment,
      });

      await Swal.fire('Success', res.data?.message || 'Closed', 'success');
      const updated = res.data?.data || null;
      if (updated) setRequest(updated);

      setShowCloseModal(false);
      setProblemDesc('');
      setActionComment('');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to close request.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleForward = async (e) => {
    e.preventDefault();
    if (!request?.id) return Swal.fire('Error', 'Invalid request ID', 'error');
    if (!forwardStaffId) return Swal.fire('Error', 'Please select staff to forward.', 'error');
    if (!forwardDesc.trim()) return Swal.fire('Error', 'Please enter forward description.', 'error');

    setUpdating(true);
    try {
      const res = await api.patch(`/api/requests/${request.id}/forward`, {
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
        `${selectedStaff?.firstname || ''} ${selectedStaff?.lastname || ''}`.trim() || `Staff (${forwardStaffId})`;

      await Swal.fire(
        'Success',
        `Request forwarded to ${staffName} successfully.`,
        'success'
      );

      const updated = res.data?.data || null;
      if (updated) setRequest(updated);

      setShowForwardModal(false);
      setForwardStaffId('');
      setForwardDesc('');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to forward request.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!request?.id) return Swal.fire('Error', 'Invalid request ID', 'error');
    if (!rejectComment.trim()) return Swal.fire('Error', 'Please enter rejection reason/comment.', 'error');

    const levelLabel = isHod1Phase ? 'HOD1' : isHod2Phase ? 'HOD2' : 'HOD';

    const confirm = await Swal.fire({
      title: `Reject as ${levelLabel}?`,
      text: 'Are you sure you want to reject this request?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Reject',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });

    if (!confirm.isConfirmed) return;

    setUpdating(true);
    try {
      const res = await api.patch(`/api/requests/${request.id}/reject`, {
        comment: rejectComment,
      });

      await Swal.fire('Success', res.data?.message || 'Rejected', 'success');
      const updated = res.data?.data || null;
      if (updated) setRequest(updated);

      setShowRejectModal(false);
      setRejectComment('');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reject request.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // --- PRINT / PDF ---
  const handlePrint = () => {
    if (!printRef.current) return;

    const printContents = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=650');
    win.document.write(`
    <html>
  <head>
    <title>Request - MET HELPDESK REQUEST TICKET</title>
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
      pdf.save(`request-${request.ticketId || request.id}.pdf`);
    } catch (err) {
      console.error('PDF download failed:', err);
      Swal.fire('Error', 'Failed to generate PDF. Please try again.', 'error');
    }
  };

  // --- PRINTABLE CONTENT ---
  const renderPrintableContent = () => {
    const raisedDate = new Date(request.createdAt);

    const requesterDeptNames = idsToNames(getStaffDepartmentIds(requesterStaff));
    const hod1DeptLabel = requesterDeptNames.length ? requesterDeptNames.join(', ') : 'Requester Department';
    const hod2DeptLabel = targetDeptName || (request.departmentId ? `Department ID: ${request.departmentId}` : 'Target Department');
    return (
      <div className="max-w-4xl mx-auto p-10 bg-white font-sans text-gray-800 text-sm leading-relaxed border border-gray-300 rounded-2xl [&_table_tr:first-child]:font-bold">

        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-blue-700 pl-4">
            Ticket Information
          </h2>

          <table className="w-full border border-gray-300 table-auto text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr className="bg-gray-50">
                <td className="px-5 py-3 w-52 align-top text-gray-700">Ticket ID</td>
                <td className="px-5 py-3 text-gray-900">{request.ticketId || request.id}</td>
              </tr>

              <tr>
                <td className="px-5 py-3 align-top text-gray-700">Status</td>
                <td className="px-5 py-3">
                  <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wide bg-gray-100 text-gray-800">
                    {statusBadge.text}
                  </span>
                </td>
              </tr>

              <tr className="bg-gray-50">
                <td className="px-5 py-3 align-top text-gray-700">Raised On</td>
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

        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-blue-700 pl-4">
            Request Raised By
          </h2>

          <table className="w-full border border-gray-300 table-auto text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr className="bg-gray-50">
                <td className="px-5 py-3 w-52 text-gray-700">Name</td>
                <td className="px-5 py-3 text-gray-900">{getFullName(requesterStaff)}</td>
              </tr>

              <tr>
                <td className="px-5 py-3 text-gray-700">Email</td>
                <td className="px-5 py-3 text-gray-900">{requesterStaff.email || 'N/A'}</td>
              </tr>

              <tr className="bg-gray-50">
                <td className="px-5 py-3 text-gray-700">Phone</td>
                <td className="px-5 py-3 text-gray-900">{requesterStaff.phoneNumber || 'N/A'}</td>
              </tr>

              <tr>
                <td className="px-5 py-3 text-gray-700">Department(s)</td>
                <td className="px-5 py-3 text-gray-900">
                  {requesterDeptNames.length ? requesterDeptNames.join(', ') : 'N/A'}
                </td>
              </tr>

              <tr className="bg-gray-50">
                <td className="px-5 py-3 text-gray-700">Subject</td>
                <td className="px-5 py-3 text-gray-900">{request.subject}</td>
              </tr>

              <tr className="bg-gray-50">
                <td className="px-5 py-3 text-gray-700">Description</td>
                <td className="px-5 py-3 text-gray-900">{stripHtml(request.description)}</td>
              </tr>
            </tbody>
          </table>

          {request.behalf && behalfStaffDetails && (
            <p className="text-xs text-gray-700 mt-2 italic text-right">
              On behalf of: {getFullName(behalfStaffDetails)} • {behalfStaffDetails.email || 'N/A'}
            </p>
          )}
        </section>

        {request.hod1Approval && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-green-700 pl-4">
              HOD1 Approval - Requester Department ({hod1DeptLabel})
            </h2>

            <table className="w-full border border-green-300 table-auto text-sm">
              <tbody className="divide-y divide-green-200">
                <tr className="bg-green-50">
                  <td className="px-5 py-3 text-gray-700">HOD Department</td>
                  <td className="px-5 py-3 text-gray-900">{hod1DeptLabel}</td>
                </tr>

                <tr>
                  <td className="px-5 py-3 w-52 text-gray-700">Approved By</td>
                  <td className="px-5 py-3 text-gray-900">
                    {getFullName(hod1ApprovedByStaff)}{' '}
                    <span className="text-xs text-gray-600">({hod1ApprovedByStaff?.role})</span>
                  </td>
                </tr>

                <tr className="bg-green-50">
                  <td className="px-5 py-3 text-gray-700">Date &amp; Time</td>
                  <td className="px-5 py-3 text-gray-900">
                    {new Date(request.hod1ApprovedAt).toLocaleString('en-IN')}
                  </td>
                </tr>

                <tr>
                  <td className="px-5 py-3 text-gray-700">Comment</td>
                  <td className="px-5 py-3 italic text-gray-900">{request.hod1Comment || 'Approved'}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {request.hod2Approval && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-green-700 pl-4">
              HOD2 Approval - Target Department ({hod2DeptLabel})
            </h2>

            <table className="w-full border border-green-300 table-auto text-sm">
              <tbody className="divide-y divide-green-200">
                <tr className="bg-green-50">
                  <td className="px-5 py-3 text-gray-700">HOD Department</td>
                  <td className="px-5 py-3 text-gray-900">{hod2DeptLabel}</td>
                </tr>

                <tr>
                  <td className="px-5 py-3 w-52 text-gray-700">Approved By</td>
                  <td className="px-5 py-3 text-gray-900">
                    {getFullName(hod2ApprovedByStaff)}{' '}
                    <span className="text-xs text-gray-600">({hod2ApprovedByStaff?.role})</span>
                  </td>
                </tr>

                <tr className="bg-green-50">
                  <td className="px-5 py-3 text-gray-700">Date &amp; Time</td>
                  <td className="px-5 py-3 text-gray-900">
                    {new Date(request.hod2ApprovedAt).toLocaleString('en-IN')}
                  </td>
                </tr>

                <tr>
                  <td className="px-5 py-3 text-gray-700">Comment</td>
                  <td className="px-5 py-3 italic text-gray-900">{request.hod2Comment || 'Approved'}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {(request.assignStaffId ||
          request.forwardToStaffId ||
          request.problemDescription ||
          request.actionTakenComment ||
          request.resolvedAt) && (
            <section className="mb-10">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-green-700 pl-4">
                Assignment &amp; Resolution
              </h2>

              <table className="w-full border border-gray-300 table-auto text-sm">
                <tbody className="divide-y divide-gray-200">
                  {request.assignStaffId && (
                    <tr className="bg-gray-50">
                      <td className="px-5 py-3 font-semibold w-52 text-gray-700">
                        Assigned To
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {assignedStaff
                          ? getFullName(assignedStaff)
                          : `Staff ID: ${request.assignStaffId}`}
                        {assignedStaff?.role && (
                          <span className="text-xs text-gray-600 ml-1">
                            ({assignedStaff.role})
                          </span>
                        )}
                      </td>
                    </tr>
                  )}

                  {request.forwardToStaffId && (
                    <tr>
                      <td className="px-5 py-3 font-semibold text-gray-700">
                        Forwarded To
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {forwardedStaff
                          ? `${getFullName(forwardedStaff)} (${forwardedStaff.email || 'No email'})`
                          : `Staff ID: ${request.forwardToStaffId}`}

                        {request.forwardComment && (
                          <div className="mt-1 italic text-gray-800">
                            Comment: {request.forwardComment}
                          </div>
                        )}

                        {request.forwardAt && (
                          <div className="mt-1 text-xs text-gray-500">
                            Forwarded at: {new Date(request.forwardAt).toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                  {request.problemDescription && (
                    <tr className="bg-gray-50">
                      <td className="px-5 py-3 font-semibold text-gray-700">
                        Problem Description
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {request.problemDescription}
                      </td>
                    </tr>
                  )}

                  {request.actionTakenComment && (
                    <tr>
                      <td className="px-5 py-3 font-semibold text-gray-700">
                        Action Taken
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {request.actionTakenComment}
                      </td>
                    </tr>
                  )}

                  {request.resolvedAt && (
                    <tr className="bg-gray-50">
                      <td className="px-5 py-3 font-semibold text-gray-700">
                        Resolved At
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {new Date(request.resolvedAt).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

        <div className="mt-16 pt-8 border-t-2 border-dashed border-gray-500 text-center">
          <p className="text-sm font-medium text-gray-700">
            System Generated on: {new Date().toLocaleString('en-IN')}
          </p>
        </div>
      </div>


    );
  };

  // UI loading
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">Loading request details...</p>
      </div>
    );
  }

  if (!request || !requesterStaff) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-500">Request or staff details not found.</p>
      </div>
    );
  }

  const statusBadgeUI = getStatusBadge(request?.status);

  return (
    <div className="p-6 bg-white shadow-lg rounded-lg border border-gray-200 relative">
      <div
        ref={printRef}
        style={{ position: 'absolute', left: '-99999px', top: 0 }}
      >
        {renderPrintableContent()}
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => setShowPreview(true)}
          className="px-3 py-2 text-xs md:text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          Preview
        </button>
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

      <div className="border-b border-gray-200 pb-4 mb-6">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{request.subject}</h1>
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusBadgeUI.class}`}
          >
            {statusBadgeUI.text}
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Ticket ID: {request.ticketId || request.id}</span>
          <span>
            Submitted on {new Date(request.createdAt).toLocaleDateString()} at{' '}
            {new Date(request.createdAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-gray-600">
        <div>
          <label className="font-medium text-gray-700">Requested By:</label>
          <div className="mt-1 space-y-1">
            <p className="font-medium text-gray-900">{getFullName(requesterStaff)}</p>
            <p className="text-gray-500">{requesterStaff.email}</p>
            {requesterStaff.phoneNumber && <p className="text-gray-500">{requesterStaff.phoneNumber}</p>}
          </div>
          {request.behalf && (
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
                  Behalf staff details not available (ID: {request.behalfId || 'N/A'})
                </p>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="font-medium text-gray-700">Target Department:</label>
          <p className="mt-1">
            {targetDeptName || `ID: ${request.departmentId || 'N/A'}`}
            {request.departmentCategory ? ` - ${request.departmentCategory}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
        <div>
          <label className="font-medium text-gray-700 block mb-1">Priority:</label>
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(
              request.priority
            )} text-white`}
          >
            {(request.priority || '').toUpperCase() || 'N/A'}
          </span>
        </div>
        <div>
          <label className="font-medium text-gray-700 block mb-1">Location:</label>
          <p>{request.location || 'Not specified'}</p>
        </div>
        <div>
          <label className="font-medium text-gray-700 block mb-1">Repeated:</label>
          <p>{request.isRepeated ? 'Yes' : 'No'}</p>
        </div>
        {request.assignStaffId && (
          <div>
            <label className="font-medium text-gray-700 block mb-1">Assigned To:</label>
            <p className="font-medium text-gray-900">
              {assignedStaff ? getFullName(assignedStaff) : `Staff ID: ${request.assignStaffId}`}
              {isAssignee && <span className="text-xs text-green-600 ml-1">(You)</span>}
            </p>
            {assignedStaff?.email && <p className="text-gray-500 text-sm">{assignedStaff.email}</p>}
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="font-medium text-gray-700 block mb-2">Description:</label>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 prose max-w-none">
          <p className="text-gray-900 leading-relaxed">{stripHtml(request.description)}</p>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="mb-6">
          <label className="font-medium text-gray-700 block mb-2">Attachments:</label>
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

      {request.hod1Approval && (
        <div className="mb-4">
          <label className="font-medium text-gray-700 block mb-2">
            HOD1 Approval - Requester Department ({requesterDeptLabel}):
          </label>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-gray-800">
            <p className="text-xs font-semibold text-indigo-700 mb-1">
              HOD1 is the HOD/Admin of the request raised by user's department.
            </p>
            <p className="font-semibold">
              Approved By: {hod1ApprovedByStaff ? getFullName(hod1ApprovedByStaff) : 'N/A'}
              {hod1ApprovedByStaff?.role && (
                <span className="text-xs text-gray-500 ml-1">({hod1ApprovedByStaff.role})</span>
              )}
            </p>
            <p className="mt-1">{request.hod1Comment || 'Approved'}</p>
            {request.hod1ApprovedAt && (
              <p className="text-xs text-gray-500 mt-1">
                Approved at: {new Date(request.hod1ApprovedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {request.hod2Approval && (
        <div className="mb-4">
          <label className="font-medium text-gray-700 block mb-2">
            HOD2 Approval - Target Department ({targetDeptLabel}):
          </label>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-gray-800">
            <p className="text-xs font-semibold text-purple-700 mb-1">
              HOD2 is the HOD/Admin of the department where this request is sent.
            </p>
            <p className="font-semibold">
              Approved By: {hod2ApprovedByStaff ? getFullName(hod2ApprovedByStaff) : 'N/A'}
              {hod2ApprovedByStaff?.role && (
                <span className="text-xs text-gray-500 ml-1">({hod2ApprovedByStaff.role})</span>
              )}
            </p>
            <p className="mt-1">{request.hod2Comment || 'Approved'}</p>
            {request.hod2ApprovedAt && (
              <p className="text-xs text-gray-500 mt-1">
                Approved at: {new Date(request.hod2ApprovedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {request.forwardToStaffId && (
        <div className="mb-4">
          <label className="font-medium text-gray-700 block mb-2">Forwarded To:</label>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-800">
            <p className="font-medium">
              {forwardedStaff
                ? `${getFullName(forwardedStaff)} (${forwardedStaff.email || 'No email'})`
                : `Staff ID: ${request.forwardToStaffId}`}
            </p>
            {request.forwardComment && (
              <p className="mt-1">
                <span className="font-semibold">Comment: </span>
                {request.forwardComment}
              </p>
            )}
            {request.forwardAt && (
              <p className="mt-1 text-xs text-gray-500">
                Forwarded at: {new Date(request.forwardAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {statusNorm === 'rejected' && (request.rejectionComment || request.rejectedAt) && (
        <div className="mb-4">
          <label className="font-medium text-gray-700 block mb-2">Rejection Details:</label>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-gray-800">
            <p className="font-semibold">
              Rejected By: {rejectedByStaff ? getFullName(rejectedByStaff) : 'N/A'}
              {rejectedByStaff?.role && (
                <span className="text-xs text-gray-500 ml-1">({rejectedByStaff.role})</span>
              )}
              {request.rejectedByLevel && (
                <span className="text-xs text-red-700 ml-2">[{request.rejectedByLevel}]</span>
              )}
            </p>
            {request.rejectionComment && (
              <p className="mt-1">
                <span className="font-semibold">Reason: </span>
                {request.rejectionComment}
              </p>
            )}
            {request.rejectedAt && (
              <p className="text-xs text-gray-500 mt-1">
                Rejected at: {new Date(request.rejectedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {request.problemDescription && (
        <div className="mb-4">
          <label className="font-medium text-gray-700 block mb-2">Problem Description:</label>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-800">
            <p>{request.problemDescription}</p>
          </div>
        </div>
      )}

      {request.actionTakenComment && (
        <div className="mb-6">
          <label className="font-medium text-gray-700 block mb-2">Action Taken:</label>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-gray-800">
            <p>{request.actionTakenComment}</p>
          </div>
        </div>
      )}

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-200">
        {canHod1Approve && (
          <button
            onClick={() => setShowHod1Modal(true)}
            disabled={updating}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {updating ? 'Processing...' : 'HOD1 Approve'}
          </button>
        )}

        {canHod2Approve && (
          <button
            onClick={() => setShowHod2Modal(true)}
            disabled={updating}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {updating ? 'Processing...' : 'HOD2 Approve & Assign'}
          </button>
        )}

        {canRejectRequest && (
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={updating}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {updating ? 'Processing...' : 'Reject'}
          </button>
        )}

        {canEngineerActOnRequest && (
          <>
            <button
              onClick={() => setShowCloseModal(true)}
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

      {/* HOD1 Modal */}
      {showHod1Modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-1">HOD1 Approval</h2>
            <p className="mb-4 text-sm text-gray-600">
              Requester Department: {requesterDeptLabel}
            </p>
            <form onSubmit={handleHod1Approve}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approval Comment:
                </label>
                <textarea
                  value={hod1Comment}
                  onChange={(e) => setHod1Comment(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Your approval remark..."
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowHod1Modal(false);
                    setHod1Comment('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updating ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HOD2 Modal */}
      {showHod2Modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-1">HOD2 Approval & Assign</h2>
            <p className="mb-4 text-sm text-gray-600">
              Target Department: {targetDeptLabel}
            </p>
            <form onSubmit={handleHod2Approve}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Engineer / Subadmin:
                </label>

                {/* ✅ UPDATED: role + dept filter ID based */}
                <select
                  value={hod2AssignStaffId}
                  onChange={(e) => setHod2AssignStaffId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select staff...</option>
                  {allStaff
                    .filter((s) => {
                      const role = (s.role || '').toLowerCase();
                      const roleOk =
                        role === 'engineer' ||
                        role === 'engineers' ||
                        role === 'subadmin';

                      const staffDeptIds = getStaffDepartmentIds(s);
                      const deptOk =
                        targetDeptId != null ? staffDeptIds.includes(targetDeptId) : true;

                      return roleOk && deptOk;
                    })
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {getFullName(s)} ({s.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approval Comment:
                </label>
                <textarea
                  value={hod2Comment}
                  onChange={(e) => setHod2Comment(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Your approval remark..."
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowHod2Modal(false);
                    setHod2Comment('');
                    setHod2AssignStaffId('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating || !hod2AssignStaffId}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {updating ? 'Processing...' : 'Approve & Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && canEngineerActOnRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Forward Request</h2>
            <form onSubmit={handleForward}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forward to Staff:
                </label>

                {/* ✅ UPDATED: role + dept filter ID based */}
                <select
                  value={forwardStaffId}
                  onChange={(e) => setForwardStaffId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                >
                  <option value="">Choose staff...</option>
                  {allStaff
                    .filter((s) => {
                      const notSelf = currentUserId ? s.id !== currentUserId : true;

                      const role = (s.role || '').toLowerCase();
                      const roleOk =
                        role === 'engineer' ||
                        role === 'engineers' ||
                        role === 'subadmin';

                      const staffDeptIds = getStaffDepartmentIds(s);
                      const deptOk =
                        targetDeptId != null ? staffDeptIds.includes(targetDeptId) : true;

                      return notSelf && roleOk && deptOk;
                    })
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {getFullName(s)} ({s.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forward Description:
                </label>
                <textarea
                  value={forwardDesc}
                  onChange={(e) => setForwardDesc(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Reason for forwarding..."
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
                  {updating ? 'Forwarding...' : 'Forward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {showCloseModal && canEngineerActOnRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Resolve & Close Request</h2>
            <form onSubmit={handleClose}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Problem Description:
                </label>
                <textarea
                  value={problemDesc}
                  onChange={(e) => setProblemDesc(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What was the problem exactly?"
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
                  placeholder="What actions were taken to resolve?"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCloseModal(false);
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
                  {updating ? 'Closing...' : 'Resolve & Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && canRejectRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Reject Request</h2>
            <form onSubmit={handleReject}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Comment / Reason:
                </label>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Why are you rejecting this request?"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectComment('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {updating ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg p-4 md:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Request Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
            <div className="border border-gray-200 rounded-md p-4">
              {renderPrintableContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

RequestDetails.propTypes = {
  request: PropTypes.shape({
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
    attachments: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    staffId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    assignStaffId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    assignedAt: PropTypes.string,
    assignedById: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    closedById: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hod1Approval: PropTypes.bool,
    hod1Comment: PropTypes.string,
    hod1ApprovedAt: PropTypes.string,
    hod1ApprovedById: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hod2Approval: PropTypes.bool,
    hod2Comment: PropTypes.string,
    hod2ApprovedAt: PropTypes.string,
    hod2ApprovedById: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    forwardToStaffId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    forwardComment: PropTypes.string,
    forwardAt: PropTypes.string,
    problemDescription: PropTypes.string,
    actionTakenComment: PropTypes.string,
    resolvedAt: PropTypes.string,

    rejectedById: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    rejectedByLevel: PropTypes.string,
    rejectionComment: PropTypes.string,
    rejectedAt: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
};

export default RequestDetails;
