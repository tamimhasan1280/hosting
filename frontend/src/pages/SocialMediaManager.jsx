import React, { useState, useEffect } from 'react';
import { 
  Share2, RefreshCw, CheckCircle2, AlertTriangle, Trash2, Send, 
  Plus, Calendar, Clock, Image, Link2, ExternalLink, X, MessageSquare,
  Shield, Check, Users, Radio, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function SocialMediaManager({ onBack, user = 'cpanel_user' }) {
  const [capabilities, setCapabilities] = useState(null);
  const [connections, setConnections] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('channels'); // 'channels' | 'posts'
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [targetPlatform, setTargetPlatform] = useState(null);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [handleInput, setHandleInput] = useState('');

  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);
  const [postContent, setPostContent] = useState('');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [channelToDisconnect, setChannelToDisconnect] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [capsRes, connRes, postsRes] = await Promise.all([
        api.getSocialCapabilities(user),
        api.getSocialConnections(user),
        api.getSocialPosts(user)
      ]);
      setCapabilities(capsRes);
      if (connRes && connRes.connections) setConnections(connRes.connections);
      if (postsRes && postsRes.posts) setPosts(postsRes.posts);
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to load social media data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleOpenConnectModal = (prov) => {
    setTargetPlatform(prov);
    setProfileNameInput(`${user} Official`);
    setHandleInput(`@${user}_${prov.id}`);
    setConnectModalOpen(true);
  };

  const handleCompleteConnect = async (e) => {
    e.preventDefault();
    if (!targetPlatform) return;
    try {
      setActionLoading(true);
      const res = await api.handleSocialOAuthCallback({
        platform: targetPlatform.id,
        code: `auth_${Date.now()}`,
        state: 'oauth_verified',
        profileData: {
          name: profileNameInput || `${user} ${targetPlatform.name}`,
          handle: handleInput || `@${user}_${targetPlatform.id}`
        },
        cpanelUser: user
      });
      if (res.success) {
        showToast(res.message || `Connected ${targetPlatform.name}`);
        setConnectModalOpen(false);
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to connect channel', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenComposeModal = () => {
    if (connections.length === 0) {
      showToast('Please connect at least one social media channel first', 'error');
      return;
    }
    setSelectedChannelIds(connections.map(c => c.id));
    setPostContent('');
    setMediaUrlInput('');
    setIsScheduled(false);
    setScheduledDateTime('');
    setComposeModalOpen(true);
  };

  const handlePublishPost = async (e) => {
    e.preventDefault();
    if (selectedChannelIds.length === 0) {
      showToast('Please select at least one channel', 'error');
      return;
    }
    if (!postContent.trim()) {
      showToast('Post content cannot be empty', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.publishSocialPost({
        channelIds: selectedChannelIds,
        content: postContent,
        mediaUrl: mediaUrlInput || null,
        scheduledFor: isScheduled && scheduledDateTime ? new Date(scheduledDateTime).toISOString() : null,
        cpanelUser: user
      });
      if (res.success) {
        showToast(res.message || 'Post submitted successfully!');
        setComposeModalOpen(false);
        loadData();
        setActiveTab('posts');
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to publish post', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!channelToDisconnect) return;
    try {
      setActionLoading(true);
      const res = await api.disconnectSocialChannel({
        connectionId: channelToDisconnect.id,
        cpanelUser: user
      });
      if (res.success) {
        showToast(res.message || 'Channel disconnected');
        setDisconnectModalOpen(false);
        setChannelToDisconnect(null);
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to disconnect channel', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPost = async (postId) => {
    try {
      setActionLoading(true);
      const res = await api.cancelSocialPost({
        postId: postId,
        cpanelUser: user
      });
      if (res.success) {
        showToast('Scheduled post cancelled');
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to cancel post', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Find min character limit among selected channels
  const minCharLimit = selectedChannelIds.reduce((min, id) => {
    const conn = connections.find(c => c.id === id);
    if (!conn) return min;
    const prov = capabilities?.providers?.find(p => p.id === conn.platform);
    if (prov && prov.charLimit) return Math.min(min, prov.charLimit);
    return min;
  }, 63206);

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
            <span className="text-slate-800 font-semibold">Social Media Management</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="w-6 h-6 text-[#ff6c2c]" />
            Social Media Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Connect marketing channels, publish posts, and schedule updates across your official social media profiles.
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
            onClick={handleOpenComposeModal}
            disabled={loading || actionLoading || connections.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#ff6c2c] hover:bg-[#e05819] text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            Compose Post
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-[#ff6c2c] rounded-lg">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{connections.length}</div>
            <div className="text-xs text-slate-500 font-medium">Connected Channels</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {posts.filter(p => p.status === 'PUBLISHED').length}
            </div>
            <div className="text-xs text-slate-500 font-medium">Published Posts</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {posts.filter(p => p.status === 'SCHEDULED').length}
            </div>
            <div className="text-xs text-slate-500 font-medium">Scheduled in Queue</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {capabilities?.providers?.length || 6}
            </div>
            <div className="text-xs text-slate-500 font-medium">Supported Platforms</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'channels'
              ? 'border-[#ff6c2c] text-[#ff6c2c]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Share2 className="w-4 h-4" />
          Platforms &amp; Connected Profiles ({connections.length})
        </button>

        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'posts'
              ? 'border-[#ff6c2c] text-[#ff6c2c]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Post History &amp; Queue ({posts.length})
        </button>
      </div>

      {/* Tab 1: Channels & Platforms */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          {/* Supported Platforms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capabilities?.providers?.map((prov) => {
              const conn = connections.find(c => c.platform === prov.id);
              const isConnected = Boolean(conn);

              return (
                <div key={prov.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900">{prov.name}</h3>
                        {isConnected ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-full">
                            Connected
                          </span>
                        ) : prov.status === 'NOT_CONFIGURED' ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold uppercase rounded-full">
                            Config Required
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-full">
                            Ready
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {isConnected ? `Active: ${conn.handle}` : 'Direct publishing & scheduling'}
                      </p>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-700">
                      <Share2 className="w-5 h-5 text-[#ff6c2c]" />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Char Limit:</span>
                      <span className="font-medium text-slate-800">{prov.charLimit?.toLocaleString()} chars</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Supported Media:</span>
                      <span className="font-medium text-slate-800">{prov.supportedMedia?.join(', ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Scheduling:</span>
                      <span className="font-medium text-slate-800">{prov.supportsScheduling ? 'Yes' : 'Immediate Only'}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    {isConnected ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setChannelToDisconnect(conn);
                            setDisconnectModalOpen(true);
                          }}
                          disabled={actionLoading}
                          className="w-full py-1.5 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs font-semibold rounded-lg transition"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenConnectModal(prov)}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#ff6c2c] hover:bg-[#e05819] text-white text-xs font-semibold rounded-lg transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Connect Channel</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Connected Profiles Details Table */}
          {connections.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Social Channel Connections
                </h3>
                <span className="text-xs text-slate-500">{connections.length} channel(s)</span>
              </div>

              <div className="divide-y divide-slate-100">
                {connections.map(c => (
                  <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{c.profileName}</span>
                        <span className="text-xs font-mono text-slate-500">{c.handle}</span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
                          {c.platformName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Connected on {new Date(c.connectedAt).toLocaleDateString()} • Token: {c.tokenExpiresAt}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setChannelToDisconnect(c);
                        setDisconnectModalOpen(true);
                      }}
                      disabled={actionLoading}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold self-start sm:self-center"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Post History & Scheduled Queue */}
      {activeTab === 'posts' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Posts &amp; Queue History
            </h3>
            <span className="text-xs text-slate-500">{posts.length} record(s)</span>
          </div>

          {posts.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No posts published yet</p>
              <p className="text-xs text-slate-400 mt-1">Click "Compose Post" to publish content to your connected profiles.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {posts.map(p => (
                <div key={p.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.status === 'PUBLISHED' ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Published
                        </span>
                      ) : p.status === 'SCHEDULED' ? (
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Scheduled
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                          {p.status}
                        </span>
                      )}

                      <span className="text-xs text-slate-500">
                        {p.channelNames?.join(', ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 font-medium line-clamp-3">
                      {p.content}
                    </p>

                    {p.mediaUrl && (
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-600">
                        <Image className="w-3.5 h-3.5" />
                        <span className="truncate max-w-sm">{p.mediaUrl}</span>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400">
                      {p.status === 'SCHEDULED' ? (
                        <span>Scheduled for: {new Date(p.scheduledFor).toLocaleString()}</span>
                      ) : (
                        <span>Published on: {new Date(p.publishedAt || p.createdAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  {p.status === 'SCHEDULED' && (
                    <button
                      onClick={() => handleCancelPost(p.id)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition self-start md:self-center"
                    >
                      Cancel Post
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Connect Channel Modal */}
      {connectModalOpen && targetPlatform && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Share2 className="w-5 h-5 text-[#ff6c2c]" />
                <h3 className="font-bold text-slate-900 text-base">Connect {targetPlatform.name}</h3>
              </div>
              <button onClick={() => setConnectModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteConnect} className="space-y-4">
              <p className="text-xs text-slate-600">
                Authorize cPanel Social Media Management to publish and schedule posts to your official <strong>{targetPlatform.name}</strong> profile.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Profile / Channel Name
                </label>
                <input
                  type="text"
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  placeholder="e.g. My Brand Official"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Handle / Username
                </label>
                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder="e.g. @mybrand"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#ff6c2c] hover:bg-[#e05819] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-60"
                >
                  Authorize &amp; Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compose Post Modal */}
      {composeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Send className="w-5 h-5 text-[#ff6c2c]" />
                <h3 className="font-bold text-slate-900 text-base">Compose Social Post</h3>
              </div>
              <button onClick={() => setComposeModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishPost} className="space-y-4">
              {/* Target Channels */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Publish to Channels
                </label>
                <div className="flex flex-wrap gap-2">
                  {connections.map(c => {
                    const isSelected = selectedChannelIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedChannelIds(prev => prev.filter(id => id !== c.id));
                          } else {
                            setSelectedChannelIds(prev => [...prev, c.id]);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          isSelected
                            ? 'bg-orange-50 border-[#ff6c2c] text-[#ff6c2c]'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                        <span>{c.platformName} ({c.handle})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Area */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Post Caption &amp; Content
                  </label>
                  <span className={`text-[11px] font-mono ${
                    postContent.length > minCharLimit ? 'text-rose-600 font-bold' : 'text-slate-400'
                  }`}>
                    {postContent.length} / {minCharLimit} chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="What would you like to announce or share across your marketing channels?"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
                />
              </div>

              {/* Media URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Media Image / Link Attachment (Optional)
                </label>
                <input
                  type="text"
                  value={mediaUrlInput}
                  onChange={(e) => setMediaUrlInput(e.target.value)}
                  placeholder="https://example.com/images/banner.jpg"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
                />
              </div>

              {/* Scheduling */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#ff6c2c]" /> Schedule for Later
                  </span>
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="rounded text-[#ff6c2c] focus:ring-[#ff6c2c]"
                  />
                </div>

                {isScheduled && (
                  <div>
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setComposeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || selectedChannelIds.length === 0 || !postContent.trim() || postContent.length > minCharLimit}
                  className="flex items-center gap-2 px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05819] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-60"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isScheduled ? 'Schedule Post' : 'Publish Now'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disconnect Modal */}
      {disconnectModalOpen && channelToDisconnect && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Disconnect Channel</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to disconnect <strong>{channelToDisconnect.platformName}</strong> ({channelToDisconnect.handle})?
              Local access tokens and authorization will be securely removed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDisconnectModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
