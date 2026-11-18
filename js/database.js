/**
 * Database.js - Local & Cloud Persistence, Customer Directory, Auto Backup/Restore
 * PT. Arba Mitra Usaha Gorontalo (SPBU 74-961-4)
 */

if (typeof SerialCalc === 'undefined' && typeof require !== 'undefined' && typeof window === 'undefined') {
  try {
    global.SerialCalc = require('./serial-calc.js');
  } catch (e) {}
}

const DB = {
  KEYS: {
    TRANSACTIONS: 'amu_voucher_transactions',
    CUSTOMERS: 'amu_voucher_customers',
    OFFICERS: 'amu_voucher_officers',
    LAST_NOTA_NO: 'amu_voucher_last_nota',
    SUPABASE_CONFIG: 'amu_voucher_supabase_cfg',
    GOOGLE_SHEETS_URL: 'amu_voucher_gsheet_url'
  },

  DEFAULT_GOOGLE_SHEETS_URL: '',
  DEFAULT_SUPABASE_CONFIG: {
    url: 'https://aswankejifjsucrmvtxh.supabase.co',
    key: ''
  },

  DEFAULT_CUSTOMERS: [
    "BAPEDA",
    "BAPEDDA",
    "BAPEMDA",
    "BAPENDA",
    "BAWASLU BOALEMO",
    "BAWASLU KOTA",
    "BAWASLU POHUWATO",
    "BAWASLU PROPINSI",
    "BEA CUKAI",
    "BEA CUKAI (WILDAN)",
    "BIRO ORGANISASI",
    "BIRO PEMERINTAHAN",
    "BIRO UMUM",
    "BIRO UMUM LABASIR",
    "BKD",
    "BPBD PROP",
    "BPBD PROPINSI",
    "BPJS KESEHATAN",
    "CAMAT HULONTHALANGI",
    "CAMAT KOTA TENGAH",
    "CAMAT KOTA UTARA",
    "CAMAT SIPATANA",
    "DIKES KOTA",
    "DINAS KESEHATAN",
    "DINAS KESEHATAN KOTA",
    "DINAS PARIWISATA",
    "DINAS PENDIDIKAN",
    "DINAS PERHUBUNGAN",
    "DINAS SOSIAL",
    "DISNAKER",
    "DISPERINDAG",
    "DLH",
    "DLH PROPINSI",
    "GUBERNUR",
    "INSPEKTORAT",
    "ISUZU",
    "JNE",
    "KALLA BETON",
    "KESBANG POL",
    "KESRA PAK MAMAN",
    "KEUANGAN BOALEMO",
    "KEUANGAN BOALEMO GENSET",
    "KEUANGAN POHUWATO",
    "KLOTER 28",
    "KLOTER 30",
    "KOMINFO",
    "KPU POHUWATO",
    "MUDIR RAIS",
    "MUSEUM",
    "PAGUYAMAN PANTAI",
    "PANITIA",
    "PARIWISATA",
    "PERKIM",
    "PUPR",
    "PUPR LAB",
    "PUPR MAIL",
    "PUPR NAWIR",
    "PUPR SDA",
    "PUSKESMAS DUMBO RAYA",
    "PUSKESMAS DUNGGINGI",
    "PUSKESMAS HULONTHALANGI",
    "PUSKESMAS KOTA BARAT",
    "PUSKESMAS KOTA SELATAN",
    "PUSKESMAS KOTA TIMUR",
    "PUSKESMAS PAGUYAMAN PANTAI",
    "PUSKESMAS PILOLODA",
    "RRI",
    "RS OTANAHA",
    "SAMSAT BOALEMO",
    "SEKDA",
    "SETDA",
    "SPPG KOTA TIMUR TAMALATE",
    "STAFF BELI TUNAI",
    "TBBM PERTAMINA",
    "TELKOM",
    "TVRI",
    "TVRI GORONTALO",
    "WAGUB",
    "PERORANGAN",
    "SWASTA"
],

  DEFAULT_OFFICERS: [
    "Saipul Karim Suleman",
    "Ady Praditya",
    "Staf Operator Shift"
  ],

  getStorage() {
    if (typeof localStorage !== 'undefined') return localStorage;
    // Memory fallback for headless Node.js environment
    if (!this._memoryStorage) {
      const store = {};
      this._memoryStorage = {
        getItem: key => store[key] || null,
        setItem: (key, val) => { store[key] = String(val); },
        removeItem: key => { delete store[key]; }
      };
    }
    return this._memoryStorage;
  },

  init() {
    const storage = this.getStorage();
    let existing = [];
    try {
      existing = JSON.parse(storage.getItem(this.KEYS.CUSTOMERS)) || [];
    } catch (e) {
      existing = [];
    }

    // Always merge all 80 default customers into localStorage
    const merged = Array.from(new Set([...this.DEFAULT_CUSTOMERS, ...existing]));
    storage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(merged));

    if (!storage.getItem(this.KEYS.OFFICERS)) {
      storage.setItem(this.KEYS.OFFICERS, JSON.stringify(this.DEFAULT_OFFICERS));
    }
    if (!storage.getItem(this.KEYS.GOOGLE_SHEETS_URL)) {
      storage.setItem(this.KEYS.GOOGLE_SHEETS_URL, this.DEFAULT_GOOGLE_SHEETS_URL);
    }
    if (!storage.getItem(this.KEYS.SUPABASE_CONFIG) && this.DEFAULT_SUPABASE_CONFIG) {
      storage.setItem(this.KEYS.SUPABASE_CONFIG, JSON.stringify(this.DEFAULT_SUPABASE_CONFIG));
    }
    if (!storage.getItem(this.KEYS.LAST_NOTA_NO)) {
      storage.setItem(this.KEYS.LAST_NOTA_NO, '35');
    }
    if (!storage.getItem(this.KEYS.TRANSACTIONS)) {
      storage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify([]));
    }
    
    try {
      let rawTxs = JSON.parse(storage.getItem(this.KEYS.TRANSACTIONS)) || [];
      if (!Array.isArray(rawTxs)) rawTxs = [];

      if (rawTxs.length > 0) {
        const cleaned = rawTxs.filter(tx => {
          if (!tx.items || !Array.isArray(tx.items)) return true;
          return !tx.items.some(i => this.isDummyTestItem(i));
        });
        if (cleaned.length !== rawTxs.length) {
          storage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify(cleaned));
        }
      }
    } catch (e) {}
  },

  getCustomers() {
    this.init();
    try {
      return JSON.parse(this.getStorage().getItem(this.KEYS.CUSTOMERS)) || this.DEFAULT_CUSTOMERS;
    } catch (e) {
      return this.DEFAULT_CUSTOMERS;
    }
  },

  addCustomer(name) {
    if (!name || !name.trim()) return;
    const cleanName = name.trim().toUpperCase();
    const customers = this.getCustomers();
    if (!customers.includes(cleanName)) {
      customers.push(cleanName);
      this.getStorage().setItem(this.KEYS.CUSTOMERS, JSON.stringify(customers));
      this.syncSupabaseCustomer(cleanName);
    }
  },

  getOfficers() {
    this.init();
    try {
      return JSON.parse(this.getStorage().getItem(this.KEYS.OFFICERS)) || this.DEFAULT_OFFICERS;
    } catch (e) {
      return this.DEFAULT_OFFICERS;
    }
  },

  addOfficer(name) {
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const officers = this.getOfficers();
    if (!officers.includes(cleanName)) {
      officers.push(cleanName);
      this.getStorage().setItem(this.KEYS.OFFICERS, JSON.stringify(officers));
    }
  },

  getNextNotaNumber() {
    this.init();
    let maxNota = 35;

    try {
      const transactions = JSON.parse(this.getStorage().getItem(this.KEYS.TRANSACTIONS)) || [];
      for (const tx of transactions) {
        const n = parseInt(tx.notaNumber, 10);
        if (!isNaN(n) && n > maxNota) {
          maxNota = n;
        }
      }
    } catch (e) {}

    const lastInStorage = parseInt(this.getStorage().getItem(this.KEYS.LAST_NOTA_NO) || '35', 10);
    if (!isNaN(lastInStorage) && lastInStorage > maxNota) {
      maxNota = lastInStorage;
    }

    return maxNota + 1;
  },

  incrementNotaNumber() {
    const next = this.getNextNotaNumber();
    this.getStorage().setItem(this.KEYS.LAST_NOTA_NO, String(next));
    return next;
  },

  normalizeTxPaymentMethods(tx) {
    if (!tx) return { paymentVoucher: 'Tunai', paymentAdmin: 'Tunai', payment_voucher: 'Tunai', payment_admin: 'Tunai' };
    const pVoucher = tx.paymentVoucher || tx.payment_voucher || tx.paymentMethodVoucher || tx.metodePayVoucher || tx.paymentMethod || 'Tunai';
    const pAdmin = tx.paymentAdmin || tx.payment_admin || tx.paymentMethodAdmin || tx.metodePayAdmin || tx.paymentMethod || 'Tunai';
    
    tx.paymentVoucher = pVoucher;
    tx.paymentAdmin = pAdmin;
    tx.payment_voucher = pVoucher;
    tx.payment_admin = pAdmin;
    return { paymentVoucher: pVoucher, paymentAdmin: pAdmin, payment_voucher: pVoucher, payment_admin: pAdmin };
  },

  getTransactions() {
    this.init();
    try {
      let transactions = JSON.parse(this.getStorage().getItem(this.KEYS.TRANSACTIONS)) || [];
      transactions.forEach(t => {
        this.normalizeTxPaymentMethods(t);
        if (t.items && Array.isArray(t.items)) {
          const seen = new Set();
          t.items = t.items.filter(item => {
            const key = `${(item.voucherCode || '').toUpperCase()}_${item.startSerial}_${item.endSerial}_${item.quantity}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
      });
      return transactions;
    } catch (e) {
      return [];
    }
  },

  saveTransaction(txData) {
    this.init();
    this.normalizeTxPaymentMethods(txData);
    const transactions = this.getTransactions();
    
    let isEdit = false;
    if (!txData.id) {
      txData.id = 'TX-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      txData.createdAt = txData.createdAt || new Date().toISOString();
      txData.updatedAt = new Date().toISOString();
    } else {
      const existingIdx = transactions.findIndex(t => t.id === txData.id);
      if (existingIdx !== -1) {
        isEdit = true;
        txData.createdAt = txData.createdAt || transactions[existingIdx].createdAt || new Date().toISOString();
        txData.updatedAt = new Date().toISOString();
        transactions[existingIdx] = txData;
        
        // Hapus dari daftar sinkronisasi agar di-sync ulang ke Supabase
        const sbSynced = this.getSyncedSupabaseTxs();
        const newSbSynced = sbSynced.filter(id => id !== txData.id);
        this.getStorage().setItem('amu_supabase_synced', JSON.stringify(newSbSynced));
      }
    }
    
    if (!txData.status) txData.status = 'SUKSES';

    if (txData.customerName) {
      this.addCustomer(txData.customerName);
    }

    if (!isEdit) {
      transactions.unshift(txData);
    }
    this.getStorage().setItem(this.KEYS.TRANSACTIONS, JSON.stringify(transactions));

    const notaNum = parseInt(txData.notaNumber, 10);
    if (!isNaN(notaNum)) {
      const currentLast = parseInt(this.getStorage().getItem(this.KEYS.LAST_NOTA_NO) || '35', 10);
      if (notaNum >= currentLast) {
        this.getStorage().setItem(this.KEYS.LAST_NOTA_NO, String(notaNum));
      }
    }

    this.syncSupabaseTransaction(txData).then(res => {
      if (res && res.success) this.retryUnsyncedTransactions();
    }).catch(err => {
      console.warn("Supabase Sync Background Note:", err);
    });
    this.syncGoogleSheetsTransaction(txData).then(res => {
      if (res) this.retryUnsyncedTransactions();
    }).catch(err => {
      console.warn("Google Sheets Sync Background Note:", err);
    });
    this.notifyDataChanged('save');
    return txData;
  },

  deleteTransaction(txId) {
    let transactions = this.getTransactions();
    const initialLength = transactions.length;
    transactions = transactions.filter(t => t.id !== txId);
    if (transactions.length !== initialLength) {
      this.getStorage().setItem(this.KEYS.TRANSACTIONS, JSON.stringify(transactions));
      this.deleteSupabaseTransaction(txId);
      
      let maxNota = 35;
      for (const tx of transactions) {
        const n = parseInt(tx.notaNumber, 10);
        if (!isNaN(n) && n > maxNota) {
          maxNota = n;
        }
      }
      this.getStorage().setItem(this.KEYS.LAST_NOTA_NO, String(maxNota));
      this.syncGoogleSheetsTransaction({ id: txId }).catch(err => {
        console.warn("Google Sheets Delete Sync Note:", err);
      });
      this.notifyDataChanged('delete');
    }
  },

  voidTransaction(txId, reason) {
    let transactions = this.getTransactions();
    let tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    
    tx.status = 'VOID';
    tx.voidReason = reason || 'Dibatalkan oleh operator';
    tx.updatedAt = new Date().toISOString();
    
    this.getStorage().setItem(this.KEYS.TRANSACTIONS, JSON.stringify(transactions));
    
    // Hapus dari daftar sinkronisasi agar di-sync ulang ke Supabase
    const sbSynced = this.getSyncedSupabaseTxs();
    const newSbSynced = sbSynced.filter(id => id !== txId);
    this.getStorage().setItem('amu_supabase_synced', JSON.stringify(newSbSynced));
    
    // Trigger syncs
    this.syncSupabaseTransaction(tx).then(res => {
      if (res && res.success) this.retryUnsyncedTransactions();
    }).catch(err => {
      console.warn("Supabase Void Sync Note:", err);
    });
    this.syncGoogleSheetsTransaction(tx).then(res => {
      if (res) this.retryUnsyncedTransactions();
    }).catch(err => {
      console.warn("Google Sheets Void Sync Note:", err);
    });
    this.notifyDataChanged('void');
  },

  async deleteSupabaseTransaction(txId) {
    const cfg = this.getSupabaseConfig();
    if (!cfg || !cfg.url || !cfg.key) return;

    try {
      const endpoint = `${cfg.url}/rest/v1/transactions?id=eq.${txId}`;
      await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'apikey': cfg.key,
          'Authorization': `Bearer ${this.getSupabaseSession()?.access_token || cfg.key}`
        }
      });
    } catch (e) {
      console.error('Supabase delete error:', e);
    }
  },

  isDummyTestItem(item) {
    // Disabled to prevent false positives deleting valid transactions
    return false;
  },

  DEFAULT_LAST_SERIALS: {
    'V25': '',
    'V50': '',
    'V100': '',
    'V200': '',
    'V300': '',
    'MANUAL': ''
  },

  getLastSerialByVoucherCode(voucherCode) {
    const transactions = this.getTransactions();
    let maxEnd = null;
    let maxEndStr = '';

    // Filter valid, non-void transactions
    const validTxs = (transactions || []).filter(tx => {
      if (!tx || tx.status === 'VOID') return false;
      if (tx.id === 'TX-SEED-36') return false;
      return true;
    });

    // Urutkan transaksi secara kronologis descending (nota tertinggi dahulu, lalu tanggal transaksi/createdAt)
    // agar selalu mengambil nomor seri operasional aktif terakhir (bukan Math.max naif global)
    validTxs.sort((a, b) => {
      const notaA = parseInt(a.notaNumber, 10) || 0;
      const notaB = parseInt(b.notaNumber, 10) || 0;
      if (notaA !== notaB) return notaB - notaA; // Descending

      const dateA = new Date(a.transactionDate || a.createdAt || 0).getTime() || 0;
      const dateB = new Date(b.transactionDate || b.createdAt || 0).getTime() || 0;
      return dateB - dateA;
    });

    // Cari transaksi aktif terbaru yang memuat pecahan voucher ini
    for (const tx of validTxs) {
      if (tx.items && Array.isArray(tx.items)) {
        const matchingItems = tx.items.filter(item => {
          if (this.isDummyTestItem(item)) return false;
          return !voucherCode || item.voucherCode === voucherCode;
        });

        if (matchingItems.length > 0) {
          // Ambil endSerial tertinggi di dalam transaksi terbaru ini
          for (const item of matchingItems) {
            const eNum = SerialCalc.parseSerial(item.endSerial);
            if (eNum !== null) {
              if (maxEnd === null || eNum > maxEnd) {
                maxEnd = eNum;
                maxEndStr = item.endSerial;
              }
            }
          }
          if (maxEnd !== null) {
            break; // Berhenti karena sudah menemukan transaksi terakhir penerbit pecahan ini
          }
        }
      }
    }

    // Fallback to default baseline if no active transactions found in DB
    if (maxEnd === null && voucherCode && this.DEFAULT_LAST_SERIALS[voucherCode]) {
      const defStr = this.DEFAULT_LAST_SERIALS[voucherCode];
      const defNum = SerialCalc.parseSerial(defStr);
      if (defNum !== null) {
        maxEnd = defNum;
        maxEndStr = defStr;
      }
    }

    return { maxEnd, maxEndStr };
  },

  checkSerialAlreadySold(startSerial, endSerial, voucherCode = null, currentTxId = null) {
    const transactions = this.getTransactions();
    const sNew = SerialCalc.parseSerial(startSerial);
    const eNew = SerialCalc.parseSerial(endSerial);

    if (sNew === null || eNew === null) return null;

    for (const tx of transactions) {
      if (tx.status === 'VOID') continue;
      if (currentTxId && tx.id === currentTxId) continue;

      if (tx.items && Array.isArray(tx.items)) {
        for (const item of tx.items) {
          if (voucherCode && item.voucherCode && item.voucherCode !== voucherCode) continue;

          const sExist = SerialCalc.parseSerial(item.startSerial);
          const eExist = SerialCalc.parseSerial(item.endSerial);

          if (sExist !== null && eExist !== null) {
            if (Math.max(sNew, sExist) <= Math.min(eNew, eExist)) { // Guarded range overlap
              return {
                notaNumber: tx.notaNumber,
                customerName: tx.customerName,
                date: tx.transactionDate,
                voucherCode: item.voucherCode,
                serialStart: item.startSerial,
                serialEnd: item.endSerial
              };
            }
          }
        }
      }
    }
    return null;
  },
  async reindexNotaNumbers(startNumber = 36, options = {}) {
    try {
      this.init();
      let txs = this.getTransactions();
      if (!txs || txs.length === 0) {
        return { success: true, count: 0, maxNota: 0, supabaseResult: { total: 0, success: 0 }, gsheetResult: { total: 0, success: 0 } };
      }

      // Urutkan ascending secara ketat berdasarkan tanggal transaksi, lalu createdAt
      txs.sort((a, b) => {
        let dateA = new Date(a.transactionDate || a.createdAt || 0).getTime();
        let dateB = new Date(b.transactionDate || b.createdAt || 0).getTime();
        if (isNaN(dateA)) dateA = 0;
        if (isNaN(dateB)) dateB = 0;
        
        if (dateA !== dateB) return dateA - dateB;

        let createA = new Date(a.createdAt || 0).getTime();
        let createB = new Date(b.createdAt || 0).getTime();
        if (isNaN(createA)) createA = 0;
        if (isNaN(createB)) createB = 0;
        if (createA !== createB) return createA - createB;

        const nA = parseInt(a.notaNumber, 10) || 0;
        const nB = parseInt(b.notaNumber, 10) || 0;
        return nA - nB;
      });

      const nowISO = new Date().toISOString();
      let maxNota = 0;
      txs.forEach((tx, idx) => {
        tx.notaNumber = startNumber + idx;
        tx.updatedAt = nowISO;
        maxNota = tx.notaNumber;
      });

      // Kembalikan ke urutan descending sebelum disimpan (untuk standar display lokal)
      const reversedTxs = [...txs].reverse();

      this.getStorage().setItem(this.KEYS.TRANSACTIONS, JSON.stringify(reversedTxs));
      this.getStorage().setItem(this.KEYS.LAST_NOTA_NO, String(maxNota));

      // Reset cache sinkronisasi agar seluruh nota terunggah ulang dengan nomor baru
      this.clearSyncedSupabaseCache();
      this.clearSyncedGSheetsCache();

      let sbResult = { total: txs.length, success: 0, skipped: 0 };
      let gsheetResult = { total: txs.length, success: 0 };

      // 1. Sinkronisasi ke Supabase Cloud jika terkonfigurasi
      const cfg = this.getSupabaseConfig();
      if (cfg && cfg.url && cfg.key) {
        try {
          sbResult = await this.syncAllToSupabase(options.onSupabaseProgress, { force: true, resetCache: true });
        } catch (sbErr) {
          console.warn("Supabase reindex sync warning:", sbErr);
        }
      }

      // 2. Sinkronisasi ke Google Sheets jika terkonfigurasi
      const gsheetUrl = this.getGoogleSheetsUrl();
      if (gsheetUrl) {
        try {
          gsheetResult = await this.syncAllToGoogleSheets(options.onGSheetProgress, { force: true, resetCache: true });
        } catch (gsErr) {
          console.warn("Google Sheets reindex sync warning:", gsErr);
        }
      }

      this.notifyDataChanged('reindex');
      return {
        success: true,
        count: txs.length,
        maxNota,
        supabaseResult: sbResult,
        gsheetResult: gsheetResult
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  exportBackupJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      company: 'PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)',
      transactions: this.getTransactions(),
      customers: this.getCustomers(),
      officers: this.getOfficers(),
      lastNotaNo: this.getStorage().getItem(this.KEYS.LAST_NOTA_NO)
    };

    const jsonStr = JSON.stringify(data, null, 2);
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_Voucher_AMU_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    return jsonStr;
  },

  importBackupJSON(jsonContent) {
    try {
      const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      if (!data || (!data.transactions && !data.customers)) {
        throw new Error("Format file backup tidak valid!");
      }

      if (Array.isArray(data.transactions)) {
        this.getStorage().setItem(this.KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
      }
      if (Array.isArray(data.customers)) {
        this.getStorage().setItem(this.KEYS.CUSTOMERS, JSON.stringify(data.customers));
      }
      if (Array.isArray(data.officers)) {
        this.getStorage().setItem(this.KEYS.OFFICERS, JSON.stringify(data.officers));
      }
      if (data.lastNotaNo) {
        this.getStorage().setItem(this.KEYS.LAST_NOTA_NO, String(data.lastNotaNo));
      }
      return true;
    } catch (e) {
      if (typeof alert !== 'undefined') alert("Gagal mengimpor data backup: " + e.message);
      return false;
    }
  },

  cleanSupabaseUrl(url) {
    if (!url) return '';
    let clean = url.trim().replace(/\/+$/, '');
    if (clean.endsWith('/rest/v1')) {
      clean = clean.replace(/\/rest\/v1$/, '');
    }
    return clean;
  },

  saveSupabaseConfig(url, key) {
    const cfg = { url: this.cleanSupabaseUrl(url), key };
    this.getStorage().setItem(this.KEYS.SUPABASE_CONFIG, JSON.stringify(cfg));
  },

  async loginSupabase(email, password) {
    const cfg = this.getSupabaseConfig();
    if (!cfg || !cfg.url || !cfg.key) return { success: false, message: 'URL atau Key Supabase belum dikonfigurasi.' };
    
    try {
      const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.key
        },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) {
        return { success: false, message: 'Email atau password/PIN salah.' };
      }
      
      const data = await res.json();
      this.getStorage().setItem('amu_voucher_sb_session', JSON.stringify(data));
      return { success: true, user: data.user };
    } catch(e) {
      return { success: false, message: e.message };
    }
  },

  getSupabaseSession() {
    try {
      const session = this.getStorage().getItem('amu_voucher_sb_session');
      return session ? JSON.parse(session) : null;
    } catch(e) {
      return null;
    }
  },

  logoutSupabase() {
    this.getStorage().removeItem('amu_voucher_sb_session');
  },

  getSupabaseConfig() {
    try {
      const stored = JSON.parse(this.getStorage().getItem(this.KEYS.SUPABASE_CONFIG));
      if (stored && stored.url && stored.key) return stored;
      if (stored && stored.key) {
        return {
          url: stored.url || (this.DEFAULT_SUPABASE_CONFIG ? this.DEFAULT_SUPABASE_CONFIG.url : ''),
          key: stored.key
        };
      }
      if (stored && stored.url) {
        return {
          url: stored.url,
          key: stored.key || (this.DEFAULT_SUPABASE_CONFIG ? this.DEFAULT_SUPABASE_CONFIG.key : '')
        };
      }
    } catch (e) {}

    if (this.DEFAULT_SUPABASE_CONFIG && this.DEFAULT_SUPABASE_CONFIG.url) {
      return this.DEFAULT_SUPABASE_CONFIG;
    }
    return null;
  },

  async testSupabaseConnection(customUrl = null, customKey = null) {
    const cfg = (customUrl && customKey)
      ? { url: this.cleanSupabaseUrl(customUrl), key: customKey.trim() }
      : this.getSupabaseConfig();

    if (!cfg || !cfg.url || !cfg.key) {
      return { success: false, message: 'URL atau Anon Key Supabase belum terisi.' };
    }

    try {
      const endpoint = `${cfg.url}/rest/v1/customers?select=count&limit=1`;
      if (typeof fetch === 'undefined') {
        return { success: false, message: 'Lingkungan runtime tidak mendukung fetch API.' };
      }
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'apikey': cfg.key,
          'Authorization': `Bearer ${cfg.key}`
        }
      });

      if (res.ok) {
        return { success: true, status: res.status, message: 'Koneksi Database Supabase BERHASIL! (HTTP 200 OK - Database Online)' };
      } else {
        const text = await res.text();
        return { success: false, status: res.status, message: `Gagal terhubung ke Supabase (HTTP ${res.status}): ${text || res.statusText}` };
      }
    } catch (err) {
      return { success: false, message: `Error Koneksi: ${err.message || 'Tidak dapat menjangkau server Supabase'}` };
    }
  },

  clearSyncedSupabaseCache() {
    this.init();
    this.getStorage().removeItem('amu_supabase_synced');
  },

  getSyncedSupabaseTxs() {
    this.init();
    try {
      return JSON.parse(this.getStorage().getItem('amu_supabase_synced')) || [];
    } catch(e) {
      return [];
    }
  },

  markSupabaseTxSynced(sig) {
    const synced = this.getSyncedSupabaseTxs();
    if (!synced.includes(sig)) {
      synced.push(sig);
      this.getStorage().setItem('amu_supabase_synced', JSON.stringify(synced));
    }
  },

  retryUnsyncedTransactions() {
    if (this._isRetrying) return;
    this._isRetrying = true;
    // Jalankan di background setelah 2 detik agar tidak mengganggu UI
    setTimeout(async () => {
      const txs = this.getTransactions();
      const recent = txs.slice(0, 30); // Cek 30 transaksi terakhir yang mungkin gagal
      
      for (const t of recent) {
        await this.syncSupabaseTransaction(t);
        await this.syncGoogleSheetsTransaction(t);
      }
      this._isRetrying = false;
    }, 2000);
  },

  async syncSupabaseTransaction(tx, options = {}) {
    const cfg = this.getSupabaseConfig();
    if (!cfg || !cfg.url || !cfg.key) {
      return { success: false, message: 'URL atau Anon Key Supabase belum terisi.' };
    }

    const force = !!(options && options.force);
    const normalized = this.normalizeTxPaymentMethods(tx);
    const pVoucher = normalized.paymentVoucher;
    const pAdmin = normalized.paymentAdmin;
    const grandTotal = Number(tx.grandTotal) || 0;
    const sig = `${tx.id}_${tx.updatedAt || ''}_${tx.status || 'SUKSES'}_${tx.customerName || ''}_${grandTotal}_${pVoucher}_${pAdmin}`;

    const synced = this.getSyncedSupabaseTxs();
    if (!force && synced.includes(sig)) {
      return { success: true, skipped: true };
    }

    const missingColsTracked = [];

    try {
      const endpoint = `${cfg.url}/rest/v1/transactions`;
      if (typeof fetch !== 'undefined') {
        const headerRow = {
          id: tx.id,
          nota_number: String(tx.notaNumber),
          transaction_date: tx.transactionDate || tx.date,
          customer_name: tx.customerName || '',
          officer_name: tx.officerName || 'Saipul Karim Suleman',
          total_sheets: Number(tx.totalSheets) || (tx.items ? tx.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) : 0),
          voucher_subtotal: Number(tx.voucherSubtotal) || (tx.items ? tx.items.reduce((s, i) => s + (Number(i.itemSubtotal) || 0), 0) : 0),
          admin_fee: Number(tx.adminFee) || (tx.items ? tx.items.reduce((s, i) => s + (Number(i.adminSubtotal) || 0), 0) : 0),
          clearing_fee: Number(tx.clearingFee) || 0,
          grand_total: grandTotal,
          terbilang: tx.terbilang || '',
          payment_voucher: pVoucher,
          payment_admin: pAdmin,
          status: tx.status || 'SUKSES',
          void_reason: tx.voidReason || null,
          updated_at: tx.updatedAt || tx.createdAt || new Date().toISOString()
        };

        let retryCount = 0;
        let resHeader;
        while (retryCount <= 5) {
          resHeader = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': cfg.key,
              'Authorization': `Bearer ${this.getSupabaseSession()?.access_token || cfg.key}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(headerRow)
          });

          if (resHeader.ok) break;

          const errTxt = await resHeader.text();
          const match = errTxt.match(/Could not find the ['"]([^'"]+)['"] column/i);
          if (errTxt.includes('PGRST204') && match && match[1] && (match[1] in headerRow)) {
            const missingCol = match[1];
            delete headerRow[missingCol];
            if (!missingColsTracked.includes(missingCol)) {
              missingColsTracked.push(missingCol);
            }
            retryCount++;
          } else {
            if (errTxt.includes('42501') || errTxt.toLowerCase().includes('row-level security')) {
              return { success: false, message: `Gagal upload header (RLS Policy Database): Kebijakan Row-Level Security Supabase menolak akses. Silakan klik tombol 'Skrip Update Schema SQL', salin skripnya, dan jalankan di Supabase SQL Editor.` };
            }
            return { success: false, message: `Gagal upload header (HTTP ${resHeader.status}): ${errTxt}` };
          }
        }

        if (!resHeader || !resHeader.ok) {
          return { success: false, message: `Gagal upload header setelah penyesuaian skema.` };
        }

        if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
          try {
            await fetch(`${cfg.url}/rest/v1/transaction_items?transaction_id=eq.${tx.id}`, {
              method: 'DELETE',
              headers: {
                'apikey': cfg.key,
                'Authorization': `Bearer ${this.getSupabaseSession()?.access_token || cfg.key}`
              }
            });
          } catch (delErr) {
            console.warn("Clean old items note:", delErr);
          }

          let itemRows = tx.items.map(item => ({
            transaction_id: tx.id,
            voucher_code: (item.voucherCode || '').toUpperCase(),
            serial_start: String(item.startSerial || ''),
            serial_end: String(item.endSerial || ''),
            quantity: Number(item.quantity) || 0,
            item_subtotal: Number(item.itemSubtotal) || 0,
            admin_subtotal: Number(item.adminSubtotal) || 0,
            custom_price: item.customPrice !== undefined ? item.customPrice : null
          }));

          let itemRetryCount = 0;
          let resItems;
          while (itemRetryCount <= 5) {
            resItems = await fetch(`${cfg.url}/rest/v1/transaction_items`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': cfg.key,
                'Authorization': `Bearer ${this.getSupabaseSession()?.access_token || cfg.key}`,
                'Prefer': 'resolution=merge-duplicates'
              },
              body: JSON.stringify(itemRows)
            });

            if (resItems.ok) break;

            const errItems = await resItems.text();
            const matchItem = errItems.match(/Could not find the ['"]([^'"]+)['"] column/i);
            if (errItems.includes('PGRST204') && matchItem && matchItem[1]) {
              const missingCol = matchItem[1];
              let colRemoved = false;
              itemRows.forEach(row => {
                if (missingCol in row) {
                  delete row[missingCol];
                  colRemoved = true;
                }
              });
              if (colRemoved) {
                if (!missingColsTracked.includes(missingCol)) {
                  missingColsTracked.push(missingCol);
                }
                itemRetryCount++;
                continue;
              }
            }
            return { success: false, message: `Gagal upload rincian kupon (HTTP ${resItems.status}): ${errItems}` };
          }
        }

        this.markSupabaseTxSynced(sig);
        return { success: true, missingCols: missingColsTracked };
      }
      return { success: false, message: 'Runtime environment does not support fetch.' };
    } catch (e) {
      console.warn("Supabase Sync Note", e);
      return { success: false, message: e.message };
    }
  },

  async syncAllToSupabase(progressCallback, options = {}) {
    const transactions = this.getTransactions();
    if (!transactions || transactions.length === 0) return { total: 0, success: 0, skipped: 0, missingCols: [] };

    if (options && options.resetCache) {
      this.clearSyncedSupabaseCache();
    }

    let successCount = 0;
    let skippedCount = 0;
    let lastError = null;
    const allMissingCols = new Set();
    const sortedTxs = [...transactions].reverse();

    for (let i = 0; i < sortedTxs.length; i++) {
      const tx = sortedTxs[i];
      const res = await this.syncSupabaseTransaction(tx, { force: options.force !== false });
      if (res && res.success) {
        if (res.skipped) {
          skippedCount++;
        } else {
          successCount++;
        }
        if (res.missingCols && Array.isArray(res.missingCols)) {
          res.missingCols.forEach(c => allMissingCols.add(c));
        }
      } else if (res && res.message) {
        lastError = res.message;
      }
      if (typeof progressCallback === 'function') {
        progressCallback(i + 1, sortedTxs.length);
      }
      await new Promise(r => setTimeout(r, 60));
    }
    return {
      total: sortedTxs.length,
      success: successCount,
      skipped: skippedCount,
      lastError,
      missingCols: Array.from(allMissingCols)
    };
  },

  async uploadAllToSupabase(progressCallback) {
    const transactions = this.getTransactions();
    if (!transactions || transactions.length === 0) {
      return { total: 0, success: 0, message: 'Tidak ada data transaksi lokal untuk diunggah.' };
    }

    const res = await this.syncAllToSupabase(progressCallback, { force: true, resetCache: true });

    if (res.success + res.skipped === res.total || res.success > 0) {
      let msg = `Berhasil mengunggah seluruh ${res.success} dari ${res.total} transaksi ke Supabase Cloud!`;
      if (res.missingCols && res.missingCols.length > 0) {
        if (res.missingCols.includes('payment_voucher') || res.missingCols.includes('payment_admin')) {
          msg += `<br><div style="margin-top:8px; padding:10px 14px; background:#fff7ed; border:1px solid #fdba74; border-radius:6px; color:#c2410c; font-weight:bold; font-size:0.85rem; line-height:1.4;">⚠️ PERHATIAN SANGAT PENTING:<br>Metode Pembayaran (Transfer/Tunai) TIDAK TERKIRIM ke Cloud karena kolom <code>${res.missingCols.join(', ')}</code> belum dibuat di Supabase SQL Editor.<br>👉 Silakan klik tombol <b>📜 Skrip Update Schema SQL</b> di bawah ini, salin skripnya, dan klik 'Run' di Supabase SQL Editor agar metode pembayaran tersimpan di database!</div>`;
        } else {
          msg += `<br><small style="margin-top:6px; display:inline-block; color:#0369a1; line-height:1.4;">💡 Catatan: Kolom <code>${res.missingCols.join(', ')}</code> disesuaikan otomatis karena belum ada di database Supabase Anda. Anda dapat mengeklik tombol <b>📜 Skrip Update Schema SQL</b> untuk memperbarui skema Supabase Anda.</small>`;
        }
      }
      return {
        total: res.total,
        success: res.success,
        skipped: res.skipped,
        message: msg
      };
    } else {
      return {
        total: res.total,
        success: res.success,
        message: `Gagal/Parsial: Terunggah ${res.success} dari ${res.total} transaksi. Error: ${res.lastError || 'HTTP Error'}`
      };
    }
  },


  async fetchSupabaseTransactions() {
    const cfg = this.getSupabaseConfig();
    if (!cfg || !cfg.url || !cfg.key) {
      return { success: false, message: 'URL atau Key Supabase belum dikonfigurasi.' };
    }

    try {
      if (typeof fetch === 'undefined') {
        return { success: false, message: 'Fetch API tidak tersedia.' };
      }

      const resTxs = await fetch(`${cfg.url}/rest/v1/transactions?select=*&order=created_at.desc`, {
        method: 'GET',
        headers: {
          'apikey': cfg.key,
          'Authorization': `Bearer ${this.getSupabaseSession()?.access_token || cfg.key}`
        }
      });

      if (!resTxs.ok) {
        const errTxt = await resTxs.text();
        return { success: false, message: `Gagal mengambil data dari Supabase (HTTP ${resTxs.status}): ${errTxt}` };
      }

      const rawTxs = await resTxs.json();
      if (!Array.isArray(rawTxs)) {
        return { success: true, count: 0, newAdded: 0, message: 'Tidak ada transaksi di Supabase Cloud.' };
      }

      let rawItems = [];
      try {
        const resItems = await fetch(`${cfg.url}/rest/v1/transaction_items?select=*`, {
          method: 'GET',
          headers: {
            'apikey': cfg.key,
            'Authorization': `Bearer ${this.getSupabaseSession()?.access_token || cfg.key}`
          }
        });
        if (resItems.ok) {
          rawItems = await resItems.json();
        }
      } catch (e) {
        console.warn("Fetch items note:", e);
      }

      const localTxs = this.getTransactions();
      let mergedCount = 0;
      let maxNota = 35;

      for (const row of rawTxs) {
        const matchingItems = Array.isArray(rawItems)
          ? rawItems.filter(it => it.transaction_id === row.id)
          : [];

        let rawDateStr = row.transaction_date ? String(row.transaction_date).trim() : '';
        if (rawDateStr.includes('T')) rawDateStr = rawDateStr.split('T')[0];
        else if (rawDateStr.includes(' ')) rawDateStr = rawDateStr.split(' ')[0];

        const rowPV = row.payment_voucher || row.paymentVoucher || row.payment_method_voucher || row.payment_method || row.paymentMethod || 'Tunai';
        const rowPA = row.payment_admin || row.paymentAdmin || row.payment_method_admin || row.payment_method || row.paymentMethod || 'Tunai';

        const txObj = {
          id: row.id,
          notaNumber: isNaN(parseInt(row.nota_number, 10)) ? row.nota_number : parseInt(row.nota_number, 10),
          transactionDate: rawDateStr || row.transaction_date,
          customerName: row.customer_name,
          officerName: row.officer_name || 'Saipul Karim Suleman',
          totalSheets: Number(row.total_sheets) || 0,
          voucherSubtotal: Number(row.voucher_subtotal) || 0,
          adminFee: Number(row.admin_fee) || 0,
          clearingFee: Number(row.clearing_fee) || 0,
          grandTotal: Number(row.grand_total) || 0,
          terbilang: row.terbilang || '',
          paymentVoucher: rowPV,
          paymentAdmin: rowPA,
          payment_voucher: rowPV,
          payment_admin: rowPA,
          status: row.status || 'SUKSES',
          voidReason: row.void_reason || null,
          createdAt: row.created_at,
          updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
          items: (() => {
            const seen = new Set();
            return matchingItems.filter(it => {
              const key = `${(it.voucher_code || '').toUpperCase()}_${it.serial_start}_${it.serial_end}_${it.quantity}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }).map(it => ({
              voucherCode: it.voucher_code,
              startSerial: it.serial_start,
              endSerial: it.serial_end,
              quantity: Number(it.quantity) || 0,
              customPrice: (it.custom_price !== null && it.custom_price !== undefined) ? Number(it.custom_price) : undefined,
              itemSubtotal: Number(it.item_subtotal) || 0,
              adminSubtotal: Number(it.admin_subtotal) || 0
            }));
          })()
        };
        this.normalizeTxPaymentMethods(txObj);

        const cloudTime = row.updated_at ? new Date(row.updated_at).getTime() : (row.created_at ? new Date(row.created_at).getTime() : 0);

        const existingIdx = localTxs.findIndex(t => t.id === txObj.id);
        if (existingIdx !== -1) {
          const localTx = localTxs[existingIdx];
          this.normalizeTxPaymentMethods(localTx);
          const localTime = localTx.updatedAt ? new Date(localTx.updatedAt).getTime() : (localTx.createdAt ? new Date(localTx.createdAt).getTime() : 0);
          
          // Smart Merge Payment Method:
          // Jika transaksi lokal memiliki metode bayar non-Tunai tetapi cloud mengembalikan default 'Tunai'
          // (misal karena push lama tanpa kolom payment_voucher), pertahankan metode bayar lokal & re-sync ke cloud.
          let reSyncNeeded = false;
          if (txObj.paymentVoucher === 'Tunai' && localTx.paymentVoucher && localTx.paymentVoucher !== 'Tunai') {
            txObj.paymentVoucher = localTx.paymentVoucher;
            txObj.payment_voucher = localTx.paymentVoucher;
            reSyncNeeded = true;
          }
          if (txObj.paymentAdmin === 'Tunai' && localTx.paymentAdmin && localTx.paymentAdmin !== 'Tunai') {
            txObj.paymentAdmin = localTx.paymentAdmin;
            txObj.payment_admin = localTx.paymentAdmin;
            reSyncNeeded = true;
          }

          if (localTime > cloudTime) {
            // Local record is newer than cloud record. Preserve local edits & sync back to cloud.
            this.syncSupabaseTransaction(localTx);
          } else {
            localTxs[existingIdx] = txObj;
            if (reSyncNeeded) {
              this.syncSupabaseTransaction(txObj, { force: true });
            }
          }
        } else {
          localTxs.push(txObj);
          mergedCount++;
        }

        const notaNum = parseInt(txObj.notaNumber, 10);
        if (!isNaN(notaNum) && notaNum > maxNota) {
          maxNota = notaNum;
        }
      }

      localTxs.sort((a, b) => {
        const nA = parseInt(a.notaNumber, 10) || 0;
        const nB = parseInt(b.notaNumber, 10) || 0;
        return nB - nA;
      });

      let calculatedMaxNota = 35;
      for (const t of localTxs) {
        if (t.status === 'VOID') continue;
        const n = parseInt(t.notaNumber, 10);
        if (!isNaN(n) && n > calculatedMaxNota) {
          calculatedMaxNota = n;
        }
      }

      const currentStoredLast = parseInt(this.getStorage().getItem(this.KEYS.LAST_NOTA_NO) || '35', 10);
      if (!isNaN(currentStoredLast) && currentStoredLast > calculatedMaxNota) {
        calculatedMaxNota = currentStoredLast;
      }

      this.getStorage().setItem(this.KEYS.TRANSACTIONS, JSON.stringify(localTxs));
      this.getStorage().setItem(this.KEYS.LAST_NOTA_NO, String(calculatedMaxNota));

      this.notifyDataChanged('cloud-fetch');
      const missingPaymentColsInCloud = rawTxs.length > 0 && (rawTxs[0].payment_voucher === undefined && rawTxs[0].payment_admin === undefined);
      let successMsg = `Berhasil sinkronisasi ${rawTxs.length} transaksi dari Supabase!`;
      if (missingPaymentColsInCloud) {
        successMsg += `<br><div style="margin-top:8px; padding:10px 14px; background:#fff7ed; border:1px solid #fdba74; border-radius:6px; color:#c2410c; font-weight:bold; font-size:0.85rem; line-height:1.4;">⚠️ PERHATIAN: Tabel database Supabase Anda belum memiliki kolom <code>payment_voucher</code> & <code>payment_admin</code>.<br>Metode pembayaran ditarik sebagai default "Tunai".<br>👉 Harap jalankan <b>📜 Skrip Update Schema SQL</b> di Supabase SQL Editor, lalu Push dari perangkat utama agar metode pembayaran tersimpan di cloud.</div>`;
      }
      return { success: true, count: rawTxs.length, newAdded: mergedCount, message: successMsg };
    } catch (err) {
      return { success: false, message: `Error Sinkronisasi Cloud: ${err.message}` };
    }
  },


  async syncSupabaseCustomer(customerName) {
    const cfg = this.getSupabaseConfig();
    if (!cfg || !cfg.url || !cfg.key) return;

    try {
      const endpoint = `${cfg.url}/rest/v1/customers`;
      if (typeof fetch !== 'undefined') {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': cfg.key,
            'Authorization': `Bearer ${cfg.key}`,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({ name: customerName })
        });
      }
    } catch (e) {
      console.warn("Supabase Customer Sync Note", e);
    }
  },

  parseDateFields(dateStr) {
    if (!dateStr) return { dateFormatted: '-', monthName: '-', yearStr: '-' };
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const parts = String(dateStr).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const yearStr = parts[0];
      const mIdx = parseInt(parts[1], 10) - 1;
      const dayStr = parts[2].padStart(2, '0');
      const monthName = months[mIdx] || '-';
      const monthNumStr = (mIdx + 1).toString().padStart(2, '0');
      return {
        dateFormatted: `${dayStr}/${monthNumStr}/${yearStr}`,
        monthName: monthName,
        yearStr: yearStr
      };
    }

    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dayStr = String(d.getDate()).padStart(2, '0');
      const mIdx = d.getMonth();
      const monthNumStr = String(mIdx + 1).padStart(2, '0');
      const yearStr = String(d.getFullYear());
      return {
        dateFormatted: `${dayStr}/${monthNumStr}/${yearStr}`,
        monthName: months[mIdx] || '-',
        yearStr: yearStr
      };
    }

    return { dateFormatted: String(dateStr), monthName: '-', yearStr: '-' };
  },

  getVoucherLabel(item) {
    if (!item) return 'Voucher';
    const code = (item.voucherCode || '').toUpperCase();
    const map = {
      'V25': 'Voucher 25k',
      'V50': 'Voucher 50k',
      'V100': 'Voucher 100k',
      'V200': 'Voucher 200k',
      'V300': 'Voucher 300k'
    };
    if (map[code]) return map[code];

    const qty = Number(item.quantity) || 1;
    const sub = Number(item.itemSubtotal) || 0;
    const price = Number(item.customPrice) || (sub > 0 ? Math.round(sub / qty) : 0);
    if (price > 0) {
      return `Voucher Manual (${price >= 1000 ? (price / 1000) + 'k' : 'Rp ' + price})`;
    }
    return 'Voucher Manual';
  },

  calculateExpiryDate(dateStr, voucherCode = 'V50') {
    const months = (voucherCode || '').toUpperCase() === 'MANUAL' ? 1 : 6;
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) {
      return {
        dateFormatted: '-',
        expiryDate: null,
        daysRemaining: 0,
        status: 'AKTIF',
        validityMonths: months
      };
    }

    const expDate = new Date(d);
    const targetMonth = expDate.getMonth() + months;
    expDate.setMonth(targetMonth);

    // Month overflow correction (e.g. Aug 31 + 6 months -> Feb 28)
    if (expDate.getMonth() > (targetMonth % 12)) {
      expDate.setDate(0);
    }

    const day = String(expDate.getDate()).padStart(2, '0');
    const month = String(expDate.getMonth() + 1).padStart(2, '0');
    const year = expDate.getFullYear();
    const dateFormatted = `${day}/${month}/${year}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expCopy = new Date(expDate);
    expCopy.setHours(0, 0, 0, 0);

    const diffTime = expCopy.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status = 'AKTIF';
    if (daysRemaining < 0) {
      status = 'KADALUARSA';
    } else if (daysRemaining <= 15) {
      status = 'SEGERA BERAKHIR';
    }

    return {
      dateFormatted,
      expiryDate: expDate,
      daysRemaining,
      status,
      validityMonths: months
    };
  },

  getGoogleSheetsUrl() {
    this.init();
    const stored = this.getStorage().getItem(this.KEYS.GOOGLE_SHEETS_URL);
    if (stored && stored.includes('AKfycbwhCtBXO9Kw5hkAN6ecLtXGXrtJJRnBtXMqFP4nJQ2VdIRHNMsUJqniRNcsuMqnwT5A')) {
      // URL bawaan lama sudah mati (HTTP 404), bersihkan dari penyimpanan
      return '';
    }
    return (stored || '').trim();
  },

  setGoogleSheetsUrl(url) {
    if (url && url.trim()) {
      this.getStorage().setItem(this.KEYS.GOOGLE_SHEETS_URL, url.trim());
    }
  },

  async testGoogleSheetsConnection(customUrl = null) {
    const url = (customUrl || this.getGoogleSheetsUrl() || '').trim();
    if (!url) {
      return { ok: false, error: 'NO_URL', message: 'URL Web App Google Apps Script belum dimasukkan.' };
    }
    if (!url.startsWith('https://script.google.com/macros/s/')) {
      return { ok: false, error: 'INVALID_FORMAT', message: 'Format URL salah. URL wajib diawali dengan https://script.google.com/macros/s/.../exec' };
    }

    const probeUrl = url + (url.includes('?') ? '&' : '?') + 'action=ping&_=' + Date.now();

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
      
      const res = await fetch(probeUrl, {
        method: 'GET',
        mode: 'cors',
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);

      if (res.status === 404) {
        return { ok: false, status: 404, error: 'NOT_FOUND', message: 'Web App tidak ditemukan (HTTP 404). Pastikan skrip sudah di-deploy sebagai Web App baru di Google Sheet Anda.' };
      }
      if (res.ok) {
        return { ok: true, message: 'Terhubung' };
      }
      return { ok: false, status: res.status, error: 'HTTP_ERROR', message: `Server mengembalikan status HTTP ${res.status}` };
    } catch(fetchErr) {
      console.warn("Probe fetch note:", fetchErr);
      return {
        ok: false,
        error: 'CONNECTION_FAILED',
        message: 'Koneksi ke Web App gagal atau diblokir browser. Pastikan Web App di-deploy dengan hak akses "Siapa saja (Anyone)" dan URL berakhir dengan "/exec".'
      };
    }
  },

  clearSyncedGSheetsCache() {
    this.init();
    this.getStorage().removeItem('amu_gsheets_synced');
  },

  getSyncedGSheetsItems() {
    this.init();
    try {
      return JSON.parse(this.getStorage().getItem('amu_gsheets_synced')) || [];
    } catch(e) {
      return [];
    }
  },

  markGSheetsItemSynced(signatures) {
    const synced = this.getSyncedGSheetsItems();
    let updated = false;
    signatures.forEach(sig => {
      if (!synced.includes(sig)) {
        synced.push(sig);
        updated = true;
      }
    });
    if (updated) {
      this.getStorage().setItem('amu_gsheets_synced', JSON.stringify(synced));
    }
  },

  async syncGoogleSheetsTransaction(tx, options = {}) {
    try {
      const res = await this.syncAllToGoogleSheets(null, { force: true, resetCache: true, ...options });
      return !!(res && res.success > 0);
    } catch (e) {
      console.warn("Google Sheets Sync Note:", e);
      return false;
    }
  },

  async syncAllToGoogleSheets(progressCallback, options = {}) {
    const webhookUrl = this.getGoogleSheetsUrl();
    if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com/macros/s/')) {
      return { total: 0, success: 0, error: 'NO_URL' };
    }

    const transactions = this.getTransactions();
    if (!transactions || transactions.length === 0) return { total: 0, success: 0 };

    if (options && (options.resetCache || options.force)) {
      this.clearSyncedGSheetsCache();
    }

    const sortedTxs = [...transactions]
      .filter(t => t.status !== 'VOID' && t.status !== 'DIBATALKAN')
      .sort((a, b) => {
        const numA = parseInt(a.notaNumber, 10) || 0;
        const numB = parseInt(b.notaNumber, 10) || 0;
        if (numA !== numB) return numA - numB;
        return String(a.notaNumber || '').localeCompare(String(b.notaNumber || ''));
      });
    const allPayloadRows = [];
    const allSignatures = [];

    sortedTxs.forEach((tx) => {
      const pVoucher = tx.paymentMethodVoucher || tx.paymentMethod || tx.paymentVoucher || tx.payment_voucher || 'Tunai';
      const pAdmin = tx.paymentMethodAdmin || tx.paymentMethod || tx.paymentAdmin || tx.payment_admin || 'Tunai';
      const dateInfo = this.parseDateFields(tx.transactionDate || tx.date || tx.createdAt);
      const officer = tx.officerName || 'Saipul Karim Suleman';

      if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
        tx.items.forEach((item, idx) => {
          const sig = `${tx.id}_item${idx}_${item.voucherCode || ''}_${item.startSerial || ''}_${item.endSerial || ''}_${pVoucher}_${pAdmin}_${tx.customerName || ''}_${tx.updatedAt || ''}_${tx.status || ''}`;
          const itemAdmin = Number(item.adminSubtotal) || (Number(item.quantity) * 500);
          const itemClearing = (idx === 0) ? (Number(tx.clearingFee) || 0) : 0;
          const itemSubtotal = Number(item.itemSubtotal) || 0;
          const itemTotal = itemSubtotal + itemAdmin + itemClearing; // Full balanced row amount for spreadsheet reconciliation
          const expInfo = this.calculateExpiryDate(tx.transactionDate || tx.date || tx.createdAt, item.voucherCode);

          allPayloadRows.push({
            id: tx.id || '',
            item_no: idx + 1,
            nota_number: tx.notaNumber || '',
            transaction_date: tx.transactionDate || tx.date || '',
            date_formatted: dateInfo.dateFormatted,
            month_name: dateInfo.monthName,
            year_str: dateInfo.yearStr,
            customer_name: tx.customerName || '',
            voucher_code: (item.voucherCode || '').toUpperCase(),
            voucher_label: this.getVoucherLabel(item),
            start_serial: item.startSerial || '',
            end_serial: item.endSerial || '',
            sheets: Number(item.quantity) || 0,
            subtotal_nominal: itemSubtotal,
            payment_voucher: pVoucher,
            admin_fee: itemAdmin,
            payment_admin: pAdmin,
            clearing_fee: itemClearing,
            total_amount: itemTotal,
            officer_name: officer,
            status: tx.status || 'SUKSES',
            expiry_date_formatted: expInfo.dateFormatted,
            expiry_status: expInfo.status,
            validity_months: expInfo.validityMonths
          });
          allSignatures.push(sig);
        });
      } else {
        const sig = `${tx.id}_MANUAL_-_-_${pVoucher}_${pAdmin}_${tx.customerName || ''}_${tx.updatedAt || ''}_${tx.status || ''}`;
        const expInfo = this.calculateExpiryDate(tx.transactionDate || tx.date || tx.createdAt, 'MANUAL');
        allPayloadRows.push({
          id: tx.id || '',
          item_no: 1,
          nota_number: tx.notaNumber || '',
          transaction_date: tx.transactionDate || tx.date || '',
          date_formatted: dateInfo.dateFormatted,
          month_name: dateInfo.monthName,
          year_str: dateInfo.yearStr,
          customer_name: tx.customerName || '',
          voucher_code: 'MANUAL',
          voucher_label: 'Voucher',
          start_serial: '-',
          end_serial: '-',
          sheets: Number(tx.totalSheets) || 0,
          subtotal_nominal: Number(tx.voucherSubtotal) || 0,
          payment_voucher: pVoucher,
          admin_fee: Number(tx.adminFee) || 0,
          payment_admin: pAdmin,
          clearing_fee: Number(tx.clearingFee) || 0,
          total_amount: Number(tx.grandTotal) || 0,
          officer_name: officer,
          status: tx.status || 'SUKSES',
          expiry_date_formatted: expInfo.dateFormatted,
          expiry_status: expInfo.status,
          validity_months: expInfo.validityMonths
        });
        allSignatures.push(sig);
      }
    });

    if (allPayloadRows.length === 0) return { total: sortedTxs.length, success: sortedTxs.length };

    const payloadObj = {
      action: 'upsert_batch',
      rows: allPayloadRows
    };
    const jsonStr = JSON.stringify(payloadObj);

    let syncSuccess = false;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: jsonStr
      });
      syncSuccess = true;
    } catch (err) {
      console.warn('Batch fetch sync note:', err);
    }

    // Only fallback to iframe form submission if fetch failed, preventing duplicate concurrent write contention on Apps Script lock
    if (!syncSuccess && typeof document !== 'undefined') {
      try {
        const iframeName = 'gsheet_batch_' + Date.now();
        const iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = webhookUrl;
        form.target = iframeName;
        form.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'payload';
        input.value = jsonStr;
        form.appendChild(input);
        document.body.appendChild(form);

        form.submit();
        syncSuccess = true;
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch(e) {}
          try { document.body.removeChild(form); } catch(e) {}
        }, 3500);
      } catch(formErr) {
        console.warn('Batch form submit fallback error:', formErr);
      }
    }

    if (syncSuccess) {
      this.markGSheetsItemSynced(allSignatures);
      if (typeof progressCallback === 'function') {
        progressCallback(sortedTxs.length, sortedTxs.length);
      }
      return { total: sortedTxs.length, success: sortedTxs.length };
    }

    return { total: sortedTxs.length, success: 0, error: 'SEND_FAILED' };
  },

  notifyDataChanged(source = 'local') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amu-transactions-changed', { detail: { source } }));
    }
  },

  _realtimeChannel: null,
  _pollingTimer: null,
  _supabaseClient: null,

  initRealtimeSubscription() {
    const cfg = this.getSupabaseConfig();
    if (!cfg || !cfg.url || !cfg.key) return;

    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
      try {
        if (!this._supabaseClient) {
          this._supabaseClient = window.supabase.createClient(cfg.url, cfg.key);
        }
        if (this._realtimeChannel) {
          this._supabaseClient.removeChannel(this._realtimeChannel);
        }
        this._realtimeChannel = this._supabaseClient
          .channel('public:transactions')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'transactions' },
            async (payload) => {
              console.log('⚡ Realtime Supabase Change Detected:', payload.eventType);
              await this.fetchSupabaseTransactions();
              this.notifyDataChanged('supabase-realtime');
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription fallback to polling:', err);
      }
    }

    if (typeof window !== 'undefined' && !this._pollingTimer) {
      this._pollingTimer = setInterval(async () => {
        if (document.visibilityState === 'visible') {
          const res = await this.fetchSupabaseTransactions();
          if (res && res.success && res.newAdded > 0) {
            this.notifyDataChanged('polling-new-data');
          }
        }
      }, 10000);

      window.addEventListener('focus', async () => {
        const res = await this.fetchSupabaseTransactions();
        if (res && res.success) {
          this.notifyDataChanged('window-focus');
        }
      });
    }
  }
};

DB.init();

if (typeof window !== 'undefined') {
  window.DB = DB;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DB;
}
