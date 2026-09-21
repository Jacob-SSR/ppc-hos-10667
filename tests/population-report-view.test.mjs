import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY_POPULATION_FILTERS, filterPopulation, normalizeMoo, populationExportRows, sortPopulation, summarizePopulation } from '../lib/population-report-view.ts';

const rows = [
  { villageId: 1, HN: '001', CID: '0000000000001', 'ชื่อ-นามสกุล': 'ทดสอบ ก', 'เพศ': 'ชาย', 'อายุ (ปี)': 9, 'ประเภททะเบียน': '1', 'หมู่': '02', 'หมู่บ้าน': 'ทดสอบ', 'ถนน': null },
  { villageId: 1, HN: '002', 'ชื่อ-นามสกุล': 'ทดสอบ ข', 'เพศ': 'หญิง', 'อายุ (ปี)': 20, 'ประเภททะเบียน': '3', 'หมู่': '2', 'หมู่บ้าน': 'ทดสอบ', 'ถนน': 'ถนน ก' },
  { villageId: 2, HN: '003', 'ชื่อ-นามสกุล': 'ทดสอบ ค', 'เพศ': 'หญิง', 'อายุ (ปี)': 100, 'ประเภททะเบียน': '1', 'หมู่': '10', 'หมู่บ้าน': 'ทดสอบ', 'ถนน': 'ถนน ข' },
  { villageId: 2, HN: '004', 'ชื่อ-นามสกุล': 'ทดสอบ ง', 'เพศ': 'ไม่ระบุ', 'อายุ (ปี)': 60, 'ประเภททะเบียน': '3', 'หมู่': '10', 'หมู่บ้าน': 'ทดสอบ', 'ถนน': null },
  { villageId: 2, HN: '005', 'ชื่อ-นามสกุล': 'ทดสอบ จ', 'เพศ': 'ชาย', 'อายุ (ปี)': 30, 'ประเภททะเบียน': '1', 'หมู่': '10', 'หมู่บ้าน': 'ทดสอบ', 'ถนน': null },
];
const filter = changes => filterPopulation(rows, { ...EMPTY_POPULATION_FILTERS, ...changes });

test('combines moo, village, sex, registration and a single search bar', () => {
  assert.equal(filter({}).length, 5);
  assert.deepEqual(filter({ moo: '2' }).map(r => r.HN), ['001', '002']);
  assert.deepEqual(filter({ moo: '2', village: '1', sex: 'หญิง', type: '3', search: '002' }).map(r => r.HN), ['002']);
  assert.deepEqual(filter({ search: 'ถนน ก' }).map(r => r.HN), ['002']);
  assert.equal(filter({ moo: '2', village: '2' }).length, 0);
  assert.equal(filter({ sex: 'ชาย' }).length, 2);
  assert.equal(filter({ sex: 'หญิง' }).length, 2);
  assert.equal(filter({ sex: 'ไม่ระบุ' }).length, 1);
  assert.equal(filter({ search: 'null' }).length, 0);
  assert.equal(filter({ search: '  ' }).length, 5);
  assert.equal(normalizeMoo('02'), normalizeMoo(2));
});

test('summary keeps same-named villages separate, ranks them and reconciles sexes', () => {
  const summary = summarizePopulation(rows);
  assert.deepEqual([summary.total, summary.male, summary.female, summary.unknown], [5, 2, 2, 1]);
  assert.deepEqual(summary.villages.map(v => [v.id, v.total]), [['2', 3], ['1', 2]]);
  for (const village of summary.villages) assert.equal(village.total, village.male + village.female + village.unknown);
  const femaleSummary = summarizePopulation(filter({ sex: 'หญิง' }));
  assert.equal(femaleSummary.total, femaleSummary.female);
  assert.equal(femaleSummary.male, 0);
  assert.deepEqual(summarizePopulation([]), { total: 0, male: 0, female: 0, unknown: 0, villages: [] });
});

test('sort and export share filtered rows, preserve IDs and renumber consecutively', () => {
  const sorted = sortPopulation(filter({ type: '1' }), 'อายุ (ปี)', false);
  assert.deepEqual(sorted.map(r => r['อายุ (ปี)']), [100, 30, 9]);
  const exported = populationExportRows(sorted);
  assert.deepEqual(exported.map(r => r['ลำดับ']), [1, 2, 3]);
  assert.deepEqual(exported.map(r => r.HN), sorted.map(r => r.HN));
  assert.equal(exported[2].CID, '0000000000001');
  assert.equal('villageId' in exported[0], false);
  assert.equal(exported.length, summarizePopulation(sorted).total);
});
