const Dashboard = {
  charts: {},

  init() {
    const btnRefresh = document.getElementById('btn-refresh-dashboard');
    const filterRange = document.getElementById('dash-filter-range');

    btnRefresh?.addEventListener('click', async () => {
      const origText = btnRefresh.innerText;
      btnRefresh.disabled = true;
      btnRefresh.innerText = '🔄 Menyinkronkan...';
      try {
        await DB.fetchSupabaseTransactions();
      } catch (e) {
        console.warn('Manual refresh sync note:', e);
      }
      this.renderDashboard();
      btnRefresh.innerText = origText;
      btnRefresh.disabled = false;
    });

    filterRange?.addEventListener('change', () => this.renderDashboard());

    // Listen to real-time transaction changes across application
    if (typeof window !== 'undefined') {
      window.addEventListener('amu-transactions-changed', () => {
        this.renderDashboard();
      });
    }
  },

  parseTxDate(dateStr) {
    if (!dateStr) return null;
    // Standard ISO/YYYY-MM-DD parse
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    // Handle DD/MM/YYYY format if present
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          d = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
        } else {
          d = new Date(parts[2], parseInt(parts[1], 10) - 1, parts[0]);
        }
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  },

  renderDashboard() {
    let allTx = DB.getTransactions() || [];
    allTx = allTx.filter(t => t.status !== 'VOID'); // Only active transactions

    const rangeSelect = document.getElementById('dash-filter-range');
    const rangeType = rangeSelect?.value || 'this_month';
    const filteredTx = this.filterByRange(allTx, rangeType);

    this.updateKPIs(filteredTx);
    this.renderTrendChart(filteredTx);
    this.renderPaymentChart(filteredTx);
    this.renderProductChart(filteredTx);
  },

  filterByRange(transactions, rangeType) {
    if (rangeType === 'all') return transactions;

    const now = new Date();
    let startDate, endDate;

    if (rangeType === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (rangeType === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (rangeType === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    return transactions.filter(t => {
      const txDate = this.parseTxDate(t.transactionDate) || this.parseTxDate(t.createdAt);
      if (!txDate) return true;
      return txDate >= startDate && txDate <= endDate;
    });
  },

  formatRp(num) {
    return 'Rp ' + (num || 0).toLocaleString('id-ID');
  },

  updateKPIs(transactions) {
    let totalVoucher = 0;
    let totalAdmin = 0;
    let totalClearing = 0;

    transactions.forEach(tx => {
      totalClearing += Number(tx.clearingFee) || 0;
      if (tx.items && Array.isArray(tx.items)) {
        tx.items.forEach(item => {
          totalVoucher += Number(item.itemSubtotal) || 0;
          totalAdmin += Number(item.adminSubtotal) || (Number(item.quantity) * 500);
        });
      }
    });

    const netIncome = (totalVoucher + totalAdmin) - totalClearing;

    const elVoucher = document.getElementById('dash-kpi-voucher');
    const elAdmin = document.getElementById('dash-kpi-admin');
    const elNet = document.getElementById('dash-kpi-net');

    if (elVoucher) elVoucher.innerText = this.formatRp(totalVoucher);
    if (elAdmin) elAdmin.innerText = this.formatRp(totalAdmin);
    if (elNet) elNet.innerText = this.formatRp(netIncome);
  },

  destroyChart(chartId) {
    if (this.charts[chartId]) {
      this.charts[chartId].destroy();
      delete this.charts[chartId];
    }
  },

  renderTrendChart(transactions) {
    this.destroyChart('chart-trend');
    
    // Group totals by Date
    const dailyData = {};
    transactions.forEach(tx => {
      const dStr = tx.transactionDate || 'Tanpa Tanggal';
      if (!dailyData[dStr]) dailyData[dStr] = 0;
      
      let txTotal = 0;
      if (tx.items) {
        tx.items.forEach(item => {
          txTotal += Number(item.itemSubtotal) || 0;
          txTotal += Number(item.adminSubtotal) || (Number(item.quantity) * 500);
        });
      }
      txTotal -= Number(tx.clearingFee) || 0;
      dailyData[dStr] += txTotal;
    });

    // Sort dates chronologically
    const sortedDates = Object.keys(dailyData).sort();
    const dataPoints = sortedDates.map(d => dailyData[d]);

    const canvas = document.getElementById('chart-trend');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    this.charts['chart-trend'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedDates.length > 0 ? sortedDates : ['Tidak Ada Data'],
        datasets: [{
          label: 'Laba Bersih Harian (Rp)',
          data: dataPoints.length > 0 ? dataPoints : [0],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#1d4ed8'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  },

  renderPaymentChart(transactions) {
    this.destroyChart('chart-payment');
    
    let tunai = 0;
    let transfer = 0;

    transactions.forEach(tx => {
      const methodV = (tx.paymentVoucher || 'Tunai').toLowerCase();
      const methodA = (tx.paymentAdmin || 'Tunai').toLowerCase();
      
      let vTotal = 0;
      let aTotal = 0;

      if (tx.items) {
        tx.items.forEach(item => {
          vTotal += Number(item.itemSubtotal) || 0;
          aTotal += Number(item.adminSubtotal) || (Number(item.quantity) * 500);
        });
      }

      if (methodV.includes('transfer') || methodV.includes('bank')) {
        transfer += vTotal;
      } else {
        tunai += vTotal;
      }

      if (methodA.includes('transfer') || methodA.includes('bank')) {
        transfer += aTotal;
      } else {
        tunai += aTotal;
      }
    });

    const canvas = document.getElementById('chart-payment');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    this.charts['chart-payment'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Kas Tunai', 'Transfer Bank'],
        datasets: [{
          data: (tunai === 0 && transfer === 0) ? [1, 0] : [tunai, transfer],
          backgroundColor: ['#10b981', '#f59e0b'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  },

  renderProductChart(transactions) {
    this.destroyChart('chart-product');
    
    const productCounts = {};

    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const code = (item.voucherCode || 'MANUAL').toUpperCase();
          const qty = Number(item.quantity) || 0;
          if (!productCounts[code]) productCounts[code] = 0;
          productCounts[code] += qty;
        });
      }
    });

    const sortedProducts = Object.keys(productCounts).sort((a, b) => productCounts[b] - productCounts[a]);
    const labels = sortedProducts.length > 0 ? sortedProducts : ['Tidak Ada Data'];
    const dataPoints = sortedProducts.length > 0 ? sortedProducts.map(k => productCounts[k]) : [0];

    const canvas = document.getElementById('chart-product');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    this.charts['chart-product'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Lembar Terjual',
          data: dataPoints,
          backgroundColor: '#8b5cf6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
};
