import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Languages, CheckCircle2 } from 'lucide-react';

export default function ChangeLanguageManager({ onBack, user = 'cpanel_user' }) {
  const [languages, setLanguages] = useState([]);
  const [currentLang, setCurrentLang] = useState('en');
  const [statusMsg, setStatusMsg] = useState('');

  const loadLangs = async () => {
    try {
      const [list, userPref] = await Promise.all([
        api.getSupportedLanguages(),
        api.getPreferences(user)
      ]);
      setLanguages(list || []);
      if (userPref?.language) setCurrentLang(userPref.language);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadLangs(); }, [user]);

  const handleSelect = async (code) => {
    try {
      await api.setLanguage(code, user);
      setCurrentLang(code);
      setStatusMsg(`Language changed to ${languages.find(l => l.code === code)?.nativeName || code}!`);
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">Preferences</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">Change Language</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Languages className="w-6 h-6 text-[#ff6c2c]" />
            Change Interface Language
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Select your preferred display language for the cPanel control panel interface.
          </p>
        </div>
        {statusMsg && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {statusMsg}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Supported Locales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`p-3 rounded-lg border text-left flex items-center justify-between transition ${
                currentLang === lang.code
                  ? 'border-[#ff6c2c] bg-orange-50/40 text-slate-900 font-bold'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{lang.flag}</span>
                <div>
                  <div>{lang.nativeName}</div>
                  <div className="text-[10px] text-slate-400 font-normal font-mono">{lang.name} ({lang.code})</div>
                </div>
              </div>
              {currentLang === lang.code && (
                <CheckCircle2 className="w-4 h-4 text-[#ff6c2c]" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
