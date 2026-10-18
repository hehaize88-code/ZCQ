export type SourceEntry={at:number,value:string};
export type SharedSourceCache={get(key:string):Promise<SourceEntry|undefined>,set(key:string,entry:SourceEntry,retentionMs:number):Promise<void>,retryAt?():Promise<number|undefined>,backoff?(until:number):Promise<void>};
export class SourceHttpError extends Error {
  status:number;
  constructor(status:number){super(`Source ${status}`);this.name='SourceHttpError';this.status=status;}
}
// Ephemeral cache only. Never retry a rate-limited source immediately.
// Stale data is allowed only for transient errors and retains its original age.
export function createSourceReader(origin:string, transport:typeof fetch=fetch, now=Date.now,shared?:SharedSourceCache) {
  const cache=new Map<string,{at:number,value:string}>();
  const pending=new Map<string,Promise<string>>();
  const failures=new Map<string,{until:number,error:Error,transient:boolean}>();
  let originRetryAt=0;
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
    const stale=()=>hit&&now()-hit.at<ttl+staleMs?hit.value:undefined;
    const failure=failures.get(key);
    if(now()<originRetryAt||(failure&&now()<failure.until)){
      const value=(!failure||failure.transient)?stale():undefined;
      if(value!==undefined)return value;
      throw failure?.error||new Error('Source rate-limit cooldown');
    }
    let request=pending.get(key);
    if(!request){
      request=(async()=>{
        let response:Response;
        try {
          response=await transport(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'text/html,application/json;q=0.9'}});
        } catch(error){
          const failure=error instanceof Error?error:new Error('Source network failure');
          failures.set(key,{until:now()+30000,error:failure,transient:true});trim(failures);
          throw failure;
        }
        if(!response.ok){
          const error=new SourceHttpError(response.status);
          const until=retryAt(response.headers.get('Retry-After'),response.status===429?60000:30000);
          if(response.status===429){
            originRetryAt=until;
            try {await shared?.backoff?.(until);}catch{/* Local backoff remains active. */}
          }
          failures.set(key,{until,error,transient:response.status===429||response.status>=500});trim(failures);
          await response.body?.cancel();
          throw error;
        }
        let value:string;
        try {value=await response.text();} catch(error){
          const failure=error instanceof Error?error:new Error('Source body failure');
          failures.set(key,{until:now()+30000,error:failure,transient:true});trim(failures);
          throw failure;
        }
        failures.delete(key);
        const entry={at:now(),value};
        cache.delete(key);cache.set(key,entry);trim(cache);
        if(shared&&staleMs>0&&!/\b(private|no-store|no-cache)\b/i.test(response.headers.get('Cache-Control')||'')){
          try {await shared.set(key,entry,ttl+staleMs);}catch{/* Memory cache still works. */}
        }
        return value;
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
