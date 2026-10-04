import test from 'node:test';
import assert from 'node:assert/strict';
import {googleAccountChooserURL,signInWithGoogle} from '../dist/google-signin.mjs';
test('account chooser preserves OAuth security params and consent while removing fixed account hints',()=>{
 const url=new URL(googleAccountChooserURL('https://accounts.google.com/o/oauth2/v2/auth?state=abc&code_challenge=xyz&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&prompt=consent&login_hint=old%40gmail.com&authuser=0'));
 assert.equal(url.searchParams.get('prompt'),'consent select_account');
 assert.equal(url.searchParams.get('state'),'abc');assert.equal(url.searchParams.get('code_challenge'),'xyz');assert.equal(url.searchParams.get('redirect_uri'),'https://example.com/callback');
 assert.equal(url.searchParams.has('login_hint'),false);assert.equal(url.searchParams.has('authuser'),false);
 assert.equal(new URL(googleAccountChooserURL('https://accounts.google.com/o/oauth2/v2/auth?prompt=none')).searchParams.get('prompt'),'select_account');
 assert.throws(()=>googleAccountChooserURL('https://example.com/auth'));
});
test('Google sign in requests manual redirect and navigates to account chooser',async()=>{
 let options,destination;const auth={signIn:{social:async value=>{options=value;return {data:{url:'https://accounts.google.com/o/oauth2/v2/auth?state=abc'}};}}};
 await signInWithGoogle(auth,'https://example.com',url=>destination=url);
 assert.equal(options.disableRedirect,true);assert.equal(options.callbackURL,'https://example.com/');assert.equal(options.additionalParams.prompt,'select_account');assert.equal(new URL(destination).searchParams.get('prompt'),'select_account');
});
test('Google errors and missing URLs never navigate',async()=>{
 let navigated=false;for(const result of [{error:{message:'OAuth unavailable'}},{data:{}}])await assert.rejects(()=>signInWithGoogle({signIn:{social:async()=>result}},'https://example.com',()=>navigated=true));assert.equal(navigated,false);
});

test('Neon OAuth initialization is preserved so browser receives state cookies',async()=>{
 const init='https://ep-lucky-poetry-azjvlwv7.neonauth.c-3.ap-southeast-1.aws.neon.tech/banmeaw_trainee/auth/sign-in/social/init?token=test-init-token';
 assert.equal(googleAccountChooserURL(init),init);
 let destination;
 await signInWithGoogle({signIn:{social:async()=>({data:{url:init}})}},'https://example.com',url=>destination=url);
 assert.equal(destination,init);
 assert.throws(()=>googleAccountChooserURL(init.replace('ep-lucky-poetry-azjvlwv7','untrusted')));
 assert.throws(()=>googleAccountChooserURL(init.replace('/sign-in/social/init','/other')));
 assert.throws(()=>googleAccountChooserURL(init.split('?')[0]));
});
