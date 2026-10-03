// Z-Anatomy / BodyParts3D derivative model, CC BY-SA 4.0.
// Input: original MuscularSystem100.fbx. Run: node scripts/build-anatomy.mjs input.fbx
import fs from 'node:fs';
import * as THREE from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'meshoptimizer';
await MeshoptSimplifier.ready;
const bytes=fs.readFileSync(process.argv[2]);
const model=new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
model.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=1.75/size.y;
const parts=[[],[]];let originals=0;
model.traverse(mesh=>{
 if(!mesh.isMesh)return;
 if(/fascia/i.test(mesh.name)&&!/Tensor_fasciae/i.test(mesh.name))return;
 let geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);
 for(const key of Object.keys(geometry.attributes))if(key!=='position')geometry.deleteAttribute(key);
 geometry=mergeVertices(geometry,0.00001);
 const positions=geometry.attributes.position.array,indices=new Uint32Array(geometry.index.array);originals+=indices.length/3;
 const target=Math.max(36,Math.floor(indices.length*0.13/3)*3);
 const [simplified]=MeshoptSimplifier.simplify(indices,positions,3,Math.min(indices.length,target),0.015,['LockBorder']);
 const remap=new Map(),p=[],ix=[];
 for(const old of simplified){if(!remap.has(old)){remap.set(old,remap.size);p.push((positions[old*3]-center.x)*scale,(positions[old*3+1]-bounds.min.y)*scale,(positions[old*3+2]-center.z)*scale);}ix.push(remap.get(old));}
 const compact=new THREE.BufferGeometry();compact.setAttribute('position',new THREE.Float32BufferAttribute(p,3));compact.setIndex(ix);compact.computeVertexNormals();
 const connective=/tendon|sheath|aponeuros|retinacul|ligament/i.test(mesh.name);
 parts[connective?1:0].push({name:mesh.name,p:new Float32Array(p),n:compact.attributes.normal.array,i:new Uint32Array(ix)});
 geometry.dispose();compact.dispose();
});
const ordered=parts.flat(),nv=ordered.reduce((s,p)=>s+p.p.length/3,0),ni=ordered.reduce((s,p)=>s+p.i.length,0);
const buffer=Buffer.alloc(16+nv*24+ni*4);buffer.write('ANM1');buffer.writeUInt32LE(nv,4);buffer.writeUInt32LE(ni,8);buffer.writeUInt32LE(parts[0].reduce((s,p)=>s+p.i.length,0),12);
const positions=new Float32Array(buffer.buffer,buffer.byteOffset+16,nv*3),normals=new Float32Array(buffer.buffer,buffer.byteOffset+16+nv*12,nv*3),indices=new Uint32Array(buffer.buffer,buffer.byteOffset+16+nv*24,ni);
let v=0,i=0;const manifest=[];
for(const part of ordered){positions.set(part.p,v*3);normals.set(part.n,v*3);indices.set(part.i.map(x=>x+v),i);manifest.push({name:part.name,indexStart:i,indexCount:part.i.length});v+=part.p.length/3;i+=part.i.length;}
fs.mkdirSync('dist/models',{recursive:true});fs.writeFileSync('dist/models/anatomy-muscles.bin',buffer);
fs.writeFileSync('dist/models/anatomy-muscles.json',JSON.stringify({source:'Z-Anatomy / BodyParts3D',license:'CC BY-SA 4.0',modified:'Decimated, merged and normalized for BanMeaw web viewer',sourceTriangles:originals,triangles:ni/3,meshes:manifest},null,2));
console.log(JSON.stringify({vertices:nv,triangles:ni/3,originalTriangles:originals,bytes:buffer.length,structures:ordered.length,bounds:size.toArray()}));

