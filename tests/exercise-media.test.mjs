import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {gifFor, GIF_IDS} from '../dist/exercise-media.mjs';
import {mediaKey} from '../dist/exercise-media-key.mjs';
import {LIBRARY} from '../dist/exercise-library.mjs';

test('library names find their ExerciseDB GIF regardless of case and punctuation', () => {
 assert.equal(mediaKey('3/4 Sit-up'), mediaKey('3/4 sit-up (male)'));
 assert.match(gifFor('3/4 Sit-up'), /^https:\/\/static\.exercisedb\.dev\/media\/[A-Za-z0-9]+\.gif$/);
});

test('names without a match, Thai names and empty input get no GIF', () => {
 assert.equal(gifFor('วิ่ง'), null);
 assert.equal(gifFor(''), null);
 assert.equal(gifFor(undefined), null);
 assert.equal(gifFor('Not A Real Exercise Name'), null);
});

test('every mapped key belongs to a library exercise', () => {
 const keys = new Set(LIBRARY.map(([name]) => mediaKey(name)));
 for (const key of Object.keys(GIF_IDS)) assert.ok(keys.has(key), key);
 assert.ok(Object.keys(GIF_IDS).length > 900);
});

test('the preview uses GIFs first and falls back to 3D only for the current selection', async () => {
 const element = (tag, className) => ({tag, className, children:[], setAttribute(){},
  append(...children){this.children.push(...children);},
  replaceChildren(...children){this.children=children;}, remove(){}});
 const find = (root, predicate) => predicate(root) ? root : root.children.flatMap(child =>
  typeof child === 'object' ? find(child,predicate) ?? [] : [])[0];
 globalThis.document={getElementById:()=>null,createElement:tag=>element(tag)};
 globalThis.window=new EventTarget();
 globalThis.matchMedia=()=>({matches:false});
 const output=await build({entryPoints:['dist/exercise-preview.mjs'],bundle:true,write:false,format:'esm',platform:'node',
  plugins:[{name:'3d-test-adapter',setup(plugin){
   plugin.onResolve({filter:/body3d\.js/},()=>({path:'body3d',namespace:'test'}));
   plugin.onLoad({filter:/.*/,namespace:'test'},()=>({contents:
    'export function mountBody(stage){stage.mounted=true;return {update(){},setPlaying(){},hasMotion(){return true;}};}'}));
  }}]});
 const originalTimeout=globalThis.setTimeout;
 globalThis.setTimeout=()=>0;
 let createMuscleFocus;
 try{
  ({createMuscleFocus}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64')));
 }finally{globalThis.setTimeout=originalTimeout;}
 const view=createMuscleFocus();
 const stage=find(view.el,node=>node.className==='ex-focus-stage');
 const gif=find(view.el,node=>node.className==='ex-gif');
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 view.show('Barbell Bench Press');await settle();
 const first=gif.children[0];
 assert.equal(first.src,gifFor('Barbell Bench Press'));
 assert.equal(stage.hidden,true);
 assert.equal(stage.mounted,undefined);
 view.show('3/4 Sit-up');await settle();
 assert.equal(gif.children[0].src,gifFor('3/4 Sit-up'));
 first.onerror();
 assert.equal(gif.hidden,false);
 gif.children[0].onerror();await settle();
 assert.equal(gif.hidden,true);
 assert.equal(stage.hidden,false);
 assert.equal(stage.mounted,true);
 view.destroy();
});
