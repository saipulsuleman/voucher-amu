/**
 * Serial-Calc.js - Bi-Directional Serial Number Calculator & Anti-Overlap Guard
 * PT. Arba Mitra Usaha Gorontalo (SPBU 74-961-4)
 */

const SerialCalc = {
  /**
   * Parse numeric value from serial string (handles 6-digit or general numbers)
   */
  parseSerial(serialStr) {
    if (!serialStr) return null;
    const cleanStr = String(serialStr).replace(/\D/g, '');
    if (!cleanStr) return null;
    return parseInt(cleanStr, 10);
  },

  /**
   * Format integer back to padded 6-digit serial string
   */
  formatSerial(num, length = 6) {
    if (num === null || num === undefined || isNaN(num)) return '';
    return String(num).padStart(length, '0');
  },

  /**
   * Mode A: Given Start Serial and End Serial -> Calculate Quantity (Lembar)
   * Example: 147801 to 147840 = 40 sheets
   */
  calcQuantity(startSerialStr, endSerialStr) {
    const start = this.parseSerial(startSerialStr);
    const end = this.parseSerial(endSerialStr);
    
    if (start === null || end === null) return 0;
    if (end < start) return 0;
    
    return (end - start) + 1;
  },

  /**
   * Mode B: Given Start Serial and Quantity -> Calculate End Serial
   * Example: 147801 and 40 -> 147840
   */
  calcEndSerial(startSerialStr, quantity) {
    const start = this.parseSerial(startSerialStr);
    const qty = parseInt(quantity, 10);
    
    if (start === null || isNaN(qty) || qty <= 0) return '';
    
    const endNum = start + qty - 1;
    const originalLen = String(startSerialStr).length > 0 ? String(startSerialStr).length : 6;
    return this.formatSerial(endNum, originalLen);
  },

  /**
   * Check if two serial ranges [start1, end1] and [start2, end2] overlap
   */
  isOverlapping(range1, range2) {
    const s1 = this.parseSerial(range1.start);
    const e1 = this.parseSerial(range1.end);
    const s2 = this.parseSerial(range2.start);
    const e2 = this.parseSerial(range2.end);

    if (s1 === null || e1 === null || s2 === null || e2 === null) return false;

    return Math.max(s1, s2) <= Math.min(e1, e2);
  },

  /**
   * Validate a list of active form rows for internal overlap
   */
  validateRowsOverlap(rows) {
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const r1 = rows[i];
        const r2 = rows[j];

        if (r1.voucherCode === r2.voucherCode && this.isOverlapping(r1, r2)) {
          errors.push({
            row1: i + 1,
            row2: j + 1,
            message: `Bentrok Seri: Pecahan ${r1.voucherCode} pada Baris #${i+1} (${r1.start}-${r1.end}) beririsan dengan Baris #${j+1} (${r2.start}-${r2.end})`
          });
        }
      }
    }
    return errors;
  },

  /**
   * Get suggested next start serial number for a specific voucher denomination
   * Checks both saved DB transactions and currently open form rows
   */
  getSuggestedStartSerial(voucherCode, currentRows = []) {
    let maxEndNum = null;
    let originalLen = voucherCode === 'MANUAL' ? 3 : 6;

    // 1. Check DB transactions for this denomination
    if (typeof DB !== 'undefined' && typeof DB.getLastSerialByVoucherCode === 'function') {
      const dbRes = DB.getLastSerialByVoucherCode(voucherCode);
      if (dbRes && dbRes.maxEnd !== null) {
        maxEndNum = dbRes.maxEnd;
        if (dbRes.maxEndStr) {
          originalLen = dbRes.maxEndStr.length;
        }
      }
    }

    // 2. Check active form rows for higher end serial on the same denomination
    if (Array.isArray(currentRows)) {
      for (const row of currentRows) {
        if (row.voucherCode === voucherCode) {
          const endVal = row.endSerial || row.end;
          const rowEndNum = this.parseSerial(endVal);
          if (rowEndNum !== null && (maxEndNum === null || rowEndNum > maxEndNum)) {
            maxEndNum = rowEndNum;
            if (endVal && String(endVal).length > 0) {
              originalLen = String(endVal).length;
            }
          }
        }
      }
    }

    if (maxEndNum === null) return '';
    return this.formatSerial(maxEndNum + 1, originalLen);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SerialCalc;
}
