const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const storageService = require('./storageService');

const GIT_DATA_FILE = path.resolve(__dirname, '../../data/git_repos.json');

function ensureGitStore() {
  const dir = path.dirname(GIT_DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(GIT_DATA_FILE)) {
    fs.writeFileSync(GIT_DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

class GitService {
  constructor() {
    ensureGitStore();
  }

  _readStore() {
    ensureGitStore();
    try {
      const content = fs.readFileSync(GIT_DATA_FILE, 'utf8');
      return JSON.parse(content || '[]');
    } catch (err) {
      return [];
    }
  }

  _writeStore(data) {
    ensureGitStore();
    fs.writeFileSync(GIT_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Run a git command safely with execFile
   */
  _runGit(args, cwd, env = {}) {
    return new Promise((resolve, reject) => {
      const gitEnv = {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
        SSH_ASKPASS: '',
        LC_ALL: 'C',
        ...env
      };

      execFile('git', args, {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        env: gitEnv,
        timeout: 60000
      }, (error, stdout, stderr) => {
        if (error) {
          const errMsg = stderr ? stderr.trim() : (error.message || 'Git execution failed');
          const err = new Error(errMsg);
          err.code = error.code;
          err.stdout = stdout;
          err.stderr = stderr;
          return reject(err);
        }
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      });
    });
  }

  /**
   * Detect Git capabilities and version
   */
  async getCapabilities() {
    try {
      const { stdout } = await this._runGit(['--version'], process.cwd());
      const versionStr = stdout.trim();
      const versionMatch = versionStr.match(/git version (\d+\.\d+\.\d+[^\s]*)/i);
      return {
        available: true,
        version: versionMatch ? versionMatch[1] : versionStr,
        rawVersion: versionStr,
        binary: 'git',
        supportedFeatures: [
          'init',
          'clone',
          'status',
          'branch',
          'checkout',
          'commit',
          'log',
          'remotes',
          'fetch',
          'pull',
          'push',
          'deploy'
        ]
      };
    } catch (err) {
      return {
        available: false,
        version: null,
        error: 'Git Version Control is not available on this server: ' + err.message,
        supportedFeatures: []
      };
    }
  }

  /**
   * Validate and resolve safe repository path inside user root
   */
  _resolveUserRepoPath(cpanelUser, userRelPath, options = {}) {
    const userRoot = storageService.getRootDir(cpanelUser || 'cpanel_user');
    if (!fs.existsSync(userRoot)) {
      fs.mkdirSync(userRoot, { recursive: true });
    }

    const cleanRel = (userRelPath || '').replace(/^[\\/]+/, '').trim();
    if (!cleanRel) {
      throw new Error('Repository path cannot be empty or root');
    }

    const fullPath = path.resolve(userRoot, cleanRel);
    const normalizedRoot = path.resolve(userRoot);

    if (!fullPath.startsWith(normalizedRoot) || fullPath === normalizedRoot) {
      throw new Error('Access denied: Path is outside or equal to user root directory');
    }

    // Relative path for storage / display
    const relativeToRoot = path.relative(normalizedRoot, fullPath).replace(/\\/g, '/');

    return {
      userRoot: normalizedRoot,
      fullPath,
      relPath: relativeToRoot
    };
  }

  /**
   * Validate remote clone URL for SSRF defense
   */
  _validateRemoteUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Repository URL is required');
    }
    const trimmed = url.trim();

    // Prevent argument injection
    if (trimmed.startsWith('-')) {
      throw new Error('Invalid repository URL: arguments not allowed');
    }

    // Support git@ / ssh / https / http / git:// / file://
    const isSsh = /^git@[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.[a-zA-Z0-9_.-]+)?$/.test(trimmed) ||
                  /^ssh:\/\//i.test(trimmed);
    const isHttp = /^https?:\/\//i.test(trimmed);
    const isGit = /^git:\/\//i.test(trimmed);
    const isFile = /^file:\/\//i.test(trimmed);

    if (!isSsh && !isHttp && !isGit && !isFile) {
      throw new Error('Invalid repository URL format. Must be HTTPS, SSH, or Git URL.');
    }

    if (isHttp || isGit) {
      try {
        const parsed = new URL(trimmed);
        const hostname = parsed.hostname.toLowerCase();

        // SSRF protection: block loopback and private ranges
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '0.0.0.0' ||
          hostname === '::1' ||
          hostname === '169.254.169.254' ||
          hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
        ) {
          throw new Error('Access denied: Remote URL cannot point to internal/private network addresses (SSRF Protection)');
        }
      } catch (err) {
        if (err.message.includes('SSRF')) throw err;
        throw new Error('Malformed repository URL');
      }
    }

    return trimmed;
  }

  /**
   * List all repositories for the given user with live disk inspection
   */
  async listRepos(cpanelUser = 'cpanel_user') {
    const store = this._readStore();
    const userRepos = store.filter(r => (r.cpanelUser || 'cpanel_user') === cpanelUser);
    const userRoot = storageService.getRootDir(cpanelUser);

    const enrichedRepos = await Promise.all(userRepos.map(async (repo) => {
      const fullPath = path.resolve(userRoot, repo.relPath);
      const existsOnDisk = fs.existsSync(fullPath);
      const isGitRepo = existsOnDisk && fs.existsSync(path.join(fullPath, '.git'));

      let currentBranch = repo.branch || 'main';
      let lastCommit = repo.lastCommit || 'No commits yet';
      let isClean = true;
      let remoteUrl = repo.repoUrl || null;

      if (isGitRepo) {
        try {
          // Get current branch
          const branchRes = await this._runGit(['rev-parse', '--abbrev-ref', 'HEAD'], fullPath).catch(() => null);
          if (branchRes && branchRes.stdout.trim()) {
            currentBranch = branchRes.stdout.trim();
          }

          // Get last commit
          const logRes = await this._runGit(['log', '-1', '--format=%h|%s|%an|%cr'], fullPath).catch(() => null);
          if (logRes && logRes.stdout.trim()) {
            const [hash, msg, author, relDate] = logRes.stdout.trim().split('|');
            lastCommit = `${hash} - ${msg} (${relDate})`;
          }

          // Check status
          const statusRes = await this._runGit(['status', '--porcelain=v1'], fullPath).catch(() => null);
          if (statusRes && statusRes.stdout.trim()) {
            isClean = false;
          }

          // Check remote if not recorded
          if (!remoteUrl) {
            const remRes = await this._runGit(['remote', 'get-url', 'origin'], fullPath).catch(() => null);
            if (remRes && remRes.stdout.trim()) {
              remoteUrl = remRes.stdout.trim();
            }
          }
        } catch (e) {
          // ignore disk inspect errors
        }
      }

      return {
        ...repo,
        fullPath,
        existsOnDisk,
        isGitRepo,
        currentBranch,
        lastCommit,
        isClean,
        remoteUrl
      };
    }));

    return enrichedRepos;
  }

  /**
   * Find a repo by id or path
   */
  _findRepoRecord(identifier, cpanelUser = 'cpanel_user') {
    const store = this._readStore();
    return store.find(r => 
      ((r.cpanelUser || 'cpanel_user') === cpanelUser) && 
      (r.id === String(identifier) || r.name === identifier || r.relPath === identifier)
    );
  }

  /**
   * Create (git init) a brand new repository
   */
  async createRepo({ name, repoPath, defaultBranch = 'main', initReadme = true, cpanelUser = 'cpanel_user' }) {
    if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(name.trim())) {
      throw new Error('Repository name must contain only letters, numbers, dashes, dots, and underscores');
    }

    const cleanName = name.trim();
    const targetRelPath = repoPath ? repoPath.trim() : `repositories/${cleanName}`;
    const { fullPath, relPath } = this._resolveUserRepoPath(cpanelUser, targetRelPath);

    // Check if repo already registered
    const existing = this._findRepoRecord(cleanName, cpanelUser);
    if (existing) {
      throw new Error(`A repository named "${cleanName}" already exists for this account`);
    }

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    // Git init
    try {
      await this._runGit(['init', '-b', defaultBranch], fullPath).catch(async () => {
        // Fallback for older git versions
        await this._runGit(['init'], fullPath);
        await this._runGit(['checkout', '-b', defaultBranch], fullPath);
      });

      // Configure repository user
      await this._runGit(['config', 'user.name', `cPanel User (${cpanelUser})`], fullPath);
      await this._runGit(['config', 'user.email', `${cpanelUser}@localhost`], fullPath);

      if (initReadme) {
        const readmePath = path.join(fullPath, 'README.md');
        if (!fs.existsSync(readmePath)) {
          fs.writeFileSync(readmePath, `# ${cleanName}\n\nManaged by cPanel Git™ Version Control\n`, 'utf8');
        }
        await this._runGit(['add', 'README.md'], fullPath);
        await this._runGit(['commit', '-m', 'Initial repository commit'], fullPath);
      }
    } catch (err) {
      throw new Error('Failed to initialize Git repository: ' + err.message);
    }

    // Get HEAD commit
    let lastCommit = 'Initial commit';
    try {
      const logRes = await this._runGit(['log', '-1', '--format=%h %s'], fullPath);
      if (logRes.stdout.trim()) lastCommit = logRes.stdout.trim();
    } catch (e) {}

    const store = this._readStore();
    const newRepo = {
      id: String(Date.now()),
      name: cleanName,
      cpanelUser: cpanelUser || 'cpanel_user',
      repoUrl: '',
      relPath,
      branch: defaultBranch,
      lastCommit,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      lastDeployed: null
    };

    store.push(newRepo);
    this._writeStore(store);

    return {
      success: true,
      message: `Git repository "${cleanName}" initialized successfully`,
      repo: {
        ...newRepo,
        fullPath,
        existsOnDisk: true,
        isGitRepo: true,
        currentBranch: defaultBranch,
        isClean: true
      }
    };
  }

  /**
   * Clone a remote repository
   */
  async cloneRepo({ cloneUrl, repoPath, name, branch = 'main', cpanelUser = 'cpanel_user' }) {
    const validUrl = this._validateRemoteUrl(cloneUrl);
    
    // Determine name from URL or argument
    let repoName = name ? name.trim() : '';
    if (!repoName) {
      const parts = validUrl.split('/');
      const lastPart = parts[parts.length - 1] || 'repository';
      repoName = lastPart.replace(/\.git$/i, '');
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(repoName)) {
      repoName = repoName.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'repo_' + Date.now();
    }

    const targetRelPath = repoPath ? repoPath.trim() : `repositories/${repoName}`;
    const { fullPath, relPath } = this._resolveUserRepoPath(cpanelUser, targetRelPath);

    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath);
      if (files.length > 0) {
        throw new Error(`Destination directory "${relPath}" already exists and is not empty`);
      }
    } else {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    const cloneArgs = ['clone', validUrl, fullPath];
    if (branch && branch !== 'main' && branch !== 'master') {
      cloneArgs.push('-b', branch);
    }

    try {
      await this._runGit(cloneArgs, path.dirname(fullPath));
      // Configure local user
      await this._runGit(['config', 'user.name', `cPanel User (${cpanelUser})`], fullPath);
      await this._runGit(['config', 'user.email', `${cpanelUser}@localhost`], fullPath);
    } catch (err) {
      // Clean up empty dir on failure
      try {
        if (fs.existsSync(fullPath) && fs.readdirSync(fullPath).length === 0) {
          fs.rmdirSync(fullPath);
        }
      } catch (e) {}
      throw new Error('Git clone failed: ' + err.message);
    }

    // Inspect cloned repo branch and commit
    let activeBranch = branch || 'main';
    let lastCommit = 'Cloned repository';
    try {
      const branchRes = await this._runGit(['rev-parse', '--abbrev-ref', 'HEAD'], fullPath);
      if (branchRes.stdout.trim()) activeBranch = branchRes.stdout.trim();
      const logRes = await this._runGit(['log', '-1', '--format=%h %s'], fullPath);
      if (logRes.stdout.trim()) lastCommit = logRes.stdout.trim();
    } catch (e) {}

    const store = this._readStore();
    const newRepo = {
      id: String(Date.now()),
      name: repoName,
      cpanelUser: cpanelUser || 'cpanel_user',
      repoUrl: validUrl,
      relPath,
      branch: activeBranch,
      lastCommit,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      lastDeployed: null
    };

    store.push(newRepo);
    this._writeStore(store);

    return {
      success: true,
      message: `Cloned repository "${repoName}" successfully`,
      repo: {
        ...newRepo,
        fullPath,
        existsOnDisk: true,
        isGitRepo: true,
        currentBranch: activeBranch,
        isClean: true
      }
    };
  }

  /**
   * Helper to locate and verify repository on disk
   */
  _getVerifiedRepoDir(repoId, repoPath, cpanelUser) {
    let resolvedRelPath = repoPath;
    let repoRecord = null;

    if (repoId) {
      repoRecord = this._findRepoRecord(repoId, cpanelUser);
      if (repoRecord) {
        resolvedRelPath = repoRecord.relPath;
      }
    }

    if (!resolvedRelPath && !repoRecord) {
      throw new Error('Repository ID or path is required');
    }

    const { fullPath, relPath } = this._resolveUserRepoPath(cpanelUser, resolvedRelPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Repository directory "${relPath}" does not exist on disk`);
    }

    const gitDir = path.join(fullPath, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error(`Directory "${relPath}" is not a valid Git repository (missing .git directory)`);
    }

    return { fullPath, relPath, repoRecord };
  }

  /**
   * Get complete details of a single repository
   */
  async getRepoDetails({ repoId, repoPath, cpanelUser = 'cpanel_user' }) {
    const { fullPath, relPath, repoRecord } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);

    const [status, branches, remotes, commits, currentBranchRes] = await Promise.all([
      this.getStatus({ repoPath: relPath, cpanelUser }),
      this.getBranches({ repoPath: relPath, cpanelUser }),
      this.getRemotes({ repoPath: relPath, cpanelUser }),
      this.getCommits({ repoPath: relPath, limit: 15, cpanelUser }),
      this._runGit(['rev-parse', '--abbrev-ref', 'HEAD'], fullPath).catch(() => ({ stdout: 'main' }))
    ]);

    const activeBranch = currentBranchRes.stdout.trim() || 'main';

    return {
      id: repoRecord ? repoRecord.id : null,
      name: repoRecord ? repoRecord.name : path.basename(relPath),
      relPath,
      fullPath,
      cpanelUser,
      repoUrl: repoRecord ? repoRecord.repoUrl : (remotes[0] ? remotes[0].fetchUrl : ''),
      currentBranch: activeBranch,
      created: repoRecord ? repoRecord.created : null,
      lastUpdated: repoRecord ? repoRecord.lastUpdated : null,
      lastDeployed: repoRecord ? repoRecord.lastDeployed : null,
      status,
      branches,
      remotes,
      recentCommits: commits
    };
  }

  /**
   * Get working tree status
   */
  async getStatus({ repoId, repoPath, cpanelUser = 'cpanel_user' }) {
    const { fullPath } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);
    const { stdout } = await this._runGit(['status', '--porcelain=v1'], fullPath);

    const files = [];
    const lines = stdout.split('\n').filter(Boolean);

    for (const line of lines) {
      const indexCode = line.substring(0, 1);
      const workTreeCode = line.substring(1, 2);
      const filePath = line.substring(3).trim();

      files.push({
        path: filePath,
        indexCode,
        workTreeCode,
        isStaged: indexCode !== ' ' && indexCode !== '?',
        isUntracked: indexCode === '?' || workTreeCode === '?',
        isModified: workTreeCode === 'M' || indexCode === 'M',
        isDeleted: workTreeCode === 'D' || indexCode === 'D'
      });
    }

    return {
      isClean: files.length === 0,
      totalChanges: files.length,
      stagedCount: files.filter(f => f.isStaged).length,
      unstagedCount: files.filter(f => !f.isStaged).length,
      files
    };
  }

  /**
   * Get branches (local and remote)
   */
  async getBranches({ repoId, repoPath, cpanelUser = 'cpanel_user' }) {
    const { fullPath } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);
    
    // Get HEAD
    const headRes = await this._runGit(['rev-parse', '--abbrev-ref', 'HEAD'], fullPath).catch(() => ({ stdout: 'main' }));
    const currentBranch = headRes.stdout.trim();

    // List all branches
    const branchRes = await this._runGit(['branch', '-a', '--format=%(refname:short)|%(objectname:short)|%(HEAD)'], fullPath);
    const lines = branchRes.stdout.split('\n').filter(Boolean);

    const branches = [];
    for (const line of lines) {
      const [name, commitHash, isHead] = line.split('|');
      const isRemote = name.startsWith('origin/') || name.includes('/');
      branches.push({
        name: name.trim(),
        commitHash: (commitHash || '').trim(),
        isCurrent: isHead === '*' || name.trim() === currentBranch,
        isRemote
      });
    }

    return {
      currentBranch,
      branches
    };
  }

  /**
   * Create a new branch
   */
  async createBranch({ repoId, repoPath, branchName, checkout = false, cpanelUser = 'cpanel_user' }) {
    if (!branchName || typeof branchName !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(branchName.trim())) {
      throw new Error('Invalid branch name. Only letters, numbers, slashes, dashes, and underscores are allowed.');
    }
    const cleanBranch = branchName.trim();
    const { fullPath, repoRecord } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);

    if (checkout) {
      await this._runGit(['checkout', '-b', cleanBranch], fullPath);
    } else {
      await this._runGit(['branch', cleanBranch], fullPath);
    }

    if (repoRecord && checkout) {
      const store = this._readStore();
      const r = store.find(x => x.id === repoRecord.id);
      if (r) {
        r.branch = cleanBranch;
        r.lastUpdated = new Date().toISOString();
        this._writeStore(store);
      }
    }

    return {
      success: true,
      message: `Branch "${cleanBranch}" created ${checkout ? 'and checked out ' : ''}successfully`,
      branch: cleanBranch,
      isCheckedOut: !!checkout
    };
  }

  /**
   * Switch / Checkout branch
   */
  async checkoutBranch({ repoId, repoPath, branchName, create = false, cpanelUser = 'cpanel_user' }) {
    if (!branchName || typeof branchName !== 'string') {
      throw new Error('Branch name is required');
    }
    const cleanBranch = branchName.trim();
    const { fullPath, repoRecord } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);

    const args = ['checkout'];
    if (create) args.push('-b');
    args.push(cleanBranch);

    await this._runGit(args, fullPath);

    if (repoRecord) {
      const store = this._readStore();
      const r = store.find(x => x.id === repoRecord.id);
      if (r) {
        r.branch = cleanBranch;
        r.lastUpdated = new Date().toISOString();
        this._writeStore(store);
      }
    }

    return {
      success: true,
      message: `Switched to branch "${cleanBranch}"`,
      branch: cleanBranch
    };
  }

  /**
   * Get Commit history
   */
  async getCommits({ repoId, repoPath, limit = 50, branch, cpanelUser = 'cpanel_user' }) {
    const { fullPath } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);

    const args = ['log', `-n${parsedLimit}`, '--format=%H|%h|%an|%ae|%ad|%s', '--date=iso'];
    if (branch && typeof branch === 'string') {
      args.push(branch.trim());
    }

    try {
      const { stdout } = await this._runGit(args, fullPath);
      const lines = stdout.split('\n').filter(Boolean);

      const commits = lines.map(line => {
        const [hash, shortHash, authorName, authorEmail, date, ...msgParts] = line.split('|');
        return {
          hash: hash.trim(),
          shortHash: shortHash.trim(),
          authorName: authorName.trim(),
          authorEmail: authorEmail.trim(),
          date: date.trim(),
          message: msgParts.join('|').trim()
        };
      });

      return commits;
    } catch (err) {
      // Empty repo has no commits
      if (err.message.includes('does not have any commits') || err.message.includes('fatal: your current branch')) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Create a new commit
   */
  async createCommit({ repoId, repoPath, message, authorName, authorEmail, files = ['.'], cpanelUser = 'cpanel_user' }) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Commit message is required');
    }
    const cleanMsg = message.trim();
    const { fullPath, repoRecord } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);

    // Stage files
    const stageArgs = ['add'];
    if (Array.isArray(files) && files.length > 0) {
      stageArgs.push(...files);
    } else {
      stageArgs.push('.');
    }
    await this._runGit(stageArgs, fullPath);

    // Commit
    const commitArgs = ['commit', '-m', cleanMsg];
    const name = authorName || `cPanel User (${cpanelUser})`;
    const email = authorEmail || `${cpanelUser}@localhost`;
    commitArgs.push(`--author=${name} <${email}>`);

    const commitRes = await this._runGit(commitArgs, fullPath);

    // Get new HEAD
    let lastCommit = cleanMsg;
    try {
      const logRes = await this._runGit(['log', '-1', '--format=%h %s'], fullPath);
      if (logRes.stdout.trim()) lastCommit = logRes.stdout.trim();
    } catch (e) {}

    if (repoRecord) {
      const store = this._readStore();
      const r = store.find(x => x.id === repoRecord.id);
      if (r) {
        r.lastCommit = lastCommit;
        r.lastUpdated = new Date().toISOString();
        this._writeStore(store);
      }
    }

    return {
      success: true,
      message: `Changes committed successfully: ${lastCommit}`,
      lastCommit,
      output: commitRes.stdout
    };
  }

  /**
   * Get remotes
   */
  async getRemotes({ repoId, repoPath, cpanelUser = 'cpanel_user' }) {
    const { fullPath } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);
    const { stdout } = await this._runGit(['remote', '-v'], fullPath);

    const map = {};
    const lines = stdout.split('\n').filter(Boolean);

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const [name, url, type] = parts;
        if (!map[name]) map[name] = { name, fetchUrl: '', pushUrl: '' };
        if (type.includes('fetch')) map[name].fetchUrl = url;
        if (type.includes('push')) map[name].pushUrl = url;
      }
    }

    return Object.values(map);
  }

  /**
   * Add a remote
   */
  async addRemote({ repoId, repoPath, remoteName = 'origin', remoteUrl, cpanelUser = 'cpanel_user' }) {
    if (!remoteName || !/^[a-zA-Z0-9_.-]+$/.test(remoteName.trim())) {
      throw new Error('Invalid remote name');
    }
    const validUrl = this._validateRemoteUrl(remoteUrl);
    const { fullPath, repoRecord } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);

    await this._runGit(['remote', 'add', remoteName.trim(), validUrl], fullPath);

    if (repoRecord && (!repoRecord.repoUrl || remoteName === 'origin')) {
      const store = this._readStore();
      const r = store.find(x => x.id === repoRecord.id);
      if (r) {
        r.repoUrl = validUrl;
        r.lastUpdated = new Date().toISOString();
        this._writeStore(store);
      }
    }

    return {
      success: true,
      message: `Remote "${remoteName}" added successfully`,
      remoteName: remoteName.trim(),
      remoteUrl: validUrl
    };
  }

  /**
   * Remove a remote
   */
  async removeRemote({ repoId, repoPath, remoteName, cpanelUser = 'cpanel_user' }) {
    if (!remoteName) throw new Error('Remote name is required');
    const { fullPath } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);

    await this._runGit(['remote', 'remove', remoteName.trim()], fullPath);

    return {
      success: true,
      message: `Remote "${remoteName}" removed successfully`
    };
  }

  /**
   * Fetch from remote
   */
  async fetchRemote({ repoId, repoPath, remoteName = 'origin', cpanelUser = 'cpanel_user' }) {
    const { fullPath } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);
    const { stdout, stderr } = await this._runGit(['fetch', remoteName.trim()], fullPath);

    return {
      success: true,
      message: `Fetched updates from remote "${remoteName}"`,
      output: stdout || stderr || 'Up to date'
    };
  }

  /**
   * Pull from remote
   */
  async pullRemote({ repoId, repoPath, remoteName = 'origin', branchName, cpanelUser = 'cpanel_user' }) {
    const { fullPath, repoRecord } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);
    const args = ['pull', remoteName.trim()];
    if (branchName && typeof branchName === 'string') {
      args.push(branchName.trim());
    }

    const { stdout, stderr } = await this._runGit(args, fullPath);

    // Update last commit
    let lastCommit = '';
    try {
      const logRes = await this._runGit(['log', '-1', '--format=%h %s'], fullPath);
      if (logRes.stdout.trim()) lastCommit = logRes.stdout.trim();
    } catch (e) {}

    if (repoRecord) {
      const store = this._readStore();
      const r = store.find(x => x.id === repoRecord.id);
      if (r) {
        if (lastCommit) r.lastCommit = lastCommit;
        r.lastUpdated = new Date().toISOString();
        this._writeStore(store);
      }
    }

    return {
      success: true,
      message: `Pulled latest changes successfully: ${stdout || stderr || 'Already up to date.'}`,
      output: stdout || stderr
    };
  }

  /**
   * Push to remote
   */
  async pushRemote({ repoId, repoPath, remoteName = 'origin', branchName, cpanelUser = 'cpanel_user' }) {
    const { fullPath } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);
    const args = ['push', remoteName.trim()];
    if (branchName && typeof branchName === 'string') {
      args.push(branchName.trim());
    }

    const { stdout, stderr } = await this._runGit(args, fullPath);

    return {
      success: true,
      message: `Pushed changes to remote "${remoteName}" successfully`,
      output: stdout || stderr
    };
  }

  /**
   * Deploy repository files to document root (e.g. public_html)
   */
  async deployRepo({ repoId, repoPath, deployPath, clean = false, cpanelUser = 'cpanel_user' }) {
    const { fullPath, repoRecord } = this._getVerifiedRepoDir(repoId, repoPath, cpanelUser);
    const targetDeployRel = deployPath ? deployPath.trim() : 'public_html';

    const { fullPath: deployFullPath, relPath: deployRelPath } = this._resolveUserRepoPath(cpanelUser, targetDeployRel);

    if (deployFullPath === fullPath) {
      throw new Error('Deploy destination cannot be the repository directory itself');
    }

    if (!fs.existsSync(deployFullPath)) {
      fs.mkdirSync(deployFullPath, { recursive: true });
    }

    // Copy directory recursively excluding .git
    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.git') continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    copyRecursive(fullPath, deployFullPath);

    const now = new Date().toISOString();
    if (repoRecord) {
      const store = this._readStore();
      const r = store.find(x => x.id === repoRecord.id);
      if (r) {
        r.lastDeployed = now;
        r.lastUpdated = now;
        this._writeStore(store);
      }
    }

    return {
      success: true,
      message: `Repository files successfully deployed to "${deployRelPath}"`,
      deployPath: deployRelPath,
      deployedAt: now
    };
  }

  /**
   * Delete repository configuration and optionally delete files
   */
  async deleteRepo({ repoId, repoPath, deleteFiles = false, cpanelUser = 'cpanel_user' }) {
    const store = this._readStore();
    let repoRecord = null;
    let targetRelPath = repoPath;

    if (repoId) {
      repoRecord = store.find(r => (r.cpanelUser || 'cpanel_user') === cpanelUser && r.id === String(repoId));
      if (repoRecord) {
        targetRelPath = repoRecord.relPath;
      }
    }

    // Filter from store
    const updatedStore = store.filter(r => !(
      (r.cpanelUser || 'cpanel_user') === cpanelUser && 
      (r.id === String(repoId) || (targetRelPath && r.relPath === targetRelPath))
    ));
    this._writeStore(updatedStore);

    if (deleteFiles && targetRelPath) {
      try {
        const { fullPath, relPath, userRoot } = this._resolveUserRepoPath(cpanelUser, targetRelPath);
        
        // Critical safety checks: Never delete user root, public_html root, or outside sandbox
        const normalizedUserRoot = path.resolve(userRoot);
        const normalizedPublicHtml = path.resolve(userRoot, 'public_html');

        if (fullPath === normalizedUserRoot || fullPath === normalizedPublicHtml) {
          throw new Error('Safety protection: Cannot delete account root or primary public_html folder');
        }

        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      } catch (err) {
        return {
          success: true,
          message: `Repository record removed, but file deletion had warning: ${err.message}`,
          fileDeletionWarning: err.message
        };
      }
    }

    return {
      success: true,
      message: 'Repository deleted successfully',
      id: repoId
    };
  }
}

module.exports = new GitService();
