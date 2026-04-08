@echo off
curl -s -X POST http://localhost/api/sync/service-unit-to-sheets ^
  -H "x-sync-secret: ppchos10909" ^
  -H "Content-Type: application/json" ^
  >> C:\scripts\sheets-sync.log 2>&1