// Keep the crop inside the photo; smaller photos are centered on the frame.
export function cropPlacement(width,height,scale,x,y,size=256){
 const w=width*scale,h=height*scale;
 return {width:w,height:h,x:w<size?(size-w)/2:Math.max(size-w,Math.min(0,x)),y:h<size?(size-h)/2:Math.max(size-h,Math.min(0,y))};
}
