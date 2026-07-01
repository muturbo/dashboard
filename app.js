/* ========================================
   مقاولي الباطن - Dashboard App v3
   Full CRUD + Extracts + Reorder + Analytics
   ======================================== */

// ========================================
// DEFAULT DATA
// ========================================
const DEFAULT_ITEMS = [
    'مساحة','اختبارات','حفر','لوادر','نجارة مسلحة','عزل',
    'حدادة مسلحة','كهرباء','مباني','نجارة باب وشباك','سباكة',
    'بياض','بلاط موزايكو','سيراميك','بازلت','قرميد',
    'UPVC','كريتال','نقاشة','أسطورجي','تدبيش',
    'إنترلوك','بلدوره','غرف تفتيش','مطابق','خرسانة أرضيات'
];

const COLORS = [
    '#00d2ff','#7c4dff','#00e676','#ff9100','#e040fb','#ff5252',
    '#00bfa5','#448aff','#76ff03','#ffab40','#ea80fc','#ff8a80',
    '#64ffda','#536dfe','#b2ff59','#ffd740','#ce93d8','#ff80ab',
    '#84ffff','#8c9eff','#ccff90','#ffe57f','#b388ff','#ff9e80',
    '#a7ffeb','#82b1ff','#69f0ae','#40c4ff','#e6ee9c','#f48fb1'
];

const UNITS = ['م²','م³','م.ط','عدد','طن','مقطوعية','متر','كجم'];
const WORK_TYPES = ['تنفيذ','توريد','توريد وتنفيذ'];
const DEFAULT_SUPPLY_ITEMS = [
    'توريد رمل','توريد مياه','توريد خرسانه جاهزه','توريد حديد تسليح',
    'توريد اسمنت','توريد طوب اسمنتى','توريد طوب طفلى','توريد بلاط مازيكو',
    'توريد بلدوره','توريد انترلوك','توريدات سباكه','توريدات كهربائيه',
    'توريد دهانات خارجيه','توريدات سيراميك','توريدات عزل','توريد فوم','توريدات اوكر'
];
const SUPPLY_UNITS = ['م²','م³','م.ط','عدد','طن','متر','كجم','لتر','كيس','شكارة','الف طوبة','م.م','رحلة'];

// ========================================
// STORAGE (Server + LocalStorage fallback)
// ========================================
const SK = {
    items: 'sc_items_v3',
    contractors: 'sc_contractors_v3',
    payments: 'sc_payments_v3',
    extracts: 'sc_extracts_v3',
    supplierExtracts: 'sc_supplierExtracts_v3',
    supplyItemsList: 'sc_supplyItemsList_v1'
};

let items=[], contractors=[], payments=[], extracts=[];
let supplierExtracts=[];
let supplyItemsList=[...DEFAULT_SUPPLY_ITEMS];
let pieChart=null, barChart=null;
let deleteTarget=null, deleteType='', editTarget=null, editItemTarget=null;
let currentExtractId=null;
let currentSupExtractId=null;
let sortState={field:'id',dir:'asc'};
let isServerMode=false;
let syncTimer=null;
let lastSyncHash='';

function loadLocal(key,fallback){ try{ const d=localStorage.getItem(key); return d?JSON.parse(d):fallback; }catch{return fallback;} }
function saveLocal(key,data){ try{localStorage.setItem(key,JSON.stringify(data));}catch{} }

// Save to localStorage (cache)
function saveToCache(){
    saveLocal(SK.items,items);
    saveLocal(SK.contractors,contractors);
    saveLocal(SK.payments,payments);
    saveLocal(SK.extracts,extracts);
    saveLocal(SK.supplierExtracts,supplierExtracts);
    saveLocal(SK.supplyItemsList,supplyItemsList);
}

// Firebase URL
const FIREBASE_URL='https://dashboard-77bb2-default-rtdb.firebaseio.com';

// Save to Firebase
async function saveToServer(){
    if(!isServerMode) return;
    try{
        const data={items,contractors,payments,extracts,supplierExtracts,supplyItemsList};
        await fetch(FIREBASE_URL+'/data.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        lastSyncHash=JSON.stringify(data);
        showSyncStatus('synced');
    }catch{showSyncStatus('error');}
}

// Load from Firebase
async function loadFromServer(){
    try{
        const res=await fetch(FIREBASE_URL+'/data.json');
        if(!res.ok)throw new Error();
        const data=await res.json();
        if(!data){isServerMode=true;return true;}
        isServerMode=true;
        if(data.items&&data.items.length)items=data.items;
        if(data.contractors&&data.contractors.length)contractors=data.contractors;
        if(data.payments)payments=data.payments;
        if(data.extracts)extracts=data.extracts;
        if(data.supplierExtracts)supplierExtracts=data.supplierExtracts;
        if(data.supplyItemsList)supplyItemsList=data.supplyItemsList;
        lastSyncHash=JSON.stringify(data);
        saveToCache();
        showSyncStatus('synced');
        return true;
    }catch{
        isServerMode=false;
        showSyncStatus('offline');
        return false;
    }
}

// Auto-sync: check for changes from other devices
async function autoSync(){
    if(!isServerMode)return;
    try{
        const res=await fetch(FIREBASE_URL+'/data.json');
        if(!res.ok)return;
        const data=await res.json();
        if(!data)return;
        const hash=JSON.stringify(data);
        if(hash!==lastSyncHash){
            lastSyncHash=hash;
            items=data.items||items;
            contractors=data.contractors||contractors;
            payments=data.payments||payments;
            extracts=data.extracts||extracts;
            supplierExtracts=data.supplierExtracts||supplierExtracts;
            saveToCache();
            populateDropdowns();
            renderAll();
            showSyncStatus('synced');
            showToast('🔄 تم تحديث البيانات من جهاز آخر','info');
        }
    }catch{showSyncStatus('error');}
}

function showSyncStatus(status){
    const el=document.getElementById('syncStatus');
    if(!el)return;
    el.className='sync-status '+status;
    el.innerHTML=status==='synced'?'🟢 متصل ومتزامن':status==='error'?'🔴 خطأ في الاتصال':'🟡 وضع محلي';
}

// Save everywhere
function save(){
    saveToCache();
    saveToServer();
}

function initDefaults(){
    if(contractors.length===0){
        let id=1;
        DEFAULT_ITEMS.forEach(item=>{
            for(let i=1;i<=6;i++) contractors.push({id:id++,name:`مقاول ${item} ${i}`,item});
        });
        DEFAULT_SUPPLY_ITEMS.forEach(item=>{
            for(let i=1;i<=6;i++) contractors.push({id:id++,name:`مورد ${item} ${i}`,item});
        });
    } else {
        // Ensure suppliers exist for each supply item
        let maxId=Math.max(...contractors.map(c=>c.id),0);
        DEFAULT_SUPPLY_ITEMS.forEach(item=>{
            const existing=contractors.filter(c=>c.item===item);
            if(existing.length===0){
                for(let i=1;i<=6;i++) contractors.push({id:++maxId,name:`مورد ${item} ${i}`,item});
            }
        });
    }
    if(items.length===0){
        items=[...DEFAULT_ITEMS,...DEFAULT_SUPPLY_ITEMS];
    } else {
        // Ensure supply items exist
        DEFAULT_SUPPLY_ITEMS.forEach(si=>{ if(!items.includes(si)) items.push(si); });
    }
    save();
}

function getColor(item){ return COLORS[items.indexOf(item)%COLORS.length]||'#888'; }

// ========================================
// INIT
// ========================================
document.addEventListener('DOMContentLoaded',async()=>{
    // Try server first
    const serverOk=await loadFromServer();
    if(!serverOk){
        // Fallback to localStorage
        items=loadLocal(SK.items,[]);
        contractors=loadLocal(SK.contractors,[]);
        payments=loadLocal(SK.payments,[]);
        extracts=loadLocal(SK.extracts,[]);
        supplierExtracts=loadLocal(SK.supplierExtracts,[]);
        supplyItemsList=loadLocal(SK.supplyItemsList,[...DEFAULT_SUPPLY_ITEMS]);
    }
    initDefaults();
    initNav(); initSidebar(); populateDropdowns(); initForms(); initModals(); initSorting(); initSupplierListeners();
    setDate(); renderAll();
    // Start auto-sync every 10 seconds
    if(isServerMode) syncTimer=setInterval(autoSync,10000);
});

// ========================================
// SAVE ALL (manual button)
// ========================================
function saveAllData(){
    saveToCache();
    if(isServerMode){
        saveToServer().then(()=>showToast('💾 تم حفظ ومزامنة البيانات للجميع','success'));
    }else{
        showToast('💾 تم حفظ البيانات محلياً','success');
    }
}

// ========================================
// NAVIGATION
// ========================================
function initNav(){
    document.querySelectorAll('.nav-link').forEach(l=>l.addEventListener('click',e=>{e.preventDefault();navigateTo(l.dataset.section);}));
}
function navigateTo(s){
    document.querySelectorAll('.nav-link').forEach(l=>l.classList.remove('active'));
    const a=document.querySelector(`[data-section="${s}"]`); if(a)a.classList.add('active');
    document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));
    const sec=document.getElementById(`section-${s}`); if(sec)sec.classList.add('active');
    closeSidebar(); window.scrollTo({top:0,behavior:'smooth'});
}

// ========================================
// SIDEBAR
// ========================================
function initSidebar(){
    document.getElementById('menuToggle').addEventListener('click',()=>{document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebarOverlay').classList.toggle('active');});
    document.getElementById('sidebarOverlay').addEventListener('click',closeSidebar);
}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('active');}

// ========================================
// DROPDOWNS
// ========================================
function populateDropdowns(){
    // All items (contractors + suppliers) for payment & statement
    const allSels=['paymentItem','paymentItemFilter','statementItem'];
    allSels.forEach(id=>{
        const s=document.getElementById(id); if(!s)return;
        const f=s.options[0]; s.innerHTML=''; s.appendChild(f);
        items.forEach(it=>{const o=document.createElement('option');o.value=it;o.textContent=it;s.appendChild(o);});
    });
    // Contractor-only items
    const ctrSels=['itemFilter','addContractorItem','extractItemSelect'];
    ctrSels.forEach(id=>{
        const s=document.getElementById(id); if(!s)return;
        const f=s.options[0]; s.innerHTML=''; s.appendChild(f);
        items.filter(i=>!isSupplyItem(i)).forEach(it=>{const o=document.createElement('option');o.value=it;o.textContent=it;s.appendChild(o);});
    });
    initDropdownListeners();
    populateSupplyDropdowns();
}
function initDropdownListeners(){
    const bind=(selId,evt,handler)=>{const el=document.getElementById(selId);if(el)el.addEventListener(evt,handler);};
    bind('paymentItem','change',e=>fillContractorDD('paymentContractor',e.target.value));
    bind('statementItem','change',e=>{fillContractorDD('statementContractor',e.target.value);hide('statementContent');show('noStatementSelected');hide('printStatement');});
    bind('statementContractor','change',renderStatement);
    bind('contractorSearch','input',renderContractors);
    bind('itemFilter','change',renderContractors);
    bind('paymentSearch','input',renderPayments);
    bind('paymentItemFilter','change',renderPayments);
    bind('dateFrom','change',renderPayments);
    bind('dateTo','change',renderPayments);
    bind('extractItemSelect','change',e=>{fillContractorDD('extractContractorSelect',e.target.value);hide('balanceCard');hide('extractContent');show('extractEmpty');hide('btnNewExtract');hide('extractNumberSelect');});
    bind('extractContractorSelect','change',onExtractContractorChange);
    bind('extractNumberSelect','change',onExtractNumberChange);
}
function fillContractorDD(selId,item){
    const label=isSupplyItem(item)?'المورد':'المقاول';
    const s=document.getElementById(selId);s.innerHTML=`<option value="">اختر ${label}...</option>`;
    if(!item){s.disabled=true;return;}
    contractors.filter(c=>c.item===item).forEach(c=>{const o=document.createElement('option');o.value=c.name;o.textContent=c.name;s.appendChild(o);});
    s.disabled=false;
}

// ========================================
// FORMS
// ========================================
function initForms(){
    document.getElementById('paymentForm').addEventListener('submit',submitPayment);
    document.getElementById('paymentDate').value=today();
    document.getElementById('addContractorForm').addEventListener('submit',submitAddContractor);
    document.getElementById('addItemForm').addEventListener('submit',submitAddItem);
    document.getElementById('editContractorForm').addEventListener('submit',submitEditContractor);
    document.getElementById('editItemForm').addEventListener('submit',submitEditItem);
    document.getElementById('newExtractForm').addEventListener('submit',submitNewExtract);
    const addSupForm=document.getElementById('addSupplierForm');if(addSupForm)addSupForm.addEventListener('submit',submitAddSupplier);
    const addSIForm=document.getElementById('addSupplyItemForm');if(addSIForm)addSIForm.addEventListener('submit',submitAddSupplyItem);
}

function submitPayment(e){
    e.preventDefault();
    const item=gv('paymentItem'),ctr=gv('paymentContractor'),amt=parseFloat(gv('paymentAmount')),date=gv('paymentDate'),chk=gv('paymentCheckNo').trim(),notes=gv('paymentNotes').trim();
    if(!item||!ctr||!amt||!date){showToast('يرجى ملء الحقول المطلوبة','error');return;}
    if(amt<=0){showToast('المبلغ يجب أن يكون أكبر من صفر','error');return;}
    payments.push({id:uid(),contractor:ctr,item,amount:amt,date,checkNo:chk,notes,createdAt:new Date().toISOString()});
    save(); renderAll();
    e.target.reset();gi('paymentContractor').disabled=true;gi('paymentContractor').innerHTML='<option value="">اختر البند أولاً...</option>';gi('paymentDate').value=today();
    showToast(`✅ تم تسجيل دفعة ${fmtCur(amt)} لـ ${ctr}`,'success');
}

function submitAddContractor(e){
    e.preventDefault();
    const name=gv('addContractorName').trim(),item=gv('addContractorItem');
    if(!name||!item){showToast('يرجى ملء الاسم والبند','error');return;}
    if(contractors.some(c=>c.name===name&&c.item===item)){showToast('⚠️ المقاول موجود بالفعل','error');return;}
    contractors.push({id:contractors.length?Math.max(...contractors.map(c=>c.id))+1:1,name,item});
    save(); renderAll(); populateDropdowns();
    e.target.reset();closeModal('addContractorModal');
    showToast(`✅ تمت إضافة "${name}" في "${item}"`,'success');
}

function submitAddItem(e){
    e.preventDefault();
    const name=gv('addItemName').trim();
    if(!name){showToast('يرجى إدخال اسم البند','error');return;}
    if(items.includes(name)){showToast('⚠️ البند موجود بالفعل','error');return;}
    items.push(name); save(); populateDropdowns(); renderAll();
    e.target.reset();closeModal('addItemModal');
    showToast(`✅ تمت إضافة بند "${name}"`,'success');
}

function openEditContractor(id){
    const c=contractors.find(x=>x.id===id);if(!c)return;
    editTarget=id; gi('editContractorName').value=c.name; gi('editContractorCurrentItem').textContent=c.item;
    openModal('editContractorModal');
}
function submitEditContractor(e){
    e.preventDefault();if(!editTarget)return;
    const nn=gv('editContractorName').trim();if(!nn){showToast('يرجى إدخال الاسم','error');return;}
    const c=contractors.find(x=>x.id===editTarget);if(!c)return;
    const old=c.name; c.name=nn;
    payments.forEach(p=>{if(p.contractor===old&&p.item===c.item)p.contractor=nn;});
    extracts.forEach(ex=>{if(ex.contractor===old&&ex.item===c.item)ex.contractor=nn;});
    save();
    renderAll();populateDropdowns();closeModal('editContractorModal');editTarget=null;
    showToast(`✅ تم تعديل الاسم إلى "${nn}"`,'success');
}

function openEditItem(oldName){
    editItemTarget=oldName; gi('editItemOldName').textContent=oldName; gi('editItemNewName').value=oldName;
    openModal('editItemModal');
}
function submitEditItem(e){
    e.preventDefault();if(!editItemTarget)return;
    const nn=gv('editItemNewName').trim();if(!nn){showToast('يرجى إدخال الاسم','error');return;}
    if(nn!==editItemTarget&&items.includes(nn)){showToast('⚠️ البند موجود','error');return;}
    const idx=items.indexOf(editItemTarget);if(idx>-1)items[idx]=nn;
    contractors.forEach(c=>{if(c.item===editItemTarget)c.item=nn;});
    payments.forEach(p=>{if(p.item===editItemTarget)p.item=nn;});
    extracts.forEach(ex=>{if(ex.item===editItemTarget)ex.item=nn;});
    save();
    renderAll();populateDropdowns();closeModal('editItemModal');editItemTarget=null;
    showToast(`✅ تم تعديل البند إلى "${nn}"`,'success');
}

// ========================================
// REORDER
// ========================================
function moveItem(item,dir){
    const idx=items.indexOf(item);if(idx<0)return;
    const newIdx=idx+dir;if(newIdx<0||newIdx>=items.length)return;
    [items[idx],items[newIdx]]=[items[newIdx],items[idx]];
    save();renderContractors();populateDropdowns();
}
function moveContractor(id,dir){
    const c=contractors.find(x=>x.id===id);if(!c)return;
    const group=contractors.filter(x=>x.item===c.item);
    const others=contractors.filter(x=>x.item!==c.item);
    const idx=group.findIndex(x=>x.id===id);
    const newIdx=idx+dir;if(newIdx<0||newIdx>=group.length)return;
    [group[idx],group[newIdx]]=[group[newIdx],group[idx]];
    // Rebuild contractors maintaining item order
    contractors=[];
    items.forEach(it=>{
        const g=it===c.item?group:others.filter(x=>x.item===it);
        // Actually let me rebuild properly
    });
    // Simpler: just swap in the full array
    contractors=rebuildContractors(c.item,group);
    save();renderContractors();
}
function rebuildContractors(changedItem,changedGroup){
    const result=[];
    items.forEach(it=>{
        if(it===changedItem) result.push(...changedGroup);
        else result.push(...contractors.filter(c=>c.item===it));
    });
    return result;
}

// ========================================
// DELETE
// ========================================
function confirmDeleteContractor(id){
    deleteTarget=id;deleteType='contractor';
    const c=contractors.find(x=>x.id===id);
    gi('deleteModalText').innerHTML=`هل تريد حذف المقاول <strong>"${c?c.name:''}"</strong> وجميع دفعاته؟`;
    openModal('deleteModal');
}
function confirmDeletePayment(id){
    deleteTarget=id;deleteType='payment';
    gi('deleteModalText').innerHTML='هل تريد حذف هذه الدفعة؟';
    openModal('deleteModal');
}
function confirmDeleteItem(name){
    deleteTarget=name;deleteType='item';
    gi('deleteModalText').innerHTML=`هل تريد حذف بند <strong>"${name}"</strong> وجميع مقاوليه ودفعاتهم؟`;
    openModal('deleteModal');
}

// ========================================
// MODALS
// ========================================
function initModals(){
    gi('confirmDelete').addEventListener('click',()=>{
        if(deleteType==='payment'){payments=payments.filter(p=>p.id!==deleteTarget);save();showToast('🗑️ تم حذف الدفعة','info');}
        else if(deleteType==='contractor'){
            const c=contractors.find(x=>x.id===deleteTarget);
            if(c){payments=payments.filter(p=>!(p.contractor===c.name&&p.item===c.item));extracts=extracts.filter(ex=>!(ex.contractor===c.name&&ex.item===c.item));contractors=contractors.filter(x=>x.id!==deleteTarget);save();populateDropdowns();showToast('🗑️ تم حذف المقاول','info');}
        }
        else if(deleteType==='item'){
            contractors=contractors.filter(c=>c.item!==deleteTarget);payments=payments.filter(p=>p.item!==deleteTarget);extracts=extracts.filter(ex=>ex.item!==deleteTarget);items=items.filter(i=>i!==deleteTarget);
            save();populateDropdowns();showToast('🗑️ تم حذف البند','info');
        }
        else if(deleteType==='supExtract'){
            supplierExtracts=supplierExtracts.filter(ex=>ex.id!==deleteTarget);
            save();currentSupExtractId=null;
            hide('supExtractContent');show('supExtractEmpty');
            const si=gv('supExtractItemSelect'),ss=gv('supExtractSupplierSelect');
            if(si&&ss)onSupExtractSupplierChange();
            showToast('🗑️ تم حذف المستخلص','info');
        }
        else if(deleteType==='extract'){
            extracts=extracts.filter(ex=>ex.id!==deleteTarget);
            save();currentExtractId=null;
            hide('extractContent');show('extractEmpty');
            const ci=gv('extractItemSelect'),cc=gv('extractContractorSelect');
            if(ci&&cc)onExtractContractorChange();
            showToast('🗑️ تم حذف المستخلص','info');
        }
        renderAll();closeModal('deleteModal');deleteTarget=null;deleteType='';
    });
    gi('cancelDelete').addEventListener('click',()=>closeModal('deleteModal'));
    document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)closeModal(o.id);}));
    document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.closeModal)));
}
function openModal(id){gi(id).classList.add('active');}
function closeModal(id){gi(id).classList.remove('active');}

// ========================================
// SORTING
// ========================================
function initSorting(){
    document.querySelectorAll('.sortable').forEach(th=>th.addEventListener('click',()=>{
        const f=th.dataset.sort;sortState={field:f,dir:sortState.field===f&&sortState.dir==='asc'?'desc':'asc'};renderContractors();
    }));
}

// ========================================
// RENDER ALL
// ========================================
function renderAll(){renderOverview();renderContractors();renderSuppliers();renderPayments();renderCharts();renderSpending();}

// ========================================
// OVERVIEW
// ========================================
function renderOverview(){
    const ctrOnly=contractors.filter(c=>!DEFAULT_SUPPLY_ITEMS.includes(c.item));
    const supOnly=contractors.filter(c=>DEFAULT_SUPPLY_ITEMS.includes(c.item));
    animCount('statContractors',ctrOnly.length);
    const tp=payments.reduce((s,p)=>s+p.amount,0);
    gi('statTotalPaid').textContent=fmtCur(tp);
    animCount('statActiveItems',new Set(payments.map(p=>p.item)).size);
    animCount('statPaymentCount',payments.length);
    // Supplier stats
    animCount('statSuppliers',supOnly.length);
    const supPayTotal=payments.filter(p=>DEFAULT_SUPPLY_ITEMS.includes(p.item)).reduce((s,p)=>s+p.amount,0);
    const el=gi('statSupplierPaid');if(el)el.textContent=fmtCur(supPayTotal);
    // Recent 5
    const recent=[...payments].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
    const tb=gi('recentBody'),em=gi('recentEmpty');
    if(!recent.length){tb.innerHTML='';show('recentEmpty');hide('recentTable');}
    else{hide('recentEmpty');show('recentTable');tb.innerHTML=recent.map((p,i)=>`<tr style="animation-delay:${i*0.05}s"><td>${p.contractor}</td><td>${itemBadge(p.item)}</td><td class="amount-cell">${fmtCur(p.amount)}</td><td class="date-cell">${fmtDate(p.date)}</td></tr>`).join('');}
    setDate();
}

// ========================================
// SPENDING BREAKDOWN
// ========================================
function renderSpending(){
    const tp=payments.reduce((s,p)=>s+p.amount,0);
    if(!payments.length){hide('spendingTable');show('spendingEmpty');return;}
    show('spendingTable');hide('spendingEmpty');
    const data={};
    payments.forEach(p=>{
        if(!data[p.item])data[p.item]={amount:0,payments:0,contractors:new Set()};
        data[p.item].amount+=p.amount;data[p.item].payments++;data[p.item].contractors.add(p.contractor);
    });
    const sorted=Object.entries(data).sort((a,b)=>b[1].amount-a[1].amount);
    let totalCtrs=new Set(), totalPays=0;
    gi('spendingBody').innerHTML=sorted.map(([item,d])=>{
        d.contractors.forEach(c=>totalCtrs.add(c));totalPays+=d.payments;
        const pct=tp?((d.amount/tp)*100).toFixed(1):0;
        return `<tr><td>${itemBadge(item)}</td><td>${d.contractors.size}</td><td>${d.payments}</td><td class="amount-cell">${fmtCur(d.amount)}</td><td><div class="pct-bar"><div class="pct-track"><div class="pct-fill" style="width:${pct}%"></div></div><span>${pct}%</span></div></td></tr>`;
    }).join('');
    gi('spendingTotalContractors').textContent=totalCtrs.size;
    gi('spendingTotalPayments').textContent=totalPays;
    gi('spendingGrandTotal').textContent=fmtCur(tp);
}

// ========================================
// CONTRACTORS (Grouped)
// ========================================
function renderContractors(){
    const search=gv('contractorSearch').trim().toLowerCase();
    const itemF=gv('itemFilter');
    const totals={};
    payments.forEach(p=>{const k=p.contractor+'|'+p.item;totals[k]=(totals[k]||0)+p.amount;});

    const container=gi('contractorsGrouped');
    const displayItems=itemF?items.filter(i=>i===itemF&&!DEFAULT_SUPPLY_ITEMS.includes(i)):items.filter(i=>!DEFAULT_SUPPLY_ITEMS.includes(i));
    let totalShown=0;

    container.innerHTML=displayItems.map((item,ii)=>{
        let ctrs=contractors.filter(c=>c.item===item);
        if(search)ctrs=ctrs.filter(c=>c.name.toLowerCase().includes(search)||c.item.toLowerCase().includes(search));
        if(!ctrs.length&&search)return '';
        totalShown+=ctrs.length;
        const color=getColor(item);
        const isFirst=ii===0,isLast=ii===displayItems.length-1;
        return `<div class="item-group">
            <div class="item-group-header" style="--item-color:${color}">
                <div class="item-group-title"><span class="item-dot" style="background:${color}"></span><h3>${item}</h3><span class="badge">${ctrs.length} مقاول</span></div>
                <div class="action-buttons">
                    <button class="btn btn-reorder" onclick="moveItem('${esc(item)}',-1)" title="⬆️" ${isFirst?'disabled':''}>▲</button>
                    <button class="btn btn-reorder" onclick="moveItem('${esc(item)}',1)" title="⬇️" ${isLast?'disabled':''}>▼</button>
                    <button class="btn btn-icon-only btn-view" onclick="openEditItem('${esc(item)}')" title="تعديل البند">✏️</button>
                    <button class="btn btn-icon-only btn-delete" onclick="confirmDeleteItem('${esc(item)}')" title="حذف البند">🗑️</button>
                </div>
            </div>
            <div class="item-group-body">
                <table class="data-table"><thead><tr><th style="width:40px">م</th><th>اسم المقاول</th><th>إجمالي المدفوع</th><th style="width:180px">إجراء</th></tr></thead>
                <tbody>${ctrs.map((c,ci)=>{
                    const t=totals[c.name+'|'+c.item]||0;
                    return `<tr style="animation-delay:${ci*0.02}s"><td>${ci+1}</td><td><strong>${c.name}</strong></td><td class="amount-cell">${fmtCur(t)}</td>
                    <td class="action-buttons">
                        <button class="btn btn-reorder" onclick="moveContractor(${c.id},-1)" ${ci===0?'disabled':''}>▲</button>
                        <button class="btn btn-reorder" onclick="moveContractor(${c.id},1)" ${ci===ctrs.length-1?'disabled':''}>▼</button>
                        <button class="btn btn-icon-only btn-view" onclick="openEditContractor(${c.id})" title="تعديل">✏️</button>
                        <button class="btn btn-icon-only btn-view" onclick="viewStatement('${esc(c.item)}','${esc(c.name)}')" title="كشف حساب">🧾</button>
                        <button class="btn btn-icon-only btn-delete" onclick="confirmDeleteContractor(${c.id})" title="حذف">🗑️</button>
                    </td></tr>`;
                }).join('')}</tbody></table>
            </div>
        </div>`;
    }).join('');
    gi('contractorCount').textContent=`${totalShown} مقاول`;
}

// ========================================
// PAYMENTS
// ========================================
function renderPayments(){
    const search=gv('paymentSearch').trim().toLowerCase(),itemF=gv('paymentItemFilter'),df=gv('dateFrom'),dt=gv('dateTo');
    let fil=payments.filter(p=>{
        return(!search||p.contractor.toLowerCase().includes(search)||p.item.toLowerCase().includes(search)||(p.notes&&p.notes.toLowerCase().includes(search))||(p.checkNo&&p.checkNo.toLowerCase().includes(search)))
        &&(!itemF||p.item===itemF)&&(!df||p.date>=df)&&(!dt||p.date<=dt);
    }).sort((a,b)=>new Date(b.date)-new Date(a.date));
    gi('paymentsCount').textContent=`${fil.length} دفعة`;
    const tb=gi('paymentsBody'),em=gi('paymentsEmpty');
    if(!fil.length){tb.innerHTML='';show('paymentsEmpty');hide('paymentsTable');}
    else{hide('paymentsEmpty');show('paymentsTable');tb.innerHTML=fil.map((p,i)=>`<tr style="animation-delay:${Math.min(i*0.02,0.5)}s"><td>${i+1}</td><td><strong>${p.contractor}</strong></td><td>${itemBadge(p.item)}</td><td class="amount-cell">${fmtCur(p.amount)}</td><td class="date-cell">${fmtDate(p.date)}</td><td>${p.checkNo||'—'}</td><td>${p.notes||'—'}</td><td><button class="btn btn-icon-only btn-delete" onclick="confirmDeletePayment(${p.id})" title="حذف">🗑️</button></td></tr>`).join('');}
}

// ========================================
// STATEMENT
// ========================================
function renderStatement(){
    const item=gv('statementItem'),ctr=gv('statementContractor');
    if(!item||!ctr){hide('statementContent');show('noStatementSelected');hide('printStatement');hide('pdfStatement');return;}
    show('statementContent');hide('noStatementSelected');show('printStatement');show('pdfStatement');
    gi('statementName').textContent=ctr;gi('statementItemBadge').textContent=item;
    const cp=payments.filter(p=>p.contractor===ctr&&p.item===item).sort((a,b)=>new Date(a.date)-new Date(b.date));
    const total=cp.reduce((s,p)=>s+p.amount,0);
    gi('statementTotal').textContent=fmtCur(total);gi('statementPayCount').textContent=cp.length.toLocaleString('ar-EG');
    const tb=gi('statementBody'),em=gi('statementEmpty');
    if(!cp.length){tb.innerHTML='';show('statementEmpty');hide('statementTable');}
    else{hide('statementEmpty');show('statementTable');tb.innerHTML=cp.map((p,i)=>`<tr style="animation-delay:${i*0.05}s"><td>${i+1}</td><td class="amount-cell">${fmtCur(p.amount)}</td><td class="date-cell">${fmtDate(p.date)}</td><td>${p.checkNo||'—'}</td><td>${p.notes||'—'}</td></tr>`).join('');}
}
function viewStatement(item,ctr){
    navigateTo('statement');gi('statementItem').value=item;fillContractorDD('statementContractor',item);
    setTimeout(()=>{gi('statementContractor').value=ctr;renderStatement();},50);
}

// ========================================
// EXTRACT / INVOICE SYSTEM
// ========================================
function onExtractContractorChange(){
    const item=gv('extractItemSelect'),ctr=gv('extractContractorSelect');
    if(!item||!ctr){hide('balanceCard');hide('extractContent');show('extractEmpty');hide('btnNewExtract');hide('extractNumberSelect');return;}
    show('btnNewExtract');
    // Load extracts for this contractor
    const cExtracts=extracts.filter(ex=>ex.contractor===ctr&&ex.item===item).sort((a,b)=>a.number-b.number);
    const sel=gi('extractNumberSelect');
    sel.innerHTML='<option value="">اختر المستخلص...</option>';
    cExtracts.forEach(ex=>{const o=document.createElement('option');o.value=ex.id;o.textContent=`مستخلص رقم ${ex.number}`;sel.appendChild(o);});
    if(cExtracts.length>=1){const o=document.createElement('option');o.value='combined';o.textContent='📊 مستخلص مجمع';sel.appendChild(o);}
    sel.disabled=false;sel.style.display='';
    // Show balance
    renderBalance(item,ctr);
    if(cExtracts.length){sel.value=cExtracts[cExtracts.length-1].id;onExtractNumberChange();}
    else{hide('extractContent');show('extractEmpty');gi('extractEmpty').querySelector('p').textContent='لا توجد مستخلصات — أنشئ مستخلص جديد';}
}
function onExtractNumberChange(){
    const exId=gv('extractNumberSelect');
    if(!exId){hide('extractContent');show('extractEmpty');return;}
    if(exId==='combined'){renderCombinedExtract();return;}
    currentExtractId=parseFloat(exId);
    show('extractContent');hide('extractEmpty');
    renderExtract();
}

function renderBalance(item,ctr){
    show('balanceCard');
    const cExtracts=extracts.filter(ex=>ex.contractor===ctr&&ex.item===item);
    const totalDue=cExtracts.reduce((s,ex)=>{
        return s+ex.rows.reduce((rs,r)=>{
            const totalQty=(r.prevQty||0)+(r.currentQty||0);
            const gross=totalQty*(r.price||0)*((r.itemPct||100)/100)*((r.disbursementPct||100)/100);
            return rs+gross-(r.deductions||0);
        },0);
    },0);
    const totalPaid=payments.filter(p=>p.contractor===ctr&&p.item===item).reduce((s,p)=>s+p.amount,0);
    const remaining=totalDue-totalPaid;
    gi('balExecuted').textContent=fmtCur(totalDue);
    gi('balPaid').textContent=fmtCur(totalPaid);
    gi('balRemaining').textContent=fmtCur(remaining);
    gi('balRemaining').className='balance-value '+(remaining>=0?'accent-cyan':'accent-red');
}

function renderExtract(){
    const ex=extracts.find(x=>x.id===currentExtractId);if(!ex)return;
    gi('extractNum').textContent=`مستخلص رقم ${ex.number}`;
    gi('extractContractorName').textContent=ex.contractor;
    gi('extractItemName').textContent=ex.item;
    gi('extractDate').value=ex.date||'';
    gi('extractNotes').value=ex.notes||'';
    const tb=gi('extractBody');
    tb.innerHTML=ex.rows.map((r,i)=>{
        const totalQty=(r.prevQty||0)+(r.currentQty||0);
        const gross=totalQty*(r.price||0)*((r.itemPct||100)/100)*((r.disbursementPct||100)/100);
        const rowTotal=gross-(r.deductions||0);
        return `<tr>
        <td>${toAr(i+1)}</td>
        <td><input type="text" class="extract-input" placeholder="يوم/شهر/سنة" value="${r.rowDate||''}" onchange="updateExtractRow(${i},'rowDate',this.value)"></td>
        <td><input type="text" class="extract-input" value="${r.buildingNo||''}" onchange="updateExtractRow(${i},'buildingNo',this.value)"></td>
        <td><input type="text" class="extract-input wide" value="${r.description||''}" onchange="updateExtractRow(${i},'description',this.value)"></td>
        <td><select class="extract-select" onchange="updateExtractRow(${i},'unit',this.value)">${UNITS.map(u=>`<option${r.unit===u?' selected':''}>${u}</option>`).join('')}</select></td>
        <td><select class="extract-select type-cell" onchange="updateExtractRow(${i},'type',this.value)">${WORK_TYPES.map(t=>`<option${r.type===t?' selected':''}>${t}</option>`).join('')}</select></td>
        <td><input type="number" class="extract-input num price-cell" value="${r.price||0}" min="0" step="0.01" onchange="updateExtractRow(${i},'price',parseFloat(this.value)||0)"></td>
        <td><input type="number" class="extract-input num" value="${r.itemPct||100}" min="0" max="100" step="1" onchange="updateExtractRow(${i},'itemPct',parseFloat(this.value)||0)"></td>
        <td><input type="number" class="extract-input num qty-cell" value="${r.prevQty||0}" min="0" step="0.01" onchange="updateExtractRow(${i},'prevQty',parseFloat(this.value)||0)"></td>
        <td><input type="number" class="extract-input num qty-cell" value="${r.currentQty||0}" min="0" step="0.01" onchange="updateExtractRow(${i},'currentQty',parseFloat(this.value)||0)"></td>
        <td class="amount-cell calculated">${fmtNum(totalQty)}</td>
        <td><input type="number" class="extract-input num" value="${r.disbursementPct||100}" min="0" max="100" step="1" onchange="updateExtractRow(${i},'disbursementPct',parseFloat(this.value)||0)"></td>
        <td><input type="number" class="extract-input num" value="${r.deductions||0}" min="0" step="0.01" onchange="updateExtractRow(${i},'deductions',parseFloat(this.value)||0)"></td>
        <td class="amount-cell calculated">${fmtNum(rowTotal)}</td>
        <td><button class="btn btn-icon-only btn-delete" onclick="removeExtractRow(${i})">🗑️</button></td>
    </tr>`;
    }).join('');
    calcExtractTotals(ex);
}

function updateExtractRow(idx,field,val){
    const ex=extracts.find(x=>x.id===currentExtractId);if(!ex||!ex.rows[idx])return;
    ex.rows[idx][field]=val;
    save();renderExtract();
    renderBalance(ex.item,ex.contractor);
}
function addExtractRow(){
    const ex=extracts.find(x=>x.id===currentExtractId);if(!ex)return;
    ex.rows.push({rowDate:'',buildingNo:'',description:'',type:'تنفيذ',unit:'م²',price:0,itemPct:100,prevQty:0,currentQty:0,disbursementPct:100,deductions:0});
    save();renderExtract();
}
function removeExtractRow(idx){
    const ex=extracts.find(x=>x.id===currentExtractId);if(!ex)return;
    ex.rows.splice(idx,1);save();renderExtract();
    renderBalance(ex.item,ex.contractor);
}
function renderCombinedExtract(){
    const item=gv('extractItemSelect'),ctr=gv('extractContractorSelect');
    const cExtracts=extracts.filter(ex=>ex.contractor===ctr&&ex.item===item).sort((a,b)=>a.number-b.number);
    if(!cExtracts.length)return;
    currentExtractId=null;
    show('extractContent');hide('extractEmpty');
    gi('extractNum').textContent='مستخلص مجمع';
    gi('extractContractorName').textContent=ctr;
    gi('extractItemName').textContent=item;
    gi('extractDate').value=today();
    gi('extractNotes').value='';
    const tb=gi('extractBody');
    let allRows=[],counter=0;
    cExtracts.forEach(ex=>{
        ex.rows.forEach(r=>{
            counter++;
            const totalQty=(r.prevQty||0)+(r.currentQty||0);
            const gross=totalQty*(r.price||0)*((r.itemPct||100)/100)*((r.disbursementPct||100)/100);
            const rowTotal=gross-(r.deductions||0);
            allRows.push(`<tr>
                <td>${toAr(counter)}</td>
                <td>${fmtDate(r.rowDate)}</td>
                <td>${r.buildingNo||'—'}</td>
                <td>${r.description||'—'}</td>
                <td>${r.unit||'—'}</td>
                <td>${r.type||'—'}</td>
                <td class="amount-cell">${fmtNum(r.price||0)}</td>
                <td>${toAr(r.itemPct||100)}%</td>
                <td>${fmtNum(r.prevQty||0)}</td>
                <td>${fmtNum(r.currentQty||0)}</td>
                <td class="amount-cell">${fmtNum(totalQty)}</td>
                <td>${toAr(r.disbursementPct||100)}%</td>
                <td>${fmtNum(r.deductions||0)}</td>
                <td class="amount-cell calculated">${fmtNum(rowTotal)}</td>
                <td><span class="badge">${toAr(ex.number)}</span></td>
            </tr>`);
        });
    });
    tb.innerHTML=allRows.join('');
    let grandTotal=0;
    cExtracts.forEach(ex=>ex.rows.forEach(r=>{
        const tq=(r.prevQty||0)+(r.currentQty||0);
        grandTotal+=tq*(r.price||0)*((r.itemPct||100)/100)*((r.disbursementPct||100)/100)-(r.deductions||0);
    }));
    gi('extractGrandTotal').textContent=fmtNum(grandTotal);
}
function calcExtractTotals(ex){
    let grandTotal=0;
    ex.rows.forEach(r=>{
        const totalQty=(r.prevQty||0)+(r.currentQty||0);
        const gross=totalQty*(r.price||0)*((r.itemPct||100)/100)*((r.disbursementPct||100)/100);
        grandTotal+=gross-(r.deductions||0);
    });
    gi('extractGrandTotal').textContent=fmtNum(grandTotal);
}
function saveCurrentExtract(){
    const ex=extracts.find(x=>x.id===currentExtractId);if(!ex)return;
    ex.date=gv('extractDate');ex.notes=gv('extractNotes').trim();
    save();
    showToast('💾 تم حفظ المستخلص','success');
}
function deleteCurrentExtract(){
    if(!currentExtractId)return;
    deleteTarget=currentExtractId;deleteType='extract';
    gi('deleteModalText').innerHTML='هل تريد حذف هذا المستخلص؟';
    openModal('deleteModal');
}

function openNewExtractModal(){
    const item=gv('extractItemSelect'),ctr=gv('extractContractorSelect');
    if(!item||!ctr){showToast('اختر المقاول أولاً','error');return;}
    gi('newExtractDate').value=today();openModal('newExtractModal');
}
function submitNewExtract(e){
    e.preventDefault();
    const item=gv('extractItemSelect'),ctr=gv('extractContractorSelect'),date=gv('newExtractDate'),notes=gv('newExtractNotes').trim();
    const cExtracts=extracts.filter(ex=>ex.contractor===ctr&&ex.item===item);
    const num=cExtracts.length?Math.max(...cExtracts.map(ex=>ex.number))+1:1;
    const newEx={id:uid(),contractor:ctr,item,number:num,date,notes,rows:[{rowDate:'',buildingNo:'',description:'',type:'تنفيذ',unit:'م²',price:0,itemPct:100,prevQty:0,currentQty:0,disbursementPct:100,deductions:0}]};
    extracts.push(newEx);save();
    closeModal('newExtractModal');e.target.reset();
    onExtractContractorChange();
    // Select the new one
    setTimeout(()=>{gi('extractNumberSelect').value=newEx.id;onExtractNumberChange();},100);
    showToast(`✅ تم إنشاء مستخلص رقم ${num}`,'success');
}

function printExtract(){
    const ex=extracts.find(x=>x.id===currentExtractId);if(!ex)return;
    let grandTotal=0;
    ex.rows.forEach(r=>{
        const tq=(r.prevQty||0)+(r.currentQty||0);
        grandTotal+=tq*(r.price||0)*((r.itemPct||100)/100)*((r.disbursementPct||100)/100)-(r.deductions||0);
    });
    const totalPaid=payments.filter(p=>p.contractor===ex.contractor&&p.item===ex.item).reduce((s,p)=>s+p.amount,0);
    const th='padding:8px;border:1px solid #bbb;text-align:center;font-size:12px;';
    const td='padding:6px;border:1px solid #ddd;text-align:center;font-size:11px;';
    const headers=['م','التاريخ','رقم العمارة','بيان الأعمال','الوحدة','النوع','السعر','نسبة البند%','كمية سابقة','كمية حالية','مجموع الكميات','نسبة الصرف%','الاستقطاعات','إجمالي المستحق'];
    const html=`<div style="font-family:Cairo,sans-serif;direction:rtl;padding:20px;color:#333;">
        <h2 style="text-align:center;margin:0 0 2px;color:#555;font-size:15px;">شركة الرحاب للمقاولات العموميه (ورثة سيد تهامى)</h2>
        <h2 style="text-align:center;margin:0 0 5px;color:#555;">المشروع : التوسعات الجنوبيه</h2>
        <h1 style="text-align:center;border-bottom:3px solid #333;padding-bottom:10px;">مستخلص رقم ${ex.number}</h1>
        <table style="width:100%;margin:20px 0;border-collapse:collapse;font-size:16px;">
            <tr><td style="padding:10px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">المقاول</td><td style="padding:10px;border:1px solid #ddd;font-size:18px;font-weight:700;">${ex.contractor}</td>
            <td style="padding:10px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">البند</td><td style="padding:10px;border:1px solid #ddd;font-size:18px;font-weight:700;">${ex.item}</td>
            <td style="padding:10px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">التاريخ</td><td style="padding:10px;border:1px solid #ddd;">${fmtDate(ex.date)}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <thead><tr style="background:#e0e0e0;">${headers.map(h=>`<th style="${th}">${h}</th>`).join('')}</tr></thead>
            <tbody>${ex.rows.map((r,i)=>{
                const tq=(r.prevQty||0)+(r.currentQty||0);
                const rowTotal=tq*(r.price||0)*((r.itemPct||100)/100)*((r.disbursementPct||100)/100)-(r.deductions||0);
                return `<tr>${[toAr(i+1),fmtDate(r.rowDate),r.buildingNo||'—',r.description||'—',r.unit,r.type,fmtNum(r.price),toAr(r.itemPct)+'%',fmtNum(r.prevQty||0),fmtNum(r.currentQty||0),fmtNum(tq),toAr(r.disbursementPct)+'%',fmtNum(r.deductions||0),fmtNum(rowTotal)].map(c=>`<td style="${td}">${c}</td>`).join('')}</tr>`;
            }).join('')}</tbody>
            <tfoot><tr style="background:#f0f0f0;font-weight:bold;"><td colspan="13" style="${th}">إجمالي المستحق للمقاول</td><td style="${th}">${fmtNum(grandTotal)}</td></tr></tfoot>
        </table>
        <table style="width:50%;margin:0 auto;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:10px;border:1px solid #ddd;background:#e8f5e9;font-weight:bold;">إجمالي المستحق</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">${fmtCur(grandTotal)}</td></tr>
            <tr><td style="padding:10px;border:1px solid #ddd;background:#fff3e0;font-weight:bold;">إجمالي المنصرف</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">${fmtCur(totalPaid)}</td></tr>
            <tr><td style="padding:10px;border:1px solid #ddd;background:#e3f2fd;font-weight:bold;">الباقي للمقاول</td><td style="padding:10px;border:1px solid #ddd;text-align:center;font-weight:bold;">${fmtCur(grandTotal-totalPaid)}</td></tr>
        </table>
        ${ex.notes?`<p style="margin-top:16px;padding:10px;background:#f5f5f5;border-radius:8px;"><strong>ملاحظات:</strong> ${ex.notes}</p>`:''}
    </div>`;
    const w=window.open('','_blank','width=1100,height=700');
    w.document.write(`<html dir="rtl"><head><title>مستخلص رقم ${ex.number} - ${ex.contractor}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"><style>@page{size:landscape;margin:10mm}@media print{body{margin:0;-webkit-print-color-adjust:exact}table{font-size:10px;width:100%!important}}</style></head><body>${html}<script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
    w.document.close();
}

// ========================================
// PDF SAVE
// ========================================
function buildExtractHTML(){
    const ex=extracts.find(x=>x.id===currentExtractId);if(!ex)return null;
    let grandTotal=0;
    ex.rows.forEach(r=>{
        const tq=(r.prevQty||0)+(r.currentQty||0);
        grandTotal+=tq*(r.price||0)*((r.itemPct||100)/100)*((r.disbursementPct||100)/100)-(r.deductions||0);
    });
    const totalPaid=payments.filter(p=>p.contractor===ex.contractor&&p.item===ex.item).reduce((s,p)=>s+p.amount,0);
    const th='padding:6px;border:1px solid #bbb;text-align:center;font-size:11px;';
    const td='padding:5px;border:1px solid #ddd;text-align:center;font-size:10px;';
    const headers=['م','التاريخ','رقم العمارة','بيان الأعمال','الوحدة','النوع','السعر','نسبة البند%','كمية سابقة','كمية حالية','مجموع الكميات','نسبة الصرف%','الاستقطاعات','إجمالي المستحق'];
    return {ex, grandTotal, totalPaid, html:`<div style="font-family:Cairo,sans-serif;direction:rtl;padding:15px;color:#333;">
        <h3 style="text-align:center;margin:0 0 2px;color:#555;font-size:13px;">شركة الرحاب للمقاولات العموميه (ورثة سيد تهامى)</h3>
        <h3 style="text-align:center;margin:0 0 4px;color:#555;font-size:12px;">المشروع : التوسعات الجنوبيه</h3>
        <h2 style="text-align:center;border-bottom:2px solid #333;padding-bottom:8px;font-size:16px;">مستخلص رقم ${ex.number}</h2>
        <table style="width:100%;margin:12px 0;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">المقاول</td><td style="padding:6px;border:1px solid #ddd;font-size:14px;font-weight:700;">${ex.contractor}</td>
            <td style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">البند</td><td style="padding:6px;border:1px solid #ddd;font-size:14px;font-weight:700;">${ex.item}</td>
            <td style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">التاريخ</td><td style="padding:6px;border:1px solid #ddd;">${fmtDate(ex.date)}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
            <thead><tr style="background:#e0e0e0;">${headers.map(h=>`<th style="${th}">${h}</th>`).join('')}</tr></thead>
            <tbody>${ex.rows.map((r,i)=>{
                const tq=(r.prevQty||0)+(r.currentQty||0);
                const rowTotal=tq*(r.price||0)*((r.itemPct||100)/100)*((r.disbursementPct||100)/100)-(r.deductions||0);
                return `<tr>${[toAr(i+1),fmtDate(r.rowDate),r.buildingNo||'—',r.description||'—',r.unit,r.type,fmtNum(r.price),toAr(r.itemPct)+'%',fmtNum(r.prevQty||0),fmtNum(r.currentQty||0),fmtNum(tq),toAr(r.disbursementPct)+'%',fmtNum(r.deductions||0),fmtNum(rowTotal)].map(c=>`<td style="${td}">${c}</td>`).join('')}</tr>`;
            }).join('')}</tbody>
            <tfoot><tr style="background:#f0f0f0;font-weight:bold;"><td colspan="13" style="${th}">إجمالي المستحق للمقاول</td><td style="${th}">${fmtNum(grandTotal)}</td></tr></tfoot>
        </table>
        <table style="width:50%;margin:0 auto;border-collapse:collapse;font-size:12px;">
            <tr><td style="padding:8px;border:1px solid #ddd;background:#e8f5e9;font-weight:bold;">إجمالي المستحق</td><td style="padding:8px;border:1px solid #ddd;text-align:center;">${fmtCur(grandTotal)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;background:#fff3e0;font-weight:bold;">إجمالي المنصرف</td><td style="padding:8px;border:1px solid #ddd;text-align:center;">${fmtCur(totalPaid)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;background:#e3f2fd;font-weight:bold;">الباقي للمقاول</td><td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;">${fmtCur(grandTotal-totalPaid)}</td></tr>
        </table>
    </div>`};
}

function saveExtractPDF(){
    const data=buildExtractHTML();if(!data)return;
    const container=document.createElement('div');
    container.innerHTML=data.html;
    document.body.appendChild(container);
    html2pdf().set({
        margin:5,
        filename:`مستخلص_${data.ex.number}_${data.ex.contractor}.pdf`,
        image:{type:'jpeg',quality:0.98},
        html2canvas:{scale:2,useCORS:true,scrollY:0},
        jsPDF:{unit:'mm',format:'a4',orientation:'landscape'}
    }).from(container).save().then(()=>{
        document.body.removeChild(container);
        showToast('✅ تم حفظ المستخلص كـ PDF','success');
    });
}

function saveStatementPDF(){
    const content=gi('statementContent');if(!content)return;
    const ctr=gv('statementContractor'),item=gv('statementItem');
    // Clone and add header
    const clone=content.cloneNode(true);
    clone.style.display='block';
    clone.style.direction='rtl';
    clone.style.fontFamily='Cairo,sans-serif';
    clone.style.padding='15px';
    clone.style.color='#333';
    clone.style.background='#fff';
    // Add company & project name at top
    const header=document.createElement('div');
    header.innerHTML=`<h3 style="text-align:center;margin:0 0 2px;font-size:13px;">شركة الرحاب للمقاولات العموميه (ورثة سيد تهامى)</h3><h3 style="text-align:center;margin:0 0 8px;font-size:12px;">المشروع : التوسعات الجنوبيه</h3>`;
    clone.insertBefore(header,clone.firstChild);
    // Remove print-only divs (already added via header)
    clone.querySelectorAll('.print-only').forEach(el=>el.remove());
    document.body.appendChild(clone);
    html2pdf().set({
        margin:8,
        filename:`كشف_حساب_${ctr}_${item}.pdf`,
        image:{type:'jpeg',quality:0.98},
        html2canvas:{scale:2,useCORS:true,scrollY:0},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).from(clone).save().then(()=>{
        document.body.removeChild(clone);
        showToast('✅ تم حفظ كشف الحساب كـ PDF','success');
    });
}

// ========================================
// SUPPLIERS PAGE
// ========================================
function isSupplyItem(item){ return supplyItemsList.includes(item); }

function initSupplierListeners(){
    const bind=(id,evt,fn)=>{const el=gi(id);if(el)el.addEventListener(evt,fn);};
    bind('supplierSearch','input',renderSuppliers);
    bind('supplyItemFilter','change',renderSuppliers);
    bind('supExtractItemSelect','change',e=>{
        fillSupplierDD('supExtractSupplierSelect',e.target.value);
        hide('supBalanceCard');hide('supExtractContent');show('supExtractEmpty');hide('btnNewSupExtract');hide('supExtractNumberSelect');
    });
    bind('supExtractSupplierSelect','change',onSupExtractSupplierChange);
    bind('supExtractNumberSelect','change',onSupExtractNumberChange);
    bind('newSupExtractForm','submit',submitNewSupExtract);
}

function populateSupplyDropdowns(){
    // Supply item filter on suppliers page
    const filterSel=gi('supplyItemFilter');
    if(filterSel){
        const first=filterSel.options[0];filterSel.innerHTML='';filterSel.appendChild(first);
        items.filter(i=>isSupplyItem(i)).forEach(it=>{const o=document.createElement('option');o.value=it;o.textContent=it;filterSel.appendChild(o);});
    }
    // Extract dropdowns
    const extSel=gi('supExtractItemSelect');
    if(extSel){
        const first=extSel.options[0];extSel.innerHTML='';extSel.appendChild(first);
        items.filter(i=>isSupplyItem(i)).forEach(it=>{const o=document.createElement('option');o.value=it;o.textContent=it;extSel.appendChild(o);});
    }
    // Add supplier modal item dropdown
    const addSel=gi('addSupplierItem');
    if(addSel){
        const first=addSel.options[0];addSel.innerHTML='';addSel.appendChild(first);
        items.filter(i=>isSupplyItem(i)).forEach(it=>{const o=document.createElement('option');o.value=it;o.textContent=it;addSel.appendChild(o);});
    }
}

function fillSupplierDD(selId,item){
    const s=gi(selId);if(!s)return;
    s.innerHTML='<option value="">اختر المورد...</option>';
    if(!item){s.disabled=true;return;}
    contractors.filter(c=>c.item===item).forEach(c=>{const o=document.createElement('option');o.value=c.name;o.textContent=c.name;s.appendChild(o);});
    s.disabled=false;
}

function renderSuppliers(){
    const search=(gi('supplierSearch')?gv('supplierSearch'):'').trim().toLowerCase();
    const itemF=gi('supplyItemFilter')?gv('supplyItemFilter'):'';
    const totals={};
    payments.forEach(p=>{const k=p.contractor+'|'+p.item;totals[k]=(totals[k]||0)+p.amount;});
    const container=gi('suppliersGrouped');if(!container)return;
    const supItems=itemF?items.filter(i=>i===itemF&&isSupplyItem(i)):items.filter(i=>isSupplyItem(i));
    let totalShown=0;
    container.innerHTML=supItems.map((item,ii)=>{
        let sups=contractors.filter(c=>c.item===item);
        if(search)sups=sups.filter(c=>c.name.toLowerCase().includes(search)||c.item.toLowerCase().includes(search));
        if(!sups.length&&search)return '';
        totalShown+=sups.length;
        const color=getColor(item);
        return `<div class="item-group">
            <div class="item-group-header" style="--item-color:${color}">
                <div class="item-group-title"><span class="item-dot" style="background:${color}"></span><h3>${item}</h3><span class="badge">${sups.length} مورد</span></div>
                <div class="action-buttons">
                    <button class="btn btn-icon-only btn-view" onclick="openEditItem('${esc(item)}')" title="تعديل البند">✏️</button>
                </div>
            </div>
            <div class="item-group-body">
                <table class="data-table"><thead><tr><th style="width:40px">م</th><th>اسم المورد</th><th>إجمالي المدفوع</th><th style="width:140px">إجراء</th></tr></thead>
                <tbody>${sups.map((c,ci)=>{
                    const t=totals[c.name+'|'+c.item]||0;
                    return `<tr style="animation-delay:${ci*0.02}s"><td>${ci+1}</td><td><strong>${c.name}</strong></td><td class="amount-cell">${fmtCur(t)}</td>
                    <td class="action-buttons">
                        <button class="btn btn-icon-only btn-view" onclick="openEditContractor(${c.id})" title="تعديل">✏️</button>
                        <button class="btn btn-icon-only btn-view" onclick="viewStatement('${esc(c.item)}','${esc(c.name)}')" title="كشف حساب">🧾</button>
                        <button class="btn btn-icon-only btn-delete" onclick="confirmDeleteContractor(${c.id})" title="حذف">🗑️</button>
                    </td></tr>`;
                }).join('')}</tbody></table>
            </div>
        </div>`;
    }).join('');
    const cnt=gi('supplierCount');if(cnt)cnt.textContent=`${totalShown} مورد`;
}

function submitAddSupplier(e){
    e.preventDefault();
    const name=gv('addSupplierName').trim(),item=gv('addSupplierItem');
    if(!name||!item){showToast('يرجى ملء الاسم والبند','error');return;}
    if(contractors.some(c=>c.name===name&&c.item===item)){showToast('⚠️ المورد موجود بالفعل','error');return;}
    contractors.push({id:contractors.length?Math.max(...contractors.map(c=>c.id))+1:1,name,item});
    save();renderAll();populateDropdowns();populateSupplyDropdowns();
    e.target.reset();closeModal('addSupplierModal');
    showToast(`✅ تمت إضافة "${name}" في "${item}"`,'success');
}

function submitAddSupplyItem(e){
    e.preventDefault();
    const name=gv('addSupplyItemName').trim();
    if(!name){showToast('يرجى إدخال اسم البند','error');return;}
    if(items.includes(name)){showToast('⚠️ البند موجود بالفعل','error');return;}
    items.push(name);
    if(!supplyItemsList.includes(name)) supplyItemsList.push(name);
    save();populateDropdowns();populateSupplyDropdowns();renderAll();
    e.target.reset();closeModal('addSupplyItemModal');
    showToast(`✅ تمت إضافة بند توريد "${name}"`,'success');
}

// ========================================
// SUPPLIER EXTRACTS
// ========================================
function onSupExtractSupplierChange(){
    const item=gv('supExtractItemSelect'),sup=gv('supExtractSupplierSelect');
    if(!item||!sup){hide('supBalanceCard');hide('supExtractContent');show('supExtractEmpty');hide('btnNewSupExtract');hide('supExtractNumberSelect');return;}
    show('btnNewSupExtract');
    const sExtracts=supplierExtracts.filter(ex=>ex.supplier===sup&&ex.item===item).sort((a,b)=>a.number-b.number);
    const sel=gi('supExtractNumberSelect');
    sel.innerHTML='<option value="">اختر المستخلص...</option>';
    sExtracts.forEach(ex=>{const o=document.createElement('option');o.value=ex.id;o.textContent=`مستخلص رقم ${ex.number}`;sel.appendChild(o);});
    if(sExtracts.length>=1){const o=document.createElement('option');o.value='combined';o.textContent='📊 مستخلص مجمع';sel.appendChild(o);}
    sel.disabled=false;sel.style.display='';
    // Balance
    renderSupBalance(item,sup);
    if(sExtracts.length){sel.value=sExtracts[sExtracts.length-1].id;onSupExtractNumberChange();}
    else{hide('supExtractContent');show('supExtractEmpty');}
}

function renderSupBalance(item,sup){
    let executed=0;
    supplierExtracts.filter(ex=>ex.supplier===sup&&ex.item===item).forEach(ex=>{
        ex.rows.forEach(r=>{executed+=(r.qty||0)*(r.price||0)-(r.discounts||0);});
    });
    const paid=payments.filter(p=>p.contractor===sup&&p.item===item).reduce((s,p)=>s+p.amount,0);
    gi('supBalExecuted').textContent=fmtCur(executed);
    gi('supBalPaid').textContent=fmtCur(paid);
    gi('supBalRemaining').textContent=fmtCur(executed-paid);
    show('supBalanceCard');
}

function onSupExtractNumberChange(){
    const exId=gv('supExtractNumberSelect');
    if(!exId){hide('supExtractContent');show('supExtractEmpty');return;}
    if(exId==='combined'){renderCombinedSupExtract();return;}
    currentSupExtractId=parseFloat(exId);
    show('supExtractContent');hide('supExtractEmpty');
    renderSupExtract();
}

function renderSupExtract(){
    const ex=supplierExtracts.find(x=>x.id===currentSupExtractId);if(!ex)return;
    gi('supExtractNum').textContent=`مستخلص رقم ${ex.number}`;
    gi('supExtractSupplierName').textContent=ex.supplier;
    gi('supExtractItemName').textContent=ex.item;
    gi('supExtractDate').value=ex.date||'';
    gi('supExtractNotes').value=ex.notes||'';
    const tb=gi('supExtractBody');
    tb.innerHTML=ex.rows.map((r,i)=>{
        const rowTotal=(r.qty||0)*(r.price||0)-(r.discounts||0);
        return `<tr>
        <td>${toAr(i+1)}</td>
        <td><input type="text" class="extract-input" placeholder="يوم/شهر/سنة" value="${r.rowDate||''}" onchange="updateSupExtractRow(${i},'rowDate',this.value)"></td>
        <td><input type="text" class="extract-input wide" value="${r.description||''}" onchange="updateSupExtractRow(${i},'description',this.value)"></td>
        <td><select class="extract-select" onchange="updateSupExtractRow(${i},'unit',this.value)">${SUPPLY_UNITS.map(u=>`<option${r.unit===u?' selected':''}>${u}</option>`).join('')}</select></td>
        <td><input type="text" class="extract-input" value="${r.invoiceNo||''}" onchange="updateSupExtractRow(${i},'invoiceNo',this.value)"></td>
        <td><input type="number" class="extract-input num qty-cell" value="${r.qty||0}" min="0" step="0.01" onchange="updateSupExtractRow(${i},'qty',parseFloat(this.value)||0)"></td>
        <td><input type="number" class="extract-input num price-cell" value="${r.price||0}" min="0" step="0.01" onchange="updateSupExtractRow(${i},'price',parseFloat(this.value)||0)"></td>
        <td><input type="number" class="extract-input num" value="${r.discounts||0}" min="0" step="0.01" onchange="updateSupExtractRow(${i},'discounts',parseFloat(this.value)||0)"></td>
        <td class="amount-cell calculated">${fmtNum(rowTotal)}</td>
        <td><button class="btn btn-icon-only btn-delete" onclick="removeSupExtractRow(${i})">🗑️</button></td>
    </tr>`;
    }).join('');
    calcSupExtractTotals(ex);
}

function updateSupExtractRow(idx,field,val){
    const ex=supplierExtracts.find(x=>x.id===currentSupExtractId);if(!ex||!ex.rows[idx])return;
    ex.rows[idx][field]=val;
    save();renderSupExtract();
    renderSupBalance(ex.item,ex.supplier);
}
function addSupExtractRow(){
    const ex=supplierExtracts.find(x=>x.id===currentSupExtractId);if(!ex)return;
    ex.rows.push({rowDate:'',description:'',unit:'عدد',invoiceNo:'',qty:0,price:0,discounts:0});
    save();renderSupExtract();
}
function removeSupExtractRow(idx){
    const ex=supplierExtracts.find(x=>x.id===currentSupExtractId);if(!ex)return;
    ex.rows.splice(idx,1);save();renderSupExtract();
    renderSupBalance(ex.item,ex.supplier);
}
function renderCombinedSupExtract(){
    const item=gv('supExtractItemSelect'),sup=gv('supExtractSupplierSelect');
    const sExtracts=supplierExtracts.filter(ex=>ex.supplier===sup&&ex.item===item).sort((a,b)=>a.number-b.number);
    if(!sExtracts.length)return;
    currentSupExtractId=null;
    show('supExtractContent');hide('supExtractEmpty');
    gi('supExtractNum').textContent='مستخلص مجمع';
    gi('supExtractSupplierName').textContent=sup;
    gi('supExtractItemName').textContent=item;
    gi('supExtractDate').value=today();
    gi('supExtractNotes').value='';
    const tb=gi('supExtractBody');
    let allRows=[],counter=0;
    sExtracts.forEach(ex=>{
        ex.rows.forEach(r=>{
            counter++;
            const rowTotal=(r.qty||0)*(r.price||0)-(r.discounts||0);
            allRows.push(`<tr>
                <td>${toAr(counter)}</td>
                <td>${fmtDate(r.rowDate)}</td>
                <td>${r.description||'—'}</td>
                <td>${r.unit||'—'}</td>
                <td>${r.invoiceNo||'—'}</td>
                <td class="amount-cell">${fmtNum(r.qty||0)}</td>
                <td class="amount-cell">${fmtNum(r.price||0)}</td>
                <td>${fmtNum(r.discounts||0)}</td>
                <td class="amount-cell calculated">${fmtNum(rowTotal)}</td>
                <td><span class="badge">${toAr(ex.number)}</span></td>
            </tr>`);
        });
    });
    tb.innerHTML=allRows.join('');
    let grandTotal=0;
    sExtracts.forEach(ex=>ex.rows.forEach(r=>{grandTotal+=(r.qty||0)*(r.price||0)-(r.discounts||0);}));
    gi('supExtractGrandTotal').textContent=fmtNum(grandTotal);
}
function calcSupExtractTotals(ex){
    let grandTotal=0;
    ex.rows.forEach(r=>{grandTotal+=(r.qty||0)*(r.price||0)-(r.discounts||0);});
    gi('supExtractGrandTotal').textContent=fmtNum(grandTotal);
}
function saveCurrentSupExtract(){
    const ex=supplierExtracts.find(x=>x.id===currentSupExtractId);if(!ex)return;
    ex.date=gv('supExtractDate');ex.notes=gv('supExtractNotes').trim();
    save();showToast('💾 تم حفظ المستخلص','success');
}
function deleteCurrentSupExtract(){
    if(!currentSupExtractId)return;
    deleteTarget=currentSupExtractId;deleteType='supExtract';
    gi('deleteModalText').innerHTML='هل تريد حذف هذا المستخلص؟';
    openModal('deleteModal');
}

function openNewSupExtractModal(){
    const item=gv('supExtractItemSelect'),sup=gv('supExtractSupplierSelect');
    if(!item||!sup){showToast('اختر المورد أولاً','error');return;}
    gi('newSupExtractDate').value=today();openModal('newSupExtractModal');
}
function submitNewSupExtract(e){
    e.preventDefault();
    const item=gv('supExtractItemSelect'),sup=gv('supExtractSupplierSelect'),date=gv('newSupExtractDate'),notes=gv('newSupExtractNotes').trim();
    const sExtracts=supplierExtracts.filter(ex=>ex.supplier===sup&&ex.item===item);
    const num=sExtracts.length?Math.max(...sExtracts.map(ex=>ex.number))+1:1;
    const newEx={id:uid(),supplier:sup,item,number:num,date,notes,rows:[{description:'',unit:'عدد',invoiceNo:'',qty:0,price:0,discounts:0}]};
    supplierExtracts.push(newEx);save();
    closeModal('newSupExtractModal');e.target.reset();
    onSupExtractSupplierChange();
    currentSupExtractId=newEx.id;
    const sel=gi('supExtractNumberSelect');if(sel)sel.value=newEx.id;
    onSupExtractNumberChange();
    showToast(`✅ تم إنشاء مستخلص رقم ${num}`,'success');
}

// ========================================
// SUPPLIER EXTRACT PRINT & PDF
// ========================================
function printSupExtract(){
    const ex=supplierExtracts.find(x=>x.id===currentSupExtractId);if(!ex)return;
    let grandTotal=0;
    ex.rows.forEach(r=>{grandTotal+=(r.qty||0)*(r.price||0)-(r.discounts||0);});
    const totalPaid=payments.filter(p=>p.contractor===ex.supplier&&p.item===ex.item).reduce((s,p)=>s+p.amount,0);
    const th='padding:8px;border:1px solid #bbb;text-align:center;font-size:12px;';
    const td='padding:6px;border:1px solid #ddd;text-align:center;font-size:11px;';
    const headers=['م','التاريخ','البيان','الوحدة','رقم الفاتورة','الكمية','السعر','خصومات','إجمالي المستحق'];
    const html=`<div style="font-family:Cairo,sans-serif;direction:rtl;padding:20px;color:#333;">
        <h2 style="text-align:center;margin:0 0 2px;color:#555;font-size:15px;">شركة الرحاب للمقاولات العموميه (ورثة سيد تهامى)</h2>
        <h2 style="text-align:center;margin:0 0 5px;color:#555;">المشروع : التوسعات الجنوبيه</h2>
        <h1 style="text-align:center;border-bottom:3px solid #333;padding-bottom:10px;">مستخلص مورد رقم ${ex.number}</h1>
        <table style="width:100%;margin:20px 0;border-collapse:collapse;font-size:16px;">
            <tr><td style="padding:10px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">المورد</td><td style="padding:10px;border:1px solid #ddd;font-size:18px;font-weight:700;">${ex.supplier}</td>
            <td style="padding:10px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">البند</td><td style="padding:10px;border:1px solid #ddd;font-size:18px;font-weight:700;">${ex.item}</td>
            <td style="padding:10px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">التاريخ</td><td style="padding:10px;border:1px solid #ddd;">${fmtDate(ex.date)}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <thead><tr style="background:#e0e0e0;">${headers.map(h=>`<th style="${th}">${h}</th>`).join('')}</tr></thead>
            <tbody>${ex.rows.map((r,i)=>{
                const rowTotal=(r.qty||0)*(r.price||0)-(r.discounts||0);
                return `<tr>${[toAr(i+1),fmtDate(r.rowDate),r.description||'—',r.unit,r.invoiceNo||'—',fmtNum(r.qty||0),fmtNum(r.price||0),fmtNum(r.discounts||0),fmtNum(rowTotal)].map(c=>`<td style="${td}">${c}</td>`).join('')}</tr>`;
            }).join('')}</tbody>
            <tfoot><tr style="background:#f0f0f0;font-weight:bold;"><td colspan="8" style="${th}">إجمالي المستحق للمورد</td><td style="${th}">${fmtNum(grandTotal)}</td></tr></tfoot>
        </table>
        <table style="width:50%;margin:0 auto;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:10px;border:1px solid #ddd;background:#e8f5e9;font-weight:bold;">إجمالي المستحق</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">${fmtCur(grandTotal)}</td></tr>
            <tr><td style="padding:10px;border:1px solid #ddd;background:#fff3e0;font-weight:bold;">إجمالي المنصرف</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">${fmtCur(totalPaid)}</td></tr>
            <tr><td style="padding:10px;border:1px solid #ddd;background:#e3f2fd;font-weight:bold;">الباقي للمورد</td><td style="padding:10px;border:1px solid #ddd;text-align:center;font-weight:bold;">${fmtCur(grandTotal-totalPaid)}</td></tr>
        </table>
        ${ex.notes?`<p style="margin-top:16px;padding:10px;background:#f5f5f5;border-radius:8px;"><strong>ملاحظات:</strong> ${ex.notes}</p>`:''}
    </div>`;
    const w=window.open('','_blank','width=1100,height=700');
    w.document.write(`<html dir="rtl"><head><title>مستخلص مورد رقم ${ex.number} - ${ex.supplier}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"><style>@page{size:landscape;margin:10mm}@media print{body{margin:0;-webkit-print-color-adjust:exact}table{font-size:10px;width:100%!important}}</style></head><body>${html}<script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
    w.document.close();
}

function saveSupExtractPDF(){
    const ex=supplierExtracts.find(x=>x.id===currentSupExtractId);if(!ex)return;
    let grandTotal=0;
    ex.rows.forEach(r=>{grandTotal+=(r.qty||0)*(r.price||0)-(r.discounts||0);});
    const totalPaid=payments.filter(p=>p.contractor===ex.supplier&&p.item===ex.item).reduce((s,p)=>s+p.amount,0);
    const th='padding:6px;border:1px solid #bbb;text-align:center;font-size:11px;';
    const td='padding:5px;border:1px solid #ddd;text-align:center;font-size:10px;';
    const headers=['م','التاريخ','البيان','الوحدة','رقم الفاتورة','الكمية','السعر','خصومات','إجمالي المستحق'];
    const pdfHtml=`<div style="font-family:Cairo,sans-serif;direction:rtl;padding:15px;color:#333;">
        <h3 style="text-align:center;margin:0 0 2px;font-size:13px;">شركة الرحاب للمقاولات العموميه (ورثة سيد تهامى)</h3>
        <h3 style="text-align:center;margin:0 0 4px;font-size:12px;">المشروع : التوسعات الجنوبيه</h3>
        <h2 style="text-align:center;border-bottom:2px solid #333;padding-bottom:8px;font-size:16px;">مستخلص مورد رقم ${ex.number}</h2>
        <table style="width:100%;margin:12px 0;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">المورد</td><td style="padding:6px;border:1px solid #ddd;font-size:14px;font-weight:700;">${ex.supplier}</td>
            <td style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">البند</td><td style="padding:6px;border:1px solid #ddd;font-size:14px;font-weight:700;">${ex.item}</td>
            <td style="padding:6px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">التاريخ</td><td style="padding:6px;border:1px solid #ddd;">${fmtDate(ex.date)}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
            <thead><tr style="background:#e0e0e0;">${headers.map(h=>`<th style="${th}">${h}</th>`).join('')}</tr></thead>
            <tbody>${ex.rows.map((r,i)=>{
                const rowTotal=(r.qty||0)*(r.price||0)-(r.discounts||0);
                return `<tr>${[toAr(i+1),fmtDate(r.rowDate),r.description||'—',r.unit,r.invoiceNo||'—',fmtNum(r.qty||0),fmtNum(r.price||0),fmtNum(r.discounts||0),fmtNum(rowTotal)].map(c=>`<td style="${td}">${c}</td>`).join('')}</tr>`;
            }).join('')}</tbody>
            <tfoot><tr style="background:#f0f0f0;font-weight:bold;"><td colspan="8" style="${th}">إجمالي المستحق للمورد</td><td style="${th}">${fmtNum(grandTotal)}</td></tr></tfoot>
        </table>
        <table style="width:50%;margin:0 auto;border-collapse:collapse;font-size:12px;">
            <tr><td style="padding:8px;border:1px solid #ddd;background:#e8f5e9;font-weight:bold;">إجمالي المستحق</td><td style="padding:8px;border:1px solid #ddd;text-align:center;">${fmtCur(grandTotal)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;background:#fff3e0;font-weight:bold;">إجمالي المنصرف</td><td style="padding:8px;border:1px solid #ddd;text-align:center;">${fmtCur(totalPaid)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;background:#e3f2fd;font-weight:bold;">الباقي للمورد</td><td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;">${fmtCur(grandTotal-totalPaid)}</td></tr>
        </table>
    </div>`;
    const container=document.createElement('div');
    container.innerHTML=pdfHtml;
    document.body.appendChild(container);
    html2pdf().set({
        margin:5,
        filename:`مستخلص_مورد_${ex.number}_${ex.supplier}.pdf`,
        image:{type:'jpeg',quality:0.98},
        html2canvas:{scale:2,useCORS:true,scrollY:0},
        jsPDF:{unit:'mm',format:'a4',orientation:'landscape'}
    }).from(container).save().then(()=>{
        document.body.removeChild(container);
        showToast('✅ تم حفظ المستخلص كـ PDF','success');
    });
}

// ========================================
// CHARTS
// ========================================
function renderCharts(){
    // Pie
    const pc=gi('pieChart'),pe=gi('pieEmpty');
    const it={};payments.forEach(p=>{it[p.item]=(it[p.item]||0)+p.amount;});
    const ie=Object.entries(it).sort((a,b)=>b[1]-a[1]);
    if(!ie.length){pe.classList.remove('hidden');if(pieChart){pieChart.destroy();pieChart=null;}return;}
    pe.classList.add('hidden');
    if(pieChart)pieChart.destroy();
    pieChart=new Chart(pc,{type:'doughnut',data:{labels:ie.map(e=>e[0]),datasets:[{data:ie.map(e=>e[1]),backgroundColor:ie.map(e=>getColor(e[0])+'99'),borderColor:ie.map(e=>getColor(e[0])),borderWidth:2,hoverOffset:8}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',rtl:true,labels:{color:'#e8eaf6',font:{family:'Cairo',size:11},padding:12,usePointStyle:true,pointStyleWidth:12}},tooltip:{rtl:true,titleFont:{family:'Cairo'},bodyFont:{family:'Cairo'},callbacks:{label:c=>` ${c.label}: ${fmtCur(c.parsed)}`}}},cutout:'55%',animation:{animateRotate:true,duration:1200}}});
    // Bar
    const bc=gi('barChart'),be=gi('barEmpty');
    const ct={};payments.forEach(p=>{ct[p.contractor]=(ct[p.contractor]||0)+p.amount;});
    const ce=Object.entries(ct).sort((a,b)=>b[1]-a[1]).slice(0,10);
    if(!ce.length){be.classList.remove('hidden');if(barChart){barChart.destroy();barChart=null;}return;}
    be.classList.add('hidden');
    if(barChart)barChart.destroy();
    const bColors=ce.map(e=>{const c=contractors.find(x=>x.name===e[0]);return c?getColor(c.item):'#00d2ff';});
    barChart=new Chart(bc,{type:'bar',data:{labels:ce.map(e=>e[0]),datasets:[{label:'المدفوع',data:ce.map(e=>e[1]),backgroundColor:bColors.map(c=>c+'66'),borderColor:bColors,borderWidth:1.5,borderRadius:6,borderSkipped:false,barPercentage:0.7}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false},tooltip:{rtl:true,titleFont:{family:'Cairo'},bodyFont:{family:'Cairo'},callbacks:{label:c=>` ${fmtCur(c.parsed.x)}`}}},scales:{x:{grid:{color:'rgba(255,255,255,0.05)',drawBorder:false},ticks:{color:'#888',font:{family:'Cairo',size:10},callback:v=>fmtCompact(v)}},y:{grid:{display:false},ticks:{color:'#ccc',font:{family:'Cairo',size:11}}}},animation:{duration:1000,easing:'easeOutQuart'}}});
}

// ========================================
// HELPERS
// ========================================
function gi(id){return document.getElementById(id);}
function gv(id){const el=gi(id);return el?el.value:'';}
function show(id){const el=typeof id==='string'?gi(id):id;if(el)el.style.display='';}
function hide(id){const el=typeof id==='string'?gi(id):id;if(el)el.style.display='none';}
function uid(){return Date.now()+Math.random();}
function today(){return new Date().toISOString().split('T')[0];}
function esc(s){return s.replace(/'/g,"\\'").replace(/"/g,'&quot;');}
function toAr(s){return String(s).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);}
function fmtCur(a){return a===0?'٠ ج.م':toAr(a.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:2}))+' ج.م';}
function fmtNum(n){return n===0?'٠':toAr(n.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:2}));}
function fmtCompact(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(0)+'K';return n;}
function fmtDate(d){if(!d)return '—';const dt=new Date(d);if(isNaN(dt))return String(d);return dt.toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'});}
function itemBadge(item){return `<span class="item-badge"><span class="item-dot" style="background:${getColor(item)}"></span>${item}</span>`;}
function setDate(){const el=gi('currentDate');if(el)el.textContent=new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});}
function animCount(id,target){const el=gi(id);if(!el)return;const s=parseInt(el.textContent)||0,dur=800,st=performance.now();function u(t){const p=Math.min((t-st)/dur,1);el.textContent=Math.round(s+(target-s)*(1-Math.pow(1-p,3))).toLocaleString('ar-EG');if(p<1)requestAnimationFrame(u);}requestAnimationFrame(u);}
function showToast(msg,type='info'){const c=gi('toastContainer'),t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>{t.classList.add('removing');setTimeout(()=>t.remove(),300);},3500);}

// Global
window.navigateTo=navigateTo;window.saveAllData=saveAllData;window.openModal=openModal;
window.openEditContractor=openEditContractor;window.openEditItem=openEditItem;
window.confirmDeleteContractor=confirmDeleteContractor;window.confirmDeletePayment=confirmDeletePayment;window.confirmDeleteItem=confirmDeleteItem;
window.moveItem=moveItem;window.moveContractor=moveContractor;
window.viewStatement=viewStatement;
window.openNewExtractModal=openNewExtractModal;window.addExtractRow=addExtractRow;window.removeExtractRow=removeExtractRow;
window.updateExtractRow=updateExtractRow;window.saveCurrentExtract=saveCurrentExtract;window.deleteCurrentExtract=deleteCurrentExtract;window.printExtract=printExtract;
window.saveExtractPDF=saveExtractPDF;window.saveStatementPDF=saveStatementPDF;
window.submitAddSupplier=submitAddSupplier;window.submitAddSupplyItem=submitAddSupplyItem;
window.openNewSupExtractModal=openNewSupExtractModal;window.addSupExtractRow=addSupExtractRow;window.removeSupExtractRow=removeSupExtractRow;
window.updateSupExtractRow=updateSupExtractRow;window.saveCurrentSupExtract=saveCurrentSupExtract;window.deleteCurrentSupExtract=deleteCurrentSupExtract;
window.printSupExtract=printSupExtract;window.saveSupExtractPDF=saveSupExtractPDF;
