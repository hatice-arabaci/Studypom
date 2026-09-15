/* =============================================
   StudyPom – Firebase Cloud Functions
   Iyzico Ödeme Entegrasyonu
   =============================================
   
   KURULUM (deployment öncesi):
   1. firebase functions:config:set iyzico.api_key="SANDBOX_VEYA_LIVE_KEY"
   2. firebase functions:config:set iyzico.secret_key="SANDBOX_VEYA_LIVE_SECRET"
   3. firebase functions:config:set iyzico.base_url="https://sandbox-api.iyzipay.com"
      (Canlı için: "https://api.iyzipay.com")
   4. cd functions && npm install
   5. firebase deploy --only functions
   ============================================= */

'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Iyzipay = require('iyzipay');
const { v4: uuidv4 } = require('uuid');

admin.initializeApp();
const db = admin.firestore();

// ─── Iyzico Config ───
function getIyzipay() {
  const cfg = functions.config().iyzico || {};
  return new Iyzipay({
    apiKey: cfg.api_key || 'sandbox-YOUR_API_KEY',
    secretKey: cfg.secret_key || 'sandbox-YOUR_SECRET_KEY',
    uri: cfg.base_url || 'https://sandbox-api.iyzipay.com',
  });
}

/* ─────────────────────────────────────────────
   createPayment – Iyzico Checkout Form başlatır
   Çağıran: app.js → fbCreateIyzicoPayment()
───────────────────────────────────────────── */
exports.createPayment = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }

    const uid = context.auth.uid;
    const iyzipay = getIyzipay();

    // Kullanıcı bilgilerini Firestore'dan al
    const userDoc = await db.collection('users').doc(uid).get();
    const user = userDoc.data() || {};

    const conversationId = uuidv4();
    const token = uuidv4();

    // Callback URL – deployment sonrası güncelle
    const callbackUrl = `https://studypom.web.app/payment-callback.html?uid=${uid}&token=${encodeURIComponent(token)}`;

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId,
      price: '39',
      paidPrice: '39',
      currency: Iyzipay.CURRENCY.TRY,
      basketId: `sub_${uid}_${Date.now()}`,
      paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
      callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9, 12],
      buyer: {
        id: uid,
        name: (user.name || 'Kullanıcı').split(' ')[0],
        surname: (user.name || 'Kullanıcı').split(' ').slice(1).join(' ') || '-',
        gsmNumber: '+905350000000',
        email: user.email || context.auth.token.email || 'user@studypom.app',
        identityNumber: '11111111111',
        registrationAddress: 'Türkiye',
        ip: data.ip || '85.34.78.112',
        city: 'Istanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: user.name || 'Kullanıcı',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Türkiye',
      },
      billingAddress: {
        contactName: user.name || 'Kullanıcı',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Türkiye',
      },
      basketItems: [
        {
          id: 'studypom_pro_monthly',
          name: 'StudyPom Pro – Aylık',
          category1: 'Dijital Ürün',
          category2: 'SaaS',
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: '39',
        },
      ],
    };

    return new Promise((resolve, reject) => {
      iyzipay.checkoutFormInitialize.create(request, async (err, result) => {
        if (err || result.status !== 'success') {
          console.error('Iyzico Error:', err || result.errorMessage);
          reject(new functions.https.HttpsError('internal', result?.errorMessage || 'Ödeme başlatılamadı.'));
          return;
        }

        // Pending ödeme kaydı oluştur
        await db.collection('pendingPayments').doc(token).set({
          uid,
          conversationId,
          token,
          amount: 39,
          currency: 'TRY',
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        resolve({
          checkoutFormContent: result.checkoutFormContent,
          token,
        });
      });
    });
  });

/* ─────────────────────────────────────────────
   confirmPayment – Iyzico callback sonrası çağrılır
   payment-callback.html sayfasından trigger edilir
───────────────────────────────────────────── */
exports.confirmPayment = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }

    const { token } = data;
    if (!token) throw new functions.https.HttpsError('invalid-argument', 'Token eksik.');

    const iyzipay = getIyzipay();
    const uid = context.auth.uid;

    // Pending kaydını bul
    const pendingDoc = await db.collection('pendingPayments').doc(token).get();
    if (!pendingDoc.exists) throw new functions.https.HttpsError('not-found', 'Ödeme kaydı bulunamadı.');

    const pending = pendingDoc.data();
    if (pending.uid !== uid) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');
    if (pending.status === 'completed') {
      return { success: true, alreadyCompleted: true };
    }

    return new Promise((resolve, reject) => {
      iyzipay.checkoutForm.retrieve({
        locale: Iyzipay.LOCALE.TR,
        conversationId: pending.conversationId,
        token,
      }, async (err, result) => {
        if (err || result.status !== 'success') {
          console.error('Iyzico confirm error:', err || result);
          await db.collection('pendingPayments').doc(token).update({ status: 'failed' });
          reject(new functions.https.HttpsError('internal', 'Ödeme doğrulanamadı.'));
          return;
        }

        if (result.paymentStatus !== 'SUCCESS') {
          await db.collection('pendingPayments').doc(token).update({
            status: 'failed',
            iyzicoStatus: result.paymentStatus,
          });
          reject(new functions.https.HttpsError('cancelled', 'Ödeme tamamlanmadı.'));
          return;
        }

        // Ödeme başarılı – Pro planı aktifleştir
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 1);

        await db.collection('users').doc(uid).set({
          plan: 'pro',
          planExpiry: admin.firestore.Timestamp.fromDate(expiry),
          planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          subscriptionId: result.paymentId,
        }, { merge: true });

        await db.collection('pendingPayments').doc(token).update({
          status: 'completed',
          paymentId: result.paymentId,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Ödeme geçmişi kaydı
        await db.collection('payments').add({
          uid,
          amount: 39,
          currency: 'TRY',
          paymentId: result.paymentId,
          plan: 'pro',
          months: 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        resolve({ success: true });
      });
    });
  });

/* ─────────────────────────────────────────────
   checkExpiredPlans – Günlük cron job (expire checker)
   Firebase Scheduler ile: her gün 00:01'de çalışır
───────────────────────────────────────────── */
exports.checkExpiredPlans = functions
  .region('europe-west1')
  .pubsub.schedule('1 0 * * *')
  .timeZone('Europe/Istanbul')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const expiredSnap = await db.collection('users')
      .where('plan', '==', 'pro')
      .where('planExpiry', '<=', now)
      .get();

    const batch = db.batch();
    expiredSnap.forEach(doc => {
      batch.update(doc.ref, {
        plan: 'free',
        planExpiry: null,
        planDowngradedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`${expiredSnap.size} kullanıcının planı free'e düşürüldü.`);
    return null;
  });
