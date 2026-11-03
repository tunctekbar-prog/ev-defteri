// Depolama adaptörleri. Store yalnızca { load(), save(data) } arayüzünü bilir; böylece
// ileride localStorage yerine IndexedDB, mobil uygulamada SQLite veya bir sunucu takılabilir.

// Uygulamanın eski adı "Ev Defteri" idi; o anahtarla kaydedilmiş veri ilk açılışta yeni anahtara taşınır.
export function createLocalStorageAdapter(key = 'butcedostum', legacyKeys = ['evdefteri']) {
  let legacy = null; // veri eski anahtardan okunduysa, ilk başarılı kayıttan sonra silinir
  return {
    load() {
      try {
        let raw = localStorage.getItem(key);
        if (raw == null) {
          legacy = legacyKeys.find((k) => localStorage.getItem(k) != null) ?? null;
          if (legacy) raw = localStorage.getItem(legacy);
        }
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.error('Veri okunamadı', err);
        return null;
      }
    },
    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        if (legacy) {
          localStorage.removeItem(legacy);
          legacy = null;
        }
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
