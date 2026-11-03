// Yedek dosyası: tüm veri tek bir JSON dosyasında. Tarayıcı, DOM bilmez; Node'da test edilir.
//
// Dosya şekli: { app: 'butcedostum', backupVersion: 1, exportedAt: 'YYYY-MM-DD', data: { ...store verisi } }
// Yüklerken veri store.importData() içinde migrate()'ten geçer; burada yalnızca bozuk/yabancı
// dosyalar ayıklanır.

export const BACKUP_APP = 'butcedostum';
const LEGACY_APPS = ['evdefteri']; // uygulamanın eski adı (Ev Defteri) ile alınmış yedekler de yüklenir
export const BACKUP_VERSION = 1;

export function backupFileName(today) {
  return `butce-dostum-yedek-${today}.json`;
}

export function createBackup(state, today) {
  return JSON.stringify({ app: BACKUP_APP, backupVersion: BACKUP_VERSION, exportedAt: today, data: state }, null, 2);
}

/** Kullanıcıya gösterilecek, yargılamayan hata. */
export class BackupError extends Error {}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validTransaction(t) {
  return (
    t && typeof t === 'object' && typeof t.id === 'string' &&
    (t.type === 'expense' || t.type === 'income') &&
    Number.isInteger(t.amount) && t.amount > 0 &&
    typeof t.categoryId === 'string' && typeof t.date === 'string' && DATE.test(t.date)
  );
}

function validPayment(p) {
  return (
    p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string' &&
    Number.isInteger(p.amount ?? 0) && Number.isInteger(p.dayOfMonth) && p.dayOfMonth >= 1 && p.dayOfMonth <= 31 &&
    (p.paidMonths == null || typeof p.paidMonths === 'object')
  );
}

/**
 * Yedek dosyasının metnini okur, store verisini döndürür. Sorun varsa BackupError fırlatır.
 * Özet bilgi de döner: { data, exportedAt, counts: { transactions, payments } }
 */
export function parseBackup(text) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new BackupError('Bu dosya okunamadı. Bütçe Dostum\'dan indirilen yedek dosyasını seçtiğinden emin olur musun?');
  }
  if (!file || ![BACKUP_APP, ...LEGACY_APPS].includes(file.app) || !file.data || typeof file.data !== 'object') {
    throw new BackupError('Bu dosya bir Bütçe Dostum yedeğine benzemiyor.');
  }
  if (file.backupVersion > BACKUP_VERSION) {
    throw new BackupError('Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Önce uygulamayı güncellemek gerekiyor.');
  }
  const { transactions = [], payments = [] } = file.data;
  if (!Array.isArray(transactions) || !Array.isArray(payments) ||
      !transactions.every(validTransaction) || !payments.every(validPayment)) {
    throw new BackupError('Yedek dosyası bozulmuş görünüyor; içindeki kayıtlar okunamadı. Mevcut verilerine dokunulmadı.');
  }
  return {
    data: file.data,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : null,
    counts: { transactions: transactions.length, payments: payments.length },
  };
}
