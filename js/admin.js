// =============================================
// STUDYPOM – Admin Panel Logic
// =============================================

let adminState = {
  currentUser: null,
  isAdmin: false,
  users: [],
  selectedUserUid: null,
};

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  // Yükleniyor ekranı 8 saniye sonra zaman aşımına uğrarsa göster
  const loadingTimeout = setTimeout(() => {
    const loading = document.getElementById('admin-loading');
    const authGate = document.getElementById('admin-auth-gate');
    if (loading && !loading.classList.contains('hidden')) {
      loading.classList.add('hidden');
      if (authGate) authGate.classList.remove('hidden');
      showAdminToast('Firebase bağlantısı zaman aşımına uğradı. Sayfayı yenileyin.', 'error');
    }
  }, 8000);

  const ok = initFirebase();
  if (!ok) {
    clearTimeout(loadingTimeout);
    document.getElementById('admin-loading').classList.add('hidden');
    document.getElementById('admin-auth-gate').classList.remove('hidden');
    showAdminToast('Firebase başlatılamadı. firebase-config.js dosyasını kontrol edin.', 'error');
    return;
  }

  onAuthChange(async (fbUser) => {
    clearTimeout(loadingTimeout);
    const loading = document.getElementById('admin-loading');
    const authGate = document.getElementById('admin-auth-gate');
    const dashboard = document.getElementById('admin-dashboard');

    if (!fbUser) {
      loading.classList.add('hidden');
      authGate.classList.remove('hidden');
      dashboard.classList.add('hidden');
      checkFirstSetup();
      return;
    }

    adminState.currentUser = fbUser;

    // Admin kontrolü
    const isAdmin = await fbIsAdmin(fbUser.uid);
    if (!isAdmin) {
      // Admin değil – ilk kurulum mu?
      const snap = await fbDb.collection('admins').limit(1).get();
      if (snap.empty) {
        // İlk kurulum
        loading.classList.add('hidden');
        showFirstSetupModal(fbUser);
      } else {
        loading.classList.add('hidden');
        authGate.classList.remove('hidden');
        dashboard.classList.add('hidden');
        showAdminToast('Bu hesabın admin yetkisi yok.', 'error');
      }
      return;
    }

    // Admin – dashboard göster
    adminState.isAdmin = true;
    document.getElementById('as-admin-info').textContent = fbUser.email;
    loading.classList.add('hidden');
    authGate.classList.add('hidden');
    dashboard.classList.remove('hidden');

    // İlk yükleme
    loadStats();
    loadUsers();
    loadSupport();
    loadAnnouncements();
  });
});


async function checkFirstSetup() {
  try {
    const snap = await fbDb.collection('admins').limit(1).get();
    if (snap.empty) {
      document.getElementById('setup-banner').classList.remove('hidden');
    }
  } catch (e) {
    // İzin hatası – kullanıcı giriş yapmamış, normal durum
    // Setup banner'ı gizli bırak
    console.log('Admin koleksiyonu kontrol edilemedi (giriş gerekli).');
  }
}

function showFirstSetupModal(fbUser) {
  const modal = document.getElementById('admin-first-setup');
  const info = document.getElementById('setup-uid-info');
  info.textContent = `E-posta: ${fbUser.email}\nUID: ${fbUser.uid}`;
  modal.classList.remove('hidden');
}

async function setupFirstAdmin() {
  if (!adminState.currentUser) return;
  try {
    await fbSetupFirstAdmin(adminState.currentUser.uid, adminState.currentUser.email);
    document.getElementById('admin-first-setup').classList.add('hidden');
    showAdminToast('Admin olarak kaydedildiniz! Sayfa yenileniyor…', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch (err) {
    showAdminToast(err.message || 'Kurulum hatası.', 'error');
  }
}

/* ─── AUTH ─── */
async function adminLogin() {
  const email = document.getElementById('aag-email').value.trim();
  const pw = document.getElementById('aag-password').value;
  const btnText = document.getElementById('aag-btn-text');
  const loader = document.getElementById('aag-loader');
  const errEl = document.getElementById('aag-error');

  if (!email || !pw) { errEl.textContent = 'E-posta ve şifre gerekli.'; errEl.classList.remove('hidden'); return; }

  btnText.classList.add('hidden');
  loader.classList.remove('hidden');
  errEl.classList.add('hidden');

  try {
    await fbLogin(email, pw);
  } catch (err) {
    errEl.textContent = 'Giriş başarısız: ' + (err.message || 'Hata');
    errEl.classList.remove('hidden');
    btnText.classList.remove('hidden');
    loader.classList.add('hidden');
  }
}

async function adminLogout() {
  await fbLogout();
  location.reload();
}

/* ─── VIEW SWITCHING ─── */
function showAdminView(view) {
  document.querySelectorAll('.aview').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.as-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('aview-' + view).classList.add('active');
  document.getElementById('anav-' + view).classList.add('active');

  if (view === 'users') loadUsers();
  if (view === 'support') loadSupport();
  if (view === 'stats') loadStats();
  if (view === 'announce') loadAnnouncements();
}

/* ─── STATS ─── */
async function loadStats() {
  try {
    const stats = await fbGetPlatformStats();
    document.getElementById('stat-total-users').textContent = stats.totalUsers;
    document.getElementById('stat-pro-users').textContent = stats.proUsers;
    document.getElementById('stat-free-users').textContent = stats.freeUsers;

    // Support count
    const supportSnap = await fbDb.collection('support').where('status', '==', 'open').get();
    const openTickets = supportSnap.size;
    document.getElementById('stat-support-count').textContent = openTickets;
    document.getElementById('support-count').textContent = openTickets;

    // Revenue
    const revenue = stats.proUsers * 39;
    document.getElementById('revenue-num').textContent = '₺' + revenue.toLocaleString('tr-TR');
  } catch (err) {
    showAdminToast('İstatistikler yüklenemedi: ' + err.message, 'error');
  }
}

/* ─── USERS ─── */
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Yükleniyor…</td></tr>';
  try {
    adminState.users = await fbGetAllUsers();
    renderUsersTable(adminState.users);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Hata: ${err.message}</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Kullanıcı bulunamadı.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const plan = u.plan || 'free';
    const planBadge = plan === 'pro'
      ? `<span class="badge-pro">⭐ PRO</span>`
      : `<span class="badge-free">FREE</span>`;
    const examNames = (u.examIds || []).map(id => {
      const ex = (typeof EXAM_TYPES !== 'undefined') ? EXAM_TYPES.find(e => e.id === id) : null;
      return ex ? ex.name : id;
    }).join(', ') || '—';
    const name = (u.name || '—').substring(0, 30);
    const email = (u.email || '—').substring(0, 36);
    return `
      <tr>
        <td><strong style="color:var(--text)">${name}</strong></td>
        <td>${email}</td>
        <td>${planBadge}</td>
        <td style="font-size:12px;max-width:180px">${examNames}</td>
        <td>
          <button class="btn-change-plan" onclick="showUserPlanModal('${u.uid}', '${(u.name||'').replace(/'/g,'')}', '${plan}')">
            Plan Değiştir
          </button>
        </td>
      </tr>`;
  }).join('');
}

function filterUsers() {
  const q = document.getElementById('user-search').value.toLowerCase();
  const filtered = adminState.users.filter(u =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q) ||
    (u.uid || '').toLowerCase().includes(q)
  );
  renderUsersTable(filtered);
}

/* ─── USER PLAN MODAL ─── */
function showUserPlanModal(uid, name, currentPlan) {
  adminState.selectedUserUid = uid;
  document.getElementById('plan-modal-user-info').textContent = `${name} · Mevcut plan: ${currentPlan.toUpperCase()}`;
  document.getElementById('modal-user-plan').classList.remove('hidden');
}

function hideUserPlanModal() {
  document.getElementById('modal-user-plan').classList.add('hidden');
  adminState.selectedUserUid = null;
}

async function setUserPlan(plan, months = 1) {
  if (!adminState.selectedUserUid) return;
  try {
    await fbUpdateUserPlan(adminState.selectedUserUid, plan, months);
    hideUserPlanModal();
    showAdminToast(`Plan güncellendi: ${plan.toUpperCase()} (${months} ay)`, 'success');
    await loadUsers();
    await loadStats();
  } catch (err) {
    showAdminToast('Plan güncellenemedi: ' + err.message, 'error');
  }
}

/* ─── SUPPORT TICKETS ─── */
async function loadSupport() {
  const list = document.getElementById('support-list');
  list.innerHTML = '<p class="empty-row">Yükleniyor…</p>';
  try {
    const tickets = await fbGetSupportTickets();
    const open = tickets.filter(t => t.status === 'open');
    document.getElementById('support-count').textContent = open.length;

    if (!tickets.length) {
      list.innerHTML = '<p class="empty-row">Henüz destek talebi yok.</p>';
      return;
    }

    list.innerHTML = tickets.map(t => {
      const date = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('tr-TR') : '—';
      
      let statusHtml = '';
      if (t.status === 'open') statusHtml = '<span style="color:#ef9a9a">⏳ Açık</span>';
      else if (t.status === 'replied') statusHtml = '<span style="color:#64b5f6">💬 Yanıtlandı</span>';
      else statusHtml = '<span style="color:#81c784">✅ Kapalı</span>';

      return `
        <div class="sc-ticket">
          <div class="sc-ticket-header">
            <div>
              <div class="sc-ticket-from">${t.name || '—'} &lt;${t.email || '—'}&gt;</div>
              <div class="sc-ticket-date">${date} · ${statusHtml}</div>
            </div>
            <div style="display:flex; gap:8px;">
              ${t.status === 'open' || t.status === 'replied' ? `<button class="btn-admin-secondary" style="font-size:12px;padding:4px 8px;" onclick="replyTicket('${t.id}')">💬 Cevapla</button>` : ''}
              ${t.status !== 'closed' ? `<button class="btn-close-ticket" onclick="closeTicket('${t.id}')">✅ Kapat</button>` : ''}
            </div>
          </div>
          <p class="sc-ticket-msg">${t.message || ''}</p>
          ${t.reply ? `<div style="margin-top:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:6px; border-left:3px solid var(--gold);"><strong style="color:var(--gold); font-size:12px;">Admin Yanıtı:</strong><br><span style="font-size:13px; color:#ccc;">${t.reply}</span></div>` : ''}
        </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<p class="empty-row">Hata: ${err.message}</p>`;
  }
}

async function replyTicket(ticketId) {
  const msg = prompt("Kullanıcıya gönderilecek yanıtı yazın:");
  if (!msg) return;
  try {
    await fbReplySupportTicket(ticketId, msg);
    showAdminToast('Yanıt gönderildi!', 'success');
    await loadSupport();
  } catch (err) {
    showAdminToast('Yanıt gönderilemedi: ' + err.message, 'error');
  }
}

async function closeTicket(ticketId) {
  try {
    await fbCloseSupportTicket(ticketId);
    showAdminToast('Talep kapatıldı.', 'success');
    await loadSupport();
    await loadStats();
  } catch (err) {
    showAdminToast('Kapatılamadı: ' + err.message, 'error');
  }
}

/* ─── ANNOUNCEMENTS ─── */
async function sendAnnouncement() {
  const msg = document.getElementById('announce-msg').value.trim();
  const type = document.querySelector('input[name="ann-type"]:checked')?.value || 'info';
  if (!msg) { showAdminToast('Duyuru mesajı boş olamaz.', 'error'); return; }
  try {
    await fbSendAnnouncement(msg, type);
    document.getElementById('announce-msg').value = '';
    showAdminToast('Duyuru gönderildi! 📢', 'success');
    await loadAnnouncements();
  } catch (err) {
    showAdminToast('Duyuru gönderilemedi: ' + err.message, 'error');
  }
}

async function loadAnnouncements() {
  const listEl = document.getElementById('active-ann-list');
  if (!listEl) return;
  listEl.innerHTML = '<p class="empty-row">Yükleniyor...</p>';
  try {
    const anns = await fbGetAnnouncements();
    if (!anns || anns.length === 0) {
      listEl.innerHTML = '<p class="empty-row">Şu an aktif duyuru bulunmuyor.</p>';
      return;
    }
    
    listEl.innerHTML = anns.map(a => {
      const d = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('tr-TR') : '';
      let typeLabel = 'ℹ️ Bilgi';
      if (a.type === 'success') typeLabel = '✅ Başarı';
      if (a.type === 'warning') typeLabel = '⚠️ Uyarı';
      
      return `
        <div style="background:#fff; border:1px solid #ddd; padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12px; color:#999; margin-bottom:4px;">${d} · ${typeLabel}</div>
            <div style="font-size:14px; color:#333;">${a.message}</div>
          </div>
          <button class="btn-admin-secondary" style="color:#e53935; border-color:#e53935;" onclick="deleteAnnouncement('${a.id}')">Kaldır</button>
        </div>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = `<p class="empty-row">Hata: ${err.message}</p>`;
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('Bu duyuruyu kaldırmak istediğinize emin misiniz?')) return;
  try {
    await fbDeleteAnnouncement(id);
    showAdminToast('Duyuru kaldırıldı.', 'success');
    await loadAnnouncements();
  } catch (err) {
    showAdminToast('Kaldırılamadı: ' + err.message, 'error');
  }
}

/* ─── TOAST ─── */
function showAdminToast(msg, type = '') {
  const t = document.getElementById('admin-toast');
  t.textContent = msg;
  t.className = 'admin-toast' + (type ? ' ' + type : '');
  t.classList.remove('hidden');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.add('hidden'), 3500);
}
