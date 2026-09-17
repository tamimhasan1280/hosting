import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Server, HardDrive, Cpu, Globe, Check, AlertCircle, ShoppingCart, ArrowRight, ArrowLeft, Tag, CreditCard, Shield, CheckCircle2, Lock } from 'lucide-react';

export default function NewOrderFlow({ onNavigate, initialPackage = null, initialPackageId = null }) {
  const [step, setStep] = useState(initialPackage || initialPackageId ? 2 : 1);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(initialPackage || null);
  const [billingCycle, setBillingCycle] = useState('yearly');

  // Step 2 Domain Selection State
  const [domainOption, setDomainOption] = useState('existing');
  const [domainPart, setDomainPart] = useState('');
  const [tldPart, setTldPart] = useState('com');
  const [transferDomain, setTransferDomain] = useState('');
  const [domainError, setDomainError] = useState('');
  const [validatedDomain, setValidatedDomain] = useState('');

  // Step 3 Checkout & Review State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Billing Address
  const [billing, setBilling] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: 'Road 12, Banani',
    city: 'Dhaka',
    state: 'Dhaka Division',
    postalCode: '1213',
    country: 'Bangladesh'
  });

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('pay_bkash');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [createdOrderData, setCreatedOrderData] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getClientPackages(),
      api.getPaymentMethods(),
      api.getClientDashboard()
    ]).then(([pkgs, pms, dash]) => {
      setPackages(pkgs || []);
      setPaymentMethods(pms || []);
      if (dash?.user) {
        setBilling(prev => ({
          ...prev,
          firstName: dash.user.firstName || '',
          lastName: dash.user.lastName || '',
          email: dash.user.email || '',
          phone: dash.user.phone || ''
        }));
      }

      // If initial package was passed, ensure full package object is set and jump to Step 2
      const targetId = initialPackageId || initialPackage?.id;
      if (targetId && pkgs && pkgs.length > 0) {
        const matched = pkgs.find(p => p.id === targetId) || initialPackage;
        if (matched) {
          setSelectedPackage(matched);
          setStep(2);
        }
      } else if (initialPackage) {
        setSelectedPackage(initialPackage);
        setStep(2);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [initialPackageId, initialPackage]);

  const handleDomainContinue = async (e) => {
    e.preventDefault();
    setDomainError('');
    let domainToCheck = '';
    if (domainOption === 'existing') {
      const cleanName = domainPart.trim().toLowerCase();
      const cleanTld = tldPart.trim().toLowerCase().replace(/^\./, '');
      if (!cleanName || !cleanTld) {
        setDomainError('Please enter both the domain name and TLD extension (e.g. alham . com).');
        return;
      }
      if (/^(https?:\/\/)/i.test(cleanName) || /^(https?:\/\/)/i.test(cleanTld)) {
        setDomainError('Do not include http:// or https:// in the domain name.');
        return;
      }
      if (/[\/\\]/.test(cleanName) || /[\/\\]/.test(cleanTld)) {
        setDomainError('Domain cannot contain slashes or path characters.');
        return;
      }
      if (/\s/.test(cleanName) || /\s/.test(cleanTld)) {
        setDomainError('Domain cannot contain spaces.');
        return;
      }
      domainToCheck = cleanName + '.' + cleanTld;
    } else {
      domainToCheck = transferDomain.trim().toLowerCase();
      if (!domainToCheck) {
        setDomainError('Please enter the domain name you wish to transfer.');
        return;
      }
    }
    try {
      const res = await api.validateDomain(domainToCheck, domainOption);
      if (res.valid) {
        setValidatedDomain(res.domain);
        setStep(3);
      } else {
        setDomainError(res.message || 'Invalid domain.');
      }
    } catch (err) {
      setDomainError(err.response?.data?.message || 'Domain validation failed.');
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    const base = billingCycle === 'yearly' ? selectedPackage.yearlyPrice : selectedPackage.monthlyPrice;
    try {
      const res = await api.validateCoupon(couponCode.trim(), base);
      if (res.valid) {
        setAppliedCoupon(res);
        setCouponSuccess('Coupon ' + res.code + ' applied! Discount: $' + res.discountAmount);
      } else {
        setCouponError(res.message || 'Invalid coupon.');
      }
    } catch (err) {
      setCouponError(err.response?.data?.message || 'Coupon verification failed.');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleCompleteOrder = async () => {
    setSubmittingOrder(true);
    setOrderError('');
    try {
      const res = await api.createClientOrder({
        packageId: selectedPackage.id,
        billingCycle,
        domain: validatedDomain,
        domainOption,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        billingAddress: billing,
        paymentMethodId: selectedPaymentMethod,
        additionalNotes
      });
      if (res.success) {
        setCreatedOrderData(res);
        setStep(4);
      } else {
        setOrderError(res.message || 'Order submission failed.');
      }
    } catch (err) {
      setOrderError(err.response?.data?.message || 'Failed to place order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-[500px] flex items-center justify-center'>
        <div className='w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  const basePrice = selectedPackage ? (billingCycle === 'yearly' ? selectedPackage.yearlyPrice : selectedPackage.monthlyPrice) : 0;
  const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const totalPrice = Math.max(0, Math.round((basePrice - discount) * 100) / 100);

  return (
    <div className='space-y-6 max-w-5xl mx-auto'>
      {/* Progress Bar */}
      <div className='flex items-center justify-between p-4 rounded-2xl bg-[#1b082e]/80 border border-purple-800/40 text-xs'>
        <div className='flex items-center gap-2'>
          <span className={'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ' + (step >= 1 ? 'bg-emerald-600 text-white' : 'bg-purple-950 text-purple-400')}>1</span>
          <span className={step === 1 ? 'font-bold text-white' : 'text-purple-300/70'}>Select Package</span>
        </div>
        <div className='w-12 h-0.5 bg-purple-900' />
        <div className='flex items-center gap-2'>
          <span className={'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ' + (step >= 2 ? 'bg-emerald-600 text-white' : 'bg-purple-950 text-purple-400')}>2</span>
          <span className={step === 2 ? 'font-bold text-white' : 'text-purple-300/70'}>Domain Setup</span>
        </div>
        <div className='w-12 h-0.5 bg-purple-900' />
        <div className='flex items-center gap-2'>
          <span className={'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ' + (step >= 3 ? 'bg-emerald-600 text-white' : 'bg-purple-950 text-purple-400')}>3</span>
          <span className={step === 3 ? 'font-bold text-white' : 'text-purple-300/70'}>Review & Checkout</span>
        </div>
      </div>

      {/* STEP 1: PACKAGES */}
      {step === 1 && (
        <div className='space-y-6'>
          <div className='text-center space-y-2'>
            <h1 className='text-2xl font-black text-white'>Choose Your Hosting Package</h1>
            <p className='text-xs text-purple-300/70'>NVMe SSD cPanel Web Hosting with 99.9% Uptime SLA</p>
            <div className='inline-flex items-center p-1 bg-purple-950/80 rounded-xl border border-purple-800/40 text-xs mt-3'>
              <button type='button' onClick={() => setBillingCycle('monthly')} className={'px-4 py-1.5 rounded-lg font-bold transition cursor-pointer ' + (billingCycle === 'monthly' ? 'bg-gradient-to-r from-purple-600 to-emerald-600 text-white shadow' : 'text-purple-300/70 hover:text-white')}>Monthly Billing</button>
              <button type='button' onClick={() => setBillingCycle('yearly')} className={'px-4 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ' + (billingCycle === 'yearly' ? 'bg-gradient-to-r from-purple-600 to-emerald-600 text-white shadow' : 'text-purple-300/70 hover:text-white')}>
                <span>Yearly Billing</span>
                <span className='text-[10px] px-1.5 py-0.5 bg-emerald-500 text-emerald-950 font-black rounded-full'>Save 20%</span>
              </button>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5'>
            {packages.map(pkg => {
              const price = billingCycle === 'yearly' ? pkg.yearlyPrice : pkg.monthlyPrice;
              const isSelected = selectedPackage?.id === pkg.id;
              return (
                <div key={pkg.id} className={'rounded-2xl p-5 bg-[#1c0830]/90 backdrop-blur-xl border transition-all flex flex-col justify-between shadow-xl ' + (isSelected ? 'border-emerald-500 shadow-emerald-950/40 ring-2 ring-emerald-500/20' : 'border-purple-800/40 hover:border-purple-600/60')}>
                  <div className='space-y-4'>
                    <div>
                      <span className='text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/50'>{pkg.diskSpaceGb} GB NVMe</span>
                      <h3 className='text-base font-bold text-white mt-2'>{pkg.name}</h3>
                    </div>
                    <div className='py-2'>
                      <div className='flex items-baseline gap-1'>
                        <span className='text-3xl font-black text-white'>${price}</span>
                        <span className='text-xs text-purple-300/70'>/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                      </div>
                    </div>
                    <ul className='space-y-2 text-[11.5px] text-purple-200/80 divide-y divide-purple-900/30'>
                      <li className='pt-1.5 flex items-center gap-2'><HardDrive className='w-3.5 h-3.5 text-emerald-400 shrink-0' /><span><strong>{pkg.diskSpaceGb} GB</strong> SSD Storage</span></li>
                      <li className='pt-1.5 flex items-center gap-2'><Cpu className='w-3.5 h-3.5 text-emerald-400 shrink-0' /><span><strong>{pkg.bandwidthGb} GB</strong> Bandwidth</span></li>
                      <li className='pt-1.5 flex items-center gap-2'><Globe className='w-3.5 h-3.5 text-emerald-400 shrink-0' /><span><strong>{pkg.domainLimit}</strong> Hosted Domain</span></li>
                      <li className='pt-1.5 flex items-center gap-2'><Check className='w-3.5 h-3.5 text-emerald-400 shrink-0' /><span>Free cPanel & SSL</span></li>
                    </ul>
                  </div>
                  <button type='button' onClick={() => { setSelectedPackage(pkg); setStep(2); }} className='w-full mt-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer transition'>
                    <span>Choose Package</span>
                    <ArrowRight className='w-3.5 h-3.5' />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: DOMAIN SELECTION (SPLIT UI & TRANSFER) */}
      {step === 2 && (
        <div className='max-w-2xl mx-auto space-y-6'>
          <div className='p-6 rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl space-y-5'>
            <div className='flex items-center justify-between border-b border-purple-900/50 pb-4'>
              <div>
                <h2 className='text-lg font-bold text-white'>Select Your Domain</h2>
                <p className='text-xs text-purple-300/70'>Package: <strong className='text-emerald-300'>{selectedPackage?.name}</strong></p>
              </div>
              <button type='button' onClick={() => setStep(1)} className='text-xs text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer'><ArrowLeft className='w-3.5 h-3.5' /> Change Package</button>
            </div>
            {domainError && (
              <div className='p-3 bg-rose-950/60 border border-rose-700/50 rounded-xl text-xs text-rose-300 flex items-center gap-2'>
                <AlertCircle className='w-4 h-4 shrink-0 text-rose-400' />
                <span>{domainError}</span>
              </div>
            )}
            <div className='grid grid-cols-2 gap-3'>
              <button type='button' onClick={() => { setDomainOption('existing'); setDomainError(''); }} className={'p-3 rounded-xl border text-xs font-bold text-left transition cursor-pointer ' + (domainOption === 'existing' ? 'bg-purple-950/80 border-emerald-500 text-white' : 'bg-purple-950/30 border-purple-800/40 text-purple-300/70 hover:text-white')}>
                <span className='block font-black text-white'>Use Existing Domain</span>
                <span className='text-[10px] text-purple-300/60 font-normal'>Update nameservers to point here</span>
              </button>
              <button type='button' onClick={() => { setDomainOption('transfer'); setDomainError(''); }} className={'p-3 rounded-xl border text-xs font-bold text-left transition cursor-pointer ' + (domainOption === 'transfer' ? 'bg-purple-950/80 border-emerald-500 text-white' : 'bg-purple-950/30 border-purple-800/40 text-purple-300/70 hover:text-white')}>
                <span className='block font-black text-white'>Transfer Domain</span>
                <span className='text-[10px] text-purple-300/60 font-normal'>Transfer from another registrar</span>
              </button>
            </div>
            <form onSubmit={handleDomainContinue} className='space-y-4 pt-2'>
              {domainOption === 'existing' ? (
                <div>
                  <label className='block text-xs font-semibold text-purple-200 mb-2'>Enter your existing domain name:</label>
                  {/* SPLIT UI: [ example ] . [ com ] */}
                  <div className='flex items-center gap-2 bg-[#250c3d]/90 p-2.5 rounded-xl border border-purple-800/60'>
                    <div className='flex-1'>
                      <input type='text' required value={domainPart} onChange={e => setDomainPart(e.target.value)} placeholder='alham' className='w-full px-3 py-2 bg-[#1c0830] border border-purple-700/50 rounded-lg text-sm text-white font-mono placeholder-purple-400/40 focus:outline-none focus:border-emerald-400' />
                    </div>
                    <span className='text-xl font-black text-purple-300/80 select-none'>.</span>
                    <div className='w-24'>
                      <input type='text' required value={tldPart} onChange={e => setTldPart(e.target.value)} placeholder='com' className='w-full px-3 py-2 bg-[#1c0830] border border-purple-700/50 rounded-lg text-sm text-white font-mono placeholder-purple-400/40 focus:outline-none focus:border-emerald-400 text-center' />
                    </div>
                  </div>
                  <p className='text-[11px] text-purple-300/60 mt-2'>Example: enter <strong className='text-white'>alham</strong> in the first box and <strong className='text-white'>com</strong> in the second box. Do not enter http:// or https://.</p>
                </div>
              ) : (
                <div>
                  <label className='block text-xs font-semibold text-purple-200 mb-2'>Domain name to transfer:</label>
                  <input type='text' required value={transferDomain} onChange={e => setTransferDomain(e.target.value)} placeholder='example.com' className='w-full px-4 py-2.5 bg-[#250c3d]/90 border border-purple-700/50 rounded-xl text-sm text-white font-mono placeholder-purple-400/40 focus:outline-none focus:border-emerald-400' />
                </div>
              )}
              <div className='flex items-center justify-between pt-4'>
                <button type='button' onClick={() => setStep(1)} className='px-4 py-2 text-xs font-bold text-purple-300 hover:text-white cursor-pointer'>Back</button>
                <button type='submit' className='px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 cursor-pointer transition'>
                  <span>Continue to Review</span>
                  <ArrowRight className='w-4 h-4' />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & CHECKOUT */}
      {step === 3 && (
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <div className='lg:col-span-2 space-y-6'>
            {/* Billing Address */}
            <div className='p-6 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 shadow-xl space-y-4'>
              <h3 className='font-bold text-sm text-white flex items-center gap-2'><Shield className='w-4 h-4 text-emerald-400' /><span>Billing Address Information</span></h3>
              <div className='grid grid-cols-2 gap-3 text-xs'>
                <div><label className='block text-purple-300/80 mb-1'>First Name</label><input type='text' required value={billing.firstName} onChange={e => setBilling({...billing, firstName: e.target.value})} className='w-full px-3 py-2 bg-[#250c3d]/70 border border-purple-800/50 rounded-xl text-white' /></div>
                <div><label className='block text-purple-300/80 mb-1'>Last Name</label><input type='text' required value={billing.lastName} onChange={e => setBilling({...billing, lastName: e.target.value})} className='w-full px-3 py-2 bg-[#250c3d]/70 border border-purple-800/50 rounded-xl text-white' /></div>
                <div className='col-span-2'><label className='block text-purple-300/80 mb-1'>Street Address</label><input type='text' value={billing.address} onChange={e => setBilling({...billing, address: e.target.value})} className='w-full px-3 py-2 bg-[#250c3d]/70 border border-purple-800/50 rounded-xl text-white' /></div>
                <div><label className='block text-purple-300/80 mb-1'>City</label><input type='text' value={billing.city} onChange={e => setBilling({...billing, city: e.target.value})} className='w-full px-3 py-2 bg-[#250c3d]/70 border border-purple-800/50 rounded-xl text-white' /></div>
                <div><label className='block text-purple-300/80 mb-1'>Phone</label><input type='text' value={billing.phone} onChange={e => setBilling({...billing, phone: e.target.value})} className='w-full px-3 py-2 bg-[#250c3d]/70 border border-purple-800/50 rounded-xl text-white' /></div>
              </div>
            </div>

            {/* Modular Payment Methods */}
            <div className='p-6 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 shadow-xl space-y-4'>
              <h3 className='font-bold text-sm text-white flex items-center gap-2'><CreditCard className='w-4 h-4 text-emerald-400' /><span>Payment Method</span></h3>
              <div className='space-y-3'>
                {paymentMethods.map(pm => (
                  <label key={pm.id} className={'p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition ' + (selectedPaymentMethod === pm.id ? 'bg-purple-950/80 border-emerald-500' : 'bg-[#250c3d]/40 border-purple-800/40 hover:border-purple-700/60')}>
                    <input type='radio' name='payment_method' value={pm.id} checked={selectedPaymentMethod === pm.id} onChange={() => setSelectedPaymentMethod(pm.id)} className='mt-1 text-emerald-500' />
                    <div className='space-y-1 text-xs'>
                      <p className='font-bold text-white'>{pm.name}</p>
                      <p className='text-[11.5px] text-purple-300/70'>{pm.instructions}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div className='p-6 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 shadow-xl space-y-2'>
              <label className='block font-bold text-sm text-white'>Additional Notes (Optional)</label>
              <textarea rows={3} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder='Any special deployment instructions or domain note...' className='w-full p-3 bg-[#250c3d]/70 border border-purple-800/50 rounded-xl text-xs text-white' />
            </div>
          </div>

          {/* Order Summary & Coupon */}
          <div className='space-y-6'>
            <div className='p-6 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 shadow-xl space-y-5'>
              <h3 className='font-bold text-sm text-white pb-3 border-b border-purple-900/50'>Order Summary</h3>
              <div className='space-y-3 text-xs'>
                <div className='flex justify-between'><span className='text-purple-300/70'>Package:</span><span className='font-bold text-white'>{selectedPackage?.name}</span></div>
                <div className='flex justify-between'><span className='text-purple-300/70'>Domain:</span><span className='font-mono text-emerald-300 font-semibold'>{validatedDomain}</span></div>
                <div className='flex justify-between'><span className='text-purple-300/70'>Billing Cycle:</span><span className='font-semibold text-white capitalize'>{billingCycle}</span></div>
                <div className='flex justify-between'><span className='text-purple-300/70'>Base Price:</span><span className='font-bold text-white'>${basePrice}</span></div>
                {appliedCoupon && (
                  <div className='flex justify-between text-emerald-400'><span>Discount ({appliedCoupon.code}):</span><span>-${discount}</span></div>
                )}
                <div className='pt-3 border-t border-purple-900/50 flex justify-between items-baseline'>
                  <span className='text-sm font-bold text-white'>Total Due Today:</span>
                  <span className='text-2xl font-black text-emerald-400'>${totalPrice}</span>
                </div>
              </div>

              {/* Promo Code */}
              <div className='pt-2 border-t border-purple-900/50 space-y-2'>
                <label className='block text-xs font-semibold text-purple-200'>Promotion / Coupon Code</label>
                <div className='flex gap-2'>
                  <input type='text' value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder='WELCOME10 or TAMIM50' className='flex-1 px-3 py-2 bg-[#250c3d]/70 border border-purple-800/50 rounded-xl text-xs text-white uppercase' />
                  <button type='button' onClick={handleApplyCoupon} disabled={applyingCoupon} className='px-4 py-2 bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50'>{applyingCoupon ? 'Checking...' : 'Apply'}</button>
                </div>
                {couponSuccess && <p className='text-[11px] text-emerald-400'>{couponSuccess}</p>}
                {couponError && <p className='text-[11px] text-rose-400'>{couponError}</p>}
              </div>

              {orderError && <div className='p-3 bg-rose-950/60 border border-rose-700/50 rounded-xl text-xs text-rose-300'>{orderError}</div>}

              <div className='p-3 bg-purple-950/50 border border-purple-800/40 rounded-xl text-[11px] text-purple-300/70 flex items-center gap-2'>
                <Lock className='w-3.5 h-3.5 text-emerald-400 shrink-0' />
                <span>Your IP address is logged securely for fraud prevention.</span>
              </div>

              <button type='button' onClick={handleCompleteOrder} disabled={submittingOrder} className='w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-95 disabled:opacity-50'>
                {submittingOrder ? 'Creating Order...' : 'Complete Order'}
                {!submittingOrder && <ArrowRight className='w-4 h-4' />}
              </button>

              <button type='button' onClick={() => setStep(2)} className='w-full text-center text-xs text-purple-400 hover:text-white cursor-pointer'>Edit Domain</button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: ORDER CONFIRMATION */}
      {step === 4 && (
        <div className='max-w-xl mx-auto p-8 rounded-2xl bg-[#1c0830]/90 border border-emerald-600/50 shadow-2xl text-center space-y-6'>
          <div className='w-14 h-14 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400'>
            <CheckCircle2 className='w-8 h-8' />
          </div>
          <div className='space-y-2'>
            <h2 className='text-2xl font-black text-white'>Order Submitted Successfully!</h2>
            <p className='text-xs text-purple-300/80'>Your order has been registered and is now <strong className='text-amber-400 font-bold uppercase'>Pending</strong> administrative verification.</p>
          </div>
          <div className='p-4 rounded-xl bg-purple-950/60 border border-purple-800/40 text-xs space-y-2 text-left'>
            <div className='flex justify-between'><span className='text-purple-300/70'>Order ID:</span><span className='font-mono font-bold text-white'>{createdOrderData?.order?.id}</span></div>
            <div className='flex justify-between'><span className='text-purple-300/70'>Invoice #:</span><span className='font-mono font-bold text-emerald-400'>{createdOrderData?.invoice?.invoiceNumber}</span></div>
            <div className='flex justify-between'><span className='text-purple-300/70'>Domain:</span><span className='font-mono font-bold text-white'>{createdOrderData?.order?.domain}</span></div>
            <div className='flex justify-between'><span className='text-purple-300/70'>Total:</span><span className='font-bold text-white'>${createdOrderData?.order?.totalAmount}</span></div>
            <div className='flex justify-between'><span className='text-purple-300/70'>Status:</span><span className='font-bold text-amber-400 uppercase'>Pending Approval</span></div>
          </div>
          <div className='flex items-center justify-center gap-4 pt-2'>
            <button onClick={() => onNavigate('dashboard')} className='px-5 py-2.5 rounded-xl bg-purple-900/60 hover:bg-purple-900 border border-purple-700/50 text-white font-bold text-xs cursor-pointer'>Go to Dashboard</button>
            <button onClick={() => onNavigate('invoices')} className='px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg cursor-pointer'>View Invoices</button>
          </div>
        </div>
      )}
    </div>
  );
}