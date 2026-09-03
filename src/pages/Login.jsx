// src/pages/Login.jsx
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContext/AuthContext';
import api from '../lib/api';
import bgImage from '../assets/helpdesk-bg.png';
import HelpdeskLogin from '../assets/Helpdesk login.png';
import logo from '../assets/MET-logo.png';

const seconds = (n) => n;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const Login = () => {
  // ----- login state -----
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  // ----- initial password modal state -----
  const [showInitial, setShowInitial] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPassInit, setNewPassInit] = useState('');
  const [confirmPassInit, setConfirmPassInit] = useState('');
  const [initBusy, setInitBusy] = useState(false);
  const [initErr, setInitErr] = useState('');
  const [initInfo, setInitInfo] = useState('');

  // ----- forgot/reset modal state -----
  const [forgotOpen, setForgotOpen] = useState(false);
  const [step, setStep] = useState(1); // 1=enter email, 2=enter otp, 3=enter new pass
  const [fpEmail, setFpEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [fpErr, setFpErr] = useState('');

  // resend timer (optional)
  const RESEND_COOLDOWN = seconds(30);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!forgotOpen || cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [forgotOpen, cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password.');
      return;
    }

    const res = await login({ email: email.trim(), password: password.trim() });

    if (res.ok) {
      navigate(from, { replace: true });
    } else {
      const msg = res.message || 'Login failed. Check your credentials.';
      const needsInitialPassword =
        res.code === 'INITIAL_PASSWORD_REQUIRED' ||
        /initial password|first[-\s]?time password/i.test(msg);
      if (needsInitialPassword) {
        setShowInitial(true);
        setCurrentPass(password.trim()); // Prefill with the temporary password they entered
        setInitErr('');
        setNewPassInit('');
        setConfirmPassInit('');
        setInitInfo('');
        setError(''); // Clear login error
      } else {
        setError(msg);
      }
    }
  };

  const closeInitial = () => {
    setShowInitial(false);
    setCurrentPass('');
    setNewPassInit('');
    setConfirmPassInit('');
    setInitErr('');
    setInitInfo('');
  };

  // --- Set Initial Password ---
  // ✅ CHANGE: After setting initial password, DO NOT auto-login.
  // ✅ Instead: show success, close modal, clear temp password, stay/redirect to login page.
  const setInitialPassword = async () => {
    setInitErr('');
    setInitInfo('');

    if (!currentPass.trim() || !newPassInit.trim() || !confirmPassInit.trim()) {
      setInitErr('Please fill all fields.');
      return;
    }
    if (newPassInit !== confirmPassInit) {
      setInitErr('Passwords do not match.');
      return;
    }
    if (newPassInit.length < 6) {
      setInitErr('New password must be at least 6 characters.');
      return;
    }

    try {
      setInitBusy(true);

      await api.post('/api/auth/set-initial-password', {
        email: email.trim(),
        currentPassword: currentPass.trim(),
        newPassword: newPassInit,
      });

      setInitInfo('Initial password set successfully. Please login with your new password.');

      setTimeout(() => {
        closeInitial();
        setPassword(''); // clear old temp password
        setError('');
        // Optionally keep email filled so user can quickly login
        setEmail((prev) => prev?.trim() || email.trim());

        // If your app's login route is /login, this will ensure redirect:
        navigate('/login', { replace: true });
      }, 800);
    } catch (e) {
      console.error('Set initial password error:', e);
      setInitErr(e?.response?.data?.message || 'Failed to set initial password.');
    } finally {
      setInitBusy(false);
    }
  };

  const openForgot = () => {
    setForgotOpen(true);
    setStep(1);
    setFpErr('');
    setInfo('');
    setCooldown(0);
    setOtp('');
    setNewPass('');
    setConfirmPass('');
    // prefill from login email box
    setFpEmail((e) => e || email);
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setStep(1);
    setFpEmail('');
    setOtp('');
    setNewPass('');
    setConfirmPass('');
    setInfo('');
    setFpErr('');
    setCooldown(0);
  };

  // --- Step 1: send OTP ---
  const sendOtp = async () => {
    setFpErr('');
    setInfo('');
    if (!fpEmail.trim()) {
      setFpErr('Please enter your email.');
      return;
    }
    try {
      setBusy(true);
      await api.post('/api/auth/forgot-password', { email: fpEmail.trim() });
      setInfo('If the email exists, an OTP has been sent.');
      setStep(2);
      setCooldown(RESEND_COOLDOWN);
    } catch (e) {
      setFpErr(e?.response?.data?.message || 'Failed to start reset.');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (cooldown > 0) return;
    await sendOtp();
  };

  // --- Step 2: verify OTP (optional step for UX confirmation) ---
  const verifyOtp = async () => {
    setFpErr('');
    setInfo('');
    if (!fpEmail.trim() || !otp.trim()) {
      setFpErr('Please enter email and OTP.');
      return;
    }
    try {
      setBusy(true);
      await api.post('/api/auth/verify-otp', { email: fpEmail.trim(), otp: otp.trim() });
      setInfo('OTP verified. Please set a new password.');
      setStep(3);
    } catch (e) {
      setFpErr(e?.response?.data?.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  // --- Step 3: reset password (OTP + new password) ---
  const resetPassword = async () => {
    setFpErr('');
    setInfo('');
    if (!fpEmail.trim() || !otp.trim() || !newPass.trim() || !confirmPass.trim()) {
      setFpErr('Please fill all fields.');
      return;
    }
    if (newPass !== confirmPass) {
      setFpErr('Passwords do not match.');
      return;
    }
    if (newPass.length < 6) {
      setFpErr('New password must be at least 6 characters.');
      return;
    }
    try {
      setBusy(true);
      await api.post('/api/auth/reset-password', {
        email: fpEmail.trim(),
        otp: otp.trim(),
        newPassword: newPass,
      });
      setInfo('Password reset successful. You can now sign in.');
      // auto-fill login form with email
      setEmail(fpEmail.trim());
      // close modal after a short delay
      setTimeout(() => closeForgot(), 1200);
    } catch (e) {
      setFpErr(e?.response?.data?.message || 'Reset failed.');
    } finally {
      setBusy(false);
    }
  };

  const canResend = useMemo(() => cooldown <= 0, [cooldown]);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      {/* Background & overlay */}
      <div className="absolute inset-0">
        <img src={bgImage} alt="App background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Card */}
      <div className="relative z-10 flex flex-col md:flex-row w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Left panel */}
        <div className="hidden md:flex md:w-1/2 bg-indigo-50 items-center justify-center p-6">
          <img src={HelpdeskLogin} alt="Helpdesk illustration" className="max-w-full h-auto" />
        </div>

        {/* Right panel */}
        <div className="w-full md:w-1/2 p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center">
          <div className="mb-4 sm:mb-6">
            <img src={logo} alt="MET Logo" className="h-8 sm:h-12 mx-auto" />
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="you@example.com"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      className="bi bi-eye-slash"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z" />
                      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829" />
                      <path d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      className="bi bi-eye"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
                      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-sm text-indigo-600 hover:text-indigo-800"
                onClick={openForgot}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      {/* Initial Password Modal */}
      {showInitial && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Set Your Initial Password</h3>
              <button onClick={closeInitial} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border rounded-md bg-gray-100"
                value={email}
                readOnly
              />

              <label className="block text-sm font-medium text-gray-700">
                Current (Temporary) Password
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Enter temporary password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                autoFocus
              />

              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="New password (min 6 chars)"
                value={newPassInit}
                onChange={(e) => setNewPassInit(e.target.value)}
              />

              <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Confirm new password"
                value={confirmPassInit}
                onChange={(e) => setConfirmPassInit(e.target.value)}
              />

              {initErr && <div className="text-sm text-red-600">{initErr}</div>}
              {initInfo && <div className="text-sm text-green-700">{initInfo}</div>}

              <button
                onClick={setInitialPassword}
                disabled={initBusy || loading}
                className="w-full py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {initBusy ? 'Setting…' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot/Reset Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {step === 1 && 'Forgot Password'}
                {step === 2 && 'Enter OTP'}
                {step === 3 && 'Set New Password'}
              </h3>
              <button onClick={closeForgot} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            {/* step content */}
            {step === 1 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="you@example.com"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  autoFocus
                />
                {fpErr && <div className="text-sm text-red-600">{fpErr}</div>}
                {info && <div className="text-sm text-green-700">{info}</div>}
                <button
                  onClick={sendOtp}
                  disabled={busy}
                  className="w-full py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {busy ? 'Sending…' : 'Send OTP'}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">OTP</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md tracking-widest"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\s/g, ''))}
                  autoFocus
                />
                <div className="flex items-center justify-between text-sm">
                  <button
                    onClick={resendOtp}
                    disabled={!canResend || busy}
                    className={`underline ${
                      canResend ? 'text-indigo-600 hover:text-indigo-800' : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Resend OTP {canResend ? '' : `(${clamp(cooldown, 0, 999)}s)`}
                  </button>
                  <button onClick={() => setStep(1)} className="text-gray-600 hover:text-gray-800">
                    Change email
                  </button>
                </div>
                {fpErr && <div className="text-sm text-red-600">{fpErr}</div>}
                {info && <div className="text-sm text-green-700">{info}</div>}
                <button
                  onClick={verifyOtp}
                  disabled={busy}
                  className="w-full py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {busy ? 'Verifying…' : 'Verify OTP'}
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="New password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  autoFocus
                />
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Confirm password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                />
                {fpErr && <div className="text-sm text-red-600">{fpErr}</div>}
                {info && <div className="text-sm text-green-700">{info}</div>}
                <button
                  onClick={resetPassword}
                  disabled={busy}
                  className="w-full py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Reset Password'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
