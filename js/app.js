/**
 * App.js - Main Application Controller & UI Renderer
 * PT. Arba Mitra Usaha Gorontalo (SPBU 74-961-4)
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// --- GLOBAL ERROR BOUNDARY ---
(function initErrorBoundary() {
  function showErrorModal(message, source, lineno, colno, error) {
    // Hindari multiple modals
    if (document.getElementById('global-error-boundary')) return;

    const errorDetails = `Pesan: ${message}\nSumber: ${source || 'N/A'}\nBaris: ${lineno || 'N/A'}:${colno || 'N/A'}\nStack: ${error?.stack || 'N/A'}`;
    
    const overlay = document.createElement('div');
    overlay.id = 'global-error-boundary';
    
    overlay.innerHTML = `
      <div class="error-boundary-card">
        <h2>⚠️ Terjadi Kesalahan Aplikasi</h2>
        <p style="margin: 0; color: #475569; font-size: 0.9rem;">
          Aplikasi mengalami masalah teknis. Anda dapat memuat ulang aplikasi atau menyalin pesan error ini untuk dilaporkan.
        </p>
        <div class="error-boundary-msg" id="error-boundary-text"></div>
        <div class="error-boundary-actions">
          <button class="btn btn-secondary" onclick="navigator.clipboard.writeText(document.getElementById('error-boundary-text').innerText).then(()=>alert('Tersalin!'))">📋 Salin Error</button>
          <button class="btn btn-primary" onclick="window.location.reload()">🔄 Muat Ulang</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    document.getElementById('error-boundary-text').innerText = errorDetails;
  }

  window.onerror = function (msg, url, lineNo, columnNo, error) {
    showErrorModal(msg, url, lineNo, columnNo, error);
    return false;
  };

  window.addEventListener('unhandledrejection', function (event) {
    showErrorModal(event.reason?.message || 'Promise Rejection', 'Promise', null, null, event.reason);
  });
})();

window.escapeHTML = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const App = {
  activeTab: 'new-transaction',
  activeDocType: 'nota', // 'nota' or 'kwitansi'
  rows: [],
  editingTxId: null,
  historyState: {
    currentPage: 1,
    rowsPerPage: '20',
    searchQuery: '',
    startDate: '',
    endDate: '',
    paymentMethod: 'ALL',
    status: 'ALL',
    expandedTxIds: new Set()
  },

  async init() {
    this.bindEvents();
    this.bindHistoryEvents();
    if (typeof Dashboard !== 'undefined') Dashboard.init();
    this.loadCustomerOptions();
    this.loadOfficerOptions();
    this.loadSupabaseConfigUI();
    this.resetForm();
    this.renderHistoryTable();

    this.checkSessionStatus();

    const cfg = DB.getSupabaseConfig();
    if (cfg && cfg.url && cfg.key) {
      await this.autoSyncFromSupabase();
      DB.initRealtimeSubscription();
    }
  },

  checkSessionStatus() {
    const session = DB.getSupabaseSession();
    const btnLogin = document.getElementById('btn-login-officer');
    const btnLogout = document.getElementById('btn-logout-officer');
    const nameSpan = document.getElementById('logged-in-officer-name');
    const syncBadgeText = document.getElementById('sync-status-text');
    const syncBadgeDot = document.querySelector('#sync-status-badge .status-dot');
    const syncBadge = document.getElementById('sync-status-badge');

    if (session && session.user) {
      if (btnLogin) btnLogin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = 'inline-block';
      if (nameSpan) {
        nameSpan.style.display = 'inline-block';
        nameSpan.innerText = session.user.email.split('@')[0].toUpperCase();
      }
      if (syncBadge) {
        syncBadge.style.background = '#dcfce7';
        syncBadge.style.borderColor = '#86efac';
        syncBadge.style.color = '#166534';
      }
      if (syncBadgeDot) syncBadgeDot.style.background = '#22c55e';
      if (syncBadgeText) syncBadgeText.innerText = 'Online / Terautentikasi';
    } else {
      if (btnLogin) btnLogin.style.display = 'inline-block';
      if (btnLogout) btnLogout.style.display = 'none';
      if (nameSpan) {
        nameSpan.style.display = 'none';
        nameSpan.innerText = '';
      }
      if (syncBadge) {
        syncBadge.style.background = '#fee2e2';
        syncBadge.style.borderColor = '#f87171';
        syncBadge.style.color = '#b91c1c';
      }
      if (syncBadgeDot) syncBadgeDot.style.background = '#ef4444';
      if (syncBadgeText) syncBadgeText.innerText = 'Offline / Publik';
    }
  },

  async autoSyncFromSupabase() {
    try {
      const res = await DB.fetchSupabaseTransactions();
      if (res && res.success) {
        this.renderHistoryTable();
        if (typeof Dashboard !== 'undefined') Dashboard.renderDashboard();
      }
    } catch (e) {
      console.warn("Auto sync Supabase note:", e);
    }
  },

  loadSupabaseConfigUI() {
    const cfg = DB.getSupabaseConfig();
    const sbUrl = document.getElementById('sb-url');
    const sbKey = document.getElementById('sb-key');
    if (cfg && sbUrl && sbKey) {
      if (cfg.url && !sbUrl.value) sbUrl.value = cfg.url;
      if (cfg.key && !sbKey.value) sbKey.value = cfg.key;
    }
  },

  bindEvents() {
    // Login Modal Events
    document.getElementById('btn-login-officer')?.addEventListener('click', () => {
      const modal = document.getElementById('login-modal');
      if (modal) modal.style.display = 'flex';
      const errMsg = document.getElementById('login-error-msg');
      if (errMsg) errMsg.style.display = 'none';
    });

    document.getElementById('login-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'login-modal') {
        e.target.style.display = 'none';
      }
    });

    document.getElementById('btn-login-submit')?.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      const pass = document.getElementById('login-password').value.trim();
      const errMsg = document.getElementById('login-error-msg');
      const btn = document.getElementById('btn-login-submit');
      
      if (!email || !pass) {
        if (errMsg) {
          errMsg.style.display = 'block';
          errMsg.innerText = 'Email dan Password harus diisi.';
        }
        return;
      }
      
      if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳ Memeriksa...';
      }
      
      const res = await DB.loginSupabase(email, pass);
      
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Masuk Aplikasi ➔';
      }
      
      if (res.success) {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        this.checkSessionStatus();
      } else {
        if (errMsg) {
          errMsg.style.display = 'block';
          errMsg.innerText = res.message;
        }
      }
    });

    document.getElementById('btn-logout-officer')?.addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin keluar?')) {
        DB.logoutSupabase();
        this.checkSessionStatus();
      }
    });

    // Cancel Edit Button
    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
      this.cancelEdit();
    });

    // btn-next-nota is now handled by event delegation

    // Navigation Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Add Voucher Row Button
    document.getElementById('btn-add-row')?.addEventListener('click', () => {
      this.addRow();
    });

    // Clearing Fee Checkbox & Input
    const chkClearing = document.getElementById('chk-clearing');
    const inputClearing = document.getElementById('input-clearing');
    chkClearing?.addEventListener('change', (e) => {
      inputClearing.disabled = !e.target.checked;
      if (!e.target.checked) inputClearing.value = '0';
      else if (inputClearing.value === '0') inputClearing.value = '6500';
      this.recalculateTotal();
    });

    inputClearing?.addEventListener('input', () => {
      this.recalculateTotal();
    });

    // Payment Method Listeners (Voucher & Admin Dual-Channel)
    const selectPayVoucher = document.getElementById('select-payment-voucher');
    const selectPayAdmin = document.getElementById('select-payment-admin');
    const chkSyncPay = document.getElementById('chk-sync-payment');

    selectPayVoucher?.addEventListener('change', (e) => {
      if (chkSyncPay && chkSyncPay.checked && selectPayAdmin) {
        selectPayAdmin.value = e.target.value;
      }
      this.updateLivePreview();
    });

    selectPayAdmin?.addEventListener('change', (e) => {
      if (chkSyncPay && selectPayVoucher && e.target.value !== selectPayVoucher.value) {
        chkSyncPay.checked = false;
      }
      this.updateLivePreview();
    });

    chkSyncPay?.addEventListener('change', (e) => {
      if (e.target.checked && selectPayVoucher && selectPayAdmin) {
        selectPayAdmin.value = selectPayVoucher.value;
        this.updateLivePreview();
      }
    });

    // Officer Switcher
    document.getElementById('select-officer')?.addEventListener('change', (e) => {
      if (e.target.value === '__NEW__') {
        const name = prompt("Masukkan nama petugas / penanggung jawab baru:");
        if (name && name.trim()) {
          DB.addOfficer(name.trim());
          this.loadOfficerOptions();
          document.getElementById('select-officer').value = name.trim();
        } else {
          document.getElementById('select-officer').value = "Saipul Karim Suleman";
        }
      }
      this.updateLivePreview();
    });

    // Customer Datalist / Select
    document.getElementById('select-customer-dropdown')?.addEventListener('change', (e) => {
      if (e.target.value) {
        document.getElementById('input-customer').value = e.target.value;
        this.updateCustomerHistoryHint();
        this.updateLivePreview();
      }
    });

    document.getElementById('input-customer')?.addEventListener('input', () => {
      this.updateCustomerHistoryHint();
      this.updateLivePreview();
    });

    // Date Picker Change
    document.getElementById('input-date')?.addEventListener('change', () => {
      this.updateLivePreview();
    });

    // Save Only Button
    document.getElementById('btn-save-only')?.addEventListener('click', () => {
      this.saveOnly();
    });

    // Print Nota Button
    document.getElementById('btn-print-nota')?.addEventListener('click', () => {
      this.printDoc('nota');
    });

    // Print Kwitansi Button
    document.getElementById('btn-print-kwitansi')?.addEventListener('click', () => {
      this.printDoc('kwitansi');
    });

    // Print Voucher Button
    document.getElementById('btn-print-voucher')?.addEventListener('click', () => {
      this.printDoc('voucher');
    });

    // Toggle Preview Document Type
    document.getElementById('btn-preview-nota')?.addEventListener('click', () => {
      this.setPreviewDocType('nota');
    });

    document.getElementById('btn-preview-kwitansi')?.addEventListener('click', () => {
      this.setPreviewDocType('kwitansi');
    });

    document.getElementById('btn-preview-voucher')?.addEventListener('click', () => {
      this.setPreviewDocType('voucher');
    });

    // WhatsApp Share Button
    document.getElementById('btn-wa-share')?.addEventListener('click', () => {
      this.shareToWhatsApp();
    });

    // Duplicate export listeners removed to avoid conflict with bindHistoryEvents()

    // Backup & Restore Buttons
    document.getElementById('btn-backup-json')?.addEventListener('click', () => {
      DB.exportBackupJSON();
    });

    document.getElementById('btn-restore-json')?.addEventListener('click', () => {
      document.getElementById('file-restore-input')?.click();
    });

    document.getElementById('file-restore-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (DB.importBackupJSON(event.target.result)) {
            alert("Data berhasil dipulihkan 100%!");
            location.reload();
          }
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('btn-reindex-nota')?.addEventListener('click', () => {
      const confirmReindex = confirm("PERINGATAN: Aksi ini akan menulis ulang seluruh nomor nota Anda secara permanen berdasarkan tanggal transaksi (dari yang terlama).\n\nApakah Anda yakin ingin melanjutkan?");
      if (confirmReindex) {
        const startNo = prompt("Masukkan nomor awal untuk nota pertama (terlama):", "36");
        if (startNo !== null) {
          const parsedStartNo = parseInt(startNo, 10);
          if (isNaN(parsedStartNo) || parsedStartNo < 1) {
            alert("Nomor awal tidak valid. Harus berupa angka lebih besar dari 0.");
            return;
          }
          const result = DB.reindexNotaNumbers(parsedStartNo);
          if (result.success) {
            alert(`Berhasil! Nomor nota pada ${result.count} transaksi telah diurutkan ulang berdasarkan tanggal dimulai dari No ${parsedStartNo}.`);
            location.reload(); // Muat ulang aplikasi untuk memperbarui tampilan
          } else {
            alert(`Gagal: ${result.message}`);
          }
        }
      }
    });


    // Supabase Settings Save & Test Connection
    document.getElementById('btn-save-supabase')?.addEventListener('click', () => {
      const url = document.getElementById('sb-url').value.trim();
      const key = document.getElementById('sb-key').value.trim();
      DB.saveSupabaseConfig(url, key);
      alert("Pengaturan Supabase Cloud tersimpan!");
    });

    document.getElementById('btn-test-supabase')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-test-supabase');
      const msgDiv = document.getElementById('sb-status-msg');
      const url = document.getElementById('sb-url')?.value.trim();
      const key = document.getElementById('sb-key')?.value.trim();

      if (btn) btn.disabled = true;
      if (msgDiv) {
        msgDiv.style.display = 'block';
        msgDiv.style.background = '#e2e8f0';
        msgDiv.style.color = '#334155';
        msgDiv.innerHTML = '⏳ Menghubungi Server Supabase Cloud...';
      }

      const res = await DB.testSupabaseConnection(url, key);

      if (btn) btn.disabled = false;
      if (msgDiv) {
        if (res.success) {
          msgDiv.style.background = '#dcfce7';
          msgDiv.style.color = '#15803d';
          msgDiv.innerHTML = `✅ ${res.message}`;
        } else {
          msgDiv.style.background = '#fee2e2';
          msgDiv.style.color = '#b91c1c';
          msgDiv.innerHTML = `❌ ${res.message}`;
        }
      }
    });

    document.getElementById('btn-upload-all-supabase')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-upload-all-supabase');
      const msgDiv = document.getElementById('sb-status-msg');
      const cfg = DB.getSupabaseConfig();

      if (!cfg || !cfg.url || !cfg.key) {
        alert("Silakan isi URL dan Anon Key Supabase lalu klik 'Simpan Konfigurasi Cloud' terlebih dahulu.");
        return;
      }

      if (!confirm("Apakah Anda yakin ingin mengunggah seluruh data transaksi lokal ke Supabase Cloud?")) {
        return;
      }

      if (btn) btn.disabled = true;
      if (msgDiv) {
        msgDiv.style.display = 'block';
        msgDiv.style.background = '#e2e8f0';
        msgDiv.style.color = '#334155';
        msgDiv.innerHTML = '⏳ Mengunggah data transaksi ke Supabase Cloud...';
      }

      const res = await DB.uploadAllToSupabase((done, total) => {
        if (msgDiv) msgDiv.innerHTML = `⏳ Mengunggah... (${done}/${total})`;
      });

      if (btn) btn.disabled = false;
      if (msgDiv) {
        if (res.success > 0) {
          msgDiv.style.background = '#dcfce7';
          msgDiv.style.color = '#15803d';
          msgDiv.innerHTML = `✅ ${res.message}`;
        } else {
          msgDiv.style.background = '#fee2e2';
          msgDiv.style.color = '#b91c1c';
          msgDiv.innerHTML = `❌ ${res.message}`;
        }
      }
      this.renderHistoryTable();
    });

    document.getElementById('btn-pull-all-supabase')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-pull-all-supabase');
      const msgDiv = document.getElementById('sb-status-msg');
      const cfg = DB.getSupabaseConfig();

      if (!cfg || !cfg.url || !cfg.key) {
        alert("Silakan isi URL dan Anon Key Supabase lalu klik 'Simpan Konfigurasi Cloud' terlebih dahulu.");
        return;
      }

      if (btn) btn.disabled = true;
      if (msgDiv) {
        msgDiv.style.display = 'block';
        msgDiv.style.background = '#e2e8f0';
        msgDiv.style.color = '#334155';
        msgDiv.innerHTML = '⏳ Menarik data transaksi dari Supabase Cloud...';
      }

      const res = await DB.fetchSupabaseTransactions();

      if (btn) btn.disabled = false;
      if (msgDiv) {
        if (res.success) {
          msgDiv.style.background = '#dcfce7';
          msgDiv.style.color = '#15803d';
          msgDiv.innerHTML = `✅ ${res.message}`;
        } else {
          msgDiv.style.background = '#fee2e2';
          msgDiv.style.color = '#b91c1c';
          msgDiv.innerHTML = `❌ ${res.message}`;
        }
      }
      this.renderHistoryTable();
    });

    // Google Sheets Sync Listeners
    document.getElementById('btn-sync-gsheet')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-sync-gsheet');
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '⏳ Menyingkronkan...';
      const res = await DB.syncAllToGoogleSheets((curr, total) => {
        btn.innerHTML = `⏳ Sync (${curr}/${total})...`;
      }, { force: true, resetCache: true });
      btn.disabled = false;
      btn.innerHTML = origText;
      if (res.total === 0) {
        alert("⚠️ Tidak ada data transaksi di penyimpanan aplikasi ini (0 transaksi).\n\nJika data transaksi Anda tersimpan di Supabase Cloud, silakan klik 'Pull Data dari Supabase' terlebih dahulu, atau pastikan Anda membuka tab/domain yang menyimpan data transaksi.");
      } else if (res.success === res.total) {
        alert(`✅ Sinkronisasi Google Sheets Selesai!\n${res.success} dari ${res.total} transaksi berhasil disinkronkan.`);
      } else if (res.success > 0) {
        alert(`⚠️ Sync Sebagian Berhasil!\n${res.success} dari ${res.total} transaksi berhasil.\n${res.total - res.success} transaksi gagal. Silakan coba lagi.`);
      } else {
        alert(`❌ Sync Gagal!\nTidak ada transaksi yang berhasil (0 dari ${res.total}).\n\nPastikan Code.gs di Apps Script benar dan Web App di-deploy ulang.`);
      }
    });

    document.getElementById('btn-save-gsheet-url')?.addEventListener('click', () => {
      const url = document.getElementById('input-gsheet-url')?.value.trim();
      if (!url) {
        alert("⚠️ Mohon masukkan URL Web App Google Apps Script dari Google Sheet Baru Anda!");
        return;
      }
      DB.setGoogleSheetsUrl(url);
      DB.clearSyncedGSheetsCache();
      alert("✅ URL Web App Google Sheet Baru berhasil disimpan! Anda dapat menekan tombol 'Sync Semua Data' untuk menyalurkan seluruh data ke Google Sheet Baru.");
    });

    document.getElementById('btn-test-gsheet-url')?.addEventListener('click', async () => {
      const url = document.getElementById('input-gsheet-url')?.value.trim() || DB.getGoogleSheetsUrl();
      if (!url) {
        alert("⚠️ Mohon masukkan URL Web App Google Apps Script terlebih dahulu!");
        return;
      }
      const btn = document.getElementById('btn-test-gsheet-url');
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '⏳ Mengetes Koneksi...';
      try {
        // Use iframe form POST (same as sync) to test the connection
        await new Promise((resolve, reject) => {
          const iframeName = 'gsheet_test_' + Date.now();
          const iframe = document.createElement('iframe');
          iframe.name = iframeName;
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
          
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = url;
          form.target = iframeName;
          form.style.display = 'none';
          
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'payload';
          input.value = JSON.stringify({ action: 'ping' });
          form.appendChild(input);
          document.body.appendChild(form);
          
          let done = false;
          const finish = (success) => {
            if (!done) {
              done = true;
              try { document.body.removeChild(iframe); } catch(e) {}
              try { document.body.removeChild(form); } catch(e) {}
              success ? resolve() : reject(new Error('Timeout'));
            }
          };
          iframe.onload = () => finish(true);
          setTimeout(() => finish(true), 6000); // Apps Script may take a few seconds
          form.submit();
        });
        btn.disabled = false;
        btn.innerHTML = origText;
        alert("✅ Tes Koneksi Terhubung!\n\nURL Web App terhubung dan siap menerima data. Silakan klik '🚀 Sync Semua Data ke Google Sheet Baru'!");
      } catch(e) {
        btn.disabled = false;
        btn.innerHTML = origText;
        alert("❌ Tes Koneksi Gagal!\n\nMohon pastikan URL diawali dengan https://script.google.com/macros/s/.../exec dan akses diset ke 'Siapa saja (Anyone)'.\n\nDetail: " + e.message);
      }
    });

    document.getElementById('btn-sync-all-gsheet')?.addEventListener('click', async () => {
      const inputUrl = document.getElementById('input-gsheet-url')?.value.trim();
      if (inputUrl) {
        DB.setGoogleSheetsUrl(inputUrl);
      }
      const btn = document.getElementById('btn-sync-all-gsheet');
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '⏳ Mengirim data ke Google Sheet Baru...';
      const res = await DB.syncAllToGoogleSheets((curr, total) => {
        btn.innerHTML = `⏳ Sync (${curr}/${total})...`;
      }, { force: true, resetCache: true });
      btn.disabled = false;
      btn.innerHTML = origText;
      if (res.total === 0) {
        alert("⚠️ Tidak ada data transaksi di penyimpanan aplikasi ini (0 transaksi).\n\nJika data transaksi Anda tersimpan di Supabase Cloud, silakan klik 'Pull Data dari Supabase' terlebih dahulu, atau pastikan Anda membuka tab/domain yang menyimpan data transaksi.");
      } else if (res.success === res.total) {
        alert(`✅ Sync ke Google Sheet Baru Selesai!\n${res.success} dari ${res.total} transaksi berhasil terkirim ke Google Sheets.`);
      } else if (res.success > 0) {
        alert(`⚠️ Sync Sebagian Berhasil!\n${res.success} dari ${res.total} transaksi berhasil terkirim.\n${res.total - res.success} transaksi gagal. Silakan coba lagi.`);
      } else {
        alert(`❌ Sync Gagal!\nTidak ada transaksi yang berhasil terkirim (0 dari ${res.total}).\n\nPastikan:\n1. Code.gs sudah di-paste dengan benar di Apps Script\n2. Web App di-deploy ulang sebagai 'Anyone'\n3. URL yang dimasukkan adalah URL deployment terbaru`);
      }
    });

    // Modal Guide Listeners
    const modalGuide = document.getElementById('gsheet-guide-modal');
    document.getElementById('btn-show-gsheet-guide')?.addEventListener('click', () => {
      if (modalGuide) modalGuide.style.display = 'flex';
    });
    const closeModal = () => {
      if (modalGuide) modalGuide.style.display = 'none';
    };
    document.getElementById('btn-close-gsheet-guide')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-gsheet-guide-2')?.addEventListener('click', closeModal);

    document.getElementById('btn-copy-codegs')?.addEventListener('click', () => {
      const txt = document.getElementById('codegs-textarea');
      if (txt) {
        txt.select();
        navigator.clipboard.writeText(txt.value).then(() => {
          alert("📋 Skrip Code.gs berhasil disalin ke clipboard! Silakan tempelkan ke Apps Script di Google Sheet Baru.");
        }).catch(() => {
          document.execCommand('copy');
          alert("📋 Skrip Code.gs berhasil disalin!");
        });
      }
    });
  },

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });

    if (tabId === 'history') {
      this.renderHistoryTable();
    } else if (tabId === 'dashboard') {
      if (typeof Dashboard !== 'undefined') Dashboard.renderDashboard();
    } else if (tabId === 'cloud') {
      const inputUrl = document.getElementById('input-gsheet-url');
      if (inputUrl) inputUrl.value = DB.getGoogleSheetsUrl();
      const sbConfig = DB.getSupabaseConfig();
      if (sbConfig) {
        const sbUrlEl = document.getElementById('sb-url');
        const sbKeyEl = document.getElementById('sb-key');
        if (sbUrlEl) sbUrlEl.value = sbConfig.url || '';
        if (sbKeyEl) sbKeyEl.value = sbConfig.key || '';
      }
    }
  },

  loadCustomerOptions() {
    const customers = DB.getCustomers();
    const datalist = document.getElementById('customer-list');
    if (datalist) {
      datalist.innerHTML = customers.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    const select = document.getElementById('select-customer-dropdown');
    if (select) {
      select.innerHTML = `<option value="">▼ Pilih dari Dropdown (${customers.length} Instansi)</option>` +
        customers.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  },

  loadOfficerOptions() {
    const officers = DB.getOfficers();
    const select = document.getElementById('select-officer');
    if (select) {
      select.innerHTML = officers.map(o => `<option value="${o}">${o}</option>`).join('') +
        `<option value="__NEW__">+ Tambah Nama Petugas Baru...</option>`;
      select.value = "Saipul Karim Suleman";
    }
  },

  resetForm() {
    this.editingTxId = null;

    const alertBox = document.getElementById('editing-mode-alert');
    if (alertBox) alertBox.style.display = 'none';

    const btnSave = document.getElementById('btn-save-only');
    if (btnSave) btnSave.innerHTML = '💾 Simpan Transaksi';

    // Set Next Nota Number
    const nextNota = DB.getNextNotaNumber();
    document.getElementById('input-nota-no').value = String(nextNota);

    // Set Default Date to Today (Gorontalo format)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const dateInput = document.getElementById('input-date');
    if (dateInput) {
      dateInput.value = todayStr;
      dateInput.setAttribute('max', todayStr);
    }

    document.getElementById('input-customer').value = 'BEA CUKAI';
    document.getElementById('select-officer').value = 'Saipul Karim Suleman';

    const selectPayV = document.getElementById('select-payment-voucher');
    const selectPayA = document.getElementById('select-payment-admin');
    const chkSync = document.getElementById('chk-sync-payment');
    if (selectPayV) selectPayV.value = 'Tunai';
    if (selectPayA) selectPayA.value = 'Tunai';
    if (chkSync) chkSync.checked = true;

    document.getElementById('chk-clearing').checked = false;
    const inputClearing = document.getElementById('input-clearing');
    if (inputClearing) {
      inputClearing.disabled = true;
      inputClearing.value = '0';
    }

    // Reset Voucher Rows to 1 default row
    this.rows = [];
    document.getElementById('voucher-rows-body').innerHTML = '';
    this.addRow('V50', '', '', 40);
    this.updateDenomLastSerialsBar();
    this.updateCustomerHistoryHint();
  },

  updateDenomLastSerialsBar() {
    const el = document.getElementById('denom-serials-content');
    if (!el) return;
    const codes = ['V25', 'V50', 'V100', 'V200', 'V300'];
    const parts = codes.map(code => {
      const res = DB.getLastSerialByVoucherCode(code);
      const valStr = res && res.maxEndStr ? res.maxEndStr : '-';
      return `<strong>${code}:</strong> ${valStr}`;
    });
    el.innerHTML = parts.join(' &nbsp;|&nbsp; ');
  },

  updateCustomerHistoryHint() {
    const hintEl = document.getElementById('customer-history-hint');
    if (!hintEl) return;
    const customer = (document.getElementById('input-customer')?.value || '').trim();
    if (!customer) {
      hintEl.style.display = 'none';
      return;
    }
    const transactions = DB.getTransactions();
    const tx = transactions.find(t => t.status !== 'VOID' && t.customerName && t.customerName.toUpperCase() === customer.toUpperCase());
    if (tx) {
      const dateStr = tx.transactionDate || '-';
      const itemsSummary = tx.items ? tx.items.map(i => `${i.voucherCode} (${i.startSerial}-${i.endSerial})`).join(', ') : '-';
      hintEl.style.display = 'block';
      hintEl.innerHTML = `💡 <strong>Transaksi Terakhir ${window.escapeHTML(tx.customerName)}:</strong> Nota #${tx.notaNumber} tanggal ${dateStr} [${itemsSummary}]`;
    } else {
      hintEl.style.display = 'none';
    }
  },

  loadTransactionToEdit(txId) {
    const transactions = DB.getTransactions();
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    this.editingTxId = tx.id;

    // Show Edit mode banner
    const alertBox = document.getElementById('editing-mode-alert');
    const alertText = document.getElementById('editing-mode-text');
    if (alertBox && alertText) {
      alertText.innerText = `✏️ Mode Edit: Mengubah Nota #${tx.notaNumber}`;
      alertBox.style.display = 'flex';
    }

    // Update Save button label
    const btnSave = document.getElementById('btn-save-only');
    if (btnSave) {
      btnSave.innerHTML = `✏️ Update Transaksi (#${tx.notaNumber})`;
    }

    // Switch tab to input
    this.switchTab('new-transaction');

    // Populate Form Inputs
    document.getElementById('input-nota-no').value = String(tx.notaNumber);
    document.getElementById('input-date').value = tx.transactionDate || '';
    document.getElementById('input-customer').value = tx.customerName || '';
    if (document.getElementById('select-customer-dropdown')) {
      document.getElementById('select-customer-dropdown').value = tx.customerName || '';
    }

    const selectOfficer = document.getElementById('select-officer');
    if (selectOfficer && tx.officerName) {
      selectOfficer.value = tx.officerName;
    }

    // Payment Methods
    const payVoucher = tx.paymentVoucher || tx.payment_voucher || 'Tunai';
    const payAdmin = tx.paymentAdmin || tx.payment_admin || 'Tunai';
    const selectPayV = document.getElementById('select-payment-voucher');
    const selectPayA = document.getElementById('select-payment-admin');
    const chkSync = document.getElementById('chk-sync-payment');
    if (selectPayV) selectPayV.value = payVoucher;
    if (selectPayA) selectPayA.value = payAdmin;
    if (chkSync) chkSync.checked = (payVoucher === payAdmin);

    // Clearing fee
    const chkClearing = document.getElementById('chk-clearing');
    const inputClearing = document.getElementById('input-clearing');
    const clearingVal = Number(tx.clearingFee) || 0;
    if (chkClearing && inputClearing) {
      chkClearing.checked = clearingVal > 0;
      inputClearing.disabled = clearingVal === 0;
      inputClearing.value = String(clearingVal);
    }

    // Populate Rows
    this.rows = [];
    document.getElementById('voucher-rows-body').innerHTML = '';
    if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
      tx.items.forEach(item => {
        const itemPrice = item.customPrice !== undefined ? item.customPrice : ((item.itemSubtotal && item.quantity) ? Math.round(item.itemSubtotal / item.quantity) : 0);
        this.addRow(item.voucherCode, item.startSerial, item.endSerial, item.quantity, itemPrice);
      });
    } else {
      this.addRow('V50', '', '', 40);
    }

    this.recalculateTotal();
    this.updateCustomerHistoryHint();
  },

  cancelEdit() {
    this.editingTxId = null;
    const alertBox = document.getElementById('editing-mode-alert');
    if (alertBox) alertBox.style.display = 'none';
    const btnSave = document.getElementById('btn-save-only');
    if (btnSave) btnSave.innerHTML = '💾 Simpan Transaksi';
    this.resetForm();
  },

  addRow(voucherCode = 'V50', startSerial = '', endSerial = '', quantity = '', customPrice = '') {
    const rowId = 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const initialPrice = customPrice !== '' && customPrice !== undefined ? Number(customPrice) : this.getVoucherPrice(voucherCode);

    // Auto-suggest next continuous start serial for this denomination if empty
    if (!startSerial) {
      startSerial = SerialCalc.getSuggestedStartSerial(voucherCode, this.rows);
    }

    if (voucherCode === 'MANUAL') {
      quantity = 1;
      if (!endSerial) endSerial = startSerial;
    } else {
      // Default quantity to 40 if missing and startSerial exists
      if (!quantity && startSerial) {
        quantity = 40;
      }
      // Calculate endSerial if missing but start and quantity present
      if (startSerial && quantity && !endSerial) {
        endSerial = SerialCalc.calcEndSerial(startSerial, quantity);
      }
    }

    const rowObj = {
      id: rowId,
      voucherCode,
      startSerial,
      endSerial,
      quantity,
      customPrice: initialPrice,
      itemSubtotal: 0,
      adminSubtotal: 0
    };
    this.rows.push(rowObj);
    this.renderRowTr(rowObj);
    this.recalculateTotal();
  },

  renderRowTr(rowObj) {
    const tr = document.createElement('tr');
    tr.id = rowObj.id;
    const isManual = rowObj.voucherCode === 'MANUAL';
    const priceVal = isManual ? (rowObj.customPrice || 0) : this.getVoucherPrice(rowObj.voucherCode);

    const startTitle = isManual ? '🔒 Seri Awal Terkunci Otomatis (Voucher Manual)' : '🔒 Seri Awal Terkunci Otomatis (Sesuai Urutan Operasional SPBU)';
    const endTitle = isManual ? '🔒 Seri Akhir Terkunci Otomatis (Voucher Manual)' : '';
    const qtyTitle = isManual ? '🔒 Lembarnya Terkunci ke 1 (Voucher Manual)' : '';

    const startAttr = `readonly style="background-color:#f1f5f9; color:#1e293b; font-weight:bold; cursor:not-allowed;" title="${startTitle}"`;
    const endAttr = isManual ? `readonly style="background-color:#f1f5f9; color:#1e293b; font-weight:bold; cursor:not-allowed;" title="${endTitle}"` : '';
    const qtyAttr = isManual ? `readonly style="background-color:#f1f5f9; color:#1e293b; font-weight:bold; cursor:not-allowed;" title="${qtyTitle}"` : '';
    const priceAttr = !isManual ? `disabled style="background-color:#f1f5f9; color:#64748b;"` : `style="font-weight:bold; color:#0284c7; border-color:#38bdf8;"`;

    tr.innerHTML = `
      <td>
        <select class="form-select row-voucher-code" data-id="${rowObj.id}">
          <option value="V25" ${rowObj.voucherCode === 'V25' ? 'selected' : ''}>V25 (Rp 25.000)</option>
          <option value="V50" ${rowObj.voucherCode === 'V50' ? 'selected' : ''}>V50 (Rp 50.000)</option>
          <option value="V100" ${rowObj.voucherCode === 'V100' ? 'selected' : ''}>V100 (Rp 100.000)</option>
          <option value="V200" ${rowObj.voucherCode === 'V200' ? 'selected' : ''}>V200 (Rp 200.000)</option>
          <option value="V300" ${rowObj.voucherCode === 'V300' ? 'selected' : ''}>V300 (Rp 300.000)</option>
          <option value="MANUAL" ${rowObj.voucherCode === 'MANUAL' ? 'selected' : ''}>Manual (Custom)</option>
        </select>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 4px;">
          <input type="text" class="form-control row-serial-start" data-id="${rowObj.id}" placeholder="147801" value="${rowObj.startSerial}" ${startAttr}>
          <button type="button" class="btn btn-outline-secondary btn-sm btn-unlock-start" data-id="${rowObj.id}" title="Klik untuk Buka Kunci & Input Seri Baru" style="padding: 2px 6px; font-size: 0.75rem; line-height: 1; flex-shrink: 0;">🔓</button>
        </div>
      </td>
      <td>
        <input type="text" class="form-control row-serial-end" data-id="${rowObj.id}" placeholder="147840" value="${rowObj.endSerial}" ${endAttr}>
      </td>
      <td>
        <input type="number" class="form-control row-quantity" data-id="${rowObj.id}" placeholder="40" value="${rowObj.quantity}" ${qtyAttr}>
      </td>
      <td>
        <input type="number" class="form-control row-custom-price" data-id="${rowObj.id}" placeholder="150000" value="${priceVal}" ${priceAttr}>
      </td>
      <td class="row-subtotal-cell" style="font-weight: bold;">Rp 0</td>
      <td>
        <button class="btn btn-danger btn-sm btn-delete-row" data-id="${rowObj.id}" title="Hapus Baris">🗑️</button>
      </td>
    `;

    document.getElementById('voucher-rows-body').appendChild(tr);

    // Event listeners per row input
    const selectCode = tr.querySelector('.row-voucher-code');
    const inputStart = tr.querySelector('.row-serial-start');
    const btnUnlockStart = tr.querySelector('.btn-unlock-start');
    const inputEnd = tr.querySelector('.row-serial-end');
    const inputQty = tr.querySelector('.row-quantity');
    const inputPrice = tr.querySelector('.row-custom-price');
    const btnDel = tr.querySelector('.btn-delete-row');

    btnUnlockStart?.addEventListener('click', () => {
      const isLocked = inputStart.readOnly;
      if (isLocked) {
        inputStart.readOnly = false;
        inputStart.style.backgroundColor = '#fffbeb';
        inputStart.style.color = '#92400e';
        inputStart.style.borderColor = '#f59e0b';
        inputStart.style.cursor = 'text';
        inputStart.title = '🔓 Seri Awal Terbuka: Silakan ketik nomor seri baru';
        btnUnlockStart.innerText = '🔒';
        btnUnlockStart.title = 'Kunci Kembali Seri Awal';
        btnUnlockStart.classList.remove('btn-outline-secondary');
        btnUnlockStart.classList.add('btn-warning');
        inputStart.focus();
        inputStart.select();
      } else {
        inputStart.readOnly = true;
        inputStart.style.backgroundColor = '#f1f5f9';
        inputStart.style.color = '#1e293b';
        inputStart.style.borderColor = '';
        inputStart.style.cursor = 'not-allowed';
        inputStart.title = startTitle;
        btnUnlockStart.innerText = '🔓';
        btnUnlockStart.title = 'Klik untuk Buka Kunci & Input Seri Baru';
        btnUnlockStart.classList.remove('btn-warning');
        btnUnlockStart.classList.add('btn-outline-secondary');
      }
    });

    selectCode.addEventListener('change', (e) => {
      rowObj.voucherCode = e.target.value;
      const isNowManual = rowObj.voucherCode === 'MANUAL';

      if (isNowManual) {
        // Lock inputs for Manual Voucher
        inputStart.readOnly = true;
        inputStart.style.backgroundColor = '#f1f5f9';
        inputStart.style.color = '#1e293b';
        inputStart.style.cursor = 'not-allowed';
        inputStart.title = '🔒 Seri Awal Terkunci Otomatis (Voucher Manual)';

        inputEnd.readOnly = true;
        inputEnd.style.backgroundColor = '#f1f5f9';
        inputEnd.style.color = '#1e293b';
        inputEnd.style.cursor = 'not-allowed';
        inputEnd.title = '🔒 Seri Akhir Terkunci Otomatis (Voucher Manual)';

        inputQty.readOnly = true;
        inputQty.style.backgroundColor = '#f1f5f9';
        inputQty.style.color = '#1e293b';
        inputQty.style.cursor = 'not-allowed';
        inputQty.title = '🔒 Lembarnya Terkunci ke 1 (Voucher Manual)';
        rowObj.quantity = 1;
        inputQty.value = 1;

        inputPrice.disabled = false;
        inputPrice.style.backgroundColor = '#ffffff';
        inputPrice.style.color = '#0284c7';
        inputPrice.style.fontWeight = 'bold';
        inputPrice.style.borderColor = '#38bdf8';
        if (!rowObj.customPrice) rowObj.customPrice = 0;
        inputPrice.value = rowObj.customPrice;
      } else {
        // Unlock end & qty for standard denomination
        inputStart.readOnly = true;
        inputStart.style.backgroundColor = '#f1f5f9';
        inputStart.style.color = '#1e293b';
        inputStart.style.cursor = 'not-allowed';
        inputStart.title = '🔒 Seri Awal Terkunci Otomatis (Sesuai Urutan Operasional SPBU)';

        inputEnd.readOnly = false;
        inputEnd.style.backgroundColor = '#ffffff';
        inputEnd.style.color = '';
        inputEnd.style.cursor = 'text';
        inputEnd.title = '';

        inputQty.readOnly = false;
        inputQty.style.backgroundColor = '#ffffff';
        inputQty.style.color = '';
        inputQty.style.cursor = 'text';
        inputQty.title = '';

        inputPrice.disabled = true;
        inputPrice.style.backgroundColor = '#f1f5f9';
        inputPrice.style.color = '#64748b';
        inputPrice.style.fontWeight = 'normal';
        inputPrice.style.borderColor = '#cbd5e1';
        rowObj.customPrice = this.getVoucherPrice(rowObj.voucherCode);
        inputPrice.value = rowObj.customPrice;

        if (btnUnlockStart) {
          btnUnlockStart.innerText = '🔓';
          btnUnlockStart.title = 'Klik untuk Buka Kunci & Input Seri Baru';
          btnUnlockStart.classList.remove('btn-warning');
          btnUnlockStart.classList.add('btn-outline-secondary');
        }
      }

      // Lock to suggested start serial for the newly selected denomination
      const otherRows = this.rows.filter(r => r.id !== rowObj.id);
      const suggestedStart = SerialCalc.getSuggestedStartSerial(rowObj.voucherCode, otherRows);
      if (suggestedStart) {
        rowObj.startSerial = suggestedStart;
        inputStart.value = suggestedStart;
        if (isNowManual) {
          rowObj.quantity = 1;
          inputQty.value = 1;
          rowObj.endSerial = suggestedStart;
          inputEnd.value = suggestedStart;
        } else {
          if (!rowObj.quantity || rowObj.quantity === 1) {
            rowObj.quantity = 40;
            inputQty.value = 40;
          }
          if (rowObj.quantity > 0) {
            rowObj.endSerial = SerialCalc.calcEndSerial(suggestedStart, rowObj.quantity);
            inputEnd.value = rowObj.endSerial;
          }
        }
      }

      this.recalculateTotal();
    });

    inputPrice.addEventListener('input', (e) => {
      rowObj.customPrice = parseInt(e.target.value, 10) || 0;
      this.recalculateTotal();
    });

    // BI-DIRECTIONAL MATH: When Start or End Serial changes -> Calculate Quantity
    inputStart.addEventListener('input', (e) => {
      rowObj.startSerial = e.target.value.trim();
      if (rowObj.startSerial && rowObj.endSerial) {
        const qty = SerialCalc.calcQuantity(rowObj.startSerial, rowObj.endSerial);
        if (qty > 0) {
          rowObj.quantity = qty;
          inputQty.value = qty;
        }
      } else if (rowObj.startSerial && rowObj.quantity > 0) {
        rowObj.endSerial = SerialCalc.calcEndSerial(rowObj.startSerial, rowObj.quantity);
        inputEnd.value = rowObj.endSerial;
      }
      this.recalculateTotal();
    });

    inputEnd.addEventListener('input', (e) => {
      rowObj.endSerial = e.target.value.trim();
      if (rowObj.startSerial && rowObj.endSerial) {
        const qty = SerialCalc.calcQuantity(rowObj.startSerial, rowObj.endSerial);
        if (qty > 0) {
          rowObj.quantity = qty;
          inputQty.value = qty;
        }
      }
      this.recalculateTotal();
    });

    // BI-DIRECTIONAL MATH: When Quantity changes -> Calculate End Serial
    inputQty.addEventListener('input', (e) => {
      rowObj.quantity = parseInt(e.target.value, 10) || 0;
      if (rowObj.startSerial && rowObj.quantity > 0) {
        rowObj.endSerial = SerialCalc.calcEndSerial(rowObj.startSerial, rowObj.quantity);
        inputEnd.value = rowObj.endSerial;
      }
      this.recalculateTotal();
    });

    btnDel.addEventListener('click', () => {
      if (this.rows.length <= 1) {
        alert("Minimal harus ada 1 baris voucher!");
        return;
      }
      this.rows = this.rows.filter(r => r.id !== rowObj.id);
      tr.remove();
      this.recalculateTotal();
    });
  },

  getVoucherPrice(code, customPrice = 0) {
    switch (code) {
      case 'V25': return 25000;
      case 'V50': return 50000;
      case 'V100': return 100000;
      case 'V200': return 200000;
      case 'V300': return 300000;
      case 'MANUAL': return Number(customPrice) || 0;
      default: return Number(customPrice) || 0;
    }
  },

  recalculateTotal() {
    let totalSheets = 0;
    let voucherSubtotal = 0;
    let totalAdminFee = 0;

    this.updateDenomLastSerialsBar();

    // Check overlap within form & DB
    const formOverlapErrors = SerialCalc.validateRowsOverlap(this.rows);
    const dbOverlapErrors = [];

    this.rows.forEach(r => {
      if (r.startSerial && r.endSerial) {
        const sold = DB.checkSerialAlreadySold(r.startSerial, r.endSerial, r.voucherCode, this.editingTxId);
        if (sold) {
          dbOverlapErrors.push(`⚠️ Bentrok Database (${r.voucherCode}): Seri ${r.startSerial} - ${r.endSerial} sudah terpakai pada Nota #${sold.notaNumber} (${sold.customerName})`);
        }
      }
    });

    const allErrors = [...formOverlapErrors.map(e => `⚠️ ${e.message}`), ...dbOverlapErrors];
    const errorAlertBox = document.getElementById('overlap-error-alert');
    if (errorAlertBox) {
      if (allErrors.length > 0) {
        errorAlertBox.style.display = 'block';
        errorAlertBox.style.background = '#fee2e2';
        errorAlertBox.style.border = '1px solid #ef4444';
        errorAlertBox.style.color = '#b91c1c';
        errorAlertBox.style.padding = '0.75rem 1rem';
        errorAlertBox.style.borderRadius = '8px';
        errorAlertBox.style.marginBottom = '1rem';
        errorAlertBox.innerHTML = allErrors.join('<br>');
      } else {
        errorAlertBox.style.display = 'none';
      }
    }

    this.rows.forEach(r => {
      const qty = parseInt(r.quantity, 10) || 0;
      const price = this.getVoucherPrice(r.voucherCode, r.customPrice);
      const subtotal = qty * price;
      const adminSub = qty * 500;

      r.itemSubtotal = subtotal;
      r.adminSubtotal = adminSub;

      totalSheets += qty;
      voucherSubtotal += subtotal;
      totalAdminFee += adminSub;

      // Update row subtotal display cell
      const tr = document.getElementById(r.id);
      if (tr) {
        const cell = tr.querySelector('.row-subtotal-cell');
        if (cell) cell.innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
      }
    });

    const chkClearing = document.getElementById('chk-clearing');
    const inputClearing = document.getElementById('input-clearing');
    let clearingFee = 0;
    if (chkClearing && chkClearing.checked && inputClearing) {
      clearingFee = parseInt(inputClearing.value, 10) || 0;
    }

    const adminClearingSubtotal = totalAdminFee + clearingFee;
    const grandTotal = voucherSubtotal + adminClearingSubtotal;

    const voucherTerbilang = formatTerbilangRupiah(voucherSubtotal, true);
    const adminClearingTerbilang = formatTerbilangRupiah(adminClearingSubtotal, true);
    const grandTotalTerbilang = formatTerbilangRupiah(grandTotal, true);

    // Update UI Summary Elements
    const elSheets = document.getElementById('sum-total-sheets');
    if (elSheets) elSheets.innerText = `${totalSheets} Lbr`;

    const elVoucherSubtotal = document.getElementById('sum-voucher-subtotal');
    if (elVoucherSubtotal) elVoucherSubtotal.innerText = `Rp ${voucherSubtotal.toLocaleString('id-ID')}`;

    const elVoucherTerbilang = document.getElementById('sum-voucher-terbilang');
    if (elVoucherTerbilang) elVoucherTerbilang.innerText = voucherTerbilang;

    const elAdminFee = document.getElementById('sum-admin-fee');
    if (elAdminFee) elAdminFee.innerText = `Rp ${totalAdminFee.toLocaleString('id-ID')}`;

    const elClearingFee = document.getElementById('sum-clearing-fee');
    if (elClearingFee) elClearingFee.innerText = `Rp ${clearingFee.toLocaleString('id-ID')}`;

    const elAdminClearingSubtotal = document.getElementById('sum-admin-clearing-subtotal');
    if (elAdminClearingSubtotal) elAdminClearingSubtotal.innerText = `Rp ${adminClearingSubtotal.toLocaleString('id-ID')}`;

    const elAdminClearingTerbilang = document.getElementById('sum-admin-clearing-terbilang');
    if (elAdminClearingTerbilang) elAdminClearingTerbilang.innerText = adminClearingTerbilang;

    const elGrandTotal = document.getElementById('sum-grand-total');
    if (elGrandTotal) elGrandTotal.innerText = `Rp ${grandTotal.toLocaleString('id-ID')}`;

    const elTerbilang = document.getElementById('sum-terbilang');
    if (elTerbilang) elTerbilang.innerText = grandTotalTerbilang;

    this.updateLivePreview();
  },

  setPreviewDocType(docType) {
    this.activeDocType = docType;
    document.getElementById('btn-preview-nota')?.classList.toggle('btn-primary', docType === 'nota');
    document.getElementById('btn-preview-nota')?.classList.toggle('btn-secondary', docType !== 'nota');
    document.getElementById('btn-preview-kwitansi')?.classList.toggle('btn-primary', docType === 'kwitansi');
    document.getElementById('btn-preview-kwitansi')?.classList.toggle('btn-secondary', docType !== 'kwitansi');
    document.getElementById('btn-preview-voucher')?.classList.toggle('btn-primary', docType === 'voucher');
    document.getElementById('btn-preview-voucher')?.classList.toggle('btn-secondary', docType !== 'voucher');
    this.updateLivePreview();
  },

  getValidUntilFormatted(dateStr) {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return `31 Agustus ${new Date().getFullYear()}`;
    const currentMonth = d.getMonth();
    d.setMonth(currentMonth + 1);
    if (d.getMonth() > (currentMonth + 1) % 12) {
      d.setDate(0);
    }
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  },

  getPrintedMonthYear(dateStr) {
    const months = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) {
      const today = new Date();
      return `${months[today.getMonth()]} ${today.getFullYear()}`;
    }
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  },

  _buildVoucherStripsHtml(items, customerName, dateStr) {
    const validUntilDate = this.getValidUntilFormatted(dateStr);
    const printedMonthYear = this.getPrintedMonthYear(dateStr);
    const customerUpper = window.escapeHTML(customerName || 'BEA CUKAI').toUpperCase();

    let instansiShort = customerUpper;
    if (customerUpper.includes('/')) {
      const parts = customerUpper.split('/');
      instansiShort = parts[parts.length - 1].trim();
    }

    let allStripsHtml = '';

    const manualItems = (items || []).filter(r => r.voucherCode === 'MANUAL');

    manualItems.forEach(r => {
      const price = this.getVoucherPrice(r.voucherCode, r.customPrice);
      const priceFormatted = `Rp. ${price.toLocaleString('id-ID')}`;

      const startNum = SerialCalc.parseSerial(r.startSerial);
      const endNum = SerialCalc.parseSerial(r.endSerial);
      const qty = parseInt(r.quantity, 10) || 1;

      const sNum = startNum !== null ? startNum : 1;
      const eNum = endNum !== null ? endNum : (sNum + qty - 1);
      const serialLen = r.startSerial ? String(r.startSerial).length : 3;

      for (let n = sNum; n <= eNum; n++) {
        const serialStr = SerialCalc.formatSerial(n, serialLen);
        allStripsHtml += `
          <div class="voucher-manual-strip">
            <div class="v-header">
              <div class="v-header-left">Gtlo No: &nbsp;<span class="v-serial-num">${serialStr}</span></div>
              <div class="v-header-center">
                <img src="assets/logo-pertamina.svg" class="v-pertamina-logo-img" alt="PERTAMINA" onerror="this.onerror=null; this.src='assets/logo-pertamina.png';">
              </div>
              <div class="v-header-right">Gtlo No: &nbsp;<span class="v-serial-num">${serialStr}</span></div>
            </div>

            <div class="v-body">
              <!-- Stub Kiri -->
              <div class="v-stub">
                <div class="v-bbk-badge">BBK</div>
                <div class="v-customer-name">${customerUpper}</div>
                <div class="v-nominal-text">${priceFormatted}</div>
                <div class="v-instansi-tag">${instansiShort}</div>
                <div class="v-footer-info">
                  <div>Gtlo, &nbsp; ${printedMonthYear}</div>
                  <div>SPBU 74 - 961.04</div>
                </div>
              </div>

              <!-- Tengah (Syarat & Masa Berlaku) -->
              <div class="v-center-block">
                <div class="v-spbu-title">S P B U &nbsp;7 4 - 9 6 1 - 0 4</div>
                <div class="v-terms-box">
                  <div class="v-terms-text">voucher ini tidak bisa</div>
                  <div class="v-terms-text">diuangkan atau</div>
                  <div class="v-terms-text">diganti dengan BBM lain</div>
                  <div class="v-valid-header">Berlaku s/d tanggal</div>
                  <div class="v-valid-date">${validUntilDate}</div>
                </div>
              </div>

              <!-- Stub Kanan -->
              <div class="v-stub">
                <div class="v-bbk-badge">BBK</div>
                <div class="v-customer-name">${customerUpper}</div>
                <div class="v-nominal-text">${priceFormatted}</div>
                <div class="v-instansi-tag">${instansiShort}</div>
                <div class="v-footer-info">
                  <div style="color: #dc2626; font-weight: bold;">Gtlo, &nbsp; ${printedMonthYear}</div>
                  <div>SPBU 74 - 961.04</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });

    return `
      <div class="print-document-container">
        ${allStripsHtml || '<div style="padding: 2rem; text-align: center; font-weight: bold; color: #64748b;">Tidak ada data kupon voucher manual untuk dicetak.</div>'}
      </div>
    `;
  },

  formatGorontaloDate(dateStr) {
    const months = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) {
      const today = new Date();
      return `Gorontalo, ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
    }
    return `Gorontalo, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  },

  updateLivePreview() {
    const container = document.getElementById('preview-render-area');
    if (!container) return;

    const notaNo = document.getElementById('input-nota-no').value || '33';
    const customer = window.escapeHTML((document.getElementById('input-customer').value || 'BEA CUKAI').toUpperCase());
    const officer = window.escapeHTML(document.getElementById('select-officer').value || 'Saipul Karim Suleman');
    const dateStr = document.getElementById('input-date').value;
    const formattedDate = this.formatGorontaloDate(dateStr);

    let totalSheets = 0;
    let voucherSubtotal = 0;
    let totalAdminFee = 0;
    this.rows.forEach(r => {
      totalSheets += Number(r.quantity) || 0;
      voucherSubtotal += Number(r.itemSubtotal) || 0;
      totalAdminFee += Number(r.adminSubtotal) || 0;
    });

    const chkClearing = document.getElementById('chk-clearing');
    const inputClearing = document.getElementById('input-clearing');
    let clearingFee = 0;
    if (chkClearing && chkClearing.checked && inputClearing) {
      clearingFee = parseInt(inputClearing.value, 10) || 0;
    }

    const adminClearingSubtotal = totalAdminFee + clearingFee;
    const grandTotal = voucherSubtotal + adminClearingSubtotal;

    const voucherTerbilang = formatTerbilangRupiah(voucherSubtotal, true);
    const adminClearingTerbilang = formatTerbilangRupiah(adminClearingSubtotal, true);
    const grandTotalTerbilang = formatTerbilangRupiah(grandTotal, true);

    if (this.activeDocType === 'voucher') {
      container.innerHTML = this._buildVoucherStripsHtml(this.rows, customer, dateStr);
    } else if (this.activeDocType === 'nota') {
      const payV = document.getElementById('select-payment-voucher')?.value || 'Tunai';
      const payA = document.getElementById('select-payment-admin')?.value || 'Tunai';
      const ketText = (payV === payA) ? payV : `Voucher: ${payV}<br>Admin: ${payA}`;

      // Build Nota Kupon 3-Up F4 Slip Html
      let tableRowsHtml = '';
      const totalItemRows = this.rows.length;
      this.rows.forEach((r, idx) => {
        const price = this.getVoucherPrice(r.voucherCode, r.customPrice);
        const adminText = clearingFee > 0 ? `${r.adminSubtotal.toLocaleString('id-ID')} + ${clearingFee.toLocaleString('id-ID')}` : `${r.adminSubtotal.toLocaleString('id-ID')}`;
        const codeDisplay = r.voucherCode === 'MANUAL' ? `MANUAL (@${price.toLocaleString('id-ID')})` : r.voucherCode;
        const ketTdHtml = (idx === 0) ? `<td rowspan="${totalItemRows}" style="font-size:9px; line-height:1.25; font-weight:600; text-align:center; vertical-align:middle;">${ketText}</td>` : '';
        tableRowsHtml += `
          <tr>
            <td style="text-align:center;"><b>${codeDisplay}</b></td>
            <td>${r.startSerial} - ${r.endSerial}</td>
            <td style="text-align:center;">${r.quantity}</td>
            <td style="text-align:right;">${adminText}</td>
            <td style="text-align:right;">${r.itemSubtotal.toLocaleString('id-ID')}</td>
            ${ketTdHtml}
          </tr>
        `;
      });

      const compactClass = totalItemRows > 4 ? 'nota-compact' : '';
      const singleNotaHtml = `
        <div class="nota-slip ${compactClass}">
          <img src="assets/logo-arba.png" class="watermark-bg" alt="ARBA GROUP Watermark">
          <div class="nota-content">
            <table class="nota-header-table">
              <tr>
                <td width="75"><img src="assets/logo-arba.png" style="width: 68px; height: auto; display: block;" alt="Logo"></td>
                <td class="nota-brand-title">
                  <div class="nota-spbu-code">( SPBU 74 - 961 - 4 )</div>
                  <div class="nota-company-name">PT. ARBA MITRA USAHA GORONTALO</div>
                </td>
                <td width="130" style="text-align:right;">
                  <span style="font-size:11px; font-weight:bold;">NOTA KUPON &nbsp;No.</span>
                  <div class="nota-no-box">${notaNo}</div>
                </td>
              </tr>
            </table>

            <div class="nota-diserahkan">
              Diserahkan Kepada : <span class="nota-diserahkan-name">${customer}</span>
            </div>

            <table class="nota-main-table">
              <thead>
                <tr>
                  <th width="70">Kode Kupon</th>
                  <th width="140">Nomor</th>
                  <th width="75">Banyaknya (Lembar)</th>
                  <th width="90">Admin</th>
                  <th width="110">Harga P/Ltr. (Rp)</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
                <tr class="nota-total-row">
                  <td colspan="2" style="text-align:right;">Jumlah Subtotal</td>
                  <td style="text-align:center;">${totalSheets} Lbr</td>
                  <td style="text-align:right;">Rp. ${adminClearingSubtotal.toLocaleString('id-ID')}</td>
                  <td style="text-align:right;">Rp. ${voucherSubtotal.toLocaleString('id-ID')}</td>
                  <td></td>
                </tr>
                <tr style="font-weight:bold; background-color:#fff1f0;">
                  <td colspan="3" style="text-align:right;">GRAND TOTAL KESELURUHAN</td>
                  <td colspan="2" style="text-align:right; font-size:13px; color:var(--primary-red);">Rp. ${grandTotal.toLocaleString('id-ID')}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>

            <div class="nota-terbilang-box">
              TERBILANG : ${grandTotalTerbilang}
            </div>

            <table class="nota-footer-table">
              <tr>
                <td width="33%">
                  <div class="sig-block-left">
                    <div class="sig-date"><b>Yang Menerima,</b></div>
                    <div class="sig-company">&nbsp;</div>
                    <div class="sig-space"></div>
                    <div class="sig-name"><span class="sig-name-blank"></span></div>
                  </div>
                </td>
                <td width="33%" style="text-align:center;">
                  <div class="fiat-box">
                    <div class="fiat-title">FIAT</div>
                    <div class="fiat-cols">
                      <div class="fiat-col">Adm</div>
                      <div class="fiat-col">Plm.</div>
                    </div>
                  </div>
                </td>
                <td width="34%">
                  <div class="sig-block-right">
                    <div class="sig-date">${formattedDate}</div>
                    <div class="sig-company">PT. ARBA MITRA USAHA</div>
                    <div class="sig-space"></div>
                    <div class="sig-name">( ${officer} )</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      `;

      const payVoucher = document.getElementById('select-payment-voucher')?.value || 'Tunai';
      const payAdmin = document.getElementById('select-payment-admin')?.value || 'Tunai';

      // Build Kwitansi 3rd Slip for F4 Combined Sheet
      const kwitansiParams = {
        customer,
        grandTotalTerbilang,
        items: this.rows,
        totalSheets,
        voucherSubtotal,
        adminFee: totalAdminFee,
        clearingFee,
        adminClearingSubtotal,
        grandTotal,
        formattedDate,
        officer,
        paymentVoucher: payVoucher,
        paymentAdmin: payAdmin
      };
      const singleKwitansiSlipHtml = this._buildKwitansiSlipHtml(kwitansiParams);

      // Render 2 Nota Kupon Slips + 1 Kwitansi Slip Vertically for 3-Up F4 Print
      container.innerHTML = `
        <div class="print-document-container">
          ${singleNotaHtml}
          ${singleNotaHtml}
          ${singleKwitansiSlipHtml}
        </div>
      `;
    } else {
      const payVoucher = document.getElementById('select-payment-voucher')?.value || 'Tunai';
      const payAdmin = document.getElementById('select-payment-admin')?.value || 'Tunai';

      // Build Kwitansi Document Preview with Separated Voucher & Admin Breakdown
      let kwitansiBreakdownHtml = '';
      this.rows.forEach(r => {
        const price = this.getVoucherPrice(r.voucherCode, r.customPrice);
        const labelText = r.voucherCode === 'MANUAL' ? `• Voucher (Manual @${price.toLocaleString('id-ID')})` : `• Voucher ${price.toLocaleString('id-ID')}`;
        kwitansiBreakdownHtml += `
          <div class="kwitansi-breakdown-row">
            <div style="width: 220px;">${labelText}</div>
            <div style="width: 20px;">=</div>
            <div style="width: 70px;">${r.quantity} Lbr</div>
            <div style="width: 20px;">=</div>
            <div>Rp ${r.itemSubtotal.toLocaleString('id-ID')},-</div>
          </div>
        `;
      });

      container.innerHTML = `
        <div class="print-document-container">
          <div class="kwitansi-doc">
            <img src="assets/logo-arba.png" class="watermark-bg" alt="ARBA GROUP Watermark" style="opacity: 0.12; width: 480px;">
            <div class="kwitansi-header-title">KWITANSI</div>

            <div class="kwitansi-row">
              <div class="kwitansi-label">Sudah terima dari</div>
              <div class="kwitansi-colon">:</div>
              <div class="kwitansi-value">${customer}</div>
            </div>

            <div class="kwitansi-row">
              <div class="kwitansi-label">Uang sejumlah</div>
              <div class="kwitansi-colon">:</div>
              <div class="kwitansi-value kwitansi-terbilang-text">${grandTotalTerbilang}</div>
            </div>

            <div class="kwitansi-row" style="margin-bottom:0;">
              <div class="kwitansi-label">Untuk pembayaran</div>
              <div class="kwitansi-colon">:</div>
              <div class="kwitansi-value">
                <div class="kwitansi-breakdown-table">
                  <div style="font-weight: bold; color: #1e40af; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; margin-bottom: 4px;">
                    [1] PERHITUNGAN VOUCHER BBM (${payVoucher.toUpperCase()})
                  </div>
                  ${kwitansiBreakdownHtml}
                  <div class="kwitansi-breakdown-row" style="font-weight: bold; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1;">
                    <div style="width: 220px;">Subtotal Voucher</div>
                    <div style="width: 20px;">=</div>
                    <div style="width: 70px;">${totalSheets} Lbr</div>
                    <div style="width: 20px;">=</div>
                    <div>Rp ${voucherSubtotal.toLocaleString('id-ID')},-</div>
                  </div>

                  <div style="font-weight: bold; color: #d97706; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; margin-bottom: 4px; margin-top: 10px;">
                    [2] PERHITUNGAN BIAYA ADMIN & CLEARING (${payAdmin.toUpperCase()})
                  </div>
                  <div class="kwitansi-breakdown-row">
                    <div style="width: 220px;">• Biaya Cetak Admin</div>
                    <div style="width: 20px;">=</div>
                    <div style="width: 70px;">${totalSheets} Lbr @500</div>
                    <div style="width: 20px;">=</div>
                    <div>Rp ${totalAdminFee.toLocaleString('id-ID')},-</div>
                  </div>
                  ${clearingFee > 0 ? `
                  <div class="kwitansi-breakdown-row">
                    <div style="width: 220px;">• Biaya Clearing (Opsional)</div>
                    <div style="width: 20px;">=</div>
                    <div style="width: 70px;">-</div>
                    <div style="width: 20px;">=</div>
                    <div>Rp ${clearingFee.toLocaleString('id-ID')},-</div>
                  </div>
                  ` : ''}
                  <div class="kwitansi-breakdown-row" style="font-weight: bold; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1;">
                    <div style="width: 220px;">Subtotal Admin & Clearing</div>
                    <div style="width: 20px;">=</div>
                    <div style="width: 70px;">-</div>
                    <div style="width: 20px;">=</div>
                    <div>Rp ${adminClearingSubtotal.toLocaleString('id-ID')},-</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="kwitansi-row" style="margin-top: 15px;">
              <div class="kwitansi-label" style="font-size: 15px;">Nominal</div>
              <div class="kwitansi-colon" style="font-size: 15px;">:</div>
              <div class="kwitansi-value">
                <span class="kwitansi-nominal-box">Rp. ${grandTotal.toLocaleString('id-ID')},-</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 30px;">
              <div class="sig-block-right">
                <div class="sig-date">${formattedDate}</div>
                <div class="sig-company">PT. ARBA MITRA USAHA</div>
                <div class="sig-space" style="height: 55px;"></div>
                <div class="sig-name">( ${officer} )</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const printMount = document.getElementById('print-mount-point');
    if (printMount) {
      printMount.innerHTML = container.innerHTML;
    }
  },

  // ─── Helper: Build Kwitansi Slip HTML (for 1/3 F4 Bottom Section) ───────────
  _buildKwitansiSlipHtml(p) {
    let kwitansiBreakdownHtml = '';
    (p.items || []).forEach(r => {
      const price = r.customPrice !== undefined ? r.customPrice : (r.itemSubtotal && r.quantity ? Math.round(r.itemSubtotal / r.quantity) : this.getVoucherPrice(r.voucherCode));
      const labelText = r.voucherCode === 'MANUAL' ? `• Voucher (Manual @${price.toLocaleString('id-ID')})` : `• Voucher ${price.toLocaleString('id-ID')}`;
      kwitansiBreakdownHtml += `
        <div class="kwitansi-breakdown-row">
          <div style="width: 200px;">${labelText}</div>
          <div style="width: 15px;">=</div>
          <div style="width: 65px;">${r.quantity} Lbr</div>
          <div style="width: 15px;">=</div>
          <div>Rp ${(r.itemSubtotal || 0).toLocaleString('id-ID')},-</div>
        </div>
      `;
    });

    return `
      <div class="kwitansi-slip">
        <img src="assets/logo-arba.png" class="watermark-bg" alt="ARBA GROUP Watermark">
        <div class="kwitansi-slip-content">
          <div class="kwitansi-slip-title">KWITANSI</div>

          <div class="kwitansi-row" style="margin-bottom: 3px;">
            <div class="kwitansi-label" style="width: 140px; font-size: 11px;">Sudah terima dari</div>
            <div class="kwitansi-colon" style="width: 12px; font-size: 11px;">:</div>
            <div class="kwitansi-value" style="font-size: 11px;">${p.customer}</div>
          </div>

          <div class="kwitansi-row" style="margin-bottom: 3px;">
            <div class="kwitansi-label" style="width: 140px; font-size: 11px;">Uang sejumlah</div>
            <div class="kwitansi-colon" style="width: 12px; font-size: 11px;">:</div>
            <div class="kwitansi-value kwitansi-terbilang-text" style="font-size: 11px;">${p.grandTotalTerbilang}</div>
          </div>

          <div class="kwitansi-row" style="margin-bottom: 0;">
            <div class="kwitansi-label" style="width: 140px; font-size: 11px;">Untuk pembayaran</div>
            <div class="kwitansi-colon" style="width: 12px; font-size: 11px;">:</div>
            <div class="kwitansi-value">
              <div class="kwitansi-breakdown-table" style="font-size: 10.5px; margin-top: 0; margin-bottom: 4px;">
                <div style="font-weight: bold; color: #1e40af; border-bottom: 1px dashed #cbd5e1; padding-bottom: 1px; margin-bottom: 2px;">
                  [1] PERHITUNGAN VOUCHER BBM (${(p.paymentVoucher || 'Tunai').toUpperCase()})
                </div>
                ${kwitansiBreakdownHtml}
                <div class="kwitansi-breakdown-row" style="font-weight: bold; margin-top: 2px; padding-top: 2px; border-top: 1px dashed #cbd5e1;">
                  <div style="width: 200px;">Subtotal Voucher</div>
                  <div style="width: 15px;">=</div>
                  <div style="width: 65px;">${p.totalSheets} Lbr</div>
                  <div style="width: 15px;">=</div>
                  <div>Rp ${p.voucherSubtotal.toLocaleString('id-ID')},-</div>
                </div>

                <div style="font-weight: bold; color: #d97706; border-bottom: 1px dashed #cbd5e1; padding-bottom: 1px; margin-bottom: 2px; margin-top: 4px;">
                  [2] PERHITUNGAN BIAYA ADMIN & CLEARING (${(p.paymentAdmin || 'Tunai').toUpperCase()})
                </div>
                <div class="kwitansi-breakdown-row">
                  <div style="width: 200px;">• Biaya Cetak Admin</div>
                  <div style="width: 15px;">=</div>
                  <div style="width: 65px;">${p.totalSheets} Lbr @500</div>
                  <div style="width: 15px;">=</div>
                  <div>Rp ${p.adminFee.toLocaleString('id-ID')},-</div>
                </div>
                ${p.clearingFee > 0 ? `
                <div class="kwitansi-breakdown-row">
                  <div style="width: 200px;">• Biaya Clearing (Opsional)</div>
                  <div style="width: 15px;">=</div>
                  <div style="width: 65px;">-</div>
                  <div style="width: 15px;">=</div>
                  <div>Rp ${p.clearingFee.toLocaleString('id-ID')},-</div>
                </div>
                ` : ''}
                <div class="kwitansi-breakdown-row" style="font-weight: bold; margin-top: 2px; padding-top: 2px; border-top: 1px dashed #cbd5e1;">
                  <div style="width: 200px;">Subtotal Admin & Clearing</div>
                  <div style="width: 15px;">=</div>
                  <div style="width: 65px;">-</div>
                  <div style="width: 15px;">=</div>
                  <div>Rp ${p.adminClearingSubtotal.toLocaleString('id-ID')},-</div>
                </div>
              </div>
            </div>
          </div>

          <table class="nota-footer-table" style="margin-top: 2px;">
            <tr>
              <td width="50%" style="vertical-align: middle;">
                <div style="font-size: 12px; font-weight: 900;">
                  Nominal : <span style="font-size: 13px; color: #000;">Rp. ${p.grandTotal.toLocaleString('id-ID')},-</span>
                </div>
              </td>
              <td width="50%">
                <div class="sig-block-right">
                  <div class="sig-date">${p.formattedDate}</div>
                  <div class="sig-company">PT. ARBA MITRA USAHA</div>
                  <div class="sig-space" style="height: 32px;"></div>
                  <div class="sig-name">( ${p.officer} )</div>
                </div>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
  },

  // ─── Shared Validation & Data Builder ──────────────────────────────────────
  _buildTxData() {
    const notaNo = document.getElementById('input-nota-no').value || '33';
    const customer = (document.getElementById('input-customer').value || 'BEA CUKAI').toUpperCase();
    const officer = document.getElementById('select-officer').value || 'Saipul Karim Suleman';
    const dateStr = document.getElementById('input-date').value;

    // Validate that date is not in the future
    const inputDateObj = new Date(dateStr);
    const currentDateObj = new Date();
    // Set time to 0 to only compare dates
    inputDateObj.setHours(0,0,0,0);
    currentDateObj.setHours(0,0,0,0);
    if (inputDateObj > currentDateObj) {
      alert('Gagal Menyimpan: Tanggal transaksi tidak boleh lebih dari hari ini!');
      return null;
    }

    if (this.rows.length === 0) {
      alert('Masukkan minimal 1 pecahan voucher!');
      return null;
    }

    const overlapErrors = SerialCalc.validateRowsOverlap(this.rows);
    if (overlapErrors.length > 0) {
      alert('Gagal Menyimpan: Terdapat nomor seri yang bentrok antar baris!\n' + overlapErrors[0].message);
      return null;
    }

    for (const r of this.rows) {
      const soldInfo = DB.checkSerialAlreadySold(r.startSerial, r.endSerial, r.voucherCode, this.editingTxId);
      if (soldInfo) {
        alert(`❌ KEAMANAN STOK: Nomor seri ${soldInfo.serialStart}-${soldInfo.serialEnd} (${soldInfo.voucherCode}) sudah PERNAH DIJUAL ke ${soldInfo.customerName} pada Nota #${soldInfo.notaNumber}!`);
        return null;
      }
    }

    let totalSheets = 0;
    let voucherSubtotal = 0;
    let totalAdminFee = 0;
    this.rows.forEach(r => {
      totalSheets += Number(r.quantity) || 0;
      voucherSubtotal += Number(r.itemSubtotal) || 0;
      totalAdminFee += Number(r.adminSubtotal) || 0;
    });

    const chkClearing = document.getElementById('chk-clearing');
    const inputClearing = document.getElementById('input-clearing');
    let clearingFee = 0;
    if (chkClearing && chkClearing.checked && inputClearing) {
      clearingFee = parseInt(inputClearing.value, 10) || 0;
    }

    const adminClearingSubtotal = totalAdminFee + clearingFee;
    const grandTotal = voucherSubtotal + adminClearingSubtotal;

    const voucherTerbilang = formatTerbilangRupiah(voucherSubtotal, true);
    const adminClearingTerbilang = formatTerbilangRupiah(adminClearingSubtotal, true);
    const grandTotalTerbilang = formatTerbilangRupiah(grandTotal, true);

    const existingTx = this.editingTxId ? DB.getTransactions().find(t => t.id === this.editingTxId) : null;

    const paymentVoucher = document.getElementById('select-payment-voucher')?.value || 'Tunai';
    const paymentAdmin = document.getElementById('select-payment-admin')?.value || 'Tunai';

    return {
      id: this.editingTxId || undefined,
      createdAt: existingTx ? existingTx.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notaNumber: notaNo,
      transactionDate: dateStr,
      customerName: customer,
      officerName: officer,
      paymentVoucher,
      paymentAdmin,
      payment_voucher: paymentVoucher,
      payment_admin: paymentAdmin,
      items: this.rows.map(r => ({
        voucherCode: r.voucherCode,
        startSerial: r.startSerial,
        endSerial: r.endSerial,
        quantity: r.quantity,
        customPrice: r.voucherCode === 'MANUAL' ? (r.customPrice || 0) : undefined,
        itemSubtotal: r.itemSubtotal,
        adminSubtotal: r.adminSubtotal
      })),
      totalSheets,
      voucherSubtotal,
      voucherTerbilang,
      adminFee: totalAdminFee,
      clearingFee,
      adminClearingSubtotal,
      adminClearingTerbilang,
      grandTotal,
      terbilang: grandTotalTerbilang,
      status: 'SUKSES'
    };
  },

  // ─── Save Only (No Print) ────────────────────────────────────────────────────
  saveOnly(skipReset = false) {
    const isEdit = Boolean(this.editingTxId);
    const txData = this._buildTxData();
    if (!txData) return null;

    const savedTx = DB.saveTransaction(txData);
    this.loadCustomerOptions();

    const savedNotaNo = savedTx.notaNumber;
    if (isEdit) {
      if (!skipReset) this.cancelEdit();
      this._showSaveToast(`${savedNotaNo} (Di-update)`);
    } else {
      if (skipReset) {
        this.editingTxId = savedTx.id;
      } else {
        this.resetForm();
      }
      this._showSaveToast(savedNotaNo);
    }
    this.renderHistoryTable();
    if (typeof Dashboard !== 'undefined') Dashboard.renderDashboard();
    return savedTx;
  },

  // ─── Auto-Save & Print ────────────────────────────────────────────────────
  printDoc(docType) {
    // Auto-save transaction before printing to prevent data loss
    const saved = this.saveOnly(true);
    if (!saved) return; // Validation failed, do not print

    // Switch to the requested doc type and refresh preview
    this.activeDocType = docType;
    this.setPreviewDocType(docType);
    this.updateLivePreview();

    // Wait for DOM to fully render before opening print dialog
    setTimeout(() => {
      window.print();
    }, 300);
  },

  // ─── Toast Notification ──────────────────────────────────────────────────────
  _showSaveToast(notaNumber) {
    // Remove existing toast if any
    document.getElementById('save-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'save-toast';
    toast.style.cssText = [
      'position:fixed', 'top:24px', 'right:24px', 'z-index:99999',
      'background:linear-gradient(135deg,#059669,#10b981)',
      'color:#fff', 'padding:1rem 1.5rem', 'border-radius:14px',
      'font-weight:700', 'font-size:1rem',
      'box-shadow:0 8px 30px rgba(16,185,129,0.45)',
      'display:flex', 'align-items:center', 'gap:0.6rem',
      'animation:toastIn 0.35s cubic-bezier(.21,1.02,.73,1) forwards'
    ].join(';');
    toast.innerHTML = `✅ Nota #${notaNumber} berhasil disimpan!`;

    // Inject keyframe animation once
    if (!document.getElementById('toast-style')) {
      const style = document.createElement('style');
      style.id = 'toast-style';
      style.textContent = `
        @keyframes toastIn {
          from { opacity:0; transform:translateY(-16px) scale(0.95); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes toastOut {
          from { opacity:1; transform:translateY(0)    scale(1);    }
          to   { opacity:0; transform:translateY(-12px) scale(0.95); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 320);
    }, 3000);
  },

  shareToWhatsApp() {
    const notaNo = document.getElementById('input-nota-no').value || '33';
    const customer = window.escapeHTML((document.getElementById('input-customer').value || 'BEA CUKAI').toUpperCase());
    const officer = window.escapeHTML(document.getElementById('select-officer').value || 'Saipul Karim Suleman');
    const dateStr = document.getElementById('input-date').value;

    let totalSheets = 0;
    let voucherSubtotal = 0;
    let totalAdminFee = 0;
    let itemsText = '';

    this.rows.forEach(r => {
      const price = this.getVoucherPrice(r.voucherCode, r.customPrice);
      totalSheets += Number(r.quantity) || 0;
      voucherSubtotal += Number(r.itemSubtotal) || 0;
      totalAdminFee += Number(r.adminSubtotal) || 0;
      const codeStr = r.voucherCode === 'MANUAL' ? `Manual @Rp ${price.toLocaleString('id-ID')}` : r.voucherCode;
      itemsText += `• ${r.quantity} Lbr (${codeStr}) Seri ${r.startSerial}-${r.endSerial} = Rp ${r.itemSubtotal.toLocaleString('id-ID')}\n`;
    });

    const chkClearing = document.getElementById('chk-clearing');
    const inputClearing = document.getElementById('input-clearing');
    let clearingFee = 0;
    if (chkClearing && chkClearing.checked && inputClearing) {
      clearingFee = parseInt(inputClearing.value, 10) || 0;
    }

    const adminClearingSubtotal = totalAdminFee + clearingFee;
    const grandTotal = voucherSubtotal + adminClearingSubtotal;

    const voucherTerbilang = formatTerbilangRupiah(voucherSubtotal, true);
    const adminClearingTerbilang = formatTerbilangRupiah(adminClearingSubtotal, true);
    const grandTotalTerbilang = formatTerbilangRupiah(grandTotal, true);

    const message = `*PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)*\n` +
      `*RINGKASAN NOTA VOUCHER #${notaNo}*\n\n` +
      `Diserahkan Kepada: *${customer}*\n` +
      `Tanggal: ${dateStr}\n\n` +
      `🎟️ *[1] PERHITUNGAN VOUCHER BBM*\n${itemsText}` +
      `Total Lembar: ${totalSheets} Lbr\n` +
      `Subtotal Nominal Voucher: *Rp ${voucherSubtotal.toLocaleString('id-ID')}*\n` +
      `_Terbilang Voucher: ${voucherTerbilang}_\n\n` +
      `⚙️ *[2] PERHITUNGAN BIAYA ADMIN & CLEARING*\n` +
      `Biaya Cetak Admin (@500): Rp ${totalAdminFee.toLocaleString('id-ID')}\n` +
      (clearingFee > 0 ? `Biaya Clearing (Opsional): Rp ${clearingFee.toLocaleString('id-ID')}\n` : '') +
      `Subtotal Admin & Clearing: *Rp ${adminClearingSubtotal.toLocaleString('id-ID')}*\n` +
      `_Terbilang Admin & Clearing: ${adminClearingTerbilang}_\n\n` +
      `💰 *GRAND TOTAL (GABUNGAN): Rp ${grandTotal.toLocaleString('id-ID')}*\n` +
      `_Terbilang Grand Total: ${grandTotalTerbilang}_\n\n` +
      `Petugas: ${officer}`;

    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
  },

  printHistoryDoc(txId, docType) {
    const transactions = DB.getTransactions();
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    const formattedDate = this.formatGorontaloDate(tx.transactionDate);
    const adminClearingSubtotal = tx.adminClearingSubtotal !== undefined ? tx.adminClearingSubtotal : ((tx.adminFee || 0) + (tx.clearingFee || 0));
    const voucherSubtotal = tx.voucherSubtotal || 0;
    const grandTotal = tx.grandTotal || 0;

    const voucherTerbilang = tx.voucherTerbilang || formatTerbilangRupiah(voucherSubtotal, true);
    const adminClearingTerbilang = tx.adminClearingTerbilang || formatTerbilangRupiah(adminClearingSubtotal, true);
    const grandTotalTerbilang = tx.terbilang || formatTerbilangRupiah(grandTotal, true);

    const txPayV = tx.paymentVoucher || tx.payment_voucher || 'Tunai';
    const txPayA = tx.paymentAdmin || tx.payment_admin || 'Tunai';

    let html = '';
    if (docType === 'voucher') {
      html = this._buildVoucherStripsHtml(tx.items || [], tx.customerName, tx.transactionDate);
    } else if (docType === 'nota') {
      const ketText = (txPayV === txPayA) ? txPayV : `Voucher: ${txPayV}<br>Admin: ${txPayA}`;
      let tableRowsHtml = '';
      const itemsList = tx.items || [];
      const totalItemRows = itemsList.length;
      itemsList.forEach((r, idx) => {
        const price = r.customPrice !== undefined ? r.customPrice : (r.itemSubtotal && r.quantity ? Math.round(r.itemSubtotal / r.quantity) : this.getVoucherPrice(r.voucherCode));
        const adminText = (tx.clearingFee || 0) > 0 ? `${(r.adminSubtotal || 0).toLocaleString('id-ID')} + ${(tx.clearingFee || 0).toLocaleString('id-ID')}` : `${(r.adminSubtotal || 0).toLocaleString('id-ID')}`;
        const codeDisplay = r.voucherCode === 'MANUAL' ? `MANUAL (@${price.toLocaleString('id-ID')})` : r.voucherCode;
        const ketTdHtml = (idx === 0) ? `<td rowspan="${totalItemRows}" style="font-size:9px; line-height:1.25; font-weight:600; text-align:center; vertical-align:middle;">${ketText}</td>` : '';
        tableRowsHtml += `
          <tr>
            <td style="text-align:center;"><b>${codeDisplay}</b></td>
            <td>${r.startSerial} - ${r.endSerial}</td>
            <td style="text-align:center;">${r.quantity}</td>
            <td style="text-align:right;">${adminText}</td>
            <td style="text-align:right;">${(r.itemSubtotal || 0).toLocaleString('id-ID')}</td>
            ${ketTdHtml}
          </tr>
        `;
      });

      const compactClass = totalItemRows > 4 ? 'nota-compact' : '';
      const singleNotaHtml = `
        <div class="nota-slip ${compactClass}">
          <img src="assets/logo-arba.png" class="watermark-bg" alt="ARBA GROUP Watermark">
          <div class="nota-content">
            <table class="nota-header-table">
              <tr>
                <td width="75"><img src="assets/logo-arba.png" style="width: 68px; height: auto; display: block;" alt="Logo"></td>
                <td class="nota-brand-title">
                  <div class="nota-spbu-code">( SPBU 74 - 961 - 4 )</div>
                  <div class="nota-company-name">PT. ARBA MITRA USAHA GORONTALO</div>
                </td>
                <td width="130" style="text-align:right;">
                  <span style="font-size:11px; font-weight:bold;">NOTA KUPON &nbsp;No.</span>
                  <div class="nota-no-box">${tx.notaNumber}</div>
                </td>
              </tr>
            </table>

            <div class="nota-diserahkan">
              Diserahkan Kepada : <span class="nota-diserahkan-name">${window.escapeHTML(tx.customerName)}</span>
            </div>

            <table class="nota-main-table">
              <thead>
                <tr>
                  <th width="70">Kode Kupon</th>
                  <th width="140">Nomor</th>
                  <th width="75">Banyaknya (Lembar)</th>
                  <th width="90">Admin</th>
                  <th width="110">Harga P/Ltr. (Rp)</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
                <tr class="nota-total-row">
                  <td colspan="2" style="text-align:right;">Jumlah Subtotal</td>
                  <td style="text-align:center;">${tx.totalSheets} Lbr</td>
                  <td style="text-align:right;">Rp. ${adminClearingSubtotal.toLocaleString('id-ID')}</td>
                  <td style="text-align:right;">Rp. ${voucherSubtotal.toLocaleString('id-ID')}</td>
                  <td></td>
                </tr>
                <tr style="font-weight:bold; background-color:#fff1f0;">
                  <td colspan="3" style="text-align:right;">GRAND TOTAL KESELURUHAN</td>
                  <td colspan="2" style="text-align:right; font-size:13px; color:var(--primary-red);">Rp. ${grandTotal.toLocaleString('id-ID')}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>

            <div class="nota-terbilang-box">
              TERBILANG : ${grandTotalTerbilang}
            </div>

            <table class="nota-footer-table">
              <tr>
                <td width="33%">
                  <div class="sig-block-left">
                    <div class="sig-date"><b>Yang Menerima,</b></div>
                    <div class="sig-company">&nbsp;</div>
                    <div class="sig-space"></div>
                    <div class="sig-name"><span class="sig-name-blank"></span></div>
                  </div>
                </td>
                <td width="33%" style="text-align:center;">
                  <div class="fiat-box">
                    <div class="fiat-title">FIAT</div>
                    <div class="fiat-cols">
                      <div class="fiat-col">Adm</div>
                      <div class="fiat-col">Plm.</div>
                    </div>
                  </div>
                </td>
                <td width="34%">
                  <div class="sig-block-right">
                    <div class="sig-date">${formattedDate}</div>
                    <div class="sig-company">PT. ARBA MITRA USAHA</div>
                    <div class="sig-space"></div>
                    <div class="sig-name">( ${window.escapeHTML(tx.officerName || 'Saipul Karim Suleman')} )</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      `;

      const kwitansiParams = {
        customer: window.escapeHTML(tx.customerName),
        grandTotalTerbilang,
        items: tx.items || [],
        totalSheets: tx.totalSheets || 0,
        voucherSubtotal,
        adminFee: tx.adminFee || 0,
        clearingFee: tx.clearingFee || 0,
        adminClearingSubtotal,
        grandTotal,
        formattedDate,
        officer: window.escapeHTML(tx.officerName) || 'Saipul Karim Suleman',
        paymentVoucher: txPayV,
        paymentAdmin: txPayA
      };
      const singleKwitansiSlipHtml = this._buildKwitansiSlipHtml(kwitansiParams);

      html = `
        <div class="print-document-container">
          ${singleNotaHtml}
          ${singleNotaHtml}
          ${singleKwitansiSlipHtml}
        </div>
      `;
    } else {
      let kwitansiBreakdownHtml = '';
      (tx.items || []).forEach(r => {
        const price = r.customPrice !== undefined ? r.customPrice : (r.itemSubtotal && r.quantity ? Math.round(r.itemSubtotal / r.quantity) : this.getVoucherPrice(r.voucherCode));
        const labelText = r.voucherCode === 'MANUAL' ? `• Voucher (Manual @${price.toLocaleString('id-ID')})` : `• Voucher ${price.toLocaleString('id-ID')}`;
        kwitansiBreakdownHtml += `
          <div class="kwitansi-breakdown-row">
            <div style="width: 220px;">${labelText}</div>
            <div style="width: 20px;">=</div>
            <div style="width: 70px;">${r.quantity} Lbr</div>
            <div style="width: 20px;">=</div>
            <div>Rp ${(r.itemSubtotal || 0).toLocaleString('id-ID')},-</div>
          </div>
        `;
      });

      html = `
        <div class="print-document-container">
          <div class="kwitansi-doc">
            <img src="assets/logo-arba.png" class="watermark-bg" alt="ARBA GROUP Watermark" style="opacity: 0.12; width: 480px;">
            <div class="kwitansi-header-title">KWITANSI</div>

            <div class="kwitansi-row">
              <div class="kwitansi-label">Sudah terima dari</div>
              <div class="kwitansi-colon">:</div>
              <div class="kwitansi-value">${window.escapeHTML(tx.customerName)}</div>
            </div>

            <div class="kwitansi-row">
              <div class="kwitansi-label">Uang sejumlah</div>
              <div class="kwitansi-colon">:</div>
              <div class="kwitansi-value kwitansi-terbilang-text">${grandTotalTerbilang}</div>
            </div>

            <div class="kwitansi-row" style="margin-bottom:0;">
              <div class="kwitansi-label">Untuk pembayaran</div>
              <div class="kwitansi-colon">:</div>
              <div class="kwitansi-value">
                <div class="kwitansi-breakdown-table">
                  <div style="font-weight: bold; color: #1e40af; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; margin-bottom: 4px;">
                    [1] PERHITUNGAN VOUCHER BBM (${txPayV.toUpperCase()})
                  </div>
                  ${kwitansiBreakdownHtml}
                  <div class="kwitansi-breakdown-row" style="font-weight: bold; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1;">
                    <div style="width: 220px;">Subtotal Voucher</div>
                    <div style="width: 20px;">=</div>
                    <div style="width: 70px;">${tx.totalSheets} Lbr</div>
                    <div style="width: 20px;">=</div>
                    <div>Rp ${voucherSubtotal.toLocaleString('id-ID')},-</div>
                  </div>

                  <div style="font-weight: bold; color: #d97706; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; margin-bottom: 4px; margin-top: 10px;">
                    [2] PERHITUNGAN BIAYA ADMIN & CLEARING (${txPayA.toUpperCase()})
                  </div>
                  <div class="kwitansi-breakdown-row">
                    <div style="width: 220px;">• Biaya Cetak Admin</div>
                    <div style="width: 20px;">=</div>
                    <div style="width: 70px;">${tx.totalSheets} Lbr @500</div>
                    <div style="width: 20px;">=</div>
                    <div>Rp ${(tx.adminFee || 0).toLocaleString('id-ID')},-</div>
                  </div>
                  ${(tx.clearingFee || 0) > 0 ? `
                  <div class="kwitansi-breakdown-row">
                    <div style="width: 220px;">• Biaya Clearing (Opsional)</div>
                    <div style="width: 20px;">=</div>
                    <div style="width: 70px;">-</div>
                    <div style="width: 20px;">=</div>
                    <div>Rp ${(tx.clearingFee || 0).toLocaleString('id-ID')},-</div>
                  </div>
                  ` : ''}
                  <div class="kwitansi-breakdown-row" style="font-weight: bold; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1;">
                    <div style="width: 220px;">Subtotal Admin & Clearing</div>
                    <div style="width: 20px;">=</div>
                    <div style="width: 70px;">-</div>
                    <div style="width: 20px;">=</div>
                    <div>Rp ${adminClearingSubtotal.toLocaleString('id-ID')},-</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="kwitansi-row" style="margin-top: 15px;">
              <div class="kwitansi-label" style="font-size: 15px;">Nominal</div>
              <div class="kwitansi-colon" style="font-size: 15px;">:</div>
              <div class="kwitansi-value">
                <span class="kwitansi-nominal-box">Rp. ${(tx.grandTotal || 0).toLocaleString('id-ID')},-</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 30px;">
              <div class="sig-block-right">
                <div class="sig-date">${formattedDate}</div>
                <div class="sig-company">PT. ARBA MITRA USAHA</div>
                <div class="sig-space" style="height: 55px;"></div>
                <div class="sig-name">( ${window.escapeHTML(tx.officerName || 'Saipul Karim Suleman')} )</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const printMount = document.getElementById('print-mount-point');
    if (printMount) {
      printMount.innerHTML = html;
    }

    setTimeout(() => {
      window.print();
      // Restore live preview after print dialogue closes
      this.updateLivePreview();
    }, 300);
  },

  getFilteredHistoryTransactions() {
    let transactions = DB.getTransactions() || [];
    const state = this.historyState;

    let filtered = transactions.filter(tx => {
      // 1. Search Query Filter
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase().trim();
        const notaStr = `#${tx.notaNumber}`.toLowerCase();
        const custStr = (tx.customerName || '').toLowerCase();
        const itemsStr = tx.items ? tx.items.map(i => `${i.voucherCode} ${i.startSerial} ${i.endSerial}`).join(' ').toLowerCase() : '';
        const matchSearch = notaStr.includes(query) || custStr.includes(query) || itemsStr.includes(query);
        if (!matchSearch) return false;
      }

      // 2. Date Range Filter
      if (state.startDate) {
        if (tx.transactionDate < state.startDate) return false;
      }
      if (state.endDate) {
        if (tx.transactionDate > state.endDate) return false;
      }

      // 3. Payment Method Filter
      if (state.paymentMethod !== 'ALL') {
        const payV = tx.paymentVoucher || tx.payment_voucher || 'Tunai';
        const payA = tx.paymentAdmin || tx.payment_admin || 'Tunai';
        if (payV !== state.paymentMethod && payA !== state.paymentMethod) return false;
      }

      // 4. Status Filter
      if (state.status !== 'ALL') {
        if (tx.status !== state.status) return false;
      }

      return true;
    });

    // Urutkan berdasarkan tanggal (terbaru ke terlama), lalu nota (terbesar ke terkecil)
    return filtered.sort((a, b) => {
      let dateA = new Date(a.transactionDate || a.createdAt || 0).getTime();
      let dateB = new Date(b.transactionDate || b.createdAt || 0).getTime();
      if (isNaN(dateA)) dateA = 0;
      if (isNaN(dateB)) dateB = 0;
      
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      const nA = parseInt(a.notaNumber, 10) || 0;
      const nB = parseInt(b.notaNumber, 10) || 0;
      return nB - nA;
    });
  },

  renderHistoryKPI(filteredTransactions) {
    const totalTxEl = document.getElementById('kpi-total-tx');
    const totalSheetsEl = document.getElementById('kpi-total-sheets');
    const voucherSubtotalEl = document.getElementById('kpi-voucher-subtotal');
    const adminSubtotalEl = document.getElementById('kpi-admin-subtotal');
    const grandTotalEl = document.getElementById('kpi-grand-total');
    const countBadgeEl = document.getElementById('hist-filtered-count-badge');

    const totalTx = filteredTransactions.length;

    // Filter active (non-VOID) for monetary KPIs
    const activeTx = filteredTransactions.filter(t => t.status !== 'VOID');

    let totalSheets = 0;
    let voucherSubtotal = 0;
    let adminClearingSubtotal = 0;
    let grandTotal = 0;

    activeTx.forEach(tx => {
      totalSheets += (tx.totalSheets || 0);
      voucherSubtotal += (tx.voucherSubtotal || 0);
      adminClearingSubtotal += ((tx.adminFee || 0) + (tx.clearingFee || 0));
      grandTotal += (tx.grandTotal || 0);
    });

    if (totalTxEl) totalTxEl.textContent = `${totalTx} Nota`;
    if (totalSheetsEl) totalSheetsEl.textContent = `${totalSheets.toLocaleString('id-ID')} Lbr`;
    if (voucherSubtotalEl) voucherSubtotalEl.textContent = `Rp ${voucherSubtotal.toLocaleString('id-ID')}`;
    if (adminSubtotalEl) adminSubtotalEl.textContent = `Rp ${adminClearingSubtotal.toLocaleString('id-ID')}`;
    if (grandTotalEl) grandTotalEl.textContent = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    if (countBadgeEl) {
      const allCount = (DB.getTransactions() || []).length;
      if (totalTx === allCount) {
        countBadgeEl.textContent = `(Total: ${allCount} Transaksi)`;
      } else {
        countBadgeEl.textContent = `(Ditemukan ${totalTx} dari ${allCount} Transaksi)`;
      }
    }
  },

  buildVoucherBreakdownTable(tx) {
    if (!tx || !tx.items || tx.items.length === 0) {
      return `<div style="color:#94a3b8; padding:0.5rem; text-align:center;">Tidak ada rincian pecahan.</div>`;
    }

    const payV = tx.paymentVoucher || tx.payment_voucher || 'Tunai';
    const payA = tx.paymentAdmin || tx.payment_admin || 'Tunai';
    const totalClearing = tx.clearingFee || 0;

    let totalVoucherSub = 0;
    let totalAdminSub = 0;
    let totalSheets = 0;
    let totalGrand = 0;

    const rowsHtml = tx.items.map((item, index) => {
      const code = item.voucherCode || 'MANUAL';
      const startSerial = item.startSerial || '-';
      const endSerial = item.endSerial || '-';
      const qty = item.quantity || 0;
      const voucherSub = item.itemSubtotal || 0;
      const adminSub = item.adminSubtotal || (qty * 500);

      // Distribute clearing fee to 1st item row (or display as dedicated bank deduction)
      const itemClearing = (index === 0) ? totalClearing : 0;
      const itemGrand = voucherSub + adminSub + itemClearing;

      totalSheets += qty;
      totalVoucherSub += voucherSub;
      totalAdminSub += adminSub;
      totalGrand += itemGrand;

      const clearingBadge = itemClearing > 0
        ? `<span class="badge-clearing">Rp ${itemClearing.toLocaleString('id-ID')}</span>`
        : `<span style="color:#94a3b8;">Rp 0</span>`;

      return `
        <tr>
          <td><strong style="color:#1e3a8a;">${code}</strong></td>
          <td><code style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-weight:700; color:#0f172a;">${startSerial}</code></td>
          <td><code style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-weight:700; color:#0f172a;">${endSerial}</code></td>
          <td style="font-weight:700; text-align:center;">${qty} Lbr</td>
          <td style="font-weight:700; color:#1e40af; text-align:right;">Rp ${voucherSub.toLocaleString('id-ID')}</td>
          <td><span style="font-size:0.78rem; font-weight:600; color:#0284c7;">💳 ${payV}</span></td>
          <td style="font-weight:600; color:#d97706; text-align:right;">Rp ${adminSub.toLocaleString('id-ID')}</td>
          <td><span style="font-size:0.78rem; font-weight:600; color:#92400e;">💳 ${payA}</span></td>
          <td style="text-align:right;">${clearingBadge}</td>
          <td style="font-weight:800; color:var(--primary-red); text-align:right;">Rp ${itemGrand.toLocaleString('id-ID')}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="overflow-x: auto;">
        <table class="sub-detail-table">
          <thead>
            <tr>
              <th>Pecahan Voucher</th>
              <th>Seri Awal</th>
              <th>Seri Akhir</th>
              <th style="text-align:center;">Jumlah Lembar</th>
              <th style="text-align:right;">Subtotal Voucher</th>
              <th>Metode Pay Voucher</th>
              <th style="text-align:right;">Admin Cetak (@500)</th>
              <th>Metode Pay Admin</th>
              <th style="text-align:right;">Clearing Bank (Auto-Deduct)</th>
              <th style="text-align:right;">Grand Total Item</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr class="sub-table-footer">
              <td colspan="3"><strong>TOTAL NOTA #${tx.notaNumber} (${tx.items.length} Pecahan)</strong></td>
              <td style="text-align:center;"><strong>${totalSheets} Lbr</strong></td>
              <td style="text-align:right; color:#1e40af;"><strong>Rp ${totalVoucherSub.toLocaleString('id-ID')}</strong></td>
              <td>-</td>
              <td style="text-align:right; color:#d97706;"><strong>Rp ${totalAdminSub.toLocaleString('id-ID')}</strong></td>
              <td>-</td>
              <td style="text-align:right; color:#92400e;"><strong>Rp ${totalClearing.toLocaleString('id-ID')}</strong></td>
              <td style="text-align:right; color:var(--primary-red); font-size:0.9rem;"><strong>Rp ${totalGrand.toLocaleString('id-ID')}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  },

  renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    const filtered = this.getFilteredHistoryTransactions();
    this.renderHistoryKPI(filtered);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding: 2rem;">Tidak ada riwayat transaksi yang cocok dengan filter.</td></tr>`;
      this.renderHistoryPagination(0, 0, 0);
      return;
    }

    // Pagination slicing
    const rowsPerPage = this.historyState.rowsPerPage === 'ALL' ? filtered.length : parseInt(this.historyState.rowsPerPage, 10);
    const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;

    if (this.historyState.currentPage > totalPages) {
      this.historyState.currentPage = totalPages;
    }
    if (this.historyState.currentPage < 1) {
      this.historyState.currentPage = 1;
    }

    const startIndex = (this.historyState.currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filtered.length);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    const expandedSet = this.historyState.expandedTxIds;

    tbody.innerHTML = paginatedItems.map(tx => {
      const isVoid = tx.status === 'VOID';
      const isExpanded = expandedSet.has(tx.id);
      const itemsDetailText = tx.items ? tx.items.map(i => `${i.quantity}Lbr (${i.voucherCode})`).join(', ') : '-';
      const statusBadge = isVoid
        ? `<span class="badge badge-void">VOID (Dibatalkan)</span>`
        : `<span class="badge badge-success">SUKSES</span>`;

      const payV = tx.paymentVoucher || tx.payment_voucher || 'Tunai';
      const payA = tx.paymentAdmin || tx.payment_admin || 'Tunai';
      const payBadge = (payV === payA)
        ? `<div style="font-size:0.75rem; color:#0284c7; font-weight:600; margin-top:2px;">💳 ${payV}</div>`
        : `<div style="font-size:0.75rem; color:#0369a1; font-weight:600; margin-top:2px;">💳 V: ${payV} | A: ${payA}</div>`;

      return `
        <tr style="${isVoid ? 'opacity:0.65; background-color:#fff1f0;' : ''}">
          <td><b>#${tx.notaNumber}</b></td>
          <td>${tx.transactionDate}</td>
          <td><b>${window.escapeHTML(tx.customerName)}</b>${payBadge}</td>
          <td>
            <div style="font-size:0.85rem; font-weight:600; color:#334155;">
              ${tx.totalSheets} Lbr (${tx.items ? tx.items.length : 0} Pecahan)
            </div>
            <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${itemsDetailText}</div>
            <button class="btn btn-sm btn-toggle-detail" data-id="${tx.id}" style="margin-top:4px; padding:0.2rem 0.5rem; font-size:0.75rem; background:${isExpanded ? '#fecdd3' : '#e0f2fe'}; color:${isExpanded ? '#9f1239' : '#0369a1'}; border:1px solid ${isExpanded ? '#fda4af' : '#7dd3fc'}; border-radius:4px; font-weight:bold; cursor:pointer;">
              ${isExpanded ? '▲ Sembunyikan Tabel' : '🔍 Lihat Tabel Rinci (10 Kolom)'}
            </button>
          </td>
          <td style="font-weight:bold; color:var(--primary-red);">Rp ${(tx.grandTotal || 0).toLocaleString('id-ID')}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
              <button class="btn btn-sm btn-print-hist" style="background:#fff; border:1px solid #cbd5e1; padding:0.25rem 0.5rem; border-radius:4px;" data-id="${tx.id}" data-type="nota">🖨️ Nota</button>
              <button class="btn btn-sm btn-print-hist" style="background:#fff; border:1px solid #cbd5e1; padding:0.25rem 0.5rem; border-radius:4px;" data-id="${tx.id}" data-type="kwitansi">🖨️ Kwt</button>
              <button class="btn btn-sm btn-print-hist" style="background:#fff; border:1px solid #059669; color:#059669; padding:0.25rem 0.5rem; border-radius:4px; font-weight:bold;" data-id="${tx.id}" data-type="voucher">🖨️ Voucher</button>
              ${!isVoid ? `
                <button class="btn btn-warning btn-sm btn-edit-tx" style="padding:0.25rem 0.5rem; background:#f59e0b; color:#fff; border:none; border-radius:4px; font-weight:bold;" data-id="${tx.id}">✏️ Edit</button>
                <button class="btn btn-danger btn-sm btn-void-tx" style="padding:0.25rem 0.5rem; background:#ef4444; color:#fff; border:none; border-radius:4px; font-weight:bold;" data-id="${tx.id}">🚫 VOID</button>
                <button class="btn btn-danger btn-sm btn-delete-tx" style="padding:0.25rem 0.5rem;" data-id="${tx.id}">🗑️ Hapus</button>
              ` : `<span style="font-size:0.8rem; color:#64748b; margin-left:0.5rem; align-self:center;">${window.escapeHTML(tx.voidReason || '')}</span>`}
            </div>
          </td>
        </tr>

        <!-- Expanded Sub-Table Row -->
        <tr id="sub-row-${tx.id}" style="display: ${isExpanded ? 'table-row' : 'none'}; background-color: #f8fafc;">
          <td colspan="7" style="padding: 0.75rem 1rem;">
            <div class="sub-detail-wrapper">
              <div style="font-weight:700; color:#1e293b; font-size:0.85rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                <span>📊 TABEL RINCIAN SERI & PECAHAN VOUCHER (NOTA #${tx.notaNumber})</span>
                <span style="font-weight:normal; color:#64748b; font-size:0.78rem;">💡 Biaya Clearing Bank dipotong otomatis oleh bank saat transaksi transfer</span>
              </div>
              ${this.buildVoucherBreakdownTable(tx)}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.renderHistoryPagination(filtered.length, startIndex + 1, endIndex);

    // Bind Toggle Detail buttons
    document.querySelectorAll('.btn-toggle-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (expandedSet.has(id)) {
          expandedSet.delete(id);
        } else {
          expandedSet.add(id);
        }
        this.renderHistoryTable();
      });
    });

    // Bind Edit buttons
    document.querySelectorAll('.btn-edit-tx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.loadTransactionToEdit(id);
      });
    });

    // Bind Delete buttons
    document.querySelectorAll('.btn-delete-tx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const confirmDelete = confirm("Apakah Anda yakin ingin menghapus nota ini? Data akan dihapus secara permanen.");
        if (confirmDelete) {
          DB.deleteTransaction(id);
          this.renderHistoryTable();
        }
      });
    });

    // Bind Void buttons
    document.querySelectorAll('.btn-void-tx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const reason = prompt("Masukkan alasan pembatalan (VOID) nota ini:");
        if (reason !== null && reason.trim() !== '') {
          DB.voidTransaction(id, reason.trim());
          this.renderHistoryTable();
          if (typeof Dashboard !== 'undefined') Dashboard.renderDashboard();
        }
      });
    });

    // Bind Print buttons
    document.querySelectorAll('.btn-print-hist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const docType = e.currentTarget.dataset.type;
        this.printHistoryDoc(id, docType);
      });
    });
  },

  renderHistoryPagination(totalFiltered, startNum, endNum) {
    const pageInfoEl = document.getElementById('hist-page-info');
    const buttonsEl = document.getElementById('hist-pagination-buttons');
    if (!pageInfoEl || !buttonsEl) return;

    if (totalFiltered === 0) {
      pageInfoEl.textContent = 'Menampilkan 0 dari 0 transaksi';
      buttonsEl.innerHTML = '';
      return;
    }

    pageInfoEl.textContent = `Menampilkan ${startNum} - ${endNum} dari ${totalFiltered} transaksi`;

    const rowsPerPage = this.historyState.rowsPerPage === 'ALL' ? totalFiltered : parseInt(this.historyState.rowsPerPage, 10);
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    const currPage = this.historyState.currentPage;

    let btnsHtml = `<button type="button" class="btn-page-num" ${currPage === 1 ? 'disabled' : ''} data-page="${currPage - 1}">◀ Prev</button>`;

    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7) {
        if (p !== 1 && p !== totalPages && Math.abs(p - currPage) > 1) {
          if (p === 2 && currPage > 3) {
            btnsHtml += `<span style="align-self:center; color:#94a3b8; padding:0 2px;">...</span>`;
          } else if (p === totalPages - 1 && currPage < totalPages - 2) {
            btnsHtml += `<span style="align-self:center; color:#94a3b8; padding:0 2px;">...</span>`;
          }
          continue;
        }
      }
      btnsHtml += `<button type="button" class="btn-page-num ${p === currPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }

    btnsHtml += `<button type="button" class="btn-page-num" ${currPage === totalPages ? 'disabled' : ''} data-page="${currPage + 1}">Next ▶</button>`;

    buttonsEl.innerHTML = btnsHtml;

    buttonsEl.querySelectorAll('.btn-page-num:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.currentTarget.dataset.page, 10);
        if (!isNaN(page)) {
          this.historyState.currentPage = page;
          this.renderHistoryTable();
        }
      });
    });
  },

  bindHistoryEvents() {
    const searchInput = document.getElementById('hist-search-input');
    const dateStart = document.getElementById('hist-date-start');
    const dateEnd = document.getElementById('hist-date-end');
    const filterPayment = document.getElementById('hist-filter-payment');
    const filterStatus = document.getElementById('hist-filter-status');
    const rowsPerPageSelect = document.getElementById('hist-rows-per-page');
    const resetBtn = document.getElementById('btn-reset-hist-filter');
    const exportBtn = document.getElementById('btn-export-excel');
    const exportAccBtn = document.getElementById('btn-export-accounting');

    searchInput?.addEventListener('input', (e) => {
      this.historyState.searchQuery = e.target.value;
      this.historyState.currentPage = 1;
      this.renderHistoryTable();
    });

    dateStart?.addEventListener('change', (e) => {
      this.historyState.startDate = e.target.value;
      this.historyState.currentPage = 1;
      this.renderHistoryTable();
    });

    dateEnd?.addEventListener('change', (e) => {
      this.historyState.endDate = e.target.value;
      this.historyState.currentPage = 1;
      this.renderHistoryTable();
    });

    filterPayment?.addEventListener('change', (e) => {
      this.historyState.paymentMethod = e.target.value;
      this.historyState.currentPage = 1;
      this.renderHistoryTable();
    });

    filterStatus?.addEventListener('change', (e) => {
      this.historyState.status = e.target.value;
      this.historyState.currentPage = 1;
      this.renderHistoryTable();
    });

    rowsPerPageSelect?.addEventListener('change', (e) => {
      this.historyState.rowsPerPage = e.target.value;
      this.historyState.currentPage = 1;
      this.renderHistoryTable();
    });

    resetBtn?.addEventListener('click', () => {
      this.historyState = {
        currentPage: 1,
        rowsPerPage: '20',
        searchQuery: '',
        startDate: '',
        endDate: '',
        paymentMethod: 'ALL',
        status: 'ALL',
        expandedTxIds: new Set()
      };
      if (searchInput) searchInput.value = '';
      if (dateStart) dateStart.value = '';
      if (dateEnd) dateEnd.value = '';
      if (filterPayment) filterPayment.value = 'ALL';
      if (filterStatus) filterStatus.value = 'ALL';
      if (rowsPerPageSelect) rowsPerPageSelect.value = '20';
      this.renderHistoryTable();
    });

    document.querySelectorAll('.btn-quick-date').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const range = e.currentTarget.dataset.range;
        const now = new Date();
        const formatYMD = (d) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };

        if (range === 'today') {
          const todayStr = formatYMD(now);
          this.historyState.startDate = todayStr;
          this.historyState.endDate = todayStr;
          if (dateStart) dateStart.value = todayStr;
          if (dateEnd) dateEnd.value = todayStr;
        } else if (range === 'month') {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const startStr = formatYMD(firstDay);
          const endStr = formatYMD(lastDay);
          this.historyState.startDate = startStr;
          this.historyState.endDate = endStr;
          if (dateStart) dateStart.value = startStr;
          if (dateEnd) dateEnd.value = endStr;
        } else if (range === 'all') {
          this.historyState.startDate = '';
          this.historyState.endDate = '';
          if (dateStart) dateStart.value = '';
          if (dateEnd) dateEnd.value = '';
        }
        this.historyState.currentPage = 1;
        this.renderHistoryTable();
      });
    });

    exportBtn?.addEventListener('click', () => {
      const filtered = this.getFilteredHistoryTransactions();
      if (filtered.length === 0) {
        alert("Tidak ada data transaksi yang cocok dengan filter untuk diekspor!");
        return;
      }

      let periodTitle = "Semua Periode";
      if (this.historyState.startDate && this.historyState.endDate) {
        if (this.historyState.startDate === this.historyState.endDate) {
          periodTitle = `Tanggal ${this.historyState.startDate}`;
        } else {
          periodTitle = `${this.historyState.startDate} s.d ${this.historyState.endDate}`;
        }
      } else if (this.historyState.startDate) {
        periodTitle = `Sejak ${this.historyState.startDate}`;
      } else if (this.historyState.endDate) {
        periodTitle = `Hingga ${this.historyState.endDate}`;
      }

      ExcelExport.exportToExcel(filtered, periodTitle, { mode: 'merged' });
    });

    exportAccBtn?.addEventListener('click', () => {
      const filtered = this.getFilteredHistoryTransactions();

      if (filtered.length === 0) {
        alert("Tidak ada data transaksi yang cocok dengan filter untuk diekspor!");
        return;
      }

      let periodTitle = "Semua Periode";
      if (this.historyState.startDate && this.historyState.endDate) {
        if (this.historyState.startDate === this.historyState.endDate) {
          periodTitle = `Tanggal ${this.historyState.startDate}`;
        } else {
          periodTitle = `${this.historyState.startDate} s.d ${this.historyState.endDate}`;
        }
      } else if (this.historyState.startDate) {
        periodTitle = `Sejak ${this.historyState.startDate}`;
      } else if (this.historyState.endDate) {
        periodTitle = `Hingga ${this.historyState.endDate}`;
      }

      ExcelExport.exportToExcel(filtered, periodTitle, { mode: 'accounting_only' });
    });

    // Event Delegation for dynamically rendered elements like btn-next-nota
    document.body.addEventListener('click', (e) => {
      // Find the closest button that might have the ID we want, in case a child element was clicked
      const targetBtn = e.target.closest('#btn-next-nota');
      if (targetBtn) {
        this.cancelEdit();
      }
    });
  }
};
