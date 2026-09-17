import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Database, User, Shield, ShieldCheck, CheckCircle2, AlertTriangle, 
  ArrowRight, ArrowLeft, RefreshCw, Key, Copy, Check, Eye, EyeOff, 
  Sparkles, ExternalLink, Home, Layers, Code, CheckSquare, Square,
  CheckCircle, Server, Terminal, Lock
} from 'lucide-react';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const PRIVILEGES_LIST = [
  'ALTER', 'ALTER ROUTINE', 'CREATE', 'CREATE ROUTINE',
  'CREATE TEMPORARY TABLES', 'CREATE VIEW', 'DELETE', 'DROP',
  'EVENT', 'EXECUTE', 'INDEX', 'INSERT',
  'LOCK TABLES', 'REFERENCES', 'SELECT', 'SHOW VIEW',
  'TRIGGER', 'UPDATE'
];

function calculatePasswordStrength(pwd) {
  if (!pwd) return { score: 0, label: 'Empty', color: 'bg-slate-700' };
  let score = 0;
  if (pwd.length >= 8) score += 25;
  if (pwd.length >= 12) score += 15;
  if (/[A-Z]/.test(pwd)) score += 15;
  if (/[a-z]/.test(pwd)) score += 15;
  if (/[0-9]/.test(pwd)) score += 15;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 15;

  score = Math.min(100, score);
  if (score < 40) return { score, label: 'Weak', color: 'bg-red-500', text: 'text-red-400' };
  if (score < 70) return { score, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-400' };
  if (score < 90) return { score, label: 'Good', color: 'bg-blue-500', text: 'text-blue-400' };
  return { score, label: 'Very Strong', color: 'bg-emerald-500', text: 'text-emerald-400' };
}

function generateSecurePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function DatabaseWizard({ onNavigate }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [cpanelUser, setCpanelUser] = useState(localStorage.getItem('cpanel_active_user') || 'cpanel_user');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Database
  const [dbNameInput, setDbNameInput] = useState('');
  const [createdDbFullName, setCreatedDbFullName] = useState('');

  // Step 2: User
  const [userInput, setUserInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createdUserFullName, setCreatedUserFullName] = useState('');
  const [savedUserPassword, setSavedUserPassword] = useState('');

  // Password Generator
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(16);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copiedGen, setCopiedGen] = useState(false);

  // Step 4: Privileges
  const [selectedPrivileges, setSelectedPrivileges] = useState(PRIVILEGES_LIST);

  // Step 6: Verification Results
  const [verificationData, setVerificationData] = useState(null);

  // Active Snippet Tab in Step 5
  const [activeSnippetTab, setActiveSnippetTab] = useState('env');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    const active = localStorage.getItem('cpanel_active_user') || 'cpanel_user';
    setCpanelUser(active);
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const getFullDbName = () => {
    const raw = dbNameInput.trim();
    if (!raw) return '';
    return raw.startsWith(cpanelUser + '_') ? raw : (cpanelUser + '_' + raw);
  };

  const getFullUserName = () => {
    const raw = userInput.trim();
    if (!raw) return '';
    return raw.startsWith(cpanelUser + '_') ? raw : (cpanelUser + '_' + raw);
  };

  // Step 1 Handler: Validate & Create DB
  const handleStep1Next = async (e) => {
    e.preventDefault();
    const rawName = dbNameInput.trim();
    if (!rawName) {
      showNotification('Please enter a database name', 'error');
      return;
    }

    setLoading(true);
    try {
      // Validate
      const valRes = await api.validateWizardDb({ name: rawName, user: cpanelUser });
      if (!valRes.valid) {
        showNotification(valRes.message || 'Invalid database name', 'error');
        setLoading(false);
        return;
      }

      // Create
      const createRes = await api.createWizardDb({ name: rawName, user: cpanelUser });
      setCreatedDbFullName(createRes.database.name);
      showNotification('Database ' + createRes.database.name + ' created successfully!', 'success');
      setCurrentStep(2);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to create database';
      if (msg.includes('already exists')) {
        const fullName = getFullDbName();
        setCreatedDbFullName(fullName);
        showNotification('Using existing database ' + fullName, 'info');
        setCurrentStep(2);
      } else {
        showNotification(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Handler: Validate & Create User
  const handleStep2Next = async (e) => {
    e.preventDefault();
    const rawUser = userInput.trim();
    if (!rawUser) {
      showNotification('Please enter a username', 'error');
      return;
    }
    if (!password) {
      showNotification('Please enter a password', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }
    const strength = calculatePasswordStrength(password);
    if (strength.score < 35) {
      showNotification('Password is too weak. Please use numbers, uppercase, and symbols.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Validate
      const valRes = await api.validateWizardUser({ username: rawUser, password, user: cpanelUser });
      if (!valRes.valid) {
        showNotification(valRes.message || 'Invalid user credentials', 'error');
        setLoading(false);
        return;
      }

      // Create
      const createRes = await api.createWizardUser({ username: rawUser, password, user: cpanelUser });
      setCreatedUserFullName(createRes.user.username);
      setSavedUserPassword(password);
      showNotification('User ' + createRes.user.username + ' created successfully!', 'success');
      setCurrentStep(3);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to create user';
      if (msg.includes('already exists')) {
        const fullName = getFullUserName();
        setCreatedUserFullName(fullName);
        setSavedUserPassword(password);
        showNotification('Using existing database user ' + fullName, 'info');
        setCurrentStep(3);
      } else {
        showNotification(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 3 Handler: Add User to Database
  const handleStep3Next = () => {
    if (!createdDbFullName || !createdUserFullName) {
      showNotification('Database and User must be selected', 'error');
      return;
    }
    setCurrentStep(4);
  };

  // Step 4 Handler: Privileges
  const togglePrivilege = (priv) => {
    if (selectedPrivileges.includes(priv)) {
      setSelectedPrivileges(selectedPrivileges.filter(p => p !== priv));
    } else {
      setSelectedPrivileges([...selectedPrivileges, priv]);
    }
  };

  const toggleAllPrivileges = () => {
    if (selectedPrivileges.length === PRIVILEGES_LIST.length) {
      setSelectedPrivileges([]);
    } else {
      setSelectedPrivileges([...PRIVILEGES_LIST]);
    }
  };

  const handleStep4Next = () => {
    if (selectedPrivileges.length === 0) {
      showNotification('Please select at least one privilege', 'error');
      return;
    }
    setCurrentStep(5);
  };

  // Step 5 Handler: Assign Privileges & Verify Setup
  const handleFinalize = async () => {
    setLoading(true);
    try {
      await api.assignWizardUser({
        username: createdUserFullName,
        database: createdDbFullName,
        privileges: selectedPrivileges,
        user: cpanelUser
      });

      const verifyRes = await api.verifyWizardSetup(createdDbFullName, createdUserFullName, cpanelUser);
      setVerificationData(verifyRes);

      showNotification('Database, user, and privileges verified successfully!', 'success');
      setCurrentStep(6);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to finalize database setup';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Password Generator Actions
  const handleOpenGenerator = () => {
    const pwd = generateSecurePassword(genLength);
    setGeneratedPassword(pwd);
    setShowGenerator(true);
  };

  const handleApplyGeneratedPassword = () => {
    setPassword(generatedPassword);
    setConfirmPassword(generatedPassword);
    setShowGenerator(false);
    showNotification('Password generated and applied!', 'info');
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setDbNameInput('');
    setCreatedDbFullName('');
    setUserInput('');
    setPassword('');
    setConfirmPassword('');
    setCreatedUserFullName('');
    setSavedUserPassword('');
    setSelectedPrivileges(PRIVILEGES_LIST);
    setVerificationData(null);
  };

  const passwordStrength = calculatePasswordStrength(password);
  const isAllPrivilegesSelected = selectedPrivileges.length === PRIVILEGES_LIST.length;

  const stepsList = [
    { num: 1, label: 'Create Database' },
    { num: 2, label: 'Create User' },
    { num: 3, label: 'Add User' },
    { num: 4, label: 'Set Privileges' },
    { num: 5, label: 'Review' },
    { num: 6, label: 'Complete' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Database Wizard</h1>
            <p className="text-sm text-slate-400">
              Guided step-by-step assistant for creating databases, users, and setting privileges.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate ? onNavigate('databases') : null}
            className="flex items-center space-x-2 text-slate-300 hover:text-white"
          >
            <Layers className="w-4 h-4 mr-1 text-slate-400" />
            <span>Manage Databases</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate ? onNavigate('phpmyadmin') : null}
            className="flex items-center space-x-2 text-amber-400 hover:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
          >
            <Server className="w-4 h-4 mr-1" />
            <span>phpMyAdmin</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <Alert
          type={notification.type === 'error' ? 'danger' : notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* 6-Step Stepper Bar */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between overflow-x-auto gap-2 py-1 scrollbar-thin">
          {stepsList.map((st, idx) => {
            const isActive = currentStep === st.num;
            const isCompleted = currentStep > st.num;
            return (
              <React.Fragment key={st.num}>
                <div className="flex items-center space-x-2.5 min-w-max">
                  <div
                    className={'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ' + (
                      isActive
                        ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-md shadow-blue-600/30'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-400'
                    )}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : st.num}
                  </div>
                  <div className="flex flex-col">
                    <span className={'text-xs font-semibold ' + (isActive ? 'text-blue-400' : isCompleted ? 'text-slate-300' : 'text-slate-500')}>
                      Step {st.num}
                    </span>
                    <span className={'text-xs ' + (isActive ? 'text-white font-medium' : isCompleted ? 'text-slate-400' : 'text-slate-500')}>
                      {st.label}
                    </span>
                  </div>
                </div>
                {idx < stepsList.length - 1 && (
                  <div className={'flex-1 h-0.5 min-w-[20px] max-w-[40px] hidden md:block rounded ' + (
                    currentStep > st.num ? 'bg-emerald-500/60' : 'bg-slate-700'
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* STEP 1: CREATE DATABASE */}
      {currentStep === 1 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-700/80 pb-4">
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Step 1 of 6
              </span>
              <h2 className="text-xl font-bold text-white">Create A Database</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Enter a name for your new MySQL / MariaDB database. It will automatically be prefixed with your cPanel username for isolation.
            </p>
          </div>

          <form onSubmit={handleStep1Next} className="space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Database Name
              </label>
              <div className="flex rounded-lg shadow-sm">
                <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-slate-600 bg-slate-700/80 text-slate-300 text-sm font-mono select-none">
                  {cpanelUser}_
                </span>
                <input
                  type="text"
                  value={dbNameInput}
                  onChange={(e) => setDbNameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength={64 - (cpanelUser.length + 1)}
                  placeholder="mydb"
                  className="flex-1 block w-full rounded-none rounded-r-lg border border-slate-600 bg-slate-900 text-white px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
                <span>Allowed: lowercase letters, numbers, and underscores.</span>
                <span className="font-mono">
                  Full Name: <strong className="text-blue-400">{getFullDbName() || (cpanelUser + '_')}</strong>
                </span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-4 flex items-start space-x-3 text-xs text-slate-300">
              <Database className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Character Set & Engine</strong>
                Databases are created using <span className="text-indigo-300 font-mono">utf8mb4</span> with collation <span className="text-indigo-300 font-mono">utf8mb4_unicode_ci</span> for full multilingual, emoji, and modern web application compatibility.
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-700/60">
              <Button
                type="submit"
                disabled={loading || !dbNameInput.trim()}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg shadow-lg shadow-blue-600/20 font-medium"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    <span>Creating Database...</span>
                  </>
                ) : (
                  <>
                    <span>Next Step</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: CREATE DATABASE USER */}
      {currentStep === 2 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-700/80 pb-4">
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Step 2 of 6
              </span>
              <h2 className="text-xl font-bold text-white">Create Database Users</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Create a new user account with secure credentials to access <strong className="text-blue-400 font-mono">{createdDbFullName}</strong>.
            </p>
          </div>

          <form onSubmit={handleStep2Next} className="space-y-6 max-w-2xl">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <div className="flex rounded-lg shadow-sm">
                <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-slate-600 bg-slate-700/80 text-slate-300 text-sm font-mono select-none">
                  {cpanelUser}_
                </span>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength={32 - (cpanelUser.length + 1)}
                  placeholder="dbuser"
                  className="flex-1 block w-full rounded-none rounded-r-lg border border-slate-600 bg-slate-900 text-white px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
                <span>Max 32 total characters including prefix.</span>
                <span className="font-mono">
                  Full User: <strong className="text-blue-400">{getFullUserName() || (cpanelUser + '_')}</strong>
                </span>
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleOpenGenerator}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1 font-medium hover:underline"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Password Generator</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter secure password"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 text-white pl-4 pr-10 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Password Strength:</span>
                    <span className={'font-semibold ' + passwordStrength.text}>
                      {passwordStrength.label} ({passwordStrength.score}/100)
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={'h-full transition-all duration-300 ' + passwordStrength.color}
                      style={{ width: passwordStrength.score + '%' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password (Again)
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 text-white px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Password Generator Accordion */}
            {showGenerator && (
              <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-blue-400">
                    <Key className="w-4 h-4" />
                    <span>Password Generator</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGenerator(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedPassword}
                      className="flex-1 bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-sm px-3 py-2 rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPassword);
                        setCopiedGen(true);
                        setTimeout(() => setCopiedGen(false), 2000);
                      }}
                      className="text-slate-300 hover:text-white"
                    >
                      {copiedGen ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setGeneratedPassword(generateSecurePassword(genLength))}
                      className="text-slate-300 hover:text-white"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <span>Length:</span>
                      <input
                        type="range"
                        min="12"
                        max="32"
                        value={genLength}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setGenLength(val);
                          setGeneratedPassword(generateSecurePassword(val));
                        }}
                        className="w-24 accent-blue-500"
                      />
                      <span className="font-mono text-white">{genLength}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApplyGeneratedPassword}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5"
                    >
                      Use Password
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex items-center space-x-2 text-slate-300"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span>Previous Step</span>
              </Button>
              <Button
                type="submit"
                disabled={loading || !userInput.trim() || !password || password !== confirmPassword}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg shadow-lg shadow-blue-600/20 font-medium"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    <span>Creating User...</span>
                  </>
                ) : (
                  <>
                    <span>Create User</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3: ADD USER TO DATABASE */}
      {currentStep === 3 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-700/80 pb-4">
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Step 3 of 6
              </span>
              <h2 className="text-xl font-bold text-white">Add User To Database</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Link user <strong className="text-blue-400 font-mono">{createdUserFullName}</strong> to database <strong className="text-blue-400 font-mono">{createdDbFullName}</strong> and define access permissions.
            </p>
          </div>

          <div className="max-w-2xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User Card */}
              <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-400 text-xs uppercase font-semibold">
                  <User className="w-4 h-4 text-blue-400" />
                  <span>Selected User</span>
                </div>
                <div className="text-lg font-mono font-bold text-white break-all">
                  {createdUserFullName}
                </div>
                <div className="text-xs text-emerald-400 flex items-center space-x-1 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready to associate</span>
                </div>
              </div>

              {/* Database Card */}
              <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-400 text-xs uppercase font-semibold">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span>Target Database</span>
                </div>
                <div className="text-lg font-mono font-bold text-white break-all">
                  {createdDbFullName}
                </div>
                <div className="text-xs text-emerald-400 flex items-center space-x-1 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>utf8mb4 ready</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-xs text-slate-300 flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Next: Granular Privileges</strong>
                In the next step, you can grant all standard cPanel privileges or select specific permissions (SELECT, INSERT, UPDATE, DELETE, etc.) based on your application needs.
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="flex items-center space-x-2 text-slate-300"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span>Previous Step</span>
              </Button>
              <Button
                type="button"
                onClick={handleStep3Next}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg shadow-lg shadow-blue-600/20 font-medium"
              >
                <span>Next Step (Set Privileges)</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: MANAGE USER PRIVILEGES */}
      {currentStep === 4 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-700/80 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Step 4 of 6
                </span>
                <h2 className="text-xl font-bold text-white">Manage User Privileges</h2>
              </div>
              <div className="text-xs text-slate-400 font-mono hidden sm:block">
                User: <span className="text-blue-400 font-bold">{createdUserFullName}</span> | DB: <span className="text-indigo-400 font-bold">{createdDbFullName}</span>
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Select which SQL operations <span className="text-blue-400 font-mono font-medium">{createdUserFullName}</span> can perform on <span className="text-indigo-400 font-mono font-medium">{createdDbFullName}</span>.
            </p>
          </div>

          <div className="space-y-6">
            {/* Master ALL PRIVILEGES Checkbox */}
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between hover:border-slate-600 transition-colors">
              <label className="flex items-center space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllPrivilegesSelected}
                  onChange={toggleAllPrivileges}
                  className="w-5 h-5 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-950 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-bold text-white tracking-wide">ALL PRIVILEGES</span>
                  <p className="text-xs text-slate-400">Grant full administrative access across the entire database.</p>
                </div>
              </label>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {selectedPrivileges.length} / {PRIVILEGES_LIST.length} Selected
              </span>
            </div>

            {/* Granular Privilege Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PRIVILEGES_LIST.map((priv) => {
                const isChecked = selectedPrivileges.includes(priv);
                return (
                  <label
                    key={priv}
                    className={'flex items-center space-x-3 p-3 rounded-lg border text-sm font-mono transition-all cursor-pointer select-none ' + (
                      isChecked
                        ? 'bg-blue-600/10 border-blue-500/40 text-white shadow-sm'
                        : 'bg-slate-900/40 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePrivilege(priv)}
                      className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-950 cursor-pointer"
                    />
                    <span className="font-semibold">{priv}</span>
                  </label>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(3)}
                className="flex items-center space-x-2 text-slate-300"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span>Previous Step</span>
              </Button>
              <Button
                type="button"
                onClick={handleStep4Next}
                disabled={selectedPrivileges.length === 0}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg shadow-lg shadow-blue-600/20 font-medium"
              >
                <span>Make Changes / Next Step</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW & FINALIZE */}
      {currentStep === 5 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-700/80 pb-4">
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Step 5 of 6
              </span>
              <h2 className="text-xl font-bold text-white">Review Configuration</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Verify all parameters before applying privilege grants to the database server.
            </p>
          </div>

          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 space-y-1">
                <span className="text-xs text-slate-400 uppercase font-semibold">Database</span>
                <div className="text-base font-mono font-bold text-indigo-400 break-all">{createdDbFullName}</div>
                <div className="text-xs text-slate-500">utf8mb4_unicode_ci</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 space-y-1">
                <span className="text-xs text-slate-400 uppercase font-semibold">Database User</span>
                <div className="text-base font-mono font-bold text-blue-400 break-all">{createdUserFullName}</div>
                <div className="text-xs text-slate-500">Host: localhost (127.0.0.1)</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 space-y-1">
                <span className="text-xs text-slate-400 uppercase font-semibold">Privileges</span>
                <div className="text-base font-mono font-bold text-emerald-400">
                  {isAllPrivilegesSelected ? 'ALL PRIVILEGES' : (selectedPrivileges.length + ' Assigned')}
                </div>
                <div className="text-xs text-slate-500">Full Access Control</div>
              </div>
            </div>

            {/* Privileges Badge List */}
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-2">
              <span className="text-xs text-slate-400 uppercase font-semibold block">Granted Privileges:</span>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {selectedPrivileges.map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono font-medium"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Connection Strings Helper */}
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  <Code className="w-4 h-4 text-blue-400" />
                  <span>Connection Snippets</span>
                </div>
                <div className="flex items-center space-x-2">
                  {['env', 'php', 'node', 'python'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveSnippetTab(tab)}
                      className={'px-2.5 py-1 text-xs font-mono rounded transition-colors ' + (
                        activeSnippetTab === tab
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      )}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const snippet = activeSnippetTab === 'env'
                        ? 'DB_CONNECTION=mysql\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_DATABASE=' + createdDbFullName + '\nDB_USERNAME=' + createdUserFullName + '\nDB_PASSWORD=' + (savedUserPassword || 'YOUR_PASSWORD')
                        : activeSnippetTab === 'php'
                        ? '$pdo = new PDO("mysql:host=localhost;dbname=' + createdDbFullName + ';charset=utf8mb4", "' + createdUserFullName + '", "' + (savedUserPassword || 'YOUR_PASSWORD') + '");'
                        : activeSnippetTab === 'node'
                        ? 'const mysql = require("mysql2/promise");\nconst pool = mysql.createPool({\n  host: "localhost",\n  user: "' + createdUserFullName + '",\n  password: "' + (savedUserPassword || 'YOUR_PASSWORD') + '",\n  database: "' + createdDbFullName + '"\n});'
                        : 'import pymysql\nconn = pymysql.connect(\n    host="localhost",\n    user="' + createdUserFullName + '",\n    password="' + (savedUserPassword || 'YOUR_PASSWORD') + '",\n    database="' + createdDbFullName + '"\n)';
                      navigator.clipboard.writeText(snippet);
                      setCopiedSnippet(true);
                      setTimeout(() => setCopiedSnippet(false), 2000);
                    }}
                    className="text-xs text-slate-300 hover:text-white ml-2"
                  >
                    {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre">
                {activeSnippetTab === 'env' && (
                  'DB_CONNECTION=mysql\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_DATABASE=' + createdDbFullName + '\nDB_USERNAME=' + createdUserFullName + '\nDB_PASSWORD=' + (savedUserPassword || 'YOUR_PASSWORD')
                )}
                {activeSnippetTab === 'php' && (
                  '$pdo = new PDO(\n    "mysql:host=localhost;dbname=' + createdDbFullName + ';charset=utf8mb4",\n    "' + createdUserFullName + '",\n    "' + (savedUserPassword || 'YOUR_PASSWORD') + '"\n);'
                )}
                {activeSnippetTab === 'node' && (
                  'const mysql = require("mysql2/promise");\nconst pool = mysql.createPool({\n  host: "localhost",\n  user: "' + createdUserFullName + '",\n  password: "' + (savedUserPassword || 'YOUR_PASSWORD') + '",\n  database: "' + createdDbFullName + '"\n});'
                )}
                {activeSnippetTab === 'python' && (
                  'import pymysql\nconn = pymysql.connect(\n    host="localhost",\n    user="' + createdUserFullName + '",\n    password="' + (savedUserPassword || 'YOUR_PASSWORD') + '",\n    database="' + createdDbFullName + '"\n)'
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(4)}
                className="flex items-center space-x-2 text-slate-300"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span>Previous Step</span>
              </Button>
              <Button
                type="button"
                onClick={handleFinalize}
                disabled={loading}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-2.5 rounded-lg shadow-lg shadow-emerald-600/20 font-medium text-base"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    <span>Applying Privileges & Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 mr-1.5" />
                    <span>Apply Privileges & Finish</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: COMPLETE */}
      {currentStep === 6 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-3 py-4">
            <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
              <CheckCircle className="w-10 h-10 stroke-[2.5]" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Database Wizard Completed!
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto text-sm">
              Database <strong className="text-white font-mono">{createdDbFullName}</strong> and user <strong className="text-white font-mono">{createdUserFullName}</strong> have been configured with active privileges.
            </p>
          </div>

          {/* Verification Box */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-sm font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Live Server Verification</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                Verified Ready
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                  <span className="text-slate-400">Database:</span>
                  <span className="font-mono font-bold text-white">{createdDbFullName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                  <span className="text-slate-400">Database User:</span>
                  <span className="font-mono font-bold text-white">{createdUserFullName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                  <span className="text-slate-400">Server Host:</span>
                  <span className="font-mono text-white">localhost:3306</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                  <span className="text-slate-400">Engine Type:</span>
                  <span className="font-mono text-white">MariaDB / MySQL</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                  <span className="text-slate-400">Granted Privileges:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {selectedPrivileges.length} of {PRIVILEGES_LIST.length}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                  <span className="text-slate-400">Character Collation:</span>
                  <span className="font-mono text-white">utf8mb4_unicode_ci</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <Button
              onClick={resetWizard}
              className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium shadow-md shadow-blue-600/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create Another</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => onNavigate ? onNavigate('databases') : null}
              className="flex items-center justify-center space-x-2 text-slate-300 hover:text-white py-3 border-slate-700 hover:bg-slate-700/60"
            >
              <Layers className="w-4 h-4" />
              <span>Manage Databases</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => onNavigate ? onNavigate('phpmyadmin') : null}
              className="flex items-center justify-center space-x-2 text-amber-400 hover:text-amber-300 py-3 border-amber-500/30 hover:bg-amber-500/10"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in phpMyAdmin</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => onNavigate ? onNavigate('dashboard') : null}
              className="flex items-center justify-center space-x-2 text-slate-300 hover:text-white py-3 border-slate-700 hover:bg-slate-700/60"
            >
              <Home className="w-4 h-4" />
              <span>Return Home</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}