/* Campaign rules. Difficulty changes resources, scouting and decisions, never unit stats. */
(() => {
  'use strict';
  const C=window.EmberfallContent;
  const difficulties=[
    {id:'recruit',name:'Rekryt',subtitle:'Lär dig hålla fronten',description:'Mer startguld, mindre anfall och en AI som följer sin krigsplan. Gott om tid att prova trupper.',eraSpan:3,eraOffset:0,garrison:0,startGold:720,size:.72,cap:12,scout:12,counter:0,opening:270,income:7,commit:.55,interval:2.3,squad:2,breather:7,delay:4},
    {id:'veteran',name:'Veteran',subtitle:'Det balanserade slaget',description:'Blandade anfallsgrupper. AI:n spanar var åttonde sekund och kan svara på din armé.',eraSpan:3,eraOffset:0,garrison:0,startGold:600,size:1,cap:16,scout:8,counter:.5,opening:330,income:9,commit:.68,interval:1.1,squad:3,breather:7,delay:3},
    {id:'commander',name:'Befälhavare',subtitle:'Läs fienden. Byt taktik.',description:'Större anfall, startgarnison och tätare spaning. AI:n kontrar din armé och når nya teman en belägring tidigare.',eraSpan:3,eraOffset:1,garrison:2,startGold:560,size:1.2,cap:20,scout:5,counter:.82,opening:380,income:11,commit:.8,interval:.65,squad:4,breather:6.5,delay:2.5},
    {id:'nightmare',name:'Mardröm',subtitle:'Krig utan andrum',description:'Stor startgarnison, full armé och snabba kontringar. AI:n når nästa tema varannan belägring. För erfarna väktare.',eraSpan:2,eraOffset:0,garrison:4,startGold:520,size:1.43,cap:24,scout:3,counter:.96,opening:420,income:13,commit:.9,interval:.4,squad:5,breather:5.5,delay:2}
  ];
  const plans=[
    {name:'Sköldfront',description:'Tankar täcker skyttar. Spjut och flygare kan bryta fronten.',pattern:[0,1,3,0,2,3,1,4,5]},
    {name:'Ryttarflank',description:'Kavalleri jagar dina skyttar. Sätt en spjutmur framför dem.',pattern:[0,4,2,3,4,0,5,2,1]},
    {name:'Jättens följe',description:'En jätte leder belägringen. Sprid skadan med skyttar och flygare.',pattern:[1,0,3,2,5,3,1,4,2]}
  ];
  const doctrines=[
    {id:'arrows',name:'Mästerskyttar',symbol:'➶',description:'+12 % skada med din båge under nästa belägring.'},
    {id:'logistics',name:'Förstärkningar',symbol:'⚑',description:'20 % snabbare rekrytering under nästa belägring.'},
    {id:'siege',name:'Murbräckare',symbol:'▣',description:'+25 % truppskada mot fiendens port under nästa belägring.'}
  ];
  const getDifficulty=id=>difficulties.find(d=>d.id===id)||difficulties[1];
  function enemyEra(wave,difficulty){const d=getDifficulty(difficulty);return Math.min(3,Math.floor((wave-1+d.eraOffset)/d.eraSpan));}
  function wavePlan(wave,era,difficulty){
    const d=getDifficulty(difficulty),plan=plans[(wave-1)%3],ids=C.eras[era].unitIds;
    const count=Math.max(4,Math.round((6+Math.floor(wave*.9))*d.size));
    const jobs=Array.from({length:count},(_,i)=>({id:ids[plan.pattern[i%plan.pattern.length]],boss:false}));
    if(wave%3===0)jobs.push({id:ids[6],boss:true});
    const budget=jobs.reduce((n,j)=>n+C.unitById[j.id].cost,0),priceScale=[1,1.55,2.25,3.2][era];
    return {name:plan.name,description:plan.description,jobs,budget,opening:Math.min(budget,Math.max(d.opening*priceScale,budget*d.commit)),income:(d.income+wave*.8)*priceScale};
  }
  function chooseRecruit(job,{difficulty,era,scouted={},own={},gold,spendable},random=Math.random){
    const d=getDifficulty(difficulty),planned=C.unitById[job.id],canBuy=u=>u.cost<=gold+.001&&u.cost<=spendable+.001;
    if(job.boss)return canBuy(planned)?planned.id:null;
    // The observer supplies a delayed snapshot of field troops; queues and future choices are unknown.
    if(random()>=d.counter||!Object.values(scouted).some(n=>n>0)){
      if(canBuy(planned))return planned.id;
      // Earlier counter-purchases may use a later job's allowance. A cheap
      // recruit completes that job; insufficient cash alone never forces it.
      if(planned.cost>spendable)return C.eras[era].unitIds.slice(0,6).map(id=>C.unitById[id]).filter(canBuy).sort((a,b)=>a.cost-b.cost)[0]?.id||null;
      return null;
    }
    const candidates=C.eras[era].unitIds.slice(0,6).map(id=>C.unitById[id]).filter(canBuy);
    let choice=null,best=-Infinity;
    for(const u of candidates){
      let score=u.cls===planned.cls?4:0;
      for(const [cls,n] of Object.entries(scouted)){
        const air=cls==='flyer';score+=n*(air&&!u.attackAir?-2:(C.counterMultiplier(u.cls,cls)-1)*4);
      }
      score-=(own[u.cls]||0)*1.6;score+=random()*1.3;
      if(score>best){best=score;choice=u.id;}
    }
    return choice;
  }
  window.EmberfallStrategy=Object.freeze({difficulties,doctrines,getDifficulty,enemyEra,wavePlan,chooseRecruit});
})();
