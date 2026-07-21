const cfRead=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
const cfWrite=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const cfMoney=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n||0));
const cfUid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());
const cfToday=()=>new Date().toISOString().slice(0,10);

function mountCashflow(){
  if(document.getElementById('cashflow-fab'))return;
  const btn=document.createElement('button');btn.id='cashflow-fab';btn.textContent='Nakit Akışı';btn.onclick=openCashflow;document.body.appendChild(btn);
}

function cashflowData(until){
  const balances=cfRead('cashflowBalances')[0]||{cash:0,bank:0};
  const plans=cfRead('cashflowPlans').filter(x=>!x.cancelled&&x.date<=until);
  const collections=cfRead('collections').filter(x=>!x.cancelled&&x.date<=until);
  const finance=cfRead('financeTransactions').filter(x=>!x.cancelled&&x.date<=until&&x.paymentStatus==='paid');
  const accruals=cfRead('accruals').filter(x=>x.status!=='cancelled_accrual'&&(x.date||x.period||'')<=until);
  const paidByAccrual=id=>collections.filter(x=>x.accrualId===id).reduce((s,x)=>s+Number(x.amount||0),0);
  const expected=accruals.reduce((s,a)=>s+Math.max(0,Number(a.amount||0)-paidByAccrual(a.id)),0);
  const actualIn=collections.reduce((s,x)=>s+Number(x.amount||0),0)+finance.filter(x=>['income','other_income'].includes(x.type)).reduce((s,x)=>s+Number(x.amount||0),0);
  const actualOut=finance.filter(x=>['expense','other_expense'].includes(x.type)).reduce((s,x)=>s+Number(x.amount||0),0);
  const plannedIn=plans.filter(x=>x.direction==='in').reduce((s,x)=>s+Number(x.amount||0),0);
  const plannedOut=plans.filter(x=>x.direction==='out').reduce((s,x)=>s+Number(x.amount||0),0);
  const opening=Number(balances.cash||0)+Number(balances.bank||0);
  return{balances,plans,collections,finance,accruals,expected,actualIn,actualOut,plannedIn,plannedOut,opening,projected:opening+actualIn-actualOut+plannedIn-plannedOut};
}

function openCashflow(){
  const overlay=document.createElement('div');overlay.className='cashflow-overlay';overlay.innerHTML='<div class="cashflow-panel"></div>';document.body.appendChild(overlay);
  renderCashflow(overlay,cfToday());
}

function renderCashflow(overlay,until){
  const d=cashflowData(until),panel=overlay.querySelector('.cashflow-panel');
  const plans=d.plans.slice().sort((a,b)=>a.date.localeCompare(b.date));
  panel.innerHTML=`<div class="cashflow-head"><div><small>NAKİT PLANLAMA</small><h2>Nakit Akışı</h2></div><button class="cashflow-close">✕</button></div><div class="cashflow-body"><div class="cashflow-toolbar"><input type="date" id="cf-date" value="${until}"><button id="cf-balance">Kasa / Banka</button><button id="cf-add">+ Plan Ekle</button></div><div class="cashflow-metrics"><article><span>Başlangıç bakiyesi</span><strong>${cfMoney(d.opening)}</strong></article><article><span>Gerçekleşen net akış</span><strong>${cfMoney(d.actualIn-d.actualOut)}</strong></article><article><span>Planlanan net akış</span><strong>${cfMoney(d.plannedIn-d.plannedOut)}</strong></article><article class="${d.projected<0?'cashflow-negative':''}"><span>${until} tahmini bakiye</span><strong>${cfMoney(d.projected)}</strong></article></div><section class="cashflow-section"><h3>Likidite Özeti</h3><div class="cashflow-metrics"><article><span>Kasa</span><strong>${cfMoney(d.balances.cash)}</strong></article><article><span>Banka</span><strong>${cfMoney(d.balances.bank)}</strong></article><article><span>Açık tahakkuklar</span><strong>${cfMoney(d.expected)}</strong></article><article><span>Planlanan ödemeler</span><strong>${cfMoney(d.plannedOut)}</strong></article></div><p class="cashflow-note">Açık tahakkuklar tahmini bakiyeye otomatik eklenmez; yalnızca planlanan giriş olarak kaydedildiğinde projeksiyona dahil edilir.</p></section><section class="cashflow-section"><h3>Planlanan Hareketler</h3><div class="cashflow-list">${plans.length?plans.map(x=>`<article class="cashflow-card ${x.direction}"><div><h4>${x.title||'Planlanan hareket'}</h4><p>${x.date} · ${x.account||'Hesap belirtilmedi'}${x.note?' · '+x.note:''}</p><button data-cf-cancel="${x.id}">İptal Et</button></div><strong>${x.direction==='in'?'+':'-'} ${cfMoney(x.amount)}</strong></article>`).join(''):'<div class="cashflow-empty">Bu tarihe kadar planlanan hareket bulunmuyor.</div>'}</div></section><section class="cashflow-section"><h3>Gerçekleşen Hareketler</h3><div class="cashflow-list">${[...d.collections.map(x=>({date:x.date,title:'Tahsilat',amount:x.amount,direction:'in',detail:x.method||''})),...d.finance.map(x=>({date:x.date,title:x.description||'Finans hareketi',amount:x.amount,direction:['income','other_income'].includes(x.type)?'in':'out',detail:''}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(x=>`<article class="cashflow-card ${x.direction}"><div><h4>${x.title}</h4><p>${x.date}${x.detail?' · '+x.detail:''}</p></div><strong>${x.direction==='in'?'+':'-'} ${cfMoney(x.amount)}</strong></article>`).join('')||'<div class="cashflow-empty">Gerçekleşen hareket bulunmuyor.</div>'}</div></section></div>`;
  panel.querySelector('.cashflow-close').onclick=()=>overlay.remove();
  panel.querySelector('#cf-date').onchange=e=>renderCashflow(overlay,e.target.value||cfToday());
  panel.querySelector('#cf-add').onclick=()=>openCashflowPlanForm(overlay,until);
  panel.querySelector('#cf-balance').onclick=()=>openCashflowBalanceForm(overlay,until);
  panel.querySelectorAll('[data-cf-cancel]').forEach(b=>b.onclick=()=>{const plans=cfRead('cashflowPlans').map(x=>x.id===b.dataset.cfCancel?{...x,cancelled:true,cancelledAt:new Date().toISOString()}:x);cfWrite('cashflowPlans',plans);renderCashflow(overlay,until)});
}

function openCashflowPlanForm(overlay,until){
  const wrap=document.createElement('div');wrap.className='cashflow-form-wrap';wrap.innerHTML=`<form class="cashflow-form"><div class="cashflow-head"><div><small>PLANLANAN HAREKET</small><h2>Nakit Akışı Ekle</h2></div><button type="button" class="cashflow-close">✕</button></div><div class="cashflow-form-grid"><label>Yön<select name="direction"><option value="in">Beklenen Tahsilat / Giriş</option><option value="out">Planlanan Ödeme / Çıkış</option></select></label><label>Tarih<input type="date" name="date" required value="${until}"></label><label class="full">Başlık<input name="title" required placeholder="Örn. Ağustos kira ödemesi"></label><label>Tutar<input type="number" min="0.01" step="0.01" name="amount" required></label><label>Hesap<select name="account"><option>Kasa</option><option>Banka</option><option>Kredi Kartı</option><option>Diğer</option></select></label><label class="full">Not<textarea name="note" rows="3"></textarea></label></div><div class="cashflow-actions"><button type="button" class="cancel">İptal</button><button class="cashflow-primary" type="submit">Kaydet</button></div></form>`;overlay.querySelector('.cashflow-panel').appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('.cashflow-close').onclick=close;wrap.querySelector('.cancel').onclick=close;wrap.querySelector('form').onsubmit=e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.currentTarget).entries()),plans=cfRead('cashflowPlans');plans.push({id:cfUid(),...x,amount:Number(x.amount),createdAt:new Date().toISOString()});cfWrite('cashflowPlans',plans);close();renderCashflow(overlay,until)};
}

function openCashflowBalanceForm(overlay,until){
  const current=cfRead('cashflowBalances')[0]||{cash:0,bank:0};const wrap=document.createElement('div');wrap.className='cashflow-form-wrap';wrap.innerHTML=`<form class="cashflow-form"><div class="cashflow-head"><div><small>AÇILIŞ BAKİYESİ</small><h2>Kasa ve Banka</h2></div><button type="button" class="cashflow-close">✕</button></div><div class="cashflow-balance-grid"><label>Kasa Bakiyesi<input type="number" step="0.01" name="cash" value="${Number(current.cash||0)}"></label><label>Banka Bakiyesi<input type="number" step="0.01" name="bank" value="${Number(current.bank||0)}"></label></div><div class="cashflow-actions"><button type="button" class="cancel">İptal</button><button class="cashflow-primary" type="submit">Kaydet</button></div></form>`;overlay.querySelector('.cashflow-panel').appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('.cashflow-close').onclick=close;wrap.querySelector('.cancel').onclick=close;wrap.querySelector('form').onsubmit=e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.currentTarget).entries());cfWrite('cashflowBalances',[{cash:Number(x.cash||0),bank:Number(x.bank||0),updatedAt:new Date().toISOString()}]);close();renderCashflow(overlay,until)};
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mountCashflow):mountCashflow();