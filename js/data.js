// =============================================
// STUDYPOM – Static Data
// Sınav türleri ve ders listeleri
// Her sınav türünün dersleri kendine özgü ID'lere sahiptir
// =============================================

const EXAM_TYPES = [
  // ─────────────────────────────────
  // TYT – Temel Yeterlilik Testi
  // 120 soru: Türkçe(40), Sosyal(20), Matematik(40), Fen(20)
  // ─────────────────────────────────
  {
    id: 'tyt',
    name: 'TYT',
    emoji: '📚',
    description: 'Temel Yeterlilik Testi',
    examDate: '2027-06-21',
    subjects: [
      { id: 'tyt-turkce',    name: 'Türkçe',              emoji: '📖', color: '#E53935' },
      { id: 'tyt-matematik', name: 'Temel Matematik',     emoji: '🔢', color: '#1E88E5' },
      { id: 'tyt-geometri',  name: 'Geometri',            emoji: '📐', color: '#1565C0' },
      { id: 'tyt-fizik',     name: 'Fizik',               emoji: '⚡', color: '#8E24AA' },
      { id: 'tyt-kimya',     name: 'Kimya',               emoji: '⚗️', color: '#00897B' },
      { id: 'tyt-biyoloji',  name: 'Biyoloji',            emoji: '🧬', color: '#43A047' },
      { id: 'tyt-tarih',     name: 'Tarih',               emoji: '🏛️', color: '#A1887F' },
      { id: 'tyt-cografya',  name: 'Coğrafya',            emoji: '🗺️', color: '#00695C' },
      { id: 'tyt-felsefe',   name: 'Felsefe',             emoji: '💭', color: '#7B1FA2' },
      { id: 'tyt-din',       name: 'Din Kültürü',         emoji: '☪️', color: '#F57F17' },
    ]
  },

  // ─────────────────────────────────
  // AYT Sayısal
  // Matematik(40) + Fen Bilimleri(40) = 80 soru
  // ─────────────────────────────────
  {
    id: 'ayt-say',
    name: 'AYT Sayısal',
    emoji: '🧮',
    description: 'Alan Yeterlilik - Sayısal',
    examDate: '2027-06-22',
    subjects: [
      { id: 'ayt-say-mat',     name: 'Matematik',      emoji: '🔢', color: '#1E88E5' },
      { id: 'ayt-say-geometri',name: 'Geometri',       emoji: '📐', color: '#1565C0' },
      { id: 'ayt-say-fizik',   name: 'Fizik',          emoji: '⚡', color: '#8E24AA' },
      { id: 'ayt-say-kimya',   name: 'Kimya',          emoji: '⚗️', color: '#00897B' },
      { id: 'ayt-say-bio',     name: 'Biyoloji',       emoji: '🧬', color: '#43A047' },
    ]
  },

  // ─────────────────────────────────
  // AYT Eşit Ağırlık
  // Edebiyat-Sosyal1(40) + Matematik(40) = 80 soru
  // ─────────────────────────────────
  {
    id: 'ayt-ea',
    name: 'AYT Eşit Ağırlık',
    emoji: '⚖️',
    description: 'Alan Yeterlilik - Eşit Ağırlık',
    examDate: '2027-06-22',
    subjects: [
      { id: 'ayt-ea-mat',       name: 'Matematik',              emoji: '🔢', color: '#1E88E5' },
      { id: 'ayt-ea-geometri',  name: 'Geometri',               emoji: '📐', color: '#1565C0' },
      { id: 'ayt-ea-edebiyat',  name: 'Türk Dili ve Edebiyatı', emoji: '✍️', color: '#D81B60' },
      { id: 'ayt-ea-tarih1',    name: 'Tarih-1',                emoji: '🏛️', color: '#A1887F' },
      { id: 'ayt-ea-cografya1', name: 'Coğrafya-1',             emoji: '🗺️', color: '#00897B' },
    ]
  },

  // ─────────────────────────────────
  // AYT Sözel
  // Edebiyat-Sosyal1(40) + Sosyal2(40) = 80 soru
  // ─────────────────────────────────
  {
    id: 'ayt-soz',
    name: 'AYT Sözel',
    emoji: '📝',
    description: 'Alan Yeterlilik - Sözel',
    examDate: '2027-06-22',
    subjects: [
      { id: 'ayt-soz-edebiyat',  name: 'Türk Dili ve Edebiyatı', emoji: '✍️', color: '#D81B60' },
      { id: 'ayt-soz-tarih1',    name: 'Tarih-1',                emoji: '🏛️', color: '#A1887F' },
      { id: 'ayt-soz-cografya1', name: 'Coğrafya-1',             emoji: '🗺️', color: '#00897B' },
      { id: 'ayt-soz-tarih2',    name: 'Tarih-2',                emoji: '🏺', color: '#795548' },
      { id: 'ayt-soz-cografya2', name: 'Coğrafya-2',             emoji: '🌐', color: '#26A69A' },
      { id: 'ayt-soz-felsefe',   name: 'Felsefe Grubu',          emoji: '💭', color: '#7B1FA2' },
      { id: 'ayt-soz-mantik',    name: 'Mantık',                 emoji: '🧠', color: '#5C6BC0' },
      { id: 'ayt-soz-psikoloji', name: 'Psikoloji',              emoji: '🪞', color: '#EC407A' },
      { id: 'ayt-soz-sosyoloji', name: 'Sosyoloji',              emoji: '👥', color: '#AB47BC' },
      { id: 'ayt-soz-din',       name: 'Din Kültürü',            emoji: '☪️', color: '#F57F17' },
    ]
  },

  // ─────────────────────────────────
  // LGS – Liselere Geçiş Sınavı
  // 1. Oturum Sözel(50) + 2. Oturum Sayısal(40) = 90 soru
  // ─────────────────────────────────
  {
    id: 'lgs',
    name: 'LGS',
    emoji: '🎓',
    description: 'Liselere Geçiş Sınavı',
    examDate: '2027-06-15',
    subjects: [
      { id: 'lgs-turkce',   name: 'Türkçe',                            emoji: '📖', color: '#E53935' },
      { id: 'lgs-mat',      name: 'Matematik',                          emoji: '🔢', color: '#1E88E5' },
      { id: 'lgs-fen',      name: 'Fen Bilimleri',                      emoji: '🔬', color: '#43A047' },
      { id: 'lgs-sosyal',   name: 'T.C. İnkılap Tarihi ve Atatürkçülük',emoji: '🌍', color: '#FB8C00' },
      { id: 'lgs-din',      name: 'Din Kültürü',                        emoji: '☪️', color: '#F57F17' },
      { id: 'lgs-ing',      name: 'İngilizce',                          emoji: '🇬🇧', color: '#039BE5' },
    ]
  },

  // ─────────────────────────────────
  // KPSS – Kamu Personeli Seçme Sınavı
  // Genel Yetenek + Genel Kültür
  // ─────────────────────────────────
  {
    id: 'kpss',
    name: 'KPSS',
    emoji: '🏛️',
    description: 'Kamu Personeli Seçme Sınavı',
    examDate: '2027-07-20',
    subjects: [
      { id: 'kpss-turkce',  name: 'Türkçe (GY)',                emoji: '📖', color: '#E53935' },
      { id: 'kpss-mat',     name: 'Matematik (GY)',              emoji: '🔢', color: '#1E88E5' },
      { id: 'kpss-geometri',name: 'Geometri (GY)',              emoji: '📐', color: '#1565C0' },
      { id: 'kpss-tarih',   name: 'Atatürk İlke ve İnk. Tarihi',emoji: '🏛️', color: '#A1887F' },
      { id: 'kpss-cog',     name: 'Coğrafya (GK)',              emoji: '🗺️', color: '#00897B' },
      { id: 'kpss-vattas',  name: 'Vatandaşlık (GK)',           emoji: '⚖️', color: '#7B1FA2' },
      { id: 'kpss-guncel',  name: 'Güncel Bilgiler (GK)',       emoji: '📰', color: '#FF6F00' },
    ]
  },

  // ─────────────────────────────────
  // DGS – Dikey Geçiş Sınavı
  // Sayısal (Matematik) + Sözel (Türkçe) bölüm
  // ─────────────────────────────────
  {
    id: 'dgs',
    name: 'DGS',
    emoji: '🎯',
    description: 'Dikey Geçiş Sınavı',
    examDate: '2027-07-20',
    subjects: [
      { id: 'dgs-turkce',         name: 'Türkçe',           emoji: '📖', color: '#E53935' },
      { id: 'dgs-mat',            name: 'Matematik',         emoji: '🔢', color: '#1E88E5' },
      { id: 'dgs-sozel-mantik',   name: 'Sözel Mantık',     emoji: '🧠', color: '#7B1FA2' },
      { id: 'dgs-sayisal-mantik', name: 'Sayısal Mantık',   emoji: '🔣', color: '#1565C0' },
    ]
  },

  // ─────────────────────────────────
  // ALES – Akademik Personel ve Lisansüstü Eğitim Sınavı
  // ─────────────────────────────────
  {
    id: 'ales',
    name: 'ALES',
    emoji: '🎓',
    description: 'Akademik Personel Sınavı',
    examDate: '2027-04-13',
    subjects: [
      { id: 'ales-turkce',  name: 'Türkçe',          emoji: '📖', color: '#E53935' },
      { id: 'ales-mat',     name: 'Matematik',        emoji: '🔢', color: '#1E88E5' },
      { id: 'ales-geometri',name: 'Geometri',        emoji: '📐', color: '#1565C0' },
      { id: 'ales-mantik',  name: 'Mantık',          emoji: '🧠', color: '#7B1FA2' },
    ]
  },

  // ─────────────────────────────────
  // YDT – Yabancı Dil Testi
  // ─────────────────────────────────
  {
    id: 'ydt',
    name: 'YDT',
    emoji: '🌍',
    description: 'Yabancı Dil Testi',
    examDate: '2027-06-22',
    subjects: [
      { id: 'ydt-ingilizce', name: 'İngilizce',  emoji: '🇬🇧', color: '#039BE5' },
      { id: 'ydt-almanca',   name: 'Almanca',    emoji: '🇩🇪', color: '#FB8C00' },
      { id: 'ydt-fransizca', name: 'Fransızca',  emoji: '🇫🇷', color: '#E53935' },
      { id: 'ydt-arapca',    name: 'Arapça',     emoji: '🇸🇦', color: '#43A047' },
    ]
  },

  // ─────────────────────────────────
  // Özel – Serbest Çalışma
  // ─────────────────────────────────
  {
    id: 'ozel',
    name: 'Özel',
    emoji: '⭐',
    description: 'Serbest çalışma',
    subjects: [
      { id: 'ozel-1', name: 'Ders 1', emoji: '📌', color: '#E53935' },
      { id: 'ozel-2', name: 'Ders 2', emoji: '📌', color: '#1E88E5' },
      { id: 'ozel-3', name: 'Ders 3', emoji: '📌', color: '#43A047' },
      { id: 'ozel-4', name: 'Ders 4', emoji: '📌', color: '#FB8C00' },
    ]
  },
];

// Gün isimleri
const DAY_NAMES = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
const DAY_NAMES_LONG = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

// Çizim renk paleti (donut chart için)
const CHART_COLORS = [
  '#9A7D3A','#E53935','#1E88E5','#43A047','#FB8C00',
  '#8E24AA','#00897B','#D81B60','#795548','#039BE5','#F57F17'
];
