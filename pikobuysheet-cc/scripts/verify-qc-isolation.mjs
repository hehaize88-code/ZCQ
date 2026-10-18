import assert from 'node:assert/strict';
import {createSourceReader,SourceRetryError} from '../src/lib/source-cache.ts';
import {edgeSourceCache} from '../src/lib/edge-source-cache.ts';

const origin='https://findspreadsheet.com';
const entries=new Map();
const previousCaches=globalThis.caches;
globalThis.caches={open:async()=>({match:async key=>entries.get(key)?.clone(),put:async(key,response)=>entries.set(key,response.clone())})};
let clock=Date.now(),calls=[];
const transport=async raw=>{
  const url=new URL(raw);calls.push(url.pathname+url.search);
  if(url.pathname==='/qcradar-qc.php')return Response.json({status:'error',message:'QC API request failed'},{status:429,headers:{'Retry-After':'120'}});
  return new Response('real catalog');
};
try {
  const first=createSourceReader(origin,transport,()=>clock,edgeSourceCache);
  const cold=createSourceReader(origin,transport,()=>clock,edgeSourceCache);
  await assert.rejects(first('/qcradar-qc.php?item=123456',60000,0),/Source 429/);
  assert.equal(await first('/AllProducts/'),'real catalog','delegated QC quota does not block the catalog');
  assert.equal(await cold('/shoes/'),'real catalog','another isolate keeps ordinary source reads available');
  const before=calls.length;
  await assert.rejects(first('/qcradar-qc.php?item=234567',60000,0),error=>error instanceof SourceRetryError&&error.retryAt===clock+120000);
  await assert.rejects(cold('/qcradar-qc.php?item=345678',60000,0),/cooldown/);
  assert.equal(calls.length,before,'QC cooldown covers all item IDs and cold isolates');
  assert.equal(await edgeSourceCache.retryAt(),undefined,'delegated quota is not stored as an origin outage');
  clock+=119999;
  await assert.rejects(cold('/qcradar-qc.php?item=456789',60000,0),/cooldown/);
  assert.equal(calls.length,before,'full Retry-After is honored');
  clock+=2;
  await assert.rejects(cold('/qcradar-qc.php?item=456789',60000,0),/Source 429/);
  assert.equal(calls.length,before+1,'QC retries become possible only after the deadline');

  for(const [path,body,type] of [
    ['/qcradar-qc.php?item=123456','<html>host rate limit</html>','text/html'],
    ['/qcradar-qc.php?item=123456','{"status":"error","message":"different error"}','application/json'],
    ['/qcradar-qc.php?item=123456','{"status":','application/json'],
    ['/qcradar-qc.php?item=123456',' '.repeat(1025)+'{"status":"error","message":"QC API request failed"}','application/json'],
    ['/AllProducts/','{"status":"error","message":"QC API request failed"}','application/json']
  ]){
    entries.clear();let count=0;
    const fetchLimited=async()=>{count++;return new Response(body,{status:429,headers:{'Content-Type':type,'Retry-After':'120'}});};
    const reader=createSourceReader(origin,fetchLimited,()=>clock,edgeSourceCache);
    const other=createSourceReader(origin,fetchLimited,()=>clock,edgeSourceCache);
    await assert.rejects(reader(path),/Source 429/);
    await assert.rejects(other('/shoes/'),/cooldown/);
    await assert.rejects(other('/qcradar-qc.php?item=567890',60000,0),/cooldown/);
    assert.equal(count,1,'unproven QC errors and true source limits always retain origin-wide backoff');
  }
}finally{
  if(previousCaches===undefined)delete globalThis.caches;else globalThis.caches=previousCaches;
}
console.log('PASS: confirmed delegated QC quota is isolated; all QC items and cold isolates honor Retry-After; unknown, oversized and origin errors retain global backoff');
