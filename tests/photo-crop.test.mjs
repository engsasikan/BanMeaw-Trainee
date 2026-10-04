import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cropPlacement} from '../dist/photo-crop.mjs';
test('portrait starts at the top and can move to the bottom without empty gaps',()=>{
 assert.deepEqual(cropPlacement(400,800,0.64,0,0),{width:256,height:512,x:0,y:0});
 assert.equal(cropPlacement(400,800,0.64,0,-500).y,-256);
 assert.equal(cropPlacement(400,800,0.64,0,500).y,0);
});
test('fit mode preserves the whole portrait and centers it in the frame',()=>{
 assert.deepEqual(cropPlacement(400,800,0.32,0,0),{width:128,height:256,x:64,y:0});
});
test('landscape crop clamps horizontal movement to image edges',()=>{
 assert.equal(cropPlacement(800,400,0.64,-500,0).x,-256);
 assert.equal(cropPlacement(800,400,0.64,500,0).x,0);
});
