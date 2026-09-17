import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Clock, Plus, Trash2, Play, CheckCircle2, Terminal, Pencil, X } from 'lucide-react';

export default function CronManager() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [testOutput, setTestOutput] = useState(null);

  // Edit State
  const [editingJob, setEditingJob] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Form
  const [commonSetting, setCommonSetting] = useState('hourly');
  const [minute, setMinute] = useState('0');
  const [hour, setHour] = useState('*');
  const [day, setDay] = useState('*');
  const [month, setMonth] = useState('*');
  const [weekday, setWeekday] = useState('*');
  const [command, setCommand] = useState('/usr/local/bin/php /home/user/public_html/cron.php');
  const [description, setDescription] = useState('');

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await api.getCronJobs();
      setJobs(res);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleCommonSettingChange = (val) => {
    setCommonSetting(val);
    if (val === 'every_minute') {
      setMinute('*'); setHour('*'); setDay('*'); setMonth('*'); setWeekday('*');
    } else if (val === 'every_5_minutes') {
      setMinute('*/5'); setHour('*'); setDay('*'); setMonth('*'); setWeekday('*');
    } else if (val === 'hourly') {
      setMinute('0'); setHour('*'); setDay('*'); setMonth('*'); setWeekday('*');
    } else if (val === 'daily') {
      setMinute('0'); setHour('0'); setDay('*'); setMonth('*'); setWeekday('*');
    } else if (val === 'weekly') {
      setMinute('0'); setHour('0'); setDay('*'); setMonth('*'); setWeekday('0');
    } else if (val === 'monthly') {
      setMinute('0'); setHour('0'); setDay('1'); setMonth('*'); setWeekday('*');
    }
  };

  const handleAddJob = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;
    try {
      await api.addCronJob({ minute, hour, day, month, weekday, command, description });
      setDescription('');
      setStatusMsg('Cron job added successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
      loadJobs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStartEdit = (job) => {
    setEditingJob({
      id: job.id,
      minute: job.minute || '*',
      hour: job.hour || '*',
      day: job.day || '*',
      month: job.month || '*',
      weekday: job.weekday || '*',
      command: job.command || '',
      description: job.description || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingJob.command.trim()) {
      alert('Command cannot be empty.');
      return;
    }
    setEditLoading(true);
    try {
      await api.editCronJob(editingJob.id, {
        minute: editingJob.minute,
        hour: editingJob.hour,
        day: editingJob.day,
        month: editingJob.month,
        weekday: editingJob.weekday,
        command: editingJob.command,
        description: editingJob.description
      });
      setStatusMsg('Cron job updated successfully!');
      setEditingJob(null);
      setTimeout(() => setStatusMsg(''), 3000);
      loadJobs();
    } catch (err) {
      alert('Failed to update cron job: ' + (err.response?.data?.message || err.message));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteJob = async (id) => {
    if (!window.confirm('Are you sure you want to remove this scheduled cron job?')) return;
    try {
      await api.deleteCronJob(id);
      loadJobs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTestJob = async (id) => {
    try {
      const res = await api.testCronJob(id);
      setTestOutput(res);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 p-6 shadow-xl flex items-center justify-between text-white">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-[#ff6c2c]" />
            Cron Jobs (Automated Scheduled Tasks)
          </h1>
          <p className="text-xs text-purple-300/70 mt-1">
            Schedule automatic commands or scripts to run at specific intervals (hourly, daily, weekly, or custom).
          </p>
        </div>
        {statusMsg && (
          <div className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {statusMsg}
          </div>
        )}
      </div>

      {/* Add Cron Job Form */}
      <div className="rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 p-6 shadow-xl text-white">
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#ff6c2c]" /> Add New Cron Job
        </h2>
        <form onSubmit={handleAddJob} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-purple-200 mb-1.5">Common Settings:</label>
            <select
              value={commonSetting}
              onChange={(e) => handleCommonSettingChange(e.target.value)}
              className="w-full sm:w-80 bg-[#250c3d]/90 border border-purple-700/40 px-3.5 py-2 text-xs rounded-xl text-white focus:outline-none focus:border-purple-400"
            >
              <option value="every_minute" className="bg-[#1c0830] text-white">Once Per Minute (* * * * *)</option>
              <option value="every_5_minutes" className="bg-[#1c0830] text-white">Every 5 Minutes (*/5 * * * *)</option>
              <option value="hourly" className="bg-[#1c0830] text-white">Once Per Hour (0 * * * *)</option>
              <option value="daily" className="bg-[#1c0830] text-white">Once Per Day at Midnight (0 0 * * *)</option>
              <option value="weekly" className="bg-[#1c0830] text-white">Once Per Week (0 0 * * 0)</option>
              <option value="monthly" className="bg-[#1c0830] text-white">Once Per Month (0 0 1 * *)</option>
              <option value="custom" className="bg-[#1c0830] text-white">Custom Schedule</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-purple-300/70 mb-1">Minute</label>
              <input
                type="text"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-purple-300/70 mb-1">Hour</label>
              <input
                type="text"
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-purple-300/70 mb-1">Day</label>
              <input
                type="text"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-purple-300/70 mb-1">Month</label>
              <input
                type="text"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-purple-300/70 mb-1">Weekday</label>
              <input
                type="text"
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
                className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">Command to Execute:</label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="/usr/bin/php /home/user/public_html/cron.php"
                className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs font-mono rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">Description / Note (Optional):</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="WordPress background scheduler"
                className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition cursor-pointer"
          >
            Add New Cron Job
          </button>
        </form>
      </div>

      {/* Current Cron Jobs Table */}
      <div className="rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl overflow-hidden text-white">
        <div className="bg-[#1b082e]/95 border-b border-purple-800/40 px-6 py-3.5">
          <h2 className="text-sm font-bold text-white">Current Cron Jobs ({jobs.length})</h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-[#1f0933] text-purple-200 border-b border-purple-800/40 font-semibold">
            <tr>
              <th className="py-3 px-6">Schedule (Min Hr Day Mon Wk)</th>
              <th className="py-3 px-6">Command</th>
              <th className="py-3 px-6">Description</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-900/20">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan="4" className="py-8 text-center text-purple-300/60 font-medium">
                  No cron jobs configured yet. Use the form above to add your first task.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-purple-900/20 text-purple-100 transition">
                  <td className="py-3 px-6 font-mono font-bold text-white">
                    {job.minute} {job.hour} {job.day} {job.month} {job.weekday}
                  </td>
                  <td className="py-3 px-6 font-mono text-purple-200 truncate max-w-md">{job.command}</td>
                  <td className="py-3 px-6 text-purple-300/70">{job.description || '--'}</td>
                  <td className="py-3 px-6 text-right space-x-2">
                    <button
                      onClick={() => handleTestJob(job.id)}
                      className="px-3 py-1 bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900/80 border border-emerald-700/50 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <Play className="w-3 h-3" /> Test Run
                    </button>
                    <button
                      onClick={() => handleStartEdit(job)}
                      className="px-3 py-1 bg-amber-950/80 text-amber-300 hover:bg-amber-900/80 border border-amber-700/50 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                      title="Edit Cron Job"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="px-2.5 py-1 bg-rose-950/80 text-rose-300 hover:bg-rose-900/80 border border-rose-700/50 rounded-lg text-[11px] cursor-pointer shadow-xs transition"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Cron Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1c0830] rounded-2xl border border-purple-700/50 shadow-2xl w-full max-w-lg overflow-hidden text-left text-white">
            <div className="px-5 py-4 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#ff6c2c]" />
                <h3 className="font-bold text-sm text-white">Edit Scheduled Cron Job</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingJob(null)}
                className="text-purple-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <label className="block text-xs font-medium text-purple-300/70 mb-1">Minute</label>
                  <input
                    type="text"
                    required
                    value={editingJob.minute}
                    onChange={(e) => setEditingJob({ ...editingJob, minute: e.target.value })}
                    className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-2 py-1.5 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-purple-300/70 mb-1">Hour</label>
                  <input
                    type="text"
                    required
                    value={editingJob.hour}
                    onChange={(e) => setEditingJob({ ...editingJob, hour: e.target.value })}
                    className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-2 py-1.5 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-purple-300/70 mb-1">Day</label>
                  <input
                    type="text"
                    required
                    value={editingJob.day}
                    onChange={(e) => setEditingJob({ ...editingJob, day: e.target.value })}
                    className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-2 py-1.5 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-purple-300/70 mb-1">Month</label>
                  <input
                    type="text"
                    required
                    value={editingJob.month}
                    onChange={(e) => setEditingJob({ ...editingJob, month: e.target.value })}
                    className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-2 py-1.5 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-purple-300/70 mb-1">Weekday</label>
                  <input
                    type="text"
                    required
                    value={editingJob.weekday}
                    onChange={(e) => setEditingJob({ ...editingJob, weekday: e.target.value })}
                    className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-2 py-1.5 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">Command:</label>
                <input
                  type="text"
                  required
                  value={editingJob.command}
                  onChange={(e) => setEditingJob({ ...editingJob, command: e.target.value })}
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs font-mono rounded-xl text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">Description / Note:</label>
                <input
                  type="text"
                  value={editingJob.description}
                  onChange={(e) => setEditingJob({ ...editingJob, description: e.target.value })}
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-purple-800/40">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="px-4 py-2 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-xs font-semibold rounded-xl text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Output Modal */}
      {testOutput && (
        <div className="bg-[#10031c] border border-purple-800/60 text-emerald-400 p-5 rounded-2xl font-mono text-xs shadow-2xl space-y-2">
          <div className="flex justify-between items-center text-purple-300 border-b border-purple-900/40 pb-2">
            <span className="flex items-center gap-2 font-bold">
              <Terminal className="w-4 h-4 text-[#ff6c2c]" /> Cron Execution Result
            </span>
            <button onClick={() => setTestOutput(null)} className="text-purple-400 hover:text-white cursor-pointer">✕ Close</button>
          </div>
          <div className="py-2 text-emerald-300">{testOutput.output}</div>
          <div className="text-[10px] text-purple-400/70">Exit code: {testOutput.exitCode} | Finished at {new Date(testOutput.timestamp).toLocaleTimeString()}</div>
        </div>
      )}
    </div>
  );
}
