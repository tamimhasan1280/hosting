import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FileText, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function MimeTypesManager({ onBack }) {
  const [mimes, setMimes] = useState([]);
  const [ext, setExt] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const loadMimes = async () => {
    try {
      const res = await api.getMimeTypes();
      setMimes(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadMimes(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.addMimeType({ extension: ext, mimeType });
      setStatusMsg(`MIME mapping added for .${ext}!`);
      setTimeout(() => setStatusMsg(''), 3000);
      setExt('');
      setMimeType('');
      loadMimes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (extension) => {
    try {
      await api.deleteMimeType(extension);
      loadMimes();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">Advanced</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">MIME Types</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#ff6c2c]" />
            MIME Types Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Specify how web browsers should handle and render specific file formats (AddType).
          </p>
        </div>
        {statusMsg && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {statusMsg}
          </div>
        )}
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex gap-4 items-end text-xs">
        <div className="flex-1">
          <label className="block text-slate-700 font-semibold mb-1">Extension</label>
          <input type="text" required value={ext} onChange={e => setExt(e.target.value)} placeholder="e.g. webp" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
        <div className="flex-1">
          <label className="block text-slate-700 font-semibold mb-1">MIME Type</label>
          <input type="text" required value={mimeType} onChange={e => setMimeType(e.target.value)} placeholder="e.g. image/webp" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
        <button type="submit" className="px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05b22] text-white rounded-lg font-semibold flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add MIME Type
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <h2 className="text-sm font-bold text-slate-800">User Defined MIME Types</h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
            <tr>
              <th className="py-3 px-6">Extension</th>
              <th className="py-3 px-6">MIME Type</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {mimes.map((m, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="py-3 px-6 text-slate-800 font-bold">.{m.extension}</td>
                <td className="py-3 px-6 text-slate-600">{m.mimeType}</td>
                <td className="py-3 px-6 text-right">
                  <button onClick={() => handleDelete(m.extension)} className="text-rose-600 hover:text-rose-800"><Trash2 className="w-3.5 h-3.5 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
