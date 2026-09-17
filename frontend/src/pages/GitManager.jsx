import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  GitBranch, Plus, RefreshCw, Trash2, CheckCircle2, DownloadCloud, 
  UploadCloud, GitCommit, Folder, 
  AlertTriangle, Check, Copy, ArrowLeft,
  Clock, FileCode, HardDrive, Layers, ChevronRight, Server
} from 'lucide-react';

export default function GitManager() {
  const [capabilities, setCapabilities] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Active view: 'list' | 'create' | 'manage'
  const [viewMode, setViewMode] = useState('list');
  const [selectedRepoId, setSelectedRepoId] = useState(null);
  const [repoDetails, setRepoDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'branches' | 'history' | 'remotes' | 'deploy'

  // Create / Clone Form State
  const [createMode, setCreateMode] = useState('clone'); // 'clone' | 'init'
  const [repoName, setRepoName] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [initReadme, setInitReadme] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Commit Form State inside Manage
  const [commitMsg, setCommitMsg] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [committing, setCommitting] = useState(false);

  // Branch Form State
  const [newBranchName, setNewBranchName] = useState('');
  const [checkoutNewBranch, setCheckoutNewBranch] = useState(true);

  // Remote Form State
  const [newRemoteName, setNewRemoteName] = useState('origin');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');
  const [showAddRemote, setShowAddRemote] = useState(false);

  // Deploy Form State
  const [deployPath, setDeployPath] = useState('public_html');
  const [deploying, setDeploying] = useState(false);

  // Delete Modal State
  const [deleteModalRepo, setDeleteModalRepo] = useState(null);
  const [deleteFiles, setDeleteFiles] = useState(false);

  // Load Capabilities & Repos
  const loadInitialData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [capsRes, reposRes] = await Promise.all([
        api.getGitCapabilities().catch(e => ({ available: false, error: e.message })),
        api.getGitRepos().catch(() => [])
      ]);
      setCapabilities(capsRes);
      setRepos(Array.isArray(reposRes) ? reposRes : []);
    } catch (err) {
      setErrorMsg('Failed to load Git Version Control data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 6000);
    } else {
      setStatusMsg(msg);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  // Open Manage View
  const handleOpenManage = async (repo) => {
    setSelectedRepoId(repo.id);
    setViewMode('manage');
    setActiveTab('overview');
    await loadRepoDetails(repo.id, repo.relPath);
  };

  const loadRepoDetails = async (id, path) => {
    setLoadingDetails(true);
    try {
      const details = await api.getGitRepoDetails({ repoId: id, repoPath: path });
      setRepoDetails(details);
      if (details.name) {
        setDeployPath(`public_html/${details.name}`);
      }
    } catch (err) {
      showNotification('Error loading repository details: ' + err.message, true);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle Create or Clone
  const handleCreateOrClone = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    try {
      if (createMode === 'clone') {
        if (!cloneUrl.trim()) throw new Error('Please enter a Clone URL');
        const res = await api.cloneGitRepo({
          cloneUrl: cloneUrl.trim(),
          name: repoName.trim() || undefined,
          repoPath: repoPath.trim() || undefined,
          branch: defaultBranch.trim() || 'main'
        });
        showNotification(res.message || 'Repository cloned successfully!');
      } else {
        if (!repoName.trim()) throw new Error('Please enter a Repository Name');
        const res = await api.createGitRepo({
          name: repoName.trim(),
          repoPath: repoPath.trim() || undefined,
          defaultBranch: defaultBranch.trim() || 'main',
          initReadme
        });
        showNotification(res.message || 'Repository created successfully!');
      }

      // Reset form & go to list
      setRepoName('');
      setCloneUrl('');
      setRepoPath('');
      setViewMode('list');
      loadInitialData();
    } catch (err) {
      showNotification(err.message, true);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Quick Pull
  const handlePull = async (repoId, repoRelPath) => {
    try {
      const res = await api.pullGitRepo({ repoId, repoPath: repoRelPath });
      showNotification(res.message || 'Pulled latest updates from remote');
      if (viewMode === 'manage' && selectedRepoId) {
        loadRepoDetails(selectedRepoId, repoRelPath);
      } else {
        loadInitialData();
      }
    } catch (err) {
      showNotification('Pull failed: ' + err.message, true);
    }
  };

  // Handle Commit
  const handleCommit = async (e) => {
    e.preventDefault();
    if (!commitMsg.trim()) return;
    setCommitting(true);
    try {
      const res = await api.createGitCommit({
        repoId: selectedRepoId,
        repoPath: repoDetails?.relPath,
        message: commitMsg.trim(),
        authorName: authorName.trim() || undefined,
        authorEmail: authorEmail.trim() || undefined
      });
      showNotification(res.message || 'Committed successfully');
      setCommitMsg('');
      loadRepoDetails(selectedRepoId, repoDetails?.relPath);
    } catch (err) {
      showNotification('Commit failed: ' + err.message, true);
    } finally {
      setCommitting(false);
    }
  };

  // Handle Create Branch
  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      const res = await api.createGitBranch({
        repoId: selectedRepoId,
        repoPath: repoDetails?.relPath,
        branchName: newBranchName.trim(),
        checkout: checkoutNewBranch
      });
      showNotification(res.message || 'Branch created successfully');
      setNewBranchName('');
      loadRepoDetails(selectedRepoId, repoDetails?.relPath);
    } catch (err) {
      showNotification('Create branch failed: ' + err.message, true);
    }
  };

  // Handle Checkout Branch
  const handleCheckoutBranch = async (branchName) => {
    try {
      const res = await api.checkoutGitBranch({
        repoId: selectedRepoId,
        repoPath: repoDetails?.relPath,
        branchName
      });
      showNotification(res.message || `Switched to ${branchName}`);
      loadRepoDetails(selectedRepoId, repoDetails?.relPath);
    } catch (err) {
      showNotification('Switch branch failed: ' + err.message, true);
    }
  };

  // Handle Add Remote
  const handleAddRemote = async (e) => {
    e.preventDefault();
    if (!newRemoteName.trim() || !newRemoteUrl.trim()) return;
    try {
      const res = await api.addGitRemote({
        repoId: selectedRepoId,
        repoPath: repoDetails?.relPath,
        remoteName: newRemoteName.trim(),
        remoteUrl: newRemoteUrl.trim()
      });
      showNotification(res.message || 'Remote added successfully');
      setNewRemoteName('origin');
      setNewRemoteUrl('');
      setShowAddRemote(false);
      loadRepoDetails(selectedRepoId, repoDetails?.relPath);
    } catch (err) {
      showNotification('Add remote failed: ' + err.message, true);
    }
  };

  // Handle Remove Remote
  const handleRemoveRemote = async (remoteName) => {
    if (!window.confirm(`Remove remote "${remoteName}"?`)) return;
    try {
      const res = await api.removeGitRemote({
        repoId: selectedRepoId,
        repoPath: repoDetails?.relPath,
        remoteName
      });
      showNotification(res.message || 'Remote removed');
      loadRepoDetails(selectedRepoId, repoDetails?.relPath);
    } catch (err) {
      showNotification('Remove remote failed: ' + err.message, true);
    }
  };

  // Handle Deploy
  const handleDeploy = async (e) => {
    e.preventDefault();
    setDeploying(true);
    try {
      const res = await api.deployGitRepo({
        repoId: selectedRepoId,
        repoPath: repoDetails?.relPath,
        deployPath: deployPath.trim() || 'public_html'
      });
      showNotification(res.message || 'Deployed repository successfully!');
      loadRepoDetails(selectedRepoId, repoDetails?.relPath);
    } catch (err) {
      showNotification('Deploy failed: ' + err.message, true);
    } finally {
      setDeploying(false);
    }
  };

  // Handle Delete Repo
  const confirmDeleteRepo = async () => {
    if (!deleteModalRepo) return;
    try {
      const res = await api.deleteGitRepo({
        repoId: deleteModalRepo.id,
        repoPath: deleteModalRepo.relPath,
        deleteFiles
      });
      showNotification(res.message || 'Repository deleted');
      setDeleteModalRepo(null);
      setDeleteFiles(false);
      if (viewMode === 'manage') {
        setViewMode('list');
      }
      loadInitialData();
    } catch (err) {
      showNotification('Delete failed: ' + err.message, true);
    }
  };

  // Filtered Repos
  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.relPath && r.relPath.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (r.repoUrl && r.repoUrl.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Jupiter Breadcrumbs & Page Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <span>Home</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Files</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[#ff6c2c]">Git™ Version Control</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <GitBranch className="w-6 h-6 text-[#ff6c2c]" />
              Git™ Version Control
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Host and deploy Git repositories. Maintain source code version history, collaborate across branches, and deploy application updates directly to your web root.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {capabilities?.available && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Git {capabilities.version}
              </div>
            )}
            {viewMode === 'list' && (
              <button
                onClick={() => setViewMode('create')}
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Create / Clone Repository
              </button>
            )}
            {viewMode !== 'list' && (
              <button
                onClick={() => { setViewMode('list'); loadInitialData(); }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Repositories
              </button>
            )}
          </div>
        </div>

        {/* Notifications */}
        {statusMsg && (
          <div className="mt-4 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 bg-rose-50 text-rose-800 border border-rose-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Git Not Available Banner */}
      {capabilities && !capabilities.available && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-900">Git Version Control is not available on this server</h3>
            <p className="text-xs text-amber-800 mt-1">
              The Git executable could not be located in system PATH. Please contact your system administrator or host provider to install Git.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: REPOSITORY LIST */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-800">
                  Repositories ({filteredRepos.length})
                </h2>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repositories..."
                  className="w-full sm:w-64 border border-slate-300 bg-white px-3 py-1.5 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
                />
                <button
                  onClick={loadInitialData}
                  title="Refresh repository list"
                  className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#ff6c2c] mb-2" />
                Loading Git repositories...
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="p-12 text-center">
                <GitBranch className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-700">No Git Repositories Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery ? 'No repositories match your search query.' : 'You have not initialized or cloned any Git repositories yet.'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setViewMode('create')}
                    className="mt-4 bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                  >
                    Create or Clone Now
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-3 px-5">Repository Name & Path</th>
                      <th className="py-3 px-5">Branch</th>
                      <th className="py-3 px-5">Working Tree</th>
                      <th className="py-3 px-5">Last Commit</th>
                      <th className="py-3 px-5">Last Deployed</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRepos.map((repo) => (
                      <tr key={repo.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Folder className="w-4 h-4 text-[#ff6c2c]" />
                            <span>{repo.name}</span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            /{repo.relPath}
                          </div>
                          {repo.repoUrl && (
                            <div className="text-[10px] font-mono text-blue-600 truncate max-w-xs mt-0.5">
                              {repo.repoUrl}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-mono text-[11px] font-semibold border border-blue-100">
                            <GitBranch className="w-3 h-3" />
                            {repo.currentBranch || repo.branch || 'main'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          {repo.isClean !== false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                              <Check className="w-3 h-3" /> Clean
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Changes Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 max-w-xs">
                          <div className="text-slate-700 text-[11px] font-mono truncate" title={repo.lastCommit}>
                            {repo.lastCommit || 'No commits'}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          {repo.lastDeployed ? (
                            <div className="text-slate-600 text-[11px]">
                              {new Date(repo.lastDeployed).toLocaleDateString()} {new Date(repo.lastDeployed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Never</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-1.5">
                          <button
                            onClick={() => handleOpenManage(repo)}
                            className="px-2.5 py-1 bg-[#ff6c2c]/10 text-[#ff6c2c] hover:bg-[#ff6c2c] hover:text-white rounded text-[11px] font-semibold transition"
                          >
                            Manage
                          </button>
                          {repo.repoUrl && (
                            <button
                              onClick={() => handlePull(repo.id, repo.relPath)}
                              title="Pull changes from origin"
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-medium transition inline-flex items-center gap-1"
                            >
                              <DownloadCloud className="w-3 h-3" /> Pull
                            </button>
                          )}
                          <button
                            onClick={() => { setDeleteModalRepo(repo); setDeleteFiles(false); }}
                            className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px] transition"
                            title="Delete repository"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: CREATE / CLONE REPOSITORY */}
      {/* ========================================================================= */}
      {viewMode === 'create' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-3xl mx-auto">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h2 className="text-base font-bold text-slate-800">Create or Clone a Git™ Repository</h2>
            <p className="text-xs text-slate-500 mt-1">
              Initialize an empty local Git repository or clone from an existing remote server like GitHub or GitLab.
            </p>

            {/* Mode Switcher */}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setCreateMode('clone')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition border ${createMode === 'clone' ? 'bg-[#ff6c2c] text-white border-[#ff6c2c]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
              >
                Clone a Repository (Remote)
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('init')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition border ${createMode === 'init' ? 'bg-[#ff6c2c] text-white border-[#ff6c2c]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
              >
                Create a New Repository (Blank)
              </button>
            </div>
          </div>

          <form onSubmit={handleCreateOrClone} className="p-6 space-y-4">
            {createMode === 'clone' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clone URL (HTTPS / SSH) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cloneUrl}
                  onChange={(e) => {
                    setCloneUrl(e.target.value);
                    if (!repoName) {
                      const match = e.target.value.match(/\/([^/]+?)(?:\.git)?$/);
                      if (match && match[1]) setRepoName(match[1]);
                    }
                  }}
                  placeholder="https://github.com/username/project.git"
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c] font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter the remote Git repository URL. Must be public or accessible via configured deploy keys.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Repository Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-web-app"
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Branch
                </label>
                <input
                  type="text"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  placeholder="main"
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Repository Path (relative to account root)
              </label>
              <div className="flex items-center">
                <span className="bg-slate-100 border border-r-0 border-slate-300 px-3 py-2 text-xs text-slate-500 rounded-l-lg font-mono">
                  /home/user/
                </span>
                <input
                  type="text"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder={`repositories/${repoName || 'my-web-app'}`}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-r-lg focus:outline-none focus:border-[#ff6c2c] font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Leave empty to use default path: <span className="font-mono">repositories/{repoName || 'repository_name'}</span>
              </p>
            </div>

            {createMode === 'init' && (
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={initReadme}
                    onChange={(e) => setInitReadme(e.target.checked)}
                    className="rounded text-[#ff6c2c] focus:ring-0"
                  />
                  <span>Initialize with README.md and initial commit</span>
                </label>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm transition inline-flex items-center gap-2 disabled:opacity-50"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {createMode === 'clone' ? 'Clone Repository' : 'Create Repository'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: MANAGE REPOSITORY */}
      {/* ========================================================================= */}
      {viewMode === 'manage' && (
        <div className="space-y-6">
          {loadingDetails ? (
            <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#ff6c2c] mb-2" />
              Loading repository details...
            </div>
          ) : repoDetails ? (
            <>
              {/* Repo Summary Banner */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Folder className="w-5 h-5 text-[#ff6c2c]" />
                      <h2 className="text-lg font-bold text-slate-900">{repoDetails.name}</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-mono font-semibold border border-blue-200">
                        {repoDetails.currentBranch}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-2">
                      <span>Path: /{repoDetails.relPath}</span>
                      {repoDetails.repoUrl && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600 truncate max-w-sm">{repoDetails.repoUrl}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {repoDetails.remotes?.length > 0 && (
                      <button
                        onClick={() => handlePull(repoDetails.id, repoDetails.relPath)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5"
                      >
                        <DownloadCloud className="w-4 h-4" /> Pull
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab('deploy')}
                      className="px-3 py-1.5 bg-[#ff6c2c] text-white hover:bg-[#e55619] rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5"
                    >
                      <UploadCloud className="w-4 h-4" /> Deploy
                    </button>
                    <button
                      onClick={() => loadRepoDetails(selectedRepoId, repoDetails.relPath)}
                      title="Reload"
                      className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub Navigation Tabs */}
                <div className="flex border-b border-slate-200 mt-6 -mb-6 space-x-6 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${activeTab === 'overview' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <HardDrive className="w-4 h-4" /> Working Tree & Status
                  </button>
                  <button
                    onClick={() => setActiveTab('branches')}
                    className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${activeTab === 'branches' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <GitBranch className="w-4 h-4" /> Branches ({repoDetails.branches?.branches?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${activeTab === 'history' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <Clock className="w-4 h-4" /> Commit History ({repoDetails.recentCommits?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('remotes')}
                    className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${activeTab === 'remotes' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <Server className="w-4 h-4" /> Remotes ({repoDetails.remotes?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('deploy')}
                    className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${activeTab === 'deploy' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <UploadCloud className="w-4 h-4" /> Deploy to Document Root
                  </button>
                </div>
              </div>

              {/* TAB 1: OVERVIEW & WORKING TREE */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 Cols: Working Tree Changes */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-[#ff6c2c]" /> Working Tree Changes
                        </h3>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${repoDetails.status?.isClean ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {repoDetails.status?.isClean ? 'Clean' : `${repoDetails.status?.totalChanges} Modified`}
                        </span>
                      </div>

                      {repoDetails.status?.isClean ? (
                        <div className="p-8 text-center text-xs text-slate-500">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                          <p className="font-semibold text-slate-700">Working tree clean</p>
                          <p className="text-slate-400 mt-0.5">Nothing to commit, directory is in sync with HEAD.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                          {repoDetails.status?.files?.map((file, idx) => (
                            <div key={idx} className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 text-xs">
                              <span className="font-mono text-slate-800 truncate">{file.path}</span>
                              <div className="flex items-center gap-2">
                                {file.isUntracked && (
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                                    Untracked
                                  </span>
                                )}
                                {file.isModified && (
                                  <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                                    Modified
                                  </span>
                                )}
                                {file.isDeleted && (
                                  <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                                    Deleted
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Col: Commit Form */}
                  <div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                        <GitCommit className="w-4 h-4 text-[#ff6c2c]" /> Stage & Commit Changes
                      </h3>
                      <form onSubmit={handleCommit} className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Commit Message:</label>
                          <textarea
                            required
                            rows="3"
                            value={commitMsg}
                            onChange={(e) => setCommitMsg(e.target.value)}
                            placeholder="Describe changes made..."
                            className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Author Name (optional):</label>
                          <input
                            type="text"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            placeholder="cPanel User"
                            className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Author Email (optional):</label>
                          <input
                            type="email"
                            value={authorEmail}
                            onChange={(e) => setAuthorEmail(e.target.value)}
                            placeholder="admin@localhost"
                            className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={committing || repoDetails.status?.isClean}
                          className="w-full bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold py-2 rounded-lg transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                        >
                          {committing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitCommit className="w-3.5 h-3.5" />}
                          Commit Changes
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BRANCHES */}
              {activeTab === 'branches' && (
                <div className="space-y-6">
                  {/* Create Branch Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                      <Plus className="w-4 h-4 text-[#ff6c2c]" /> Create New Branch
                    </h3>
                    <form onSubmit={handleCreateBranch} className="flex flex-col sm:flex-row items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name:</label>
                        <input
                          type="text"
                          required
                          value={newBranchName}
                          onChange={(e) => setNewBranchName(e.target.value)}
                          placeholder="feature/auth-updates"
                          className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checkoutNewBranch}
                            onChange={(e) => setCheckoutNewBranch(e.target.checked)}
                            className="rounded text-[#ff6c2c] focus:ring-0"
                          />
                          <span>Checkout immediately</span>
                        </label>
                      </div>
                      <button
                        type="submit"
                        className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                      >
                        Create Branch
                      </button>
                    </form>
                  </div>

                  {/* Branches Table */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <h3 className="text-sm font-bold text-slate-800">Available Branches</h3>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                        <tr>
                          <th className="py-3 px-5">Branch Name</th>
                          <th className="py-3 px-5">Type</th>
                          <th className="py-3 px-5">Commit Hash</th>
                          <th className="py-3 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {repoDetails.branches?.branches?.map((branch, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-3 px-5">
                              <span className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                                <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                                {branch.name}
                                {branch.isCurrent && (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-sans font-semibold">
                                    Current HEAD
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <span className={`text-[11px] font-semibold ${branch.isRemote ? 'text-purple-600' : 'text-slate-600'}`}>
                                {branch.isRemote ? 'Remote Tracking' : 'Local Branch'}
                              </span>
                            </td>
                            <td className="py-3 px-5 font-mono text-slate-500">
                              {branch.commitHash || '—'}
                            </td>
                            <td className="py-3 px-5 text-right">
                              {!branch.isCurrent && !branch.isRemote && (
                                <button
                                  onClick={() => handleCheckoutBranch(branch.name)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] transition"
                                >
                                  Switch to Branch
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: COMMIT HISTORY */}
              {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">Commit History</h3>
                  </div>
                  {repoDetails.recentCommits?.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">No commits found in this repository.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {repoDetails.recentCommits?.map((commit, idx) => (
                        <div key={idx} className="p-4 hover:bg-slate-50 transition flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold text-slate-900 text-xs flex items-center gap-2">
                              <GitCommit className="w-4 h-4 text-[#ff6c2c]" />
                              <span>{commit.message}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                              <span className="font-medium text-slate-700">{commit.authorName}</span>
                              <span>•</span>
                              <span>{commit.date}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                            <span>{commit.shortHash}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(commit.hash);
                                showNotification('Commit hash copied!');
                              }}
                              title="Copy full hash"
                              className="text-slate-400 hover:text-slate-600 ml-1"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: REMOTES */}
              {activeTab === 'remotes' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Server className="w-4 h-4 text-[#ff6c2c]" /> Configured Remotes
                      </h3>
                      <button
                        onClick={() => setShowAddRemote(!showAddRemote)}
                        className="text-xs bg-[#ff6c2c] text-white px-3 py-1.5 rounded-lg hover:bg-[#e55619] font-semibold"
                      >
                        + Add Remote
                      </button>
                    </div>

                    {showAddRemote && (
                      <form onSubmit={handleAddRemote} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Remote Name:</label>
                            <input
                              type="text"
                              required
                              value={newRemoteName}
                              onChange={(e) => setNewRemoteName(e.target.value)}
                              placeholder="origin"
                              className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded-lg focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Remote URL:</label>
                            <input
                              type="text"
                              required
                              value={newRemoteUrl}
                              onChange={(e) => setNewRemoteUrl(e.target.value)}
                              placeholder="https://github.com/user/repo.git"
                              className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded-lg focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddRemote(false)}
                            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-xs bg-[#ff6c2c] text-white rounded-lg hover:bg-[#e55619] font-semibold"
                          >
                            Save Remote
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="divide-y divide-slate-100">
                      {repoDetails.remotes?.map((rem, idx) => (
                        <div key={idx} className="py-3 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-xs text-slate-900">{rem.name}</span>
                            <div className="text-[11px] font-mono text-slate-500">{rem.fetchUrl || rem.pushUrl}</div>
                          </div>
                          <div className="space-x-2">
                            <button
                              onClick={() => handleRemoveRemote(rem.name)}
                              className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: DEPLOY */}
              {activeTab === 'deploy' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <UploadCloud className="w-5 h-5 text-[#ff6c2c]" /> Deploy to Document Root
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Deploy your code from this Git repository directly into your web hosting folder (such as <span className="font-mono">public_html</span> or a subdomain). This copies all application files while safely omitting internal Git metadata (.git).
                  </p>

                  <form onSubmit={handleDeploy} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Deploy Target Path (relative to account root):
                      </label>
                      <div className="flex items-center">
                        <span className="bg-slate-100 border border-r-0 border-slate-300 px-3 py-2 text-xs text-slate-500 rounded-l-lg font-mono">
                          /home/user/
                        </span>
                        <input
                          type="text"
                          required
                          value={deployPath}
                          onChange={(e) => setDeployPath(e.target.value)}
                          placeholder="public_html"
                          className="w-full border border-slate-300 px-3 py-2 text-xs rounded-r-lg focus:outline-none focus:border-[#ff6c2c] font-mono"
                        />
                      </div>
                    </div>

                    {repoDetails.lastDeployed && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
                        <span className="font-semibold">Last Deployed:</span> {new Date(repoDetails.lastDeployed).toLocaleString()}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={deploying}
                      className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      {deploying && <RefreshCw className="w-4 h-4 animate-spin" />}
                      Deploy HEAD to /{deployPath}
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteModalRepo && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">Delete Git Repository</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to remove the Git repository configuration for <span className="font-bold text-slate-800">{deleteModalRepo.name}</span>?
                </p>

                <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteFiles}
                      onChange={(e) => setDeleteFiles(e.target.checked)}
                      className="rounded text-red-600 focus:ring-0"
                    />
                    <span className="font-semibold text-red-700">Also delete repository directory & files from disk</span>
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1 pl-5">
                    Target: /{deleteModalRepo.relPath}
                  </p>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModalRepo(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteRepo}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
