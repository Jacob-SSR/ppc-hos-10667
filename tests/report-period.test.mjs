import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportDateRange, currentReportYear } from '../lib/report-period.ts';
test('calendar and fiscal years use the correct boundaries', () => {
 assert.deepEqual(reportDateRange('year',2026,9),{date_from:'2026-01-01',date_to:'2026-12-31'});
 assert.deepEqual(reportDateRange('fiscal',2026,9),{date_from:'2025-10-01',date_to:'2026-09-30'});
 assert.deepEqual(reportDateRange('fiscal',2021,9),{date_from:'2020-10-01',date_to:'2021-09-30'});
});
test('monthly ranges include leap years and month ends', () => {
 assert.equal(reportDateRange('month',2024,2).date_to,'2024-02-29');
 assert.equal(reportDateRange('month',2025,2).date_to,'2025-02-28');
 assert.equal(reportDateRange('month',2026,4).date_to,'2026-04-30');
 assert.equal(reportDateRange('month',2026,12).date_to,'2026-12-31');
});
test('current fiscal year changes on October 1 in Bangkok', () => {
 assert.equal(currentReportYear('fiscal',new Date('2026-09-30T16:59:00Z')).year,2026);
 assert.equal(currentReportYear('fiscal',new Date('2026-09-30T17:00:00Z')).year,2027);
 assert.equal(currentReportYear('year',new Date('2026-09-30T17:00:00Z')).year,2026);
});
