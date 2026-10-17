/* Dashboard access is derived from the server, never a browser boolean. */
document.addEventListener('DOMContentLoaded', async () => {
  const bar = document.createElement('aside');
  bar.style.cssText = 'padding:10px 20px;background:#eff6ff;color:#0f172a;display:flex;gap:16px;align-items:center;flex-wrap:wrap;font:14px Arial';
  const label = document.createElement('span'); label.textContent = 'Checking your session / بنراجع جلسة الدخول…';bar.appendChild(label);document.body.prepend(bar);
  try {
    const response = await window.ClinicPortalAPI.request('session');
    const profile = response;
    label.textContent = `${profile.first_name} · ${profile.customer_number}`;
    const notice = document.createElement('span');notice.textContent='Demo dashboard: appointment cards are not live records yet. / الصفحة تجريبية والمواعيد المعروضة مش بيانات حسابك.';bar.appendChild(notice);
    const logout=document.createElement('button');logout.textContent='Sign out / تسجيل الخروج';bar.appendChild(logout);
    logout.addEventListener('click',async()=>{
      logout.disabled=true;
      try {
        await window.ClinicPortalAPI.request('logout',{});window.location.replace('auth.html');
      }catch(_){logout.disabled=false;label.textContent='Sign out failed. Try again. / حاول تسجّل خروج تاني.';}
    });
  } catch (error) { if (['VERIFICATION_REQUIRED','SESSION_EXPIRED'].includes(error.message)) { window.location.replace('auth.html'); return; } label.textContent='Session check unavailable. Reload to retry. / الخدمة مش متاحة. حدّث الصفحة.'; }
});
