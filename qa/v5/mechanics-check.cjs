const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const elem=()=>({classList:{add(){},remove(){},toggle(){}},style:{setProperty(){}},dataset:{},addEventListener(){},setAttribute(){},querySelector(){return elem();},getContext(){return {};},getBoundingClientRect(){return {left:0,top:0,width:1600,height:900};},clientWidth:1600,clientHeight:900});
const events={};const els=new Map(),sandbox={console,Math,JSON,Map,Set,Promise,Float64Array,Image:class{},performance:{now:()=>0},requestAnimationFrame(){},matchMedia:()=>({matches:false}),innerWidth:1600,innerHeight:900,devicePixelRatio:1,localStorage:{getItem:()=>null,setItem(){}},document:{getElementById(id){if(!els.has(id))els.set(id,elem());return els.get(id);},querySelectorAll:()=>[],addEventListener(){},createElement:elem},window:{addEventListener(name,fn){events[name]=fn;}} };
vm.createContext(sandbox);for(const file of ['content.js','atlas-data.js','strategy.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox);
const instrument=`window.test={C,A,state,camera,panKeys,pointer,resize,aimAt,updateCamera,animationFrame,gaitPhase,strideLength,panTo,maxCamera,update,retireUnit,startGame,startWave,endWave,evolve,recruit,createFighter,targetFor,formationBlocked,canHit,hurt,performStrike,tryClassAbility,population,syncTheme,buildTurret,upgradeTurret,sellTurret,buyForge,fire,updateAim,castRain,canEvolve,togglePause,ready(){loaded=true;},actors:()=>fighters,shots:()=>projectiles,hazards:()=>hazards,rings:()=>rings,training:()=>trainingQueue,scene(list){fighters=list;spawnQueue=[];projectiles=[];hazards=[];trainingQueue=[];state.mode='play';},next(){state.wave++;hideOverlays();startWave();}};`;
vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8').replace(/\}\)\(\);\s*$/,instrument+'})();'),sandbox);const g=sandbox.window.test;g.ready();
const results=[];const id=(tier,cls)=>'faction-'+tier+'-'+cls;
function test(name,fn){g.startGame();fn();results.push(name);}
function tick(seconds){for(let i=0;i<Math.ceil(seconds*120);i++)g.update(1/120);}
function actor(cls,side,x,tier=0){const f=g.createFighter(id(tier,cls),side,x);f.attackCooldown=0;return f;}
function freeze(f){f.anim='attack';f.pendingStrike=false;f.animTime=-100;f.attackCooldown=999;return f;}
test('Four factions provide seven classes each and twelve distinct defenses',()=>{assert.equal(g.C.eras.length,4);assert.equal(g.C.units.length,28);assert.equal(g.C.turrets.length,12);for(const e of g.C.eras){assert.equal(e.unitIds.length,7);assert.equal(e.turretIds.length,3);}});
test('Tank cannot attack through friendly troops',()=>{const t=actor('tank',1,600),friend=freeze(actor('assault',1,625)),enemy=freeze(actor('tank',-1,650));g.scene([t,friend,enemy]);const hp=enemy.hp;assert.equal(g.targetFor(t).blocked,true);tick(.5);assert.equal(enemy.hp,hp);});
test('Spears attack from behind three allied soldiers',()=>{const p=actor('spear',1,500),friends=[550,590,630].map(x=>freeze(actor('tank',1,x))),enemy=freeze(actor('tank',-1,690));g.scene([p,...friends,enemy]);assert.equal(g.targetFor(p).blocked,false);const hp=enemy.hp;tick(.4);assert.ok(enemy.hp<hp);});
test('Ground tanks and spears cannot hit a flyer',()=>{const t=actor('tank',1,600),p=actor('spear',1,620),air=freeze(actor('flyer',-1,650));g.scene([t,p,air]);assert.equal(g.canHit(t,air),false);assert.equal(g.canHit(p,air),false);const hp=air.hp;tick(1);assert.equal(air.hp,hp);});
test('Archers prioritize and damage flyers over nearer ground targets',()=>{const a=actor('archer',1,500),tank=freeze(actor('tank',-1,650)),air=freeze(actor('flyer',-1,780));g.scene([a,tank,air]);assert.equal(g.targetFor(a).target.id,air.id);const tankHP=tank.hp,airHP=air.hp;tick(1.2);assert.equal(tank.hp,tankHP);assert.ok(air.hp<airHP);});
test('Archers deal a real anti-air counter bonus',()=>{const a=actor('archer',1,500),air=actor('flyer',-1,700),tank=actor('tank',-1,800);g.scene([a,air,tank]);const airHP=air.hp,tankHP=tank.hp;g.hurt(air,100,{attacker:a});g.hurt(tank,100,{attacker:a});assert.ok(airHP-air.hp>(tankHP-tank.hp)*3);});
test('A spear wall cancels a cavalry charge and stuns the rider',()=>{const p=freeze(actor('spear',1,600)),c=actor('cavalry',-1,760);c.chargeDistance=200;g.scene([p,c]);const hp=c.hp;g.update(.01);assert.ok(c.stun>0);assert.ok(c.hp<hp);assert.equal(p.hp,p.maxHp);});
test('An unbraced cavalry charge punishes an archer',()=>{const a=freeze(actor('archer',-1,740)),c=actor('cavalry',1,600);c.chargeDistance=200;g.scene([c,a]);g.update(.01);assert.ok(a.hp<=0||a.hp<a.maxHp*.2);assert.ok(c.abilityCooldown>7);});
test('Jumps in technology cannot skip the completed-siege requirement',()=>{g.state.gold=50000;g.state.xp=50000;assert.equal(g.canEvolve(),false);g.state.lastClearedWave=1;assert.equal(g.evolve(),true);assert.equal(g.state.era,1);assert.equal(g.evolve(),false);g.state.lastClearedWave=2;assert.equal(g.evolve(),true);assert.equal(g.state.era,2);});
test('Either side immediately selects the new world background',()=>{g.state.enemyEra=1;g.syncTheme();assert.equal(g.state.worldTheme,1);g.state.gold=50000;g.state.xp=50000;g.state.lastClearedWave=1;g.evolve();g.state.lastClearedWave=2;g.evolve();assert.equal(g.state.worldTheme,2);g.state.enemyEra=3;g.syncTheme();assert.equal(g.state.worldTheme,3);});
test('Bikini tank rolls through multiple ground targets',()=>{const t=actor('tank',1,600,2),a=freeze(actor('assault',-1,655,2)),b=freeze(actor('assault',-1,710,2));g.scene([t,a,b]);const ah=a.hp,bh=b.hp;tick(.7);assert.ok(a.hp<ah&&b.hp<bh);assert.ok(t.x>700);assert.ok(t.abilityCooldown>8);});
test('A spear interrupts the roll before it plows through the line',()=>{const t=actor('tank',1,600,2),p=freeze(actor('spear',-1,670,2));g.scene([t,p]);tick(.3);assert.equal(t.rollTime,0);assert.ok(t.stun>0);assert.ok(t.x<700);});
test('Heart arrows apply a temporary damage debuff',()=>{const a=actor('archer',1,500,2),enemy=freeze(actor('tank',-1,700,2));g.scene([a,enemy]);tick(1.0);assert.ok(enemy.charm>0);const victim=actor('tank',1,730,2),hp=victim.hp;g.hurt(victim,100,{attacker:enemy});const debuffed=hp-victim.hp;victim.hp=hp;enemy.charm=0;g.hurt(victim,100,{attacker:enemy});assert.ok(debuffed<hp-victim.hp);});
test('Giant slam has a warning and damages groups only on the ground',()=>{const boss=actor('boss',1,600),a=freeze(actor('tank',-1,660)),b=freeze(actor('assault',-1,720)),air=freeze(actor('flyer',-1,690));g.scene([boss,a,b,air]);const ah=a.hp,bh=b.hp,airHP=air.hp;tick(.35);assert.equal(a.hp,ah);assert.ok(g.rings().some(r=>r.telegraph));tick(.4);assert.ok(a.hp<ah&&b.hp<bh);assert.equal(air.hp,airHP);});
test('Only one own giant may be deployed or queued',()=>{g.state.gold=10000;assert.equal(g.recruit(id(0,'boss')),true);assert.equal(g.recruit(id(0,'boss')),false);assert.equal(g.population(),4);});
test('Population accounts for heavy units and reservations in the training queue',()=>{const list=[];for(let i=0;i<11;i++)list.push(actor('tank',1,400+i*60));g.scene(list);g.state.gold=10000;assert.equal(g.recruit(id(0,'cavalry')),true);assert.equal(g.population(),24);assert.equal(g.recruit(id(0,'assault')),false);});
test('Ground defenses ignore flyers while anti-air defenses engage them',()=>{g.state.gold=10000;const air=freeze(actor('flyer',-1,650));g.scene([air]);g.buildTurret('defense-0-0',2);tick(1.4);assert.equal(g.state.slots[2].shots,0);g.buildTurret('defense-0-2',2);const hp=air.hp;tick(1.5);assert.ok(g.state.slots[2].shots>0);assert.ok(air.hp<hp);});
test('Recruitment charges distinct class prices and trains units',()=>{g.state.gold=10000;g.scene([]);const before=g.state.gold;g.recruit(id(0,'assault'));g.recruit(id(0,'flyer'));assert.equal(g.state.gold,before-g.C.unitById[id(0,'assault')].cost-g.C.unitById[id(0,'flyer')].cost);tick(7);assert.ok(g.actors().some(f=>f.side===1&&g.C.unitById[f.defId].air));});
test('Pausing freezes income, ability timers and movement',()=>{const f=actor('cavalry',1,400);g.scene([f]);f.abilityCooldown=5;g.togglePause();const cash=g.state.gold,x=f.x;tick(1);assert.equal(g.state.gold,cash);assert.equal(f.x,x);assert.equal(f.abilityCooldown,5);});
test('Twelfth siege completes the four-theme campaign',()=>{g.state.wave=12;g.state.enemyHP=0;g.update(.01);assert.equal(g.state.mode,'won');g.startGame();assert.equal(g.state.era,0);assert.equal(g.state.lastClearedWave,0);});

test('Every faction sprite is present with full animation frames',()=>{for(const u of g.C.units){assert.ok(g.A[u.sprite],u.sprite);assert.equal(g.A[u.sprite].frames.length,u.roll?12:8);}assert.equal(g.A['cabaret-turrets'].frames.length,3);assert.equal(new Set(g.C.themeFiles).size,8);});
test('Retiring a veteran releases population and refunds only twenty percent',()=>{const f=actor('boss',1,400);g.scene([f]);const cash=g.state.gold,cost=g.C.unitById[f.defId].cost;assert.equal(g.retireUnit(f.id),true);assert.equal(g.population(),0);assert.equal(g.state.gold,cash+Math.floor(cost*.2));assert.equal(g.recruit(id(0,'boss')),true);});

test('All twelve defenses can be bought and fire on their intended targets',()=>{for(let tier=0;tier<4;tier++)for(const tid of g.C.eras[tier].turretIds){g.startGame();g.state.era=tier;g.state.gold=20000;const d=g.C.turretById[tid],target=freeze(actor(d.attackAir?'flyer':'tank',-1,650,3));g.scene([target]);assert.equal(g.buildTurret(tid,2),true);const hp=target.hp;tick(2);assert.ok(g.state.slots[2].shots>0,tid);assert.ok(target.hp<hp,tid);}});


test('Walk cycles track actual distance in every class and faction',()=>{for(const d of g.C.units.filter(d=>!d.air)){const f=g.createFighter(d.id,1,400);f.gaitOffset=0;g.scene([f]);tick(.7);assert.ok(Math.abs(f.walkDistance-(f.x-400))<1e-7,d.id);assert.equal(g.animationFrame(f),Math.floor(f.walkDistance/g.strideLength(d)%1*4));assert.ok(d.speed/g.strideLength(d)*4<6,d.id+' must avoid frantic fixed-rate stepping');}});
test('Formation-blocked troops stop stepping instead of walking in place',()=>{const f=actor('tank',1,400),front=freeze(actor('tank',1,450));g.scene([f,front]);tick(.5);assert.equal(f.x,400);assert.equal(f.walkDistance,0);assert.equal(f.anim,'idle');});
test('Frost slows the animation by exactly the distance lost',()=>{const f=actor('assault',1,400);g.scene([f]);f.gaitOffset=0;tick(.25);const normal=f.walkDistance;f.walkDistance=0;f.x=400;f.frost=3;tick(.25);assert.ok(Math.abs(f.walkDistance-normal*.35)<1e-7);});
test('Hovering flyers flap independently and freeze with pause',()=>{const f=actor('flyer',1,600),target=freeze(actor('tank',-1,680));f.attackCooldown=10;f.flightTime=0;g.scene([f,target]);const x=f.x;tick(.3);assert.equal(f.x,x);assert.equal(f.walkDistance,0);assert.ok(f.flightTime>.29);assert.equal(g.animationFrame(f),1);g.togglePause();const t=f.flightTime,frame=g.animationFrame(f);tick(.4);assert.equal(f.flightTime,t);assert.equal(g.animationFrame(f),frame);});
test('The world keeps its length and troops keep their position when resizing',()=>{const f=actor('cavalry',1,1950);g.scene([f]);const before=sandbox.window.Emberfall.snapshot();sandbox.innerWidth=844;sandbox.innerHeight=390;g.resize();assert.equal(f.x,1950);assert.equal(sandbox.window.Emberfall.snapshot().world.width,3200);assert.notEqual(sandbox.window.Emberfall.snapshot().camera.viewWidth,before.camera.viewWidth);sandbox.innerWidth=1600;sandbox.innerHeight=900;g.resize();});
test('A/D and arrow keys pan, clamp, and release correctly',()=>{g.scene([]);events.keydown({code:'KeyD',key:'d',preventDefault(){}});tick(1);assert.ok(g.camera.x>650);events.keyup({code:'KeyD'});tick(1);const stopped=g.camera.x;tick(.5);assert.ok(Math.abs(stopped-g.camera.x)<.2);events.keydown({code:'ArrowRight',key:'ArrowRight',preventDefault(){}});tick(6);assert.equal(g.camera.x,g.maxCamera());events.keyup({code:'ArrowRight'});events.keydown({code:'ArrowLeft',key:'ArrowLeft',preventDefault(){}});tick(6);assert.equal(g.camera.x,0);events.keyup({code:'ArrowLeft'});});
test('Edge scrolling requires the battlefield and ignores touch input',()=>{g.scene([]);g.pointer.x=1598;g.pointer.inside=false;tick(.5);assert.equal(g.camera.x,0);g.pointer.inside=true;g.pointer.touch=true;tick(.5);assert.equal(g.camera.x,0);g.pointer.touch=false;tick(.5);assert.ok(g.camera.x>250);});
test('Pausing clears held camera input and freezes the camera',()=>{g.scene([]);g.panKeys.add('KeyD');tick(.2);g.togglePause();const x=g.camera.x;assert.equal(g.panKeys.size,0);tick(.4);assert.equal(g.camera.x,x);g.togglePause();tick(.4);assert.equal(g.camera.x,x);});
test('Pointer aim stays attached to the correct world point while panning',()=>{g.scene([]);g.camera.x=800;g.aimAt({clientX:900,clientY:500,pointerType:'mouse'});const scale=sandbox.window.Emberfall.snapshot().world.scale;assert.ok(Math.abs(g.state.aim.x-(800+900/scale))<1e-7);g.panKeys.add('KeyD');tick(.3);assert.ok(Math.abs(g.state.aim.x-(g.camera.x+900/scale))<1e-7);});
test('Map and base navigation settle at the destination without overshooting',()=>{g.scene([]);g.panTo(1000);tick(1);assert.ok(Math.abs(g.camera.x-1000)<.5);g.panTo(99999);tick(1);assert.equal(g.camera.x,g.maxCamera());g.panTo(0);tick(1);assert.equal(g.camera.x,0);});
test('A full-power arrow can hit a distant target across the extended field',()=>{const f=freeze(actor('tank',-1,2730));g.scene([f]);g.state.charge=1;g.state.aim={x:f.x,y:f.y-f.height*.7};g.updateAim();assert.equal(g.fire(),true);const hp=f.hp;tick(3.5);assert.ok(f.hp<hp);});

test('The complete twelve-siege tactical campaign is winnable through real combat',()=>{
 let shotTimer=0,commandTimer=0,recruited=0,towerBuilds=0,retired=0;
 for(let frame=0;frame<120*1800&&g.state.mode!=='won'&&g.state.mode!=='lost';frame++){
  const dt=1/120;if(g.state.mode==='shop'){if(g.canEvolve())g.evolve();g.next();}
  shotTimer-=dt;commandTimer-=dt;
  if(commandTimer<=0){
   if(g.canEvolve())g.evolve();
   const era=g.C.eras[g.state.era],allies=g.actors().filter(f=>f.side===1&&f.hp>0),enemies=g.actors().filter(f=>f.side===-1&&f.hp>0),own=cls=>allies.filter(f=>g.C.unitById[f.defId].cls===cls).length,foe=cls=>enemies.filter(f=>g.C.unitById[f.defId].cls===cls).length;
   if(g.state.hp<g.state.maxHp*.55)g.buyForge('wall');
   if(g.state.upgrades.bow<g.state.era+1&&g.state.gold>200)g.buyForge('bow');
   const old=allies.find(f=>g.C.unitById[f.defId].tier<g.state.era);
   if(old&&g.population()>=15&&g.state.gold>g.C.unitById[id(g.state.era,g.C.unitById[old.defId].cls)].cost+100){if(g.retireUnit(old.id))retired++;}
   const saving=g.state.era<3&&g.state.xp>=era.evolveXP&&g.population()>=10;
   let cls=own('tank')<1?'tank':foe('flyer')>own('archer')?'archer':foe('cavalry')>own('spear')?'spear':['spear','archer','assault','cavalry','flyer','archer'][recruited%6];
   if(g.population()<17&&!saving){if(g.recruit(id(g.state.era,cls)))recruited++;}
   const turret=g.state.slots[2];if(allies.length>=2&&(!turret||g.C.turretById[turret.id].tier<g.state.era)&&g.state.gold>g.C.turretById[era.turretIds[2]].cost+120){if(g.buildTurret(era.turretIds[2],2))towerBuilds++;}
   if(enemies.length>6&&g.state.mana>=60)g.castRain();commandTimer=.6;
  }
  if(shotTimer<=0){
   const targets=g.actors().filter(f=>f.side===-1&&f.hp>0).sort((a,b)=>(a.boss?-1000:0)+a.x-(b.boss?-1000:0)-b.x),e=targets[0];g.state.charge=1;
   if(e){const d=g.C.unitById[e.defId],speed=1100*(1+g.state.upgrades.bow*.025),flight=(e.x-267)/speed;g.state.aim={x:e.x-(e.anim==='walk'?d.speed*(e.frost>0?.35:1):0)*flight,y:e.y-e.height*.85};}
   else g.state.aim={x:1400,y:590};g.updateAim();g.fire();shotTimer=.95;
  }
  g.update(dt);
 }
 console.log(JSON.stringify({mode:g.state.mode,wave:g.state.wave,era:g.state.era+1,kills:g.state.kills,recruited,towerBuilds,retired,seconds:Math.round(g.state.elapsed),hp:g.state.hp}));
 assert.equal(g.state.mode,'won');assert.equal(g.state.era,3);assert.ok(g.state.kills>90);assert.ok(recruited>10);assert.ok(towerBuilds>=1);
});

console.log(JSON.stringify({passed:results.length,checks:results},null,2));

