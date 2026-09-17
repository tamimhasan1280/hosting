import React from 'react';
import { X, Server, CheckCircle2 } from 'lucide-react';

export default function ServerInfoModal({ isOpen, onClose, stats }) {
  if (!isOpen) return null;

  const server = stats?.server || {};

  const services = [
    { name: 'Apache Web Server', status: 'Up (Active)', version: server.webServer || 'Apache 2.4.58' },
    { name: 'MySQL / MariaDB Database Server', status: 'Up (Active)', version: server.mySqlVersion || '10.6.18-MariaDB' },
    { name: 'Exim Mail Transfer Agent', status: 'Up (Active)', version: 'Exim 4.96' },
    { name: 'Dovecot IMAP / POP3 Server', status: 'Up (Active)', version: 'Dovecot 2.3.20' },
    { name: 'Pure-FTPd Server', status: 'Up (Active)', version: 'Pure-FTPd 1.0.51' },
    { name: 'OpenSSH Daemon', status: 'Up (Active)', version: 'OpenSSH 8.9p1' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-fade">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-[#ff6c2c]" />
            <h2 className="text-base font-bold">Server Information & Service Status</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
          {/* General Server Details */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3 text-sm">System Specifications</h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 divide-y divide-slate-100">
              <div className="flex justify-between py-2">
                <span className="text-slate-500 font-medium">Server Name / Host:</span>
                <span className="font-mono text-slate-800 font-semibold">{server.hostname || 'server1.cpanelhost.com'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 font-medium">Operating System & Platform:</span>
                <span className="font-mono text-slate-800">{server.platform} ({server.release})</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 font-medium">cPanel Version:</span>
                <span className="font-mono text-[#ff6c2c] font-bold">{server.cPanelVersion || '120.0 (build 11)'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 font-medium">Server Load:</span>
                <span className="font-mono text-emerald-600 font-semibold">{server.serverLoad || '0.12, 0.08, 0.05'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 font-medium">Path to Sendmail:</span>
                <span className="font-mono text-slate-600">/usr/sbin/sendmail</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 font-medium">Path to PERL:</span>
                <span className="font-mono text-slate-600">/usr/bin/perl</span>
              </div>
            </div>
          </div>

          {/* Service Status Table */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3 text-sm">Core Service Statuses</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Service</th>
                    <th className="py-2.5 px-4">Version</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {services.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{s.name}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{s.version}</td>
                      <td className="py-2.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
