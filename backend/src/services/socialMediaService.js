const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_FILE = path.resolve(__dirname, '../../data/social_config.json');
const CONNECTIONS_FILE = path.resolve(__dirname, '../../data/social_connections.json');
const POSTS_FILE = path.resolve(__dirname, '../../data/social_posts.json');

function ensureFiles() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(CONFIG_FILE)) {
    const initialConfig = {
      enabled: true,
      providers: {
        facebook: {
          id: 'facebook',
          name: 'Facebook Pages',
          icon: 'Facebook',
          enabled: true,
          charLimit: 63206,
          supportedMedia: ['image', 'video', 'link'],
          supportsScheduling: true,
          authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
          clientId: 'fb_app_cpanel_default'
        },
        instagram: {
          id: 'instagram',
          name: 'Instagram Business',
          icon: 'Instagram',
          enabled: true,
          charLimit: 2200,
          supportedMedia: ['image', 'video'],
          supportsScheduling: true,
          authUrl: 'https://api.instagram.com/oauth/authorize',
          clientId: 'ig_app_cpanel_default'
        },
        x_twitter: {
          id: 'x_twitter',
          name: 'X (formerly Twitter)',
          icon: 'Twitter',
          enabled: true,
          charLimit: 280,
          supportedMedia: ['image', 'video', 'link'],
          supportsScheduling: true,
          authUrl: 'https://twitter.com/i/oauth2/authorize',
          clientId: 'x_app_cpanel_default'
        },
        linkedin: {
          id: 'linkedin',
          name: 'LinkedIn Organization',
          icon: 'Linkedin',
          enabled: true,
          charLimit: 3000,
          supportedMedia: ['image', 'video', 'link', 'article'],
          supportsScheduling: true,
          authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
          clientId: 'li_app_cpanel_default'
        },
        youtube: {
          id: 'youtube',
          name: 'YouTube Channel',
          icon: 'Youtube',
          enabled: true,
          charLimit: 5000,
          supportedMedia: ['video'],
          supportsScheduling: true,
          authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          clientId: 'yt_app_cpanel_default'
        },
        pinterest: {
          id: 'pinterest',
          name: 'Pinterest Business',
          icon: 'Image',
          enabled: true,
          charLimit: 500,
          supportedMedia: ['image', 'link'],
          supportsScheduling: false,
          authUrl: 'https://www.pinterest.com/oauth/',
          clientId: 'pin_app_cpanel_default'
        }
      }
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(initialConfig, null, 2), 'utf8');
  }

  if (!fs.existsSync(CONNECTIONS_FILE)) {
    const initialConnections = {
      accounts: {
        'cpanel_user': {
          connections: []
        }
      }
    };
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(initialConnections, null, 2), 'utf8');
  }

  if (!fs.existsSync(POSTS_FILE)) {
    const initialPosts = {
      accounts: {
        'cpanel_user': {
          posts: []
        }
      }
    };
    fs.writeFileSync(POSTS_FILE, JSON.stringify(initialPosts, null, 2), 'utf8');
  }
}

class SocialMediaService {
  constructor() {
    ensureFiles();
    this.oauthStates = new Map(); // state -> { platform, user, createdAt }
  }

  _readConfig() {
    ensureFiles();
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      return { enabled: true, providers: {} };
    }
  }

  _readConnections() {
    ensureFiles();
    try {
      return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
    } catch (e) {
      return { accounts: {} };
    }
  }

  _writeConnections(data) {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  _readPosts() {
    ensureFiles();
    try {
      return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    } catch (e) {
      return { accounts: {} };
    }
  }

  _writePosts(data) {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  _getUserConnections(cpanelUser = 'cpanel_user') {
    const data = this._readConnections();
    if (!data.accounts[cpanelUser]) {
      data.accounts[cpanelUser] = { connections: [] };
      this._writeConnections(data);
    }
    return data.accounts[cpanelUser].connections || [];
  }

  _saveUserConnections(connections, cpanelUser = 'cpanel_user') {
    const data = this._readConnections();
    if (!data.accounts[cpanelUser]) {
      data.accounts[cpanelUser] = {};
    }
    data.accounts[cpanelUser].connections = connections;
    this._writeConnections(data);
  }

  _getUserPosts(cpanelUser = 'cpanel_user') {
    const data = this._readPosts();
    if (!data.accounts[cpanelUser]) {
      data.accounts[cpanelUser] = { posts: [] };
      this._writePosts(data);
    }
    return data.accounts[cpanelUser].posts || [];
  }

  _saveUserPosts(posts, cpanelUser = 'cpanel_user') {
    const data = this._readPosts();
    if (!data.accounts[cpanelUser]) {
      data.accounts[cpanelUser] = {};
    }
    data.accounts[cpanelUser].posts = posts;
    this._writePosts(data);
  }

  /**
   * Get overall capabilities and configured providers
   */
  getCapabilities(cpanelUser = 'cpanel_user') {
    const config = this._readConfig();
    const connections = this._getUserConnections(cpanelUser);

    const providersList = Object.values(config.providers || {}).map(prov => {
      const isConnected = connections.some(c => c.platform === prov.id && c.status === 'CONNECTED');
      const isConfigured = Boolean(prov.enabled && prov.clientId);

      let status = 'READY_TO_CONNECT';
      if (!prov.enabled) status = 'UNAVAILABLE';
      else if (!isConfigured) status = 'NOT_CONFIGURED';
      else if (isConnected) status = 'CONNECTED';

      return {
        id: prov.id,
        name: prov.name,
        icon: prov.icon,
        enabled: prov.enabled,
        status: status,
        charLimit: prov.charLimit,
        supportedMedia: prov.supportedMedia,
        supportsScheduling: prov.supportsScheduling
      };
    });

    return {
      status: config.enabled ? 'AVAILABLE' : 'UNAVAILABLE',
      providers: providersList,
      totalConnected: connections.filter(c => c.status === 'CONNECTED').length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get all connected social channels for the user (safe public metadata only)
   */
  getConnections(cpanelUser = 'cpanel_user') {
    const connections = this._getUserConnections(cpanelUser);
    // Sanitize: never return tokens
    return connections.map(c => ({
      id: c.id,
      platform: c.platform,
      platformName: c.platformName,
      profileName: c.profileName,
      handle: c.handle,
      avatarUrl: c.avatarUrl || null,
      status: c.status || 'CONNECTED',
      connectedAt: c.connectedAt,
      lastSync: c.lastSync || c.connectedAt,
      tokenExpiresAt: c.tokenExpiresAt || 'Never (Auto-refresh)'
    }));
  }

  /**
   * Initiate OAuth connection flow
   */
  initConnect(platformId, redirectUri, cpanelUser = 'cpanel_user') {
    const config = this._readConfig();
    const provider = config.providers?.[platformId];

    if (!provider) {
      throw new Error(`Unsupported social platform: ${platformId}`);
    }

    if (!provider.enabled) {
      throw new Error(`Platform ${provider.name} is currently disabled`);
    }

    // Generate secure state
    const state = crypto.randomBytes(20).toString('hex');
    this.oauthStates.set(state, {
      platform: platformId,
      user: cpanelUser,
      createdAt: Date.now()
    });

    const targetRedirect = redirectUri || 'https://example.com/cpanel/social/callback';
    const authUrl = `${provider.authUrl}?client_id=${encodeURIComponent(provider.clientId)}&redirect_uri=${encodeURIComponent(targetRedirect)}&state=${state}&response_type=code`;

    return {
      success: true,
      platform: platformId,
      state: state,
      authUrl: authUrl
    };
  }

  /**
   * Complete OAuth callback / connection
   */
  handleCallback(platformId, code, state, profileData = null, cpanelUser = 'cpanel_user') {
    const config = this._readConfig();
    const provider = config.providers?.[platformId];

    if (!provider) {
      throw new Error(`Unsupported platform: ${platformId}`);
    }

    // Validate state if provided
    if (state && this.oauthStates.has(state)) {
      const stateObj = this.oauthStates.get(state);
      if (stateObj.user !== cpanelUser || stateObj.platform !== platformId) {
        throw new Error('OAuth state mismatch: possible CSRF or session fixation attack');
      }
      this.oauthStates.delete(state);
    }

    const connections = this._getUserConnections(cpanelUser);
    const existingIndex = connections.findIndex(c => c.platform === platformId);

    const profileName = profileData?.name || `${cpanelUser} ${provider.name}`;
    const handle = profileData?.handle || `@${cpanelUser}_${platformId}`;
    const connectionId = `soc_${platformId}_${crypto.randomBytes(4).toString('hex')}`;

    const newConnection = {
      id: connectionId,
      platform: platformId,
      platformName: provider.name,
      profileName: profileName,
      handle: handle,
      avatarUrl: profileData?.avatarUrl || null,
      tokenHash: crypto.createHash('sha256').update(code || 'token_sample').digest('hex'),
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
    };

    if (existingIndex >= 0) {
      connections[existingIndex] = newConnection;
    } else {
      connections.push(newConnection);
    }

    this._saveUserConnections(connections, cpanelUser);

    return {
      success: true,
      message: `Successfully connected ${provider.name} (${handle})`,
      connection: {
        id: newConnection.id,
        platform: newConnection.platform,
        platformName: newConnection.platformName,
        profileName: newConnection.profileName,
        handle: newConnection.handle,
        status: newConnection.status,
        connectedAt: newConnection.connectedAt
      }
    };
  }

  /**
   * Disconnect a social channel
   */
  disconnectChannel(connectionId, cpanelUser = 'cpanel_user') {
    const connections = this._getUserConnections(cpanelUser);
    const targetIndex = connections.findIndex(c => c.id === connectionId);

    if (targetIndex === -1) {
      throw new Error('Social connection not found or access denied');
    }

    const removed = connections.splice(targetIndex, 1)[0];
    this._saveUserConnections(connections, cpanelUser);

    return {
      success: true,
      message: `Disconnected ${removed.platformName} (${removed.handle})`
    };
  }

  /**
   * Refresh connection status
   */
  refreshConnection(connectionId, cpanelUser = 'cpanel_user') {
    const connections = this._getUserConnections(cpanelUser);
    const conn = connections.find(c => c.id === connectionId);

    if (!conn) {
      throw new Error('Social connection not found or access denied');
    }

    conn.lastSync = new Date().toISOString();
    conn.status = 'CONNECTED';
    this._saveUserConnections(connections, cpanelUser);

    return {
      success: true,
      lastSync: conn.lastSync,
      status: conn.status
    };
  }

  /**
   * Publish or schedule a post
   */
  publishPost({ channelIds, content, mediaUrl, scheduledFor }, cpanelUser = 'cpanel_user') {
    if (!content || content.trim() === '') {
      throw new Error('Post content cannot be empty');
    }

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      throw new Error('Please select at least one connected social channel');
    }

    const connections = this._getUserConnections(cpanelUser);
    const config = this._readConfig();

    // Validate ownership of all target channels
    const targetChannels = [];
    for (const chId of channelIds) {
      const conn = connections.find(c => c.id === chId);
      if (!conn) {
        throw new Error(`Access denied: channel ID ${chId} not found`);
      }
      targetChannels.push(conn);

      // Validate character limits
      const provider = config.providers?.[conn.platform];
      if (provider && provider.charLimit && content.length > provider.charLimit) {
        throw new Error(`Content length (${content.length} chars) exceeds ${provider.name} limit of ${provider.charLimit} characters`);
      }
    }

    const isScheduled = Boolean(scheduledFor && new Date(scheduledFor).getTime() > Date.now());
    const postId = `post_${crypto.randomBytes(6).toString('hex')}`;

    const newPost = {
      id: postId,
      content: content,
      mediaUrl: mediaUrl || null,
      channelIds: channelIds,
      channelNames: targetChannels.map(c => c.platformName),
      channelHandles: targetChannels.map(c => c.handle),
      status: isScheduled ? 'SCHEDULED' : 'PUBLISHED',
      createdAt: new Date().toISOString(),
      publishedAt: isScheduled ? null : new Date().toISOString(),
      scheduledFor: isScheduled ? new Date(scheduledFor).toISOString() : null
    };

    const posts = this._getUserPosts(cpanelUser);
    posts.unshift(newPost);
    this._saveUserPosts(posts, cpanelUser);

    return {
      success: true,
      message: isScheduled ? `Post scheduled for ${new Date(scheduledFor).toLocaleString()}` : 'Post published successfully to selected channels',
      post: newPost
    };
  }

  /**
   * Get user posts list
   */
  getPosts(cpanelUser = 'cpanel_user') {
    return this._getUserPosts(cpanelUser);
  }

  /**
   * Cancel scheduled post
   */
  cancelPost(postId, cpanelUser = 'cpanel_user') {
    const posts = this._getUserPosts(cpanelUser);
    const post = posts.find(p => p.id === postId);

    if (!post) {
      throw new Error('Post not found or access denied');
    }

    if (post.status !== 'SCHEDULED') {
      throw new Error('Only scheduled posts can be cancelled');
    }

    post.status = 'CANCELLED';
    this._saveUserPosts(posts, cpanelUser);

    return {
      success: true,
      message: 'Scheduled post cancelled'
    };
  }
}

module.exports = new SocialMediaService();
