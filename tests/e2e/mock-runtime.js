// Mock of the viewer runtime: db with frozen snapshot data (like a real Firestore-style client), user, sample, assets
(function(){
const store=Object.assign({},window.__seed||{});const subs=[];
const deepFreeze=o=>{if(o&&typeof o==="object"){Object.freeze(o);Object.values(o).forEach(deepFreeze)}return o};
const snap=()=>({docs:Object.keys(store).map(id=>({id,exists:true,data:()=>deepFreeze(JSON.parse(JSON.stringify(store[id]))),metadata:{}})),size:0,empty:false,metadata:{}});
const fire=()=>setTimeout(()=>subs.forEach(f=>f(snap())),20);
const coll={doc:id=>({id,set:async d=>{JSON.stringify(d,(k,v)=>{if(v===undefined)throw {code:"invalid_argument",message:"undefined at "+k};return v});store[id]=JSON.parse(JSON.stringify(d));fire()},delete:async()=>{delete store[id];fire()}}),onSnapshot:(f)=>{subs.push(f);fire();return()=>{}}};
window.__store=store;
const sample=async()=>({text:""});
sample.json=async(input,opts)=>{if(/barcode number/.test(input))return {code:"0123456789012"};if(/Nutrition Facts/.test(input))return {name:"Test Bar",serving:"1 bar (60 g)",kcal:230,p:20,c:24,f:8};if(/RingConn/.test(input))return {sleepH:7.4,sleepScore:82,rhr:58,hrv:44};return {items:[{name:"Chicken breast",serving:"150 g",grams:150,kcal:248,p:46.5,c:0,f:5.4},{name:"White rice",serving:"1 cup (158 g)",grams:158,kcal:205,p:4.3,c:45,f:0.4}]}};
sample.limits=async()=>({images:{max:4}});
const caps={db:{collection:()=>coll},user:{id:async()=>"u1"},sample,assets:{upload:async()=>({id:"a1",url:"/x"}),delete:async()=>{}}};
window.claude={use:n=>new Promise(r=>setTimeout(()=>r(caps[n]||null),50))};
})();
