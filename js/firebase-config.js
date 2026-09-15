// =============================================
// STUDYPOM – Firebase Configuration
// =============================================
// ⚠️  ADIM 1: Firebase Console'dan bu bilgileri al:
//    https://console.firebase.google.com
//    → studypom-262fb projesi
//    → Project Settings (sol alttaki dişli ⚙️)
//    → "Your apps" bölümü → </> (Web) ikonuna tıkla
//    → "Add app" → isim ver → "Register app"
//    → Aşağıdaki değerleri kopyala ve yapıştır
// =============================================

const firebaseConfig = {
  // apiKey:            "AIzaSyAymzF471V1VHEITcU8dFPcvvWpxNrMW6k",
  //authDomain:        "studypom-262fb.firebaseapp.com",
  //projectId:         "studypom-262fb",
  //storageBucket:     "studypom-262fb.appspot.com",
  // messagingSenderId: "BURAYA_MESSAGING_SENDER_ID",
  //appId:             "1:906991260035:web:145b142a716c96947866b6"

  apiKey: "AIzaSyAymzF471V1VHEITcU8dFPcvvWpxNrMW6k",
  authDomain: "studypom-262fb.firebaseapp.com",
  databaseURL: "https://studypom-262fb-default-rtdb.firebaseio.com",
  projectId: "studypom-262fb",
  storageBucket: "studypom-262fb.firebasestorage.app",
  messagingSenderId: "906991260035",
  appId: "1:906991260035:web:145b142a716c96947866b6",
  measurementId: "G-6464TVFEV7"
};

// Bu dosyayı kaydettin mi? → js/app.js otomatik Firebase'i kullanmaya başlar.
