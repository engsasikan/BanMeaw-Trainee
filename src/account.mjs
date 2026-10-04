import { createAuthClient } from '@neondatabase/auth';
const neonAuth = createAuthClient(location.origin + '/api/auth');
// Google uses the website's own account-selection flow; email/password keeps Neon Auth.
export const auth = new Proxy(neonAuth,{get(target,key){
 if(key==='getSession')return async (...args)=>{try{const response=await fetch('/api/google/session',{credentials:'include',cache:'no-store'});const data=await response.json();if(response.ok&&data?.session?.token&&data?.user)return {data,error:null};if(!response.ok&&data?.error)return {data:null,error:{message:'อ่านการเข้าสู่ระบบ Google ไม่สำเร็จ ('+(data.error.reference||'session')+') กรุณาลองใหม่'}};}catch{}return target.getSession(...args);};
 if(key==='signOut')return async (...args)=>{const response=await fetch('/api/google/signout',{method:'POST',credentials:'include'});if(!response.ok)return {error:{message:'ออกจากระบบ Google ไม่สำเร็จ กรุณาลองใหม่'}};return target.signOut(...args);};
 return Reflect.get(target,key);
}});
// The SDK answers auth.token() from its session cache (it treats /token like get-session),
// so read the JWT it injects into session.token, falling back to the token endpoint.
async function jwt() {
  const session=await auth.getSession();
  const token=session.data?.session?.token;
  if(token?.split('.').length===3) return token;
  const response=await fetch('/api/auth/token',{credentials:'include'});
  return response.ok?(await response.json()).token:null;
}
export async function api(path,options={}) {
  const token=await jwt();
  if(!token) throw Error('กรุณาเข้าสู่ระบบใหม่');
  const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers,Authorization:'Bearer '+token}});
  const result=await response.json();
  if(!response.ok) throw Error(result.error||'บันทึกไม่สำเร็จ');
  return result;
}
