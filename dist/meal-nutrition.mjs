// Calories and protein noted on meals, added up for a day and set against the trainer's goal.
export const mealNumbers=meal=>[meal.kcal!=null?meal.kcal.toLocaleString('th-TH')+' kcal':'',meal.protein!=null?'โปรตีน '+meal.protein.toLocaleString('th-TH')+' g':''].filter(Boolean).join(' · ');
// Totals of the meals that have numbers, and how many meals have none (so a low total can be explained).
export function dayTotals(meals){
 let kcal=0,protein=0,missing=0;
 for(const meal of meals){
  if(meal.kcal==null&&meal.protein==null){missing++;continue;}
  kcal+=meal.kcal??0;protein+=meal.protein??0;
 }
 return {kcal,protein:Math.round(protein*10)/10,missing,meals:meals.length};
}
// Share of a goal reached, for a progress bar: 0–1 for the bar, the real percentage for the text.
export function progress(value,goal){
 if(!(goal>0))return null;
 const ratio=value/goal;
 return {ratio:Math.min(1,ratio),percent:Math.round(ratio*100),over:ratio>1.1};
}
