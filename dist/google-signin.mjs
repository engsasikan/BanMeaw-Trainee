// Neon must initialize its OAuth cookies in the browser before Google authorization.
const NEON_AUTH_ORIGIN='https://ep-lucky-poetry-azjvlwv7.neonauth.c-3.ap-southeast-1.aws.neon.tech';
const NEON_INIT_PATH='/banmeaw_trainee/auth/sign-in/social/init';
export function googleAccountChooserURL(value){
 const url=new URL(value);
 if(url.origin===NEON_AUTH_ORIGIN&&url.pathname===NEON_INIT_PATH&&url.searchParams.get('token'))return url.href;
 if(url.protocol!=='https:'||url.hostname!=='accounts.google.com')throw Error('ไม่พบหน้าเข้าสู่ระบบ Google กรุณาลองใหม่');
 const prompts=(url.searchParams.get('prompt')||'').split(/\s+/).filter(p=>p&&p!=='none');
 if(!prompts.includes('select_account'))prompts.push('select_account');
 url.searchParams.set('prompt',prompts.join(' '));
 url.searchParams.delete('login_hint');
 url.searchParams.delete('authuser');
 return url.href;
}
export async function signInWithGoogle(auth,origin,navigate){
 const result=await auth.signIn.social({provider:'google',callbackURL:origin+'/',disableRedirect:true,additionalParams:{prompt:'select_account'}});
 if(result?.error)throw Error(result.error.message);
 if(!result?.data?.url)throw Error('เปิดหน้าเลือกบัญชี Google ไม่สำเร็จ กรุณาลองใหม่');
 navigate(googleAccountChooserURL(result.data.url));
}
