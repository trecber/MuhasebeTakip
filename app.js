import React, {useEffect, useMemo, useState} from 'https://esm.sh/react@19.1.0';
import {createRoot} from 'https://esm.sh/react-dom@19.1.0/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html=htm.bind(React.createElement);
const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const uid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());
const money=(n)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n||0));
const monthKey=()=>new Date().toISOString().slice(0,7);
const today=()=>new Date().toISOString().slice(0,10);

function App(){
  const [view,setView]=useState('dashboard');
  const [menu,setMenu]=useState(false);
  const [modal,setModal]=useState(null);
  const [customers,setCustomers]=useState(()=>read('customers'));
  const [staff,setStaff]=useState(()=>read('staff'));
  const [contracts,setContracts]=useState(()=>read('contracts'));
  const [accruals,setAccruals]=useState(()=>read('accruals'));
  const [filter,setFilter]=useState('all');

  useEffect(()=>write('customers',customers),[customers]);
  useEffect(()=>write('staff',staff),[staff]);
  useEffect(()=>write('contracts',contracts),[contracts]);
  useEffect(()=>write('accruals',accruals),[accruals]);
  useEffect(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js')},[]);

  const status=(c)=>c.status==='draft'?'draft':c.status==='cancelled'?'cancelled':c.endDate&&c.endDate<today()?'ended':c.status;
  const activeContracts=useMemo(()=>contracts.filter(c=>status(c)==='active'),[contracts]);
  const pending=useMemo(()=>activeContracts.filter(c=>c.accrualMethod==='fixed'&&!accruals.some(a=>a.contractId===c.id&&a.period===monthKey())),[activeContracts,accruals]);
  const monthly=activeContracts.filter(c=>c.pricingType==='monthly'&&c.accrualMethod==='fixed').reduce((s,c)=>s+Number(c.amount||0),0);

  const navigate=(id)=>{setView(id);setMenu(false)};
  const addAccrual=(contract)=>setAccruals(v=>[...v,{id:uid(),contractId:contract.id,period:monthKey(),date:today(),amount:Number(contract.amount||0),status:'pending'}]);

  return html`
  <div id="app">
    <header className="topbar">
      <div><p className="eyebrow">REÇBER MALİ MÜŞAVİRLİK</p><h1>Muhasebe Takip</h1></div>
      <button className="icon-btn" onClick=${()=>setMenu(true)}>☰</button>
    </header>
    <aside className=${`sidebar ${menu?'open':''}`}>
      <div className="sidebar-head"><strong>Menü</strong><button className="icon-btn" onClick=${()=>setMenu(false)}>✕</button></div>
      <nav>${[['dashboard','Ana Ekran'],['customers','Müşteriler'],['staff','Personeller'],['contracts','Sözleşmeler'],['accruals','Yaklaşan Tahakkuklar']].map(([id,label])=>html`<button className=${`nav-item ${view===id?'active':''}`} onClick=${()=>navigate(id)}>${label}</button>`)}</nav>
    </aside>
    <div className=${`overlay ${menu?'show':''}`} onClick=${()=>setMenu(false)}></div>
    <main className="content">
      ${view==='dashboard'&&html`<section className="view active-view">
        <div className="hero-card"><div><p className="muted">Bu ay</p><h2>${new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(new Date())}</h2></div><span className="status-pill">React + yerel kayıt</span></div>
        <div className="metric-grid">
          <article className="metric-card"><span>Aktif müşteri</span><strong>${customers.filter(c=>c.status==='active').length}</strong></article>
          <article className="metric-card"><span>Aktif sözleşme</span><strong>${activeContracts.length}</strong></article>
          <article className="metric-card"><span>Aylık sabit gelir</span><strong>${money(monthly)}</strong></article>
          <article className="metric-card"><span>Yaklaşan tahakkuk</span><strong>${pending.length}</strong></article>
        </div>
        <div className="section-card"><div className="section-title-row"><div><p className="muted">Yaklaşan işlemler</p><h3>Bu ay tahakkuk oluşturulacaklar</h3></div><button className="text-btn" onClick=${()=>navigate('accruals')}>Tümünü gör</button></div>
        <${RecordList} empty="Henüz aktif sözleşme bulunmuyor.">${pending.slice(0,3).map(c=>html`<article className="list-item"><h4>${customers.find(x=>x.id===c.customerId)?.name||'Müşteri'}</h4><div className="list-meta"><span>${c.incomeCategory}</span><strong>${money(c.amount)}</strong></div></article>`)}</${RecordList}></div>
      </section>`}
      ${view==='customers'&&html`<${Page} title="Müşteriler" eyebrow="Cari kartlar" button="+ Müşteri" onAdd=${()=>setModal('customer')}><${RecordList} empty="Henüz müşteri eklenmedi.">${customers.map(c=>html`<article className="list-item"><h4>${c.name}</h4><div className="list-meta"><span>${c.taxNo||'Vergi no yok'}</span><span>${c.phone||'Telefon yok'}</span><span className=${`badge ${c.status==='active'?'active':''}`}>${c.status==='active'?'Aktif':'Pasif'}</span></div></article>`)}</${RecordList}></${Page}>`}
      ${view==='staff'&&html`<${Page} title="Personeller" eyebrow="Satış sorumluları" button="+ Personel" onAdd=${()=>setModal('staff')}><${RecordList} empty="Henüz personel eklenmedi.">${staff.map(s=>html`<article className="list-item"><h4>${s.name}</h4><div className="list-meta"><span>${s.role||'Satış personeli'}</span><span className=${`badge ${s.status==='active'?'active':''}`}>${s.status==='active'?'Aktif':'Pasif'}</span></div></article>`)}</${RecordList}></${Page}>`}
      ${view==='contracts'&&html`<${Page} title="Sözleşmeler" eyebrow="Gelir sözleşmeleri" button="+ Sözleşme" onAdd=${()=>customers.length?setModal('contract'):alert('Önce müşteri eklemelisiniz.')}><div className="filter-row"><select value=${filter} onChange=${e=>setFilter(e.target.value)}><option value="all">Tüm sözleşmeler</option><option value="active">Aktif</option><option value="ended">Sona eren</option><option value="draft">Taslak</option></select></div><${RecordList} empty="Bu filtrede sözleşme bulunmuyor.">${contracts.filter(c=>filter==='all'||status(c)===filter).map(c=>html`<article className="list-item"><div className="section-title-row"><div><h4>${customers.find(x=>x.id===c.customerId)?.name||'Müşteri'}</h4><div className="muted">${c.name}</div></div><span className=${`badge ${status(c)==='active'?'active':''}`}>${status(c)}</span></div><div className="money">${money(c.amount)}</div><div className="list-meta"><span>${c.incomeCategory}</span><span>${c.startDate} – ${c.endDate}</span></div></article>`)}</${RecordList}></${Page}>`}
      ${view==='accruals'&&html`<${Page} title="Yaklaşan Tahakkuklar" eyebrow="Aylık işlemler" button="Tümünü Tahakkuk Et" onAdd=${()=>pending.forEach(addAccrual)}><${RecordList} empty="Bu ay için tahakkuk bekleyen kayıt yok.">${pending.map(c=>html`<article className="list-item"><div className="section-title-row"><div><h4>${customers.find(x=>x.id===c.customerId)?.name||'Müşteri'}</h4><div className="muted">${c.name}</div></div><button className="primary-btn" onClick=${()=>addAccrual(c)}>Tahakkuk Et</button></div><div className="money">${money(c.amount)}</div></article>`)}</${RecordList}></${Page}>`}
    </main>
    ${modal==='customer'&&html`<${Modal} title="Müşteri Ekle" onClose=${()=>setModal(null)} onSubmit=${data=>{setCustomers(v=>[...v,{id:uid(),...data}]);setModal(null)}} fields=${[['name','Ünvan / Ad Soyad','text'],['taxNo','Vergi No / T.C. Kimlik No','text'],['contactPerson','Yetkili','text'],['phone','Telefon','tel'],['email','E-posta','email'],['status','Durum','select',['active','passive']],['note','Not','textarea']]}/>`}
    ${modal==='staff'&&html`<${Modal} title="Personel Ekle" onClose=${()=>setModal(null)} onSubmit=${data=>{setStaff(v=>[...v,{id:uid(),...data}]);setModal(null)}} fields=${[['name','Ad Soyad','text'],['role','Görev','text'],['status','Durum','select',['active','passive']]]}/>`}
    ${modal==='contract'&&html`<${ContractModal} customers=${customers} staff=${staff} onClose=${()=>setModal(null)} onSubmit=${data=>{setContracts(v=>[...v,{id:uid(),...data,amount:Number(data.amount)}]);setModal(null)}}/>`}
  </div>`;
}

function Page({title,eyebrow,button,onAdd,children}){return html`<section className="view active-view"><div className="section-title-row page-title"><div><p className="muted">${eyebrow}</p><h2>${title}</h2></div><button className="primary-btn" onClick=${onAdd}>${button}</button></div>${children}</section>`}
function RecordList({empty,children}){const items=React.Children.toArray(children);return html`<div className=${items.length?'list-stack':'list-stack empty-state'}>${items.length?items:empty}</div>`}
function Modal({title,onClose,onSubmit,fields}){const submit=e=>{e.preventDefault();onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()))};return html`<dialog open><form className="form-sheet" onSubmit=${submit}><div className="form-head"><h3>${title}</h3><button type="button" className="icon-btn" onClick=${onClose}>✕</button></div>${fields.map(([name,label,type,options])=>type==='select'?html`<label>${label}<select name=${name}>${options.map(o=>html`<option value=${o}>${o==='active'?'Aktif':'Pasif'}</option>`)}</select></label>`:type==='textarea'?html`<label>${label}<textarea name=${name} rows="3"></textarea></label>`:html`<label>${label}<input name=${name} type=${type} required=${name==='name'}/></label>`)}<button className="primary-btn wide">Kaydet</button></form></dialog>`}
function ContractModal({customers,staff,onClose,onSubmit}){const submit=e=>{e.preventDefault();onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()))};return html`<dialog open><form className="form-sheet large-sheet" onSubmit=${submit}><div className="form-head"><h3>Sözleşme Ekle</h3><button type="button" className="icon-btn" onClick=${onClose}>✕</button></div><label>Müşteri<select name="customerId" required><option value="">Müşteri seçin</option>${customers.filter(c=>c.status==='active').map(c=>html`<option value=${c.id}>${c.name}</option>`)}</select></label><label>Sözleşme Adı<input name="name" required/></label><label>Gelir Kategorisi<select name="incomeCategory"><option>Muhasebe Geliri</option><option>Danışmanlık Geliri</option></select></label><label>Satış Personeli<select name="staffId"><option value="">Seçilmedi</option>${staff.filter(s=>s.status==='active').map(s=>html`<option value=${s.id}>${s.name}</option>`)}</select></label><div className="two-col"><label>Başlangıç<input type="date" name="startDate" required/></label><label>Bitiş<input type="date" name="endDate" required/></label></div><div className="two-col"><label>Ücretlendirme<select name="pricingType"><option value="monthly">Aylık Ücret</option><option value="total">Toplam Bedel</option></select></label><label>Sözleşme Bedeli<input type="number" name="amount" min="0" step="0.01" required/></label></div><div className="two-col"><label>Tahakkuk Yöntemi<select name="accrualMethod"><option value="fixed">Sabit Tutar</option><option value="manual">Manuel Tutar</option></select></label><label>Tahakkuk Günü<input type="number" name="accrualDay" min="1" max="31" defaultValue="30"/></label></div><label>Ödeme Düzeni<select name="paymentPattern"><option value="regular">Düzenli</option><option value="irregular">Düzensiz</option></select></label><label>Durum<select name="status"><option value="active">Aktif</option><option value="draft">Taslak</option><option value="cancelled">İptal</option></select></label><button className="primary-btn wide">Kaydet</button></form></dialog>`}

createRoot(document.getElementById('root')).render(html`<${App}/>`);
