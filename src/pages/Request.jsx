import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import Swal from "sweetalert2";
import api from "../lib/api";
import Table from "../components/Table";
import Searchbar from "../components/Searchbar";
import Select from "react-select";
import FormInput from "../components/FormInput";
import RequestDetails from "../pages/RequestDetails";
import { useAuth } from "../context/authContext/AuthContext";
import JoditEditor from "jodit-react";

const Request = () => {
  // ✅ active dept from AuthContext
  const { user, activeDepartmentId } = useAuth();

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [filters, setFilters] = useState({
    department: "",
    status: "",
    requestType: "",
  });
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [department, setDepartment] = useState([]); // all departments (for target dept selection/filter)
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const editor = useRef(null);
  const [content, setContent] = useState("");

  const [requests, setRequests] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [attachmentFiles, setAttachmentFiles] = useState([]);

  // 'all' | 'myrequests' | 'incoming' | 'departmentRequests'
  const [requestView, setRequestView] = useState(() => {
    const role = String(user?.role || "").toLowerCase();
    if (role === "superadmin") return "all";
    if (role === "user") return "myrequests";
    if (["admin", "subadmin", "engineer"].includes(role)) return "myrequests";
    return "all";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ========================= ACTIVE DEPT UI ========================= */

  const canUseActiveDept = useMemo(() => {
    const r = String(user?.role || "").toLowerCase();
    return ["admin", "subadmin", "engineer"].includes(r);
  }, [user]);

  /* ========================= FETCH REQUESTS ========================= */

  const fetchRequests = useCallback(async (view = "all") => {
    try {
      let url = "/api/requests";

      if (view === "myrequests") {
        url = "/api/requests/my-requests";
      } else if (view === "incoming") {
        url = "/api/requests/incoming"; // ✅ activeDepartment middleware expects header
      } else if (view === "departmentRequests") {
        url = "/api/requests/department-requests"; // ✅ activeDepartment middleware expects header
      }

      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : res.data.data || [];
      setRequests(data || []);
      return data || [];
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to load requests";
      console.error(msg);
      setRequests([]);
      return [];
    }
  }, []);

  // Initial / view change fetch
  useEffect(() => {
    fetchRequests(requestView);
  }, [requestView, fetchRequests]);

  // ✅ If active department changes -> refetch incoming/department requests
  useEffect(() => {
    if (!activeDepartmentId) return;

    if (requestView === "incoming" || requestView === "departmentRequests") {
      fetchRequests(requestView);
    }
  }, [activeDepartmentId, requestView, fetchRequests]);

  const activeDeptType = useMemo(() => {
    if (!activeDepartmentId || !Array.isArray(department)) return null;

    const dept = department.find(
      (d) => String(d.id) === String(activeDepartmentId)
    );

    return String(dept?.type || "").toLowerCase(); // service | regular | null
  }, [activeDepartmentId, department]);

  useEffect(() => {
    const role = String(user?.role || "").toLowerCase();
    if (!["admin", "subadmin", "engineer"].includes(role)) return;
    if (!activeDeptType) return;

    // sirf agar abhi bhi default myrequests pe hai tab switch karo
    if (requestView === "myrequests") {
      if (activeDeptType === "service") setRequestView("incoming");
      else if (activeDeptType === "regular") setRequestView("departmentRequests");
    }
  }, [activeDeptType]); // eslint-disable-line

  const requestViewOptions = useMemo(() => {
    const role = user?.role;

    if (role === "superadmin") {
      return [{ value: "all", label: "All Requests" }];
    }

    if (role === "user") {
      return [{ value: "myrequests", label: "My Requests" }];
    }

    if (["admin", "subadmin", "engineer"].includes(role)) {
      const opts = [];

      // ✅ Incoming → ONLY service
      if (activeDeptType === "service") {
        opts.push({ value: "incoming", label: "Incoming" });
      }

      // ✅ Department Requests → service + regular
      if (activeDeptType === "service" || activeDeptType === "regular") {
        opts.push({ value: "departmentRequests", label: "Department Requests" });
      }

      opts.push({ value: "myrequests", label: "My Requests" });
      return opts;
    }

    return [];
  }, [user, activeDeptType]);


  // Date formatter
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const renderPriority = (priority) => {
    if (!priority) return "-";

    const base =
      "px-2 py-1 rounded-full text-xs font-semibold inline-block";

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

    const base =
      "px-2 py-1 rounded-full text-xs font-semibold inline-block capitalize";

    const s = status.toLowerCase();

    if (s === "pending") {
      return <span className={`${base} bg-orange-100 text-orange-700`}>Pending</span>;
    }

    if (s === "in-progress" || s === "in progress") {
      return <span className={`${base} bg-blue-100 text-blue-700`}>In Progress</span>;
    }

    if (s === "closed") {
      return <span className={`${base} bg-green-100 text-green-700`}>Closed</span>;
    }

    if (s === "rejected") {
      return <span className={`${base} bg-red-100 text-red-700`}>Rejected</span>;
    }

    // 👇 DepartmentName.HOD Approved type status
    if (s.includes("hod")) {
      return <span className={`${base} bg-purple-100 text-purple-700`}>{status}</span>;
    }

    return <span className={`${base} bg-gray-100 text-gray-700`}>{status}</span>;
  };



  const columns = [
    { key: "ticketId", label: "Ticket ID" },
    { key: "createdAt", label: "Date", format: formatDate },
    { key: "subject", label: "Subject" },
    {
      key: "priority",
      label: "Priority",
      format: renderPriority, // ✅ color added
    },
    {
      key: "status",
      label: "Status",
      format: renderStatus, // ✅ color added
    },
    { key: "location", label: "Location" },
  ];


  /* ========================= LISTS (Departments & Staff) ========================= */

  const fetchLists = async () => {
    try {
      setStaffLoading(true);
      const [deptRes, staffRes] = await Promise.all([
        api.get("/api/departments"),
        api.get("/api/staff/"),
      ]);

      const depts = deptRes?.data
        ? Array.isArray(deptRes.data)
          ? deptRes.data
          : deptRes.data.data || deptRes.data.departments || []
        : [];

      let staff = [];
      if (staffRes?.data) {
        if (Array.isArray(staffRes.data)) staff = staffRes.data;
        else if (Array.isArray(staffRes.data.data)) staff = staffRes.data.data;
        else if (Array.isArray(staffRes.data.staff)) staff = staffRes.data.staff;
      }

      setDepartment(depts);
      setStaffList(staff || []);
    } catch (e) {
      console.error("Failed to load lists", e);
      setStaffList([]);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const departmentNameOptions = useMemo(() => {
    return (department || [])
      .filter((x) => String(x?.type || "").toLowerCase() === "service")
      .map((x) => ({ value: x.id, label: x.department }));
  }, [department]);

  const departmentCategoryOptions = useMemo(() => {
    if (!selectedDepartment) return [];

    const dept = (department || []).find((d) => d.id === selectedDepartment.value);
    const cats = new Set();

    (dept?.category || []).forEach((str) => {
      str.split(",").forEach((c) => {
        const v = c.trim();
        if (v && v.toLowerCase() !== "n/a") cats.add(v);
      });
    });

    return Array.from(cats).map((v) => ({ value: v, label: v }));
  }, [department, selectedDepartment]);

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

  /* ========================= FORM ========================= */

  const [newRequest, setNewRequest] = useState({
    departmentId: "",
    departmentCategory: "",
    priority: "",
    location: "",
    subject: "",
    isRepeated: false,
    behalf: false,
    behalfId: null,
  });

  const handleRowClick = async (row) => {
    try {
      const id = row.id || requests.find((c) => c.ticketId === row.ticketId)?.id;
      if (!id) return;

      const res = await api.get(`/api/requests/${id}`);
      const fullRequest = res.data?.data || res.data;

      setSelectedRequest(fullRequest);
    } catch (err) {
      console.error("Failed to load request details:", err);
    }
  };

  const handleBack = () => setSelectedRequest(null);

  // Filter change
  const handleFilterChange = (selectedOption, { name }) => {
    if (name === "department") {
      setSelectedDepartment(selectedOption || null);
      setFilters((prev) => ({
        ...prev,
        department: selectedOption ? selectedOption.value : "",
      }));
      return;
    }
    setFilters((prev) => ({
      ...prev,
      [name]: selectedOption ? selectedOption.value : "",
    }));
  };

  // ✅ helper: strip html and check actual text
  const isHtmlEmpty = (html) => {
    const text = (html || "")
      .replace(/<[^>]*>/g, " ")   // remove tags
      .replace(/&nbsp;/g, " ")
      .trim();
    return text.length === 0;
  };

  const config = useMemo(
    () => ({
      readonly: false,
      placeholder: "Start typing...",
      height: 260,
      // ✅ avoid heavy base64 insertion (optional)
      uploader: { insertImageAsBase64URI: false },
    }),
    []
  );

  // ✅ Jodit onBlur gives (newContent, editor)
  const handleBlur = useCallback((newContent) => {
    setContent(newContent || "");
  }, []);

  // ✅ OPTIONAL: do nothing on change to prevent lag
  const handleChange = useCallback(() => { }, []);


  const clearFilters = () => {
    setFilters({ department: "", status: "", requestType: "" });
    setSelectedDepartment(null);
  };

  const handleSearchChange = (e) => setSearchTerm(e.target.value);

  const handleRequestViewChange = (selectedOption) => {
    const value = selectedOption?.value;
    if (!value) return;

    const allowed = requestViewOptions.some((opt) => opt.value === value);
    if (!allowed) return;

    // ✅ incoming/departmentRequests ke liye active dept required
    if ((value === "incoming" || value === "departmentRequests") && canUseActiveDept && !activeDepartmentId) {
      Swal.fire("Select Active Department", "Please select an active department first.", "warning");
      return;
    }

    setRequestView(value);
  };

  const handleClearSearch = () => setSearchTerm("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewRequest((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (selectedOption, { name }) => {
    setNewRequest((prev) => ({
      ...prev,
      [name]: selectedOption ? selectedOption.value : "",
    }));
  };

  const handleToggleChange = (field) => {
    if (field === "behalf") {
      setNewRequest((prev) => ({
        ...prev,
        behalf: !prev.behalf,
        behalfId: !prev.behalf ? prev.behalfId : null,
      }));
    } else {
      setNewRequest((prev) => ({ ...prev, [field]: !prev[field] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.id) {
      Swal.fire("Error", "User not authenticated", "error");
      return;
    }

    if (newRequest.behalf && !newRequest.behalfId) {
      Swal.fire("Error", 'Please select a staff member for "On Behalf Of"', "error");
      return;
    }

    if (!newRequest.departmentId || !newRequest.subject || isHtmlEmpty(content)) {
      Swal.fire("Error", "Please fill all required fields", "error");
      return;
    }


    try {
      setIsSubmitting(true);

      Swal.fire({
        title: "Submitting request...",
        text: "Please wait",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const formData = new FormData();
      formData.append("staffId", user.id);
      formData.append("behalf", newRequest.behalf ? "true" : "false");
      if (newRequest.behalf && newRequest.behalfId) {
        formData.append("behalfId", String(newRequest.behalfId));
      }

      formData.append("departmentId", String(newRequest.departmentId));
      if (newRequest.departmentCategory) {
        formData.append("departmentCategory", newRequest.departmentCategory);
      }
      if (newRequest.priority) {
        formData.append("priority", newRequest.priority);
      }

      formData.append("subject", newRequest.subject);
      formData.append("description", content);
      formData.append("location", newRequest.location || "");
      formData.append("isRepeated", newRequest.isRepeated ? "true" : "false");

      if (attachmentFiles && attachmentFiles.length > 0) {
        attachmentFiles.forEach((file) => formData.append("attachments", file));
      }

      await api.post("/api/requests/send-request", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire("Success", "Request created successfully!", "success");
      resetForm();
      fetchRequests(requestView);
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to create request";

      // Backend sometimes saves the request and then throws while building the response.
      if (String(message).toLowerCase().includes("ticketid is not defined")) {
        const myRequests = await fetchRequests("myrequests");
        const recovered = myRequests.some(
          (item) =>
            String(item?.staffId) === String(user?.id) &&
            String(item?.departmentId) === String(newRequest.departmentId) &&
            String(item?.subject || "").trim() === String(newRequest.subject || "").trim()
        );

        if (recovered) {
          setRequestView("myrequests");
          resetForm();
          Swal.fire(
            "Success",
            "Request was created successfully. The server returned an incorrect error response, so your My Requests list has been refreshed.",
            "success"
          );
          return;
        }
      }

      Swal.fire("Error", message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewRequest({
      departmentId: "",
      departmentCategory: "",
      priority: "",
      location: "",
      subject: "",
      isRepeated: false,
      behalf: false,
      behalfId: null,
    });
    setSelectedDepartment(null);
    setContent("");
    setAttachmentFiles([]);
    setIsFormVisible(false);
  };

  /* ========================= FILTERED DATA ========================= */

  const filteredData = requests.filter((item) => {
    const matchesFilters = Object.keys(filters).every((key) => {
      const val = filters[key];
      if (!val) return true;

      if (key === "department") return String(item.departmentId) === String(val);
      if (key === "requestType") return String(item.departmentCategory) === String(val);

      return String(item[key]) === String(val);
    });

    const searchLower = (searchTerm || "").toLowerCase();

    const matchesSearch =
      (item.subject || "").toLowerCase().includes(searchLower) ||
      String(item.ticketId || item.id || "").toLowerCase().includes(searchLower) ||
      (item.employee_name || "").toLowerCase().includes(searchLower);

    return matchesFilters && matchesSearch;
  });

  const priorityOptions = [
    { value: "", label: "Select Priority" },
    { value: "Low", label: "Low" },
    { value: "Medium", label: "Medium" },
    { value: "High", label: "High" },
  ];

  const uniqueStatuses = [
    { value: "", label: "Select Status" },
    ...[...new Set(requests.map((item) => item.status))].map((status) => ({
      value: status,
      label: status,
    })),
  ];

  const selectedStatus = uniqueStatuses.find((opt) => opt.value === filters.status);
  const selectedPriority = priorityOptions.find((opt) => opt.value === newRequest.priority);
  const selectedCategory = departmentCategoryOptions.find((opt) => opt.value === newRequest.departmentCategory);
  const selectedRequestTypeFilter = departmentCategoryOptions.find((opt) => opt.value === filters.requestType);

  return (
    <>
      <h1 className="text-xl font-bold mb-4">Requests</h1>

      {selectedRequest ? (
        <RequestDetails request={selectedRequest} onClose={handleBack} />
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              {/* ✅ Request view dropdown */}
              <div className="flex flex-col">
                {requestViewOptions.length > 1 ? (
                  <Select
                    options={requestViewOptions}
                    value={requestViewOptions.find((opt) => opt.value === requestView) || requestViewOptions[0]}
                    onChange={handleRequestViewChange}
                    placeholder="Filter Requests"
                    className="w-48 inline-block mr-4"
                    isClearable={false}
                  />
                ) : (
                  <span className="text-sm font-semibold">
                    {requestViewOptions[0]?.label || "Requests"}
                  </span>
                )}
              </div>

              <Searchbar value={searchTerm} onChange={handleSearchChange} onClear={handleClearSearch} />

              <button
                onClick={() => setIsFilterVisible(!isFilterVisible)}
                className={`px-4 py-2 text-sm font-bold rounded transition-colors ${isFilterVisible
                  ? "bg-brand-secondary text-white hover:bg-brand-secondary-200"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
              >
                {isFilterVisible ? "Hide Filters" : "Show Filters"}
              </button>

              {isFilterVisible && (
                <div className="flex space-x-4">
                  <div className="flex flex-col">
                    <Select
                      name="department"
                      options={departmentNameOptions}
                      value={selectedDepartment}
                      onChange={handleFilterChange}
                      placeholder="Select Department"
                      isClearable
                    />
                  </div>
                  <div className="flex flex-col">
                    <Select
                      name="requestType"
                      options={departmentCategoryOptions}
                      value={selectedRequestTypeFilter}
                      onChange={handleFilterChange}
                      placeholder="Select Request Type"
                      isDisabled={!selectedDepartment}
                    />
                  </div>
                  <div className="flex flex-col">
                    <Select
                      name="status"
                      options={uniqueStatuses}
                      value={selectedStatus}
                      onChange={handleFilterChange}
                      placeholder="Select Status"
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
            </div>

            {/* superadmin ko Add Request button nahi dikhayenge */}
            {user?.role !== "superadmin" && (
              <button
                onClick={() => setIsFormVisible(!isFormVisible)}
                className="px-4 py-2 text-sm font-bold bg-brand-secondary text-white rounded hover:bg-brand-secondary-200 transition-colors"
              >
                {isFormVisible ? "Close Form" : "Add Request"}
              </button>
            )}
          </div>

          {/* Form */}
          {isFormVisible && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3 md:px-6">
                <div>
                  <h2 className="text-base md:text-lg font-semibold text-gray-800">New Request</h2>
                  <p className="text-xs md:text-sm text-gray-500">
                    Please fill the request details in the following sections.
                  </p>
                </div>

                {newRequest.behalf && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                    On Behalf
                  </span>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 px-4 py-4 md:px-6 md:py-5">
                {/* SECTION 1: Basic Details */}
                <section className="space-y-4 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">
                      1
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Basic Details</h3>
                      <p className="text-xs text-gray-500">
                        Select department and basic information of the request.
                      </p>
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
                        value={selectedDepartment}
                        onChange={(opt) => {
                          setSelectedDepartment(opt);
                          handleSelectChange(opt, { name: "departmentId" });
                        }}
                        placeholder="Select department"
                        classNamePrefix="react-select"
                        isClearable
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="mb-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Request Type
                      </label>
                      <Select
                        name="departmentCategory"
                        options={departmentCategoryOptions}
                        value={selectedCategory}
                        onChange={handleSelectChange}
                        placeholder="Select request type"
                        classNamePrefix="react-select"
                        isDisabled={!selectedDepartment}
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
                        classNamePrefix="react-select"
                      />
                    </div>

                    <div className="flex flex-col">
                      <FormInput
                        label="Location"
                        name="location"
                        value={newRequest.location}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                </section>

                {/* SECTION 2: Options & On Behalf */}
                <section className="space-y-4 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">
                      2
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Options & On Behalf</h3>
                      <p className="text-xs text-gray-500">
                        Configure filing options and select staff if filing on behalf.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
                    <div className="space-y-3 rounded-lg border border-gray-100 bg-white p-3.5 shadow-sm">
                      <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 border border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-800">File on Behalf</p>
                          <p className="text-xs text-gray-500">Create request for another staff member.</p>
                        </div>
                        <label className="relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full bg-gray-300 transition">
                          <input
                            className="peer sr-only"
                            id="behalf"
                            type="checkbox"
                            checked={newRequest.behalf}
                            onChange={() => handleToggleChange("behalf")}
                          />
                          <span className="absolute inset-y-0 left-0 m-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all peer-checked:translate-x-5 peer-checked:bg-brand-secondary" />
                        </label>
                      </div>

                      <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 border border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-800">Repeated Issue</p>
                          <p className="text-xs text-gray-500">Mark if this request has been raised earlier.</p>
                        </div>
                        <label className="relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full bg-gray-300 transition">
                          <input
                            className="peer sr-only"
                            id="isRepeated"
                            type="checkbox"
                            checked={newRequest.isRepeated}
                            onChange={() => handleToggleChange("isRepeated")}
                          />
                          <span className="absolute inset-y-0 left-0 m-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all peer-checked:translate-x-5 peer-checked:bg-brand-secondary" />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {newRequest.behalf && (
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
                              value={staffOptions.find((opt) => opt.value === newRequest.behalfId) || null}
                              onChange={(selected) => {
                                setNewRequest((prev) => ({
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

                          {newRequest.behalfId === user?.id && (
                            <p className="mt-1 text-[11px] text-red-600">You are filing on your own behalf.</p>
                          )}
                        </div>
                      )}

                      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3.5">
                        <label
                          htmlFor="attachment"
                          className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2"
                        >
                          Attachments
                        </label>

                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-200">
                          <span className="truncate">
                            {attachmentFiles?.length
                              ? `${attachmentFiles.length} file(s) selected`
                              : "Click to browse files"}
                          </span>
                          <span className="rounded-full bg-brand-secondary px-3 py-1 text-xs font-semibold text-white">
                            Choose Files
                          </span>
                          <input
                            id="attachment"
                            type="file"
                            name="attachments"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              setAttachmentFiles(files);
                            }}
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

                {/* SECTION 3: Subject */}
                <section className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">
                      3
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Request Subject</h3>
                      <p className="text-xs text-gray-500">Provide a short and clear subject for the request.</p>
                    </div>
                  </div>

                  <FormInput
                    label="Subject"
                    name="subject"
                    value={newRequest.subject}
                    onChange={handleInputChange}
                    required
                  />
                </section>

                {/* SECTION 4: Description */}
                <section className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">
                      4
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Detailed Description</h3>
                      <p className="text-xs text-gray-500">
                        Explain the requirement in detail (e.g. mouse needed, quantity, etc.).
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    <JoditEditor
                      ref={editor}
                      value={content}
                      config={config}
                      onBlur={handleBlur}
                      onChange={handleChange}
                    />

                  </div>
                </section>

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
                      className={`rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors ${isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-brand-secondary hover:bg-brand-secondary-200"
                        }`}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ✅ Table */}
          <Table data={filteredData} columns={columns} onRowClick={handleRowClick} />
        </>
      )}
    </>
  );
};

export default Request;
