import React from 'react';
import Select from 'react-select';
import FormInput from '../components/FormInput';
import Searchbar from '../components/Searchbar';
import api, { BASE_URL } from '../lib/api';
import { useAuth } from '../context/authContext/AuthContext';
import PDFimg from '../assets/pdfimg.jpg';

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'subadmin', label: 'Subadmin' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'user', label: 'User' },
];

const buildAttachmentUrl = (fileUrl) => {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return `${BASE_URL}${fileUrl}`;
};

const isPdfFile = (candidate) => {
  if (!candidate) return true;
  const fileName = String(candidate.name || '').toLowerCase();
  const fileType = String(candidate.type || '').toLowerCase();
  return fileType === 'application/pdf' || fileName.endsWith('.pdf');
};

export default function PoliciesV2() {
  const { user, canManagePolicies } = useAuth();
  const [isFormVisible, setIsFormVisible] = React.useState(false);
  const [policyName, setPolicyName] = React.useState('');
  const [selectedRoles, setSelectedRoles] = React.useState([]);
  const [file, setFile] = React.useState(null);
  const [editingPolicyId, setEditingPolicyId] = React.useState(null);
  const [policies, setPolicies] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const canManage =
    user?.role === 'superadmin' ||
    canManagePolicies ||
    user?.canManagePolicies;

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/api/policies/');
      setPolicies(res.data?.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPolicies();
  }, []);

  const resetForm = () => {
    setPolicyName('');
    setSelectedRoles([]);
    setFile(null);
    setEditingPolicyId(null);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;
    if (selectedFile && !isPdfFile(selectedFile)) {
      alert('Only PDF files are allowed for policies.');
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const fetchPolicyById = async (policyId) => {
    const res = await api.get(`/api/policies/${policyId}`);
    return res.data?.data || res.data || null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!policyName.trim()) {
      alert('Please enter policy name');
      return;
    }
    if (!selectedRoles.length) {
      alert('Please select at least one role');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const formData = new FormData();
      formData.append('policyName', policyName.trim());
      formData.append('assignRole', JSON.stringify(selectedRoles.map((role) => role.value)));
      if (file) formData.append('attachment', file);

      if (editingPolicyId) {
        const res = await api.put(`/api/policies/updatepolicy/${editingPolicyId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const updated = res.data?.data;
        setPolicies((prev) => prev.map((policy) => (policy.id === updated.id ? updated : policy)));
      } else {
        const res = await api.post('/api/policies/createpolicy', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const created = res.data?.data;
        setPolicies((prev) => [created, ...prev]);
      }

      resetForm();
      setIsFormVisible(false);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
        (editingPolicyId ? 'Failed to update policy' : 'Failed to create policy')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (policy) => {
    if (!canManage) return;

    setIsFormVisible(true);
    setEditingPolicyId(policy.id);
    setPolicyName(policy.policyName || '');
    setSelectedRoles(
      Array.isArray(policy.assignRole)
        ? policy.assignRole.map(
            (role) => roleOptions.find((opt) => opt.value === role) || { value: role, label: role }
          )
        : []
    );
    setFile(null);
  };

  const handleDelete = async (id) => {
    if (!canManage) return;
    if (!window.confirm('Are you sure you want to delete this policy?')) return;

    try {
      await api.delete(`/api/policies/deletepolicy/${id}`);
      setPolicies((prev) => prev.filter((policy) => policy.id !== id));

      if (editingPolicyId === id) {
        resetForm();
        setIsFormVisible(false);
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to delete policy');
    }
  };

  const handlePreview = async (policyId) => {
    try {
      const policy = await fetchPolicyById(policyId);
      const fileUrl = buildAttachmentUrl(policy?.attachment);
      if (!fileUrl) {
        alert('No attachment available for this policy');
        return;
      }
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'You are not allowed to open this policy');
    }
  };

  const handleDownload = async (policyId, name) => {
    try {
      const policy = await fetchPolicyById(policyId);
      const fileUrl = buildAttachmentUrl(policy?.attachment);
      if (!fileUrl) {
        alert('No attachment available for this policy');
        return;
      }

      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = name || 'policy';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'You are not allowed to download this policy');
    }
  };

  return (
    <>
      <h1 className="text-xl font-bold mb-4">Policies</h1>

      <div className="flex justify-between items-center mb-4">
        <Searchbar />

        {canManage && (
          <button
            onClick={() => {
              if (isFormVisible) resetForm();
              setIsFormVisible(!isFormVisible);
            }}
            className="ml-4 px-4 py-2 text-sm font-bold bg-brand-secondary text-white rounded hover:bg-brand-secondary-200 transition-colors"
          >
            {isFormVisible ? 'Close Form' : 'Add Policies'}
          </button>
        )}
      </div>

      {isFormVisible && canManage && (
        <div className="mb-4 p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            {editingPolicyId ? 'Edit Policy' : 'Create New Policy'}
          </h2>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleSubmit}>
            <FormInput
              label="Policy Name"
              name="policyName"
              type="text"
              required
              className="w-full"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
            />

            <div className="flex flex-col">
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Role</label>
              <Select
                options={roleOptions}
                value={selectedRoles}
                onChange={(options) => setSelectedRoles(options || [])}
                placeholder="Select Role"
                className="w-full text-sm"
                isMulti
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="policyFile" className="block text-sm font-bold text-gray-700">
                Policy Document{' '}
                {editingPolicyId && (
                  <span className="text-xs text-gray-500">(optional in edit)</span>
                )}
              </label>
              <input
                id="policyFile"
                name="policyFile"
                type="file"
                accept="application/pdf,.pdf"
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-400 file:border-0 file:bg-transparent file:text-gray-600 file:text-sm file:font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={handleFileChange}
              />
            </div>

            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-bold bg-brand-secondary text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting
                  ? editingPolicyId
                    ? 'Updating...'
                    : 'Saving...'
                  : editingPolicyId
                    ? 'Update Policy'
                    : 'Create Policy'}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-600 font-medium">{error}</p>}

      {loading ? (
        <p>Loading policies...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map((policy) => (
            <PolicyCard
              key={policy.id}
              name={policy.policyName}
              fileUrl={policy.attachment}
              onPreview={() => handlePreview(policy.id)}
              onDownload={() => handleDownload(policy.id, policy.policyName)}
              onDelete={() => handleDelete(policy.id)}
              onEdit={() => handleEdit(policy)}
              canManage={canManage}
            />
          ))}
          {!policies.length && (
            <p className="text-sm text-gray-500 col-span-full">No policies found.</p>
          )}
        </div>
      )}
    </>
  );
}

function PolicyCard({ name, fileUrl, onPreview, onDownload, onDelete, onEdit, canManage }) {
  return (
    <div className="group relative flex flex-col p-4 rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-slate-50 shadow-sm hover:shadow-md hover:border-brand-secondary/40 transition-all duration-200">
      <span className="absolute inset-y-3 left-0 w-1 rounded-full bg-brand-secondary/60 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-600 text-xs font-bold">
            <img src={PDFimg} alt="" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{name}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 font-medium">
              Policy Document
            </p>
          </div>
        </div>

        {fileUrl && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Attachment
          </span>
        )}
      </div>

      <div className="my-2 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            disabled={!fileUrl}
            className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-brand-secondary/90 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span>Preview</span>
          </button>
          <button
            onClick={onDownload}
            disabled={!fileUrl}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span>Download</span>
          </button>
        </div>

        {canManage && (
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <button
              onClick={onEdit}
              className="px-2 py-1 rounded-full text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="px-2 py-1 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
