/**
 * Excel-Export.js - Multi-Sheet Excel Spreadsheet Generator (.xlsx / XML)
 * PT. Arba Mitra Usaha Gorontalo (SPBU 74-961-4)
 */


function escapeXML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const ExcelExport = {
  /**
   * Helper to parse date string into { dateFormatted, monthName, yearStr }
   */
  parseDateFields(dateStr) {
    if (!dateStr) return { dateFormatted: '-', monthName: '-', yearStr: '-' };
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    // YYYY-MM-DD
    const parts = dateStr.split('-');
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
    
    // DD/MM/YYYY
    const partsSlash = dateStr.split('/');
    if (partsSlash.length === 3 && partsSlash[2].length === 4) {
      const dayStr = partsSlash[0].padStart(2, '0');
      const mIdx = parseInt(partsSlash[1], 10) - 1;
      const yearStr = partsSlash[2];
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

    return { dateFormatted: dateStr, monthName: '-', yearStr: '-' };
  },

  /**
   * Helper to format voucher denomination label (e.g. "Voucher 100k", "Voucher Manual (15k)")
   */
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

  /**
   * Export all filtered transactions to a Multi-Sheet Excel Workbook
   */
  exportToExcel(transactions, periodTitle = "Semua Periode", options = { mode: 'merged' }) {
    if (!transactions || transactions.length === 0) {
      alert("Tidak ada data transaksi untuk diekspor!");
      return;
    }

    const activeTx = transactions
      .filter(t => t.status !== 'VOID')
      .sort((a, b) => {
        const numA = parseInt(a.notaNumber, 10) || 0;
        const numB = parseInt(b.notaNumber, 10) || 0;
        if (numA !== numB) return numA - numB;
        return String(a.notaNumber || '').localeCompare(String(b.notaNumber || ''));
      });

    const allRows = [];
    const sheetsMap = {
      "V25": [],
      "V50": [],
      "V100": [],
      "V200": [],
      "V300": [],
      "MANUAL": []
    };

    activeTx.forEach(tx => {
      const dateInfo = this.parseDateFields(tx.transactionDate);
      const pVoucher = tx.paymentVoucher || tx.payment_voucher || 'Tunai';
      const pAdmin = tx.paymentAdmin || tx.payment_admin || 'Tunai';
      const officer = tx.officerName || 'Saipul Karim Suleman';

      if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
        tx.items.forEach((item, idx) => {
          const code = (item.voucherCode || '').toUpperCase();
          const targetKey = sheetsMap[code] ? code : 'MANUAL';
          
          const itemAdmin = Number(item.adminSubtotal) || (Number(item.quantity) * 500);
          const itemClearing = (idx === 0) ? (Number(tx.clearingFee) || 0) : 0;
          const itemSubtotal = Number(item.itemSubtotal) || 0;
          const itemTotal = itemSubtotal + itemAdmin + itemClearing;

          const rowData = {
            notaNumber: tx.notaNumber,
            dateFormatted: dateInfo.dateFormatted,
            monthName: dateInfo.monthName,
            yearStr: dateInfo.yearStr,
            customerName: tx.customerName || '',
            voucherLabel: this.getVoucherLabel(item),
            startSerial: item.startSerial || '',
            endSerial: item.endSerial || '',
            sheets: Number(item.quantity) || 0,
            subtotalNominal: itemSubtotal,
            paymentVoucher: pVoucher,
            adminFee: itemAdmin,
            paymentAdmin: pAdmin,
            clearingFee: itemClearing,
            totalAmount: itemTotal,
            officerName: officer
          };

          allRows.push(rowData);
          sheetsMap[targetKey].push(rowData);
        });
      }
    });

    // Sort comparator: 1st by Nota Number (asc), 2nd by Start Serial (khusus)
    const sortRows = (a, b) => {
      const notaA = parseInt(a.notaNumber, 10) || 0;
      const notaB = parseInt(b.notaNumber, 10) || 0;
      if (notaA !== notaB) return notaA - notaB;

      const serialA = parseInt(String(a.startSerial).replace(/\D/g, ''), 10) || 0;
      const serialB = parseInt(String(b.startSerial).replace(/\D/g, ''), 10) || 0;
      
      // Kasus khusus: Seri lama yang mendekati 100000 (misal > 99000) diprioritaskan di atas (Group 0)
      // Seri baru (misal 95000) masuk di bawahnya (Group 1)
      const groupA = (serialA >= 99000 && serialA <= 100000) ? 0 : 1;
      const groupB = (serialB >= 99000 && serialB <= 100000) ? 0 : 1;
      
      if (groupA !== groupB) {
        return groupA - groupB;
      }
      
      // Jika di kelompok yang sama, urutkan dari kecil ke besar (ascending) normal
      return serialA - serialB;
    };

    allRows.sort(sortRows);
    Object.keys(sheetsMap).forEach(k => sheetsMap[k].sort(sortRows));

    // Build Excel XML Workbook String
    const xmlWorkbook = this.buildXmlSpreadsheet(allRows, sheetsMap, periodTitle, options.mode);
    
    // Create download blob
    const blob = new Blob([xmlWorkbook], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let fileName = `Laporan_Voucher_AMU_${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xls`;
    if (options.mode === 'accounting_only') {
      fileName = `Jurnal_Akuntansi_AMU_${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xls`;
    }
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  buildXmlSpreadsheet(allRows, sheetsMap, periodTitle, mode = 'merged') {
    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#E2231A"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#E2231A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
  </Style>
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CellRight">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Currency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="&#34;Rp&#34;#,##0"/>
  </Style>
  <Style ss:ID="Total">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TotalRight">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TotalCurrency">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="&#34;Rp&#34;#,##0"/>
  </Style>
 </Styles>
`;

    if (mode === 'accounting_only') {
      xml += this.buildIncomeStatementWorksheet("Laporan Laba Rugi", allRows, periodTitle);
      xml += this.buildCashFlowWorksheet("Rekapitulasi Arus Kas", allRows, periodTitle);
      xml += this.buildTrialBalanceWorksheet("Neraca Saldo", allRows, periodTitle);
      xml += this.buildGeneralLedgerWorksheet("Buku Besar", allRows, periodTitle);
      xml += this.buildJournalWorksheet("Jurnal Umum", allRows, periodTitle);
      xml += this.buildAuditWorksheet("Audit Gap Serial", allRows, periodTitle);
    } else {
      // 1. Sheet REKAPITULASI TOTAL
      xml += this.buildTableWorksheet("REKAPITULASI TOTAL", allRows, periodTitle);
      // 2. Sheet Voucher 25k
      xml += this.buildTableWorksheet("Voucher 25k", sheetsMap["V25"], "Pecahan 25.000");
      // 3. Sheet Voucher 50k
      xml += this.buildTableWorksheet("Voucher 50k", sheetsMap["V50"], "Pecahan 50.000");
      // 4. Sheet Voucher 100k
      xml += this.buildTableWorksheet("Voucher 100k", sheetsMap["V100"], "Pecahan 100.000");
      // 5. Sheet Voucher 200k
      xml += this.buildTableWorksheet("Voucher 200k", sheetsMap["V200"], "Pecahan 200.000");
      // 6. Sheet Voucher 300k
      xml += this.buildTableWorksheet("Voucher 300k", sheetsMap["V300"], "Pecahan 300.000");
      // 7. Sheet Voucher Manual
      xml += this.buildTableWorksheet("Voucher Manual", sheetsMap["MANUAL"], "Voucher Manual");
      
      // Tambahkan sheet akuntansi juga di mode merged
      xml += this.buildIncomeStatementWorksheet("Laporan Laba Rugi", allRows, periodTitle);
      xml += this.buildCashFlowWorksheet("Rekapitulasi Arus Kas", allRows, periodTitle);
      xml += this.buildTrialBalanceWorksheet("Neraca Saldo", allRows, periodTitle);
      xml += this.buildGeneralLedgerWorksheet("Buku Besar", allRows, periodTitle);
      xml += this.buildJournalWorksheet("Jurnal Umum", allRows, periodTitle);
      xml += this.buildAuditWorksheet("Audit Gap Serial", allRows, periodTitle);
    }

    xml += `</Workbook>`;
    return xml;
  },

  buildTableWorksheet(sheetName, rows, titleSuffix = "") {
    let ws = ` <Worksheet ss:Name="${sheetName}">
  <Table>
   <!-- Column Widths A-Q -->
   <Column ss:Width="40"/>  <!-- A: No -->
   <Column ss:Width="65"/>  <!-- B: No. Nota -->
   <Column ss:Width="85"/>  <!-- C: Tanggal -->
   <Column ss:Width="65"/>  <!-- D: Bulan -->
   <Column ss:Width="55"/>  <!-- E: Tahun -->
   <Column ss:Width="160"/> <!-- F: Nama Instansi -->
   <Column ss:Width="110"/> <!-- G: Pecahan -->
   <Column ss:Width="80"/>  <!-- H: Seri Awal -->
   <Column ss:Width="80"/>  <!-- I: Seri Akhir -->
   <Column ss:Width="60"/>  <!-- J: Lembar -->
   <Column ss:Width="110"/> <!-- K: Subtotal Nominal -->
   <Column ss:Width="100"/> <!-- L: Metode Pembayaran Voucher -->
   <Column ss:Width="90"/>  <!-- M: Admin -->
   <Column ss:Width="100"/> <!-- N: Metode Pembayaran Admin -->
   <Column ss:Width="90"/>  <!-- O: Biaya Clearing -->
   <Column ss:Width="110"/> <!-- P: Total -->
   <Column ss:Width="140"/> <!-- Q: Petugas / TTD -->

   <!-- Header Row (Red, White Bold Text) -->
   <Row ss:Height="28">
    <Cell ss:StyleID="Header"><Data ss:Type="String">No.</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">No. Nota</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tanggal</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Bulan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tahun</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Instansi</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Pecahan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Seri Awal</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Seri Akhir</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Lembar</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Subtotal Nominal</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Metode Pembayaran Voucher</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Admin</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Metode Pembayaran Admin</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Biaya Clearing</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Petugas / TTD</Data></Cell>
   </Row>
`;

    let totalSheets = 0;
    let totalSubtotalNominal = 0;
    let totalAdmin = 0;
    let totalClearing = 0;
    let grandTotal = 0;

    (rows || []).forEach((r, idx) => {
      totalSheets += Number(r.sheets) || 0;
      totalSubtotalNominal += Number(r.subtotalNominal) || 0;
      totalAdmin += Number(r.adminFee) || 0;
      totalClearing += Number(r.clearingFee) || 0;
      grandTotal += Number(r.totalAmount) || 0;

      ws += `   <Row ss:Height="20">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.notaNumber)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.dateFormatted)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.monthName)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${r.yearStr}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXML(r.customerName)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.voucherLabel)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.startSerial)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.endSerial)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${r.sheets}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${r.subtotalNominal}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.paymentVoucher)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${r.adminFee}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.paymentAdmin)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${r.clearingFee}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${r.totalAmount}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXML(r.officerName)}</Data></Cell>
   </Row>
`;
    });

    // Summary Total Row
    ws += `   <Row ss:Height="24">
    <Cell ss:MergeAcross="8" ss:StyleID="Total"><Data ss:Type="String">TOTAL KESELURUHAN</Data></Cell>
    <Cell ss:StyleID="TotalRight"><Data ss:Type="Number">${totalSheets}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalSubtotalNominal}</Data></Cell>
    <Cell ss:StyleID="Total"></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalAdmin}</Data></Cell>
    <Cell ss:StyleID="Total"></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalClearing}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${grandTotal}</Data></Cell>
    <Cell ss:StyleID="Total"></Cell>
   </Row>
  </Table>
 </Worksheet>
`;
    return ws;
  },

  buildIncomeStatementWorksheet(sheetName, rows, titleSuffix) {
    let ws = ` <Worksheet ss:Name="${sheetName}">
  <Table>
   <Column ss:Width="250"/>
   <Column ss:Width="150"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="1" ss:StyleID="Title"><Data ss:Type="String">LAPORAN LABA RUGI - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Keterangan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Nominal (Rp)</Data></Cell>
   </Row>`;

    let totalPendapatanVoucher = 0;
    let totalPendapatanAdmin = 0;
    let totalBebanClearing = 0;

    rows.forEach(r => {
      totalPendapatanVoucher += (r.subtotalNominal || 0);
      totalPendapatanAdmin += (r.adminFee || 0);
      totalBebanClearing += (r.clearingFee || 0);
    });

    const totalPendapatan = totalPendapatanVoucher + totalPendapatanAdmin;
    const labaBersih = totalPendapatan - totalBebanClearing;

    ws += `
   <!-- Pendapatan -->
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">PENDAPATAN</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">  Pendapatan Pokok Penjualan Voucher</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${totalPendapatanVoucher}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">  Pendapatan Jasa Admin</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${totalPendapatanAdmin}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">Total Pendapatan</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalPendapatan}</Data></Cell>
   </Row>
   
   <!-- Beban -->
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">BEBAN (PENGELUARAN)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">  Beban Administrasi Bank / Clearing</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${totalBebanClearing}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">Total Beban</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalBebanClearing}</Data></Cell>
   </Row>
   
   <!-- Laba Bersih -->
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Total"><Data ss:Type="String">LABA BERSIH</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${labaBersih}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;
    return ws;
  },

  buildCashFlowWorksheet(sheetName, rows, titleSuffix) {
    let ws = ` <Worksheet ss:Name="${sheetName}">
  <Table>
   <Column ss:Width="250"/>
   <Column ss:Width="150"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="1" ss:StyleID="Title"><Data ss:Type="String">REKAPITULASI ARUS KAS - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Metode Pembayaran</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total Penerimaan (Rp)</Data></Cell>
   </Row>`;

    let kasTunai = 0;
    let bankTransfer = 0;

    rows.forEach(r => {
      const method = (r.paymentVoucher || 'Tunai').toLowerCase();
      const penerimaanBersih = (r.subtotalNominal || 0) + (r.adminFee || 0) - (r.clearingFee || 0);

      if (method.includes('transfer') || method.includes('bank')) {
        bankTransfer += penerimaanBersih;
      } else {
        kasTunai += penerimaanBersih;
      }
    });

    const totalKas = kasTunai + bankTransfer;

    ws += `
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">Kas Tunai</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${kasTunai}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">Transfer Bank</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${bankTransfer}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Total"><Data ss:Type="String">TOTAL SALDO KAS & BANK</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalKas}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;
    return ws;
  },

  buildJournalWorksheet(sheetName, rows, titleSuffix) {
    let ws = ` <Worksheet ss:Name="${sheetName}">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="80"/>
   <Column ss:Width="250"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="5" ss:StyleID="Title"><Data ss:Type="String">JURNAL UMUM - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tanggal</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">No. Bukti / Nota</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Kode Akun</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Akun</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Debit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Kredit</Data></Cell>
   </Row>`;

    // Group rows by transaction (notaNumber + date)
    const txGroups = {};
    rows.forEach(r => {
      const key = `${r.dateFormatted}_${r.notaNumber}`;
      if (!txGroups[key]) txGroups[key] = { date: r.dateFormatted, nota: r.notaNumber, items: [] };
      txGroups[key].items.push(r);
    });

    let totalDebit = 0;
    let totalKredit = 0;

    for (const group of Object.values(txGroups)) {
      let debitKas = 0;
      let kreditVoucher = 0;
      let kreditAdmin = 0;
      let debitClearing = 0;
      
      let pVoucher = '';

      group.items.forEach(r => {
        kreditVoucher += r.subtotalNominal;
        kreditAdmin += r.adminFee;
        debitClearing += r.clearingFee;
        pVoucher = r.paymentVoucher || 'Tunai';
      });

      debitKas = (kreditVoucher + kreditAdmin) - debitClearing;
      let isTransfer = pVoucher.toLowerCase().includes('transfer') || pVoucher.toLowerCase().includes('bank');
      let namaKas = isTransfer ? 'Kas di Bank' : 'Kas di Tangan';
      let kodeKas = isTransfer ? '1120' : '1110';

      // Baris Debit Kas
      ws += `
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${group.date}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${group.nota}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${kodeKas}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${namaKas}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${debitKas}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">0</Data></Cell>
   </Row>`;
      totalDebit += debitKas;

      if (debitClearing > 0) {
        ws += `
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">5110</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">Beban Administrasi Bank / Clearing</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${debitClearing}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">0</Data></Cell>
   </Row>`;
        totalDebit += debitClearing;
      }

      if (kreditVoucher > 0) {
        ws += `
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">4110</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">  Pendapatan Penjualan Voucher</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${kreditVoucher}</Data></Cell>
   </Row>`;
        totalKredit += kreditVoucher;
      }

      if (kreditAdmin > 0) {
        ws += `
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">4120</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">  Pendapatan Jasa Admin</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${kreditAdmin}</Data></Cell>
   </Row>`;
        totalKredit += kreditAdmin;
      }
    }

    ws += `
   <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="Total"><Data ss:Type="String">TOTAL KESELURUHAN</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalDebit}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalKredit}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;
    return ws;
  },
  buildGeneralLedgerWorksheet(sheetName, rows, titleSuffix) {
    let ws = ` <Worksheet ss:Name="${sheetName}">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="250"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="5" ss:StyleID="Title"><Data ss:Type="String">BUKU BESAR (GENERAL LEDGER) - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tanggal</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">No. Bukti / Nota</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Keterangan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Debit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Kredit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Saldo</Data></Cell>
   </Row>`;

    const accounts = {
      '1110': { name: 'Kas di Tangan', items: [] },
      '1120': { name: 'Kas di Bank', items: [] },
      '4110': { name: 'Pendapatan Penjualan Voucher', items: [] },
      '4120': { name: 'Pendapatan Jasa Admin', items: [] },
      '5110': { name: 'Beban Administrasi Bank / Clearing', items: [] }
    };

    rows.forEach(r => {
      const isTransfer = (r.paymentVoucher || 'Tunai').toLowerCase().includes('transfer') || (r.paymentVoucher || 'Tunai').toLowerCase().includes('bank');
      const kodeKas = isTransfer ? '1120' : '1110';
      const debitKas = (r.subtotalNominal || 0) + (r.adminFee || 0) - (r.clearingFee || 0);
      
      if (debitKas !== 0) {
        accounts[kodeKas].items.push({ date: r.dateFormatted, nota: r.notaNumber, desc: 'Penerimaan Penjualan', debit: debitKas, kredit: 0 });
      }
      if (r.clearingFee > 0) {
        accounts['5110'].items.push({ date: r.dateFormatted, nota: r.notaNumber, desc: 'Beban Clearing', debit: r.clearingFee, kredit: 0 });
      }
      if (r.subtotalNominal > 0) {
        accounts['4110'].items.push({ date: r.dateFormatted, nota: r.notaNumber, desc: 'Penjualan Voucher', debit: 0, kredit: r.subtotalNominal });
      }
      if (r.adminFee > 0) {
        accounts['4120'].items.push({ date: r.dateFormatted, nota: r.notaNumber, desc: 'Jasa Admin', debit: 0, kredit: r.adminFee });
      }
    });

    for (const [kode, acc] of Object.entries(accounts)) {
      if (acc.items.length === 0) continue;
      
      ws += `
   <Row ss:Height="22">
    <Cell ss:MergeAcross="5" ss:StyleID="Header"><Data ss:Type="String">Akun: ${kode} - ${acc.name}</Data></Cell>
   </Row>`;

      let saldo = 0;
      let isDebitNormal = kode.startsWith('1') || kode.startsWith('5');

      acc.items.forEach(item => {
        if (isDebitNormal) {
          saldo += (item.debit - item.kredit);
        } else {
          saldo += (item.kredit - item.debit);
        }
        
        ws += `
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${item.date}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${item.nota}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${item.desc}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.debit}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.kredit}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${saldo}</Data></Cell>
   </Row>`;
      });

      ws += `
   <Row>
    <Cell ss:MergeAcross="4" ss:StyleID="TotalRight"><Data ss:Type="String">Saldo Akhir ${acc.name}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${saldo}</Data></Cell>
   </Row>
   <Row></Row>`;
    }

    ws += `
  </Table>
 </Worksheet>`;
    return ws;
  },

  buildTrialBalanceWorksheet(sheetName, rows, titleSuffix) {
    let ws = ` <Worksheet ss:Name="${sheetName}">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="250"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="3" ss:StyleID="Title"><Data ss:Type="String">NERACA SALDO (TRIAL BALANCE) - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Kode Akun</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Akun</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Debit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Kredit</Data></Cell>
   </Row>`;

    const balances = {
      '1110': { name: 'Kas di Tangan', debit: 0, kredit: 0 },
      '1120': { name: 'Kas di Bank', debit: 0, kredit: 0 },
      '4110': { name: 'Pendapatan Penjualan Voucher', debit: 0, kredit: 0 },
      '4120': { name: 'Pendapatan Jasa Admin', debit: 0, kredit: 0 },
      '5110': { name: 'Beban Administrasi Bank / Clearing', debit: 0, kredit: 0 }
    };

    rows.forEach(r => {
      const isTransfer = (r.paymentVoucher || 'Tunai').toLowerCase().includes('transfer') || (r.paymentVoucher || 'Tunai').toLowerCase().includes('bank');
      const kodeKas = isTransfer ? '1120' : '1110';
      const debitKas = (r.subtotalNominal || 0) + (r.adminFee || 0) - (r.clearingFee || 0);
      
      balances[kodeKas].debit += debitKas;
      balances['5110'].debit += (r.clearingFee || 0);
      balances['4110'].kredit += (r.subtotalNominal || 0);
      balances['4120'].kredit += (r.adminFee || 0);
    });

    let totalDebit = 0;
    let totalKredit = 0;

    for (const [kode, acc] of Object.entries(balances)) {
      if (acc.debit === 0 && acc.kredit === 0) continue;
      
      let saldoDebit = 0;
      let saldoKredit = 0;
      
      let isDebitNormal = kode.startsWith('1') || kode.startsWith('5');
      if (isDebitNormal) {
        saldoDebit = acc.debit - acc.kredit;
      } else {
        saldoKredit = acc.kredit - acc.debit;
      }

      totalDebit += saldoDebit;
      totalKredit += saldoKredit;

      ws += `
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${kode}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${acc.name}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${saldoDebit}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${saldoKredit}</Data></Cell>
   </Row>`;
    }

    ws += `
   <Row>
    <Cell ss:MergeAcross="1" ss:StyleID="Total"><Data ss:Type="String">TOTAL KESEIMBANGAN (BALANCE)</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalDebit}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalKredit}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;
    return ws;
  },

  buildAuditWorksheet(sheetName, rows, titleSuffix) {
    let ws = ` <Worksheet ss:Name="${sheetName}">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="250"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="3" ss:StyleID="Title"><Data ss:Type="String">AUDIT GAP SERIAL VOUCHER - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Bulan/Tahun</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">No Seri Bolong</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Pecahan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Keterangan</Data></Cell>
   </Row>`;

    // Untuk Audit Gap Serial, kita kumpulkan semua serial yang terjual per pecahan
    const serialsPerCode = {};
    
    rows.forEach(r => {
      if (!r.startSerial || !r.endSerial) return;
      const startNum = parseInt(String(r.startSerial).replace(/\D/g, ''), 10);
      const endNum = parseInt(String(r.endSerial).replace(/\D/g, ''), 10);
      const prefix = String(r.startSerial).replace(/\d/g, '');
      
      const code = r.voucherLabel; // e.g. "Voucher 25k"
      if (!startNum || !endNum) return;
      
      if (!serialsPerCode[code]) serialsPerCode[code] = [];
      
      for(let i = startNum; i <= endNum; i++) {
        serialsPerCode[code].push({ num: i, prefix, date: r.monthName + ' ' + r.yearStr });
      }
    });

    let hasGap = false;
    for (const [code, list] of Object.entries(serialsPerCode)) {
      // Sort by number
      list.sort((a,b) => a.num - b.num);
      
      for(let i = 0; i < list.length - 1; i++) {
        const current = list[i];
        const next = list[i+1];
        if (next.num > current.num + 1) {
           hasGap = true;
           // Found a gap
           const gapStart = current.num + 1;
           const gapEnd = next.num - 1;
           const gapDesc = gapStart === gapEnd ? `${current.prefix}${gapStart}` : `${current.prefix}${gapStart} s/d ${current.prefix}${gapEnd}`;
           const count = gapEnd - gapStart + 1;
           ws += `
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${current.date}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${gapDesc}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${code}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">Indikasi bolong ${count} lembar</Data></Cell>
   </Row>`;
        }
      }
    }

    if (!hasGap) {
       ws += `
   <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="CellCenter"><Data ss:Type="String">Tidak ditemukan gap serial (semua nomor urut berkesinambungan)</Data></Cell>
   </Row>`;
    }

    ws += `
  </Table>
 </Worksheet>`;
    return ws;
  }

};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExcelExport;
}

