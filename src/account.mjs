import { createAuthClient } from '@neondatabase/auth';
export const auth = createAuthClient(location.origin + '/api/auth');
export async function api(path,options={}) {
  const {data,error}=await auth.token();
  if(error||!data?.token) throw Error('กรุณาเข้าสู่ระบบใหม่');
  const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers,Authorization:'Bearer '+data.token}});
  const result=await response.json();
  if(!response.ok) throw Error(result.error||'บันทึกไม่สำเร็จ');
  return result;
}
