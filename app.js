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
const WORK_TYPES = ['تركيب','توريد','توريد وتركيب'];

// ========================================
// STORAGE (Server + LocalStorage fallback)
// ========================================
const SK = {
    items: 'sc_items_v3',
    contractors: 'sc_contractors_v3',
    payments: 'sc_payments_v3',
    extracts: 'sc_extracts_v3'
};

let items=[], contractors=[], payments=[], extracts=[];
let pieChart=null, barChart=null;
let deleteTarget=null, deleteType='', editTarget=null, editItemTarget=null;
let currentExtractId=null;
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
}

// Firebase URL
const FIREBASE_URL='https://dashboard-77bb2-default-rtdb.firebaseio.com';

// Save to Firebase
async function saveToServer(){
    if(!isServerMode) return;
    try{
        const data={items,contractors,payments,extracts};
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
    }
    if(items.length===0){
        items=[...DEFAULT_ITEMS];
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
    }
    if(!items.length&&!contractors.length)initDefaults();
    initNav(); initSidebar(); populateDropdowns(); initForms(); initModals(); initSorting();
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
    const sels=['itemFilter','paymentItem','paymentItemFilter','statementItem','addContractorItem','extractItemSelect'];
    sels.forEach(id=>{
        const s=document.getElementById(id); if(!s)return;
        const f=s.options[0]; s.innerHTML=''; s.appendChild(f);
        items.forEach(it=>{const o=document.createElement('option');o.value=it;o.textContent=it;s.appendChild(o);});
    });
    initDropdownListeners();
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
    const s=document.getElementById(selId);s.innerHTML='<option value="">اختر المقاول...</option>';
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
function renderAll(){renderOverview();renderContractors();renderPayments();renderCharts();renderSpending();}

// ========================================
// OVERVIEW
// ========================================
function renderOverview(){
    animCount('statContractors',contractors.length);
    const tp=payments.reduce((s,p)=>s+p.amount,0);
    gi('statTotalPaid').textContent=fmtCur(tp);
    animCount('statActiveItems',new Set(payments.map(p=>p.item)).size);
    animCount('statPaymentCount',payments.length);
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
    const displayItems=itemF?items.filter(i=>i===itemF):items;
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
    if(!item||!ctr){hide('statementContent');show('noStatementSelected');hide('printStatement');return;}
    show('statementContent');hide('noStatementSelected');show('printStatement');
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
    sel.disabled=false;sel.style.display='';
    // Show balance
    renderBalance(item,ctr);
    if(cExtracts.length){sel.value=cExtracts[cExtracts.length-1].id;onExtractNumberChange();}
    else{hide('extractContent');show('extractEmpty');gi('extractEmpty').querySelector('p').textContent='لا توجد مستخلصات — أنشئ مستخلص جديد';}
}
function onExtractNumberChange(){
    const exId=gv('extractNumberSelect');
    if(!exId){hide('extractContent');show('extractEmpty');return;}
    currentExtractId=parseFloat(exId);
    show('extractContent');hide('extractEmpty');
    renderExtract();
}

function renderBalance(item,ctr){
    show('balanceCard');
    const cExtracts=extracts.filter(ex=>ex.contractor===ctr&&ex.item===item);
    const totalExecuted=cExtracts.reduce((s,ex)=>{
        return s+ex.rows.reduce((rs,r)=>rs+(r.quantity*r.price*(r.executionPct/100)),0);
    },0);
    const totalPaid=payments.filter(p=>p.contractor===ctr&&p.item===item).reduce((s,p)=>s+p.amount,0);
    const remaining=totalExecuted-totalPaid;
    gi('balExecuted').textContent=fmtCur(totalExecuted);
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
    tb.innerHTML=ex.rows.map((r,i)=>`<tr>
        <td>${i+1}</td>
        <td><input type="text" class="extract-input" value="${r.name||''}" onchange="updateExtractRow(${i},'name',this.value)"></td>
        <td><select class="extract-select" onchange="updateExtractRow(${i},'type',this.value)">${WORK_TYPES.map(t=>`<option${r.type===t?' selected':''}>${t}</option>`).join('')}</select></td>
        <td><select class="extract-select" onchange="updateExtractRow(${i},'unit',this.value)">${UNITS.map(u=>`<option${r.unit===u?' selected':''}>${u}</option>`).join('')}</select></td>
        <td><input type="number" class="extract-input num" value="${r.quantity||0}" min="0" step="0.01" onchange="updateExtractRow(${i},'quantity',parseFloat(this.value)||0)"></td>
        <td><input type="number" class="extract-input num" value="${r.price||0}" min="0" step="0.01" onchange="updateExtractRow(${i},'price',parseFloat(this.value)||0)"></td>
        <td class="amount-cell calculated">${fmtNum(r.quantity*r.price)}</td>
        <td><input type="number" class="extract-input num" value="${r.executionPct||0}" min="0" max="100" step="1" onchange="updateExtractRow(${i},'executionPct',parseFloat(this.value)||0)">%</td>
        <td class="amount-cell calculated">${fmtNum(r.quantity*r.price*(r.executionPct/100))}</td>
        <td><button class="btn btn-icon-only btn-delete" onclick="removeExtractRow(${i})">🗑️</button></td>
    </tr>`).join('');
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
    ex.rows.push({name:'',type:'تركيب',unit:'م²',quantity:0,price:0,executionPct:0});
    save();renderExtract();
}
function removeExtractRow(idx){
    const ex=extracts.find(x=>x.id===currentExtractId);if(!ex)return;
    ex.rows.splice(idx,1);save();renderExtract();
    renderBalance(ex.item,ex.contractor);
}
function calcExtractTotals(ex){
    let tv=0,te=0;
    ex.rows.forEach(r=>{const v=r.quantity*r.price;tv+=v;te+=v*(r.executionPct/100);});
    gi('extractTotalValue').textContent=fmtNum(tv);
    gi('extractTotalExecuted').textContent=fmtNum(te);
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
    const newEx={id:uid(),contractor:ctr,item,number:num,date,notes,rows:[{name:'',type:'تركيب',unit:'م²',quantity:0,price:0,executionPct:0}]};
    extracts.push(newEx);save();
    closeModal('newExtractModal');e.target.reset();
    onExtractContractorChange();
    // Select the new one
    setTimeout(()=>{gi('extractNumberSelect').value=newEx.id;onExtractNumberChange();},100);
    showToast(`✅ تم إنشاء مستخلص رقم ${num}`,'success');
}

function printExtract(){
    const ex=extracts.find(x=>x.id===currentExtractId);if(!ex)return;
    let tv=0,te=0;
    ex.rows.forEach(r=>{const v=r.quantity*r.price;tv+=v;te+=v*(r.executionPct/100);});
    const totalPaid=payments.filter(p=>p.contractor===ex.contractor&&p.item===ex.item).reduce((s,p)=>s+p.amount,0);
    const html=`<div style="font-family:Cairo,sans-serif;direction:rtl;padding:20px;color:#333;">
        <h1 style="text-align:center;border-bottom:3px solid #333;padding-bottom:10px;">مستخلص رقم ${ex.number}</h1>
        <table style="width:100%;margin:20px 0;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">المقاول</td><td style="padding:8px;border:1px solid #ddd;">${ex.contractor}</td>
            <td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">البند</td><td style="padding:8px;border:1px solid #ddd;">${ex.item}</td>
            <td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">التاريخ</td><td style="padding:8px;border:1px solid #ddd;">${fmtDate(ex.date)}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
            <thead><tr style="background:#e0e0e0;">${['م','بند المستخلص','النوع','الوحدة','الكمية','السعر','القيمة','نسبة التنفيذ','القيمة المنفذة'].map(h=>`<th style="padding:8px;border:1px solid #bbb;text-align:center;">${h}</th>`).join('')}</tr></thead>
            <tbody>${ex.rows.map((r,i)=>{const v=r.quantity*r.price;const ev=v*(r.executionPct/100);return `<tr>${[i+1,r.name,r.type,r.unit,r.quantity,fmtNum(r.price),fmtNum(v),r.executionPct+'%',fmtNum(ev)].map(c=>`<td style="padding:6px;border:1px solid #ddd;text-align:center;">${c}</td>`).join('')}</tr>`;}).join('')}</tbody>
            <tfoot><tr style="background:#f0f0f0;font-weight:bold;"><td colspan="6" style="padding:8px;border:1px solid #bbb;text-align:center;">الإجمالي</td><td style="padding:8px;border:1px solid #bbb;text-align:center;">${fmtNum(tv)}</td><td style="padding:8px;border:1px solid #bbb;"></td><td style="padding:8px;border:1px solid #bbb;text-align:center;">${fmtNum(te)}</td></tr></tfoot>
        </table>
        <table style="width:50%;margin:0 auto;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:10px;border:1px solid #ddd;background:#e8f5e9;font-weight:bold;">قيمة الأعمال المنفذة</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">${fmtCur(te)}</td></tr>
            <tr><td style="padding:10px;border:1px solid #ddd;background:#fff3e0;font-weight:bold;">إجمالي المنصرف</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">${fmtCur(totalPaid)}</td></tr>
            <tr><td style="padding:10px;border:1px solid #ddd;background:#e3f2fd;font-weight:bold;">الباقي للمقاول</td><td style="padding:10px;border:1px solid #ddd;text-align:center;font-weight:bold;">${fmtCur(te-totalPaid)}</td></tr>
        </table>
        ${ex.notes?`<p style="margin-top:16px;padding:10px;background:#f5f5f5;border-radius:8px;"><strong>ملاحظات:</strong> ${ex.notes}</p>`:''}
    </div>`;
    const w=window.open('','_blank','width=900,height=700');
    w.document.write(`<html dir="rtl"><head><title>مستخلص رقم ${ex.number} - ${ex.contractor}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"><style>@media print{body{margin:0}}</style></head><body>${html}<script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
    w.document.close();
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
function fmtCur(a){return a===0?'٠ ج.م':a.toLocaleString('ar-EG',{minimumFractionDigits:0,maximumFractionDigits:2})+' ج.م';}
function fmtNum(n){return n===0?'٠':n.toLocaleString('ar-EG',{minimumFractionDigits:0,maximumFractionDigits:2});}
function fmtCompact(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(0)+'K';return n;}
function fmtDate(d){return d?new Date(d).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'}):'—';}
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
