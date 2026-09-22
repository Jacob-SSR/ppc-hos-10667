import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { diseaseSearchQuery } from '../lib/icd-disease-search.ts';
import { canAccessPath } from '../lib/permissions.ts';
test('disease lookup matches Thai/English names and normalized code safely', () => {
 const db = new DatabaseSync(':memory:');
 try {
  db.exec('CREATE TABLE icd101 (code, name, tname)');
  const add = db.prepare('INSERT INTO icd101 VALUES (?, ?, ?)');
  add.run('M54.5','Low back pain','ปวดหลังส่วนล่าง');
  add.run('R07.0','Pain in throat','เจ็บคอ');
  add.run('A00','Sample diagnosis',null);
  add.run('A00.1','100% test_name!',null);
  const search = term => {const q=diseaseSearchQuery(term);return db.prepare(q.sql).all(...q.values);};
  assert.equal(search('  ปวดหลัง ')[0].code,'M54.5');
  assert.equal(search('เจ็บคอ')[0].code,'R07.0');
  assert.equal(search('BACK PAIN')[0].thai_name,'ปวดหลังส่วนล่าง');
  assert.equal(search('m54.5')[0].code,'M54.5');
  assert.equal(search('A00')[0].code,'A00');
  assert.equal(search('100%')[0].code,'A00.1');
  assert.equal(search('test_')[0].code,'A00.1');
  assert.equal(search("' OR 1=1 --").length,0);
  assert.equal(search('missing').length,0);
  assert.throws(()=>diseaseSearchQuery(' '));
  assert.throws(()=>diseaseSearchQuery('a'.repeat(101)));
 } finally {db.close();}
});
test('disease lookup inherits report access without broadening permissions', () => {
 for(const role of ['ADMIN','DOCTOR','FINANCE','PUBLIC_HEALTH']) assert.ok(canAccessPath(role,'/api/icd10-report/diseases'));
 assert.equal(canAccessPath('USER','/api/icd10-report/diseases'),false);
});
