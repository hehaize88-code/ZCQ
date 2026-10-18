// Ephemeral, per-isolate cache only. Never persist product data or retry a
// rate-limited source immediately. Stale data is allowed only for transient errors.
export function createSourceReader(origin:string, transport:typeof fetch=fetch, now=Date.now) {
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
    const key=url.href,hit=cache.get(key);
    if(hit&&now()-hit.at<ttl)return hit.value;
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
          const error=new Error(`Source ${response.status}`);
          const until=retryAt(response.headers.get('Retry-After'),response.status===429?60000:30000);
          if(response.status===429)originRetryAt=until;
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
        cache.delete(key);cache.set(key,{at:now(),value});trim(cache);
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
