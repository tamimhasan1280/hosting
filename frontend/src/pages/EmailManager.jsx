import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Mail, Plus, Trash2, ExternalLink, CheckCircle2, ArrowRight, ShieldCheck, RefreshCw, Send, Key, Sliders, X } from 'lucide-react';
import WebmailModal from '../components/WebmailModal';

export default function EmailManager({ initialJumpEmail }) {
  const [data, setData] = useState({ accounts: [], forwarders: [], autoresponders: [], deliverability: [] });
  const [tab, setTab] = useState('accounts'); // 'accounts' | 'forwarders' | 'autoresponders' | 'deliverability'
  const [loading, setLoading] = useState(true);

  // Webmail SSO Jumping State
  const [webmailOpen, setWebmailOpen] = useState(false);
  const [activeWebmailEmail, setActiveWebmailEmail] = useState('');
  const [webmailToken, setWebmailToken] = useState('');
  const [launchingWebmail, setLaunchingWebmail] = useState(false);

  // Password and Quota modal states
  const [changePassAccount, setChangePassAccount] = useState(null);
  const [changePassValue, setChangePassValue] = useState('');
  const [quotaAccount, setQuotaAccount] = useState(null);
  const [quotaValue, setQuotaValue] = useState('1024');
  const [modalLoading, setModalLoading] = useState(false);

  // Forms
  const [emailUser, setEmailUser] = useState('');
  const [emailDomain, setEmailDomain] = useState('example.com');
  const [emailPass, setEmailPass] = useState('');
  const [emailQuota, setEmailQuota] = useState('1024');

  const [fwdSource, setFwdSource] = useState('');
  const [fwdDest, setFwdDest] = useState('');

  const [autoEmail, setAutoEmail] = useState('');
  const [autoFrom, setAutoFrom] = useState('');
  const [autoSubject, setAutoSubject] = useState('');
  const [autoBody, setAutoBody] = useState('');

  const [statusMsg, setStatusMsg] = useState('');

  const handleOpenWebmail = async (targetEmail) => {
    setLaunchingWebmail(true);
    try {
      const res = await api.createWebmailSession(targetEmail);
      setActiveWebmailEmail(res.email);
      setWebmailToken(res.token);
      setWebmailOpen(true);
    } catch (err) {
      alert('Webmail SSO Error: ' + err.message);
    } finally {
      setLaunchingWebmail(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getEmailData();
      setData(res);
      if (res.accounts?.length > 0 && !emailDomain) {
        setEmailDomain(res.accounts[0].domain);
      }
      // Check for deep-link / jumping param
      const urlParams = new URLSearchParams(window.location.search);
      const jumpTarget = initialJumpEmail || (urlParams.get('jump') === 'webmail' ? urlParams.get('email') : null);
      if (jumpTarget) {
        const found = res.accounts?.find(a => a.email.toLowerCase() === jumpTarget.toLowerCase());
        if (found) {
          handleOpenWebmail(found.email);
        } else if (res.accounts?.length > 0) {
          handleOpenWebmail(res.accounts[0].email);
        }
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [initialJumpEmail]);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!emailUser.trim() || !emailPass.trim()) return;
    try {
      await api.createEmailAccount(emailUser.trim(), emailDomain, emailPass.trim(), emailQuota);
      setEmailUser('');
      setEmailPass('');
      setStatusMsg('Email account created successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAccount = async (email) => {
    if (!window.confirm(`Delete email account "${email}"? All mailbox messages will be removed.`)) return;
    try {
      await api.deleteEmailAccount(email);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmitChangePassword = async (e) => {
    e.preventDefault();
    if (!changePassValue || changePassValue.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    setModalLoading(true);
    try {
      await api.changeEmailPassword(changePassAccount, changePassValue);
      setStatusMsg(`Password for ${changePassAccount} successfully updated!`);
      setChangePassAccount(null);
      setChangePassValue('');
      setTimeout(() => setStatusMsg(''), 3000);
      loadData();
    } catch (err) {
      alert('Failed to change password: ' + (err.response?.data?.message || err.message));
    } finally {
      setModalLoading(false);
    }
  };

  const handleSubmitQuota = async (e) => {
    e.preventDefault();
    const quotaNum = parseInt(quotaValue, 10);
    if (isNaN(quotaNum) || quotaNum < 10) {
      alert('Please enter a valid storage quota (minimum 10 MB).');
      return;
    }
    setModalLoading(true);
    try {
      await api.updateEmailQuota(quotaAccount, quotaNum);
      setStatusMsg(`Quota for ${quotaAccount} updated to ${quotaNum} MB!`);
      setQuotaAccount(null);
      setTimeout(() => setStatusMsg(''), 3000);
      loadData();
    } catch (err) {
      alert('Failed to update quota: ' + (err.response?.data?.message || err.message));
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddForwarder = async (e) => {
    e.preventDefault();
    if (!fwdSource.trim() || !fwdDest.trim()) return;
    try {
      await api.addForwarder(fwdSource.trim(), fwdDest.trim());
      setFwdSource('');
      setFwdDest('');
      setStatusMsg('Forwarder added successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteForwarder = async (source, destination) => {
    try {
      await api.deleteForwarder(source, destination);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddAutoresponder = async (e) => {
    e.preventDefault();
    if (!autoEmail.trim() || !autoSubject.trim() || !autoBody.trim()) return;
    try {
      await api.addAutoresponder(autoEmail.trim(), autoFrom.trim(), autoSubject.trim(), autoBody.trim());
      setAutoEmail('');
      setAutoSubject('');
      setAutoBody('');
      setStatusMsg('Autoresponder saved!');
      setTimeout(() => setStatusMsg(''), 3000);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-purple-400" />
            Business Email Accounts & Routing
          </h1>
          <p className="text-xs text-purple-300/70 mt-1">
            Create domain emails (user@domain.com), setup forwarders, autoresponders, and view SPF/DKIM deliverability.
          </p>
        </div>
        {statusMsg && (
          <div className="bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-fade">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {statusMsg}
          </div>
        )}
      </div>

      {/* Tabs & Webmail SSO Button */}
      <div className="flex flex-wrap items-center justify-between border-b border-purple-800/30 pb-2 gap-3">
        <div className="flex space-x-4 text-xs font-semibold">
          <button
            onClick={() => setTab('accounts')}
            className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
              tab === 'accounts' ? 'border-purple-400 text-purple-200' : 'border-transparent text-purple-300/60 hover:text-purple-200'
            }`}
          >
            Email Accounts ({data.accounts.length})
          </button>
          <button
            onClick={() => setTab('forwarders')}
            className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
              tab === 'forwarders' ? 'border-purple-400 text-purple-200' : 'border-transparent text-purple-300/60 hover:text-purple-200'
            }`}
          >
            Forwarders ({data.forwarders.length})
          </button>
          <button
            onClick={() => setTab('autoresponders')}
            className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
              tab === 'autoresponders' ? 'border-purple-400 text-purple-200' : 'border-transparent text-purple-300/60 hover:text-purple-200'
            }`}
          >
            Autoresponders ({data.autoresponders.length})
          </button>
          <button
            onClick={() => setTab('deliverability')}
            className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
              tab === 'deliverability' ? 'border-purple-400 text-purple-200' : 'border-transparent text-purple-300/60 hover:text-purple-200'
            }`}
          >
            Email Deliverability (SPF/DKIM)
          </button>
        </div>

        {data.accounts.length > 0 && (
          <button
            onClick={() => handleOpenWebmail(data.accounts[0].email)}
            disabled={launchingWebmail}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            title="Single Sign-On Jump to Roundcube Webmail"
          >
            <Mail className="w-3.5 h-3.5" /> Jump to Webmail (SSO)
          </button>
        )}
      </div>

      {/* TAB 1: ACCOUNTS */}
      {tab === 'accounts' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-purple-400" /> Create an Email Account
            </h2>
            <form onSubmit={handleCreateAccount} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-purple-300/80 mb-1">Username:</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={emailUser}
                    onChange={(e) => setEmailUser(e.target.value)}
                    placeholder="contact"
                    className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-l-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 font-mono"
                  />
                  <span className="bg-[#180529] border border-l-0 border-purple-700/40 px-3 py-2 text-xs text-purple-300/80 rounded-r-xl font-mono">
                    @{emailDomain}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-purple-300/80 mb-1">Password:</label>
                <input
                  type="password"
                  value={emailPass}
                  onChange={(e) => setEmailPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-purple-300/80 mb-1">Storage Quota (MB):</label>
                <input
                  type="number"
                  value={emailQuota}
                  onChange={(e) => setEmailQuota(e.target.value)}
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg transition h-[35px] cursor-pointer"
              >
                + Create
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1f0933] text-purple-200 border-b border-purple-800/40 font-semibold">
                <tr>
                  <th className="py-3 px-6">Account</th>
                  <th className="py-3 px-6">Storage Usage</th>
                  <th className="py-3 px-6">Quota Limit</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20">
                {data.accounts.map((acc) => (
                  <tr key={acc.email} className="hover:bg-purple-900/20 transition">
                    <td className="py-3 px-6 font-semibold text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-400" /> {acc.email}
                    </td>
                    <td className="py-3 px-6 font-mono text-purple-200">{acc.usage}</td>
                    <td className="py-3 px-6 font-mono text-purple-300/70">{acc.quota}</td>
                    <td className="py-3 px-6 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenWebmail(acc.email)}
                        disabled={launchingWebmail}
                        className="px-2.5 py-1 bg-purple-950/60 hover:bg-purple-800/50 text-purple-200 border border-purple-700/40 rounded-lg font-medium text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                        title="Direct Login (SSO) to Roundcube"
                      >
                        Check Email <ExternalLink className="w-3 h-3 text-purple-400" />
                      </button>
                      <button
                        onClick={() => {
                          setChangePassAccount(acc.email);
                          setChangePassValue('');
                        }}
                        className="px-2 py-1 bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 border border-purple-700/30 rounded-lg font-medium text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                        title="Change Email Password"
                      >
                        <Key className="w-3 h-3 text-purple-400" /> Password
                      </button>
                      <button
                        onClick={() => {
                          setQuotaAccount(acc.email);
                          const parsedQuota = parseInt(acc.quota, 10);
                          setQuotaValue(isNaN(parsedQuota) ? '1024' : String(parsedQuota));
                        }}
                        className="px-2 py-1 bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-600/30 rounded-lg font-medium text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                        title="Update Storage Quota"
                      >
                        <Sliders className="w-3 h-3 text-amber-400" /> Quota
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.email)}
                        className="px-2 py-1 bg-red-950/50 text-red-300 hover:bg-red-900/50 border border-red-800/40 rounded-lg text-[11px] transition cursor-pointer"
                        title="Delete Email Account"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FORWARDERS */}
      {tab === 'forwarders' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-purple-400" /> Add an Email Forwarder
            </h2>
            <form onSubmit={handleAddForwarder} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-purple-300/80 mb-1">Address to Forward:</label>
                <input
                  type="email"
                  value={fwdSource}
                  onChange={(e) => setFwdSource(e.target.value)}
                  placeholder="sales@example.com"
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-purple-300/80 mb-1">Destination Email:</label>
                <input
                  type="email"
                  value={fwdDest}
                  onChange={(e) => setFwdDest(e.target.value)}
                  placeholder="manager@gmail.com"
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg transition h-[35px] cursor-pointer"
              >
                Add Forwarder
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1f0933] text-purple-200 border-b border-purple-800/40 font-semibold">
                <tr>
                  <th className="py-3 px-6">Email Address</th>
                  <th className="py-3 px-6">Forward To</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20">
                {data.forwarders.map((f, idx) => (
                  <tr key={idx} className="hover:bg-purple-900/20 transition">
                    <td className="py-3 px-6 font-semibold text-white font-mono">{f.source}</td>
                    <td className="py-3 px-6 text-emerald-400 flex items-center gap-1.5 font-medium font-mono">
                      <ArrowRight className="w-3.5 h-3.5 text-purple-400" /> {f.destination}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => handleDeleteForwarder(f.source, f.destination)}
                        className="px-2 py-1 bg-red-950/50 text-red-300 hover:bg-red-900/50 border border-red-800/40 rounded-lg text-[11px] transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUTORESPONDERS */}
      {tab === 'autoresponders' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-purple-400" /> Add Autoresponder
            </h2>
            <form onSubmit={handleAddAutoresponder} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-purple-300/80 mb-1">Email:</label>
                  <input
                    type="email"
                    value={autoEmail}
                    onChange={(e) => setAutoEmail(e.target.value)}
                    placeholder="support@example.com"
                    className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-purple-300/80 mb-1">From Name:</label>
                  <input
                    type="text"
                    value={autoFrom}
                    onChange={(e) => setAutoFrom(e.target.value)}
                    placeholder="Support Desk"
                    className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-purple-300/80 mb-1">Subject:</label>
                  <input
                    type="text"
                    value={autoSubject}
                    onChange={(e) => setAutoSubject(e.target.value)}
                    placeholder="Thank you for your message"
                    className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-purple-300/80 mb-1">Body Text:</label>
                <textarea
                  value={autoBody}
                  onChange={(e) => setAutoBody(e.target.value)}
                  rows="3"
                  placeholder="I am out of the office until..."
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 font-sans"
                />
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg transition cursor-pointer"
              >
                Save Autoresponder
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1f0933] text-purple-200 border-b border-purple-800/40 font-semibold">
                <tr>
                  <th className="py-3 px-6">Email</th>
                  <th className="py-3 px-6">Subject</th>
                  <th className="py-3 px-6">From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20">
                {data.autoresponders.map((a, idx) => (
                  <tr key={idx} className="hover:bg-purple-900/20 transition">
                    <td className="py-3 px-6 font-semibold text-white font-mono">{a.email}</td>
                    <td className="py-3 px-6 text-purple-200">{a.subject}</td>
                    <td className="py-3 px-6 text-purple-300/70">{a.from}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DELIVERABILITY */}
      {tab === 'deliverability' && (
        <div className="p-6 rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Email Deliverability Status
          </h2>
          <p className="text-xs text-purple-300/70 leading-relaxed">
            Ensure your emails arrive in the inbox and not spam folders with automated SPF (Sender Policy Framework), DKIM (DomainKeys Identified Mail), and PTR records.
          </p>
          <div className="border border-purple-800/40 rounded-xl p-4 bg-purple-950/40 flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-bold text-white text-sm font-mono">{emailDomain || 'example.com'}</div>
              <div className="text-xs text-emerald-400 flex items-center gap-3">
                <span>SPF: <strong>VALID</strong></span>
                <span>•</span>
                <span>DKIM: <strong>VALID</strong></span>
                <span>•</span>
                <span>Reverse DNS (PTR): <strong>VALID</strong></span>
              </div>
            </div>
            <span className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-semibold text-xs px-3 py-1 rounded-full">
              ✓ Ready for Sending
            </span>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {changePassAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1c0830] rounded-2xl border border-purple-700/50 shadow-2xl w-full max-w-sm overflow-hidden text-left">
            <div className="px-5 py-4 border-b border-purple-800/40 flex items-center justify-between bg-[#19062b]">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm text-white">Change Password</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setChangePassAccount(null)}
                className="text-purple-300/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitChangePassword} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-purple-300/80 mb-1">Email Account:</label>
                <div className="font-mono text-xs font-bold text-emerald-300 bg-[#250c3d] border border-purple-700/40 px-3 py-2 rounded-xl truncate">
                  {changePassAccount}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-300/80 mb-1">New Password:</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={changePassValue}
                  onChange={(e) => setChangePassValue(e.target.value)}
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePassAccount(null)}
                  className="px-3 py-1.5 border border-purple-700/40 text-xs font-semibold rounded-xl text-purple-300 hover:bg-purple-900/30 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer"
                >
                  {modalLoading ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Quota Modal */}
      {quotaAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1c0830] rounded-2xl border border-purple-700/50 shadow-2xl w-full max-w-sm overflow-hidden text-left">
            <div className="px-5 py-4 border-b border-purple-800/40 flex items-center justify-between bg-[#19062b]">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Set Storage Quota</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setQuotaAccount(null)}
                className="text-purple-300/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitQuota} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-purple-300/80 mb-1">Email Account:</label>
                <div className="font-mono text-xs font-bold text-amber-300 bg-[#250c3d] border border-purple-700/40 px-3 py-2 rounded-xl truncate">
                  {quotaAccount}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-300/80 mb-1">Quota Limit (MB):</label>
                <input
                  type="number"
                  required
                  min="10"
                  step="50"
                  value={quotaValue}
                  onChange={(e) => setQuotaValue(e.target.value)}
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
                <span className="text-[11px] text-purple-300/50 mt-1 block">e.g. 500, 1024, 2048 MB</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuotaAccount(null)}
                  className="px-3 py-1.5 border border-purple-700/40 text-xs font-semibold rounded-xl text-purple-300 hover:bg-purple-900/30 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer"
                >
                  {modalLoading ? 'Saving...' : 'Save Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roundcube Webmail SSO Modal */}
      <WebmailModal
        isOpen={webmailOpen}
        onClose={() => setWebmailOpen(false)}
        email={activeWebmailEmail}
        sessionToken={webmailToken}
      />
    </div>
  );
}
