import {EncryptJWT,jwtDecrypt,createRemoteJWKSet,jwtVerify,SignJWT} from 'jose';
const COOKIE='__Host-banmeaw-google-flow';
const SESSION_COOKIE='__Host-banmeaw-google-session';
const callbackPath='/api/google/callback';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const enc=new TextEncoder();
const bytes64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=()=>bytes64(crypto.getRandomValues(new Uint8Array(32)));
const digest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)));
export function googleLoginReady(env){return env.GOOGLE_LOGIN_ENABLED==='true'&&Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.NEON_AUTH_BASE_URL);}
function cookie(value,maxAge){return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;}
function redirect(destination,cookies=[]){const headers=new Headers({'Location':destination,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(const value of cookies)headers.append('Set-Cookie',value);return new Response(null,{status:303,headers});}
export async function createGoogleFlow(env,origin){
 const state=random(),nonce=random(),verifier=random();
 const sealed=await new EncryptJWT({state,nonce,verifier,origin}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuer('banmeaw-google-login').setAudience(env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime('10m').encrypt(await digest(env.GOOGLE_CLIENT_SECRET));
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 for(const [key,value] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:origin+callbackPath,response_type:'code',scope:'openid email profile',prompt:'select_account',state,nonce,code_challenge:bytes64(await digest(verifier)),code_challenge_method:'S256'}))url.searchParams.set(key,value);
 return {url:url.href,cookie:cookie(sealed,600)};
}
export async function readGoogleFlow(request,env){
 const url=new URL(request.url);const sealed=request.headers.get('Cookie')?.split(/;\s*/).find(c=>c.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!sealed)throw Error('Missing flow cookie');
 const {payload}=await jwtDecrypt(sealed,await digest(env.GOOGLE_CLIENT_SECRET),{issuer:'banmeaw-google-login',audience:env.GOOGLE_CLIENT_ID,requiredClaims:['exp','iat']});
 if(!payload.state||payload.state!==url.searchParams.get('state')||payload.origin!==url.origin||typeof payload.nonce!=='string'||typeof payload.verifier!=='string')throw Error('Invalid OAuth state');
 return payload;
}
export async function verifyGoogleToken(token,env,nonce,verificationKeys=googleKeys){
 const {payload}=await jwtVerify(token,verificationKeys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_CLIENT_ID,algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce']});
 if(payload.nonce!==nonce||payload.email_verified!==true||typeof payload.email!=='string'||(payload.azp&&payload.azp!==env.GOOGLE_CLIENT_ID))throw Error('Invalid Google identity');
 return payload;
}
const sessionKey=env=>digest('banmeaw-google-session-v1:'+env.GOOGLE_CLIENT_SECRET);
export async function createGoogleSession(env,origin,user){return new SignJWT({email:user.email,name:user.name,emailVerified:true,googleSub:user.googleSub}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setJti(crypto.randomUUID()).setSubject(user.id).setIssuer(origin+'/api/google').setAudience(origin).setIssuedAt().setExpirationTime('12h').sign(await sessionKey(env));}
export async function verifyGoogleSession(token,env,origin){
 if(!googleLoginReady(env))throw Error('Google login is disabled');
 const {payload}=await jwtVerify(token,await sessionKey(env),{algorithms:['HS256'],issuer:origin+'/api/google',audience:origin,requiredClaims:['sub','exp','iat','googleSub','jti']});
 if(typeof payload.email!=='string'||payload.emailVerified!==true)throw Error('Invalid Google session');return payload;
}
function readSessionCookie(request){return request.headers.get('Cookie')?.split(/;\s*/).find(c=>c.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);}
export async function resolveGoogleMember(sql,profile){
 // Read existing Better Auth Google linkage by provider subject, never by an unverified email.
 const [existing]=await sql`SELECT COALESCE(to_jsonb(a)->>'userId',to_jsonb(a)->>'user_id') AS id FROM neon_auth.account a WHERE COALESCE(to_jsonb(a)->>'providerId',to_jsonb(a)->>'provider_id')='google' AND COALESCE(to_jsonb(a)->>'accountId',to_jsonb(a)->>'account_id')=${profile.sub} LIMIT 1`;
 const id=existing?.id||'google:'+profile.sub;
 if(existing){const [user]=await sql`SELECT to_jsonb(u) AS data FROM neon_auth.user u WHERE id=${id}`;if(!user||user.data.banned===true)throw Error('Google account is disabled');}
 return {id,email:profile.email,name:profile.name||profile.email,googleSub:profile.sub};
}
export async function checkGoogleMember(sql,user){
 const [session]=await sql`SELECT id FROM google_login_sessions WHERE id=${user.jti} AND user_id=${user.sub} AND expires_at>now()`;if(!session)throw Error('Google session expired or revoked');
 // New website Google accounts have text IDs; Neon user IDs are UUIDs.
 // Keep the revocable session check above, then skip the Neon-only lookup.
 if(user.sub.startsWith('google:'))return;
 const [row]=await sql`SELECT to_jsonb(u) AS data FROM neon_auth.user u WHERE id=${user.sub}`;
 if(!row||row.data.banned===true)throw Error('Google account is disabled');
}
export async function storeGoogleSession(sql,user){
 await sql.query('CREATE TABLE IF NOT EXISTS google_login_sessions (id uuid PRIMARY KEY, user_id text NOT NULL, expires_at timestamptz NOT NULL)');
 await sql`DELETE FROM google_login_sessions WHERE expires_at<=now()`;
 await sql`INSERT INTO google_login_sessions (id,user_id,expires_at) VALUES (${user.jti},${user.sub},to_timestamp(${user.exp}))`;
}
export async function revokeGoogleSession(sql,user){await sql`DELETE FROM google_login_sessions WHERE id=${user.jti} AND user_id=${user.sub}`;}
export async function handleGoogleLogin(request,env,{fetcher=fetch,verifyToken=verifyGoogleToken,resolveMember,checkMember,storeSession,revokeSession}={}){
 const url=new URL(request.url);
 if(!['/api/google/start',callbackPath,'/api/google/session','/api/google/signout'].includes(url.pathname))return null;
 if(url.pathname==='/api/google/signout'){if(request.method!=='POST'||request.headers.get('Origin')!==url.origin)return new Response(null,{status:403});let user;try{const token=readSessionCookie(request);if(token)user=await verifyGoogleSession(token,env,url.origin);}catch{}if(user){try{if(!revokeSession)throw Error('Missing revocation');await revokeSession(user);}catch{return Response.json({error:'ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'},{status:503});}}return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`}});}
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 if(url.pathname==='/api/google/session'&&!googleLoginReady(env))return Response.json(null,{headers:{'Cache-Control':'no-store','Set-Cookie':`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`}});
 if(url.pathname==='/api/google/session'){try{const token=readSessionCookie(request);if(!token)throw Error('No Google session');const user=await verifyGoogleSession(token,env,url.origin);if(!checkMember)throw Error('No member check');await checkMember(user);return Response.json({session:{token},user:{id:user.sub,email:user.email,name:user.name,emailVerified:true}},{headers:{'Cache-Control':'no-store'}});}catch(error){if(!readSessionCookie(request))return Response.json(null,{headers:{'Cache-Control':'no-store'}});const code=typeof error.code==='string'?error.code:'session_unavailable';console.error('Google session check failed',{code});return Response.json({error:{code:'google_session_unavailable',reference:code}},{status:503,headers:{'Cache-Control':'no-store'}});}}
 if(!googleLoginReady(env)||url.protocol!=='https:')return redirect('/?error=google_not_configured');
 if(url.pathname==='/api/google/start'){
  if(request.headers.get('Sec-Fetch-Site')==='cross-site')return new Response(null,{status:403});
  const flow=await createGoogleFlow(env,url.origin);return redirect(flow.url,[flow.cookie]);
 }
 let stage='state';
 try{
  const flow=await readGoogleFlow(request,env);
  if(url.searchParams.get('error'))return redirect('/?error=google_cancelled',[cookie('',0)]);
  const code=url.searchParams.get('code');if(!code||code.length>4096)throw Error('Missing OAuth code');
  stage='exchange';
  const tokensResponse=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:url.origin+callbackPath,grant_type:'authorization_code',code_verifier:flow.verifier})});
  if(!tokensResponse.ok)throw Error('Google code exchange failed');
  const tokens=await tokensResponse.json();if(typeof tokens.id_token!=='string')throw Error('Missing Google ID token');
  stage='identity';
  const profile=await verifyToken(tokens.id_token,env,flow.nonce);
  if(!resolveMember)throw Error('Member resolver unavailable');
  stage='member';
  const user=await resolveMember(profile);
  const session=await createGoogleSession(env,url.origin,user);
  stage='session';
  if(!storeSession)throw Error('Session storage unavailable');await storeSession(await verifyGoogleSession(session,env,url.origin));
  return redirect('/?google=success',[cookie('',0),`${SESSION_COOKIE}=${session}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`]);
 }catch(error){console.error('Google login failed',{stage,code:typeof error.code==='string'?error.code:'unknown'});return redirect('/?error=google_signin_failed&step='+stage,[cookie('',0)]);}
}
