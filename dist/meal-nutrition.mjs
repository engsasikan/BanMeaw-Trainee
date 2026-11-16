// Calories, protein and carbohydrate noted on meals, added up for a day and set against the daily goal.
const grams=value=>value.toLocaleString('th-TH');
export const mealNumbers=meal=>[meal.kcal!=null?meal.kcal.toLocaleString('th-TH')+' kcal':'',meal.protein!=null?'โปรตีน '+grams(meal.protein)+' g':'',meal.carbs!=null?'คาร์บ '+grams(meal.carbs)+' g':''].filter(Boolean).join(' · ');
const hasNumbers=meal=>meal.kcal!=null||meal.protein!=null||meal.carbs!=null;
// Totals of the meals that have numbers, and how many meals have none (so a low total can be explained).
export function dayTotals(meals){
 let kcal=0,protein=0,carbs=0,missing=0;
 for(const meal of meals){
  if(!hasNumbers(meal)){missing++;continue;}
  kcal+=meal.kcal??0;protein+=meal.protein??0;carbs+=meal.carbs??0;
 }
 const round=v=>Math.round(v*10)/10;
 return {kcal,protein:round(protein),carbs:round(carbs),missing,meals:meals.length};
}
// "1,150 kcal · โปรตีน 42 g · คาร์บ 130 g" for summaries sent to a trainer.
export const totalsText=t=>t.kcal.toLocaleString('th-TH')+' kcal · โปรตีน '+grams(t.protein)+' g · คาร์บ '+grams(t.carbs)+' g';
// Share of a goal reached, for a progress bar: 0–1 for the bar, the real percentage for the text.
export function progress(value,goal){
 if(!(goal>0))return null;
 const ratio=value/goal;
 return {ratio:Math.min(1,ratio),percent:Math.round(ratio*100),over:ratio>1.1};
}
