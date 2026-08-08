const Dashboard = {
  charts: {},

  init() {
    const btnRefresh = document.getElementById('btn-refresh-dashboard');
    const filterRange = document.getElementById('dash-filter-range');

    btnRefresh?.addEventListener('click', () => this.renderDashboard());
    filterRange?.addEventListener('change', () => this.renderDashboard());
  },

  renderDashboard() {
    let allTx = DB.getTransactions() || [];
    allTx = allTx.filter(t => t.status !== 'VOID'); // Only active transactions

    const rangeType = document.getElementById('dash-filter-range')?.value || 'this_month';
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
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (rangeType === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (rangeType === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    return transactions.filter(t => {
      const txDate = new Date(t.transactionDate || t.createdAt);
      if (isNaN(txDate)) return true;
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

    document.getElementById('dash-kpi-voucher').innerText = this.formatRp(totalVoucher);
    document.getElementById('dash-kpi-admin').innerText = this.formatRp(totalAdmin);
    document.getElementById('dash-kpi-net').innerText = this.formatRp(netIncome);
  },

  destroyChart(chartId) {
    if (this.charts[chartId]) {
      this.charts[chartId].destroy();
    }
  },

  renderTrendChart(transactions) {
    this.destroyChart('chart-trend');
    
    // Group by Date
    const dailyData = {};
    transactions.forEach(tx => {
      const dStr = tx.transactionDate || 'Unknown';
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

    // Sort by Date
    const sortedDates = Object.keys(dailyData).sort();
    const dataPoints = sortedDates.map(d => dailyData[d]);

    const ctx = document.getElementById('chart-trend')?.getContext('2d');
    if (!ctx) return;

    this.charts['chart-trend'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedDates,
        datasets: [{
          label: 'Laba Bersih Harian (Rp)',
          data: dataPoints,
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
      const method = (tx.paymentVoucher || 'Tunai').toLowerCase();
      let txTotal = 0;
      if (tx.items) {
        tx.items.forEach(item => {
          txTotal += Number(item.itemSubtotal) || 0;
          txTotal += Number(item.adminSubtotal) || (Number(item.quantity) * 500);
        });
      }
      
      if (method.includes('transfer') || method.includes('bank')) {
        transfer += txTotal;
      } else {
        tunai += txTotal;
      }
    });

    const ctx = document.getElementById('chart-payment')?.getContext('2d');
    if (!ctx) return;

    this.charts['chart-payment'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Kas Tunai', 'Transfer Bank'],
        datasets: [{
          data: [tunai, transfer],
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

    const labels = Object.keys(productCounts);
    const dataPoints = Object.values(productCounts);

    const ctx = document.getElementById('chart-product')?.getContext('2d');
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
