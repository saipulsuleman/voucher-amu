/**
 * Database.js - Local & Cloud Persistence, Customer Directory, Auto Backup/Restore
 * PT. Arba Mitra Usaha Gorontalo (SPBU 74-961-4)
 */

const DB = {
  KEYS: {
    TRANSACTIONS: 'amu_voucher_transactions',
    CUSTOMERS: 'amu_voucher_customers',
    OFFICERS: 'amu_voucher_officers',
    LAST_NOTA_NO: 'amu_voucher_last_nota',
    SUPABASE_CONFIG: 'amu_voucher_supabase_cfg',
    GOOGLE_SHEETS_URL: 'amu_voucher_gsheet_url'
  },

  DEFAULT_GOOGLE_SHEETS_URL: 'https://script.google.com/macros/s/AKfycbwhCtBXO9Kw5hkAN6ecLtXGXrtJJRnBtXMqFP4nJQ2VdIRHNMsUJqniRNcsuMqnwT5A/exec',

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

  getTransactions() {
    this.init();
    try {
      let transactions = JSON.parse(this.getStorage().getItem(this.KEYS.TRANSACTIONS)) || [];
      return transactions;
    } catch (e) {
      return [];
    }
  },

  saveTransaction(txData) {
    this.init();
    const transactions = this.getTransactions();
    
    let isEdit = false;
    if (!txData.id) {
      txData.id = 'TX-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      txData.createdAt = new Date().toISOString();
    } else {
      const existingIdx = transactions.findIndex(t => t.id === txData.id);
      if (existingIdx !== -1) {
        isEdit = true;
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

    // Check ALL transactions to find the absolute highest serial number.
    // This is mathematically robust against out-of-order receipt entry.
    for (const tx of transactions) {
      if (tx.status === 'VOID') continue;
      
      // EXPLICITLY ignore the dummy seed data so it doesn't artificially inflate the max
      if (tx.id === 'TX-SEED-36') continue;
      
      if (tx.items && Array.isArray(tx.items)) {
        for (const item of tx.items) {
          if (this.isDummyTestItem(item)) continue;
          if (!voucherCode || item.voucherCode === voucherCode) {
            const eNum = SerialCalc.parseSerial(item.endSerial);
            if (eNum !== null) {
              if (maxEnd === null || eNum > maxEnd) {
                maxEnd = eNum;
                maxEndStr = item.endSerial;
              }
            }
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
  reindexNotaNumbers(startNumber = 36) {
    try {
      let txs = this.getTransactions();
      if (!txs || txs.length === 0) return { success: true, count: 0 };

      // Urutkan ascending berdasarkan tanggal transaksi
      txs.sort((a, b) => {
        let dateA = new Date(a.transactionDate || a.createdAt || 0).getTime();
        let dateB = new Date(b.transactionDate || b.createdAt || 0).getTime();
        if (isNaN(dateA)) dateA = 0;
        if (isNaN(dateB)) dateB = 0;
        
        if (dateA !== dateB) return dateA - dateB;
        const nA = parseInt(a.notaNumber, 10) || 0;
        const nB = parseInt(b.notaNumber, 10) || 0;
        return nA - nB;
      });

      let maxNota = 0;
      txs.forEach((tx, idx) => {
        tx.notaNumber = startNumber + idx;
        maxNota = tx.notaNumber;
      });

      // Kembalikan ke urutan descending sebelum disimpan (untuk standar lokal)
      txs.reverse();

      this.getStorage().setItem(this.KEYS.TRANSACTIONS, JSON.stringify(txs));
      this.getStorage().setItem(this.KEYS.LAST_NOTA_NO, String(maxNota));
      return { success: true, count: txs.length };
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
      return JSON.parse(this.getStorage().getItem(this.KEYS.SUPABASE_CONFIG));
    } catch (e) {
      return null;
    }
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

  getSyncedSupabaseTxs() {
    this.init();
    try {
      return JSON.parse(this.getStorage().getItem('amu_supabase_synced')) || [];
    } catch(e) {
      return [];
    }
  },

  markSupabaseTxSynced(txId) {
    const synced = this.getSyncedSupabaseTxs();
    if (!synced.includes(txId)) {
      synced.push(txId);
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

  async syncSupabaseTransaction(tx) {
    const cfg = this.getSupabaseConfig();
    if (!cfg || !cfg.url || !cfg.key) {
      return { success: false, message: 'URL atau Anon Key Supabase belum terisi.' };
    }

    const synced = this.getSyncedSupabaseTxs();
    if (synced.includes(tx.id)) return { success: true, skipped: true };

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
          grand_total: Number(tx.grandTotal) || 0,
          terbilang: tx.terbilang || '',
          payment_voucher: tx.paymentVoucher || 'Tunai',
          payment_admin: tx.paymentAdmin || 'Tunai',
          status: tx.status || 'SUKSES',
          void_reason: tx.voidReason || null
        };

        let resHeader = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': cfg.key,
            'Authorization': `Bearer ${this.getSupabaseSession()?.access_token || cfg.key}`,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(headerRow)
        });

        if (!resHeader.ok) {
          const errTxt = await resHeader.text();
          if (resHeader.status === 400 && (errTxt.includes('payment_admin') || errTxt.includes('PGRST204'))) {
            delete headerRow.payment_admin;
            delete headerRow.payment_voucher;
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
          }

          if (!resHeader.ok) {
            const errTxt2 = await resHeader.text();
            return { success: false, message: `Gagal upload header (HTTP ${resHeader.status}): ${errTxt2}` };
          }
        }

        if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
          const itemRows = tx.items.map(item => ({
            transaction_id: tx.id,
            voucher_code: (item.voucherCode || '').toUpperCase(),
            serial_start: String(item.startSerial || ''),
            serial_end: String(item.endSerial || ''),
            quantity: Number(item.quantity) || 0,
            item_subtotal: Number(item.itemSubtotal) || 0,
            admin_subtotal: Number(item.adminSubtotal) || 0
          }));

          const resItems = await fetch(`${cfg.url}/rest/v1/transaction_items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': cfg.key,
              'Authorization': `Bearer ${this.getSupabaseSession()?.access_token || cfg.key}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(itemRows)
          });

          if (!resItems.ok) {
            const errItems = await resItems.text();
            return { success: false, message: `Gagal upload rincian kupon (HTTP ${resItems.status}): ${errItems}` };
          }
        }
        this.markSupabaseTxSynced(tx.id);
        return { success: true };
      }
      return { success: false, message: 'Runtime environment does not support fetch.' };
    } catch (e) {
      console.warn("Supabase Sync Note", e);
      return { success: false, message: e.message };
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
      let maxNota = 43;

      for (const row of rawTxs) {
        const matchingItems = Array.isArray(rawItems)
          ? rawItems.filter(it => it.transaction_id === row.id)
          : [];

        let rawDateStr = row.transaction_date ? String(row.transaction_date).trim() : '';
        if (rawDateStr.includes('T')) rawDateStr = rawDateStr.split('T')[0];
        else if (rawDateStr.includes(' ')) rawDateStr = rawDateStr.split(' ')[0];

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
          paymentVoucher: row.payment_voucher || 'Tunai',
          paymentAdmin: row.payment_admin || 'Tunai',
          status: row.status || 'SUKSES',
          voidReason: row.void_reason || null,
          createdAt: row.created_at,
          items: matchingItems.map(it => ({
            voucherCode: it.voucher_code,
            startSerial: it.serial_start,
            endSerial: it.serial_end,
            quantity: Number(it.quantity) || 0,
            itemSubtotal: Number(it.item_subtotal) || 0,
            adminSubtotal: Number(it.admin_subtotal) || 0
          }))
        };

        const existingIdx = localTxs.findIndex(t => t.id === txObj.id);
        if (existingIdx !== -1) {
          localTxs[existingIdx] = txObj;
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

      this.getStorage().setItem(this.KEYS.TRANSACTIONS, JSON.stringify(localTxs));
      if (maxNota > 43) {
        this.getStorage().setItem(this.KEYS.LAST_NOTA_NO, String(maxNota));
      }

      return { success: true, count: rawTxs.length, newAdded: mergedCount, message: `Berhasil sinkronisasi ${rawTxs.length} transaksi dari Supabase!` };
    } catch (err) {
      return { success: false, message: `Error Sinkronisasi Cloud: ${err.message}` };
    }
  },

  async uploadAllToSupabase(progressCallback) {
    const transactions = this.getTransactions();
    if (!transactions || transactions.length === 0) {
      return { total: 0, success: 0, message: 'Tidak ada data transaksi lokal untuk diunggah.' };
    }

    let successCount = 0;
    let lastError = null;

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const res = await this.syncSupabaseTransaction(tx);
      if (res && res.success) {
        successCount++;
      } else if (res && res.message) {
        lastError = res.message;
      }
      if (typeof progressCallback === 'function') {
        progressCallback(i + 1, transactions.length);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (successCount === transactions.length) {
      return { total: transactions.length, success: successCount, message: `Berhasil mengunggah seluruh ${successCount} dari ${transactions.length} transaksi ke Supabase Cloud!` };
    } else {
      return { total: transactions.length, success: successCount, message: `Gagal/Parsial: Terunggah ${successCount} dari ${transactions.length} transaksi. Error: ${lastError || 'HTTP Error'}` };
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

  getGoogleSheetsUrl() {
    this.init();
    return this.getStorage().getItem(this.KEYS.GOOGLE_SHEETS_URL) || this.DEFAULT_GOOGLE_SHEETS_URL;
  },

  setGoogleSheetsUrl(url) {
    if (url && url.trim()) {
      this.getStorage().setItem(this.KEYS.GOOGLE_SHEETS_URL, url.trim());
    }
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

  async syncGoogleSheetsTransaction(tx) {
    const webhookUrl = this.getGoogleSheetsUrl();
    if (!webhookUrl || typeof fetch === 'undefined') return false;

    try {
      const dateInfo = this.parseDateFields(tx.transactionDate || tx.date || tx.createdAt);
      const pVoucher = tx.paymentVoucher || tx.payment_voucher || 'Tunai';
      const pAdmin = tx.paymentAdmin || tx.payment_admin || 'Tunai';
      const officer = tx.officerName || 'Saipul Karim Suleman';

      const payloadRows = [];
      const signaturesToMark = [];
      const syncedItems = this.getSyncedGSheetsItems();

      if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
        tx.items.forEach((item, idx) => {
          // Buat signature unik untuk mencegah double entry
          const sig = `${tx.id}_${item.voucherCode || ''}_${item.startSerial || ''}_${item.endSerial || ''}`;
          if (syncedItems.includes(sig)) return; // Lewati jika sudah pernah disinkron

          const itemAdmin = Number(item.adminSubtotal) || (Number(item.quantity) * 500);
          const itemClearing = (idx === 0) ? (Number(tx.clearingFee) || 0) : 0;
          const itemSubtotal = Number(item.itemSubtotal) || 0;
          const itemTotal = itemSubtotal + itemAdmin + itemClearing;

          payloadRows.push({
            id: tx.id || '',
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
            status: tx.status || 'SUKSES'
          });
          signaturesToMark.push(sig);
        });
      } else {
        const sig = `${tx.id}_MANUAL_-_-`;
        if (!syncedItems.includes(sig)) {
          payloadRows.push({
            id: tx.id || '',
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
            status: tx.status || 'SUKSES'
          });
          signaturesToMark.push(sig);
        }
      }

      if (payloadRows.length === 0) return true;

      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payloadRows)
      });
      
      this.markGSheetsItemSynced(signaturesToMark);
      return true;
    } catch (e) {
      console.warn("Google Sheets Sync Note:", e);
      return false;
    }
  },

  async syncAllToGoogleSheets(progressCallback) {
    const transactions = this.getTransactions();
    if (!transactions || transactions.length === 0) return { total: 0, success: 0 };

    let successCount = 0;
    const sortedTxs = [...transactions].reverse();

    for (let i = 0; i < sortedTxs.length; i++) {
      const tx = sortedTxs[i];
      const ok = await this.syncGoogleSheetsTransaction(tx);
      if (ok) successCount++;
      if (typeof progressCallback === 'function') {
        progressCallback(i + 1, sortedTxs.length);
      }
      await new Promise(r => setTimeout(r, 150));
    }
    return { total: sortedTxs.length, success: successCount };
  }
};

DB.init();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DB;
}
