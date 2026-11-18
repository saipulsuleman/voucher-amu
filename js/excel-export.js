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
          const itemTotal = itemSubtotal + itemAdmin; // Clean row calculation without transaction-level clearing pollution

          const expInfo = (typeof DB !== 'undefined' && DB.calculateExpiryDate) ? DB.calculateExpiryDate(tx.transactionDate, item.voucherCode) : { dateFormatted: '-', status: 'AKTIF' };

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
            officerName: officer,
            expiryDateFormatted: expInfo.dateFormatted,
            expiryStatus: expInfo.status
          };

          allRows.push(rowData);
          sheetsMap[targetKey].push(rowData);
        });
      }
    });

    // Helper menentukan kelompok cetakan/batch untuk memastikan kontinuitas nomor urut seri
    const getBatchGroup = (row) => {
      const code = String(row.voucherCode || row.voucher_code || row.voucherLabel || '').toUpperCase();
      const startNum = parseInt(String(row.startSerial || row.start_serial || '').replace(/\D/g, ''), 10) || 0;
      const endNum = parseInt(String(row.endSerial || row.end_serial || '').replace(/\D/g, ''), 10) || 0;
      const maxSerial = Math.max(startNum, endNum);

      // V25: Batch 0 (seri lama 99000-100000), Batch 1 (seri baru < 99000)
      if (code === 'V25' || code.includes('25')) {
        return (maxSerial >= 99000 && maxSerial <= 100000) ? 0 : 1;
      }
      // V50: Batch 0 (seri lama mendekati 150000: >= 140000 & <= 150000), Batch 1 (seri baru < 140000)
      if (code === 'V50' || code.includes('50')) {
        return (maxSerial >= 140000 && maxSerial <= 150000) ? 0 : 1;
      }
      return 0;
    };

    // Sort comparator for REKAPITULASI TOTAL: 1st by Nota Number (asc), 2nd by Start Serial (khusus)
    const sortRowsByNota = (a, b) => {
      const notaA = parseInt(a.notaNumber || a.nota_number, 10) || 0;
      const notaB = parseInt(b.notaNumber || b.nota_number, 10) || 0;
      if (notaA !== notaB) return notaA - notaB;

      const groupA = getBatchGroup(a);
      const groupB = getBatchGroup(b);
      if (groupA !== groupB) return groupA - groupB;

      const serialA = parseInt(String(a.startSerial || a.start_serial || '').replace(/\D/g, ''), 10) || 0;
      const serialB = parseInt(String(b.startSerial || b.start_serial || '').replace(/\D/g, ''), 10) || 0;
      return serialA - serialB;
    };

    // Sort comparator for Denomination Sheets: 1st by Batch Group, 2nd by Start Serial (continuous sequential order guarantee), 3rd by Nota
    const sortRowsBySerial = (a, b) => {
      const groupA = getBatchGroup(a);
      const groupB = getBatchGroup(b);
      if (groupA !== groupB) return groupA - groupB;

      const serialA = parseInt(String(a.startSerial || a.start_serial || '').replace(/\D/g, ''), 10) || 0;
      const serialB = parseInt(String(b.startSerial || b.start_serial || '').replace(/\D/g, ''), 10) || 0;
      if (serialA !== serialB) return serialA - serialB;

      const notaA = parseInt(a.notaNumber || a.nota_number, 10) || 0;
      const notaB = parseInt(b.notaNumber || b.nota_number, 10) || 0;
      return notaA - notaB;
    };

    allRows.sort(sortRowsByNota);
    Object.keys(sheetsMap).forEach(k => {
      if (k === "REKAPITULASI TOTAL") {
        sheetsMap[k].sort(sortRowsByNota);
      } else {
        sheetsMap[k].sort(sortRowsBySerial);
      }
    });

    // Native .xlsx Export via SheetJS (if available)
    if (typeof XLSX !== 'undefined') {
      this.exportToXLSXNative(allRows, sheetsMap, periodTitle, options);
      return;
    }

    // Fallback: Build Excel XML Workbook String (.xls)
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
  <Style ss:ID="KopCompany">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#E2231A"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="KopTitle">
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#1E293B"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="KopSubTitle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
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
   <!-- Column Widths A-S (19 Columns) -->
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
   <Column ss:Width="105"/> <!-- R: Tgl Kadaluarsa -->
   <Column ss:Width="115"/> <!-- S: Status Kadaluarsa -->

   <!-- Kop Surat Perusahaan -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="18" ss:StyleID="KopCompany"><Data ss:Type="String">PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="18" ss:StyleID="KopTitle"><Data ss:Type="String">LAPORAN PENJUALAN VOUCHER - ${sheetName.toUpperCase()}${titleSuffix ? ' (' + titleSuffix + ')' : ''}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="18" ss:StyleID="KopSubTitle"><Data ss:Type="String">Sistem Otomasi Voucher &amp; Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}</Data></Cell>
   </Row>

   <!-- Baris Kosong (Skip 1 Row) -->
   <Row ss:Height="14"/>

   <!-- Header Row (Red, White Bold Text - 19 Columns) -->
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
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tgl Kadaluarsa</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status Kadaluarsa</Data></Cell>
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
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.expiryDateFormatted || '')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(r.expiryStatus || 'AKTIF')}</Data></Cell>
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
    <Cell ss:StyleID="Total"></Cell>
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
   <!-- Kop Surat Perusahaan -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="1" ss:StyleID="KopCompany"><Data ss:Type="String">PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="1" ss:StyleID="KopTitle"><Data ss:Type="String">LAPORAN LABA RUGI - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="1" ss:StyleID="KopSubTitle"><Data ss:Type="String">Sistem Otomasi Voucher &amp; Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}</Data></Cell>
   </Row>

   <!-- Baris Kosong (Skip 1 Row) -->
   <Row ss:Height="14"/>

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
   <!-- Kop Surat Perusahaan -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="1" ss:StyleID="KopCompany"><Data ss:Type="String">PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="1" ss:StyleID="KopTitle"><Data ss:Type="String">REKAPITULASI ARUS KAS - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="1" ss:StyleID="KopSubTitle"><Data ss:Type="String">Sistem Otomasi Voucher &amp; Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}</Data></Cell>
   </Row>

   <!-- Baris Kosong (Skip 1 Row) -->
   <Row ss:Height="14"/>

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
   <!-- Kop Surat Perusahaan -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="5" ss:StyleID="KopCompany"><Data ss:Type="String">PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="5" ss:StyleID="KopTitle"><Data ss:Type="String">JURNAL UMUM AKUNTANSI - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="5" ss:StyleID="KopSubTitle"><Data ss:Type="String">Sistem Otomasi Voucher &amp; Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}</Data></Cell>
   </Row>

   <!-- Baris Kosong (Skip 1 Row) -->
   <Row ss:Height="14"/>

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
   <!-- Kop Surat Perusahaan -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="5" ss:StyleID="KopCompany"><Data ss:Type="String">PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="5" ss:StyleID="KopTitle"><Data ss:Type="String">BUKU BESAR (GENERAL LEDGER) - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="5" ss:StyleID="KopSubTitle"><Data ss:Type="String">Sistem Otomasi Voucher &amp; Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}</Data></Cell>
   </Row>

   <!-- Baris Kosong (Skip 1 Row) -->
   <Row ss:Height="14"/>

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
   <!-- Kop Surat Perusahaan -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="3" ss:StyleID="KopCompany"><Data ss:Type="String">PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="3" ss:StyleID="KopTitle"><Data ss:Type="String">NERACA SALDO (TRIAL BALANCE) - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="3" ss:StyleID="KopSubTitle"><Data ss:Type="String">Sistem Otomasi Voucher &amp; Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}</Data></Cell>
   </Row>

   <!-- Baris Kosong (Skip 1 Row) -->
   <Row ss:Height="14"/>

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
   <!-- Kop Surat Perusahaan -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="3" ss:StyleID="KopCompany"><Data ss:Type="String">PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="3" ss:StyleID="KopTitle"><Data ss:Type="String">AUDIT GAP SERIAL VOUCHER - ${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="3" ss:StyleID="KopSubTitle"><Data ss:Type="String">Sistem Otomasi Voucher &amp; Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}</Data></Cell>
   </Row>

   <!-- Baris Kosong (Skip 1 Row) -->
   <Row ss:Height="14"/>

   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Bulan/Tahun</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">No Seri Bolong</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Pecahan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Keterangan</Data></Cell>
   </Row>`;

    // Untuk Audit Gap Serial, kita kumpulkan semua serial yang terjual per pecahan dan per kelompok cetakan (batch)
    const serialsPerCodeAndBatch = {};
    
    rows.forEach(r => {
      if (!r.startSerial || !r.endSerial) return;
      const startNum = parseInt(String(r.startSerial).replace(/\D/g, ''), 10);
      const endNum = parseInt(String(r.endSerial).replace(/\D/g, ''), 10);
      const prefix = String(r.startSerial).replace(/\d/g, '');
      
      const code = r.voucherLabel; // e.g. "Voucher 25k"
      if (!startNum || !endNum) return;
      
      // Tentukan kelompok cetakan (batch):
      // Batch 0: Cetakan lama mendekati rollover (V25 >= 99000, V50 >= 140000)
      // Batch 1: Cetakan baru hasil reset/pencetakan ulang
      let batchGroup = 0;
      if (code.includes('25')) {
        batchGroup = (startNum >= 99000 || endNum >= 99000) ? 0 : 1;
      } else if (code.includes('50')) {
        batchGroup = (startNum >= 140000 || endNum >= 140000) ? 0 : 1;
      }
      
      if (!serialsPerCodeAndBatch[code]) serialsPerCodeAndBatch[code] = {};
      if (!serialsPerCodeAndBatch[code][batchGroup]) serialsPerCodeAndBatch[code][batchGroup] = [];
      
      for(let i = startNum; i <= endNum; i++) {
        serialsPerCodeAndBatch[code][batchGroup].push({ num: i, prefix, date: r.monthName + ' ' + r.yearStr });
      }
    });

    let hasGap = false;
    for (const [code, batches] of Object.entries(serialsPerCodeAndBatch)) {
      for (const [batchId, list] of Object.entries(batches)) {
        // Sort by number within the same batch
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
  },

  exportToXLSXNative(allRows, sheetsMap, periodTitle, options = { mode: 'merged' }) {
    const wb = XLSX.utils.book_new();

    const makeTableSheet = (sheetName, rows, titleSuffix) => {
      const aoa = [
        ["PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)"],
        [`LAPORAN PENJUALAN VOUCHER - ${sheetName.toUpperCase()}${titleSuffix ? ' (' + titleSuffix + ')' : ''}`],
        [`Sistem Otomasi Voucher & Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}`],
        [],
        ["No.", "No. Nota", "Tanggal", "Bulan", "Tahun", "Nama Instansi", "Pecahan", "Seri Awal", "Seri Akhir", "Lembar", "Subtotal Nominal", "Metode Pembayaran Voucher", "Admin", "Metode Pembayaran Admin", "Biaya Clearing", "Total", "Petugas / TTD", "Tgl Kadaluarsa", "Status Kadaluarsa"]
      ];

      let tSheets = 0, tSubtotal = 0, tAdmin = 0, tClearing = 0, gTotal = 0;
      (rows || []).forEach((r, idx) => {
        const sheetsVal = Number(r.sheets) || 0;
        const subtotalVal = Number(r.subtotalNominal) || 0;
        const adminVal = Number(r.adminFee) || 0;
        const clearingVal = Number(r.clearingFee) || 0;
        const totalVal = Number(r.totalAmount) || (subtotalVal + adminVal);

        tSheets += sheetsVal;
        tSubtotal += subtotalVal;
        tAdmin += adminVal;
        tClearing += clearingVal;
        gTotal += totalVal;

        aoa.push([
          idx + 1,
          r.notaNumber || '',
          r.dateFormatted || '',
          r.monthName || '',
          r.yearStr || '',
          r.customerName || '',
          r.voucherLabel || '',
          r.startSerial || '',
          r.endSerial || '',
          sheetsVal,
          subtotalVal,
          r.paymentVoucher || 'Tunai',
          adminVal,
          r.paymentAdmin || 'Tunai',
          clearingVal,
          totalVal,
          r.officerName || '',
          r.expiryDateFormatted || '',
          r.expiryStatus || 'AKTIF'
        ]);
      });

      aoa.push([
        "TOTAL KESELURUHAN", "", "", "", "", "", "", "", "",
        tSheets, tSubtotal, "", tAdmin, "", tClearing, gTotal, "", "", ""
      ]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 18 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 18 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 18 } },
        { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 8 } }
      ];
      ws['!cols'] = [
        { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 },
        { wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 16 }, { wch: 15 }, { wch: 14 }, { wch: 15 }, { wch: 14 },
        { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 18 }
      ];
      return ws;
    };

    const makeIncomeStatementSheet = (sheetName, rows, titleSuffix) => {
      let tVoucher = 0, tAdmin = 0, tClearing = 0;
      rows.forEach(r => {
        tVoucher += (r.subtotalNominal || 0);
        tAdmin += (r.adminFee || 0);
        tClearing += (r.clearingFee || 0);
      });
      const tPendapatan = tVoucher + tAdmin;
      const labaBersih = tPendapatan - tClearing;

      const aoa = [
        ["PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)"],
        [`LAPORAN LABA RUGI - ${titleSuffix}`],
        [`Sistem Otomasi Voucher & Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}`],
        [],
        ["Keterangan", "Nominal (Rp)"],
        ["PENDAPATAN", ""],
        ["  Pendapatan Pokok Penjualan Voucher", tVoucher],
        ["  Pendapatan Jasa Admin", tAdmin],
        ["Total Pendapatan", tPendapatan],
        ["", ""],
        ["BEBAN (PENGELUARAN)", ""],
        ["  Beban Administrasi Bank / Clearing", tClearing],
        ["Total Beban", tClearing],
        ["", ""],
        ["LABA BERSIH", labaBersih]
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }
      ];
      ws['!cols'] = [{ wch: 38 }, { wch: 18 }];
      return ws;
    };

    const makeCashFlowSheet = (sheetName, rows, titleSuffix) => {
      let kasTunai = 0, bankTransfer = 0;
      rows.forEach(r => {
        const method = (r.paymentVoucher || 'Tunai').toLowerCase();
        const bersih = (r.subtotalNominal || 0) + (r.adminFee || 0) - (r.clearingFee || 0);
        if (method.includes('transfer') || method.includes('bank')) {
          bankTransfer += bersih;
        } else {
          kasTunai += bersih;
        }
      });
      const totalKas = kasTunai + bankTransfer;

      const aoa = [
        ["PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)"],
        [`REKAPITULASI ARUS KAS - ${titleSuffix}`],
        [`Sistem Otomasi Voucher & Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}`],
        [],
        ["Metode Pembayaran", "Total Penerimaan (Rp)"],
        ["Kas Tunai", kasTunai],
        ["Transfer Bank", bankTransfer],
        ["TOTAL SALDO KAS & BANK", totalKas]
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }
      ];
      ws['!cols'] = [{ wch: 28 }, { wch: 22 }];
      return ws;
    };

    const makeJournalSheet = (sheetName, rows, titleSuffix) => {
      const aoa = [
        ["PT. ARBA MITRA USAHA GORONTALO (SPBU 74-961-4)"],
        [`JURNAL UMUM AKUNTANSI - ${titleSuffix}`],
        [`Sistem Otomasi Voucher & Nota Kwitansi | Periode: ${titleSuffix || 'Semua Periode'}`],
        [],
        ["Tanggal", "No. Bukti / Nota", "Kode Akun", "Nama Akun", "Debit", "Kredit"]
      ];

      const txGroups = {};
      rows.forEach(r => {
        const key = `${r.dateFormatted}_${r.notaNumber}`;
        if (!txGroups[key]) txGroups[key] = { date: r.dateFormatted, nota: r.notaNumber, items: [] };
        txGroups[key].items.push(r);
      });

      let totalDebit = 0, totalKredit = 0;
      for (const group of Object.values(txGroups)) {
        let kreditVoucher = 0, kreditAdmin = 0, debitClearing = 0, pVoucher = '';
        group.items.forEach(r => {
          kreditVoucher += r.subtotalNominal || 0;
          kreditAdmin += r.adminFee || 0;
          debitClearing += r.clearingFee || 0;
          pVoucher = r.paymentVoucher || 'Tunai';
        });

        const debitKas = (kreditVoucher + kreditAdmin) - debitClearing;
        const isTransfer = pVoucher.toLowerCase().includes('transfer') || pVoucher.toLowerCase().includes('bank');
        const namaKas = isTransfer ? 'Kas di Bank' : 'Kas di Tangan';
        const kodeKas = isTransfer ? '1120' : '1110';

        aoa.push([group.date, group.nota, kodeKas, namaKas, debitKas, 0]);
        totalDebit += debitKas;

        if (debitClearing > 0) {
          aoa.push(["", "", "5110", "Beban Administrasi Bank / Clearing", debitClearing, 0]);
          totalDebit += debitClearing;
        }
        if (kreditVoucher > 0) {
          aoa.push(["", "", "4110", "  Pendapatan Penjualan Voucher", 0, kreditVoucher]);
          totalKredit += kreditVoucher;
        }
        if (kreditAdmin > 0) {
          aoa.push(["", "", "4120", "  Pendapatan Jasa Admin", 0, kreditAdmin]);
          totalKredit += kreditAdmin;
        }
      }

      aoa.push(["TOTAL KESELURUHAN", "", "", "", totalDebit, totalKredit]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
        { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 3 } }
      ];
      ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 32 }, { wch: 16 }, { wch: 16 }];
      return ws;
    };

    if (options.mode === 'accounting_only') {
      XLSX.utils.book_append_sheet(wb, makeIncomeStatementSheet("Laporan Laba Rugi", allRows, periodTitle), "Laporan Laba Rugi");
      XLSX.utils.book_append_sheet(wb, makeCashFlowSheet("Rekapitulasi Arus Kas", allRows, periodTitle), "Rekapitulasi Arus Kas");
      XLSX.utils.book_append_sheet(wb, makeJournalSheet("Jurnal Umum", allRows, periodTitle), "Jurnal Umum");
    } else {
      XLSX.utils.book_append_sheet(wb, makeTableSheet("REKAPITULASI TOTAL", allRows, periodTitle), "REKAPITULASI TOTAL");
      XLSX.utils.book_append_sheet(wb, makeTableSheet("Voucher 25k", sheetsMap["V25"], "Pecahan 25.000"), "Voucher 25k");
      XLSX.utils.book_append_sheet(wb, makeTableSheet("Voucher 50k", sheetsMap["V50"], "Pecahan 50.000"), "Voucher 50k");
      XLSX.utils.book_append_sheet(wb, makeTableSheet("Voucher 100k", sheetsMap["V100"], "Pecahan 100.000"), "Voucher 100k");
      XLSX.utils.book_append_sheet(wb, makeTableSheet("Voucher 200k", sheetsMap["V200"], "Pecahan 200.000"), "Voucher 200k");
      XLSX.utils.book_append_sheet(wb, makeTableSheet("Voucher 300k", sheetsMap["V300"], "Pecahan 300.000"), "Voucher 300k");
      XLSX.utils.book_append_sheet(wb, makeTableSheet("Voucher Manual", sheetsMap["MANUAL"], "Voucher Manual"), "Voucher Manual");

      XLSX.utils.book_append_sheet(wb, makeIncomeStatementSheet("Laporan Laba Rugi", allRows, periodTitle), "Laporan Laba Rugi");
      XLSX.utils.book_append_sheet(wb, makeCashFlowSheet("Rekapitulasi Arus Kas", allRows, periodTitle), "Rekapitulasi Arus Kas");
      XLSX.utils.book_append_sheet(wb, makeJournalSheet("Jurnal Umum", allRows, periodTitle), "Jurnal Umum");
    }

    let fileName = `Laporan_Voucher_AMU_${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    if (options.mode === 'accounting_only') {
      fileName = `Jurnal_Akuntansi_AMU_${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    }

    XLSX.writeFile(wb, fileName);
  }

};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExcelExport;
}

