import {FIELDS,SEGMENTS} from './body-data.mjs?v=4';
import {localDay} from './store.mjs?v=19';

const columns = {
 'น้ำหนัก(kg)':'weight',
 'มวลกล้ามเนื้อโครงร่าง(kg)':'muscle',
 'มวลน้ำหนักไม่รวมไขมัน(kg)':'ffm',
 'มวลไขมันในร่างกาย(kg)':'body_fat_mass',
 'สัดส่วนไขมันในร่างกาย(%)':'body_fat',
 'อัตราการเผาผลาญพื้นฐาน(kcal)':'bmr',
 'คะแนน InBody':'score',
 'รอบเอว(cm)':'waist',
 'ระดับไขมันอวัยวะภายใน(Level)':'visceral',
 'น้ำในร่างกายโดยรวม(L)':'tbw',
 'น้ำภายในเซลล์(L)':'icw',
 'น้ำภายนอกเซลล์(L)':'ecw',
 'ECWอัตราส่วน':'ecw_ratio',
 'โปรตีน(kg)':'protein',
 'แร่ธาตุ(kg)':'minerals',
 'มวลเซลล์ในร่างกาย(kg)':'bcm',
 'ดัชนีมวลกล้ามเนื้อโครงร่าง(kg/m²)':'smi',
 'มุมเฟสของทั้งร่างกาย(°)':'phase_angle',
};
for(const [key,label] of SEGMENTS)columns['มวลน้ำหนักไม่รวมไขมันของ'+label+'(kg)']='mus_'+key;

function readRows(text){
 const rows=[];
 let row=[], offset=0;
 // Read one cell and its separator, including quoted commas, newlines and escaped quotes.
 const cell=/("(?:[^"]|"")*"|[^",\r\n]*)(,|\r\n|\r|\n|$)/y;
 while(offset<text.length){
  cell.lastIndex=offset;
  const match=cell.exec(text);
  if(!match)throw Error('รูปแบบ CSV ไม่ถูกต้อง');
  const [,value,separator]=match;
  row.push(value.startsWith('"')?value.slice(1,-1).replaceAll('""','"').trim():value.trim());
  if(separator!==','){if(row.some(Boolean))rows.push(row);row=[];}
  offset=cell.lastIndex;
 }
 if(row.some(Boolean))rows.push([...row,'']);
 return rows;
}

export function parseInBodyCsv(text){
 const [header,...rows]=readRows(text.replace(/^\uFEFF/,''));
 const dateIndex=header?.indexOf('วันที่')??-1;
 const fields=(header??[]).flatMap((name,index)=>Object.hasOwn(columns,name)?[[index,columns[name]]]:[]);
 if(dateIndex<0||!fields.length||!rows.length)throw Error('ไม่พบข้อมูลในไฟล์ CSV ของ InBody');
 return rows.map((row,index)=>{
  if(row.length!==header.length)throw Error('จำนวนคอลัมน์ไม่ตรงกับหัวตารางในรายการที่ '+(index+1));
  const stamp=row[dateIndex];
  if(!/^\d{14}$/.test(stamp))throw Error('อ่านวันที่วัดจากไฟล์ InBody ไม่ได้');
  const day=stamp.slice(0,4)+'-'+stamp.slice(4,6)+'-'+stamp.slice(6,8);
  if(localDay(new Date(day+'T12:00:00'))!==day)throw Error('วันที่วัดในไฟล์ InBody ไม่ถูกต้อง');
  const values={};
  for(const [column,key] of fields){
   const raw=row[column];
   if(raw===''||raw==='-')continue;
   const value=Number(raw),{min,max,dp,label}=FIELDS[key];
   if(!Number.isFinite(value)||value<min||value>max)throw Error('ตรวจสอบค่า '+label+' ในรายการที่ '+(index+1));
   values[key]=Math.round(value*10**dp)/10**dp;
  }
  if(!Object.keys(values).length)throw Error('ไม่พบค่าที่นำเข้าได้ในรายการที่ '+(index+1));
  return {day,time:stamp.slice(8,10)+':'+stamp.slice(10,12),values};
 });
}
