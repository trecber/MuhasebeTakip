const readLS=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
const writeLS=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const tl=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n||0));
const uidc=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());
const todayc=()=>new Date().toISOString().slice(0,10);

function mountCollections(){
  if(document.getElementById('collections-fab'))return;
  const btn=document.createElement('button');
  btn.id='collections-fab';btn.textContent='Tahsilatlar';btn.onclick=openCollections;
  document.body.appendChild(btn);
}

function openCollections(){
  const accruals=readLS('accruals'),contracts=readLS('contracts'),customers=readLS('customers'),collections=readLS('collections');
  const activeAccruals=accruals.filter(a=>a.status!=='cancelled_accrual');
  const paidFor=id=>collections.filter(x=>x.accrualId===id&&!x.cancelled).reduce((s,x)=>s+Number(x.amount||0),0);
  const remaining=a=>Math.max(0,Number(a.amount||0)-paidFor(a.id));
  const totalAcc=activeAccruals.reduce((s,a)=>s+Number(a.amount||0),0);
  const totalPaid=collections.filter(x=>!x.cancelled).reduce((s,x)=>s+Number(x.amount||0),0);
  const overlay=document.createElement('div');overlay.className='collections-overlay';
  overlay.innerHTML=`<div class="collections-panel"><div class="collections-head"><div><small>TAHSİLAT YÖNETİMİ</small><h2>Tahsilatlar</h2></div><button class="collections-close">✕</button></div><div class="collections-body"><div class="collections-metrics"><article><span>Toplam tahakkuk</span><strong>${tl(totalAcc)}</strong></article><article><span>Toplam tahsilat</span><strong>${tl(totalPaid)}</strong></article><article><span>Kalan bakiye</span><strong>${tl(Math.max(0,totalAcc-totalPaid))}</strong></article></div><button class="collections-add">+ Tahsilat Ekle</button><div class="collections-list">${activeAccruals.length?activeAccruals.map(a=>{const c=contracts.find(x=>x.id===a.contractId),cu=customers.find(x=>x.id===c?.customerId),p=paidFor(a.id),r=remaining(a);return `<article class="collection-card"><div><h3>${cu?.name||'Müşteri'}</h3><p>${c?.name||'Tahakkuk'} · ${a.date||a.period||'-'}</p><div class="collection-amounts"><span>Tahakkuk ${tl(a.amount)}</span><span>Tahsil ${tl(p)}</span><span>Kalan ${tl(r)}</span></div></div><button data-accrual="${a.id}" ${r<=0?'disabled':''}>${r<=0?'Tamamlandı':'Tahsilat Gir'}</button></article>`}).join(''):'<div class="collections-empty">Tahakkuk kaydı bulunmuyor.</div>'}</div><h3 class="collections-history-title">Tahsilat Geçmişi</h3><div class="collections-list">${collections.length?collections.slice().reverse().map(x=>{const a=accruals.find(y=>y.id===x.accrualId),c=contracts.find(y=>y.id===a?.contractId),cu=customers.find(y=>y.id===c?.customerId);return `<article class="collection-card history"><div><h3>${cu?.name||'Müşteri'}</h3><p>${x.date} · ${x.method||'Belirtilmedi'}${x.note?' · '+x.note:''}</p></div><strong>${tl(x.amount)}</strong></article>`}).join(''):'<div class="collections-empty">Henüz tahsilat girilmedi.</div>'}</div></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.collections-close').onclick=()=>overlay.remove();
  overlay.querySelector('.collections-add').onclick=()=>openCollectionForm(null,overlay);
  overlay.querySelectorAll('[data-accrual]').forEach(b=>b.onclick=()=>openCollectionForm(b.dataset.accrual,overlay));
}

function openCollectionForm(accrualId,parent){
  const accruals=readLS('accruals'),contracts=readLS('contracts'),customers=readLS('customers'),collections=readLS('collections');
  const paidFor=id=>collections.filter(x=>x.accrualId===id&&!x.cancelled).reduce((s,x)=>s+Number(x.amount||0),0);
  const options=accruals.filter(a=>a.status!=='cancelled_accrual').map(a=>{const c=contracts.find(x=>x.id===a.contractId),cu=customers.find(x=>x.id===c?.customerId),rem=Math.max(0,Number(a.amount||0)-paidFor(a.id));return `<option value="${a.id}" ${a.id===accrualId?'selected':''} ${rem<=0?'disabled':''}>${cu?.name||'Müşteri'} · ${c?.name||'Tahakkuk'} · Kalan ${tl(rem)}</option>`}).join('');
  const form=document.createElement('div');form.className='collection-form-wrap';
  form.innerHTML=`<form class="collection-form"><div class="collections-head"><div><small>TAHSİLAT İŞLEMİ</small><h2>Tahsilat Ekle</h2></div><button type="button" class="collections-close">✕</button></div><label>Tahakkuk<select name="accrualId" required><option value="">Tahakkuk seçin</option>${options}</select></label><label>Tarih<input type="date" name="date" value="${todayc()}" required></label><label>Tutar<input type="number" name="amount" min="0.01" step="0.01" required></label><label>Ödeme Yöntemi<select name="method"><option>Nakit</option><option>Banka</option><option>Kredi Kartı</option><option>Çek</option><option>Diğer</option></select></label><label>Not<textarea name="note" rows="3"></textarea></label><div class="collection-form-actions"><button type="button" class="cancel">İptal</button><button type="submit">Kaydet</button></div></form>`;
  parent.appendChild(form);
  const close=()=>form.remove();form.querySelector('.collections-close').onclick=close;form.querySelector('.cancel').onclick=close;
  form.querySelector('form').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries()),a=accruals.find(x=>x.id===d.accrualId),remaining=Math.max(0,Number(a?.amount||0)-paidFor(d.accrualId)),amount=Number(d.amount||0);if(!a||amount<=0)return;if(amount>remaining&&!confirm(`Girilen tutar kalan bakiyeyi ${tl(amount-remaining)} aşıyor. Yine de kaydedilsin mi?`))return;collections.push({id:uidc(),accrualId:d.accrualId,date:d.date,amount,method:d.method,note:d.note,createdAt:new Date().toISOString()});writeLS('collections',collections);if(amount>=remaining){const next=accruals.map(x=>x.id===d.accrualId?{...x,status:'paid',paidAt:new Date().toISOString()}:x);writeLS('accruals',next)}close();parent.remove();openCollections()};
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mountCollections):mountCollections();