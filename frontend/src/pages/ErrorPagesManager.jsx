import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AlertTriangle, Save, CheckCircle2, RefreshCw } from 'lucide-react';

export default function ErrorPagesManager({ onBack, user = 'cpanel_user' }) {
  const [pages, setPages] = useState([]);
  const [selectedCode, setSelectedCode] = useState('404');
  const [htmlContent, setHtmlContent] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const loadPages = async () => {
    try {
      const res = await api.getErrorPages(user);
      setPages(res || []);
      const found = (res || []).find(p => p.code === selectedCode);
      if (found) {
        setHtmlContent(found.customHtml || `<!DOCTYPE html>\n<html>\n<head><title>${found.code} - ${found.name}</title></head>\n<body>\n  <h1>${found.name}</h1>\n  <p>${found.defaultDesc}</p>\n</body>\n</html>`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadPages(); }, [user]);

  const handleSelectCode = (code) => {
    setSelectedCode(code);
    const found = pages.find(p => p.code === code);
    if (found) {
      setHtmlContent(found.customHtml || `<!DOCTYPE html>\n<html>\n<head><title>${found.code} - ${found.name}</title></head>\n<body>\n  <h1>${found.name}</h1>\n  <p>${found.defaultDesc}</p>\n</body>\n</html>`);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.saveErrorPage(selectedCode, htmlContent);
      setStatusMsg(`Custom Error Page for HTTP ${selectedCode} saved!`);
      setTimeout(() => setStatusMsg(''), 3000);
      loadPages();
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
            <span className="font-semibold text-slate-700">Error Pages</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#ff6c2c]" />
            Custom HTTP Error Pages
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure tailored 400, 401, 403, 404, and 500 error documents for your visitors.
          </p>
        </div>
        {statusMsg && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {statusMsg}
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-200 space-x-2 text-xs font-semibold">
        {pages.map(p => (
          <button
            key={p.code}
            onClick={() => handleSelectCode(p.code)}
            className={`pb-2.5 px-3 border-b-2 transition ${
              selectedCode === p.code ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            HTTP {p.code} {p.isCustom ? '★' : ''}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Edit Error Document for HTTP {selectedCode}</h2>
          <span className="text-xs text-slate-400">Writes to public_html/error_pages/{selectedCode}.shtml</span>
        </div>
        <textarea
          rows={12}
          value={htmlContent}
          onChange={(e) => setHtmlContent(e.target.value)}
          className="w-full p-3 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
        />
        <div className="flex justify-end pt-2">
          <button type="submit" className="px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05b22] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Save className="w-4 h-4" /> Save Error Page
          </button>
        </div>
      </form>
    </div>
  );
}
