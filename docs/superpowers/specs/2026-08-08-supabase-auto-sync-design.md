# Design Document: Supabase Realtime Auto Sync & Upsert Alignment

**Date**: 2026-08-08  
**Project**: Voucher AMU (SPBU 74-961-4)  
**Status**: Proposed / Under Review  

---

## 1. Overview & Goals

The Supabase Cloud persistence & synchronization mechanism must be upgraded to mirror the automated **upsert**, **anti-duplication**, and **in-place edit update** capabilities implemented for Google Sheets. 

When a transaction (nota) is created, edited, voided, or deleted:
1. **Auto Sync on Edit (Upsert)**: Editing a receipt automatically updates the header row in table `public.transactions` and refreshes its child items in table `public.transaction_items` using `Prefer: resolution=merge-duplicates`.
2. **Signature-Based Deduplication**: Tracking sync status using unique version signatures (`tx.id` + `updated_at` + `status` + payment fields) so unchanged transactions are not re-uploaded unnecessarily.
3. **Realtime Bidirectional Sync**: Listening to Supabase Postgres Realtime changes (`postgres_changes`) so changes made on other cashier devices reflect live.
4. **Resilience & Retry Queue**: Offline transactions auto-retry syncing once connectivity is restored.

---

## 2. Technical Architecture & Database Mapping

### Supabase Schema Alignment
- Table `public.transactions`:
  - Primary Key: `id` (e.g. `'TX-1723112345678'`)
  - Unique Constraint: `id`
  - Upsert behavior: `POST /rest/v1/transactions` with header `Prefer: resolution=merge-duplicates` (Postgres `ON CONFLICT (id) DO UPDATE`).
- Table `public.transaction_items`:
  - Foreign Key: `transaction_id` referencing `transactions(id) ON DELETE CASCADE`.
  - Edit behavior: Before inserting updated items, existing item rows for `transaction_id` are deleted (`DELETE /rest/v1/transaction_items?transaction_id=eq.${tx.id}`), then the updated items are inserted with `Prefer: resolution=merge-duplicates`.

---

## 3. Signature & Sync Logic

```javascript
// Signature generation for Supabase Sync
const sig = `${tx.id}_${tx.updatedAt || ''}_${tx.status || ''}_${tx.customerName || ''}_${tx.grandTotal || 0}_${tx.paymentVoucher || ''}_${tx.paymentAdmin || ''}`;

// Check if version is already synced
if (!force && syncedSignatures.includes(sig)) {
  return { success: true, skipped: true };
}
```

When a receipt is EDITED in `DB.saveTransaction(txData, true)`:
1. `txData.updatedAt` is assigned a new ISO timestamp.
2. The signature changes, causing `syncedSignatures.includes(sig)` to evaluate to `false`.
3. `syncSupabaseTransaction(txData)` executes the upsert POST request.
4. On success, `sig` is saved to `amu_supabase_synced`.

---

## 4. Proposed File Changes

1. `js/database.js`:
   - Upgrade `syncSupabaseTransaction` to use signature-based version tracking.
   - Support `options.force` and `options.resetCache` in `syncAllToSupabase()`.
   - Update `saveTransaction` to trigger background Supabase sync on edits seamlessly.
   - Enhance `fetchSupabaseTransactions` to preserve local pending edits during polling/realtime events.

2. `js/app.js`:
   - Add/update event listener for "🚀 Sync Semua Data ke Supabase Cloud".
   - Display real-time sync status badges (Online/Offline/Synced).

3. `index.html`:
   - Update Supabase Cloud section UI in settings card with status indicator and manual resync button.

---

## 5. Verification & Test Plan

- **Test 1 (New Nota Sync)**: Save new nota -> Verify header inserted into Supabase `transactions` and items into `transaction_items`.
- **Test 2 (Edit Nota Upsert)**: Edit existing nota (change customer/items/payment) -> Verify Supabase `transactions` row updated in-place and `transaction_items` replaced without duplicates.
- **Test 3 (Void Sync)**: Void nota -> Verify `status = 'VOID'` and `void_reason` updated in Supabase.
- **Test 4 (Deduplication)**: Trigger "Sync All" twice -> Verify skipped count on second run.
