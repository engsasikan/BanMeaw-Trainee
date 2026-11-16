// Saves that could not reach the server (no signal in the gym), kept in this browser until they can be sent.
// Each entry is one change to one record: {type:'put', id, row, revision} or {type:'delete', id, revision}.
// `revision` is the server version the change was based on, so the server can still refuse a stale change.

// A failed fetch (no connection) rather than an answer from the server.
export const isNetworkError=error=>error instanceof TypeError||globalThis.navigator?.onLine===false;

export function createOutbox(key,storage=globalThis.localStorage){
 const memory={ops:[]};
 const read=()=>{try{const saved=JSON.parse(storage.getItem(key));if(Array.isArray(saved))return saved;}catch{}return memory.ops;};
 const write=ops=>{memory.ops=ops;try{ops.length?storage.setItem(key,JSON.stringify(ops)):storage.removeItem(key);}catch{}return ops;};
 // Later changes to the same record fold into the queued one, keeping the revision the first change was based on.
 function add(op){
  const ops=read(),index=ops.findIndex(x=>x.id===op.id);
  if(index<0)return write([...ops,op]);
  const queued=ops[index];
  if(op.type==='put')ops[index]={...op,revision:queued.revision,type:'put'};
  else if(queued.type==='put'&&queued.revision===0)ops.splice(index,1); // created and deleted offline: nothing to send
  else ops[index]={type:'delete',id:op.id,revision:queued.revision};
  return write(ops);
 }
 // Records as they will be once the queue is sent: queued changes applied and marked as waiting.
 function apply(records){
  const ops=read();if(!ops.length)return records;
  const byId=new Map(records.map(r=>[r.id,r]));
  for(const op of ops){
   if(op.type==='delete')byId.delete(op.id);
   else byId.set(op.id,{...op.row,_revision:byId.get(op.id)?._revision??op.revision,_pending:true});
  }
  return [...byId.values()];
 }
 // Send queued changes in order. Stops at the first connection failure and keeps the rest; a change the server
 // refuses (for example edited meanwhile on another device) is dropped and reported.
 async function flush(send){
  const refused=[];let sent=0;
  // The caller holds its save lock while flushing, so the queue only shrinks from the front here.
  while(read().length){
   const op=read()[0];
   try{await send(op);sent++;}
   catch(error){if(isNetworkError(error))return {sent,refused,left:read().length};refused.push({op,error});}
   write(read().slice(1));
  }
  return {sent,refused,left:0};
 }
 return {add,apply,flush,list:read,get size(){return read().length;},clear:()=>write([])};
}
