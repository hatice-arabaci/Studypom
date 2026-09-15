// =============================================
// STUDYPOM – Firebase Service Layer
// Auth (Email/Password) + Firestore
// =============================================

// Firebase v9 Compat SDK (CDN'den yüklendi)
let fbApp, fbAuth, fbDb;

function initFirebase() {
  try {
    // Zaten başlatılmışsa mevcut app'i kullan (sayfa yenileme / çoklu çağrı koruması)
    if (firebase.apps.length > 0) {
      fbApp  = firebase.app();
    } else {
      fbApp  = firebase.initializeApp(firebaseConfig);
    }
    fbAuth = firebase.auth();
    fbDb   = firebase.firestore();

    // Offline persistence (uygulama offline çalışabilsin)
    fbDb.enablePersistence({ synchronizeTabs: true })
      .catch(err => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence: birden fazla sekme açık.');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence bu tarayıcıda desteklenmiyor.');
        }
      });

    console.log('✅ Firebase bağlandı – proje:', firebaseConfig.projectId);
    return true;
  } catch (err) {
    console.error('❌ Firebase başlatılamadı:', err);
    return false;
  }
}

/* ─────────────────────────────────
   AUTH
───────────────────────────────── */

// Kayıt
async function fbRegister(name, email, password) {
  const cred = await fbAuth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName: name });
  
  // 30 günlük deneme süresi tanımla
  const trialExpiry = new Date();
  trialExpiry.setDate(trialExpiry.getDate() + 30);
  
  await fbDb.collection('users').doc(cred.user.uid).set({
    name,
    email,
    plan: 'pro',
    planExpiry: firebase.firestore.Timestamp.fromDate(trialExpiry),
    isTrial: true,
    examIds: [],
    breakSettings: { shortBreak: 5, longBreak: 15 },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return cred.user;
}

// Giriş
async function fbLogin(email, password) {
  const cred = await fbAuth.signInWithEmailAndPassword(email, password);
  return cred.user;
}

// Çıkış
async function fbLogout() {
  await fbAuth.signOut();
}

// Auth durumu değişince çağrılır
function onAuthChange(callback) {
  return fbAuth.onAuthStateChanged(callback);
}

/* ─────────────────────────────────
   USER DOC
───────────────────────────────── */

// Kullanıcı dokümanını oku
async function fbGetUser(uid) {
  const doc = await fbDb.collection('users').doc(uid).get();
  return doc.exists ? { uid, ...doc.data() } : null;
}

// Sınav türlerini güncelle (dizi olarak)
async function fbSetExams(uid, examIds) {
  try {
    await fbDb.collection('users').doc(uid).set({ examIds }, { merge: true });
  } catch (err) {
    console.error('❌ fbSetExams HATASI:', err);
    throw err;
  }
}

// Mola ayarlarını güncelle
async function fbSetBreakSettings(uid, shortBreak, longBreak) {
  try {
    await fbDb.collection('users').doc(uid).set(
      { breakSettings: { shortBreak, longBreak } },
      { merge: true }
    );
  } catch (err) {
    console.error('❌ fbSetBreakSettings HATASI:', err);
    throw err;
  }
}

// Kullanıcı verilerini senkronize et (Eksik isim/email varsa Auth'dan tamamlar)
// Eski examId → examIds migrasyonu + plan alanı init da burada yapılır
async function fbSyncUser(fbUser) {
  if (!fbUser) return null;
  const userRef = fbDb.collection('users').doc(fbUser.uid);
  const doc = await userRef.get();

  const basicInfo = {
    name: fbUser.displayName || 'Kullanıcı',
    email: fbUser.email,
    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
  };

  // Doküman yoksa sıfırdan oluştur
  if (!doc.exists) {
    console.log('📝 Yeni kullanıcı Firestore dokümanı oluşturuluyor...');
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 30);
    
    await userRef.set({
      ...basicInfo,
      plan: 'pro',
      planExpiry: firebase.firestore.Timestamp.fromDate(trialExpiry),
      isTrial: true,
      examIds: [],
      breakSettings: { shortBreak: 5, longBreak: 15 },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    const data = doc.data();

    // Mevcut kullanıcılara 30 günlük deneme tanımla (daha önce tanımlanmadıysa ve 'free' iseler)
    let updates = { ...basicInfo };
    if (data.plan === 'free' && data.isTrial === undefined) {
      console.log('🎁 Mevcut kullanıcıya 30 günlük Pro deneme tanımlanıyor...');
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 30);
      updates.plan = 'pro';
      updates.planExpiry = firebase.firestore.Timestamp.fromDate(trialExpiry);
      updates.isTrial = true;
    }

    // Eksik temel bilgileri ve yeni güncellemeleri tamamla
    await userRef.update(updates);

    // examId -> examIds migrasyonu
    if (data.examId && !data.examIds) {
      console.log('🔄 examId -> examIds migrasyonu yapılıyor...');
      await userRef.set({
        examIds: [data.examId],
        examId: firebase.firestore.FieldValue.delete(),
      }, { merge: true });
    }

    // breakSettings yoksa varsayılan ekle
    if (!data.breakSettings) {
      await userRef.set({ breakSettings: { shortBreak: 5, longBreak: 15 } }, { merge: true });
    }
  }

  // Plan süresi dolmuş mu kontrol et
  const updatedDoc = await userRef.get();
  const updatedData = updatedDoc.data();
  if (updatedData.plan === 'pro' && updatedData.planExpiry) {
    const expiry = updatedData.planExpiry.toDate ? updatedData.planExpiry.toDate() : new Date(updatedData.planExpiry);
    if (expiry < new Date()) {
      console.log('⚠️ Pro plan süresi dolmuş, free\'e düşürülüyor...');
      await userRef.update({ plan: 'free', planExpiry: null });
    }
  }

  const finalDoc = await userRef.get();
  return { uid: fbUser.uid, ...finalDoc.data() };
}

async function fbUpdatePresence(uid) {
  if (!uid) return;
  try {
    await fbDb.collection('presence').doc(uid).set({
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {}
}

async function fbGetOnlineCount() {
  const tenMinsAgo = new Date();
  tenMinsAgo.setMinutes(tenMinsAgo.getMinutes() - 10);
  
  try {
    const snap = await fbDb.collection('presence')
      .where('lastActive', '>=', tenMinsAgo)
      .get();
    return snap.size;
  } catch(e) {
    return 1;
  }
}

/* ─────────────────────────────────
   SESSIONS
───────────────────────────────── */

// Seans kaydet
async function fbSaveSession(uid, session) {
  console.log('💾 Firestore kayıt denemesi - UID:', uid, 'Data:', session);
  try {
    const ref = await fbDb
      .collection('users')
      .doc(uid)
      .collection('sessions')
      .add({
        ...session,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    console.log('✅ Firestore kayıt başarılı, DocID:', ref.id);
    return ref.id;
  } catch (err) {
    console.error('❌ Firestore kayıt HATASI:', err);
    throw err;
  }
}

// Seansları getir (son 200)
async function fbGetSessions(uid) {
  const normalize = (doc) => {
    const data = doc.data();
    // Eğer date bir Firestore Timestamp ise ISO string'e çeviririz
    if (data.date && data.date.toDate) {
      data.date = data.date.toDate().toISOString();
    }
    return { id: doc.id, ...data };
  };

  try {
    // İndeks gereksiniminden ve eksik atanmış alanlardan kaçınmak için
    // orderBy kullanmadan basit çekim yapıp JS tarafında sıralıyoruz.
    const snap = await fbDb
      .collection('users')
      .doc(uid)
      .collection('sessions')
      .limit(200)
      .get();

    let docs = snap.docs.map(normalize);
    // JS'de tarihe göre yeniden eskiye (desc) sıralama
    docs.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });
    
    return docs;
  } catch (err) {
    console.error('❌ Seans çekme HATASI:', err);
    throw err;
  }
}

// Tüm seansları sil
async function fbClearSessions(uid) {
  const snap = await fbDb
    .collection('users')
    .doc(uid)
    .collection('sessions')
    .get();

  const batch = fbDb.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

/* ─────────────────────────────────
   CONFIG DOĞRULAMA
───────────────────────────────── */
function isFirebaseConfigured() {
  return (
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== 'BURAYA_API_KEY' &&
    firebaseConfig.appId &&
    firebaseConfig.appId !== 'BURAYA_APP_ID'
  );
}

/* ─────────────────────────────────
   PLAN YÖNETİMİ
───────────────────────────────── */

// Kullanıcı planını güncelle (admin tarafından çağrılır)
async function fbUpdateUserPlan(uid, plan, months = 1) {
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + months);
  await fbDb.collection('users').doc(uid).set({
    plan,
    planExpiry: plan === 'pro' ? firebase.firestore.Timestamp.fromDate(expiry) : null,
    planUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

// Plan durumunu kontrol et (expired pro → free'e düşür)
async function fbCheckPlanStatus(uid) {
  const doc = await fbDb.collection('users').doc(uid).get();
  if (!doc.exists) return 'free';
  const data = doc.data();
  if (data.plan !== 'pro') return 'free';
  if (data.planExpiry && data.planExpiry.toDate) {
    const expiry = data.planExpiry.toDate();
    if (expiry < new Date()) {
      // Plan süresi geçmiş, free'e düşür
      await fbDb.collection('users').doc(uid).update({ plan: 'free', planExpiry: null });
      return 'free';
    }
  }
  return 'pro';
}

/* ─────────────────────────────────
   ADMİN FONKSİYONLARI
───────────────────────────────── */

// Admin mi kontrol et (admins koleksiyonunda UID var mı)
async function fbIsAdmin(uid) {
  try {
    const doc = await fbDb.collection('admins').doc(uid).get();
    return doc.exists;
  } catch (err) {
    return false;
  }
}

// İlk admin kurulumu (admins koleksiyonu boşsa izin ver)
async function fbSetupFirstAdmin(uid, email) {
  const snap = await fbDb.collection('admins').limit(1).get();
  if (!snap.empty) throw new Error('Admin zaten mevcut. Yetki gerekiyor.');
  await fbDb.collection('admins').doc(uid).set({
    email,
    addedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Admin: tüm kullanıcıları getir (son 200)
async function fbGetAllUsers() {
  const snap = await fbDb.collection('users').limit(200).get();
  return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

// Admin: platform istatistiklerini getir
async function fbGetPlatformStats() {
  const usersSnap = await fbDb.collection('users').get();
  let totalUsers = 0, proUsers = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  usersSnap.forEach(doc => {
    totalUsers++;
    const data = doc.data();
    if (data.plan === 'pro') proUsers++;
  });

  return { totalUsers, proUsers, freeUsers: totalUsers - proUsers };
}

// Admin: duyuru gönder (Firestore'da saklanır, kullanıcılar okur)
async function fbSendAnnouncement(message, type = 'info') {
  await fbDb.collection('announcements').add({
    message,
    type,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    active: true,
  });
}

// Admin: tüm aktif duyuruları getir
async function fbGetAnnouncements() {
  const snap = await fbDb.collection('announcements')
    .where('active', '==', true)
    .get();
  let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  docs.sort((a, b) => {
    const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
    const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
    return tB - tA;
  });
  return docs;
}

// Admin: duyuruyu sil (tamamen kaldır)
async function fbDeleteAnnouncement(id) {
  await fbDb.collection('announcements').doc(id).delete();
}

// Kullanıcı: aktif duyuruları getir
async function fbGetActiveAnnouncement() {
  const snap = await fbDb.collection('announcements')
    .where('active', '==', true)
    .get();
    
  if (snap.empty) return null;
  
  let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  docs.sort((a, b) => {
    const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
    const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
    return tB - tA;
  });
  
  return docs[0];
}

/* ─────────────────────────────────
   DESTEK / SUPPORT
───────────────────────────────── */

// Kullanıcıdan destek talebi oluştur
async function fbCreateSupportTicket(uid, email, name, message) {
  await fbDb.collection('support').add({
    uid,
    email,
    name,
    message,
    status: 'open',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Admin: tüm destek taleplerini getir
async function fbGetSupportTickets() {
  const snap = await fbDb.collection('support')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Kullanıcı: kendi destek taleplerini getir
async function fbGetMySupportTickets(uid) {
  const snap = await fbDb.collection('support')
    .where('uid', '==', uid)
    .get();
    
  let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  docs.sort((a, b) => {
    const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
    const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
    return tB - tA;
  });
  
  return docs;
}

// Admin: destek talebine yanıt ver
async function fbReplySupportTicket(ticketId, replyMessage) {
  await fbDb.collection('support').doc(ticketId).update({ 
    status: 'replied',
    reply: replyMessage,
    replyAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Admin: destek talebini kapat
async function fbCloseSupportTicket(ticketId) {
  await fbDb.collection('support').doc(ticketId).update({ status: 'closed' });
}

/* ─────────────────────────────────
   PAROLA SIFIRLAMA
───────────────────────────────── */
async function fbSendPasswordReset(email) {
  await fbAuth.sendPasswordResetEmail(email);
}

/* ─────────────────────────────────
   FIREBASE FUNCTIONS (İYZİCO)
───────────────────────────────── */
let fbFunctions = null;

function getFunctions() {
  if (!fbFunctions) {
    fbFunctions = firebase.functions();
    // Lokal test için emulator kullan (deployment sonrası kaldır)
    // fbFunctions.useEmulator('localhost', 5001);
  }
  return fbFunctions;
}

// Iyzico ödeme formu oluştur
async function fbCreateIyzicoPayment(ip) {
  const createPayment = getFunctions().httpsCallable('createPayment');
  const result = await createPayment({ ip: ip || '85.34.78.112' });
  return result.data; // { checkoutFormContent, token }
}
