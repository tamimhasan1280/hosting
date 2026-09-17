async function debugCalls() {
  const adminHeaders = {
    'Content-Type': 'application/json',
    'x-cpanel-user': 'tamimhasan1281'
  };

  const suspRes = await fetch('http://localhost:5000/api/admin/users/use_3ba4307c/status', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'suspended' })
  });
  console.log('Suspend Status:', suspRes.status, await suspRes.json());

  const approveRes = await fetch('http://localhost:5000/api/admin/orders/ord_c63c49d9/approve', {
    method: 'POST',
    headers: adminHeaders
  });
  console.log('Approve Status:', approveRes.status, await approveRes.json());

  const pkgRes = await fetch('http://localhost:5000/api/admin/packages', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Test Pkg', priceMonthly: 5 })
  });
  console.log('Pkg Status:', pkgRes.status, await pkgRes.json());
}

debugCalls();
