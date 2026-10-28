/* Emberfall: Factions — roles, counters, prices, and faction artwork. */
(() => {
 const roleOrder=['assault','tank','spear','archer','cavalry','flyer','boss'];
 const roles={
  assault:{name:'Stormtrupp',cost:55,hp:190,damage:31,speed:46,range:47,interval:.95,armor:.08,radius:18,height:116,pop:1,training:2.0,strong:['spear'],weak:['tank'],ability:'Snabbt anfall',description:'Billig närstrid. Tar spjutförband men stoppas av tankar.'},
  tank:{name:'Tank',cost:110,hp:590,damage:30,speed:25,range:53,interval:1.4,armor:.46,radius:25,height:135,pop:2,training:3.2,strong:['assault','archer'],weak:['spear','flyer'],ability:'Frontpansar',description:'Håller fronten med 46 % pansar. Kan bara slå närmast framför sig.'},
  spear:{name:'Spjut',cost:85,hp:205,damage:37,speed:35,range:210,interval:1.25,armor:.05,radius:18,height:124,pop:1,training:2.5,strong:['cavalry','tank','boss'],weak:['assault','archer','flyer'],ability:'Spjutmur',description:'Når förbi 2–3 egna soldater. Stoppar ruscher och slår hårt mot kavalleri.'},
  archer:{name:'Skytt / Luftvärn',cost:90,hp:145,damage:31,speed:34,range:470,interval:1.45,armor:0,radius:18,height:116,pop:1,training:2.7,strong:['flyer','spear'],weak:['cavalry','tank'],ability:'Luftvärnsfokus',description:'Lång räckvidd. Prioriterar flygare och ger dem extra skada.'},
  cavalry:{name:'Kavalleri',cost:165,hp:405,damage:44,speed:86,range:77,interval:1.15,armor:.15,radius:37,height:161,pop:2,training:4.1,strong:['archer','assault'],weak:['spear','tank'],ability:'Rusch · 8 s',description:'Snabb flanktrupp. Första ruschen slår undan skyttar; spjut stoppar den.'},
  flyer:{name:'Flygare',cost:190,hp:240,damage:31,speed:59,range:145,interval:1.55,armor:.05,radius:26,height:112,pop:2,training:4.2,strong:['tank','spear'],weak:['archer'],ability:'Flyglinje',description:'Flyger över fronten och angriper mark och luft. Sårbar mot luftvärn.'},
  boss:{name:'Jätte / Boss',cost:680,hp:2250,damage:115,speed:21,range:150,interval:3.0,armor:.28,radius:46,height:229,pop:4,training:8.0,strong:['assault','tank'],weak:['archer','spear','flyer'],ability:'Markkross · Områdesskada',description:'Stor och dyr. Krossar grupper på marken men kan inte träffa flygare. En per sida.'}
 };
 const raw=[
  {name:'Fantasy',short:'RUNOR',color:'#b9d3a6',evolveGold:330,evolveXP:200,backgroundFile:'assets/norrmark.webp',baseFile:'assets/watchtower.webp',basePlacement:{x:-8,y:265,w:360,h:480},turretVisual:1,
   names:['Svärdsknekt','Sköldriddare','Hillebardiär','Långbågsskytt','Lansryttare','Stridsgrip','Runjätten'],
   sprites:['unit-1-0','unit-1-2','unit-1-3','unit-1-1','fantasy-cavalry','fantasy-flyer','fantasy-boss'],
   turrets:[['Ballista','steel',135,56,1.3,740,'Tunga bultar mot markmål.'],['Eldkatapult','fire',180,42,1.9,730,'Brinnande områdesskada mot marktrupper.'],['Luftruna','ice',175,34,1.4,810,'Luftvärn som fryser och bromsar flygare.']]},
  {name:'Militär',short:'PANSAR',color:'#b8c69c',evolveGold:650,evolveXP:610,backgroundFile:'assets/themes/military-bg.webp',baseFile:'assets/themes/military-base.webp',basePlacement:{x:-100,y:85,w:451,h:677},turretPositions:[{x:86,y:270},{x:145,y:450},{x:305,y:496}],turretVisual:3,
   names:['Stormsoldat','Pansarvakt','Pansarvärn','Gevärsskytt','Stridsmotorcykel','Attackdrönare','Belägringsmech'],
   sprites:['unit-3-0','unit-3-2','military-pike','unit-3-1','military-cavalry','military-flyer','military-boss'],
   turrets:[['Kulsprutetorn','multi',255,45,.8,840,'Tät markeld i tre projektilbanor.'],['Brandhaubits','fire',325,93,2.0,900,'Brinnande granater mot markgrupper.'],['Luftvärnsspole','lightning',320,76,1.5,900,'Kedjeblixt som prioriterar flygare.']]},
  {name:'Cabaret Royale',short:'CABARET',color:'#e9a3ca',evolveGold:1080,evolveXP:1180,backgroundFile:'assets/themes/cabaret-bg.webp',baseFile:'assets/themes/cabaret-base.webp',basePlacement:{x:-45,y:167,w:395,h:593},turretPositions:[{x:86,y:420},{x:145,y:475},{x:305,y:496}],turretVisual:'cabaret',
   names:['Paljettvakt','Bikini-bjässen','Rosenspjut','Amorskytt','Rosenryttare','Vingprimadonna','Grand Diva'],
   sprites:['cabaret-assault','cabaret-tank','cabaret-pike','cabaret-archer','cabaret-cavalry','cabaret-flyer','cabaret-boss'],
   turrets:[['Hjärtballista','heart',410,150,1.1,900,'Hjärtpilar försvagar fiendens skada.'],['Konfettikanon','bomb',490,235,2.2,940,'Explosiv konfetti mot markgrupper.'],['Hjärtpuls','heart',465,120,1.25,970,'Luftvärn med hjärtpilar och försvagning.']]},
  {name:'Space / Sci-fi',short:'PLASMA',color:'#a2dee6',evolveGold:0,evolveXP:0,backgroundFile:'assets/themes/space-bg.webp',baseFile:'assets/themes/space-base.webp',basePlacement:{x:-100,y:85,w:451,h:677},turretPositions:[{x:86,y:300},{x:145,y:450},{x:305,y:496}],turretVisual:4,
   names:['Vanguard','Exoväktare','Energilans','Pulsskytt','Gravryttare','Voidinterceptor','Atlas-titan'],
   sprites:['unit-4-0','unit-4-2','space-pike','unit-4-1','space-cavalry','space-flyer','space-boss'],
   turrets:[['Pulslans','steel',670,400,1.0,1020,'En stark energibult mot markmål.'],['Plasmatorn','bomb',780,405,2.0,1040,'Plasmaexplosion med stor markradie.'],['Stormspiral','lightning',760,290,1.35,1100,'Luftvärn och kedjeblixt genom fiendens led.']]}
 ];
 const power=[1,1.75,2.7,4.15],prices=[1,1.55,2.25,3.2],units=[],turrets=[];
 const counter={assault:{spear:1.65,tank:.7},tank:{assault:1.2,archer:1.1},spear:{cavalry:2.25,tank:1.85,boss:1.4,assault:.8},archer:{flyer:1.95,spear:1.35,tank:.75,cavalry:.8,boss:1.15},cavalry:{archer:1.85,assault:1.25,spear:.6,tank:.65},flyer:{tank:1.65,spear:1.5,archer:.8},boss:{assault:1.3,tank:1.1,spear:.9}};
 raw.forEach((e,tier)=>{
  e.id=tier;e.unlock=tier?raw[tier-1].evolveXP:0;
  e.unitIds=roleOrder.map((cls,row)=>{
   const r=roles[cls],id=`faction-${tier}-${cls}`,isRocket=tier===1&&cls==='spear';
   const u={...r,id,tier,row,cls,name:e.names[row],sprite:e.sprites[row],role:r.name,description:r.description,cost:Math.round(r.cost*prices[tier]/5)*5,hp:Math.round(r.hp*power[tier]),damage:Math.round(r.damage*power[tier]),range:r.range+(cls==='archer'?tier*25:0),speed:r.speed+(cls==='cavalry'?tier*3:0),ranged:cls==='archer'||isRocket||(cls==='flyer'&&tier>0),air:cls==='flyer',attackAir:cls==='archer'||cls==='flyer',reach:cls==='spear'||cls==='archer'||cls==='flyer'||cls==='boss',aoe:cls==='boss'?135:isRocket?55:0,ability:cls==='tank'&&tier===2?'Rullattack · 9 s':r.ability,roll:cls==='tank'&&tier===2,charge:cls==='cavalry',projectile:tier===2?'heart':tier===3?'pulse':tier===1?'bullet':'arrow',armorPierce:cls==='spear'?.2:0};
   if(cls==='boss')u.limit=1;if(tier===2&&(cls==='archer'||cls==='flyer')){u.ability=cls==='archer'?'Hjärtpilar · Försvagning':'Hjärtpuls · Flyglinje';u.description+=' Hjärtpilar minskar målets skada i 2,5 sekunder.';}
   if(isRocket){u.range=225;u.projectile='shell';}
   if(cls==='flyer'&&tier===0)u.height=135;
   units.push(u);return id;
  });
  e.turretIds=e.turrets.map((a,row)=>{const id=`defense-${tier}-${row}`;turrets.push({id,tier,row,name:a[0],effect:a[1],cost:a[2],damage:a[3],interval:a[4],range:a[5],description:a[6],attackAir:row===2,aoe:a[1]==='bomb'||a[1]==='fire',visualAtlas:tier===2?'cabaret-turrets':'turrets',visualFrame:tier===2?row:e.turretVisual*3+row});return id;});delete e.names;delete e.sprites;delete e.turrets;
 });
 const unitById=Object.fromEntries(units.map(u=>[u.id,u])),turretById=Object.fromEntries(turrets.map(t=>[t.id,t]));
 const artIds=[...new Set(units.map(u=>u.sprite)),'hero','turrets','cabaret-turrets'];
 const themeFiles=[...new Set(raw.flatMap(e=>[e.backgroundFile,e.baseFile]))];
 window.EmberfallContent=Object.freeze({eras:raw,units,turrets,roles,roleOrder,counter,unitById,turretById,artIds,themeFiles,populationCap:24,animations:{walk:[0,1,2,3],idle:[0],attack:[4,5,6],death:[7],roll:[8,9,10,11]},atlasFiles:artIds.map(id=>`assets/sprites/${id}.webp`),heroFile:'assets/sprites/hero.webp',turretFile:'assets/sprites/turrets.webp',counterMultiplier:(attacker,target)=>counter[attacker]?.[target]||1});
})();
