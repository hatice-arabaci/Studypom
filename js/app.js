// =============================================
// STUDYPOM – Main Application Logic (Firebase)
// =============================================

/* ─────────────────────────────────
   STATE
───────────────────────────────── */
let state = {
  user: null,           // { uid, name, email, examIds, plan, planExpiry }
  sessions: [],         // all study sessions (from Firestore)
  selectedExams: [],    // during onboarding (dizi)
  weekOffset: 0,        // analytics week offset (0 = current)

  // timer
  timerActive: false,
  timerPaused: false,
  timerInterval: null,
  timerSeconds: 25 * 60,
  timerTotal: 25 * 60,
  timerSubject: null,
  timerMode: 'konu',    // 'konu' | 'soru'
  pomodoroCount: 0,
  isBreak: false,
  currentSessionStart: null,
  activeAgendaTaskId: null,

  // break settings
  breakShort: 5,
  breakLong: 15,
};

/* ─────────────────────────────────
   INIT
───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Firebase başlat
  const ok = initFirebase();
  if (!ok) {
    showToast('Firebase yapılandırması eksik! Lütfen js/firebase-config.js dosyasını güncelleyin.', 'error');
  }

  // 2. Auth durumu dinle
  onAuthChange(async (fbUser) => {
    if (fbUser) {
      console.log('👤 Kullanıcı giriş yapmış:', fbUser.email);

      // Verileri senkronize et
      try {
        const syncedUser = await fbSyncUser(fbUser);
        state.user = syncedUser;
        console.log('✅ Kullanıcı verisi senkronize edildi:', state.user.name, '| Plan:', state.user.plan);
      } catch (err) {
        console.warn('⚠️ Senkronizasyon hatası (Auth verisi kullanılıyor):', err);
        state.user = {
          uid: fbUser.uid,
          name: fbUser.displayName || 'Kullanıcı',
          email: fbUser.email,
          plan: 'free',
          planExpiry: null,
          examIds: [],
        };
      }

      // Mola ayarlarını yükle
      if (state.user.breakSettings) {
        state.breakShort = state.user.breakSettings.shortBreak || 5;
        state.breakLong  = state.user.breakSettings.longBreak  || 15;
      }

      // Seansları yükle
      await loadFirebaseData();

      // Sınav türü seçimi ekranına her zaman git (Kullanıcı isteği)
      showScreen('exam-select');
      buildExamGrid();
    } else {
      console.log('👤 Giriş yapılmış kullanıcı yok.');
      state.user = null;
      state.sessions = [];
      showScreen('auth');

      // URL'deki hash'e göre login/register seç
      if (window.location.hash === '#register') {
        switchTab('register');
      }
    }
  });

  // URL hash takibi (Sayfadayken hash değişirse de çalışsın)
  window.addEventListener('hashchange', () => {
    if (!state.user && window.location.hash === '#register') {
      switchTab('register');
    }
  });
});


async function loadFirebaseData() {
  if (!state.user) return;
  try {
    const sessions = await fbGetSessions(state.user.uid);
    state.sessions = sessions;
    console.log('📊 Seanslar yüklendi:', sessions.length);
  } catch (err) {
    console.error('Veri yükleme hatası:', err);
    showToast('Veri çekme hatası: ' + (err.message || 'Bilinmeyen hata'), 'error');
  }
}

/* ─────────────────────────────────
   SCREEN MANAGEMENT
───────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = document.getElementById('screen-' + id);
  if (sc) sc.classList.add('active');
}

/* ─────────────────────────────────
   AUTH
───────────────────────────────── */
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
}

function updateExamCountdown() {
  const badge = document.getElementById('exam-countdown-badge');
  const textEl = document.getElementById('exam-countdown-text');
  if (!badge || !textEl) return;
  
  if (!state.user || !state.user.examIds || state.user.examIds.length === 0) {
    badge.classList.add('hidden');
    return;
  }
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  let closestExam = null;
  let minDiff = Infinity;
  let examNames = [];
  
  state.user.examIds.forEach(id => {
    const exam = EXAM_TYPES.find(e => e.id === id);
    if (exam && exam.examDate) {
      const eDate = new Date(exam.examDate);
      eDate.setHours(0,0,0,0);
      const diffTime = eDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0) {
        if (diffDays < minDiff) {
          minDiff = diffDays;
          closestExam = exam.name;
          examNames = [exam.name];
        } else if (diffDays === minDiff) {
          examNames.push(exam.name);
        }
      }
    }
  });
  
  if (minDiff === Infinity) {
    badge.classList.add('hidden');
    const badgeTimer = document.getElementById('exam-countdown-badge-timer');
    if (badgeTimer) badgeTimer.classList.add('hidden');
    const badgeAgenda = document.getElementById('exam-countdown-badge-agenda');
    if (badgeAgenda) badgeAgenda.classList.add('hidden');
    return;
  }
  
  const nameStr = examNames.join(' & ');
  const countdownHtml = `${nameStr} sınavına <strong style="color:var(--text);">${minDiff} gün</strong> kaldı`;
  
  textEl.innerHTML = countdownHtml;
  badge.classList.remove('hidden');
  
  // Timer view badge
  const badgeTimer = document.getElementById('exam-countdown-badge-timer');
  const textTimer = document.getElementById('exam-countdown-text-timer');
  if (badgeTimer && textTimer) {
    textTimer.innerHTML = countdownHtml;
    badgeTimer.classList.remove('hidden');
  }
  
  // Agenda view badge
  const badgeAgenda = document.getElementById('exam-countdown-badge-agenda');
  const textAgenda = document.getElementById('exam-countdown-text-agenda');
  if (badgeAgenda && textAgenda) {
    textAgenda.innerHTML = countdownHtml;
    badgeAgenda.classList.remove('hidden');
  }
}

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.style.color = 'var(--gold-light)';
  } else {
    inp.type = 'password';
    btn.style.color = '';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  if (!isFirebaseConfigured()) return showToast('Firebase Config ayarlanmadı!', 'error');

  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-password').value;

  if (!email || !pw) return showToast('Lütfen tüm alanları doldurun.', 'error');

  setLoading('btn-login', true);
  try {
    await fbLogin(email, pw);
    showToast('Giriş başarılı! 👋', 'success');
  } catch (err) {
    console.error(err);
    showToast('Giriş başarısız: ' + getFirebaseError(err.code), 'error');
  } finally {
    setLoading('btn-login', false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  if (!isFirebaseConfigured()) return showToast('Firebase Config ayarlanmadı!', 'error');

  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pw    = document.getElementById('reg-password').value;

  if (!name || !email || !pw) return showToast('Lütfen tüm alanları doldurun.', 'error');
  if (pw.length < 6) return showToast('Şifre en az 6 karakter olmalı.', 'error');

  setLoading('btn-register', true);
  try {
    await fbRegister(name, email, pw);
    showToast('Hesap oluşturuldu! 🎉', 'success');
  } catch (err) {
    console.error(err);
    showToast('Kayıt başarısız: ' + getFirebaseError(err.code), 'error');
  } finally {
    setLoading('btn-register', false);
  }
}

function handleDemoLogin() {
  showToast('Firebase modunda demo login devre dışıdır. Lütfen kayıt olun.', 'info');
}

async function handleLogout() {
  stopTimer();
  try {
    await fbLogout();
    showToast('Çıkış yapıldı.', 'success');
  } catch (err) {
    showToast('Çıkış yaparken hata oluştu.', 'error');
  }
}

function setLoading(btnId, on) {
  const b = document.getElementById(btnId);
  if (!b) return;
  const sp = b.querySelector('span');
  const ld = b.querySelector('.btn-loader');
  if (on) { b.disabled = true; sp && sp.classList.add('hidden'); ld && ld.classList.remove('hidden'); }
  else     { b.disabled = false; sp && sp.classList.remove('hidden'); ld && ld.classList.add('hidden'); }
}

function getFirebaseError(code) {
  switch(code) {
    case 'auth/user-not-found': return 'Kullanıcı bulunamadı.';
    case 'auth/wrong-password': return 'Hatalı şifre.';
    case 'auth/email-already-in-use': return 'Bu e-posta zaten kullanımda.';
    case 'auth/invalid-email': return 'Geçersiz e-posta adresi.';
    case 'auth/weak-password': return 'Şifre çok zayıf.';
    default: return 'Bir hata oluştu.';
  }
}

/* ─────────────────────────────────
   EXAM SELECT
───────────────────────────────── */
function buildExamGrid() {
  const grid = document.getElementById('exam-grid');
  grid.innerHTML = '';
  // Önceki seçimleri yükle (varsa)
  const savedExams = (state.user && state.user.examIds) ? [...state.user.examIds] : [];
  state.selectedExams = [...savedExams];

  // Sınav türü notunu güncelle
  const noteEl = document.getElementById('exam-select-plan-note');
  if (noteEl) {
    noteEl.textContent = 'İstediğin kadar sınav türü seçebilirsin';
    noteEl.style.color = 'var(--text-3)';
  }

  EXAM_TYPES.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'exam-card';
    card.id = 'ec-' + ex.id;
    if (savedExams.includes(ex.id)) card.classList.add('selected');
    card.innerHTML = `
      <div class="ec-emoji">${ex.emoji}</div>
      <div class="ec-name">${ex.name}</div>
      <div class="ec-count">${ex.subjects.length} ders</div>
      <div class="ec-check">✓</div>
    `;
    card.onclick = () => toggleExamCard(ex.id);
    grid.appendChild(card);
  });
  document.getElementById('btn-confirm-exam').disabled = state.selectedExams.length === 0;
}

function toggleExamCard(id) {
  const idx = state.selectedExams.indexOf(id);
  if (idx === -1) {
    // Tüm kullanıcılar sınırsız sınav türü seçebilir
    state.selectedExams.push(id);
  } else {
    state.selectedExams.splice(idx, 1);
  }
  // Kart görsel güncelleme
  EXAM_TYPES.forEach(ex => {
    const card = document.getElementById('ec-' + ex.id);
    if (card) card.classList.toggle('selected', state.selectedExams.includes(ex.id));
  });
  document.getElementById('btn-confirm-exam').disabled = state.selectedExams.length === 0;
}

async function confirmExamSelect() {
  if (!state.selectedExams.length || !state.user) return;
  try {
    await fbSetExams(state.user.uid, state.selectedExams);
    state.user.examIds = [...state.selectedExams];
    showScreen('dashboard');
    initDashboard();
    showToast('Sınav türleri seçildi! Başarılar 🚀', 'success');
  } catch (err) {
    showToast('Seçim kaydedilemedi: ' + (err.message || 'Bilinmeyen Hata'), 'error');
  }
}

/* ─────────────────────────────────
   DASHBOARD INIT
───────────────────────────────── */
function initDashboard() {
  updateSidebarUser();
  updateGreeting();
  buildSubjectsGrid();
  buildTimerSubjectPills();
  updateStats();
  loadDashboardSessions();
  renderAnalytics();
  renderHistory();
  updatePlanBadge();
  renderSettingsView();
  checkAnnouncements();
  
  // Online count logic
  updateOnlineCount();
  if (!window.onlineCountInterval) {
    window.onlineCountInterval = setInterval(updateOnlineCount, 5 * 60 * 1000); // 5 dakikada bir güncelle
  }
  
  if (typeof initAgendaView === 'function') {
    initAgendaView();
  }
  switchView('agenda');
}

async function updateOnlineCount() {
  if (state.user) await fbUpdatePresence(state.user.uid);
  try {
    let count = await fbGetOnlineCount();
    if (count < 1) count = 1;
    
    const countEl = document.getElementById('online-count');
    if (countEl) {
      if (count === 1) {
        countEl.innerHTML = 'Şu an <strong style="color:var(--text); font-weight:600;">tek başına</strong> ders çalışıyorsun';
      } else {
        countEl.innerHTML = `Seninle beraber <strong style="color:var(--text); font-weight:600;">${count} kişi</strong> ders çalışıyor`;
      }
    }
  } catch (err) {
    console.error('Online count hatası:', err);
  }
}

function updateSidebarUser() {
  const examNames = (state.user.examIds || []).map(id => {
    const exam = EXAM_TYPES.find(e => e.id === id);
    return exam ? exam.name : '';
  }).filter(Boolean).join(', ');
  document.getElementById('sidebar-name').textContent = state.user.name || 'Kullanıcı';
  document.getElementById('sidebar-exam').textContent = examNames || '—';
  document.getElementById('sidebar-avatar').textContent = (state.user.name || 'U')[0].toUpperCase();
}

function updateGreeting() {
  const h = new Date().getHours();
  let g = 'Merhaba';
  if (h < 12) g = 'Günaydın';
  else if (h < 18) g = 'İyi günler';
  else g = 'İyi akşamlar';

  const name = state.user.name ? state.user.name.split(' ')[0] : '';
  document.getElementById('home-greeting').textContent = `${g}, ${name} 👋`;

  const days = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const now = new Date();
  document.getElementById('home-date').textContent =
    `${days[now.getDay()]}, ${now.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' })}`;

  const examNames = (state.user.examIds || []).map(id => {
    const exam = EXAM_TYPES.find(e => e.id === id);
    return exam ? exam.name : '';
  }).filter(Boolean).join(', ');
  document.getElementById('home-exam-badge').textContent = examNames || '—';
}

/* ─────────────────────────────────
   VIEW SWITCHING
───────────────────────────────── */
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const viewEl = document.getElementById('view-' + view);
  const navEl = document.getElementById('nav-' + view);
  if (viewEl) viewEl.classList.add('active');
  if (navEl) navEl.classList.add('active');

  if (view === 'analytics') renderAnalytics();
  if (view === 'history')   renderHistory();
  if (view === 'settings')  renderSettingsView();

  if (window.innerWidth <= 900) {
    document.getElementById('sidebar').classList.remove('open');
  }
}


/* ─────────────────────────────────
   SUBJECTS (Home)
───────────────────────────────── */
function getSubjects() {
  const examIds = state.user.examIds || [];
  const subjectMap = new Map();
  examIds.forEach(examId => {
    const exam = EXAM_TYPES.find(e => e.id === examId);
    if (exam) {
      exam.subjects.forEach(sub => {
        if (!subjectMap.has(sub.id)) {
          subjectMap.set(sub.id, sub);
        }
      });
    }
  });
  return Array.from(subjectMap.values());
}

// Tüm sınav türlerinden subject ara (geçmiş kayıtlar için)
function findSubjectGlobal(subjectId) {
  for (const exam of EXAM_TYPES) {
    const sub = exam.subjects.find(s => s.id === subjectId);
    if (sub) return { exam, subject: sub };
  }
  return null;
}

function buildSubjectsGrid() {
  const grid = document.getElementById('subjects-grid');
  grid.innerHTML = '';
  const subjects = getSubjects();
  const totals = getSubjectTotals();
  const maxMin = Math.max(...Object.values(totals), 1);

  subjects.forEach(sub => {
    const mins = totals[sub.id] || 0;
    const pct  = Math.min((mins / maxMin) * 100, 100);
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.style.setProperty('--card-color', sub.color);
    card.innerHTML = `
      <div class="sc-emoji">${sub.emoji}</div>
      <div class="sc-name">${sub.name}</div>
      <div class="sc-time">
        <svg viewBox="0 0 24 24" fill="none" stroke="${sub.color}" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${formatMins(mins)}
      </div>
      <div class="sc-bar"><div class="sc-bar-fill" style="width:${pct}%;background:${sub.color}"></div></div>
    `;
    card.onclick = () => { switchView('timer'); selectTimerSubject(sub.id); };
    grid.appendChild(card);
  });
}

function getSubjectTotals() {
  const totals = {};
  state.sessions.forEach(s => {
    totals[s.subjectId] = (totals[s.subjectId] || 0) + s.durationMins;
  });
  return totals;
}

/* ─────────────────────────────────
   STATS (Home)
───────────────────────────────── */
function updateStats() {
  const today = dateStr(new Date());
  
  let todayMins = 0, weekMins = 0, totalSessions = 0, bestDay = 0;
  const dayMap = {};

  const now = new Date();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

  state.sessions.forEach(s => {
    totalSessions++;
    // Tarih normalize edilmiş olsa bile güvenli ayrıştırma yapıyoruz
    if (!s.date) return;
    const dStr = s.date.includes('T') ? s.date.split('T')[0] : s.date;
    const dDate = new Date(s.date);

    if (dDate >= weekAgo) weekMins += s.durationMins;
    
    dayMap[dStr] = (dayMap[dStr] || 0) + s.durationMins;
    if (dStr === today) todayMins += s.durationMins;
  });

  Object.values(dayMap).forEach(v => { if (v > bestDay) bestDay = v; });

  document.getElementById('val-today').textContent    = formatMins(todayMins);
  document.getElementById('val-week').textContent     = formatMins(weekMins);
  document.getElementById('val-sessions').textContent = totalSessions;
  document.getElementById('val-best').textContent     = formatMins(bestDay);

  let streak = 0;
  let d = new Date();
  while (true) {
    const ds = dateStr(d);
    if (dayMap[ds]) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  document.getElementById('streak-count').textContent = streak;
  
  if (streak > 0) document.getElementById('streak-badge').classList.add('active');
  else document.getElementById('streak-badge').classList.remove('active');

  updateExamCountdown();
}

/* ─────────────────────────────────
   TIMER
───────────────────────────────── */
function buildTimerSubjectPills() {
  const cont = document.getElementById('timer-subject-pills');
  cont.innerHTML = '';
  const subjects = getSubjects();
  subjects.forEach(sub => {
    const p = document.createElement('button');
    p.className = 'sp-pill';
    p.id = 'pill-' + sub.id;
    p.textContent = sub.emoji + ' ' + sub.name;
    p.onclick = () => selectTimerSubject(sub.id);
    cont.appendChild(p);
  });
}

function selectTimerSubject(id) {
  state.timerSubject = id;
  // If user manually changes subject, detach from agenda task
  state.activeAgendaTaskId = null;
  
  document.querySelectorAll('.sp-pill').forEach(p => p.classList.remove('selected'));
  const pill = document.getElementById('pill-' + id);
  if (pill) pill.classList.add('selected');

  const sub = getSubjects().find(s => s.id === id);
  document.getElementById('timer-subject-label').textContent = sub ? sub.name + ' çalışıyorsun' : 'Ders seçilmedi';
}

function selectMode(mode) {
  state.timerMode = mode;
  document.getElementById('mode-konu').classList.toggle('active', mode === 'konu');
  document.getElementById('mode-soru').classList.toggle('active', mode === 'soru');
}

function setDuration(mins, btn) {
  if (state.timerActive) return showToast('Zamanlayıcı çalışırken süre değiştirilemez.', 'error');
  document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  state.lastSetDurationMins = mins;
  state.timerSeconds = mins * 60;
  state.timerTotal   = mins * 60;
  updateClockDisplay();
  updateRing(1);
}

function setCustomDuration() {
  if (state.timerActive) return showToast('Zamanlayıcı çalışırken süre değiştirilemez.', 'error');
  const inp = document.getElementById('inp-custom-dur');
  const mins = parseInt(inp?.value);
  if (!mins || mins < 1) {
    return showToast('Geçerli bir süre giriniz (en az 1 dk).', 'warning');
  }
  setDuration(mins, null);
  showToast(`${mins} dakikalık özel süre ayarlandı!`, 'success');
  if (inp) inp.value = '';
}

function toggleTimer() {
  if (!state.timerSubject) { showToast('Önce bir ders seçin.', 'error'); return; }
  if (!state.timerActive) startTimer();
  else pauseTimer();
}

function startTimer() {
  state.timerActive = true;
  state.timerPaused = false;
  state.currentSessionStart = new Date();
  showPlayPause(true);
  state.timerInterval = setInterval(timerTick, 1000);
  showFullscreenTimer();
}

function pauseTimer() {
  clearInterval(state.timerInterval);
  state.timerActive = false;
  state.timerPaused = true;
  showPlayPause(false);
  updateFullscreenPlayPause(false);
}

function resetTimer() {
  stopTimer();
  const mins = state.lastSetDurationMins || 25;
  state.timerSeconds = mins * 60;
  state.timerTotal   = mins * 60;
  updateClockDisplay();
  updateRing(1);
  state.isBreak = false;
  state.activeAgendaTaskId = null;
  document.getElementById('clock-mode-label').textContent = 'Odak Süresi';
  document.getElementById('result-card').classList.add('hidden');
  hideFullscreenTimer();
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerActive = false;
  state.timerPaused = false;
  showPlayPause(false);
}

function skipBreak() {
  if (state.isBreak) {
    state.isBreak = false;
    resetTimerAfterBreak();
  }
}

function timerTick() {
  if (state.timerSeconds <= 0) {
    clearInterval(state.timerInterval);
    state.timerActive = false;
    onTimerComplete();
    return;
  }
  state.timerSeconds--;
  updateClockDisplay();
  updateRing(state.timerSeconds / state.timerTotal);
}

function updateClockDisplay() {
  const m = Math.floor(state.timerSeconds / 60);
  const s = state.timerSeconds % 60;
  const timeStr = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  document.getElementById('clock-display').textContent = timeStr;
  // Fullscreen
  const fsDisplay = document.getElementById('fs-clock-display');
  if (fsDisplay) fsDisplay.textContent = timeStr;
}

function updateRing(fraction) {
  const circ = 2 * Math.PI * 110;
  const offset = circ * (1 - fraction);
  document.getElementById('ring-progress').style.strokeDashoffset = offset;
  // Fullscreen ring
  const fsRing = document.getElementById('fs-ring-progress');
  if (fsRing) {
    const fsCir = 2 * Math.PI * 140;
    fsRing.style.strokeDashoffset = fsCir * (1 - fraction);
  }
}

function showPlayPause(playing) {
  document.getElementById('play-icon').classList.toggle('hidden', playing);
  document.getElementById('pause-icon').classList.toggle('hidden', !playing);
}

function onTimerComplete() {
  showPlayPause(false);
  updateFullscreenPlayPause(false);
  updateClockDisplay();

  if (!state.isBreak) {
    state.pomodoroCount++;
    updatePomDots();
    document.getElementById('result-card').classList.remove('hidden');
    document.getElementById('inp-correct').value = 0;
    document.getElementById('inp-wrong').value   = 0;

    const durationMins = Math.round(state.timerTotal / 60);
    document.getElementById('modal-msg').textContent = `${formatMins(durationMins)} boyunca harika çalıştın. Mola hak ettin!`;
    hideFullscreenTimer();
    document.getElementById('modal-complete').classList.remove('hidden');
    playBeep();
  } else {
    showToast('Mola bitti! Yeniden başlama zamanı 💪', 'success');
    state.isBreak = false;
    resetTimerAfterBreak();
    hideFullscreenTimer();
    playBeep();
  }
}

function resetTimerAfterBreak() {
  const mins = state.lastSetDurationMins || 25;
  state.timerSeconds = mins * 60;
  state.timerTotal   = mins * 60;
  document.getElementById('clock-mode-label').textContent = 'Odak Süresi';
  updateClockDisplay();
  updateRing(1);
  showPlayPause(false);
}

function startBreak() {
  document.getElementById('modal-complete').classList.add('hidden');
  // Modal'daki inputtan mola süresini al
  const breakInput = document.getElementById('inp-modal-break');
  const breakMins = breakInput ? (parseInt(breakInput.value) || 10) : 10;
  state.isBreak = true;
  state.timerSeconds = breakMins * 60;
  state.timerTotal   = breakMins * 60;
  document.getElementById('clock-mode-label').textContent = `${breakMins} dk Mola`;
  updateClockDisplay();
  updateRing(1);
  startTimer();
}

function setModalBreak(mins) {
  const input = document.getElementById('inp-modal-break');
  if (input) input.value = mins;
  // Aktif buton vurgulama
  document.querySelectorAll('.break-quick-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.textContent) === mins);
  });
}

function skipBreakModal() {
  document.getElementById('modal-complete').classList.add('hidden');
  state.isBreak = false;
  resetTimerAfterBreak();
}

async function saveSession() {
  // Kontroller
  if (!state.user) {
    showToast('Önce giriş yapmanız gerekmektedir.', 'error');
    return;
  }
  if (!state.timerSubject) {
    showToast('Lütfen bir ders seçiniz (Türkçe, Matematik vb.)', 'error');
    return;
  }

  const durationMins = Math.round(state.timerTotal / 60);
  const correct = parseInt(document.getElementById('inp-correct').value) || 0;
  const wrong   = parseInt(document.getElementById('inp-wrong').value) || 0;

  const session = {
    date: new Date().toISOString(),
    subjectId: state.timerSubject,
    mode: state.timerMode,
    durationMins,
    correct,
    wrong,
  };

  try {
    const id = await fbSaveSession(state.user.uid, session);
    session.id = id;
    state.sessions.unshift(session);
    
    // Calculate cumulative time studied for this subject today (LOCAL TIME)
    const getLocalYMD = (dStr) => {
      const d = new Date(dStr || new Date());
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };

    const localTodayStr = getLocalYMD(new Date());
    let todaySubjectTotal = 0;
    
    state.sessions.forEach(s => {
      if (s.subjectId === session.subjectId) {
        if (getLocalYMD(s.date) === localTodayStr) {
          todaySubjectTotal += s.durationMins;
        }
      }
    });

    if (typeof agendaState !== 'undefined' && agendaState.tasks) {
      // Find all tasks for this subject today (Make sure we only process current agenda date)
      const currentAgendaDateStr = typeof toDateStr === 'function' ? toDateStr(agendaState.currentDate) : localTodayStr;
      
      if (currentAgendaDateStr === localTodayStr) {
        const subjectTasks = agendaState.tasks.filter(t => t.subjectId === session.subjectId);
        
        // Calculate how many minutes are already "claimed" by completed tasks
        let claimedMins = 0;
        subjectTasks.filter(t => t.done).forEach(t => {
            claimedMins += t.durationMin;
        });

        let remainingMins = todaySubjectTotal - claimedMins;

        // Try to complete incomplete tasks with the remaining minutes
        const incompleteTasks = subjectTasks.filter(t => !t.done);
        for (const task of incompleteTasks) {
           if (remainingMins >= task.durationMin) {
               if (typeof toggleTask === 'function') {
                   await toggleTask(task.id, true);
                   showToast('Ajanda görevi tamamlandı! (Süre hedefine ulaşıldı)', 'success');
               }
               remainingMins -= task.durationMin;
           }
        }
      }
    }
    state.activeAgendaTaskId = null;

    addSessionToLog(session);
    updateStats();
    buildSubjectsGrid();
    document.getElementById('result-card').classList.add('hidden');
    showToast('Seans başarıyla kaydedildi! ☁️', 'success');
    resetTimer();
  } catch (err) {
    console.error('Kaydetme hatası detayı:', err);
    showToast('Kayıt başarısız: ' + (err.message || 'Bilinmeyen hata'), 'error');
  }
}

function updatePomDots() {
  const count = Math.min(state.pomodoroCount, 4);
  const dots = Array(4).fill('○').map((_, i) => i < count ? '⬤' : '○').join(' ');
  document.getElementById('pom-dots').textContent = dots;
  document.getElementById('pom-label').textContent = `Pomodoro #${state.pomodoroCount + 1}`;
}

function addSessionToLog(s) {
  if (!s) return;
  const list = document.getElementById('session-log-list');
  if (!list) return;
  
  const placeholder = list.querySelector('.empty-hint');
  if (placeholder) placeholder.remove();

  const found = findSubjectGlobal(s.subjectId);
  const examName = found ? found.exam.name : '';
  const sub = found ? found.subject : null;
  const name = sub ? `${examName} - ${sub.name}` : (s.subjectId || 'Bilinmeyen Ders');
  
  const item = document.createElement('div');
  item.className = 'session-item';
  item.innerHTML = `
    <div class="si-dot" style="background:${sub?.color || 'var(--gold)'}"></div>
    <span class="si-subject">${name}</span>
    <span class="si-mode">${s.mode === 'konu' ? '📖 Konu' : '✏️ Soru'}</span>
    <span class="si-dur">${formatMins(s.durationMins || 0)}</span>
    <span class="si-result">${s.correct || 0}D / ${s.wrong || 0}Y</span>
  `;
  list.prepend(item);
}

// Tüm seansları ana sayfa listesine yükler
function loadDashboardSessions() {
  const list = document.getElementById('session-log-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (!state.sessions || !state.sessions.length) {
    list.innerHTML = '<div class="empty-hint">Henüz seans kaydı yok.</div>';
    return;
  }
  
  // Son 10 seansı göster
  state.sessions.slice(0, 10).forEach(s => {
    if (!s) return;
    const found = findSubjectGlobal(s.subjectId);
    const examName = found ? found.exam.name : '';
    const sub = found ? found.subject : null;
    const displayName = sub ? `${examName} - ${sub.name}` : (s.subjectId || 'Bilinmeyen Ders');
    const item = document.createElement('div');
    item.className = 'session-item';
    item.innerHTML = `
      <div class="si-dot" style="background:${sub?.color || 'var(--gold)'}"></div>
      <span class="si-subject">${displayName}</span>
      <span class="si-mode">${s.mode === 'konu' ? '📖 Konu' : '✏️ Soru'}</span>
      <span class="si-dur">${formatMins(s.durationMins || 0)}</span>
      <span class="si-result">${s.correct || 0}D / ${s.wrong || 0}Y</span>
    `;
    list.appendChild(item);
  });
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch(e) {}
}

/* ─────────────────────────────────
   ANALYTICS & HISTORY (Aynı kalıyor, Firestore verisi kullanıyor)
───────────────────────────────── */
function renderAnalytics() {
  renderBarChart();
  renderDonutChart();
  renderSummary();
}

function getWeekDates() {
  const now = new Date();
  now.setDate(now.getDate() + state.weekOffset * 7);
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function renderBarChart() {
  const chart = document.getElementById('bar-chart');
  chart.innerHTML = '';
  const dates = getWeekDates();
  const dayData = {};
  const startStr = dateStr(dates[0]);
  const endStr   = dateStr(dates[6]);

  state.sessions.forEach(s => {
    const d = s.date.split('T')[0];
    if (d >= startStr && d <= endStr) {
      dayData[d] = (dayData[d] || 0) + s.durationMins;
    }
  });

  const maxMins = Math.max(...Object.values(dayData), 60);
  dates.forEach((date) => {
    const ds = dateStr(date);
    const mins = dayData[ds] || 0;
    const heightPct = (mins / maxMins) * 65;
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `<div class="bar-fill" style="height:${Math.max(heightPct, 2)}%"><div class="bar-tooltip">${mins} dk</div></div><span class="bar-day">${DAY_NAMES[date.getDay()]}</span>`;
    chart.appendChild(col);
  });
  const wl = document.getElementById('week-label');
  if (state.weekOffset === 0) wl.textContent = 'Bu Hafta';
  else if (state.weekOffset === -1) wl.textContent = 'Geçen Hafta';
  else wl.textContent = `${dates[0].toLocaleDateString('tr-TR',{day:'numeric',month:'short'})} – ${dates[6].toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}`;
}

function renderDonutChart() {
  const canvas = document.getElementById('donut-chart');
  const ctx = canvas.getContext('2d');
  const legend = document.getElementById('donut-legend');
  legend.innerHTML = '';
  const dates = getWeekDates();
  const startStr = dateStr(dates[0]), endStr = dateStr(dates[6]);
  const subTotals = {};
  state.sessions.forEach(s => {
    const d = s.date.split('T')[0];
    if (d >= startStr && d <= endStr) subTotals[s.subjectId] = (subTotals[s.subjectId] || 0) + s.durationMins;
  });
  const entries = Object.entries(subTotals).sort((a,b) => b[1]-a[1]);
  const total = entries.reduce((acc, [,v]) => acc + v, 0);
  ctx.clearRect(0, 0, 220, 220);
  if (total === 0) {
    ctx.fillStyle = '#EEE'; ctx.beginPath(); ctx.arc(110, 110, 80, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#999'; ctx.font = '13px Outfit'; ctx.textAlign = 'center'; ctx.fillText('Veri yok', 110, 115);
    return;
  }
  let startAngle = -Math.PI / 2;
  const subjects = getSubjects();
  entries.forEach(([subId, mins], i) => {
    const slice = (mins / total) * Math.PI * 2;
    const sub = subjects.find(s => s.id === subId);
    const color = sub?.color || CHART_COLORS[i % CHART_COLORS.length];
    ctx.beginPath(); ctx.moveTo(110, 110); ctx.arc(110, 110, 95, startAngle, startAngle + slice); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); startAngle += slice;
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<div class="legend-dot" style="background:${color}"></div><span class="legend-name">${sub ? sub.name : subId}</span><span class="legend-val">${mins}dk</span>`;
    legend.appendChild(item);
  });
  ctx.beginPath(); ctx.arc(110, 110, 55, 0, Math.PI*2); ctx.fillStyle = '#FFF'; ctx.fill();
  ctx.fillStyle = '#2C2107'; ctx.font = 'bold 22px Outfit'; ctx.textAlign = 'center'; ctx.fillText(formatMins(total), 110, 107);
  ctx.fillStyle = '#8B7D5A'; ctx.font = '12px Outfit'; ctx.fillText('bu hafta', 110, 126);
}

function renderSummary() {
  const list = document.getElementById('summary-list');
  list.innerHTML = '';
  const dates = getWeekDates();
  const startStr = dateStr(dates[0]), endStr = dateStr(dates[6]);
  let totalMins = 0, totalSessions = 0, totalCorrect = 0, totalWrong = 0;
  state.sessions.forEach(s => {
    const d = s.date.split('T')[0];
    if (d >= startStr && d <= endStr) { totalMins += s.durationMins; totalSessions++; totalCorrect += (s.correct || 0); totalWrong += (s.wrong || 0); }
  });
  const items = [
    { label: 'Toplam Çalışma', val: formatMins(totalMins) }, { divider: true },
    { label: 'Seans Sayısı', val: totalSessions }, { divider: true },
    { label: 'Net Soru', val: `${totalCorrect - Math.round(totalWrong/4)} net`, sub: `${totalCorrect}D / ${totalWrong}Y` }, { divider: true },
    { label: 'Günlük Ortalama', val: formatMins(Math.round(totalMins / 7)) },
  ];
  items.forEach(item => {
    if (item.divider) { const d = document.createElement('div'); d.className = 'sum-divider'; list.appendChild(d); }
    else { const el = document.createElement('div'); el.className = 'summary-item'; el.innerHTML = `<span class="sum-label">${item.label}</span><span class="sum-val">${item.val}</span>`; list.appendChild(el); }
  });
}

function changeWeek(dir) {
  state.weekOffset += dir;
  if (state.weekOffset > 0) state.weekOffset = 0;
  renderAnalytics();
}

function renderHistory(filterExamId) {
  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  buildHistoryFilters(filterExamId || 'all');

  // Free plan banner
  const { visible, locked } = getHistorySessionsForPlan();
  const proBanner = document.getElementById('history-pro-banner');
  if (proBanner) proBanner.classList.toggle('hidden', locked.length === 0 || isPro());

  if (!state.sessions || !state.sessions.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-hint">Kayıt bulunamadı.</td></tr>';
    return;
  }

  // Görüntülenecek seanslar (filtreyle + plan kilit)
  let filtered = visible;
  if (filterExamId && filterExamId !== 'all') {
    const examDef = EXAM_TYPES.find(e => e.id === filterExamId);
    if (examDef) {
      const examSubjectIds = examDef.subjects.map(s => s.id);
      filtered = visible.filter(s => examSubjectIds.includes(s.subjectId));
    }
  }

  if (!filtered.length && locked.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-hint">Bu filtre için kayıt bulunamadı.</td></tr>';
    return;
  }

  filtered.slice(0, 100).forEach(s => {
    if (!s) return;
    const found = findSubjectGlobal(s.subjectId);
    const examName = found ? found.exam.name : '-';
    const sub = found ? found.subject : null;
    const subName = sub ? sub.name : (s.subjectId || '-');

    let dateShown = 'Tarih Yok';
    if (s.date) {
      try {
        dateShown = new Date(s.date).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
      } catch(e) {}
    }

    const net = (s.correct || 0) - Math.round((s.wrong || 0) / 4);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateShown}</td>
      <td><span class="badge-exam">${examName}</span></td>
      <td>${sub ? (sub.emoji + ' ' + subName) : subName}</td>
      <td>${s.mode === 'konu' ? '<span class="badge-konu">📖 Konu</span>' : '<span class="badge-soru">✏️ Soru</span>'}</td>
      <td>${formatMins(s.durationMins || 0)}</td>
      <td>${s.correct || 0}D / ${s.wrong || 0}Y (${net} net)</td>
    `;
    tbody.appendChild(tr);
  });

  // Kilitli seanslar satırı
  if (locked.length > 0 && !isPro()) {
    const lockRow = document.createElement('tr');
    lockRow.className = 'locked-row';
    lockRow.innerHTML = `
      <td colspan="6">
        <div class="history-lock-row">
          <span>🔒 ${locked.length} kayıt gizlendi</span>
          <button class="btn-gold-sm" onclick="showUpgradeModal('7 günden eski tüm çalışma kayıtlarını görmek için Pro plana geçin.')">Pro'ya Geç →</button>
        </div>
      </td>`;
    tbody.appendChild(lockRow);
  }
}

function buildHistoryFilters(activeFilter) {
  const container = document.getElementById('history-filters');
  if (!container) return;
  container.innerHTML = '';

  // "Tümü" butonu
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-pill' + (activeFilter === 'all' ? ' active' : '');
  allBtn.textContent = '📋 Tümü';
  allBtn.onclick = () => filterHistory('all');
  container.appendChild(allBtn);

  // Seçili sınav türleri için butonlar
  const examIds = state.user?.examIds || [];
  examIds.forEach(examId => {
    const exam = EXAM_TYPES.find(e => e.id === examId);
    if (!exam) return;
    const btn = document.createElement('button');
    btn.className = 'filter-pill' + (activeFilter === examId ? ' active' : '');
    btn.textContent = exam.emoji + ' ' + exam.name;
    btn.onclick = () => filterHistory(examId);
    container.appendChild(btn);
  });
}

function filterHistory(examId) {
  renderHistory(examId);
}

async function clearHistory() {
  if (!state.user) return;
  if (!confirm('Tüm geçmiş kayıtlar silinecek. Emin misin?')) return;
  try {
    await fbClearSessions(state.user.uid);
    state.sessions = [];
    renderHistory();
    updateStats();
    buildSubjectsGrid();
    showToast('Geçmiş silindi.', 'success');
  } catch (err) {
    showToast('Geçmiş silinemedi.', 'error');
  }
}

function formatMins(mins) {
  if (mins < 60) return mins + ' dk';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

function dateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.remove('hidden');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.add('hidden'), 3000);
}

/* ─────────────────────────────────
   FULLSCREEN TIMER
───────────────────────────────── */
function showFullscreenTimer() {
  const overlay = document.getElementById('fullscreen-timer');
  if (!overlay) return;

  // Ders adı ve modu güncelle
  const sub = getSubjects().find(s => s.id === state.timerSubject);
  const fsSubject = document.getElementById('fs-subject-label');
  if (fsSubject) fsSubject.textContent = sub ? sub.emoji + ' ' + sub.name : 'Ders seçilmedi';

  const fsMode = document.getElementById('fs-mode-label');
  if (fsMode) fsMode.textContent = state.isBreak 
    ? `${Math.round(state.timerTotal / 60)} dk Mola` 
    : (state.timerMode === 'konu' ? '📖 Konu Çalışma' : '✏️ Soru Çözme');

  updateFullscreenPlayPause(true);
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hideFullscreenTimer() {
  const overlay = document.getElementById('fullscreen-timer');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function updateFullscreenPlayPause(playing) {
  const fsPlayIcon = document.getElementById('fs-play-icon');
  const fsPauseIcon = document.getElementById('fs-pause-icon');
  if (fsPlayIcon) fsPlayIcon.classList.toggle('hidden', playing);
  if (fsPauseIcon) fsPauseIcon.classList.toggle('hidden', !playing);
}

function toggleFullscreenTimer() {
  if (!state.timerActive) {
    // Resume
    state.timerActive = true;
    state.timerPaused = false;
    showPlayPause(true);
    updateFullscreenPlayPause(true);
    state.timerInterval = setInterval(timerTick, 1000);
  } else {
    pauseTimer();
  }
}

function resetFullscreenTimer() {
  resetTimer();
}

function exitFullscreenTimer() {
  if (state.timerActive) {
    pauseTimer();
  }
  hideFullscreenTimer();
}

// ESC tuşuyla fullscreen'den çıkış
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('fullscreen-timer');
    if (overlay && overlay.classList.contains('active')) {
      exitFullscreenTimer();
    }
  }
});



function updateBreakShort(val) {
  const v = Math.max(1, Math.min(30, parseInt(val) || 5));
  state.breakShort = v;
  const inp = document.getElementById('inp-break-short');
  if (inp) inp.value = v;
  if (state.user) {
    fbSetBreakSettings(state.user.uid, v, state.breakLong)
      .then(() => showToast('Kısa mola süresi güncellendi.', 'success'))
      .catch(() => showToast('Kayıt hatası.', 'error'));
  }
}

function updateBreakLong(val) {
  const v = Math.max(1, Math.min(60, parseInt(val) || 15));
  state.breakLong = v;
  const inp = document.getElementById('inp-break-long');
  if (inp) inp.value = v;
  if (state.user) {
    fbSetBreakSettings(state.user.uid, state.breakShort, v)
      .then(() => showToast('Uzun mola süresi güncellendi.', 'success'))
      .catch(() => showToast('Kayıt hatası.', 'error'));
  }
}

/* ─────────────────────────────────
   SIDEBAR (Hamburger Menü)
───────────────────────────────── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// Sidebar dışına tıklayınca kapat
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  if (!sidebar || !hamburger) return;
  if (sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      !hamburger.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

/* ─────────────────────────────────
   PLAN YÖNETİMİ
───────────────────────────────── */
function getUserPlan() {
  return state.user?.plan || 'free';
}

function isPro() {
  const plan = getUserPlan();
  if (plan !== 'pro') return false;
  const expiry = state.user?.planExpiry;
  if (!expiry) return true;
  const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
  return expiryDate > new Date();
}

function updatePlanBadge() {
  const chip = document.getElementById('sidebar-plan-chip');
  if (!chip) return;
  if (isPro()) {
    chip.textContent = '⭐ PRO';
    chip.className = 'plan-chip pro';
  } else {
    chip.textContent = 'FREE';
    chip.className = 'plan-chip free';
  }
}

/* ─────────────────────────────────
   UPGRADE MODAL
───────────────────────────────── */
function showUpgradeModal(reason) {
  const modal = document.getElementById('modal-upgrade');
  const reasonEl = document.getElementById('upgrade-reason-text');
  if (reasonEl && reason) reasonEl.textContent = reason;
  if (modal) modal.classList.remove('hidden');
}

function hideUpgradeModal() {
  const modal = document.getElementById('modal-upgrade');
  if (modal) modal.classList.add('hidden');
}

/* ─────────────────────────────────
   ÖDEME (İYZİCO)
───────────────────────────────── */
async function initiatePayment() {
  hideUpgradeModal();
  const modal = document.getElementById('modal-payment');
  if (modal) modal.classList.remove('hidden');

  // Iyzico ödeme formunu yükle
  const formContainer = document.getElementById('iyzico-checkout-form');
  formContainer.innerHTML = `
    <div class="payment-loading">
      <div class="payment-spinner"></div>
      <p>Ödeme formu yükleniyor...</p>
    </div>`;

  try {
    // Deployment sonrası aktif olacak – şimdilik test modu göster
    const data = await fbCreateIyzicoPayment();
    if (data && data.checkoutFormContent) {
      formContainer.innerHTML = data.checkoutFormContent;
      // Iyzico'nun kendi scriptini çalıştır
      Array.from(formContainer.querySelectorAll('script')).forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    } else {
      showPaymentDemo(formContainer);
    }
  } catch (err) {
    console.warn('Iyzico bağlantısı henüz aktif değil (deployment gerekli):', err.message);
    showPaymentDemo(formContainer);
  }
}

function showPaymentDemo(container) {
  container.innerHTML = `
    <div style="text-align:center;padding:2rem">
      <div style="font-size:3rem;margin-bottom:1rem">🏗️</div>
      <h4 style="color:var(--gold);margin-bottom:.5rem">Ödeme Sistemi Kurulumu</h4>
      <p style="color:#999;font-size:.9rem;margin-bottom:1.5rem">
        Ödeme sistemi web sitesi yayına alındıktan sonra aktif olacak.<br>
        Pro planı aktifleştirmek için <strong>admin paneline</strong> gidin.
      </p>
      <button class="btn-outline" onclick="hidePaymentModal()">Tamam</button>
    </div>`;
}

function hidePaymentModal() {
  const modal = document.getElementById('modal-payment');
  if (modal) modal.classList.add('hidden');
}

/* ─────────────────────────────────
   SETTINGS VIEW
───────────────────────────────── */
function renderSettingsView() {
  if (!state.user) return;

  const nameEl = document.getElementById('settings-name');
  const emailEl = document.getElementById('settings-email');

  if (nameEl) nameEl.textContent = state.user.name || '—';
  if (emailEl) emailEl.textContent = state.user.email || '—';

  renderPlanCard();
  loadMyTickets();
}

function renderPlanCard() {
  const card = document.getElementById('plan-card');
  if (!card) return;

  const pro = isPro();
  const expiry = state.user?.planExpiry;
  let expiryStr = '—';
  if (expiry) {
    const d = expiry.toDate ? expiry.toDate() : new Date(expiry);
    expiryStr = d.toLocaleDateString('tr-TR');
  }

  if (pro) {
    card.innerHTML = `
      <div class="plan-status-card pro">
        <div class="psc-left">
          <span class="psc-icon">⭐</span>
          <div>
            <div class="psc-name">StudyPom Pro</div>
            <div class="psc-expiry">Geçerlilik: ${expiryStr}</div>
          </div>
        </div>
        <span class="plan-chip pro">PRO</span>
      </div>
      <p class="psc-desc">Tüm özellikler aktif. Teşekkürler! 🎉</p>
      <button class="btn-outline" style="width:100%; border-color:#ef9a9a; color:#ef9a9a; margin-top:10px;" onclick="cancelProPlan()">
        Üyeliği İptal Et
      </button>
    `;
  } else {
    card.innerHTML = `
      <div class="plan-status-card free">
        <div class="psc-left">
          <span class="psc-icon">🆓</span>
          <div>
            <div class="psc-name">Ücretsiz Plan</div>
            <div class="psc-expiry">Sınırsız sınav türü · 1 haftalık geçmiş</div>
          </div>
        </div>
        <span class="plan-chip free">FREE</span>
      </div>
      <div class="plan-limits-list">
        <div class="pll-item locked">❌ Tüm geçmiş haftalara erişim</div>
        <div class="pll-item locked">❌ CSV veri export</div>
        <div class="pll-item locked">❌ Öncelikli destek</div>
      </div>
      <button class="btn-gold btn-full" onclick="showUpgradeModal('Pro plana geçerek tüm özelliklerin kilidini açın!')">
        🚀 Pro'ya Geç — ₺39/ay
      </button>
    `;
  }
}

async function cancelProPlan() {
  if (!confirm('Pro üyeliğinizi iptal etmek istediğinize emin misiniz? Tüm özel yetkilerinizi kaybedeceksiniz.')) return;
  
  try {
    await fbDb.collection('users').doc(state.user.uid).update({
      plan: 'free',
      planExpiry: null
    });
    
    // Update local state
    state.user.plan = 'free';
    state.user.planExpiry = null;
    
    showToast('Pro üyeliğiniz iptal edildi. Artık ücretsiz plandasınız.', 'info');
    
    // UI update
    renderSettingsView();
    updatePlanBadge();
  } catch(err) {
    showToast('İptal işlemi başarısız: ' + err.message, 'error');
  }
}

function copyUID() {
  const uid = state.user?.uid;
  if (!uid) return;
  navigator.clipboard.writeText(uid).then(() => {
    showToast('UID kopyalandı! 📋', 'success');
  }).catch(() => {
    // Fallback
    const el = document.getElementById('settings-uid');
    if (el) {
      const range = document.createRange();
      range.selectNode(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      showToast('UID kopyalandı!', 'success');
    }
  });
}

async function sendPasswordReset() {
  if (!state.user?.email) return;
  try {
    await fbSendPasswordReset(state.user.email);
    showToast('Şifre sıfırlama maili gönderildi! 📧', 'success');
  } catch (err) {
    showToast('Mail gönderilemedi: ' + (err.message || 'Hata'), 'error');
  }
}

/* ─────────────────────────────────
   DESTEK FORMU
───────────────────────────────── */
async function sendSupportMsg() {
  const msg = document.getElementById('support-msg')?.value?.trim();
  if (!msg) return showToast('Lütfen bir mesaj yazın.', 'error');
  if (!state.user) return;

  try {
    await fbCreateSupportTicket(
      state.user.uid,
      state.user.email || '',
      state.user.name || '',
      msg
    );
    document.getElementById('support-msg').value = '';
    showToast('Mesajınız alındı! En kısa sürede yanıtlayacağız. 💬', 'success');
    loadMyTickets();
  } catch (err) {
    showToast('Mesaj gönderilemedi.', 'error');
  }
}

async function loadMyTickets() {
  if (!state.user) return;
  const listEl = document.getElementById('my-tickets-list');
  if (!listEl) return;
  
  listEl.innerHTML = '<p style="color:var(--text-3); font-size:14px;">Yükleniyor...</p>';
  try {
    const tickets = await fbGetMySupportTickets(state.user.uid);
    if (!tickets || tickets.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-3); font-size:14px;">Henüz geçmiş talebiniz yok.</p>';
      return;
    }
    
    listEl.innerHTML = tickets.map(t => {
      const date = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('tr-TR') : '—';
      let statusHtml = '';
      if (t.status === 'open') statusHtml = '<span style="color:#ef9a9a;font-weight:600;">⏳ İnceleniyor</span>';
      else if (t.status === 'replied') statusHtml = '<span style="color:#64b5f6;font-weight:600;">💬 Yanıtlandı</span>';
      else statusHtml = '<span style="color:#81c784;font-weight:600;">✅ Çözüldü</span>';
      
      return `
        <div style="background:var(--surface); border:1px solid var(--border); padding:16px; border-radius:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px; color:var(--text-3);">
            <span>${date}</span>
            ${statusHtml}
          </div>
          <p style="color:var(--text); font-size:14px; margin-bottom:0;">${t.message}</p>
          ${t.reply ? `<div style="margin-top:12px; padding:12px; background:var(--bg); border-radius:8px; border-left:3px solid var(--gold);">
              <strong style="color:var(--gold-dark); font-size:13px; display:block; margin-bottom:4px;">Destek Ekibi:</strong>
              <span style="font-size:13px; color:var(--text-2); line-height:1.4; display:block;">${t.reply}</span>
            </div>` : ''}
        </div>
      `;
    }).join('');
  } catch(err) {
    listEl.innerHTML = '<p style="color:var(--red); font-size:14px;">Talepler yüklenemedi.</p>';
  }
}

/* ─────────────────────────────────
   VERİ EXPORT (PRO)
───────────────────────────────── */
function exportCSV() {
  if (!isPro()) {
    showUpgradeModal('CSV veri export özelliği sadece Pro kullanıcılar için kullanılabilir.');
    return;
  }

  const headers = ['Tarih', 'Sınav Türü', 'Ders', 'Mod', 'Süre (dk)', 'Doğru', 'Yanlış', 'Net'];
  const rows = state.sessions.map(s => {
    const found = findSubjectGlobal(s.subjectId);
    const examName = found ? found.exam.name : '-';
    const subName = found ? found.subject.name : (s.subjectId || '-');
    const date = s.date ? new Date(s.date).toLocaleDateString('tr-TR') : '-';
    const net = (s.correct || 0) - Math.round((s.wrong || 0) / 4);
    return [date, examName, subName, s.mode === 'konu' ? 'Konu' : 'Soru', s.durationMins || 0, s.correct || 0, s.wrong || 0, net];
  });

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studypom_veri_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV indirildi! 📥', 'success');
}

/* ─────────────────────────────────
   HISTORY FREE PLAN KİLİDİ
───────────────────────────────── */
function getHistorySessionsForPlan() {
  if (isPro()) return { visible: state.sessions, locked: [] };
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  
  const visible = state.sessions.filter(s => {
    if (!s.date) return true;
    return new Date(s.date) >= cutoff;
  });
  const locked = state.sessions.filter(s => {
    if (!s.date) return false;
    return new Date(s.date) < cutoff;
  });
  
  return { visible, locked };
}

/* ─────────────────────────────────
   DUYURU BANNER
───────────────────────────────── */
async function checkAnnouncements() {
  const banner = document.getElementById('dashboard-announcement');
  const textEl = document.getElementById('da-text');
  if (!banner || !textEl) return;
  
  try {
    const announcement = await fbGetActiveAnnouncement();
    if (!announcement) {
      banner.classList.add('hidden');
      return;
    }
    
    let borderColor = 'var(--gold)';
    let icon = '📢';
    if (announcement.type === 'success') { borderColor = '#4CAF50'; icon = '✅'; }
    if (announcement.type === 'warning') { borderColor = '#FF9800'; icon = '⚠️'; }
    
    banner.style.borderLeftColor = borderColor;
    document.getElementById('da-icon').textContent = icon;
    textEl.textContent = announcement.message;
    banner.classList.remove('hidden');
    
  } catch (err) {
    banner.classList.add('hidden');
  }
}

/* ─────────────────────────────────
   ŞIFRE UNUTMA
───────────────────────────────── */
async function handleForgotPassword() {
  const email = document.getElementById('login-email')?.value?.trim();
  if (!email) {
    showToast('Önce e-posta adresinizi girin.', 'error');
    return;
  }
  try {
    await fbSendPasswordReset(email);
    showToast('Şifre sıfırlama maili gönderildi! 📧', 'success');
  } catch (err) {
    showToast('Mail gönderilemedi: ' + (err.message || 'Hata'), 'error');
  }
}

