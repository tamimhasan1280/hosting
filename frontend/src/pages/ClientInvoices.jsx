import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FileText, X } from 'lucide-react';

export default function ClientInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    api.getClientInvoices().then(res => {
      setInvoices(res || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className='min-h-[400px] flex items-center justify-center'>
        <div className='w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-xl font-bold text-white'>Invoices & Billing</h1>
        <p className='text-xs text-purple-300/70'>Track your hosting invoices and payment status</p>
      </div>
      {invoices.length === 0 ? (
        <div className='p-12 text-center rounded-2xl bg-[#1c0830]/80 border border-purple-800/40'>
          <FileText className='w-10 h-10 text-purple-400/40 mx-auto mb-2' />
          <p className='text-xs text-purple-300/60'>No invoices have been issued yet.</p>
        </div>
      ) : (
        <div className='rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 overflow-hidden shadow-xl'>
          <table className='w-full text-left text-xs'>
            <thead className='bg-purple-950/80 text-purple-300/70 font-semibold border-b border-purple-900/50'>
              <tr>
                <th className='p-3.5'>Invoice #</th>
                <th className='p-3.5'>Date</th>
                <th className='p-3.5'>Due Date</th>
                <th className='p-3.5'>Total</th>
                <th className='p-3.5'>Status</th>
                <th className='p-3.5 text-right'>Action</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-purple-900/40'>
              {invoices.map(inv => (
                <tr key={inv.id} className='hover:bg-purple-950/30 transition'>
                  <td className='p-3.5 font-mono font-bold text-white'>{inv.invoiceNumber}</td>
                  <td className='p-3.5 text-purple-300/80'>{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className='p-3.5 text-purple-300/80'>{new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td className='p-3.5 font-bold text-white'>${inv.totalAmount}</td>
                  <td className='p-3.5'>
                    <span className={'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ' + (inv.status === 'paid' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50' : 'bg-rose-950 text-rose-300 border border-rose-700/50')}>{inv.status}</span>
                  </td>
                  <td className='p-3.5 text-right'>
                    <button onClick={() => setSelectedInvoice(inv)} className='px-3 py-1.5 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-white font-bold text-[11px] cursor-pointer'>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedInvoice && (
        <div className='fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4'>
          <div className='w-full max-w-md bg-[#1c0830] border border-purple-800/60 rounded-2xl p-6 shadow-2xl space-y-4'>
            <div className='flex items-center justify-between border-b border-purple-900/60 pb-3'>
              <h3 className='font-bold text-base text-white font-mono'>{selectedInvoice.invoiceNumber}</h3>
              <button onClick={() => setSelectedInvoice(null)} className='text-purple-400 hover:text-white cursor-pointer'><X className='w-5 h-5' /></button>
            </div>
            <div className='space-y-3 text-xs'>
              <div className='flex justify-between'><span className='text-purple-300/70'>Due Date:</span><span className='text-white font-bold'>{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span></div>
              <div className='flex justify-between'><span className='text-purple-300/70'>Status:</span><span className={'font-bold uppercase ' + (selectedInvoice.status === 'paid' ? 'text-emerald-400' : 'text-rose-400')}>{selectedInvoice.status}</span></div>
              <div className='border-t border-b border-purple-900/60 py-3 space-y-2'>
                {(selectedInvoice.items || []).map((it, idx) => (
                  <div key={idx} className='flex justify-between'><span className='text-white'>{it.description}</span><span className='font-bold text-white'>${it.amount}</span></div>
                ))}
              </div>
              <div className='flex justify-between text-base font-black'><span className='text-white'>Total:</span><span className='text-emerald-400'>${selectedInvoice.totalAmount}</span></div>
              {selectedInvoice.status === 'unpaid' && (
                <div className='p-3.5 bg-emerald-950/40 border border-emerald-700/40 rounded-xl space-y-1.5 mt-2'>
                  <p className='font-bold text-emerald-300 text-xs'>Manual Payment Verification:</p>
                  <p className='text-[11px] text-purple-200/80'>Send <strong>${selectedInvoice.totalAmount}</strong> via bKash / Nagad to <strong>01700000000</strong>. Enter or send TrxID to Admin for 1-click activation.</p>
                </div>
              )}
            </div>
            <button onClick={() => setSelectedInvoice(null)} className='w-full py-2 bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs rounded-xl cursor-pointer'>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}