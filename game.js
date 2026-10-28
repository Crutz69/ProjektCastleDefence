/* Emberfall: Ages. Whole-frame sprite animation; no body-part compositing. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),C=window.EmberfallContent,S=window.EmberfallStrategy,A=window.EmberfallAtlasData||{};
  const canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false});
  const TAU=Math.PI*2,GRAVITY=330,HERO={x:267,y:428},HERO_FEET={x:225,y:496},MAX_WAVES=12;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rng=(a,b)=>a+Math.random()*(b-a),fmt=n=>Math.floor(n).toLocaleString('sv-SE');
  const W=3200,H=900;
  let viewWidth=1600,dpr=1,viewScale=1,viewOffsetY=0,sceneBackdrop,clock=0,last=performance.now(),staticLayer,uiClock=0,toastClock=0,bannerClock=0,unitId=1;
  let fighters=[],projectiles=[],particles=[],texts=[],corpses=[],rings=[],hazards=[],spawnQueue=[],trainingQueue=[];
  let themeBlend=0,previousBackdrop=null,currentTheme=0;
  let armySignature='',selectedDifficulty='veteran',director=null,lastResult=null,tipKey='';
  const CHECKPOINT='emberfall-campaign-v5';
  let spawnTimer=0,loaded=false,tab='troops',selectedTurret=null,selectedSlot=0,codexEra=0,codexAnimation='walk',codexPrevious='intro',audio,ambient,wind,soundEnabled=false;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state={mode:'intro',era:0,wave:1,gold:560,xp:0,hp:1600,maxHp:1600,enemyHP:850,enemyMaxHP:850,enemyEra:0,mana:100,charge:0,charging:false,aim:{x:920,y:635},angle:.1,recoil:0,fireCooldown:0,rainCooldown:0,shake:0,kills:0,shots:0,hits:0,headshots:0,combo:0,comboTime:0,elapsed:0,waveKills:0,waveStart:0,upgrades:{bow:0,wall:0,income:0},slots:[null,null,null],trainingProgress:0,lastClearedWave:0,lastEvolveWave:0,worldTheme:0,difficulty:'veteran',speed:1,doctrine:'none',nextDoctrine:'logistics',rallyCooldown:0,waveLosses:0,waveShots:0,waveHits:0,waveXP:0,gateExposed:false,tipsMuted:false};
  // Camera coordinates never alter simulation coordinates or troop positions.
  const camera={x:0,velocity:0,target:null},panKeys=new Set(),pointer={x:0,y:0,inside:false,known:false,touch:false};
  const assets=new Map();
  const embedded=window.EmberfallEmbeddedAssets||{};
  function loadImage(file){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{
    // Alpha-test very faint generation halos as a normal texture import step.
    // The source sheets stay intact and each animation frame remains a whole figure.
    let texture=img;try{const off=document.createElement('canvas');off.width=img.width;off.height=img.height;const q=off.getContext('2d'),pixels=(q.drawImage(img,0,0),q.getImageData(0,0,off.width,off.height));for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]<64)pixels.data[i]=0;q.putImageData(pixels,0,0);texture=off;}catch{}
    assets.set(file,texture);resolve(texture);
  };img.onerror=()=>reject(new Error(file));img.src=embedded[file]||file;});}
  const background=new Image();background.src=embedded['assets/norrmark.webp']||'assets/norrmark.webp';background.onload=()=>{staticLayer=null;sceneBackdrop=null;};
  const castleArt=new Image();castleArt.src=embedded['assets/watchtower.webp']||'assets/watchtower.webp';
  const dust=Array.from({length:35},()=>({x:rng(0,1800),y:rng(230,840),z:rng(.2,1),p:rng(0,TAU)}));
  const leaves=Array.from({length:11},()=>({x:rng(0,1800),y:rng(200,790),p:rng(0,TAU),s:rng(1.5,3.5)}));
  const birds=Array.from({length:7},(_,i)=>({x:900+i*34,y:210+Math.sin(i)*20,p:i}));
  const smoke=Array.from({length:11},(_,i)=>({p:i/11}));
  const path=d=>`<svg viewBox="0 0 32 32" aria-hidden="true">${d}</svg>`;
  const icons={castle:path('<path d="M4 28V12h6v6h4V7h-3V3h4v3h3V3h4v4h-3v11h4v-6h5v16H4Zm10 0v-7h5v7"/>'),mana:path('<path d="m16 2 10 13-10 15L6 15 16 2Zm0 0v28M6 15h20"/>'),coin:path('<ellipse cx="16" cy="16" rx="11" ry="13"/><ellipse cx="16" cy="16" rx="7" ry="9"/><path d="M16 12v8m-2-6 2-2 2 2"/>'),sound:path('<path d="m14 6-7 6H3v8h4l7 6V6Zm5 5c4 3 4 7 0 10m4-14c7 5 7 13 0 18"/>'),muted:path('<path d="m14 6-7 6H3v8h4l7 6V6Zm7 6 8 8m0-8-8 8"/>'),pause:path('<path d="M11 7v18M21 7v18"/>'),expand:path('<path d="M12 5H5v7m15-7h7v7M5 20v7h7m15-7v7h-7"/>'),mouse:path('<rect x="8" y="2" width="16" height="27" rx="8"/><path d="M16 7v6"/>')};
  const forge=[{key:'bow',name:'Mästerbåge',description:'+22 % skada och snabbare laddning.',cost:110},{key:'wall',name:'Förstärkt bas',description:'+300 maxhälsa. Reparerar 500.',cost:125},{key:'income',name:'Handelsvägar',description:'+3 guld varje sekund.',cost:140},{key:'repair',name:'Reparera porten',description:'Återställer 450 hälsa.',cost:75}];

  function maxCamera(){return Math.max(0,W-viewWidth);}
  function clearPan(){panKeys.clear();pointer.inside=false;camera.velocity=0;camera.target=null;}
  function panTo(x){if(state.mode!=='play')return;camera.target=clamp(x,0,maxCamera());pointer.inside=false;camera.velocity=0;}
  function frontPosition(){const allies=fighters.filter(f=>f.side===1&&f.hp>0),enemies=fighters.filter(f=>f.side===-1&&f.hp>0);const a=allies.length?Math.max(...allies.map(f=>f.x)):330,b=enemies.length?Math.min(...enemies.map(f=>f.x)):W-330;return a>b?(a+b)/2:allies.length?a:enemies.length?b:W/2;}
  function syncPointerAim(){if(!pointer.known)return;state.aim={x:clamp(camera.x+pointer.x/viewScale,310,W-30),y:(pointer.y-viewOffsetY)/viewScale};updateAim();}
  function updateCamera(dt){
    const key=(panKeys.has('KeyD')||panKeys.has('ArrowRight')?1:0)-(panKeys.has('KeyA')||panKeys.has('ArrowLeft')?1:0);
    const edge=pointer.inside&&!pointer.touch?(pointer.x<46?-clamp((46-pointer.x)/46,0,1):pointer.x>canvas.clientWidth-46?clamp((pointer.x-canvas.clientWidth+46)/46,0,1):0):0;
    const direction=key||edge,old=camera.x;
    if(direction){camera.target=null;camera.velocity+=(direction*850-camera.velocity)*(1-Math.exp(-11*dt));camera.x+=camera.velocity*dt;}
    else if(camera.target!==null){camera.x+=(camera.target-camera.x)*(1-Math.exp(-12*dt));camera.velocity=0;if(Math.abs(camera.target-camera.x)<.5){camera.x=camera.target;camera.target=null;}}
    else{camera.velocity*=Math.exp(-14*dt);if(Math.abs(camera.velocity)<.1)camera.velocity=0;camera.x+=camera.velocity*dt;}
    camera.x=clamp(camera.x,0,maxCamera());if(camera.x===0||camera.x===maxCamera())camera.velocity=0;
    if(camera.x!==old)syncPointerAim();
  }
  function drawMinimap(){
    const map=$('battle-map'),q=map.getContext('2d'),w=map.width,h=map.height,k=w/W;
    q.clearRect(0,0,w,h);q.fillStyle='#122729';q.fillRect(0,0,w,h);q.fillStyle='#6e806c';q.fillRect(0,h*.66,w,1*dpr);
    q.fillStyle='#adc8ac';q.fillRect(110*k,h*.31,180*k,h*.38);q.fillStyle='#d89b80';q.fillRect((W-290)*k,h*.31,180*k,h*.38);
    for(const f of fighters){if(f.hp<=0)continue;const d=C.unitById[f.defId];q.fillStyle=f.side===1?'#b7d6b6':'#e9aa86';const r=(f.boss?2.8:1.7)*dpr;q.fillRect(f.x*k-r,(d.air?h*.2:h*.52)-r,r*2,r*2);}
    q.fillStyle='#e9d4a718';q.fillRect(camera.x*k,1,Math.min(W,viewWidth)*k,h-2);q.strokeStyle='#e4c796';q.lineWidth=dpr;q.strokeRect(camera.x*k+dpr/2,dpr/2,Math.min(W,viewWidth)*k-dpr,h-dpr);
    map.setAttribute('aria-valuenow',Math.round(camera.x));map.setAttribute('aria-valuemax',Math.round(maxCamera()));
  }
  function strideLength(d){return d.height*(d.cls==='cavalry'?.55:d.cls==='boss'?.28:d.cls==='tank'?.32:.36);}
  function gaitPhase(f){return ((f.walkDistance||0)/strideLength(C.unitById[f.defId])+(f.gaitOffset||0))%1;}
  function xpBudget(){return 100+(state.wave-1)*25;}
  function grantXP(amount){const earned=Math.max(0,Math.min(amount,xpBudget()-state.waveXP));state.xp+=earned;state.waveXP+=earned;return earned;}
  function difficulty(){return S.getDifficulty(state.difficulty);}
  function chooseDifficulty(id){selectedDifficulty=S.getDifficulty(id).id;try{localStorage.setItem('emberfall-difficulty-v5',selectedDifficulty);}catch{}renderDifficulty();}
  function renderDifficulty(){
    $('difficulty-options').innerHTML=S.difficulties.map(d=>'<button type="button" data-difficulty="'+d.id+'" aria-pressed="'+(d.id===selectedDifficulty)+'" class="'+(d.id===selectedDifficulty?'selected':'')+'"><b>'+d.name+'</b><small>'+d.subtitle+'</small></button>').join('');
    $('difficulty-description').textContent=S.getDifficulty(selectedDifficulty).description;
    try{const best=JSON.parse(localStorage.getItem('emberfall-record-v5-'+selectedDifficulty)||'null');$('record').textContent=best?'BÄSTA PÅ '+S.getDifficulty(selectedDifficulty).name.toUpperCase()+': BELÄGRING '+best.wave+' · '+best.kills+' BESEGRADE':'';}catch{}
  }
  function cycleSpeed(){state.speed=state.speed===1?1.5:state.speed===1.5?2:1;$('speed').textContent=state.speed+'×';$('speed').setAttribute('aria-label','Spelhastighet '+state.speed+' gånger');try{localStorage.setItem('emberfall-speed-v5',state.speed);}catch{}}
  function readCheckpoint(){
    try{const p=JSON.parse(localStorage.getItem(CHECKPOINT)||'null'),v=p?.state;if(!p||p.version!==5||!['play','shop'].includes(p.mode)||!v||!S.difficulties.some(d=>d.id===v.difficulty))return null;
      const integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
      if(!integer(v.wave,1,12)||!integer(v.era,0,3)||!integer(v.lastClearedWave,0,12)||!integer(v.lastEvolveWave,0,12)||!['none',...S.doctrines.map(d=>d.id)].includes(v.doctrine)||!S.doctrines.some(d=>d.id===v.nextDoctrine))return null;
      for(const k of ['gold','xp','hp','maxHp','mana','kills','shots','hits','headshots','elapsed','waveKills','waveLosses','waveShots','waveHits','waveXP','waveStart'])if(!Number.isFinite(v[k])||v[k]<0||v[k]>1e8)return null;
      if(v.waveXP>100+(v.wave-1)*25||v.lastClearedWave>v.wave||v.lastEvolveWave>v.lastClearedWave||(p.mode==='shop'&&v.wave===12)||v.maxHp<1||v.hp>v.maxHp||v.mana>100||!v.upgrades||!integer(v.upgrades.bow,0,3)||!integer(v.upgrades.income,0,3)||!integer(v.upgrades.wall,0,4))return null;
      if(!Array.isArray(p.units)||!Array.isArray(p.training)||p.training.length>6||!Array.isArray(p.slots)||p.slots.length!==3)return null;
      const validId=id=>C.unitById[id]&&C.unitById[id].tier<=v.era;
      if(p.units.some(id=>!validId(id))||p.training.some(j=>!validId(j.id)||!Number.isFinite(j.remaining)||j.remaining<0||j.remaining>C.unitById[j.id].training||!Number.isFinite(j.total)||j.total<=0||j.total>C.unitById[j.id].training||j.remaining>j.total))return null;
      const ids=[...p.units,...p.training.map(j=>j.id)];if(ids.reduce((n,id)=>n+C.unitById[id].pop,0)>C.populationCap||ids.filter(id=>C.unitById[id].cls==='boss').length>1)return null;
      if(p.slots.some(t=>t&&(!C.turretById[t.id]||C.turretById[t.id].tier>v.era||!integer(t.level,1,3)||!Number.isFinite(t.invested)||t.invested<0||t.invested>100000)))return null;
      return p;
    }catch{return null;}
  }
  function saveCheckpoint(){
    if(!['play','shop'].includes(state.mode))return;
    const saved={};for(const k of ['difficulty','era','wave','gold','xp','hp','maxHp','mana','kills','shots','hits','headshots','elapsed','lastClearedWave','lastEvolveWave','doctrine','nextDoctrine','waveKills','waveLosses','waveShots','waveHits','waveXP','waveStart'])saved[k]=state[k];saved.upgrades={...state.upgrades};
    const p={version:5,mode:state.mode,state:saved,units:fighters.filter(f=>f.side===1&&f.hp>0).map(f=>f.defId),training:trainingQueue.map(j=>({...j})),slots:state.slots.map(t=>t?{...t}:null)};
    try{localStorage.setItem(CHECKPOINT,JSON.stringify(p));}catch{}
  }
  function refreshContinue(){const p=readCheckpoint();if(loaded)$('start-label').textContent=p?'STARTA NY KAMPANJ':'STARTA KAMPANJEN';$('continue-campaign').classList.toggle('hidden',!p);if(p)$('continue-detail').textContent=S.getDifficulty(p.state.difficulty).name+' · '+(p.mode==='shop'?'EFTER BELÄGRING ':'BELÄGRING ')+p.state.wave;}
  function continueCampaign(){
    if(!loaded)return false;const p=readCheckpoint();if(!p){toast('Ingen giltig kontrollpunkt finns.');return false;}
    selectedDifficulty=p.state.difficulty;startGame();Object.assign(state,p.state,{upgrades:{...p.state.upgrades},charging:false,charge:0,rallyCooldown:0});
    fighters=[];p.units.forEach(id=>createFighter(id,1));trainingQueue=p.training.map(j=>({...j}));state.slots=p.slots.map(t=>t?{...t,cooldown:.45,animation:0}:null);
    if(p.mode==='shop'){hideOverlays();state.mode='shop';state.enemyEra=S.enemyEra(state.wave,state.difficulty);state.enemyHP=0;state.enemyMaxHP=baseMaxHP(state.wave);syncTheme();$('shop-eyebrow').textContent='BELÄGRING '+state.wave+' AVKLARAD';$('shop-summary').textContent='Ditt fäste är säkrat. Välj fältorder och rusta inför nästa strid.';$('shop-screen').classList.remove('hidden');$('game').classList.add('menu-open');lastResult=null;renderShop();saveCheckpoint();}
    else{state.nextDoctrine=p.state.doctrine;startWave();}
    updateUI();toast('Kontrollpunkt återställd. '+difficulty().name+' · Belägring '+state.wave+'.');syncAudio();return true;
  }
  function mainMenu(){clearPan();state.charging=false;state.charge=0;state.mode='intro';hideOverlays();$('intro').classList.remove('hidden');$('game').classList.add('menu-open');camera.x=0;renderDifficulty();refreshContinue();syncAudio();}
  function updateDirector(dt){
    if(!director)return;const cfg=difficulty();director.gold=Math.min(director.budget-director.spent,director.gold+director.income*dt);director.scoutTimer-=dt;
    if(director.scoutTimer<=0){director.scouted={};for(const f of fighters)if(f.side===1&&f.hp>0){const cls=C.unitById[f.defId].cls;director.scouted[cls]=(director.scouted[cls]||0)+1;}director.scoutTimer=cfg.scout;}
    if(!spawnQueue.length){if(director.released>0&&!fighters.some(f=>f.side===-1&&f.hp>0)&&!state.gateExposed){state.gateExposed=true;toast('Fiendens reserver är slut. Storma porten!');}return;}
    spawnTimer-=dt;
    if(!director.pending&&spawnTimer<=3)director.pending=enemyRecruitment(spawnQueue[0]);
    if(spawnTimer>0||!director.pending)return;
    const d=C.unitById[director.pending];if(d.cost>director.gold+.001||population(-1)+d.pop>cfg.cap)return;
    createFighter(d.id,-1);spawnQueue.shift();director.gold-=d.cost;director.spent+=d.cost;director.released++;director.history.push({id:d.id,cost:d.cost,time:state.elapsed-state.waveStart});
    director.pending=null;spawnTimer=cfg.interval+(director.released%cfg.squad===0?cfg.breather:0);
    if(d.cls==='boss'){toast('JÄTTE PÅ FÄLTET — bryt den med spjut, skyttar och flygare.');sfx('wave');}
  }
  function castRally(){
    const own=fighters.filter(f=>f.side===1&&f.hp>0);if(state.mode!=='play'||state.rallyCooldown>0||state.mana<40||!own.length){if(state.mode==='play')toast(!own.length?'Rekrytera trupper innan du blåser i hornet.':state.mana<40?'Stridshornet behöver 40 kraft.':'Stridshornet återhämtar sig.');return false;}
    state.mana-=40;state.rallyCooldown=32;
    own.forEach(f=>{f.hp=Math.min(f.maxHp,f.hp+f.maxHp*.12);f.rally=6;rings.push({x:f.x,y:ground(f.x),r:38,life:.8,max:.8,color:'#a9d5ad'});});
    toast('STRIDSHORN — +20 % anfallstakt i 6 sekunder. Armén läker 12 %.');sfx('rally');updateUI();return true;
  }
  function cancelRecruit(index){if(state.mode!=='play'||!Number.isInteger(index)||index<0||index>=trainingQueue.length)return false;const [j]=trainingQueue.splice(index,1),refund=Math.floor(C.unitById[j.id].cost*(index===0?.8:1));state.gold+=refund;toast('Rekrytering avbruten. +'+refund+' guld.');updateUI();return true;}
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');toastClock=2.4;}
  function hideOverlays(){['intro','pause-screen','shop-screen','end-screen','codex-screen'].forEach(id=>$(id).classList.add('hidden'));$('game').classList.remove('menu-open');}
  function trainingCost(def){return def.cost;}
  function population(side=1){return fighters.filter(f=>f.side===side&&f.hp>0).reduce((n,f)=>n+C.unitById[f.defId].pop,0)+(side===1?trainingQueue.reduce((n,j)=>n+C.unitById[j.id].pop,0):0);}
  function syncTheme(){const theme=Math.max(state.era,state.enemyEra);state.worldTheme=theme;if(theme!==currentTheme){previousBackdrop=sceneBackdrop;currentTheme=theme;sceneBackdrop=null;themeBlend=.75;}}
  function enemyRecruitment(job){
    if(job.boss)return job.id; // Announce the giant while the AI saves its remaining funds.
    const own={};for(const f of fighters)if(f.side===-1&&f.hp>0){const cls=C.unitById[f.defId].cls;own[cls]=(own[cls]||0)+1;}
    const cheap=C.unitById[C.eras[state.enemyEra].unitIds[0]].cost,minimumFuture=spawnQueue.slice(1).reduce((n,j)=>n+(j.boss?C.unitById[j.id].cost:cheap),0);
    return S.chooseRecruit(job,{difficulty:state.difficulty,era:state.enemyEra,scouted:director.scouted,own,gold:director.gold+director.income*Math.max(0,spawnTimer),spendable:director.budget-director.spent-minimumFuture});
  }
  function forgeCost(def){return def.key==='repair'?75+state.era*35:Math.round(def.cost*Math.pow(1.6,state.upgrades[def.key]));}
  function income(){return 8+state.era*4+state.upgrades.income*3;}
  function playerDamage(){return (68+state.charge*34)*(1+state.upgrades.bow*.22)*Math.pow(1.58,state.era)*(state.doctrine==='arrows'?1.12:1);}
  function baseMaxHP(wave){return Math.round((850+wave*160)*Math.pow(1.72,S.enemyEra(wave,state.difficulty)));}
  function startGame(){
    if(!loaded)return;
    hideOverlays();Object.assign(state,{difficulty:selectedDifficulty,doctrine:'none',nextDoctrine:'none',rallyCooldown:0,waveLosses:0,waveShots:0,waveHits:0,gateExposed:false,tipsMuted:false,mode:'play',era:0,wave:1,gold:S.getDifficulty(selectedDifficulty).startGold,xp:0,hp:1600,maxHp:1600,enemyHP:850,enemyMaxHP:850,enemyEra:0,mana:100,charge:0,charging:false,recoil:0,fireCooldown:0,rainCooldown:0,shake:0,kills:0,shots:0,hits:0,headshots:0,combo:0,comboTime:0,elapsed:0,waveKills:0,lastClearedWave:0,lastEvolveWave:0,worldTheme:0,upgrades:{bow:0,wall:0,income:0},slots:[null,null,null]});
    lastResult=null;tipKey='';fighters=[];projectiles=[];particles=[];texts=[];corpses=[];rings=[];hazards=[];trainingQueue=[];unitId=1;selectedTurret=null;selectedSlot=0;currentTheme=0;sceneBackdrop=null;previousBackdrop=null;themeBlend=0;setTab('troops');startWave();
    toastClock=0;$('toast').classList.remove('visible');syncAudio();
  }
  function startWave(){
    clearPan();camera.x=0;pointer.known=false;state.doctrine=state.nextDoctrine;state.nextDoctrine='logistics';state.gateExposed=false;state.rallyCooldown=0;state.waveLosses=0;state.waveShots=0;state.waveHits=0;state.waveXP=0;
    state.mode='play';state.waveKills=0;state.waveStart=state.elapsed;state.enemyEra=S.enemyEra(state.wave,state.difficulty);state.enemyMaxHP=baseMaxHP(state.wave);state.enemyHP=state.enemyMaxHP;syncTheme();
    spawnQueue=[];spawnTimer=1.2;projectiles=[];hazards=[];fighters=fighters.filter(f=>f.side===1&&f.hp>0);fighters.forEach(f=>{f.x=340+rng(0,120);f.hp=f.maxHp;f.y=ground(f.x)-f.altitude;});
    const plan=S.wavePlan(state.wave,state.enemyEra,state.difficulty),cfg=difficulty();spawnQueue=plan.jobs;spawnTimer=cfg.delay;
    director={name:plan.name,description:plan.description,budget:plan.budget,gold:plan.opening,spent:0,income:plan.income,scoutTimer:cfg.scout,scouted:{},pending:null,released:0,history:[]};
    for(let i=0;i<cfg.garrison&&spawnQueue.length;i++){const job=spawnQueue[0],d=C.unitById[job.id];if(d.cost>director.gold)break;spawnQueue.shift();createFighter(d.id,-1,W-470+i*56);director.gold-=d.cost;director.spent+=d.cost;director.released++;director.history.push({id:d.id,cost:d.cost,time:0});}
    bannerClock=3.4;$('wave-banner').innerHTML='<small>'+C.eras[state.enemyEra].name.toUpperCase()+' · BELÄGRING '+state.wave+' AV '+MAX_WAVES+'</small><h2>'+(state.wave%3===0?'Jätten närmar sig':'Håll fronten')+'</h2><p>'+['Runor och riddare','Pansar och rotorblad','Showen tar slagfältet','Stjärnornas sista fäste'][state.enemyEra]+'</p>';$('wave-banner').classList.add('visible');
    $('wave-label').textContent='BELÄGRING '+state.wave+' / '+MAX_WAVES;$('wave-detail').textContent=C.eras[state.enemyEra].name;renderCommands();updateUI();sfx('wave');syncAudio();saveCheckpoint();
  }
  function endWave(){
    if(state.mode!=='play')return;
    // Soldiers still outside the gate retreat when their fortress falls.
    fighters.filter(f=>f.side===-1).forEach(f=>{f.hp=0;f.rewarded=true;corpses.push({...f,deathTime:0});});fighters=fighters.filter(f=>f.side===1&&f.hp>0);spawnQueue=[];projectiles=[];hazards=[];
    if(state.wave===MAX_WAVES){endGame(true);return;}
    clearPan();state.lastClearedWave=state.wave;state.mode='shop';lastResult={seconds:state.elapsed-state.waveStart,kills:state.waveKills,losses:state.waveLosses,shots:state.waveShots,hits:state.waveHits};state.charging=false;state.charge=0;const reward=180+state.wave*32;state.gold+=reward;grantXP(xpBudget()-state.waveXP);state.mana=100;
    $('shop-eyebrow').textContent=`BELÄGRING ${state.wave} AVKLARAD`;$('shop-summary').textContent=`${state.waveKills} besegrade · +${reward} guld · Porten har fallit. Förstärk armén inför nästa fäste.`;
    $('shop-screen').classList.remove('hidden');$('game').classList.add('menu-open');renderShop();updateUI();saveCheckpoint();sfx('clear');syncAudio();
  }
  function endGame(won=false){
    clearPan();state.lastClearedWave=won?state.wave:state.lastClearedWave;state.mode=won?'won':'lost';state.charging=false;state.charge=0;
    $('end-eyebrow').textContent=won?'FYRA VÄRLDAR. EN OBRUTEN ED.':'VÄKTARENS SISTA PIL';$('end-title').textContent=won?'En ny gryning.':'Norrmark föll.';
    $('end-copy').textContent=won?'Från runornas borg till stjärnornas sista fäste. Din armé skrev historien.':`Du nådde belägring ${state.wave} med ${C.eras[state.era].name.toLowerCase()}s armé. Res dig igen och bygg en starkare frontlinje.`;
    $('end-stats').innerHTML=`<div><b>${state.kills}</b><small>BESEGRADE</small></div><div><b>${state.era+1}</b><small>BASNIVÅ</small></div><div><b>${state.headshots}</b><small>HUVUDTRÄFFAR</small></div>`;$('end-screen').classList.remove('hidden');$('game').classList.add('menu-open');
    $('restart').textContent=won?'NY KAMPANJ':'FÖRSÖK BELÄGRINGEN IGEN';
    try{const key='emberfall-record-v5-'+state.difficulty,best=JSON.parse(localStorage.getItem(key)||'null');if(!best||state.wave>best.wave||(state.wave===best.wave&&state.kills>best.kills))localStorage.setItem(key,JSON.stringify({wave:state.wave,kills:state.kills}));if(won)localStorage.removeItem?.(CHECKPOINT);}catch{}
    sfx(won?'clear':'defeat');syncAudio();
  }
  function togglePause(){clearPan();if(state.mode==='play'){state.mode='pause';$('pause-difficulty').textContent=difficulty().name.toUpperCase()+' · BELÄGRING '+state.wave;state.charging=false;state.charge=0;$('pause-screen').classList.remove('hidden');$('game').classList.add('menu-open');}else if(state.mode==='pause'){hideOverlays();state.mode='play';}syncAudio();}
  function canEvolve(){const e=C.eras[state.era];return state.era<C.eras.length-1&&state.lastClearedWave>state.lastEvolveWave&&state.xp>=e.evolveXP&&state.gold>=e.evolveGold;}
  function evolve(){
    if(!['play','shop'].includes(state.mode)||!canEvolve())return false;
    state.gold-=C.eras[state.era].evolveGold;state.era++;state.lastEvolveWave=state.lastClearedWave;syncTheme();state.maxHp+=450;state.hp=Math.min(state.maxHp,state.hp+650);state.mana=100;
    burst(230,455,C.eras[state.era].color,65,200);rings.push({x:230,y:480,r:150,life:.9,max:.9,color:C.eras[state.era].color});toast(`${C.eras[state.era].name.toUpperCase()} — nya trupper och torn är redo.`);sfx('clear');selectedTurret=null;renderCommands();if(state.mode==='shop')renderShop();updateUI();return true;
  }
  function recruit(id){
    const d=C.unitById[id];if(!d||state.mode!=='play'||d.tier>state.era||trainingQueue.length>=6||state.gold<d.cost||population()+d.pop>C.populationCap)return false;
    if(d.limit&&([...fighters.filter(f=>f.side===1&&f.hp>0).map(f=>f.defId),...trainingQueue.map(j=>j.id)].some(other=>C.unitById[other].cls==='boss'))){toast('En egen jätte kan vara ute eller under rekrytering åt gången.');return false;}
    state.gold-=d.cost;const duration=d.training*(state.doctrine==='logistics'?.8:1);trainingQueue.push({id,remaining:duration,total:duration});sfx('select');updateUI();return true;
  }
  function retireUnit(actorId){
    if(state.mode!=='play')return false;const f=fighters.find(o=>o.id===actorId&&o.side===1&&o.hp>0);if(!f)return false;const d=C.unitById[f.defId],refund=Math.floor(d.cost*.2);fighters=fighters.filter(o=>o!==f);state.gold+=refund;burst(f.x,f.y-30,C.eras[d.tier].color,8,45);toast(d.name+' avskedad. +'+refund+' guld.');renderCommands();updateUI();return true;
  }
  function buyForge(key){
    if(!['play','shop'].includes(state.mode))return false;
    const def=forge.find(f=>f.key===key);if(!def)return false;const price=forgeCost(def);if((def.key!=='repair'&&state.upgrades[def.key]>=(def.key==='wall'?4:3))||state.gold<price||(key==='repair'&&state.hp>=state.maxHp))return false;
    state.gold-=price;if(key==='repair')state.hp=Math.min(state.maxHp,state.hp+450);else {state.upgrades[key]++;if(key==='wall'){state.maxHp+=300;state.hp=Math.min(state.maxHp,state.hp+500);}}
    sfx('buy');renderCommands();if(state.mode==='shop')renderShop();updateUI();return true;
  }
  function turretPosition(slot){return (C.eras[state.era].turretPositions||[{x:86,y:358},{x:155,y:477},{x:305,y:496}])[slot];}
  function buildTurret(id,slot){
    const def=C.turretById[id];if(!def||state.mode!=='play'||def.tier>state.era||!Number.isInteger(slot)||slot<0||slot>2)return false;
    const old=state.slots[slot],refund=old?Math.floor(old.invested*.55):0,price=def.cost-refund;if(state.gold<price){toast(`Det behövs ${fmt(price)} guld för den tornplatsen.`);return false;}
    state.gold-=price;state.slots[slot]={id,level:1,invested:def.cost,cooldown:.45,animation:0,shots:0};selectedTurret=null;selectedSlot=slot;const p=turretPosition(slot);burst(p.x,p.y-20,'#d6bf86',20,80);toast(`${def.name} byggt på plats ${slot+1}.`);sfx('buy');renderCommands();updateUI();return true;
  }
  function upgradeTurret(slot){
    const t=state.slots[slot];if(!t||t.level>=3||state.mode!=='play')return false;const d=C.turretById[t.id],price=Math.round(d.cost*.65*t.level);if(state.gold<price)return false;
    state.gold-=price;t.invested+=price;t.level++;sfx('buy');renderCommands();updateUI();return true;
  }
  function sellTurret(slot){const t=state.slots[slot];if(!t||state.mode!=='play')return false;state.gold+=Math.floor(t.invested*.55);state.slots[slot]=null;sfx('buy');renderCommands();updateUI();return true;}

  function createFighter(id,side=1,x){
    const d=C.unitById[id];if(!d)throw new Error('Unknown unit: '+id);
    const xx=x??(side===1?345:W-345),altitude=d.air?160:0;
    const f={id:unitId++,defId:id,side,x:xx,y:ground(xx)-altitude,hp:d.hp,maxHp:d.hp,height:d.height,walkTime:0,walkDistance:0,gaitOffset:rng(0,1),flightTime:rng(0,.85),anim:'walk',animTime:0,attackCooldown:rng(.1,.4),pendingStrike:false,targetId:null,flash:0,burn:0,frost:0,charm:0,stun:0,rewarded:false,boss:d.cls==='boss',altitude,abilityCooldown:0,chargeDistance:0,chargeFlash:0,rally:0,counterText:0,rollTime:0,rollHits:new Set()};fighters.push(f);return f;
  }
  function hurt(f,amount,{head=false,armorBreak=false,source='troop',attacker=null,attackerClass=null,armorPierce=0}={}){
    if(!f||f.hp<=0)return;const d=C.unitById[f.defId],a=attacker?C.unitById[attacker.defId]:null,cls=attackerClass||a?.cls;
    const counter=cls?C.counterMultiplier(cls,d.cls):1,armor=head||armorBreak?0:Math.max(0,Math.min(.72,d.armor+(f.rollTime>0?.12:0))-(armorPierce||a?.armorPierce||0));
    const damage=amount*counter*(1-armor)*(attacker?.charm>0?.8:1);f.hp-=damage;f.flash=.12;
    if(source==='hero'){state.combo++;state.comboTime=4;state.hits++;state.waveHits++;grantXP(Math.max(1,damage*.025));if(head){state.headshots++;state.shake=Math.max(state.shake,2);sfx('headshot');}else sfx('hit');addText(f.x,f.y-f.height-8,head?'HUVUDTRÄFF':'−'+Math.round(damage),head?'#eed18e':'#e3d5ba',head?12:14);}
    else if(damage>120)addText(f.x,f.y-f.height-4,'−'+Math.round(damage),f.side===1?'#d4b58e':'#d6dbbb',11);
    if(counter>1.3&&f.counterText<=0){addText(f.x,f.y-f.height-18,'KONTRING', '#e7d38c',9);f.counterText=1.8;}
    burst(f.x,f.y-f.height*.52,f.frost?'#a0d6dc':counter>1.3?'#ead295':'#c8a27b',head?11:4,head?110:65);return damage;
  }
  function rewardDeaths(){
    for(const f of fighters){if(f.hp>0||f.rewarded)continue;f.rewarded=true;corpses.push({...f,deathTime:0});
      if(f.side===1)state.waveLosses++;
      if(f.side===-1){const d=C.unitById[f.defId],reward=Math.round(d.cost*.33*(f.boss?2:1));state.gold+=reward;grantXP(7+d.tier*6+(f.boss?30:0));state.kills++;state.waveKills++;state.mana=Math.min(100,state.mana+4);addText(f.x,f.y-f.height*.65,`+${reward}`,'#dfc28a',13);if(f.boss){state.shake=7;sfx('explosion');toast('Jätten har fallit.');}}
    }
    fighters=fighters.filter(f=>f.hp>0);
  }
  function canHit(f,other){const d=C.unitById[f.defId],o=C.unitById[other.defId];return f.side!==other.side&&other.hp>0&&(!o.air||d.attackAir);}
  function formationBlocked(f,target){
    const d=C.unitById[f.defId];if(d.air||d.reach)return false;
    return fighters.some(a=>a!==f&&a.side===f.side&&a.hp>0&&!C.unitById[a.defId].air&&(a.x-f.x)*f.side>3&&(target.x-a.x)*f.side>0);
  }
  function targetFor(f){
    const d=C.unitById[f.defId];let target=null,best=Infinity,distance=Infinity;
    for(const other of fighters){if(!canHit(f,other))continue;const forward=(other.x-f.x)*f.side;if(forward< -24)continue;
      const dist=Math.abs(other.x-f.x),air=C.unitById[other.defId].air;let score=dist;
      if(d.cls==='archer'&&air&&dist<=d.range)score-=2000;
      if(d.cls==='spear'&&C.unitById[other.defId].cls==='cavalry'&&dist<=d.range)score-=900;
      if(d.air&&C.unitById[other.defId].cls==='tank'&&dist<=d.range)score-=400;
      if(score<best){best=score;target=other;distance=dist;}
    }
    return {target,distance,blocked:target?formationBlocked(f,target):false};
  }
  function startAttack(f,target){
    const d=C.unitById[f.defId];f.anim='attack';f.animTime=0;f.pendingStrike=true;f.targetId=target?.id??null;f.attackCooldown=d.interval;
    if(d.cls==='boss'){const x=target?.x??(f.side===1?W-330:330);rings.push({x,y:ground(x),r:d.aoe,life:.58,max:.58,color:'#edb477',telegraph:true});}
  }
  function performStrike(f){
    const d=C.unitById[f.defId],target=f.targetId?fighters.find(o=>o.id===f.targetId&&o.hp>0):null,baseX=f.side===1?W-330:330;
    if(f.targetId&&!target)return;
    if(target&&(!canHit(f,target)||formationBlocked(f,target)))return;
    if(d.cls==='boss'){
      const x=target?.x??baseX;fighters.forEach(o=>{if(o.side!==f.side&&o.hp>0&&!C.unitById[o.defId].air&&Math.abs(o.x-x)<=d.aoe)hurt(o,d.damage,{attacker:f});});
      if(!target&&Math.abs(baseX-f.x)<d.range+80)damageBase(-f.side,d.damage);
      rings.push({x,y:ground(x),r:d.aoe+15,life:.65,max:.65,color:C.eras[d.tier].color});burst(x,ground(x)-5,C.eras[d.tier].color,35,220);state.shake=Math.max(state.shake,6);sfx('explosion');return;
    }
    if(d.ranged){
      const tx=target?.x??baseX,ty=target?target.y-target.height*.55:580;
      projectiles.push({x:f.x+f.side*19,y:f.y-f.height*.65,tx,ty,targetId:target?.id??null,side:f.side,damage:d.damage,kind:d.projectile,effect:d.projectile==='heart'?'heart':d.aoe?'bomb':'steel',speed:d.projectile==='arrow'||d.projectile==='heart'?650:950,homing:true,base:!target,life:4,trail:[],source:'troop',attackerClass:d.cls,armorPierce:d.armorPierce,charmed:f.charm>0,radius:d.aoe,attackAir:d.attackAir});sfx(d.aoe?'fire':'shoot');
    }else if(target){if(Math.abs(target.x-f.x)<=d.range+20){hurt(target,d.damage,{attacker:f});sfx('hit');}}
    else if(Math.abs(baseX-f.x)<=d.range+80){damageBase(-f.side,d.damage);sfx('wall');}
  }
  function tryClassAbility(f,target,distance){
    const d=C.unitById[f.defId];if(!target||f.abilityCooldown>0||C.unitById[target.defId].air)return false;
    if(d.charge&&f.chargeDistance>=130&&distance<=175){
      const brace=fighters.find(o=>o.side!==f.side&&o.hp>0&&C.unitById[o.defId].cls==='spear'&&(o.x-f.x)*f.side>=-5&&(o.x-f.x)*f.side<180);
      f.abilityCooldown=8;f.chargeDistance=0;
      if(brace){hurt(f,C.unitById[brace.defId].damage*1.1,{attacker:brace});f.stun=.8;addText(f.x,f.y-f.height,'SPJUTMUR','#d5dcb7',11);sfx('block');return true;}
      hurt(target,d.damage*2.1,{attacker:f});if(!['tank','boss'].includes(C.unitById[target.defId].cls))target.x+=f.side*36;
      f.x+=f.side*Math.min(100,Math.max(0,distance-d.range*.75));f.chargeFlash=.45;f.attackCooldown=.6;f.anim='attack';f.animTime=.22;f.pendingStrike=false;addText(f.x,f.y-f.height,'RUSCH','#dfc48e',11);burst(target.x,target.y-30,'#dac798',15,160);return true;
    }
    if(d.roll&&distance<165){f.rollTime=.88;f.rollHits=new Set();f.abilityCooldown=9;f.anim='roll';addText(f.x,f.y-f.height,'RULLATTACK','#edbad5',11);return true;}
    return false;
  }
  function updateRoll(f,dt){
    const d=C.unitById[f.defId];f.rollTime-=dt;f.x+=f.side*230*dt;f.y=ground(f.x);
    for(const o of fighters){if(o.side===f.side||o.hp<=0||C.unitById[o.defId].air||f.rollHits.has(o.id)||Math.abs(o.x-f.x)>54)continue;
      f.rollHits.add(o.id);if(C.unitById[o.defId].cls==='spear'){f.rollTime=0;f.stun=.75;hurt(f,C.unitById[o.defId].damage,{attacker:o});addText(f.x,f.y-f.height,'STOPPAD AV SPJUT','#d7dab8',10);break;}
      hurt(o,d.damage*2.2,{attacker:f});if(!['tank','boss'].includes(C.unitById[o.defId].cls))o.x+=f.side*34;burst(o.x,o.y-25,'#e9b2cc',9,100);
    }
    if(f.rollTime<=0){f.rollTime=0;f.anim='idle';f.attackCooldown=.5;}
  }
  function damageBase(side,amount){if(side===-1)amount*=(state.gateExposed?1.8:1)*(state.doctrine==='siege'?1.25:1);if(side===1){state.hp=Math.max(0,state.hp-amount);state.shake=Math.max(state.shake,2);}else state.enemyHP=Math.max(0,state.enemyHP-amount);}
  function ground(x){return 720+Math.sin(x*.009)*5+Math.sin(x*.023)*2;}
  function distanceToSegment(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
  function projectileEffect(p,x,y,target){
    const opponents=fighters.filter(f=>f.side!==p.side&&f.hp>0),effect=p.effect;
    if(effect==='heart'){if(target)target.charm=Math.max(target.charm,2.5);burst(x,y,'#edabc9',13,95);rings.push({x,y,r:45,life:.4,max:.4,color:'#e9a5c8'});}
    if(effect==='fire'){
      if(target&&!C.unitById[target.defId].air)target.burn=Math.max(target.burn,3.5);hazards.push({x,y:ground(x),side:p.side,life:3,r:65,damage:p.damage*.15});rings.push({x,y,r:85,life:.45,max:.45,color:'#e3aa70'});burst(x,y,'#eab675',20,150);
    }else if(effect==='ice'){
      opponents.forEach(f=>{if(Math.hypot(f.x-x,f.y-f.height*.55-y)<110)f.frost=3;});rings.push({x,y,r:120,life:.55,max:.55,color:'#aedce3'});burst(x,y,'#b7e1e4',20,110);sfx('ice');
    }else if(effect==='lightning'){
      const near=opponents.filter(f=>f!==target&&(!C.unitById[f.defId].air||p.attackAir)&&Math.hypot(f.x-x,f.y-f.height*.55-y)<270).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x)).slice(0,p.tier===3?4:3);let from={x,y};near.forEach(f=>{rings.push({lightning:true,x:from.x,y:from.y,x2:f.x,y2:f.y-f.height*.6,life:.28,max:.28,seed:rng(0,10)});hurt(f,p.damage*.72);from={x:f.x,y:f.y-f.height*.6};});sfx('thunder');
    }else if(effect==='bomb'){
      opponents.forEach(f=>{if(f!==target&&!C.unitById[f.defId].air){const dist=Math.abs(f.x-x);if(dist<(p.radius||100))hurt(f,p.damage*(1-dist/(p.radius||100))*.8,{attackerClass:p.attackerClass});}});rings.push({x,y,r:p.radius||115,life:.55,max:.55,color:'#f1c48c'});burst(x,y,'#f3c48c',36,240);state.shake=Math.max(state.shake,4);sfx('explosion');
    }
  }
  function shootTurret(t,slot,target){
    const d=C.turretById[t.id],pos=turretPosition(slot),damage=d.damage*(1+(t.level-1)*.45)*(C.unitById[target.defId].air?1.35:1),count=d.effect==='multi'?3:1;
    for(let i=0;i<count;i++){const spread=(i-(count-1)/2)*12;projectiles.push({x:pos.x+30,y:pos.y-36+spread*.28,tx:target.x,ty:target.y-target.height*.6+spread,aimOffset:spread,targetId:target.id,side:1,damage,kind:d.tier===3?'pulse':d.effect==='heart'?'heart':d.effect==='bomb'?'shell':'arrow',effect:d.effect,tier:d.tier,speed:850+(d.tier*80),homing:true,base:false,life:3,trail:[],source:'turret',attackAir:d.attackAir,attackerClass:d.attackAir?'archer':null,radius:d.effect==='bomb'?120:0});}
    t.cooldown=d.interval/Math.pow(1.1,t.level-1);t.animation=.34;t.shots++;burst(pos.x+36,pos.y-39,d.effect==='ice'?'#acd8df':d.effect==='lightning'?'#cde7e7':'#d9b984',6,60);sfx(d.effect==='bomb'?'fire':d.effect==='lightning'?'magic':'shoot');
  }
  function arrowSpeed(){return (680+state.charge*420)*(1+state.upgrades.bow*.025);}
  function updateAim(){const dx=Math.max(35,state.aim.x-HERO.x),dy=state.aim.y-HERO.y,s=arrowSpeed(),disc=s**4-GRAVITY*(GRAVITY*dx*dx-2*dy*s*s);state.aimReachable=disc>=0;state.angle=disc>=0?Math.atan((Math.sqrt(disc)-s*s)/(GRAVITY*dx)):Math.atan2(dy,dx)-.2;state.angle=clamp(state.angle,-1.1,.75);}
  function fire(){
    if(state.mode!=='play'||state.fireCooldown>0)return false;
    const speed=arrowSpeed();state.shots++;state.waveShots++;projectiles.push({x:HERO.x,y:HERO.y,vx:Math.cos(state.angle)*speed,vy:Math.sin(state.angle)*speed,side:1,damage:playerDamage(),kind:state.era===3?'pulse':state.era===2?'heart':'arrow',effect:'steel',life:6,trail:[],source:'hero',homing:false,credited:false});state.fireCooldown=.28;state.recoil=.32;sfx('shoot');return true;
  }
  function castRain(){
    if(state.mode!=='play'||state.rainCooldown>0||state.mana<60){if(state.mode==='play')toast(state.mana<60?'Pilregnet behöver 60 bågkraft.':'Pilregnet återhämtar sig.');return false;}
    state.mana-=60;state.rainCooldown=18;
    const targets=fighters.filter(f=>f.side===-1&&f.hp>0),center=targets.length?targets.reduce((a,b)=>a.x<b.x?a:b).x:W*.6;
    for(let i=0;i<20;i++){const x=clamp(center+rng(-200,200),350,W-150);projectiles.push({x:x+90,y:-rng(20,500),vx:-150,vy:rng(650,850),side:1,damage:100*Math.pow(1.65,state.era),kind:'arrow',effect:'steel',life:4,trail:[],source:'rain',homing:false});}
    toast('PILREGN — håll fronten.');sfx('magic');return true;
  }
  function burst(x,y,color,count=12,speed=110){for(let i=0;i<count;i++){const a=rng(0,TAU),s=rng(20,speed),life=rng(.25,.7);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-25,life,max:life,size:rng(1.1,3.2),color});}if(particles.length>500)particles.splice(0,particles.length-500);}
  function addText(x,y,text,color='#dcd6bc',size=13){texts.push({x,y,text,color,size,life:1.1});}

  function update(dt,realDt=dt){
    clock+=dt;themeBlend=Math.max(0,themeBlend-dt);if(toastClock>0){toastClock-=dt;if(toastClock<=0)$('toast').classList.remove('visible');}
    if(state.mode!=='play')return;
    updateCamera(realDt);state.elapsed+=dt;state.gold+=income()*dt;state.mana=Math.min(100,state.mana+dt*.85);state.fireCooldown=Math.max(0,state.fireCooldown-dt);state.rainCooldown=Math.max(0,state.rainCooldown-dt);state.rallyCooldown=Math.max(0,state.rallyCooldown-dt);state.recoil=Math.max(0,state.recoil-dt);state.shake=Math.max(0,state.shake-dt*24);state.comboTime-=dt;if(state.comboTime<=0)state.combo=0;
    bannerClock-=dt;if(bannerClock<=0)$('wave-banner').classList.remove('visible');
    if(state.charging){state.charge=Math.min(1,state.charge+dt*(1.25+state.upgrades.bow*.12));updateAim();}
    if(trainingQueue.length){const job=trainingQueue[0];job.remaining-=dt;if(job.remaining<=0){createFighter(job.id,1);trainingQueue.shift();}}
    updateDirector(dt);
    for(const f of fighters){
      if(f.hp<=0)continue;const d=C.unitById[f.defId];
      f.attackCooldown=Math.max(0,f.attackCooldown-dt*(f.charm>0?.85:1)*(f.rally>0?1.2:1));f.flash=Math.max(0,f.flash-dt);f.frost=Math.max(0,f.frost-dt);f.burn=Math.max(0,f.burn-dt);f.charm=Math.max(0,f.charm-dt);f.stun=Math.max(0,f.stun-dt);f.abilityCooldown=Math.max(0,f.abilityCooldown-dt);f.chargeFlash=Math.max(0,f.chargeFlash-dt);f.rally=Math.max(0,f.rally-dt);f.counterText=Math.max(0,f.counterText-dt);
      f.flightTime+=dt;f.y=ground(f.x)-f.altitude+(d.air?Math.sin(f.flightTime*TAU/1.7)*3:0);
      if(f.burn>0){f.hp-=Math.max(5,f.maxHp*.018)*dt;if(Math.random()<dt*14)burst(f.x+rng(-10,10),f.y-rng(30,f.height*.7),'#dfa568',1,35);}
      if(f.stun>0){f.anim='idle';continue;}
      if(f.rollTime>0){updateRoll(f,dt);continue;}
      if(f.anim==='attack'){
        f.animTime+=dt;if(f.pendingStrike&&f.animTime>=(d.cls==='boss'?.58:.25)){f.pendingStrike=false;performStrike(f);}
        if(f.animTime>=(d.cls==='boss'?.95:.65)){f.anim='idle';f.animTime=0;}continue;
      }
      const {target,distance,blocked}=targetFor(f),baseDist=((f.side===1?W-330:330)-f.x)*f.side,inRange=target?distance<=d.range&&!blocked:baseDist<=d.range+55;
      if(tryClassAbility(f,target,distance))continue;
      if(inRange){f.anim='idle';if(f.attackCooldown<=0)startAttack(f,target);}
      else{
        let speed=d.speed*(f.frost>0?.35:1),step=speed*dt;
        if(!d.air&&d.cls!=='cavalry'){const front=fighters.filter(o=>o!==f&&o.side===f.side&&o.hp>0&&!C.unitById[o.defId].air&&C.unitById[o.defId].range<=d.range+30&&(o.x-f.x)*f.side>0).sort((a,b)=>(a.x-b.x)*f.side)[0];if(front){const gap=(front.x-f.x)*f.side,safe=d.radius+C.unitById[front.defId].radius+5;step=Math.min(step,Math.max(0,gap-safe));}}
        f.anim=step>.001?'walk':'idle';if(step>.001){f.walkTime+=dt;f.walkDistance+=step;f.x+=f.side*step;f.chargeDistance+=step;f.y=ground(f.x)-f.altitude+(d.air?Math.sin(f.flightTime*TAU/1.7)*3:0);}
      }
    }
    for(let slot=0;slot<3;slot++){
      const t=state.slots[slot];if(!t)continue;t.cooldown=Math.max(0,t.cooldown-dt);t.animation=Math.max(0,t.animation-dt);if(t.cooldown>0)continue;
      const d=C.turretById[t.id],p=turretPosition(slot),targets=fighters.filter(f=>f.side===-1&&f.hp>0&&f.x-p.x<d.range&&(!C.unitById[f.defId].air||d.attackAir));targets.sort((a,b)=>{const aa=C.unitById[a.defId].air,ba=C.unitById[b.defId].air;return d.attackAir&&aa!==ba?(aa?-1:1):a.x-b.x;});if(targets[0])shootTurret(t,slot,targets[0]);
    }
    for(let i=projectiles.length-1;i>=0;i--){
      const p=projectiles[i],ox=p.x,oy=p.y;p.life-=dt;p.trail.push({x:p.x,y:p.y});if(p.trail.length>9)p.trail.shift();let hit=false;
      if(p.homing){
        const target=p.targetId?fighters.find(f=>f.id===p.targetId&&f.hp>0):null;if(target){p.tx=target.x;p.ty=target.y-target.height*.55+(p.aimOffset||0);}
        const dx=p.tx-p.x,dy=p.ty-p.y,dist=Math.hypot(dx,dy),step=p.speed*dt;p.vx=dx/(dist||1)*p.speed;p.vy=dy/(dist||1)*p.speed;
        if(dist<=step+10){p.x=p.tx;p.y=p.ty;hit=true;if(target){hurt(target,p.damage*(p.charmed?.8:1),{attackerClass:p.attackerClass,armorPierce:p.armorPierce});projectileEffect(p,p.x,p.y,target);}else if(p.base)damageBase(-p.side,p.damage);else projectileEffect(p,p.x,p.y,null);}
        else{p.x+=p.vx*dt;p.y+=p.vy*dt;}
      }else{
        p.vy+=GRAVITY*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
        for(const f of fighters){if(f.side===p.side||f.hp<=0)continue;const d=C.unitById[f.defId],scale=f.height/116;
          const head=distanceToSegment(f.x,f.y-f.height*(d.air?.65:.85),ox,oy,p.x,p.y)<11*scale;
          // Overlapping torso samples keep shoulder and waist hits continuous,
          // including fast arrows crossing several pixels in a single frame.
          const body=[.68,.48,.28].some(h=>distanceToSegment(f.x,f.y-f.height*h,ox,oy,p.x,p.y)<Math.max(21,d.radius*.7)*scale);
          if(head||body){hurt(f,p.damage*(head?2.1:1),{head,source:p.source==='hero'?'hero':'rain'});projectileEffect(p,p.x,p.y,f);hit=true;break;}
        }
        if(!hit&&p.x>W-230&&p.y>440&&p.y<720){burst(p.x,p.y,'#b6aa83',8,80);if(p.source==='hero')addText(W-170,520,'PORTPANSAR · SKICKA TRUPPER','#d6b995',9);hit=true;}
        if(!hit&&p.y>=ground(p.x)){burst(p.x,ground(p.x),'#a0926d',4,45);hit=true;}
      }
      if(hit||p.life<=0||p.x>W+80||p.x<0||p.y>850)projectiles.splice(i,1);
    }
    for(const h of hazards){h.life-=dt;fighters.forEach(f=>{if(f.side!==h.side&&f.hp>0&&!C.unitById[f.defId].air&&Math.abs(f.x-h.x)<h.r){f.hp-=h.damage*dt;f.burn=Math.max(f.burn,.5);}});if(Math.random()<dt*20)particles.push({x:h.x+rng(-h.r,h.r),y:h.y,vx:rng(-10,10),vy:rng(-90,-30),life:.5,max:.5,size:rng(2,4),color:'#dfad69'});}hazards=hazards.filter(h=>h.life>0);
    rewardDeaths();for(const p of particles){p.life-=dt;p.vy+=120*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.2,dt);}particles=particles.filter(p=>p.life>0);for(const t of texts){t.life-=dt;t.y-=28*dt;}texts=texts.filter(t=>t.life>0);
    for(const c of corpses)c.deathTime+=dt;corpses=corpses.filter(c=>c.deathTime<1.25);for(const r of rings)r.life-=dt;rings=rings.filter(r=>r.life>0);
    if(state.hp<=0)endGame();else if(state.enemyHP<=0)endWave();uiClock+=dt;if(uiClock>=.1){updateUI();uiClock=0;}
  }
  function setTab(next){if(next==='turrets')panTo(0);tab=next;selectedTurret=null;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===next);b.setAttribute('aria-selected',b.dataset.tab===next);});renderCommands();}
  function renderCommands(){
    const box=$('command-cards');box.className='command-cards';
    if(tab==='troops'){
      box.classList.add('troop-cards');box.innerHTML=C.eras[state.era].unitIds.map((id,i)=>{const u=C.unitById[id];return '<button class="unit-card" data-recruit="'+id+'" title="'+u.description+' · '+u.ability+' · '+u.pop+' arméplatser"><kbd>'+(i+1)+'</kbd><canvas width="128" height="154" data-portrait="'+id+'" aria-hidden="true"></canvas><div><b>'+u.name+'</b><span class="role">'+u.role.toUpperCase()+'</span><span class="price">'+u.cost+' G <small>· '+u.pop+' P</small></span></div></button>';}).join('');
    }else if(tab==='turrets'){
      box.classList.add('turret-cards');box.innerHTML=C.eras[state.era].turretIds.map(id=>{const t=C.turretById[id];return '<button class="unit-card '+(selectedTurret===id?'selected':'')+'" data-turret="'+id+'" title="'+t.description+'"><canvas width="128" height="154" data-turret-portrait="'+id+'" aria-hidden="true"></canvas><div><b>'+t.name+'</b><span class="role">'+(t.attackAir?'LUFTVÄRN':'MARKFÖRSVAR')+'</span><span class="price">'+t.cost+' G</span></div></button>';}).join('')+'<div class="turret-slot-controls">'+state.slots.map((t,i)=>'<button data-slot="'+i+'" class="'+(selectedSlot===i?'slot-selected':'')+'">'+(i+1)+' · '+(t?'NIVÅ '+t.level:'TOM')+'</button>').join('')+(state.slots[selectedSlot]?'<button data-upgrade-slot="'+selectedSlot+'">'+(state.slots[selectedSlot].level<3?'UPPGR. '+Math.round(C.turretById[state.slots[selectedSlot].id].cost*.65*state.slots[selectedSlot].level)+' G':'MAXNIVÅ')+'</button><button data-sell-slot="'+selectedSlot+'">SÄLJ +'+Math.floor(state.slots[selectedSlot].invested*.55)+' G</button>':'')+'</div>';
    }else if(tab==='army'){
      box.classList.add('troop-cards','army-cards');box.innerHTML=C.roleOrder.map((cls,i)=>{const list=fighters.filter(f=>f.side===1&&f.hp>0&&C.unitById[f.defId].cls===cls).sort((a,b)=>C.unitById[a.defId].tier-C.unitById[b.defId].tier),f=list[0],u=C.unitById[f?.defId||C.eras[state.era].unitIds[i]];return '<button class="unit-card" '+(f?'data-retire="'+f.id+'"':'disabled')+' title="Avskeda en trupp och få 20 % av inköpspriset tillbaka. Äldsta temat lämnar först."><canvas width="128" height="154" data-portrait="'+u.id+'" aria-hidden="true"></canvas><div><b>'+u.name+'</b><span class="role">'+list.length+' UTE</span><span class="price">'+(f?'AVSKEDA +'+Math.floor(u.cost*.2)+' G':'INGEN UTE')+'</span></div></button>';}).join('');
    }else{box.classList.add('forge-cards');box.innerHTML=forge.map(f=>'<button class="forge-card" data-forge="'+f.key+'"><b>'+f.name+'</b><small>'+f.description+'</small><span>'+forgeCost(f)+' G</span></button>').join('');}
    updateUI();paintPortraits();
  }
  function renderShop(){
    $('shop-gold').textContent=`${fmt(state.gold)} GULD`;$('upgrades').innerHTML=forge.map(f=>`<button class="upgrade" data-forge="${f.key}" ${state.gold<forgeCost(f)||(f.key==='repair'&&state.hp>=state.maxHp)||(f.key!=='repair'&&state.upgrades[f.key]>=(f.key==='wall'?4:3))?'disabled':''}><div style="font-size:22px;color:#d9bd83">${f.key==='bow'?'➶':f.key==='income'?'◇':'▣'}</div><div><b>${f.name}</b><small>${f.description}</small><span class="price">${f.key!=='repair'&&state.upgrades[f.key]>=(f.key==='wall'?4:3)?'MAXNIVÅ':forgeCost(f)+' GULD'}</span></div></button>`).join('');
    const nextWave=state.wave+1,plan=S.wavePlan(nextWave,S.enemyEra(nextWave,state.difficulty),state.difficulty);$('next-plan-name').textContent=plan.name+' · '+C.eras[S.enemyEra(nextWave,state.difficulty)].name+' · '+difficulty().name;$('next-plan-description').textContent=plan.description;
    const seconds=lastResult?.seconds??Math.max(0,state.elapsed-state.waveStart),losses=lastResult?.losses??state.waveLosses,kills=lastResult?.kills??state.waveKills;
    $('siege-results').innerHTML='<div><b>'+Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0')+'</b><small>STRIDSTID</small></div><div><b>'+kills+'</b><small>BESEGRADE</small></div><div><b>'+losses+'</b><small>EGNA FÖRLUSTER</small></div><div><b>'+Math.round(state.hp/state.maxHp*100)+' %</b><small>FÄSTETS HÄLSA</small></div>';renderDoctrines();saveCheckpoint();
    const e=C.eras[state.era],button=$('shop-evolve');button.disabled=!canEvolve();button.textContent=state.era===C.eras.length-1?'SISTA TEMAT ÄR NÅTT':`UTVECKLA TILL ${C.eras[state.era+1].name.toUpperCase()} · ${e.evolveGold} G · ${e.evolveXP} XP`;
  }
  function campaignHUD(){
    const seconds=Math.max(0,Math.floor(state.elapsed-state.waveStart));$('battle-time').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');$('difficulty-badge').textContent=difficulty().name.toUpperCase();
    const enemies=fighters.filter(f=>f.side===-1&&f.hp>0),allies=fighters.filter(f=>f.side===1&&f.hp>0);
    $('battle-phase').textContent=state.gateExposed?'STORMA PORTEN':enemies.some(f=>f.boss)?'JÄTTE PÅ FÄLTET':seconds<10?'BYGG DIN FRONT':!spawnQueue.length?'BRYT SISTA LINJEN':'HÅLL FRONTEN';
    const next=director?.pending&&C.unitById[director.pending],bank=next?Math.max(0,(next.cost-director.gold)/director.income):0;
    $('enemy-intent').textContent=state.gateExposed?'Fiendens reserver är slut. Din armé gör +80 % portskada.':!spawnQueue.length?'Alla fiendeförband är ute. Bryt fronten och ta fästet.':next?'NÄSTA: '+next.name+' · '+(population(-1)+next.pop>difficulty().cap?'avvaktar en lucka':Math.ceil(Math.max(0,spawnTimer,bank))+' s'):(director?.name||'Spaning')+' · '+spawnQueue.length+' förband i reserv';
    $('siege-progress').style.width=(director?Math.min(100,director.released/(director.released+spawnQueue.length||1)*100):0)+'%';
    $('battle-objective').textContent=(state.doctrine!=='none'?'FÄLTORDER: '+(S.doctrines.find(d=>d.id===state.doctrine)?.name||'')+' · ':'')+'SKYDDA DITT FÄSTE · TA FIENDENS PORT';
    $('rally-button').disabled=state.rallyCooldown>0||state.mana<40||!allies.length;$('rally-status').textContent=state.rallyCooldown>0?Math.ceil(state.rallyCooldown)+' S':'40 KRAFT';$('rally-cd').style.width=state.rallyCooldown/32*100+'%';
    let tip=null;
    if(!state.tipsMuted&&state.mode==='play'){
      if(enemies.some(f=>C.unitById[f.defId].air)&&!allies.some(f=>C.unitById[f.defId].cls==='archer')&&!state.slots.some(t=>t&&C.turretById[t.id].attackAir))tip=['Vinn luften','Fienden har flygare. Rekrytera skyttar (4) eller bygg luftvärnstorn (T).'];
      else if(!allies.length&&!trainingQueue.length)tip=['Din armé tar fästet','Rekrytera med 1–7. Börja med en tank (2), spjut (3) och en skytt (4).'];
      else if(state.wave===1&&seconds<28)tip=['Följ slaget','F visar främsta truppen. A/D och skärmkanterna flyttar kameran. V växlar mellan 1×, 1,5× och 2×.'];
      else if(state.wave===1&&seconds<50&&allies.some(f=>f.hp<f.maxHp*.7))tip=['Vänd en jämn strid','R läker armén 12 % och ger snabbare anfall. Space släpper pilregnet. Båda använder din kraft.'];
      else if(state.gateExposed&&allies.length)tip=['Sista stöten','Fiendens port är blottad. Trupperna gör extra portskada. Kavalleri når fram snabbt.'];
    }
    const key=tip?.[0]||'';if(key!==tipKey){tipKey=key;$('context-tip').classList.toggle('visible',!!tip);if(tip){$('tip-title').textContent=tip[0];$('tip-copy').textContent=tip[1];}}
  }
  function renderDoctrines(){
    $('doctrine-options').innerHTML=S.doctrines.map(d=>'<button data-doctrine="'+d.id+'" class="'+(state.nextDoctrine===d.id?'selected':'')+'" aria-pressed="'+(state.nextDoctrine===d.id)+'"><span>'+d.symbol+'</span><b>'+d.name+'</b><small>'+d.description+'</small></button>').join('');
  }
  function updateUI(){
    campaignHUD();
    if(tab==='army'){const signature=fighters.filter(f=>f.side===1&&f.hp>0).map(f=>f.id).join(',');if(signature!==armySignature){armySignature=signature;renderCommands();return;}}

    $('hp-number').textContent=`${fmt(state.hp)} / ${fmt(state.maxHp)}`;$('hp-meter').style.width=`${state.hp/state.maxHp*100}%`;$('mana-number').textContent=`${Math.floor(state.mana)} / 100`;$('mana-meter').style.width=`${state.mana}%`;$('gold-number').textContent=fmt(state.gold);$('income-number').textContent=`+${income()}/s`;
    $('enemy-hp-number').textContent=`${fmt(state.enemyHP)} / ${fmt(state.enemyMaxHP)}`;$('enemy-hp-meter').style.width=`${state.enemyHP/state.enemyMaxHP*100}%`;$('enemy-era').textContent=C.eras[state.enemyEra].name.toUpperCase();
    $('hero-status').textContent=`Väktaren · Nivå ${state.upgrades.bow+1}`;$('remaining').textContent=`${population()} / ${C.populationCap} ARMÉPLATSER`;$('rain-button').disabled=state.rainCooldown>0||state.mana<60;$('rain-cd').style.width=`${state.rainCooldown/18*100}%`;
    const e=C.eras[state.era];$('age-name').textContent=e.name;$('age-progress').style.width=`${state.era===C.eras.length-1?100:Math.min(100,state.xp/e.evolveXP*100)}%`;$('evolve').title=state.lastClearedWave<=state.lastEvolveWave?'Avklara minst en belägring efter din senaste uppgradering.':'Nästa tema kräver erfarenhet och guld.';$('age-xp').textContent=state.era===C.eras.length-1?`${fmt(state.xp)} ERFARENHET`:`${fmt(state.xp)} / ${e.evolveXP} ERFARENHET`;$('evolve-cost').textContent=state.era===C.eras.length-1?'MAX':`${e.evolveGold} G`;$('evolve').disabled=!canEvolve();
    $('training-text').textContent=selectedTurret?'Välj en markerad tornplats på borgen eller knappen 1, 2 eller 3.':trainingQueue.length?`REKRYTERAR ${C.unitById[trainingQueue[0].id].name.toUpperCase()} · ${trainingQueue.length} I KÖ`:tab==='turrets'?'Välj ett torn, klicka sedan på en tornplats. 55 % återbetalas vid byte.':'Rekrytera en frontlinje. Dina torn och din båge täcker framryckningen.';
    $('training-queue').innerHTML=trainingQueue.map((j,i)=>`<button class="training-queue-item" data-cancel-job="${i}" title="${C.unitById[j.id].name} · Klicka för att avbryta. ${i?'100':'80'} % återbetalas." aria-label="Avbryt rekrytering av ${C.unitById[j.id].name}"><i style="width:${i?0:(1-j.remaining/j.total)*100}%"></i><span>×</span></button>`).join('');
    document.querySelectorAll('[data-recruit]').forEach(b=>{b.disabled=state.gold<C.unitById[b.dataset.recruit].cost||trainingQueue.length>=6||population()+C.unitById[b.dataset.recruit].pop>C.populationCap||(C.unitById[b.dataset.recruit].cls==='boss'&&[...fighters.filter(f=>f.side===1).map(f=>f.defId),...trainingQueue.map(j=>j.id)].some(id=>C.unitById[id].cls==='boss'));});
    document.querySelectorAll('[data-turret]').forEach(b=>{const price=C.turretById[b.dataset.turret].cost;const refund=Math.max(0,...state.slots.map(t=>t?Math.floor(t.invested*.55):0));b.disabled=state.gold<price-refund;});document.querySelectorAll('[data-upgrade-slot]').forEach(b=>{const t=state.slots[+b.dataset.upgradeSlot];b.disabled=!t||t.level>=3||state.gold<Math.round(C.turretById[t.id].cost*.65*t.level);});document.querySelectorAll('#command-cards [data-forge]').forEach(b=>{const f=forge.find(f=>f.key===b.dataset.forge);b.disabled=state.gold<forgeCost(f)||(f.key==='repair'&&state.hp>=state.maxHp)||(f.key!=='repair'&&state.upgrades[f.key]>=(f.key==='wall'?4:3));});
    const combo=$('combo');combo.classList.toggle('visible',state.combo>=3&&state.mode==='play');combo.querySelector('b').textContent=`${state.combo}`;
    $('battle-caption').textContent=tab==='turrets'?'BYGG FÖRSVAR · LÅT TORnen TÄCKA ARMÉN'.toUpperCase():'DIN BÅGE BRYTER LEDEN · DIN ARMÉ TAR FÄSTET';
  }
  function openCodex(){if(state.mode==='codex')return;clearPan();codexPrevious=state.mode;state.mode='codex';state.charging=false;state.charge=0;codexEra=state.era;$('codex-screen').classList.remove('hidden');$('game').classList.add('menu-open');renderCodex();syncAudio();}
  function closeCodex(){$('codex-screen').classList.add('hidden');state.mode=codexPrevious;if(state.mode==='play')$('game').classList.remove('menu-open');syncAudio();}
  function renderCodex(){
    $('codex-ages').innerHTML=C.eras.map((e,i)=>'<button data-codex-era="'+i+'" class="'+(i===codexEra?'active':'')+'">'+e.name.toUpperCase()+'</button>').join('');
    $('codex-units').innerHTML=C.eras[codexEra].unitIds.map(id=>{const u=C.unitById[id],strong=u.strong.map(k=>C.roles[k].name).join(', '),weak=u.weak.map(k=>C.roles[k].name).join(', ');return '<article class="codex-unit"><canvas width="360" height="380" data-codex-unit="'+id+'" aria-label="Animerad '+u.name+'"></canvas><h3>'+u.name+'</h3><span>'+u.role.toUpperCase()+' · '+u.cost+' G · '+u.pop+' PLATSER</span><p>'+u.description+'</p><div class="unit-ability">'+u.ability+'</div><div class="counter-info"><b>STARK MOT</b> '+strong+'<br><b>SVAG MOT</b> '+weak+'</div><div class="unit-stats"><span>♥ '+u.hp+'</span><span>⚔ '+u.damage+'</span><span>↗ '+u.range+'</span></div></article>';}).join('');
    $('codex-turrets').innerHTML=C.eras[codexEra].turretIds.map(id=>{const t=C.turretById[id];return '<article class="codex-turret"><canvas width="152" height="152" data-codex-turret="'+id+'" aria-label="'+t.name+'"></canvas><div><h3>'+t.name+'</h3><p>'+t.description+'</p><small>'+t.cost+' G · '+(t.attackAir?'LUFT + MARK':'ENDAST MARK')+'</small></div></article>';}).join('');
  }
  function initUI(){
    $('camera-home').onclick=()=>panTo(0);$('camera-front').onclick=()=>panTo(frontPosition()-viewWidth*.5);$('camera-enemy').onclick=()=>panTo(maxCamera());
    const map=$('battle-map');let mapPointer=null;
    const moveMap=e=>{const r=map.getBoundingClientRect();panTo((e.clientX-r.left)/r.width*W-viewWidth*.5);};
    map.addEventListener('pointerdown',e=>{if(e.button!==0||state.mode!=='play')return;e.preventDefault();mapPointer=e.pointerId;map.setPointerCapture(e.pointerId);moveMap(e);});
    map.addEventListener('pointermove',e=>{if(mapPointer===e.pointerId)moveMap(e);});
    const releaseMap=e=>{if(mapPointer===e.pointerId){mapPointer=null;if(map.hasPointerCapture(e.pointerId))map.releasePointerCapture(e.pointerId);}};
    map.addEventListener('pointerup',releaseMap);map.addEventListener('pointercancel',releaseMap);
    map.addEventListener('keydown',e=>{if(state.mode!=='play')return;if(['ArrowLeft','ArrowRight','Home','End'].includes(e.code)){e.preventDefault();e.stopPropagation();panTo(e.code==='Home'?0:e.code==='End'?maxCamera():camera.x+(e.code==='ArrowRight'?1:-1)*viewWidth*.4);}});
    $('castle-icon').innerHTML=icons.castle;$('mana-icon').innerHTML=icons.mana;$('coin-icon').innerHTML=icons.coin;$('sound').innerHTML=icons.muted;$('pause').innerHTML=icons.pause;$('fullscreen').innerHTML=icons.expand;$('mouse-icon').innerHTML=icons.mouse;
    $('start').onclick=startGame;$('restart').onclick=()=>state.mode==='lost'?continueCampaign():startGame();$('restart-pause').onclick=continueCampaign;$('continue-campaign').onclick=continueCampaign;$('pause-menu').onclick=mainMenu;$('end-menu').onclick=mainMenu;$('speed').onclick=cycleSpeed;$('rally-button').onclick=castRally;$('dismiss-tip').onclick=()=>{state.tipsMuted=true;tipKey='';$('context-tip').classList.remove('visible');};$('pause').onclick=togglePause;$('resume').onclick=togglePause;$('brand').onclick=e=>{e.preventDefault();togglePause();};$('sound').onclick=toggleSound;$('rain-button').onclick=castRain;$('evolve').onclick=evolve;$('shop-evolve').onclick=evolve;
    $('next-wave').onclick=()=>{hideOverlays();state.wave++;startWave();};$('codex').onclick=openCodex;$('intro-codex').onclick=openCodex;$('close-codex').onclick=closeCodex;
    $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{toast('Helskärm stöds inte i den här webbläsaren.');}};
    document.addEventListener('click',e=>{
      let b=e.target.closest('[data-difficulty]');if(b){chooseDifficulty(b.dataset.difficulty);return;}b=e.target.closest('[data-doctrine]');if(b&&state.mode==='shop'&&S.doctrines.some(d=>d.id===b.dataset.doctrine)){state.nextDoctrine=b.dataset.doctrine;renderDoctrines();saveCheckpoint();return;}b=e.target.closest('[data-cancel-job]');if(b){cancelRecruit(+b.dataset.cancelJob);return;}
      b=e.target.closest('[data-tab]');if(b){setTab(b.dataset.tab);return;}
      b=e.target.closest('[data-recruit]');if(b){recruit(b.dataset.recruit);return;}
      b=e.target.closest('[data-turret]');if(b){selectedTurret=selectedTurret===b.dataset.turret?null:b.dataset.turret;renderCommands();return;}
      b=e.target.closest('[data-slot]');if(b){selectedSlot=+b.dataset.slot;if(selectedTurret)buildTurret(selectedTurret,selectedSlot);else renderCommands();return;}
      b=e.target.closest('[data-upgrade-slot]');if(b){upgradeTurret(+b.dataset.upgradeSlot);return;}b=e.target.closest('[data-sell-slot]');if(b){sellTurret(+b.dataset.sellSlot);return;}
      b=e.target.closest('[data-retire]');if(b){retireUnit(+b.dataset.retire);return;}
      b=e.target.closest('[data-forge]');if(b){buyForge(b.dataset.forge);return;}
      b=e.target.closest('[data-codex-era]');if(b){codexEra=+b.dataset.codexEra;renderCodex();return;}
      b=e.target.closest('[data-animation]');if(b){codexAnimation=b.dataset.animation;document.querySelectorAll('[data-animation]').forEach(n=>n.classList.toggle('active',n===b));}
    });
    try{selectedDifficulty=S.getDifficulty(localStorage.getItem('emberfall-difficulty-v5')).id;const speed=Number(localStorage.getItem('emberfall-speed-v5'));state.speed=[1,1.5,2].includes(speed)?speed:1;}catch{}$('speed').textContent=state.speed+'×';renderDifficulty();refreshContinue();
    $('game').classList.add('menu-open');
  }
  function aimAt(e){const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;pointer.touch=e.pointerType==='touch';pointer.known=true;pointer.inside=pointer.x>=0&&pointer.x<=r.width&&pointer.y>0&&pointer.y<innerHeight-$('command-hud').clientHeight;syncPointerAim();}
  canvas.addEventListener('pointermove',aimAt);
  canvas.addEventListener('pointerleave',()=>{pointer.inside=false;});
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||state.mode!=='play')return;aimAt(e);
    if(tab==='turrets'&&selectedTurret){for(let i=0;i<3;i++){const p=turretPosition(i);if(Math.hypot(state.aim.x-p.x,state.aim.y-p.y)<65){buildTurret(selectedTurret,i);return;}}toast('Välj en markerad tornplats på borgen.');return;}
    state.charging=true;state.charge=.12;updateAim();canvas.setPointerCapture(e.pointerId);initAudio();
  });
  canvas.addEventListener('pointerup',e=>{if(e.button!==0||!state.charging)return;aimAt(e);fire();state.charging=false;state.charge=0;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
  canvas.addEventListener('pointercancel',()=>{state.charging=false;state.charge=0;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keyup',e=>panKeys.delete(e.code));
  window.addEventListener('keydown',e=>{
    if(['KeyA','KeyD','ArrowLeft','ArrowRight'].includes(e.code)&&state.mode==='play'){e.preventDefault();panKeys.add(e.code);return;}
    if(['Home','End','KeyF'].includes(e.code)&&state.mode==='play'){e.preventDefault();panTo(e.code==='Home'?0:e.code==='End'?maxCamera():frontPosition()-viewWidth*.5);return;}
    if(['Space','Escape','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7'].includes(e.code))e.preventDefault();if(e.repeat)return;const k=e.key.toLowerCase();
    if(k==='m'){toggleSound();return;}if(e.code==='Escape'){if(state.mode==='codex')closeCodex();else togglePause();return;}if(k==='p'){togglePause();return;}
    if(e.code==='Enter'&&state.mode==='intro'){startGame();return;}if(state.mode!=='play')return;
    if(k==='r'){castRally();return;}if(k==='v'){cycleSpeed();return;}
    if(k==='t'){setTab(tab==='turrets'?'troops':'turrets');return;}if(k==='b'){openCodex();return;}if(e.code==='Space'){castRain();return;}
    if(/^[1-7]$/.test(k)){const n=+k-1;if(tab==='turrets'&&selectedTurret&&n<3)buildTurret(selectedTurret,n);else recruit(C.eras[state.era].unitIds[n]);}
  });
  window.addEventListener('blur',()=>{clearPan();if(state.mode==='play')togglePause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='play')togglePause();});

  function initAudio(){if(audio)return;try{audio=new(window.AudioContext||window.webkitAudioContext)();ambient=audio.createGain();ambient.gain.value=0;ambient.connect(audio.destination);const buffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate),data=buffer.getChannelData(0);let n=0;for(let i=0;i<data.length;i++){n=(n+Math.random()*.04-.02)/1.02;data[i]=n;}wind=audio.createBufferSource();wind.buffer=buffer;wind.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;wind.connect(filter);filter.connect(ambient);wind.start();}catch{audio=null;}}
  function syncAudio(){if(ambient)ambient.gain.setTargetAtTime(soundEnabled&&state.mode==='play'?.16:0,audio.currentTime,.3);}
  function toggleSound(){initAudio();soundEnabled=!soundEnabled;if(audio?.state==='suspended')audio.resume();$('sound').innerHTML=soundEnabled?icons.sound:icons.muted;$('sound').setAttribute('aria-label',soundEnabled?'Stäng av ljud':'Slå på ljud');$('sound').setAttribute('aria-pressed',soundEnabled);syncAudio();if(soundEnabled)sfx('select');}
  function tone(freq,end,duration,volume=.04,type='sine',delay=0){if(!soundEnabled||!audio)return;const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration+.03);}
  function noise(duration=.1,volume=.06,cutoff=1700){if(!soundEnabled||!audio)return;const len=Math.ceil(audio.sampleRate*duration),b=audio.createBuffer(1,len,audio.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);const s=audio.createBufferSource(),g=audio.createGain(),f=audio.createBiquadFilter();s.buffer=b;f.type='lowpass';f.frequency.value=cutoff;g.gain.value=volume;s.connect(f);f.connect(g);g.connect(audio.destination);s.start();}
  function sfx(kind){if(!soundEnabled)return;switch(kind){case'rally':[220,277,330].forEach((f,i)=>tone(f,f*1.02,.65,.035,'triangle',i*.12));break;case'shoot':tone(310,100,.14,.035,'triangle');noise(.1,.07,2600);break;case'hit':noise(.1,.09,1000);tone(140,55,.09,.035,'triangle');break;case'headshot':tone(1100,1800,.12,.045);noise(.07,.07,2400);break;case'block':tone(1900,650,.2,.035,'triangle');break;case'magic':tone(280,1000,.3,.04,'triangle');tone(560,1800,.28,.025);break;case'ice':tone(1500,450,.35,.035);break;case'fire':noise(.38,.09,800);break;case'explosion':case'thunder':noise(.7,.2,500);tone(90,25,.55,.09,'triangle');break;case'wall':noise(.13,.075,600);tone(90,40,.14,.04);break;case'wave':tone(145,145,.75,.035,'sawtooth');tone(217,217,.8,.02,'triangle',.15);break;case'clear':case'buy':[330,440,554,660].forEach((f,i)=>tone(f,f,.5,.025,'sine',i*.12));break;case'defeat':tone(160,45,1.4,.06,'triangle');break;default:tone(520,700,.07,.02);}}

  function poly(points,fill,stroke,line=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
  function line(points,color,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=color;ctx.fill();}
  function gradient(x,y,x2,y2,stops){const g=ctx.createLinearGradient(x,y,x2,y2);stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1),s));return g;}
  function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  function makeStatic(){
    staticLayer=document.createElement('canvas');staticLayer.width=Math.ceil(W);staticLayer.height=H;
    const c=staticLayer.getContext('2d');
    // Natural painterly terrain texture, always aligned with collision ground.
    let seed=48217;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    const dirt=c.createLinearGradient(0,695,0,900);dirt.addColorStop(0,'#4e5642');dirt.addColorStop(.08,'#333c32');dirt.addColorStop(.3,'#28322d');dirt.addColorStop(1,'#101c20');
    c.beginPath();c.moveTo(0,ground(0));for(let x=0;x<=W+8;x+=8)c.lineTo(x,ground(x));c.lineTo(W,900);c.lineTo(0,900);c.fillStyle=dirt;c.fill();
    for(let i=0;i<W*2.4;i++){const x=random()*W,y=ground(x)+random()*135;c.globalAlpha=.12+random()*.17;c.fillStyle=['#b2ae81','#0d1e21','#7e805a','#6b6246'][i%4];c.fillRect(x,y,1+random()*6,1+random()*2);}c.globalAlpha=1;
    for(let i=0;i<W*.6;i++){const x=random()*W,y=ground(x);c.strokeStyle=['#636c49','#8d8f5c','#394e3f','#ac9f65'][i%4];c.lineWidth=.8;c.beginPath();c.moveTo(x,y+2);c.quadraticCurveTo(x-3,y-6,x+(random()-.5)*13,y-3-random()*14);c.stroke();}
    // Low foreground plants and stones add depth without concealing targets.
    for(let i=0;i<W/28;i++){const x=random()*W,y=775+random()*90,r=4+random()*18;c.fillStyle=i%2?'#172a27':'#21322c';c.beginPath();c.ellipse(x,y,r,r*.35,0,0,TAU);c.fill();}
  }
  function makeBackdrop(){
    sceneBackdrop=document.createElement('canvas');sceneBackdrop.width=canvas.width+Math.ceil(maxCamera()*viewScale*dpr*.24);sceneBackdrop.height=canvas.height;
    const q=sceneBackdrop.getContext('2d'),image=assets.get(C.eras[currentTheme].backgroundFile)||background,w=sceneBackdrop.width,h=sceneBackdrop.height;q.fillStyle='#1c353b';q.fillRect(0,0,w,h);
    if(image&&(image.width||image.naturalWidth)){const scale=Math.max(w/image.width,h/image.height),iw=image.width*scale,ih=image.height*scale;q.drawImage(image,(w-iw)/2,(h-ih)/2,iw,ih);}
  }
  function drawFlag(x,y,w,h,color,t){ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+w*.4,y+Math.sin(t*2)*3,x+w*.6,y-5,x+w,y+Math.sin(t*2.5)*5);ctx.lineTo(x+w-3,y+h*.6);ctx.lineTo(x+w*.6,y+h*.9);ctx.quadraticCurveTo(x+w*.3,y+h-4,x,y+h);ctx.closePath();ctx.fillStyle=color;ctx.fill();line([[x+2,y],[x+2,y+h]],'#bfa675',1);ctx.fillStyle='#cdb67b';poly([[x+w*.4,y+h*.27],[x+w*.53,y+h*.44],[x+w*.4,y+h*.62],[x+w*.28,y+h*.44]],'#bca873');}
  function torch(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);line([[0,13],[3,-2]],'#40342b',5);glow(3,-10,40,'#eda44b35');const f=Math.sin(clock*18)*2;poly([[-4,-1],[-3,-10],[3+f,-24],[5,-12],[9,-5],[5,1]],'#e5a055');poly([[0,-1],[2,-15],[6,-6],[5,1]],'#ffe1a1');ctx.restore();}

  function drawAmbient(){
    // Slow mist, drifting pollen, leaves, and flock silhouettes.
    ctx.save();ctx.globalAlpha=.22;
    for(let i=0;i<3;i++){const x=((clock*(5+i*2)+i*640)%(W+750))-300,y=590+i*39;const g=ctx.createRadialGradient(x,y,0,x,y,380);g.addColorStop(0,'#bbcbb84a');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-380,y-100,760,200);}ctx.restore();
    for(const b of birds){const x=(b.x+clock*8)%(W+150)-50,y=b.y+Math.sin(clock*.4+b.p)*8,a=Math.sin(clock*5+b.p)*4;line([[x-5,y-a],[x,y],[x+5,y-a]],'#1e373b',1.4);}
    for(const d of dust){const x=(d.x+clock*8*d.z)%(W+100),y=d.y+Math.sin(clock*.5+d.p)*18;ctx.globalAlpha=(.25+Math.sin(clock+d.p)*.18)*d.z;ellipse(x,y,d.z*1.5,d.z*1.5,'#f1dfb0');}ctx.globalAlpha=1;
    for(const l of leaves){const x=(l.x-clock*14+100000)%(W+100),y=l.y+Math.sin(clock*.7+l.p)*24;ctx.save();ctx.translate(x,y);ctx.rotate(clock+l.p);ellipse(0,0,l.s,l.s*.35,'#bd9a5b90');ctx.restore();}
    for(const s of smoke){const p=(s.p+clock*.055)%1;ctx.globalAlpha=(1-p)*.12;ellipse(302-p*35+Math.sin(p*8)*7,562-p*150,7+p*19,12+p*22,'#b6c3b0');}ctx.globalAlpha=1;
  }
  function atlasDraw(target,id,frame,x,y,height,direction=1,alpha=1){
    const meta=A[id],image=meta&&assets.get(meta.file);if(!meta||!image)return;
    const f=meta.frames[clamp(frame,0,meta.frames.length-1)],scale=height/meta.bodyHeight;
    target.save();target.translate(x,y);target.scale(direction,1);target.globalAlpha*=alpha;
    target.drawImage(image,f.x,f.y,f.w,f.h,-f.ax*scale,-f.ay*scale,f.w*scale,f.h*scale);target.restore();
  }
  function animationFrame(f){
    const d=C.unitById[f.defId];
    if(f.anim==='attack'&&d.cls==='boss')return f.animTime<.5?4:f.animTime<.75?5:6;
    if(f.anim==='attack')return 4+clamp(Math.floor(f.animTime/.22),0,2);
    if(d.air)return Math.floor((f.flightTime||0)/.85*4)%4;
    return f.anim==='walk'?Math.floor(gaitPhase(f)*4):0;
  }
  function drawFighter(f,dead=false){
    const d=C.unitById[f.defId],height=f.height,groundY=ground(f.x),y=dead&&d.air?Math.min(groundY,f.y+f.deathTime*210):f.y-(f.anim==='walk'&&!d.air&&!dead&&!reducedMotion?Math.sin(gaitPhase(f)*TAU*2)**2*(d.cls==='cavalry'?2.2:1.2):0);
    if(!dead){ellipse(f.x,groundY+1,d.radius*.9,4,f.side===1?'#82b8a23a':'#c1876b35');line([[f.x-11,groundY+3],[f.x+11,groundY+3]],f.side===1?'#a4ccaa80':'#c38a7180',1.5);}
    ctx.save();if(f.flash>0&&!dead)ctx.filter='brightness(1.45)';if(f.frost>0){ctx.shadowColor='#93dbe5';ctx.shadowBlur=5;}
    const frame=dead?7:f.rollTime>0?(f.rollTime>.77?8:f.rollTime<.14?11:9+Math.floor((.88-f.rollTime)*8)%2):animationFrame(f);atlasDraw(ctx,d.sprite,frame,f.x,y,height,f.side,dead?Math.min(1,(1.25-f.deathTime)*2):1);ctx.restore();
    if(dead)return;
    if(f.chargeFlash>0){ctx.save();ctx.globalAlpha=f.chargeFlash*.7;line([[f.x-f.side*70,y-40],[f.x-f.side*20,y-40]],C.eras[d.tier].color,2);ctx.restore();}
    if(f.rally>0){ellipse(f.x,groundY-1,d.radius,3,'#aad5a65c');ctx.font='10px DM Sans';ctx.textAlign='center';ctx.fillStyle='#c8e4b3';ctx.fillText('⚑',f.x+19,f.y-height-10);}
    if(f.charm>0){drawHeart(f.x,f.y-height-16,5,'#e8a5c4');}
    if(f.hp<f.maxHp||f.boss){const w=f.boss?83:38,yy=f.y-height-11;ctx.fillStyle='#0c1d21c0';ctx.fillRect(f.x-w/2,yy,w,3);ctx.fillStyle=f.side===1?'#afc696':f.boss?'#dfbd7d':'#c19b7f';ctx.fillRect(f.x-w/2,yy,w*clamp(f.hp/f.maxHp,0,1),3);}
    if(f.boss){ctx.font='8px Cinzel,Georgia';ctx.textAlign='center';ctx.fillStyle='#e6c58e';ctx.fillText(d.name.toUpperCase(),f.x,f.y-height-20);}
    if(d.air&&!dead){ctx.font='7px DM Sans';ctx.textAlign='center';ctx.fillStyle=f.side===1?'#b4d8ce':'#ddc2b5';ctx.fillText('LUFT',f.x,f.y-height-19);}
  }
  function drawHeart(x,y,r,color){ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,r);ctx.bezierCurveTo(-r*2,-r*.4,-r,-r*1.9,0,-r*.75);ctx.bezierCurveTo(r,-r*1.9,r*2,-r*.4,0,r);ctx.fill();ctx.restore();}
  function drawHero(){
    const row=state.angle<-.2?0:state.angle>.18?2:1;
    const phase=state.charging?state.charge>.4?2:1:state.recoil>0?3:0;
    atlasDraw(ctx,'hero',row*4+phase,HERO_FEET.x,HERO_FEET.y,123,1);
  }
  function drawCastle(){
    for(const side of [1,-1]){const era=side===1?state.era:state.enemyEra,e=C.eras[era],img=assets.get(e.baseFile)||castleArt,p=e.basePlacement;ctx.save();if(side===-1){ctx.translate(W,0);ctx.scale(-1,1);}if(img&&(img.width||img.naturalWidth))ctx.drawImage(img,p.x,p.y,p.w,p.h);ctx.restore();
      if(era===2){const x=side===1?8:W-164;ctx.fillStyle='#291619';ctx.fillRect(x,462,156,36);ctx.strokeStyle='#c39959';ctx.lineWidth=1;ctx.strokeRect(x+2,464,152,32);ctx.font='14px Cinzel,Georgia';ctx.textAlign='center';ctx.fillStyle='#f0c77f';ctx.fillText('CLUB ROYALE',x+78,487);}
    }
    line([[337,495],[337,441]],'#7b6c4f',2);drawFlag(338,446,37,29,C.eras[state.era].color,clock*.85);line([[W-337,495],[W-337,441]],'#7b6c4f',2);drawFlag(W-337,446,30,25,C.eras[state.enemyEra].color,clock*.9+2);
    if(state.era===0){torch(313,571,.8);torch(98,589,.6);}if(state.hp/state.maxHp<.4){glow(301,635,45,'#df93472b');torch(295,643,.65);}
    for(let i=0;i<3;i++){const p=turretPosition(i),t=state.slots[i];
      if(state.era>0){ctx.fillStyle=state.era===2?'#8e6358':'#5c6e6d';ctx.fillRect(p.x-34,p.y,68,6);line([[p.x-29,p.y+5],[p.x-22,p.y+17]],'#4e5a55',3);line([[p.x+29,p.y+5],[p.x+22,p.y+17]],'#4e5a55',3);}
      if(t){const d=C.turretById[t.id],meta=A[d.visualAtlas],image=meta&&assets.get(meta.file),f=meta?.frames[d.visualFrame];if(image&&f){const h=d.row===0?67:76,s=h/f.h;ctx.save();ctx.translate(p.x,p.y);ctx.translate(t.animation>0?-Math.sin(t.animation*22)*2:0,0);ctx.drawImage(image,f.x,f.y,f.w,f.h,-f.w*s*.5,-h,f.w*s,h);ctx.restore();}for(let l=0;l<t.level;l++)ellipse(p.x-5+l*5,p.y+8,1.3,1.3,'#d9bd83');}
      if(tab==='turrets'&&state.mode==='play'){ctx.save();ctx.strokeStyle=selectedTurret?'#e1c584':'#acb99280';ctx.setLineDash([3,4]);ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y-9,39,22,0,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.font='10px Cinzel';ctx.textAlign='center';ctx.fillStyle='#ead9ab';ctx.fillText(String(i+1),p.x,p.y-78);ctx.restore();}
    }
  }
  function drawProjectile(p){
    const colors={heart:'#e8a2c6',steel:'#d7d2ac',multi:'#d7d2ac',fire:'#efb77d',ice:'#a7dee2',lightning:'#d3ece1',bomb:'#edc28a'},color=colors[p.effect]||'#d8d1ad';
    if(p.trail.length>1){ctx.save();ctx.globalAlpha=p.kind==='pulse'?.65:.25;line(p.trail.map(t=>[t.x,t.y]),color,p.kind==='pulse'?2.4:1);ctx.restore();}
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy||0,p.vx||1));
    if(p.kind==='heart'){line([[-15,0],[0,0]],'#d7b79f',1.2);drawHeart(3,0,4,'#edaccb');}else if(p.kind==='stone'||p.kind==='shell'){ellipse(0,0,p.kind==='shell'?5:3.3,3.3,'#9b977f');}
    else if(p.kind==='bullet'){line([[-8,0],[3,0]],'#f1dca7',1.7);}
    else if(p.kind==='pulse'){glow(0,0,14,'#8ee1e640');line([[-18,0],[5,0]],'#b1eff1',2.5);}
    else{line([[-23,0],[7,0]],'#b9aa7f',1.5);poly([[10,0],[3,-2.5],[3,2.5]],color);line([[-19,0],[-24,-3]],'#bfc5a5',1.4);line([[-19,0],[-24,3]],'#bfc5a5',1.4);}
    if(p.effect!=='steel'&&p.effect!=='multi')glow(0,0,13,color+'60');ctx.restore();
  }
  function drawAim(){
    if(state.mode!=='play'||selectedTurret)return;
    const x=clamp(state.aim.x,310,W-30),y=clamp(state.aim.y,160,745);
    ctx.save();ctx.globalAlpha=.55;ctx.strokeStyle='#e4d4a2';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,9,0,TAU);ctx.stroke();for(let i=0;i<4;i++){const a=i*TAU/4;line([[x+Math.cos(a)*13,y+Math.sin(a)*13],[x+Math.cos(a)*18,y+Math.sin(a)*18]],'#e4d4a2',1);}ctx.restore();
    if(!state.charging)return;
    const v=arrowSpeed(),vx=Math.cos(state.angle)*v,vy=Math.sin(state.angle)*v;
    for(let t=.07;t<5.5;t+=.07){const ax=HERO.x+vx*t,ay=HERO.y+vy*t+GRAVITY*t*t/2;if(ax>W||ay>ground(ax))break;if(ax<camera.x-5||ax>camera.x+viewWidth+5)continue;ctx.globalAlpha=.3;ellipse(ax,ay,1.6,1.6,'#dfd3a9');}ctx.globalAlpha=1;
    const bx=camera.x>HERO.x-90?clamp(x,camera.x+50,camera.x+viewWidth-50)-34:196,by=camera.x>HERO.x-90?y-30:350;
    ctx.fillStyle='#15282ace';ctx.fillRect(bx,by,68,3);ctx.fillStyle=state.charge>.95?'#e7d19a':'#a5b79a';ctx.fillRect(bx,by,68*state.charge,3);ctx.font='7px DM Sans,Segoe UI';ctx.textAlign='center';ctx.fillStyle='#d7d1b7';ctx.fillText(!state.aimReachable?'SPÄNN MER':state.charge>.95?'FULL KRAFT':`${Math.round(state.charge*100)} %`,bx+34,by-8);
  }
  function preparePortraitCanvas(c){const w=Math.max(2,Math.round(c.clientWidth*2)),h=Math.max(2,Math.round(c.clientHeight*2));if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;return c.getContext('2d');}
  function paintPortraits(){
    document.querySelectorAll('[data-portrait]').forEach(c=>{const q=preparePortraitCanvas(c);q.clearRect(0,0,c.width,c.height);atlasDraw(q,C.unitById[c.dataset.portrait].sprite,0,c.width*.5,c.height-4,c.height*.9);});
    document.querySelectorAll('[data-turret-portrait]').forEach(c=>paintTurret(c,c.dataset.turretPortrait));
  }
  function paintTurret(c,id){const q=preparePortraitCanvas(c),d=C.turretById[id],meta=A[d.visualAtlas],img=meta&&assets.get(meta.file);q.clearRect(0,0,c.width,c.height);if(!img)return;const f=meta.frames[d.visualFrame],s=Math.min((c.width-8)/f.w,(c.height-9)/f.h);q.drawImage(img,f.x,f.y,f.w,f.h,(c.width-f.w*s)/2,(c.height-f.h*s)/2,f.w*s,f.h*s);}
  function renderCodexFrames(){
    document.querySelectorAll('[data-codex-unit]').forEach(c=>{const q=preparePortraitCanvas(c),d=C.unitById[c.dataset.codexUnit],t=clock%Math.max(d.interval,.8);q.clearRect(0,0,c.width,c.height);
      const preview={defId:d.id,anim:codexAnimation==='attack'||codexAnimation==='ability'?'attack':'walk',animTime:t,walkDistance:clock*d.speed,gaitOffset:0,flightTime:clock};
      const frame=codexAnimation==='death'?7:codexAnimation==='ability'&&d.roll?8+Math.floor(clock*4)%4:animationFrame(preview);
      atlasDraw(q,d.sprite,frame,c.width*.48,c.height-15,c.height*.78);
    });document.querySelectorAll('[data-codex-turret]').forEach(c=>paintTurret(c,c.dataset.codexTurret));
  }
  function render(){
    if(!staticLayer)makeStatic();if(!sceneBackdrop)makeBackdrop();ctx.setTransform(1,0,0,1,0,0);if(previousBackdrop&&themeBlend>0){ctx.drawImage(previousBackdrop,camera.x*viewScale*dpr*.24,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height);ctx.globalAlpha=1-themeBlend/.75;ctx.drawImage(sceneBackdrop,camera.x*viewScale*dpr*.24,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height);ctx.globalAlpha=1;}else ctx.drawImage(sceneBackdrop,camera.x*viewScale*dpr*.24,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height);ctx.setTransform(dpr*viewScale,0,0,dpr*viewScale,-camera.x*viewScale*dpr,dpr*viewOffsetY);ctx.save();if(state.shake&&!reducedMotion)ctx.translate(rng(-state.shake,state.shake),rng(-state.shake*.4,state.shake*.4));
    ctx.drawImage(staticLayer,0,0,W,H);drawAmbient();drawCastle();drawHero();
    if(state.mode==='intro'&&loaded){for(let i=0;i<4;i++){const id=C.eras[0].unitIds[[0,2,3,4][i]],f={defId:id,side:1,x:viewWidth*.59+i*93,y:ground(viewWidth*.59+i*93),height:C.unitById[id].height,anim:'idle',walkDistance:0,gaitOffset:0,flightTime:0,hp:100,maxHp:100,flash:0,frost:0,charm:0,rollTime:0,chargeFlash:0};drawFighter(f);}}
    for(const c of corpses)drawFighter(c,true);
    fighters.slice().sort((a,b)=>a.y-b.y).forEach(f=>drawFighter(f));
    for(const h of hazards)glow(h.x,h.y-6,h.r,'#dfad691f');
    for(const p of projectiles)drawProjectile(p);
    for(const r of rings){
      ctx.save();ctx.globalAlpha=clamp(r.life/r.max,0,1);
      if(r.telegraph){ctx.strokeStyle='#eac09a';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r*.3,0,0,TAU);ctx.stroke();ctx.setLineDash([]);}else if(r.lightning){ctx.shadowColor='#d8eee8';ctx.shadowBlur=10;const points=[[r.x,r.y]];for(let t=.1;t<1;t+=.1)points.push([r.x+(r.x2-r.x)*t+Math.sin(t*92+r.seed)*14,r.y+(r.y2-r.y)*t+Math.cos(t*75)*8]);points.push([r.x2,r.y2]);line(points,'#dbefe1',2);}
      else{ctx.strokeStyle=r.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r*(1-r.life/r.max),r.r*(1-r.life/r.max)*.5,0,0,TAU);ctx.stroke();}
      ctx.restore();
    }
    ctx.save();ctx.globalCompositeOperation='lighter';for(const p of particles){ctx.globalAlpha=p.life/p.max;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size*.7);}ctx.restore();
    for(const t of texts){ctx.save();ctx.globalAlpha=Math.min(1,t.life*1.5);ctx.textAlign='center';ctx.font=`600 ${t.size}px DM Sans,Segoe UI`;ctx.fillStyle=t.color;ctx.shadowColor='#081b23';ctx.shadowBlur=4;ctx.fillText(t.text,t.x,t.y);ctx.restore();}
    drawAim();ctx.restore();drawMinimap();if(state.mode==='codex')renderCodexFrames();
  }

  // RENDERING, SCENERY AND SOUND
  function frame(now){const dt=Math.max(0,Math.min((now-last)/1000,.035));last=now;const steps=Math.max(1,Math.ceil(dt*state.speed*60));for(let i=0;i<steps;i++)update(dt*state.speed/steps,dt/steps);render();requestAnimationFrame(frame);}
  function resize(){
    const measured=$('command-hud').clientHeight,deckHeight=(measured>0&&measured<innerHeight*.45?measured:innerHeight<=560?114:innerWidth<=650?154:160)+(innerWidth<=650?36:0),groundScreenY=innerHeight-deckHeight-12;
    $('game').style.setProperty('--deck-height',deckHeight+'px');
    viewScale=Math.min(innerWidth/1050,groundScreenY/720);viewOffsetY=groundScreenY-720*viewScale;viewWidth=innerWidth/viewScale;
    dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(canvas.clientWidth*dpr);canvas.height=Math.round(canvas.clientHeight*dpr);staticLayer=null;sceneBackdrop=null;previousBackdrop=null;themeBlend=0;
    camera.x=clamp(camera.x,0,maxCamera());if(camera.target!==null)camera.target=clamp(camera.target,0,maxCamera());
    const map=$('battle-map');map.width=Math.max(2,Math.round(map.clientWidth*dpr));map.height=Math.max(2,Math.round(map.clientHeight*dpr));syncPointerAim();paintPortraits();
  }
  window.addEventListener('resize',resize);
  initUI();resize();renderCommands();requestAnimationFrame(frame);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe($('command-hud'));
  const files=[...new Set([...C.atlasFiles,...C.themeFiles])];let loadCount=0;
  Promise.all(files.map(file=>loadImage(file).then(()=>{$('start-label').textContent=`LADDAR ARMÉERNA · ${++loadCount}/${files.length}`;}))).then(()=>{loaded=true;$('start').disabled=false;$('start-label').textContent=readCheckpoint()?'STARTA NY KAMPANJ':'STARTA KAMPANJEN';paintPortraits();}).catch(err=>{$('start-label').textContent='GRAFIK SAKNAS — LADDA OM';toast(`Grafikfilen kunde inte öppnas: ${err.message}`);});
  window.Emberfall=Object.freeze({snapshot:()=>({version:5,ready:loaded,mode:state.mode,difficulty:state.difficulty,speed:state.speed,doctrine:state.doctrine,nextDoctrine:state.nextDoctrine,elapsed:state.elapsed,waveXP:state.waveXP,xpBudget:xpBudget(),rallyCooldown:state.rallyCooldown,gateExposed:state.gateExposed,waveLosses:state.waveLosses,ai:director?{name:director.name,budget:director.budget,gold:director.gold,spent:director.spent,cap:difficulty().cap,scoutInterval:difficulty().scout,scouted:{...director.scouted},released:director.released,pending:director.pending,history:director.history.map(j=>({...j}))}:null,era:state.era,wave:state.wave,gold:state.gold,xp:state.xp,hp:state.hp,maxHp:state.maxHp,enemyHP:state.enemyHP,enemyMaxHP:state.enemyMaxHP,mana:state.mana,shots:state.shots,hits:state.hits,kills:state.kills,headshots:state.headshots,queuedEnemies:spawnQueue.length,training:trainingQueue.map(j=>({...j})),fighters:fighters.map(f=>({id:f.id,defId:f.defId,side:f.side,x:f.x,y:f.y,hp:f.hp,maxHp:f.maxHp,height:f.height,anim:f.anim,animTime:f.animTime,animationFrame:animationFrame(f),walkDistance:f.walkDistance,stride:strideLength(C.unitById[f.defId]),flightTime:f.flightTime,boss:f.boss,cls:C.unitById[f.defId].cls,air:C.unitById[f.defId].air,abilityCooldown:f.abilityCooldown,rollTime:f.rollTime,charm:f.charm,rally:f.rally})),slots:state.slots.map(t=>t?{...t}:null),projectiles:projectiles.length,troopTypes:C.units.length,turretTypes:C.turrets.length,spriteSheets:assets.size,upgrades:{...state.upgrades},population:population(),worldTheme:currentTheme,lastClearedWave:state.lastClearedWave,lastEvolveWave:state.lastEvolveWave,camera:{x:camera.x,maxX:maxCamera(),viewWidth,velocity:camera.velocity},world:{width:W,height:H,scale:viewScale,offsetY:viewOffsetY}})});
})();

