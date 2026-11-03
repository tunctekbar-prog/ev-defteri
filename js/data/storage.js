// Depolama adaptörleri. Store yalnızca { load(), save(data) } arayüzünü bilir; böylece
// ileride localStorage yerine IndexedDB, mobil uygulamada SQLite veya bir sunucu takılabilir.

export function createLocalStorageAdapter(key = 'evdefteri') {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.error('Veri okunamadı', err);
        return null;
      }
    },
    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (err) {
        console.error('Veri kaydedilemedi', err);
        return false;
      }
    },
  };
}

/** Testler ve önizleme için bellekte tutan adaptör. */
export function createMemoryAdapter(initial = null) {
  let data = initial ? structuredClone(initial) : null;
  return {
    load: () => (data ? structuredClone(data) : null),
    save(next) {
      data = structuredClone(next);
      return true;
    },
  };
}
