const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js', 'excel-export.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Update exportToExcel signature
code = code.replace(
  /exportToExcel\(transactions, periodTitle = "Semua Periode"\) \{/,
  'exportToExcel(transactions, periodTitle = "Semua Periode", options = { mode: \'merged\' }) {'
);

// 2. Update buildXmlSpreadsheet call & file name logic
const buildXmlCall = `    const xmlWorkbook = this.buildXmlSpreadsheet(allRows, sheetsMap, periodTitle);
    
    // Create download blob
    const blob = new Blob([xmlWorkbook], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`Laporan_Voucher_AMU_\${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xls\`;`;

const newBuildXmlCall = `    const xmlWorkbook = this.buildXmlSpreadsheet(allRows, sheetsMap, periodTitle, options.mode);
    
    // Create download blob
    const blob = new Blob([xmlWorkbook], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let fileName = \`Laporan_Voucher_AMU_\${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xls\`;
    if (options.mode === 'accounting_only') {
      fileName = \`Jurnal_Akuntansi_AMU_\${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xls\`;
    }
    a.download = fileName;`;
    
code = code.replace(buildXmlCall, newBuildXmlCall);

// 3. Update buildXmlSpreadsheet signature and body
const buildXmlSig = /buildXmlSpreadsheet\(allRows, sheetsMap, periodTitle\) \{/;
code = code.replace(buildXmlSig, 'buildXmlSpreadsheet(allRows, sheetsMap, periodTitle, mode = \'merged\') {');

const sheetBuildingSection = `    // 1. Sheet REKAPITULASI TOTAL
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
    xml += this.buildTableWorksheet("Voucher Manual", sheetsMap["MANUAL"], "Voucher Manual");`;

const newSheetBuildingSection = `    if (mode === 'accounting_only') {
      xml += this.buildAccountingSummaryWorksheet("Rekapitulasi Keuangan", allRows, periodTitle);
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
      xml += this.buildAccountingSummaryWorksheet("Rekapitulasi Keuangan", allRows, periodTitle);
      xml += this.buildJournalWorksheet("Jurnal Umum", allRows, periodTitle);
      xml += this.buildAuditWorksheet("Audit Gap Serial", allRows, periodTitle);
    }`;

code = code.replace(sheetBuildingSection, newSheetBuildingSection);

// 4. Append new functions before `};` at the end
const newFunctions = `
  buildAccountingSummaryWorksheet(sheetName, rows, titleSuffix) {
    let ws = \` <Worksheet ss:Name="\${sheetName}">
  <Table>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="2" ss:StyleID="Title"><Data ss:Type="String">REKAPITULASI KEUANGAN - \${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Metode Pembayaran</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Kategori Pendapatan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total Nominal</Data></Cell>
   </Row>\`;

    const summary = {};
    let totalAll = 0;

    rows.forEach(r => {
      const pVoucher = r.paymentVoucher || 'Tunai';
      const pAdmin = r.paymentAdmin || 'Tunai';
      
      // Voucher
      if (r.subtotalNominal > 0) {
        const keyV = \`\${pVoucher}|Pendapatan Pokok Voucher\`;
        summary[keyV] = (summary[keyV] || 0) + r.subtotalNominal;
        totalAll += r.subtotalNominal;
      }
      // Admin
      if (r.adminFee > 0) {
        const keyA = \`\${pAdmin}|Pendapatan Jasa Admin\`;
        summary[keyA] = (summary[keyA] || 0) + r.adminFee;
        totalAll += r.adminFee;
      }
      // Clearing (usually deducts from total received, or just logged)
      if (r.clearingFee > 0) {
        const keyC = \`\${pVoucher}|Beban Clearing\`;
        summary[keyC] = (summary[keyC] || 0) + r.clearingFee;
        totalAll += r.clearingFee;
      }
    });

    for (const [key, amount] of Object.entries(summary)) {
      const [metode, kategori] = key.split('|');
      ws += \`
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">\${metode}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">\${kategori}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">\${amount}</Data></Cell>
   </Row>\`;
    }

    ws += \`
   <Row>
    <Cell ss:MergeAcross="1" ss:StyleID="Total"><Data ss:Type="String">TOTAL KESELURUHAN</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">\${totalAll}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>\`;
    return ws;
  },

  buildJournalWorksheet(sheetName, rows, titleSuffix) {
    let ws = \` <Worksheet ss:Name="\${sheetName}">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="250"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="4" ss:StyleID="Title"><Data ss:Type="String">JURNAL UMUM - \${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tanggal</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">No. Bukti / Nota</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Akun / Keterangan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Debit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Kredit</Data></Cell>
   </Row>\`;

    // Group rows by transaction (notaNumber + date)
    const txGroups = {};
    rows.forEach(r => {
      const key = \`\${r.dateFormatted}_\${r.notaNumber}\`;
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
      let namaKas = pVoucher.toLowerCase().includes('transfer') ? 'Bank' : 'Kas';

      // Baris Debit Kas
      ws += \`
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">\${group.date}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">\${group.nota}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">\${namaKas}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">\${debitKas}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">0</Data></Cell>
   </Row>\`;
      totalDebit += debitKas;

      if (debitClearing > 0) {
        ws += \`
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">Beban Administrasi Bank / Clearing</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">\${debitClearing}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">0</Data></Cell>
   </Row>\`;
        totalDebit += debitClearing;
      }

      if (kreditVoucher > 0) {
        ws += \`
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">  Pendapatan Penjualan Voucher</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">\${kreditVoucher}</Data></Cell>
   </Row>\`;
        totalKredit += kreditVoucher;
      }

      if (kreditAdmin > 0) {
        ws += \`
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">  Pendapatan Jasa Admin</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">\${kreditAdmin}</Data></Cell>
   </Row>\`;
        totalKredit += kreditAdmin;
      }
    }

    ws += \`
   <Row>
    <Cell ss:MergeAcross="2" ss:StyleID="Total"><Data ss:Type="String">TOTAL KESELURUHAN</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">\${totalDebit}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">\${totalKredit}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>\`;
    return ws;
  },

  buildAuditWorksheet(sheetName, rows, titleSuffix) {
    let ws = \` <Worksheet ss:Name="\${sheetName}">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="250"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="3" ss:StyleID="Title"><Data ss:Type="String">AUDIT GAP SERIAL VOUCHER - \${titleSuffix}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Bulan/Tahun</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">No Seri Bolong</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Pecahan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Keterangan</Data></Cell>
   </Row>\`;

    // Untuk Audit Gap Serial, kita kumpulkan semua serial yang terjual per pecahan dan per kelompok cetakan (batch)
    const serialsPerCodeAndBatch = {};
    
    rows.forEach(r => {
      if (!r.startSerial || !r.endSerial) return;
      const startNum = parseInt(String(r.startSerial).replace(/\\D/g, ''), 10);
      const endNum = parseInt(String(r.endSerial).replace(/\\D/g, ''), 10);
      const prefix = String(r.startSerial).replace(/\\d/g, '');
      
      const code = r.voucherLabel; // e.g. "Voucher 25k"
      if (!startNum || !endNum) return;
      
      // Tentukan kelompok cetakan (batch):
      // Batch 0: Cetakan lama mendekati 100.000 (>= 99000 dan <= 100000)
      // Batch 1: Cetakan baru hasil reset/pencetakan ulang (< 99000)
      const batchGroup = (startNum >= 99000 || endNum >= 99000) ? 0 : 1;
      
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
             const gapDesc = gapStart === gapEnd ? \`\${current.prefix}\${gapStart}\` : \`\${current.prefix}\${gapStart} s/d \${current.prefix}\${gapEnd}\`;
             const count = gapEnd - gapStart + 1;
             ws += \`
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">\${current.date}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">\${gapDesc}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">\${code}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">Indikasi bolong \${count} lembar</Data></Cell>
   </Row>\`;
          }
        }
      }
    }

    if (!hasGap) {
       ws += \`
   <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="CellCenter"><Data ss:Type="String">Tidak ditemukan gap serial (semua nomor urut berkesinambungan)</Data></Cell>
   </Row>\`;
    }

    ws += \`
  </Table>
 </Worksheet>\`;
    return ws;
  }
`;

code = code.replace(/};\s*if \(typeof module !== 'undefined'/, newFunctions + '\n};\n\nif (typeof module !== \'undefined\'');

fs.writeFileSync(filePath, code);
console.log("excel-export.js updated successfully.");
