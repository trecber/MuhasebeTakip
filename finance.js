const fRead=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
const fWrite=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const fMoney=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n||0));
const fUid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());
const fToday=()=>new Date().toISOString().slice(0,10);
const fMonth=()=>fToday().slice(0,7);
const fTypeLabel=t=>({income:'Gelir',expense:'Gider',other_income:'Diğer Gelir',other_expense:'Diğer Gider'}[t]||t);

function ensureFinanceDefaults(){
  const cats=fRead('financeCategories');
  if(cats.length)return;
  fWrite('financeCategories',[
    {id:fUid(),name:'Muhasebe Gelirleri',type:'income',parentId:null,active:true},
    {id:fUid(),name:'Danışmanlık Gelirleri',type:'income',parentId:null,active:true},
    {id:fUid(),name:'Personel Giderleri',type:'expense',parentId:null,active:true},
    {id:fUid(),name:'Ofis Giderleri',type:'expense',parentId:null,active:true},
    {id:fUid(),name:'Diğer Gelirler',type:'other_income',parentId:null,active:true},
    {id:fUid(),name:'Diğer Giderler',type:'other_expense',parentId:null,active:true}
  ]);
}

function mountFinance(){
  ensureFinanceDefaults();
  if(document.getElementById('finance-fab'))return;
  const btn=document.createElement('button');
  btn.id='finance-fab';btn.textContent='Gelir / Gider';btn.onclick=openFinance;
  document.body.appendChild(btn);
}

function descendants(categories,id){
  const direct=categories.filter(c=>c.parentId===id).map(c=>c.id);
  return direct.flatMap(x=>[x,...descendants(categories,x)]);
}

function openFinance(){
  const categories=fRead('financeCategories'),tx=fRead('financeTransactions'),accruals=fRead('accruals'),collections=fRead('collections');
  const month=localStorage.getItem('financeSelectedMonth')||fMonth();
  const monthTx=tx.filter(x=>(x.date||'').slice(0,7)===month&&!x.cancelled);
  const total=t=>monthTx.filter(x=>x.type===t).reduce((s,x)=>s+Number(x.amount||0),0);
  const income=total('income'),expense=total('expense'),otherIncome=total('other_income'),otherExpense=total('other_expense');
  const gross=income-expense,net=gross+otherIncome-otherExpense;
  const monthAccruals=accruals.filter(a=>(a.date||a.period||'').slice(0,7)===month&&a.status!=='cancelled_accrual').reduce((s,a)=>s+Number(a.amount||0),0);
  const monthCollections=collections.filter(c=>(c.date||'').slice(0,7)===month&&!c.cancelled).reduce((s,c)=>s+Number(c.amount||0),0);
  const overlay=document.createElement('div');overlay.className='finance-overlay';
  overlay.innerHTML=`<div class="finance-panel"><div class="finance-head"><div><small>FİNANS YÖNETİMİ</small><h2>Gelir / Gider ve Kâr-Zarar</h2></div><button class="finance-close">✕</button></div><div class="finance-body"><div class="finance-toolbar"><input id="finance-month" type="month" value="${month}"><div><button class="finance-category-btn">Kategoriler</button><button class="finance-add-btn">+ İşlem Ekle</button></div></div><div class="finance-metrics"><article><span>Gelir</span><strong>${fMoney(income)}</strong></article><article><span>Gider</span><strong>${fMoney(expense)}</strong></article><article><span>Brüt Kâr / Zarar</span><strong>${fMoney(gross)}</strong></article><article><span>Net Kâr / Zarar</span><strong>${fMoney(net)}</strong></article></div><div class="finance-cash-grid"><article><span>Sözleşme Tahakkuku</span><strong>${fMoney(monthAccruals)}</strong></article><article><span>Tahsil Edilen</span><strong>${fMoney(monthCollections)}</strong></article><article><span>Tahsil Edilmeyen</span><strong>${fMoney(Math.max(0,monthAccruals-monthCollections))}</strong></article></div><section class="finance-section"><h3>Aylık Özet</h3>${['income','expense','other_income','other_expense'].map(type=>renderFinanceGroup(type,categories,monthTx)).join('')}</section><section class="finance-section"><h3>İşlem Geçmişi</h3><div class="finance-list">${monthTx.length?monthTx.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>{const c=categories.find(y=>y.id===x.categoryId);return `<article class="finance-row"><div><h4>${x.description||c?.name||fTypeLabel(x.type)}</h4><p>${x.date} · ${c?.name||'Kategorisiz'} · ${x.paymentStatus==='paid'?'Nakit/Tahsil':'Vadeli/Ödenmedi'}</p></div><div><strong>${fMoney(x.amount)}</strong><button data-cancel="${x.id}">İptal</button></div></article>`}).join(''):'<div class="finance-empty">Bu ay için işlem bulunmuyor.</div>'}</div></section></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.finance-close').onclick=()=>overlay.remove();
  overlay.querySelector('#finance-month').onchange=e=>{localStorage.setItem('financeSelectedMonth',e.target.value);overlay.remove();openFinance()};
  overlay.querySelector('.finance-add-btn').onclick=()=>openFinanceEntry(overlay);
  overlay.querySelector('.finance-category-btn').onclick=()=>openFinanceCategories(overlay);
  overlay.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{if(!confirm('Bu işlem iptal edilsin mi?'))return;fWrite('financeTransactions',tx.map(x=>x.id===b.dataset.cancel?{...x,cancelled:true,cancelledAt:new Date().toISOString()}:x));overlay.remove();openFinance()});
}

function renderFinanceGroup(type,categories,tx){
  const roots=categories.filter(c=>c.type===type&&!c.parentId&&c.active!==false);
  const amountFor=id=>{const ids=[id,...descendants(categories,id)];return tx.filter(x=>ids.includes(x.categoryId)).reduce((s,x)=>s+Number(x.amount||0),0)};
  return `<div class="finance-group"><div class="finance-group-head"><strong>${fTypeLabel(type)}</strong><span>${fMoney(tx.filter(x=>x.type===type).reduce((s,x)=>s+Number(x.amount||0),0))}</span></div>${roots.length?roots.map(r=>`<div class="finance-cat-row"><span>${r.name}</span><strong>${fMoney(amountFor(r.id))}</strong></div>`).join(''):'<div class="finance-empty small">Kategori yok.</div>'}</div>`;
}

function openFinanceEntry(parent){
  const categories=fRead('financeCategories').filter(c=>c.active!==false),tx=fRead('financeTransactions');
  const wrap=document.createElement('div');wrap.className='finance-form-wrap';
  wrap.innerHTML=`<form class="finance-form"><div class="finance-head"><div><small>FİNANS İŞLEMİ</small><h2>Gelir / Gider Ekle</h2></div><button type="button" class="finance-close">✕</button></div><label>İşlem Türü<select name="type" required><option value="income">Gelir</option><option value="expense">Gider</option><option value="other_income">Diğer Gelir</option><option value="other_expense">Diğer Gider</option></select></label><label>Kategori<select name="categoryId" required></select></label><label>Tarih<input type="date" name="date" value="${fToday()}" required></label><label>Tutar<input type="number" name="amount" min="0.01" step="0.01" required></label><label>Tahsilat / Ödeme Durumu<select name="paymentStatus"><option value="paid">Nakit / Tahsil Edildi</option><option value="unpaid">Vadeli / Bekliyor</option></select></label><label>Açıklama<input name="description" required></label><label class="full">Not<textarea name="note" rows="3"></textarea></label><div class="finance-actions"><button type="button" class="cancel">İptal</button><button type="submit">Kaydet</button></div></form>`;
  parent.appendChild(wrap);
  const form=wrap.querySelector('form'),typeSel=form.elements.type,catSel=form.elements.categoryId;
  const fill=()=>{catSel.innerHTML='<option value="">Kategori seçin</option>'+categories.filter(c=>c.type===typeSel.value).map(c=>`<option value="${c.id}">${categoryPath(categories,c)}</option>`).join('')};fill();typeSel.onchange=fill;
  const close=()=>wrap.remove();wrap.querySelector('.finance-close').onclick=close;wrap.querySelector('.cancel').onclick=close;
  form.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form).entries());tx.push({id:fUid(),...d,amount:Number(d.amount),createdAt:new Date().toISOString(),cancelled:false});fWrite('financeTransactions',tx);close();parent.remove();openFinance()};
}

function categoryPath(categories,c){
  const parts=[c.name];let p=categories.find(x=>x.id===c.parentId);while(p){parts.unshift(p.name);p=categories.find(x=>x.id===p.parentId)}return parts.join(' › ');
}

function openFinanceCategories(parent){
  const categories=fRead('financeCategories');
  const wrap=document.createElement('div');wrap.className='finance-form-wrap';
  const render=()=>{wrap.innerHTML=`<div class="finance-category-panel"><div class="finance-head"><div><small>KATEGORİ YÖNETİMİ</small><h2>Gelir / Gider Kategorileri</h2></div><button class="finance-close">✕</button></div><form class="category-form"><label>Tür<select name="type"><option value="income">Gelir</option><option value="expense">Gider</option><option value="other_income">Diğer Gelir</option><option value="other_expense">Diğer Gider</option></select></label><label>Üst Kategori<select name="parentId"><option value="">Ana kategori</option>${categories.filter(c=>c.active!==false).map(c=>`<option value="${c.id}">${categoryPath(categories,c)}</option>`).join('')}</select></label><label>Yeni Kategori<input name="name" required></label><button type="submit">Ekle</button></form><div class="finance-list">${categories.filter(c=>c.active!==false).map(c=>`<article class="finance-row"><div><h4>${categoryPath(categories,c)}</h4><p>${fTypeLabel(c.type)}</p></div><button data-archive-cat="${c.id}">Arşivle</button></article>`).join('')}</div></div>`;parent.appendChild(wrap);wrap.querySelector('.finance-close').onclick=()=>wrap.remove();wrap.querySelector('.category-form').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());const parentCat=categories.find(c=>c.id===d.parentId);categories.push({id:fUid(),name:d.name,type:parentCat?.type||d.type,parentId:d.parentId||null,active:true,createdAt:new Date().toISOString()});fWrite('financeCategories',categories);wrap.remove();openFinanceCategories(parent)};wrap.querySelectorAll('[data-archive-cat]').forEach(b=>b.onclick=()=>{if(!confirm('Kategori arşivlensin mi? Eski işlemler korunur.'))return;const i=categories.findIndex(c=>c.id===b.dataset.archiveCat);if(i>=0)categories[i]={...categories[i],active:false};fWrite('financeCategories',categories);wrap.remove();openFinanceCategories(parent)})};render();
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mountFinance):mountFinance();
