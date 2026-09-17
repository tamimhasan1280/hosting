import React, { useState } from 'react';
import { api } from '../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Phone, Mail, ArrowRight } from 'lucide-react';

/**
 * Modernized Authentication Interface: Login & Registration
 * Implements the exact registration fields specified in the Master Prompt:
 * First Name, Last Name, Phone Number, Email Address, Password, Confirm Password
 * Styled in the user-selected dark purple to emerald atmospheric theme.
 */
export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Registration State (Master Prompt Fields)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Common UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both email/username and password.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.login(username.trim(), password);
      if (res.success && res.token) {
        if (rememberMe) {
          localStorage.setItem('cpanel_session_token', res.token);
          localStorage.setItem('cpanel_active_user', res.user);
          localStorage.setItem('cpanel_user_email', res.email || '');
          localStorage.setItem('cpanel_user_role', res.role || 'client');
        } else {
          sessionStorage.setItem('cpanel_session_token', res.token);
          sessionStorage.setItem('cpanel_active_user', res.user);
          sessionStorage.setItem('cpanel_user_email', res.email || '');
          sessionStorage.setItem('cpanel_user_role', res.role || 'client');
        }
        if (onLoginSuccess) {
          onLoginSuccess(res);
        }
      } else {
        setError(res.message || 'Invalid credentials. Please check and try again.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    // 1. Required field validation
    if (!trimmedFirstName) {
      setError('First Name is required.');
      return;
    }
    if (!trimmedLastName) {
      setError('Last Name is required.');
      return;
    }
    if (!trimmedPhone) {
      setError('Phone Number is required.');
      return;
    }
    if (!trimmedEmail) {
      setError('Email Address is required.');
      return;
    }
    if (!regPassword) {
      setError('Password is required.');
      return;
    }
    if (!confirmPassword) {
      setError('Confirm Password is required.');
      return;
    }

    // 2. Email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    // 3. Phone validation (Bangladeshi & International formats, 8-16 digits)
    const phoneDigits = trimmedPhone.replace(/[^\d+]/g, '');
    const phoneRegex = /^(\+?[0-9]{8,16})$/;
    if (!phoneRegex.test(phoneDigits)) {
      setError('Please enter a valid phone number (8 to 16 digits, e.g. 01700000000 or +8801700000000).');
      return;
    }

    // 4. Password validation (Min 8 characters, uppercase, lowercase, and number or special character)
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    const hasUpper = /[A-Z]/.test(regPassword);
    const hasLower = /[a-z]/.test(regPassword);
    const hasDigitOrSpecial = /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(regPassword);
    if (!hasUpper || !hasLower || !hasDigitOrSpecial) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and at least one number or special character.');
      return;
    }

    // 5. Confirm password matching
    if (regPassword !== confirmPassword) {
      setError('Password and Confirm Password do not match. Please verify.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.register({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: phoneDigits,
        email: trimmedEmail,
        password: regPassword,
        confirmPassword: confirmPassword
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Account created successfully! You can now log in.');
        setUsername(trimmedEmail);
        setPassword(regPassword);
        // Switch to login tab and auto-fill credentials
        setMode('login');
        setFirstName('');
        setLastName('');
        setPhone('');
        setEmail('');
        setRegPassword('');
        setConfirmPassword('');
      } else {
        setError(res.message || 'Registration failed. Please check your details.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#130424] via-[#240938] to-[#0d2218] flex flex-col justify-between font-sans text-slate-100 select-none p-4">
      {/* Top Brand Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-emerald-400 w-full fixed top-0 left-0 z-50" />

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center py-10">
        <div className="w-full max-w-[440px] bg-[#1c0830]/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-purple-800/40 overflow-hidden">
          
          {/* Header & Brand Logo */}
          <div className="pt-8 pb-5 px-8 text-center bg-gradient-to-b from-purple-950/40 to-transparent">
            <div className="inline-flex items-center justify-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-emerald-500 p-0.5 shadow-lg">
                <div className="w-full h-full bg-[#180529] rounded-[9px] flex items-center justify-center font-black text-[16px] text-white">
                  cP
                </div>
              </div>
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-purple-200 via-pink-200 to-emerald-300 bg-clip-text text-transparent">
                TAMIM HOSTING
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                v136
              </span>
            </div>
            <p className="text-[11.5px] text-purple-300/70">
              cPanel Web Hosting Management Platform
            </p>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-center mt-5 p-1 bg-purple-950/60 rounded-xl border border-purple-800/40">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-purple-600 to-emerald-600 text-white shadow-md'
                    : 'text-purple-300/70 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-purple-600 to-emerald-600 text-white shadow-md'
                    : 'text-purple-300/70 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Success Notification */}
          {successMsg && (
            <div className="mx-8 mb-4 p-3 bg-emerald-950/60 border border-emerald-700/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Notification */}
          {error && (
            <div className="mx-8 mb-4 p-3 bg-rose-950/60 border border-rose-700/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="px-8 pb-8 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-purple-200 mb-1.5 text-[11.5px]">
                  Email Address or Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="name@example.com or username"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#250c3d]/70 border border-purple-800/40 rounded-xl text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition"
                  />
                  <User className="w-4 h-4 text-purple-400/60 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1.5 text-[11.5px]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#250c3d]/70 border border-purple-800/40 rounded-xl text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition"
                  />
                  <Lock className="w-4 h-4 text-purple-400/60 absolute left-3 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-purple-400/60 hover:text-purple-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-[11.5px] text-purple-300/80">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-purple-950 border-purple-800 text-purple-600 focus:ring-0"
                  />
                  <span>Remember Session</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 text-[12.5px] mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign In to Account'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                  className="text-[11.5px] text-purple-300/70 hover:text-emerald-300 hover:underline cursor-pointer"
                >
                  Don't have an account? <span className="font-bold text-white">Create Account</span>
                </button>
              </div>
            </form>
          )}

          {/* REGISTRATION FORM (Master Prompt Fields) */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="px-8 pb-8 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-purple-200 mb-1 text-[11px]">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Tamim"
                    className="w-full px-3 py-2 bg-[#250c3d]/70 border border-purple-800/40 rounded-xl text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-purple-200 mb-1 text-[11px]">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Hasan"
                    className="w-full px-3 py-2 bg-[#250c3d]/70 border border-purple-800/40 rounded-xl text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1 text-[11px]">
                  Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1700-000000"
                    className="w-full pl-9 pr-3 py-2 bg-[#250c3d]/70 border border-purple-800/40 rounded-xl text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400"
                  />
                  <Phone className="w-3.5 h-3.5 text-purple-400/60 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1 text-[11px]">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-[#250c3d]/70 border border-purple-800/40 rounded-xl text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400"
                  />
                  <Mail className="w-3.5 h-3.5 text-purple-400/60 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1 text-[11px]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 upper, 1 lower, 1 number/symbol"
                    className="w-full pl-9 pr-10 py-2 bg-[#250c3d]/70 border border-purple-800/40 rounded-xl text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400"
                  />
                  <Lock className="w-3.5 h-3.5 text-purple-400/60 absolute left-3 top-2.5 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-2.5 text-purple-400/60 hover:text-purple-200 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1 text-[11px]">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-9 pr-3 py-2 bg-[#250c3d]/70 border border-purple-800/40 rounded-xl text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400"
                  />
                  <Lock className="w-3.5 h-3.5 text-purple-400/60 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 text-[12.5px] mt-3"
              >
                {loading ? 'Creating Account...' : 'Create Account / Register'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                  className="text-[11.5px] text-purple-300/70 hover:text-emerald-300 hover:underline cursor-pointer"
                >
                  Already have an account? <span className="font-bold text-white">Sign In</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* Footer Branding */}
      <div className="text-center text-[11px] text-purple-300/50 py-2">
        <span>© 2026 TAMIM HOSTING • All Rights Reserved</span>
      </div>
    </div>
  );
}
