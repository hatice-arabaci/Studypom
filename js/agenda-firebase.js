// =============================================
// STUDYPOM – Ajanda Firebase Fonksiyonları
// Firestore: users/{uid}/agenda/{YYYY-MM-DD}/tasks/{taskId}
// =============================================

/**
 * Belirli bir gün için görevleri getir
 */
async function fbGetAgendaTasks(uid, dateStr) {
  try {
    const snap = await fbDb
      .collection('users').doc(uid)
      .collection('agenda').doc(dateStr)
      .collection('tasks')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('❌ fbGetAgendaTasks HATASI:', err);
    throw err;
  }
}

/**
 * Yeni görev ekle
 * task: { examId, subjectId, subjectName, examName, durationMin, emoji, color }
 */
async function fbAddAgendaTask(uid, dateStr, task) {
  try {
    const ref = await fbDb
      .collection('users').doc(uid)
      .collection('agenda').doc(dateStr)
      .collection('tasks')
      .add({
        ...task,
        done: false,
        carriedFrom: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    return ref.id;
  } catch (err) {
    console.error('❌ fbAddAgendaTask HATASI:', err);
    throw err;
  }
}

/**
 * Görev tamamlandı/tamamlanmadı olarak işaretle
 */
async function fbToggleAgendaTask(uid, dateStr, taskId, done) {
  try {
    await fbDb
      .collection('users').doc(uid)
      .collection('agenda').doc(dateStr)
      .collection('tasks').doc(taskId)
      .update({ done, completedAt: done ? firebase.firestore.FieldValue.serverTimestamp() : null });
  } catch (err) {
    console.error('❌ fbToggleAgendaTask HATASI:', err);
    throw err;
  }
}

/**
 * Görev sil
 */
async function fbDeleteAgendaTask(uid, dateStr, taskId) {
  try {
    await fbDb
      .collection('users').doc(uid)
      .collection('agenda').doc(dateStr)
      .collection('tasks').doc(taskId)
      .delete();
  } catch (err) {
    console.error('❌ fbDeleteAgendaTask HATASI:', err);
    throw err;
  }
}

/**
 * Tamamlanmamış görevleri ertesi güne taşı
 */
async function fbCarryOverTasks(uid, fromDateStr, toDateStr) {
  try {
    const fromSnap = await fbDb
      .collection('users').doc(uid)
      .collection('agenda').doc(fromDateStr)
      .collection('tasks')
      .where('done', '==', false)
      .get();

    if (fromSnap.empty) return 0;

    const toRef = fbDb
      .collection('users').doc(uid)
      .collection('agenda').doc(toDateStr)
      .collection('tasks');

    // Hedef günde zaten taşınmış mı kontrol et
    const existingSnap = await toRef.where('carriedFrom', '==', fromDateStr).get();
    const existingTaskKeys = new Set(
      existingSnap.docs.map(d => `${d.data().subjectId}_${d.data().durationMin}`)
    );

    let carried = 0;
    const batch = fbDb.batch();

    fromSnap.docs.forEach(doc => {
      const task = doc.data();
      const key = `${task.subjectId}_${task.durationMin}`;
      if (!existingTaskKeys.has(key)) {
        const newRef = toRef.doc();
        batch.set(newRef, {
          ...task,
          done: false,
          carriedFrom: fromDateStr,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          completedAt: null,
        });
        carried++;
      }
    });

    await batch.commit();
    return carried;
  } catch (err) {
    console.error('❌ fbCarryOverTasks HATASI:', err);
    throw err;
  }
}


/* ═══════════════════════════════════════════════════════════
   GÜNLÜK NOTLAR  –  users/{uid}/notes/{noteId}
   Notlar tarihe bağlı değil; kullanıcının kalıcı not defteri.
   ═══════════════════════════════════════════════════════════ */

/**
 * Tüm notları getir (oluşturma tarihine göre en yeni önce)
 */
async function fbGetNotes(uid) {
  try {
    const snap = await fbDb
      .collection('users').doc(uid)
      .collection('notes')
      .get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // JS tarafında sırala (index gerektirmez)
    docs.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    return docs;
  } catch (err) {
    console.error('❌ fbGetNotes HATASI:', err);
    throw err;
  }
}

/**
 * Yeni not ekle
 * note: { title, content, color }
 */
async function fbAddNote(uid, note) {
  try {
    const ref = await fbDb
      .collection('users').doc(uid)
      .collection('notes')
      .add({
        ...note,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    return ref.id;
  } catch (err) {
    console.error('❌ fbAddNote HATASI:', err);
    throw err;
  }
}

/**
 * Notu güncelle
 */
async function fbUpdateNote(uid, noteId, updates) {
  try {
    await fbDb
      .collection('users').doc(uid)
      .collection('notes').doc(noteId)
      .update({
        ...updates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.error('❌ fbUpdateNote HATASI:', err);
    throw err;
  }
}

/**
 * Notu sil
 */
async function fbDeleteNote(uid, noteId) {
  try {
    await fbDb
      .collection('users').doc(uid)
      .collection('notes').doc(noteId)
      .delete();
  } catch (err) {
    console.error('❌ fbDeleteNote HATASI:', err);
    throw err;
  }
}
