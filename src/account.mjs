import { createAuthClient } from '@neondatabase/auth';
export const auth = createAuthClient(location.origin + '/api/auth');
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
