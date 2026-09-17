const fs = require('fs');
const path = require('path');

const CRON_DATA_FILE = path.resolve(__dirname, '../../data/cron/jobs.json');

function ensureCronStore() {
  const dir = path.dirname(CRON_DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CRON_DATA_FILE)) {
    const initial = {
      jobs: [
        {
          id: '1',
          minute: '0',
          hour: '*',
          day: '*',
          month: '*',
          weekday: '*',
          command: '/usr/local/bin/php /home/user/public_html/wp-cron.php >/dev/null 2>&1',
          description: 'Hourly WordPress scheduled tasks',
          created: new Date().toISOString()
        },
        {
          id: '2',
          minute: '30',
          hour: '2',
          day: '*',
          month: '*',
          weekday: '*',
          command: '/usr/bin/mysqldump -u cpanel_admin cpanel_default > /home/user/backups/daily.sql',
          description: 'Daily database backup',
          created: new Date().toISOString()
        }
      ]
    };
    fs.writeFileSync(CRON_DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

class CronService {
  constructor() {
    ensureCronStore();
  }

  _read() {
    ensureCronStore();
    return JSON.parse(fs.readFileSync(CRON_DATA_FILE, 'utf8'));
  }

  _write(data) {
    fs.writeFileSync(CRON_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  getJobs() {
    return this._read().jobs;
  }

  addJob(job) {
    const { minute = '*', hour = '*', day = '*', month = '*', weekday = '*', command, description = '' } = job;
    if (!command || !command.trim()) {
      throw new Error('Command cannot be empty');
    }
    const DANGEROUS = [/\brm\s+-rf\s+\//i, /\bmkfs\b/i, /\bdd\s+if=/i, /\bshutdown\b/i, /\breboot\b/i];
    for (const pat of DANGEROUS) {
      if (pat.test(command)) throw new Error('Command contains prohibited system calls. Operation blocked by Security Boundary.');
    }
    const data = this._read();
    const newJob = {
      id: String(Date.now()),
      minute,
      hour,
      day,
      month,
      weekday,
      command: command.trim(),
      description,
      created: new Date().toISOString()
    };
    data.jobs.push(newJob);
    this._write(data);
    return newJob;
  }

  editJob(id, updates) {
    const data = this._read();
    const idx = data.jobs.findIndex(j => j.id === String(id));
    if (idx === -1) throw new Error('Cron job not found');
    
    if (updates.command !== undefined) {
      if (!updates.command || !updates.command.trim()) {
        throw new Error('Command cannot be empty');
      }
      const DANGEROUS = [/\brm\s+-rf\s+\//i, /\bmkfs\b/i, /\bdd\s+if=/i, /\bshutdown\b/i, /\breboot\b/i];
      for (const pat of DANGEROUS) {
        if (pat.test(updates.command)) throw new Error('Command contains prohibited system calls. Operation blocked by Security Boundary.');
      }
      data.jobs[idx].command = updates.command.trim();
    }
    if (updates.minute !== undefined) data.jobs[idx].minute = updates.minute;
    if (updates.hour !== undefined) data.jobs[idx].hour = updates.hour;
    if (updates.day !== undefined) data.jobs[idx].day = updates.day;
    if (updates.month !== undefined) data.jobs[idx].month = updates.month;
    if (updates.weekday !== undefined) data.jobs[idx].weekday = updates.weekday;
    if (updates.description !== undefined) data.jobs[idx].description = updates.description;
    data.jobs[idx].updated = new Date().toISOString();
    
    this._write(data);
    return data.jobs[idx];
  }

  deleteJob(id) {
    const data = this._read();
    data.jobs = data.jobs.filter(j => j.id !== String(id));
    this._write(data);
    return { success: true, id };
  }

  testRun(id) {
    const data = this._read();
    const job = data.jobs.find(j => j.id === id);
    if (!job) throw new Error('Job not found');
    return {
      success: true,
      exitCode: 0,
      timestamp: new Date().toISOString(),
      output: `[Cron Test Output] Command '${job.command}' executed successfully with exit code 0.`
    };
  }
}

module.exports = new CronService();
