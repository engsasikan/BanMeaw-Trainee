import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleFlow,readGoogleFlow,handleGoogleLogin,googleLoginReady,verifyGoogleToken,verifyGoogleSession,createGoogleSession,resolveGoogleMember,checkGoogleMember,storeGoogleSession,revokeGoogleSession} from '../src/google-login.mjs';
const env={GOOGLE_LOGIN_ENABLED:'true',GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-secret-do-not-use-in-production',NEON_AUTH_BASE_URL:'https://auth.test/auth'};
const origin='https://app.test';
async function fixture(){const flow=await createGoogleFlow(env,origin),url=new URL(flow.url);const callback=new URL(origin+'/api/google/callback');callback.searchParams.set('state',url.searchParams.get('state'));callback.searchParams.set('code','test-code');return {flow,url,request:new Request(callback,{headers:{Cookie:flow.cookie.split(';')[0]}})};}
test('direct Google authorization always asks to choose and binds nonce, state and PKCE',async()=>{
 const {flow,url,request}=await fixture();assert.equal(url.hostname,'accounts.google.com');assert.equal(url.searchParams.get('prompt'),'select_account');assert.equal(url.searchParams.get('redirect_uri'),origin+'/api/google/callback');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('scope'),'openid email profile');assert.ok(!url.searchParams.has('login_hint'));
 assert.match(flow.cookie,/HttpOnly; Secure; SameSite=Lax/);const payload=await readGoogleFlow(request,env);assert.equal(payload.state,url.searchParams.get('state'));assert.equal(payload.nonce,url.searchParams.get('nonce'));assert.ok(payload.verifier);assert.ok(!flow.cookie.includes(payload.verifier));
});
test('missing, tampered, wrong-secret, wrong-state and different-origin callbacks fail before code exchange',async()=>{
 const {flow,request}=await fixture();const altered=new URL(request.url);altered.searchParams.set('state','wrong');const bad=[new Request(request.url),new Request(request.url,{headers:{Cookie:'__Host-banmeaw-google-flow=forged'}}),new Request(altered,{headers:request.headers}),new Request(request.url.replace(origin,'https://evil.test'),{headers:request.headers})];
 for(const r of bad){const response=await handleGoogleLogin(r,env,{fetcher:()=>{throw Error('must not fetch');}});assert.ok(response.headers.get('Location').startsWith('/?error=google_signin_failed&step='));assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);}
 await assert.rejects(()=>readGoogleFlow(request,{...env,GOOGLE_CLIENT_SECRET:'other-secret'}));
});
test('successful callback verifies Google identity and creates a revocable session for existing member',async()=>{
 const {url,request}=await fixture();let stored,profileSeen,verified=false;
 const response=await handleGoogleLogin(request,env,{verifyToken:async(token,options,nonce)=>{assert.equal(token,'signed-test-token');assert.equal(nonce,url.searchParams.get('nonce'));verified=true;return {sub:'google-123',email:'a@example.com',name:'A',email_verified:true};},resolveMember:async profile=>{assert.ok(verified);profileSeen=profile;return {id:'existing-member',googleSub:profile.sub,email:profile.email,name:profile.name};},storeSession:async user=>stored=user,fetcher:async(destination,options)=>{assert.equal(destination,'https://oauth2.googleapis.com/token');assert.equal(options.body.get('code'),'test-code');assert.ok(options.body.get('code_verifier'));return Response.json({id_token:'signed-test-token'});}});
 assert.equal(response.status,303);assert.equal(response.headers.get('Location'),'/?google=success');assert.equal(profileSeen.sub,'google-123');assert.equal(stored.sub,'existing-member');assert.ok(stored.jti);assert.equal(stored.googleSub,'google-123');assert.ok(response.headers.getSetCookie().some(c=>c.startsWith('__Host-banmeaw-google-session=')&&c.includes('HttpOnly; Secure')));assert.ok(!response.headers.get('Location').includes('token'));
});
test('invalid Google identity and failed member lookup never establish login',async()=>{
 const {request}=await fixture();for(const invalidIdentity of [true,false]){const r=await handleGoogleLogin(request,env,{verifyToken:async()=>{if(invalidIdentity)throw Error('bad nonce or signature');return {sub:'123'};},resolveMember:async()=>{throw Error('lookup failed');},fetcher:async()=>Response.json({id_token:'token'})});assert.ok(r.headers.get('Location').startsWith('/?error=google_signin_failed&step='));assert.equal(r.headers.getSetCookie().length,1);}
});
test('feature stays gated and cross-site start cannot replace flow cookie',async()=>{
 assert.equal(googleLoginReady({...env,GOOGLE_LOGIN_ENABLED:'false'}),false);assert.equal(googleLoginReady({...env,GOOGLE_CLIENT_SECRET:''}),false);
 const r=await handleGoogleLogin(new Request(origin+'/api/google/start'),{});assert.equal(r.headers.get('Location'),'/?error=google_not_configured');
 const denied=await handleGoogleLogin(new Request(origin+'/api/google/start',{headers:{'Sec-Fetch-Site':'cross-site'}}),env);assert.equal(denied.status,403);assert.equal(denied.headers.has('Set-Cookie'),false);
});

test('sessions cannot be used with wrong signing key, origin or disabled feature',async()=>{
 const token=await createGoogleSession(env,origin,{id:'existing-member',googleSub:'123',email:'a@example.com',name:'A'});
 assert.equal((await verifyGoogleSession(token,env,origin)).sub,'existing-member');
 for(const settings of [{...env,GOOGLE_CLIENT_SECRET:'wrong'},{...env,GOOGLE_LOGIN_ENABLED:'false'}])await assert.rejects(()=>verifyGoogleSession(token,settings,origin));
 await assert.rejects(()=>verifyGoogleSession(token,env,'https://evil.test'));
});
test('database maps Google subject to old user ID, preserves bans and revokes logout sessions',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();await db.exec(`CREATE SCHEMA neon_auth; CREATE TABLE neon_auth.account ("userId" text,"providerId" text,"accountId" text);CREATE TABLE neon_auth.user (id text,banned boolean);INSERT INTO neon_auth.account VALUES ('old-member','google','123');INSERT INTO neon_auth.user VALUES ('old-member',false);`);
 const sql=async(strings,...values)=>{let q=strings[0];for(let i=0;i<values.length;i++)q+='$'+(i+1)+strings[i+1];return (await db.query(q,values)).rows;};sql.query=q=>db.exec(q);
 try{const member=await resolveGoogleMember(sql,{sub:'123',email:'a@example.com',name:'A'});assert.equal(member.id,'old-member');assert.equal((await resolveGoogleMember(sql,{sub:'456',email:'b@example.com'})).id,'google:456');const token=await createGoogleSession(env,origin,member),user=await verifyGoogleSession(token,env,origin);await storeGoogleSession(sql,user);await checkGoogleMember(sql,user);await revokeGoogleSession(sql,user);await assert.rejects(()=>checkGoogleMember(sql,user));await db.exec(`UPDATE neon_auth.user SET banned=true`);await assert.rejects(()=>resolveGoogleMember(sql,{sub:'123',email:'a@example.com'}));}finally{await db.close();}
});

test('logout clears invalid cookies and revokes valid sessions before clearing them',async()=>{
 const bad=new Request(origin+'/api/google/signout',{method:'POST',headers:{Origin:origin,Cookie:'__Host-banmeaw-google-session=expired-or-forged'}});assert.equal((await handleGoogleLogin(bad,env)).status,200);
 const token=await createGoogleSession(env,origin,{id:'existing-member',googleSub:'123',email:'a@example.com',name:'A'});const request=new Request(origin+'/api/google/signout',{method:'POST',headers:{Origin:origin,Cookie:'__Host-banmeaw-google-session='+token}});let revoked;
 const r=await handleGoogleLogin(request,env,{revokeSession:async user=>revoked=user});assert.equal(r.status,200);assert.equal(revoked.sub,'existing-member');assert.match(r.headers.get('Set-Cookie'),/Max-Age=0/);
 const failure=await handleGoogleLogin(request,env,{revokeSession:async()=>{throw Error('DB unavailable');}});assert.equal(failure.status,503);assert.equal(failure.headers.has('Set-Cookie'),false);
});

test('Google token verification rejects wrong audience, nonce, issuer and unverified email',async()=>{
 const {generateKeyPair,SignJWT}=await import('jose');const {privateKey,publicKey}=await generateKeyPair('RS256');
 const claims={nonce:'nonce',email:'a@example.com',email_verified:true,azp:env.GOOGLE_CLIENT_ID};
 async function sign(overrides={}){return new SignJWT({...claims,...overrides}).setProtectedHeader({alg:'RS256'}).setSubject('123').setIssuer('https://accounts.google.com').setAudience(env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime('5m').sign(privateKey);}
 assert.equal((await verifyGoogleToken(await sign(),env,'nonce',publicKey)).sub,'123');
 for(const fields of [{nonce:'other'},{email_verified:false},{azp:'wrong-client'},{aud:'wrong-client'}]){
  let token;if(fields.aud)token=await new SignJWT(claims).setProtectedHeader({alg:'RS256'}).setSubject('123').setIssuer('https://accounts.google.com').setAudience(fields.aud).setIssuedAt().setExpirationTime('5m').sign(privateKey);else token=await sign(fields);
  await assert.rejects(()=>verifyGoogleToken(token,env,'nonce',publicKey));
 }
 const forgedIssuer=await new SignJWT(claims).setProtectedHeader({alg:'RS256'}).setSubject('123').setIssuer('https://evil.test').setAudience(env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime('5m').sign(privateKey);await assert.rejects(()=>verifyGoogleToken(forgedIssuer,env,'nonce',publicKey));
});

test('new Google members pass session checks when Neon uses UUID IDs; revoked sessions still fail',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();await db.exec('CREATE SCHEMA neon_auth; CREATE TABLE neon_auth.user (id uuid PRIMARY KEY,banned boolean);');
 const sql=async(strings,...values)=>{let q=strings[0];for(let i=0;i<values.length;i++)q+='$'+(i+1)+strings[i+1];return (await db.query(q,values)).rows;};sql.query=q=>db.exec(q);
 try{const token=await createGoogleSession(env,origin,{id:'google:123456789',googleSub:'123456789',email:'new@example.com',name:'New'});const user=await verifyGoogleSession(token,env,origin);await storeGoogleSession(sql,user);await checkGoogleMember(sql,user);
 const response=await handleGoogleLogin(new Request(origin+'/api/google/session',{headers:{Cookie:'__Host-banmeaw-google-session='+token}}),env,{checkMember:profile=>checkGoogleMember(sql,profile)});assert.equal(response.status,200);assert.equal((await response.json()).user.id,'google:123456789');
 await revokeGoogleSession(sql,user);await assert.rejects(()=>checkGoogleMember(sql,user));
 }finally{await db.close();}
});


test('disabled direct Google login clears a stale cookie so Neon login can resume',async()=>{
 const token=await createGoogleSession(env,origin,{id:'existing-member',googleSub:'123',email:'a@example.com',name:'A'});
 const response=await handleGoogleLogin(new Request(origin+'/api/google/session',{headers:{Cookie:'__Host-banmeaw-google-session='+token}}),{...env,GOOGLE_LOGIN_ENABLED:'false'},{checkMember:()=>{throw Error('Disabled flow must not access database');}});
 assert.equal(response.status,200);assert.equal(await response.json(),null);assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);assert.equal(response.headers.get('Cache-Control'),'no-store');
});
