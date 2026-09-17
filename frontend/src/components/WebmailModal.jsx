import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Mail, Inbox, Send, FileText, AlertOctagon, Trash2,
  RefreshCw, Plus, X, ArrowLeft, Check, ShieldCheck,
  Search, Paperclip, Reply, CornerDownLeft, Key
} from 'lucide-react';

export default function WebmailModal({ isOpen, onClose, email, sessionToken }) {
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [counts, setCounts] = useState({ inbox: 0, sent: 0, drafts: 0, junk: 0, trash: 0 });
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  
  // Compose form
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const loadFolder = async (folder = activeFolder) => {
    if (!email) return;
    setLoading(true);
    try {
      const data = await api.getWebmailMailbox(email, folder);
      setMessages(data.messages || []);
      if (data.counts) setCounts(data.counts);
      if (data.messages?.length > 0 && (!selectedMsg || folder !== activeFolder)) {
        setSelectedMsg(data.messages[0]);
        // auto mark read
        if (!data.messages[0].read) {
          api.markWebmailRead(email, folder, data.messages[0].id).catch(() => {});
        }
      } else if (data.messages?.length === 0) {
        setSelectedMsg(null);
      }
    } catch (err) {
      console.error('Failed to load mailbox', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && email) {
      setActiveFolder('inbox');
      loadFolder('inbox');
    }
  }, [isOpen, email]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleSelectMessage = (msg) => {
    setSelectedMsg(msg);
    if (!msg.read) {
      msg.read = true;
      api.markWebmailRead(email, activeFolder, msg.id).catch(() => {});
      setCounts(prev => ({ ...prev, [activeFolder]: Math.max(0, (prev[activeFolder] || 1) - 1) }));
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!to.trim()) {
      alert('Please enter a recipient email address');
      return;
    }
    setSending(true);
    try {
      await api.sendWebmailMail(email, to.trim(), subject.trim(), body.trim());
      setComposing(false);
      setTo('');
      setSubject('');
      setBody('');
      showToast('Email sent successfully!');
      if (activeFolder === 'sent') {
        loadFolder('sent');
      } else {
        // Refresh counts
        loadFolder(activeFolder);
      }
    } catch (err) {
      alert('Error sending mail: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (msgId) => {
    try {
      await api.deleteWebmailMail(email, activeFolder, msgId);
      showToast('Message removed');
      loadFolder(activeFolder);
    } catch (err) {
      alert('Error deleting message: ' + err.message);
    }
  };

  const handleReply = () => {
    if (!selectedMsg) return;
    setTo(selectedMsg.from.includes('<') ? selectedMsg.from.split('<')[1].replace('>', '') : selectedMsg.from);
    setSubject(`Re: ${selectedMsg.subject.replace(/^Re:\s*/i, '')}`);
    setBody(`\n\n--- On ${selectedMsg.date}, ${selectedMsg.from} wrote: ---\n${selectedMsg.body}`);
    setComposing(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-[#1c0830] w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-purple-700/50 animate-in fade-in duration-200 overflow-hidden">
        
        {/* Roundcube Top Bar */}
        <header className="bg-[#150426] text-white px-4 py-3 flex items-center justify-between border-b border-purple-800/50">
          <div className="flex items-center space-x-3">
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 rounded-xl shadow">
              <Mail className="w-5 h-5 text-white" />
              <span className="font-bold text-sm tracking-wide">Roundcube Webmail</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-purple-200 bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-700/40 font-mono">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>SSO Active:</span>
              <span className="text-emerald-400 font-semibold">{sessionToken || 'wmsess_authenticated'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs bg-purple-950/80 text-purple-200 px-3 py-1 rounded-full border border-purple-700/50 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {email}
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1 cursor-pointer"
              title="Return to cPanel Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to cPanel
            </button>
          </div>
        </header>

        {/* Action Toolbar */}
        <div className="bg-[#1a072d] border-b border-purple-800/40 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => { setComposing(true); setTo(''); setSubject(''); setBody(''); }}
              className="bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Compose
            </button>
            <button
              onClick={() => loadFolder(activeFolder)}
              disabled={loading}
              className="bg-purple-950/50 hover:bg-purple-900/50 text-purple-200 border border-purple-700/40 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} /> Refresh
            </button>
            {selectedMsg && (
              <>
                <button
                  onClick={handleReply}
                  className="bg-purple-950/50 hover:bg-purple-900/50 text-purple-200 border border-purple-700/40 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Reply className="w-3.5 h-3.5 text-purple-400" /> Reply
                </button>
                <button
                  onClick={() => handleDelete(selectedMsg.id)}
                  className="bg-red-950/50 hover:bg-red-900/50 text-red-300 border border-red-800/40 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" /> Delete
                </button>
              </>
            )}
          </div>

          {toastMsg && (
            <div className="text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-lg flex items-center gap-1 font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> {toastMsg}
            </div>
          )}
        </div>

        {/* Main Split Interface */}
        <div className="flex-1 flex overflow-hidden">
          {/* Folders Sidebar */}
          <div className="w-48 bg-[#160527] border-r border-purple-800/40 p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 px-2 py-1">
                Mail Folders
              </div>
              {[
                { key: 'inbox', label: 'Inbox', icon: Inbox, badge: counts.inbox },
                { key: 'sent', label: 'Sent', icon: Send, badge: counts.sent },
                { key: 'drafts', label: 'Drafts', icon: FileText, badge: counts.drafts },
                { key: 'junk', label: 'Junk / Spam', icon: AlertOctagon, badge: counts.junk },
                { key: 'trash', label: 'Trash', icon: Trash2, badge: counts.trash },
              ].map(f => {
                const Icon = f.icon;
                const active = activeFolder === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => { setActiveFolder(f.key); loadFolder(f.key); }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                      active ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm' : 'text-purple-300/70 hover:bg-purple-900/30 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-purple-400'}`} />
                      {f.label}
                    </span>
                    {f.badge > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        active ? 'bg-white text-purple-900' : 'bg-purple-900/60 text-purple-200'
                      }`}>
                        {f.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Storage Quota Bar */}
            <div className="bg-purple-950/40 p-2.5 rounded-xl border border-purple-800/30 text-[11px]">
              <div className="flex justify-between text-purple-300/70 mb-1">
                <span>Disk Quota</span>
                <span className="font-semibold text-white font-mono">1.4%</span>
              </div>
              <div className="w-full bg-purple-900/50 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full w-[1.4%]"></div>
              </div>
              <div className="text-[10px] text-purple-400/60 mt-1 font-mono">14.2 MB / 1024 MB</div>
            </div>
          </div>

          {/* Messages Column & Reader Split */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Messages List */}
            <div className="w-full md:w-80 border-r border-purple-800/40 overflow-y-auto divide-y divide-purple-900/20 bg-[#19062b] shrink-0">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-purple-300/50 text-xs">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-400" />
                  No messages in {activeFolder}
                </div>
              ) : (
                messages.map(m => (
                  <div
                    key={m.id}
                    onClick={() => handleSelectMessage(m)}
                    className={`p-3 text-xs cursor-pointer transition border-l-4 ${
                      selectedMsg?.id === m.id
                        ? 'bg-purple-900/40 border-l-purple-400'
                        : !m.read
                        ? 'bg-purple-950/80 border-l-emerald-400 font-semibold'
                        : 'hover:bg-purple-900/20 border-l-transparent text-purple-200'
                    }`}
                  >
                    <div className="flex justify-between items-center text-purple-300/70 text-[11px] mb-1">
                      <span className="truncate max-w-[150px] text-white font-semibold">
                        {m.from.split('<')[0]}
                      </span>
                      <span className="text-[10px] text-purple-400/60 font-mono">{m.date.split(',')[0]}</span>
                    </div>
                    <div className={`truncate text-purple-100 ${!m.read ? 'font-bold text-white' : ''}`}>
                      {m.subject}
                    </div>
                    <div className="text-purple-300/50 text-[11px] truncate mt-0.5">
                      {m.body.substring(0, 50)}...
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Reader Pane */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#140324] flex flex-col">
              {selectedMsg ? (
                <div className="bg-[#1c0830] rounded-2xl shadow-xl border border-purple-800/40 p-6 flex-1 flex flex-col">
                  {/* Email Header */}
                  <div className="border-b border-purple-800/40 pb-4 mb-4">
                    <h1 className="text-base font-bold text-white mb-2">
                      {selectedMsg.subject}
                    </h1>
                    <div className="text-xs text-purple-300/70 space-y-1">
                      <div><span className="font-semibold text-purple-400">From:</span> {selectedMsg.from}</div>
                      <div><span className="font-semibold text-purple-400">To:</span> {selectedMsg.to}</div>
                      <div><span className="font-semibold text-purple-400">Date:</span> {selectedMsg.date}</div>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="flex-1 text-xs leading-relaxed text-purple-100 whitespace-pre-wrap font-sans">
                    {selectedMsg.body}
                  </div>

                  {/* Bottom Quick Reply Bar */}
                  <div className="border-t border-purple-800/40 pt-4 mt-6 flex justify-between items-center">
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verified TLS Authenticated Mail
                    </span>
                    <button
                      onClick={handleReply}
                      className="px-3 py-1.5 bg-purple-950/60 text-purple-200 hover:bg-purple-900/50 border border-purple-700/40 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Reply className="w-3.5 h-3.5 text-purple-400" /> Quick Reply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-purple-300/50 text-xs">
                  <Mail className="w-12 h-12 stroke-[1.5] mb-2 text-purple-400/40" />
                  Select an email to view its contents
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compose Drawer / Modal */}
        {composing && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-end sm:items-center justify-center p-4">
            <div className="bg-[#1c0830] w-full max-w-2xl rounded-2xl shadow-2xl border border-purple-700/50 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
              <div className="bg-[#150426] text-white px-5 py-3 flex items-center justify-between border-b border-purple-800/40">
                <span className="font-bold text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-purple-400" /> Compose New Message
                </span>
                <button
                  onClick={() => setComposing(false)}
                  className="text-purple-300/60 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSend} className="p-5 space-y-3">
                <div className="flex items-center border-b border-purple-800/40 pb-2 text-xs">
                  <span className="w-16 font-semibold text-purple-300/70">From:</span>
                  <span className="font-mono text-emerald-300">{email}</span>
                </div>
                <div className="flex items-center border-b border-purple-800/40 pb-2 text-xs">
                  <label htmlFor="to-input" className="w-16 font-semibold text-purple-300/70">To:</label>
                  <input
                    id="to-input"
                    type="email"
                    required
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="recipient@domain.com"
                    className="flex-1 font-mono text-xs bg-transparent text-white focus:outline-none placeholder-purple-400/40"
                  />
                </div>
                <div className="flex items-center border-b border-purple-800/40 pb-2 text-xs">
                  <label htmlFor="subject-input" className="w-16 font-semibold text-purple-300/70">Subject:</label>
                  <input
                    id="subject-input"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="flex-1 text-xs bg-transparent text-white focus:outline-none font-medium placeholder-purple-400/40"
                  />
                </div>
                <div>
                  <textarea
                    rows={8}
                    required
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full text-xs p-3 bg-[#250c3d]/90 border border-purple-700/40 rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 leading-relaxed font-sans"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="text-[11px] text-purple-300/50">
                    Dispatched securely via local SMTP server
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setComposing(false)}
                      className="px-4 py-2 border border-purple-700/40 hover:bg-purple-900/30 text-purple-300 text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className="px-5 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> {sending ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
