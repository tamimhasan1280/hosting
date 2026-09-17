import React, { useState, useEffect } from 'react';
import { 
  Globe, ExternalLink, RefreshCw, Shield, AlertTriangle, CheckCircle2, 
  Layers, Plus, Trash2, Edit3, Send, Sparkles, Layout, Info, Search,
  Lock, ArrowRight, X, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function SitejetManager({ onBack, user = 'cpanel_user' }) {
  const [capabilities, setCapabilities] = useState(null);
  const [sitesData, setSitesData] = useState({ sites: [], totalDomains: 0, activeProjects: 0, publishedProjects: 0 });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('business_pro');
  const [projectName, setProjectName] = useState('');
  const [unlinkModalOpen, setUnlinkModalOpen] = useState(false);
  const [projectToUnlink, setProjectToUnlink] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [capsRes, sitesRes, tmplRes] = await Promise.all([
        api.getSitejetCapabilities(user),
        api.getSitejetSites(user),
        api.getSitejetTemplates()
      ]);
      setCapabilities(capsRes);
      if (sitesRes && sitesRes.sites) {
        setSitesData(sitesRes);
      }
      if (tmplRes && tmplRes.templates) {
        setTemplates(tmplRes.templates);
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to load Sitejet information', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleOpenCreateModal = (domain = '') => {
    setSelectedDomain(domain || (sitesData.sites[0]?.domain || ''));
    setSelectedTemplate('business_pro');
    setProjectName(domain ? `${domain} Website` : '');
    setCreateModalOpen(true);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!selectedDomain) {
      showToast('Please select a target domain', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.createSitejetProject({
        domain: selectedDomain,
        templateId: selectedTemplate,
        projectName: projectName || `${selectedDomain} Website`,
        cpanelUser: user
      });
      if (res.success) {
        showToast(`Sitejet project created for ${selectedDomain}`);
        setCreateModalOpen(false);
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to create Sitejet project', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenBuilder = async (site) => {
    if (!site.project) return;
    try {
      setActionLoading(true);
      const res = await api.openSitejetBuilder({
        projectId: site.project.projectId,
        cpanelUser: user
      });
      if (res.success && res.ssoUrl) {
        window.open(res.ssoUrl, '_blank', 'noopener,noreferrer');
        showToast(`Opening Sitejet Builder for ${site.domain}...`);
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to launch builder session', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (site) => {
    if (!site.project) return;
    try {
      setActionLoading(true);
      const res = await api.publishSitejetSite({
        projectId: site.project.projectId,
        cpanelUser: user
      });
      if (res.success) {
        showToast(`Successfully published ${site.domain}!`);
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to publish website', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmUnlink = async () => {
    if (!projectToUnlink) return;
    try {
      setActionLoading(true);
      const res = await api.unlinkSitejetProject({
        projectId: projectToUnlink.project.projectId,
        cpanelUser: user
      });
      if (res.success) {
        showToast(`Unlinked Sitejet project for ${projectToUnlink.domain}`);
        setUnlinkModalOpen(false);
        setProjectToUnlink(null);
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to unlink project', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSites = sitesData.sites.filter(s => {
    const q = searchQuery.toLowerCase();
    return s.domain.toLowerCase().includes(q) || s.type.toLowerCase().includes(q) || s.documentRoot.toLowerCase().includes(q);
  });

  const selectedSiteObj = sitesData.sites.find(s => s.domain === selectedDomain);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all ${
          toast.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="hover:text-slate-800 cursor-pointer" onClick={onBack}>cPanel</span>
            <span>/</span>
            <span>Domains</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Sitejet Builder</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#ff6c2c]" />
            Sitejet Builder
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Build, design, and publish responsive websites directly on your domains with the integrated visual builder.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading || actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#ff6c2c]' : 'text-slate-500'}`} />
            Refresh
          </button>

          <button
            onClick={() => handleOpenCreateModal()}
            disabled={loading || actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#ff6c2c] hover:bg-[#e05819] text-white rounded-lg text-sm font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create Website
          </button>
        </div>
      </div>

      {/* Capability Banner */}
      {capabilities && capabilities.status === 'NOT_CONFIGURED' ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-sm">Sitejet Partner Integration Notice</div>
            <p className="mt-0.5">{capabilities.statusMessage}</p>
            <p className="mt-1 text-amber-700">Account domains and document root deployment remain fully available.</p>
          </div>
        </div>
      ) : capabilities && capabilities.status === 'AVAILABLE' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div className="text-xs">
              <div className="font-semibold text-sm">Sitejet Builder Integration Active</div>
              <p className="text-emerald-700">Connected with {capabilities.partnerName} • One-click visual editing &amp; direct deployment ready.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-200/60 text-emerald-900 text-xs font-bold rounded-full uppercase">
            Active
          </span>
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-[#ff6c2c] rounded-lg">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{sitesData.totalDomains}</div>
            <div className="text-xs text-slate-500 font-medium">Eligible Domains</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Layout className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{sitesData.activeProjects}</div>
            <div className="text-xs text-slate-500 font-medium">Sitejet Projects</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{sitesData.publishedProjects}</div>
            <div className="text-xs text-slate-500 font-medium">Published Sites</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{templates.length}</div>
            <div className="text-xs text-slate-500 font-medium">Design Templates</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter domains and websites by name or root..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
        />
      </div>

      {/* Sites List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-[#ff6c2c] animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Loading Sitejet domains and projects...</p>
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Globe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No Domains Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            No matching domains were found for this hosting account. Add a domain in cPanel Domains first.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Hosted Websites &amp; Sitejet Projects
            </h3>
            <span className="text-xs text-slate-500">{filteredSites.length} domain(s)</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredSites.map((site) => (
              <div key={site.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-100/60 text-[#ff6c2c] rounded-xl mt-0.5">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-slate-900">{site.domain}</h4>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">
                        {site.type}
                      </span>
                      {site.status === 'PUBLISHED' ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Published
                        </span>
                      ) : site.status === 'DRAFT' ? (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full flex items-center gap-1">
                          <Edit3 className="w-3.5 h-3.5" /> Draft Project
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
                          No Sitejet Project
                        </span>
                      )}

                      {site.hasWordPress && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                          WordPress Active
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span><strong>Document Root:</strong> {site.documentRoot}</span>
                      <span>•</span>
                      <span><strong>SSL:</strong> {site.sslStatus}</span>
                      {site.lastPublished && (
                        <>
                          <span>•</span>
                          <span><strong>Last Published:</strong> {new Date(site.lastPublished).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end lg:self-center flex-wrap">
                  {site.hasProject ? (
                    <>
                      <button
                        onClick={() => handleOpenBuilder(site)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ff6c2c] hover:bg-[#e05819] text-white text-xs font-semibold rounded-lg shadow-sm transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit in Sitejet</span>
                      </button>

                      <button
                        onClick={() => handlePublish(site)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>

                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition"
                      >
                        <span>Visit Site</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      <button
                        onClick={() => {
                          setProjectToUnlink(site);
                          setUnlinkModalOpen(true);
                        }}
                        disabled={actionLoading}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Unlink Sitejet Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleOpenCreateModal(site.domain)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ff6c2c] hover:bg-[#e05819] text-white text-xs font-semibold rounded-lg shadow-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Website</span>
                      </button>

                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition"
                      >
                        <span>Visit Site</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Website Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#ff6c2c]" />
                Create Sitejet Website
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              {/* Domain Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Domain
                </label>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
                >
                  {sitesData.sites.map(s => (
                    <option key={s.domain} value={s.domain}>
                      {s.domain} ({s.documentRoot}) {s.hasProject ? '— Already has project' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conflict Warning */}
              {selectedSiteObj && (selectedSiteObj.hasWordPress || selectedSiteObj.hasExistingSite) && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Existing Website Content Detected</div>
                    <p className="mt-0.5">
                      {selectedSiteObj.hasWordPress 
                        ? 'This domain has an active WordPress installation.' 
                        : 'This document root contains existing HTML/website files.'
                      }
                      {' '}Publishing a Sitejet website will overwrite the root index file.
                    </p>
                  </div>
                </div>
              )}

              {/* Project Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Project Title / Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. My Modern Website"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
                />
              </div>

              {/* Template Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Choose Starter Template
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                        selectedTemplate === t.id
                          ? 'border-[#ff6c2c] bg-orange-50/50 ring-1 ring-[#ff6c2c]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{t.name}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{t.category}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05819] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-60"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Create &amp; Associate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unlink Modal */}
      {unlinkModalOpen && projectToUnlink && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Unlink Sitejet Project</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to unlink the Sitejet project for <strong>{projectToUnlink.domain}</strong>? 
              This will remove the builder association from cPanel. Your published website files in <code>{projectToUnlink.documentRoot}</code> will remain intact.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnlinkModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlink}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition"
              >
                Confirm Unlink
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
