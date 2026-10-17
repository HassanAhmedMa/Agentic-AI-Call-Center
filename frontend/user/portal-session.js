/* Dashboard access is derived from the server, never a browser boolean. */
document.addEventListener('DOMContentLoaded', async () => {
  const bar = document.createElement('aside');
  bar.style.cssText = 'padding:10px 20px;background:#eff6ff;color:#0f172a;display:flex;gap:16px;align-items:center;flex-wrap:wrap;font:14px Arial';
  const label = document.createElement('span'); label.textContent = 'Checking your session / بنراجع جلسة الدخول…';bar.appendChild(label);document.body.prepend(bar);
  const base = (typeof window !== 'undefined' && window.__CLINIC_API_BASE__) ? window.__CLINIC_API_BASE__ : '';
  const creds = base ? 'include' : 'same-origin';
  try {
    const response = await fetch(`${base}/api/v1/portal/session`, {credentials: creds, cache: 'no-store'});
    if (!response.ok) { window.location.replace('auth.html');return; }
    const profile = await response.json();
    label.textContent = `${profile.first_name} · ${profile.customer_number}`;
    const notice = document.createElement('span');notice.textContent='Demo dashboard: appointment cards are not live records yet. / الصفحة تجريبية والمواعيد المعروضة مش بيانات حسابك.';bar.appendChild(notice);
    const logout=document.createElement('button');logout.textContent='Sign out / تسجيل الخروج';bar.appendChild(logout);
    logout.addEventListener('click',async()=>{
      logout.disabled=true;
      try {
        const result=await fetch(`${base}/api/v1/portal/logout`,{method:'POST',credentials: creds,headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
        if(!result.ok)throw Error();window.location.replace('auth.html');
      }catch(_){logout.disabled=false;label.textContent='Sign out failed. Try again. / حاول تسجّل خروج تاني.';}
    });
  } catch (_) { label.textContent='Session check unavailable. Reload to retry. / الخدمة مش متاحة. حدّث الصفحة.'; }
});
