// =============================================
// STUDYPOM – Günlük Ajanda Mantığı
// =============================================

let agendaState = {
  user: null,
  currentDate: new Date(),   // Görüntülenen gün
  tasks: [],                 // O gün yüklenen görevler
  userExamIds: [],           // Kullanıcının sınav türleri
};

/* ─── YARDIMCI: Tarih string (YEREL SAAT ile) ─── */
function toDateStr(date) {
  // UTC değil, yerel saati kullan (gece yarısı gün kayması sorunu önlenir)
  const d = new Date(date);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatDisplayDate(date) {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const ymd = toDateStr(date);
  if (ymd === toDateStr(today))     return `Bugün, ${date.toLocaleDateString('tr-TR', { day:'numeric', month:'long' })}`;
  if (ymd === toDateStr(yesterday)) return `Dün, ${date.toLocaleDateString('tr-TR', { day:'numeric', month:'long' })}`;
  if (ymd === toDateStr(tomorrow))  return `Yarın, ${date.toLocaleDateString('tr-TR', { day:'numeric', month:'long' })}`;
  return date.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

/* ─── INIT ─── */
function initAgendaView() {
  if (!state.user) return;
  agendaState.user = state.user;
  agendaState.userExamIds = state.user.examIds || [];
  buildExamSelectors();
  loadAndCarry();
  loadNotes();   // Günlük notları yükle
}

/* ─── CARRY OVER KONTROLÜ ─── */
async function loadAndCarry() {
  const todayStr = toDateStr(new Date());
  const viewStr  = toDateStr(agendaState.currentDate);

  // Sadece bugünü görüntülerken dünden taşı
  if (viewStr === todayStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = toDateStr(yesterday);

    // Dünün görevlerinden tamamlanmayanları taşı (sadece bir kere)
    const alreadyCarried = localStorage.getItem(`carried_${todayStr}`);
    if (!alreadyCarried) {
      const count = await fbCarryOverTasks(agendaState.user.uid, yStr, todayStr);
      if (count > 0) {
        showAgendaToast(`📋 ${count} görev dünden bugüne aktarıldı.`, 'success');
      }
      localStorage.setItem(`carried_${todayStr}`, '1');
    }
  }

  await loadTasks();
}

/* ─── GÖREV YÜKLE ─── */
async function loadTasks() {
  const dateStr = toDateStr(agendaState.currentDate);
  document.getElementById('ag-date-label').textContent = formatDisplayDate(agendaState.currentDate);

  try {
    agendaState.tasks = await fbGetAgendaTasks(agendaState.user.uid, dateStr);
    renderTasks();
    updateSummary();
  } catch (err) {
    showAgendaToast('Görevler yüklenemedi: ' + err.message, 'error');
  }
}

/* ─── RENDER GÖREVLER ─── */
function renderTasks() {
  const tasks = agendaState.tasks;
  const normalList   = document.getElementById('ag-task-list');
  const carriedList  = document.getElementById('ag-carried-list');
  const carriedSection = document.getElementById('ag-carried-section');
  const emptyState   = document.getElementById('ag-empty-state');

  const normal  = tasks.filter(t => !t.carriedFrom);
  const carried = tasks.filter(t =>  t.carriedFrom);

  // Normal görevler
  if (normal.length === 0 && carried.length === 0) {
    emptyState.classList.remove('hidden');
    normalList.innerHTML = '';
  } else {
    emptyState.classList.add('hidden');
    normalList.innerHTML = normal.map(taskCardHTML).join('');
  }

  // Taşınan görevler
  if (carried.length > 0) {
    carriedSection.classList.remove('hidden');
    carriedList.innerHTML = carried.map(taskCardHTML).join('');
  } else {
    carriedSection.classList.add('hidden');
    carriedList.innerHTML = '';
  }
}

function taskCardHTML(task) {
  const doneClass    = task.done ? 'done' : '';
  const carriedClass = task.carriedFrom ? 'carried' : '';
  const carriedBadge = task.carriedFrom
    ? `<span class="ag-task-carried-badge">⬅ Aktarıldı</span>` : '';

  return `
    <div class="ag-task-card ${doneClass} ${carriedClass}" 
         id="task-card-${task.id}"
         style="--task-color: ${task.color || 'var(--gold)'}">
      <button class="ag-task-check" onclick="toggleTask('${task.id}', ${!task.done})">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
      <div class="ag-task-body">
        <div class="ag-task-exam">${task.emoji || ''} ${task.examName || ''}</div>
        <div class="ag-task-name">${task.subjectName || ''}</div>
        <div class="ag-task-meta">
          <span class="ag-task-duration">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            ${task.durationMin} dakika
          </span>
          ${carriedBadge}
        </div>
      </div>
      <div class="ag-task-actions">
        ${!task.done ? `
        <button class="ag-task-del-btn" onclick="startAgendaTask('${task.id}')" title="Çalışmaya Başla" style="color:var(--gold); border-color:var(--gold); margin-right: 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        ` : ''}
        <button class="ag-task-del-btn" onclick="deleteTask('${task.id}')" title="Sil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>`;
}

/* ─── ÖZET GÜNCELLE ─── */
function updateSummary() {
  const tasks = agendaState.tasks;
  const total    = tasks.length;
  const done     = tasks.filter(t => t.done).length;
  const pending  = total - done;
  const totalMin = tasks.reduce((s, t) => s + (t.durationMin || 0), 0);
  const doneMin  = tasks.filter(t => t.done).reduce((s, t) => s + (t.durationMin || 0), 0);
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('ag-stat-total').textContent  = total;
  document.getElementById('ag-stat-done').textContent   = done;
  document.getElementById('ag-stat-pending').textContent= pending;
  document.getElementById('ag-stat-min').textContent    = totalMin + ' dk';
  document.getElementById('ag-stat-pct').textContent    = pct + '%';
  document.getElementById('ag-stat-pct').className      = 'ag-sc-val ' + (pct === 100 ? 'green' : pct > 50 ? 'gold' : 'red');
  document.getElementById('ag-progress-fill').style.width = pct + '%';
}

/* ─── SEANS SEÇİCİLERİ ─── */
function buildExamSelectors() {
  const examSel    = document.getElementById('ag-sel-exam');
  const subjectSel = document.getElementById('ag-sel-subject');

  // Sınav türlerini doldur (kullanıcının seçtikleri)
  examSel.innerHTML = '<option value="">-- Sınav Türü --</option>';
  const exams = agendaState.userExamIds.length > 0
    ? EXAM_TYPES.filter(e => agendaState.userExamIds.includes(e.id))
    : EXAM_TYPES;

  exams.forEach(exam => {
    const opt = document.createElement('option');
    opt.value = exam.id;
    opt.textContent = `${exam.emoji} ${exam.name}`;
    examSel.appendChild(opt);
  });

  // Sınav değişince dersleri güncelle
  examSel.addEventListener('change', () => {
    const examId = examSel.value;
    subjectSel.innerHTML = '<option value="">-- Ders --</option>';
    if (!examId) return;
    const exam = EXAM_TYPES.find(e => e.id === examId);
    if (!exam) return;
    exam.subjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = `${sub.emoji} ${sub.name}`;
      subjectSel.appendChild(opt);
    });
  });
}

/* ─── GÖREV EKLE ─── */
async function addAgendaTask() {
  const examId     = document.getElementById('ag-sel-exam').value;
  const subjectId  = document.getElementById('ag-sel-subject').value;
  const durationMin = parseInt(document.getElementById('ag-inp-duration').value, 10);

  if (!examId)        { showAgendaToast('Sınav türü seçin.', 'error'); return; }
  if (!subjectId)     { showAgendaToast('Ders seçin.', 'error'); return; }
  if (!durationMin || durationMin < 1) { showAgendaToast('Süre giriniz (dk).', 'error'); return; }

  const exam    = EXAM_TYPES.find(e => e.id === examId);
  const subject = exam?.subjects.find(s => s.id === subjectId);
  if (!exam || !subject) return;

  const dateStr = toDateStr(agendaState.currentDate);

  try {
    const id = await fbAddAgendaTask(agendaState.user.uid, dateStr, {
      examId,
      subjectId,
      examName:    exam.name,
      subjectName: subject.name,
      emoji:       subject.emoji,
      color:       subject.color,
      durationMin,
    });

    agendaState.tasks.push({
      id, examId, subjectId,
      examName: exam.name, subjectName: subject.name,
      emoji: subject.emoji, color: subject.color,
      durationMin, done: false, carriedFrom: null,
    });

    renderTasks();
    updateSummary();
    showAgendaToast('✅ Görev eklendi!', 'success');

    // Formu sıfırla
    document.getElementById('ag-inp-duration').value = 30;
  } catch (err) {
    showAgendaToast('Eklenemedi: ' + err.message, 'error');
  }
}

/* ─── ÇALIŞMAYA BAŞLA (TIMER YÖNLENDİRMESİ) ─── */
function startAgendaTask(taskId) {
  const task = agendaState.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  if (state.timerActive) {
     showToast('Zamanlayıcı zaten çalışıyor.', 'error');
     return;
  }
  
  // switch to timer
  switchView('timer');
  
  // set subject
  selectTimerSubject(task.subjectId);
  
  // set duration
  document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
  let foundBtn = false;
  document.querySelectorAll('.dur-btn').forEach(b => {
    if (parseInt(b.textContent) === task.durationMin) {
      b.classList.add('active');
      foundBtn = true;
    }
  });
  
  state.timerSeconds = task.durationMin * 60;
  state.timerTotal   = task.durationMin * 60;
  
  // Keep track of the active agenda task
  state.activeAgendaTaskId = task.id;
  
  updateClockDisplay();
  updateRing(1);
  showToast(`${task.subjectName} çalışmasına hazırsın. Başla butonuna bas!`, 'info');
}

/* ─── TAMAMLA / GERİ AL ─── */
async function toggleTask(taskId, done) {
  const dateStr = toDateStr(agendaState.currentDate);
  try {
    await fbToggleAgendaTask(agendaState.user.uid, dateStr, taskId, done);
    const task = agendaState.tasks.find(t => t.id === taskId);
    if (task) task.done = done;
    renderTasks();
    updateSummary();

    const pct = parseInt(document.getElementById('ag-stat-pct').textContent, 10);
    if (pct === 100) showAgendaToast('🎉 Tüm görevleri tamamladın!', 'success');
  } catch (err) {
    showAgendaToast('Güncellenemedi: ' + err.message, 'error');
  }
}

/* ─── SİL ─── */
async function deleteTask(taskId) {
  const dateStr = toDateStr(agendaState.currentDate);
  try {
    await fbDeleteAgendaTask(agendaState.user.uid, dateStr, taskId);
    agendaState.tasks = agendaState.tasks.filter(t => t.id !== taskId);
    renderTasks();
    updateSummary();
    showAgendaToast('Görev silindi.', '');
  } catch (err) {
    showAgendaToast('Silinemedi: ' + err.message, 'error');
  }
}

/* ─── TARİH NAVİGASYONU ─── */
function changeAgendaDate(delta) {
  agendaState.currentDate = new Date(agendaState.currentDate);
  agendaState.currentDate.setDate(agendaState.currentDate.getDate() + delta);
  loadTasks();
}

function goToToday() {
  agendaState.currentDate = new Date();
  loadAndCarry();
}

/* ─── PRESET SÜRELER ─── */
function setDurationPreset(min) {
  document.getElementById('ag-inp-duration').value = min;
}

/* ─── TOAST ─── */
function showAgendaToast(msg, type = '') {
  if (typeof showToast === 'function') {
    showToast(msg, type);
  }
}


/* ═══════════════════════════════════════════════════════
   GÜNLÜK NOTLAR
   ═══════════════════════════════════════════════════════ */

let notesState = {
  notes: [],
  selectedColor: '#FFF9C4',
};

/* ─── NOTLARI YÜKLE ─── */
async function loadNotes() {
  if (!state.user) return;
  try {
    notesState.notes = await fbGetNotes(state.user.uid);
    renderNotes();
  } catch (err) {
    console.warn('Notlar yüklenemedi:', err.message);
  }
}

/* ─── NOT RENDER ─── */
function renderNotes() {
  const grid = document.getElementById('notes-grid');
  if (!grid) return;

  const notes = notesState.notes;

  // Placeholder her zaman sonda
  let html = notes.map(noteCardHTML).join('');
  html += `
    <div class="note-card note-add-placeholder" onclick="openAddNoteModal()">
      <div class="note-placeholder-inner">
        <span style="font-size:32px;">📌</span>
        <p>Yeni not ekle</p>
      </div>
    </div>`;
  grid.innerHTML = html;
}

/* ─── NOT KARTI HTML ─── */
function noteCardHTML(note) {
  const dateStr = note.updatedAt?.toDate
    ? note.updatedAt.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    : note.createdAt?.toDate
      ? note.createdAt.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

  const color = note.color || '#FFF9C4';
  const titleEsc = (note.title || 'Başlıksız').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  
  // Checklist oluştur
  const items = note.items || [];
  let contentHtml = '';
  if (items.length > 0) {
    contentHtml = items.map((it, idx) => {
      const textEsc = (it.text || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const checkedCls = it.done ? 'checked' : '';
      const doneCls = it.done ? 'done' : '';
      return `
        <div class="note-card-check-item ${doneCls}">
          <div class="note-card-check-circle ${checkedCls}" onclick="toggleNoteCheck('${note.id}', ${idx}, event)"></div>
          <div class="note-card-check-text">${textEsc}</div>
        </div>
      `;
    }).join('');
  } else {
    // Eskiden kalan içerik varsa gösterelim (Geriye uyumluluk için)
    contentHtml = (note.content || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return `
    <div class="note-card" style="background:${color}" id="note-${note.id}">
      <div class="note-inner">
        <div class="note-title">${titleEsc}</div>
        <div class="note-content">${contentHtml}</div>
      </div>
      <div class="note-footer">
        <span class="note-date">${dateStr}</span>
        <div class="note-actions">
          <button class="note-action-btn" onclick="openEditNoteModal('${note.id}')" title="Düzenle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="note-action-btn del" onclick="confirmDeleteNote('${note.id}')" title="Sil">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
}

/* ─── NOT CHECKLIST TIKLAMA ─── */
async function toggleNoteCheck(noteId, itemIndex, event) {
  event.stopPropagation();
  const note = notesState.notes.find(n => n.id === noteId);
  if (!note || !note.items) return;

  note.items[itemIndex].done = !note.items[itemIndex].done;
  
  // Sadece ilgili note kartını UI'da güncellemek yerine tüm listeyi de render edebiliriz 
  // ya da ufak dom manipülasyonu yapabiliriz. Şimdilik renderNotes çağırıyoruz.
  renderNotes();

  // Arka planda Firebase'e kaydet
  try {
    await fbUpdateNote(state.user.uid, noteId, { items: note.items });
  } catch (err) {
    console.warn('Check update failed:', err);
  }
}

/* ─── MODALı AÇ (YENİ NOT) ─── */
function openAddNoteModal() {
  notesState.selectedColor = '#FFF9C4';
  document.getElementById('note-editing-id').value = '';
  document.getElementById('note-modal-title').textContent = '✏️ Yeni Not';
  document.getElementById('note-inp-title').value = '';
  
  const container = document.getElementById('note-checklist-container');
  if(container) container.innerHTML = '';
  
  const inp = document.getElementById('note-add-item-input');
  if(inp) {
    inp.value = '';
    // Enter key support
    inp.onkeydown = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNoteChecklistItemBtn();
      }
    };
  }

  // Modal arka planını seçilen renge göre güncelle
  document.getElementById('modal-note').querySelector('.note-modal-box').style.background = '#FFF9C4';
  document.getElementById('modal-note').querySelector('.note-modal-tape').style.background = 'rgba(255,230,100,0.7)';

  // Renk seçiciyi sıfırla
  _resetColorPicker('#FFF9C4');

  document.getElementById('modal-note').classList.remove('hidden');
  document.getElementById('note-inp-title').focus();

  _attachColorPicker();
}

/* ─── MODALı AÇ (DÜZENLE) ─── */
function openEditNoteModal(noteId) {
  const note = notesState.notes.find(n => n.id === noteId);
  if (!note) return;

  notesState.selectedColor = note.color || '#FFF9C4';
  document.getElementById('note-editing-id').value = noteId;
  document.getElementById('note-modal-title').textContent = '✏️ Notu Düzenle';
  document.getElementById('note-inp-title').value = note.title || '';
  
  const container = document.getElementById('note-checklist-container');
  if(container) {
    container.innerHTML = '';
    const items = note.items || [];
    items.forEach(it => addChecklistItemToDOM(it.text, it.done));
  }

  const inp = document.getElementById('note-add-item-input');
  if(inp) {
    inp.value = '';
    inp.onkeydown = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNoteChecklistItemBtn();
      }
    };
  }

  // Modal arka planını renge göre güncelle
  const box = document.getElementById('modal-note').querySelector('.note-modal-box');
  box.style.background = notesState.selectedColor;

  _resetColorPicker(notesState.selectedColor);
  document.getElementById('modal-note').classList.remove('hidden');
  document.getElementById('note-inp-title').focus();
  
  _attachColorPicker();
}

/* ─── CHECKLIST MADDESI EKLE ─── */
function addNoteChecklistItemBtn() {
  const inp = document.getElementById('note-add-item-input');
  const val = inp.value.trim();
  if (!val) return;
  addChecklistItemToDOM(val, false);
  inp.value = '';
  inp.focus();
}

function addChecklistItemToDOM(text, done) {
  const container = document.getElementById('note-checklist-container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'note-check-item';
  div.dataset.done = done ? 'true' : 'false';
  div.innerHTML = `
    <input type="text" value="${text.replace(/"/g, '&quot;')}" oninput="this.parentElement.dataset.text=this.value" />
    <button type="button" onclick="this.parentElement.remove()" title="Sil">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  div.dataset.text = text;
  container.appendChild(div);
}

/* ─── MODALı KAPAT ─── */
function closeNoteModal() {
  document.getElementById('modal-note').classList.add('hidden');
}

/* ─── NOT KAYDET (EKLE / GÜNCELLE) ─── */
async function saveNote() {
  const title   = document.getElementById('note-inp-title').value.trim();
  const editId  = document.getElementById('note-editing-id').value;

  // Checklist elemanlarını topla
  const items = [];
  const container = document.getElementById('note-checklist-container');
  if (container) {
    container.querySelectorAll('.note-check-item').forEach(el => {
      const text = el.dataset.text || '';
      const done = el.dataset.done === 'true';
      if (text.trim()) {
        items.push({ text: text.trim(), done });
      }
    });
  }

  // Henüz eklenmemiş inputta kalan bir şey varsa onu da ekle
  const inpVal = document.getElementById('note-add-item-input').value.trim();
  if (inpVal) {
    items.push({ text: inpVal, done: false });
  }

  if (!title && items.length === 0) {
    showAgendaToast('Başlık veya liste elemanı giriniz.', 'error');
    return;
  }

  const noteData = {
    title: title || 'Başlıksız',
    items: items,
    color: notesState.selectedColor,
  };

  try {
    if (editId) {
      // Güncelle
      await fbUpdateNote(state.user.uid, editId, noteData);
      const idx = notesState.notes.findIndex(n => n.id === editId);
      if (idx !== -1) {
        notesState.notes[idx] = { ...notesState.notes[idx], ...noteData };
      }
      showAgendaToast('✅ Not güncellendi!', 'success');
    } else {
      // Yeni ekle
      const id = await fbAddNote(state.user.uid, noteData);
      notesState.notes.unshift({ id, ...noteData, createdAt: null, updatedAt: null });
      showAgendaToast('📌 Not eklendi!', 'success');
    }
    closeNoteModal();
    renderNotes();
  } catch (err) {
    showAgendaToast('Kaydedilemedi: ' + err.message, 'error');
  }
}

/* ─── NOT SİL ─── */
async function confirmDeleteNote(noteId) {
  if (!confirm('Bu notu silmek istiyor musun?')) return;
  try {
    await fbDeleteNote(state.user.uid, noteId);
    notesState.notes = notesState.notes.filter(n => n.id !== noteId);
    renderNotes();
    showAgendaToast('Not silindi.', '');
  } catch (err) {
    showAgendaToast('Silinemedi: ' + err.message, 'error');
  }
}

/* ─── YARDIMCI: Karakter sayacı ─── */
function _attachCharCounter() {
  const ta = document.getElementById('note-inp-content');
  const cnt = document.getElementById('note-char-count');
  ta.oninput = () => { cnt.textContent = ta.value.length; };
}

/* ─── YARDIMCI: Renk seçici ─── */
function _attachColorPicker() {
  const picker = document.getElementById('note-color-picker');
  const box    = document.getElementById('modal-note').querySelector('.note-modal-box');
  const tape   = document.getElementById('modal-note').querySelector('.note-modal-tape');

  picker.querySelectorAll('.ncp-btn').forEach(btn => {
    btn.onclick = () => {
      picker.querySelectorAll('.ncp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      notesState.selectedColor = btn.dataset.color;
      box.style.background = notesState.selectedColor;
      // Bant rengini de uyumlu yap
      tape.style.background = notesState.selectedColor + 'bb';
    };
  });
}

/* ─── YARDIMCI: Renk seçiciyi sıfırla ─── */
function _resetColorPicker(activeColor) {
  document.querySelectorAll('.ncp-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === activeColor);
  });
}
