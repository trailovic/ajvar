export type Ingredient={amount:string;unit:string;name:string};
export type Recipe={id:string;owner:string;title:string;description:string;course:string;cuisine:string;tags:string;ingredients:Ingredient[];steps:string[];prep:number;cook:number;servings:number;visibility:'private'|'kitchen'|'public';kitchenIds:string[];image:string;revision:number;author:string;createdAt:string;credit?:{label:string;url:string}};
export type Profile={id:string;username:string;name:string;email:string};
export type Kitchen={id:string;name:string;owner:string;members:{id:string;username:string;name:string}[]};
export type Snapshot={user:{id:string;email:string;name:string}|null;profile:Profile|null;kitchens:Kitchen[];recipes:Recipe[]};
export const blankRecipe=():Recipe=>({id:'',owner:'',title:'',description:'',course:'Dinner',cuisine:'',tags:'',ingredients:[{amount:'',unit:'',name:''}],steps:[''],prep:10,cook:20,servings:4,visibility:'private',kitchenIds:[],image:'',revision:0,author:'',createdAt:''});
export function matchesRecipe(r:Recipe,q:string){const hay=[r.title,r.description,r.course,r.cuisine,r.tags,...r.ingredients.map(i=>i.name)].join(' ').normalize('NFKD').toLowerCase();return q.normalize('NFKD').toLowerCase().trim().split(/\s+/).every(term=>hay.includes(term));}
export function mealAt(hour:number){return hour>=5&&hour<11?'Breakfast':hour>=11&&hour<16?'Lunch':'Dinner';}
