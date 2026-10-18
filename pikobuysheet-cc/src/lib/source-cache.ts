export type SourceEntry={at:number,value:string};
export type SourceBackoffScope='origin'|'qc';
export type SharedSourceCache={get(key:string):Promise<SourceEntry|undefined>,set(key:string,entry:SourceEntry,retentionMs:number):Promise<void>,retryAt?(scope?:SourceBackoffScope):Promise<number|undefined>,backoff?(until:number,scope?:SourceBackoffScope):Promise<void>};
export class SourceRetryError extends Error {
  retryAt:number;
  constructor(message:string,retryAt:number){super(message);this.name='SourceRetryError';this.retryAt=retryAt;}
}
export class SourceHttpError extends SourceRetryError {
  status:number;
  constructor(status:number,retryAt=0){super(`Source ${status}`,retryAt);this.name='SourceHttpError';this.status=status;}
}
// The inspected FindSpreadsheet PHP endpoint forwards QC Radar's status with
// this exact JSON error. Only that contract proves a delegated QC quota limit;
// HTML challenges, unknown errors and every other endpoint remain origin-wide.
async function inspectSourceLimit(url:URL,response:Response){
  const unknown={delegatedQc:false,errorCode:null as string|null,errorPage:'unknown'};
  if(!response.body)return unknown;
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let size=0,body='';
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>4096)return unknown;
      body+=decoder.decode(value,{stream:true});
    }
    body+=decoder.decode();
    const plain=body.replace(/<[^>]*>/g,' ');
    const errorCode=plain.match(/error(?:\s+code)?[\s:]+(1\d{3})\b/i)?.[1]||null;
    const errorPage=/too many requests|rate.?limit/i.test(plain)?'rate-limit':/access denied|blocked/i.test(plain)?'access-denied':/overload|resource limit/i.test(plain)?'resource-limit':'unknown';
    let delegatedQc=false;
    if(size<=1024&&url.origin==='https://findspreadsheet.com'&&url.pathname==='/qcradar-qc.php'&&/^application\/json\b/i.test(response.headers.get('Content-Type')||'')){
      try{const data=JSON.parse(body);delegatedQc=data?.status==='error'&&data?.message==='QC API request failed';}catch{}
    }
    return {delegatedQc,errorCode,errorPage};
  }catch{return unknown;}finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}
// Ephemeral cache only. Never retry a rate-limited source immediately.
// Stale data is allowed only for transient errors and retains its original age.
export function createSourceReader(origin:string, transport:typeof fetch=fetch, now=Date.now,shared?:SharedSourceCache,publicSnapshot?:(key:string,value:string)=>string|undefined) {
  const cache=new Map<string,{at:number,value:string}>();
  const pending=new Map<string,Promise<string>>();
  const failures=new Map<string,{until:number,error:Error,transient:boolean}>();
  let originRetryAt=0;
  let qcRetryAt=0;
  let active=0;
  const waiting:Array<()=>void>=[];
  async function acquire(){
    if(active<2){active++;return;}
    if(waiting.length>=6)throw new SourceRetryError('Source request queue busy',now()+10000);
    await new Promise<void>(resolve=>waiting.push(resolve));
  }
  function release(){const next=waiting.shift();if(next)next();else active--;}
  const limit=90;
  function trim(map:Map<string,unknown>){while(map.size>limit)map.delete(map.keys().next().value!);}
  function retryAt(raw:string|null, fallback:number){
    if(raw){
      const seconds=Number(raw);
      if(Number.isFinite(seconds)&&seconds>=0)return now()+Math.max(seconds*1000,fallback);
      const date=Date.parse(raw);
      if(Number.isFinite(date))return Math.max(date,now()+fallback);
    }
    return now()+fallback;
  }
  return async function read(path:string,ttl=180000,staleMs=720000):Promise<string>{
    const url=new URL(path,origin);
    if(url.origin!==origin)throw new Error('Invalid source');
    const key=url.href;
    const isQc=url.pathname==='/qcradar-qc.php';
    let hit=cache.get(key);
    if(hit&&now()-hit.at<ttl)return hit.value;
    if(shared&&staleMs>0){
      try {
        const entry=await shared.get(key);
        if(entry&&entry.at<=now()&&now()-entry.at<ttl+staleMs&&(!hit||entry.at>hit.at)){
          hit=entry;cache.delete(key);cache.set(key,entry);trim(cache);
        }
      }catch{/* Cache service failure must not fail the source request. */}
      if(hit&&now()-hit.at<ttl)return hit.value;
    }
    try {originRetryAt=Math.max(originRetryAt,await shared?.retryAt?.()||0);}catch{/* Local backoff remains active. */}
    if(isQc)try {qcRetryAt=Math.max(qcRetryAt,await shared?.retryAt?.('qc')||0);}catch{/* Local QC backoff remains active. */}
    const activeRetryAt=Math.max(originRetryAt,isQc?qcRetryAt:0);
    const stale=()=>hit&&now()-hit.at<ttl+staleMs?hit.value:undefined;
    const failure=failures.get(key);
    if(now()<activeRetryAt||(failure&&now()<failure.until)){
      const value=(!failure||failure.transient)?stale():undefined;
      if(value!==undefined)return value;
      // Carry the real shared cooldown to the response and browser recovery.
      // A fixed 60-second retry can otherwise run before a longer Retry-After.
      if(now()<activeRetryAt){
        const until=Math.max(activeRetryAt,failure?.until||0);
        if(failure?.error instanceof SourceHttpError)throw new SourceHttpError(failure.error.status,until);
        throw new SourceRetryError('Source rate-limit cooldown',until);
      }
      throw failure!.error;
    }
    let request=pending.get(key);
    if(!request){
      request=(async()=>{
        try{await acquire();}catch(error){
          if(error instanceof SourceRetryError){failures.set(key,{until:error.retryAt,error,transient:true});trim(failures);}
          throw error;
        }
        try {
        // Another request may have received a 429 while this one was queued.
        try {originRetryAt=Math.max(originRetryAt,await shared?.retryAt?.()||0);}catch{}
        if(isQc)try {qcRetryAt=Math.max(qcRetryAt,await shared?.retryAt?.('qc')||0);}catch{}
        const deadline=Math.max(originRetryAt,isQc?qcRetryAt:0);
        if(now()<deadline){
          const error=new SourceRetryError('Source rate-limit cooldown',deadline);
          failures.set(key,{until:deadline,error,transient:true});trim(failures);
          throw error;
        }
        let response:Response;
        try {
          response=await transport(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'text/html,application/json;q=0.9'}});
        } catch(error){
          const failure=new SourceRetryError(error instanceof Error?error.message:'Source network failure',now()+30000);
          failures.set(key,{until:failure.retryAt,error:failure,transient:true});trim(failures);
          throw failure;
        }
        if(!response.ok){
          const until=retryAt(response.headers.get('Retry-After'),response.status===429?60000:30000);
          const error=new SourceHttpError(response.status,until);
          const limitInfo=response.status===429?await inspectSourceLimit(url,response):undefined;
          const scope:SourceBackoffScope=limitInfo?.delegatedQc?'qc':'origin';
          if(response.status===429||response.status>=500)console.warn('FindSpreadsheet upstream response',{
            path:url.pathname,status:response.status,scope,
            errorCode:limitInfo?.errorCode,errorPage:limitInfo?.errorPage,
            contentType:response.headers.get('Content-Type'),cacheStatus:response.headers.get('x-hcdn-cache-status'),
            server:response.headers.get('server'),retryAfter:response.headers.get('Retry-After'),
            requestId:response.headers.get('x-hcdn-request-id')
          });
          if(response.status===429){
            if(scope==='qc')qcRetryAt=Math.max(qcRetryAt,until);
            else originRetryAt=Math.max(originRetryAt,until);
            try {await shared?.backoff?.(until,scope);}catch{/* Local backoff remains active. */}
          }
          failures.set(key,{until,error,transient:response.status===429||response.status>=500});trim(failures);
          await response.body?.cancel();
          throw error;
        }
        let value:string;
        try {value=await response.text();} catch(error){
          const failure=new SourceRetryError(error instanceof Error?error.message:'Source body failure',now()+30000);
          failures.set(key,{until:failure.retryAt,error:failure,transient:true});trim(failures);
          throw failure;
        }
        failures.delete(key);
        const entry={at:now(),value};
        cache.delete(key);cache.set(key,entry);trim(cache);
        if(shared&&staleMs>0){
          try {
            // An explicit projection retains only public catalog facts.
            // Generic readers never share private/no-store/session responses.
            const projected=publicSnapshot?publicSnapshot(key,value):(!/\b(private|no-store|no-cache)\b/i.test(response.headers.get('Cache-Control')||'')&&!response.headers.has('Set-Cookie')?value:undefined);
            if(projected!==undefined)await shared.set(key,{at:entry.at,value:projected},ttl+staleMs);
          }catch{/* Memory cache still works. */}
        }
        return value;
        }finally{release();}
      })().finally(()=>pending.delete(key));
      pending.set(key,request);
    }
    try {return await request;} catch(error){
      const value=failures.get(key)?.transient?stale():undefined;
      if(value!==undefined)return value;
      throw error;
    }
  };
}
