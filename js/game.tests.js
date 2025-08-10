(function runTests(){

  function tests(){
  const K = window.KBTS;
  const {state,T,SPEC,BASE,idx,cell,generate,reveal,isCoast,
      startUpgrade,applyAdjacencyBonuses,uniqueAvailable,
      noHouseNearby,houseNearby,setFarmWorkers,farmWorkers,
      endTurn,randomEvent,label,resize,hud,draw,showStart,
      rng32,afford,whyNo,DIRS} = K;
  const as=(c,m)=>{if(!c)throw new Error(m)}, snap={...state,size:{...state.size},map:state.map};
        try{
            // Stabilize randomness across non-event tests
            state.noEvents = true;
            const keepSeedRng = state.rng; state.rng = rng32(123456);

      // Initialize state for afford tests
      state.gold = 10;
      state.wood = 5;
      state.people = 3;
      state.food = 2;

      // afford()
  as(afford({}) === true, 'afford empty');
  as(afford({G: 1}) === true, 'afford G1');
  as(afford({G: 999}) === false, 'afford G999');
      const foodKeep = state.food; 
      state.food = 0; 
      as(afford({F: 1}) === false, 'afford F1 with 0 food false'); 
      state.food = 1; 
      as(afford({F: 1}) === true, 'afford F1 with 1 food true'); 
      state.food = foodKeep;
      let why=whyNo({cost:{G:2,W:1,P:3}},{upg:null}); state.actions=0; why=whyNo({cost:{G:2,W:1,P:3}},{upg:null}); as(why.includes('no actions'),'why no actions'); state.actions=2;
    as(BASE[T.HOUSE].G===1,'house yield'); as(BASE[T.MANSION].G===2,'mansion yield'); as(BASE[T.CASTLE].G===4,'castle yield');
    // Farm converts to house (with worker producing this turn)
    state.size={w:1,h:1,t:snap.size.t};
    state.map=[cell(T.FARM)];
    state.map[0].disc=true;
    state.map[0].wrk=1;
    state.gold=1; state.wood=1; state.people=1; state.actions=1; state.year=1; state.food=1;
    startUpgrade(0,0,state.map[0],SPEC[T.FARM][0]);
    endTurn();
    as(state.map[0].type===T.HOUSE,'farm converts to house');
    as(state.people===2,'+1 person from conversion');
    as(state.food===2,'worker yields food (2F)');
      as(state.map[0].type===T.HOUSE,'farm converts to house');
      as(state.people===2,'+1 person from conversion');
      as(state.food===2,'worker yields food (2F)');
      
      state.size={w:3,h:1,t:snap.size.t}; state.map=[cell(T.GRASS),cell(T.WATER),cell(T.WATER)]; state.map[0].disc=state.map[1].disc=state.map[2].disc=true; as(isCoast(1,0)===true,'middle water is coast'); as(isCoast(2,0)===false,'far water not coast'); as(!!SPEC[T.WATER]&&SPEC[T.WATER][0].to===T.DOCK,'dock spec present');
      state.size={w:2,h:1,t:snap.size.t}; state.map=[cell(T.FARM),cell(T.DOCK)]; state.map[0].disc=state.map[1].disc=true; let dd2={G:0,F:0,W:0,P:0,events:[]}; applyAdjacencyBonuses(dd2); as(dd2.F===1,'dock next to farm +1F'); state.size={w:2,h:1,t:snap.size.t}; state.map=[cell(T.DOCK),cell(T.HOUSE)]; state.map[0].disc=state.map[1].disc=true; let dd3={G:0,F:0,W:0,P:0,events:[]}; applyAdjacencyBonuses(dd3); as(dd3.G===1,'dock next to house +1G');
      state.size={w:2,h:1,t:snap.size.t}; state.map=[cell(T.PALACE),cell(T.MANSION)]; state.map[0].disc=state.map[1].disc=true; as(uniqueAvailable(T.PALACE)===false,'only one palace'); as(uniqueAvailable(T.CASTLE)===true,'castle still ok (none yet)'); state.map[0].type=T.CASTLE; as(uniqueAvailable(T.CASTLE)===false,'only one castle');
      state.size={w:3,h:3,t:snap.size.t}; state.map=new Array(9).fill(0).map(()=>cell(T.GRASS)); state.map[idx(1,1)].type=T.HOUSE; state.map[idx(1,1)].disc=true; state.map[idx(1,2)].type=T.FARM; state.map[idx(1,2)].disc=true; state.actions=1; state.gold=1; state.wood=1; startUpgrade(1,2,state.map[idx(1,2)],SPEC[T.FARM][0]); as(!state.map[idx(1,2)].upg,'blocked by spacing (adjacent south)');
      state.size={w:4,h:1,t:snap.size.t}; state.map=[cell(T.HOUSE),cell(T.GRASS),cell(T.FARM),cell(T.GRASS)]; state.map[0].disc=state.map[2].disc=true; state.actions=1; state.gold=1; state.wood=1; startUpgrade(2,0,state.map[2],SPEC[T.FARM][0]); as(!!state.map[2].upg,'allowed when spaced by 1 tile');
      state.size={w:3,h:3,t:snap.size.t}; state.map=new Array(9).fill(0).map(()=>cell(T.GRASS)); state.map[idx(1,1)].type=T.HOUSE; state.map[idx(1,1)].disc=true; state.map[idx(2,2)].type=T.HUT; state.map[idx(2,2)].disc=true; state.actions=1; state.gold=1; state.wood=1; startUpgrade(2,2,state.map[idx(2,2)],SPEC[T.HUT][0]); as(!state.map[idx(2,2)].upg,'hut->house blocked diagonally');
      state.size={w:3,h:1,t:snap.size.t}; state.map=[cell(T.GRASS),cell(T.HOUSE),cell(T.GRASS)]; state.map[1].disc=true; as(houseNearby(0,0)===true,'houseNearby detects left'); as(noHouseNearby(0,0)===false,'noHouseNearby false when neighbor present'); state.size={w:3,h:1,t:snap.size.t}; state.map=[cell(T.GRASS),cell(T.GRASS),cell(T.GRASS)]; state.map[0].disc=state.map[1].disc=state.map[2].disc=true; as(noHouseNearby(1,0)===true,'noHouseNearby true when clear');
      as(SPEC[T.FARM][0].cost.G===1&&SPEC[T.FARM][0].cost.W===1,'Farm→House cost G1 W1'); as(SPEC[T.HUT][0].cost.G===1&&SPEC[T.HUT][0].cost.W===1,'Hut→House cost G1 W1'); state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.FARM)]; state.map[0].disc=true; state.gold=1; state.wood=0; state.actions=1; startUpgrade(0,0,state.map[0],SPEC[T.FARM][0]); as(!state.map[0].upg,'blocked when missing wood'); state.wood=1; startUpgrade(0,0,state.map[0],SPEC[T.FARM][0]); as(!!state.map[0].upg,'starts when have G & W');
      state.size={w:3,h:1,t:snap.size.t}; state.map=[cell(T.HUT),cell(T.FARM),cell(T.GRASS)]; state.map[0].disc=state.map[1].disc=state.map[2].disc=true; state.actions=1; state.gold=1; state.wood=1; startUpgrade(1,0,state.map[1],SPEC[T.FARM][0]); as(!state.map[1].upg,'farm→house blocked by hut buffer'); state.size={w:2,h:1,t:snap.size.t}; state.map=[cell(T.HOUSE),cell(T.HILL)]; state.map[0].disc=state.map[1].disc=true; state.actions=1; state.gold=1; startUpgrade(1,0,state.map[1],SPEC[T.HILL][0]); as(!state.map[1].upg,'mine blocked near house'); state.size={w:2,h:1,t:snap.size.t}; state.map=[cell(T.HOUSE),cell(T.FOREST)]; state.map[0].disc=state.map[1].disc=true; state.actions=1; startUpgrade(1,0,state.map[1],SPEC[T.FOREST][0]); as(!!state.map[1].upg,'clear forest allowed near house'); endTurn(); as(state.map[1].type===T.GRASS,'cleared to grass'); state.size={w:2,h:1,t:snap.size.t}; state.map=[cell(T.HOUSE),cell(T.WATER)]; state.map[0].disc=state.map[1].disc=true; state.actions=1; state.wood=1; as(isCoast(1,0)===true,'water is coast next to house'); startUpgrade(1,0,state.map[1],SPEC[T.WATER][0]); as(!state.map[1].upg,'dock blocked near house');
      // Workforce & farm yield 2F
      state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.FARM)]; state.map[0].disc=true; state.people=2; state.actions=2; setFarmWorkers(0,0,+1); as(state.map[0].wrk===1&&state.actions===1,'assign worker consumes 1 action'); setFarmWorkers(0,0,-1); as(state.map[0].wrk===0&&state.actions===2,'unassign gives action back');
  // No worker => no yield
  state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.FARM)]; state.map[0].disc=true; state.people=0; state.actions=1; state.food=0; state.year=10; endTurn(); as(state.food===0,'no worker, no farm yield');
  // Fresh setup so we have an action to assign a worker, then yield 2F
  state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.FARM)]; state.map[0].disc=true; state.people=0; state.actions=1; state.food=0; setFarmWorkers(0,0,+1); endTurn(); as(state.food===2,'worker yields food (2F)');
  state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.FARM)]; state.map[0].disc=true; state.map[0].wrk=1; state.people=3; state.actions=3; state.food=3; state.year=5; endTurn(); as(state.actions===2,'actions reduced by farm workers at start of turn');
      state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.FARM)]; state.map[0].disc=true; state.people=3; state.actions=3; setFarmWorkers(0,0,+1); setFarmWorkers(0,0,+1); as(state.map[0].wrk===1,'cannot exceed 1 worker'); const aBefore=state.actions; setFarmWorkers(0,0,-1); setFarmWorkers(0,0,-1); as(state.map[0].wrk===0&&state.actions>=aBefore,'cannot go below 0 workers');
      // Hoisting & pre-rules
      as(typeof noHouseNearby==='function','noHouseNearby is function');
      state.size={w:3,h:3,t:snap.size.t}; state.map=new Array(9).fill(0).map(()=>cell(T.GRASS)); state.map.forEach(c=>c.disc=true);
      as(SPEC[T.FARM][0].pre(1,1)===true,'pre: no house nearby returns true');
      state.map[idx(1,2)].type=T.HOUSE; as(SPEC[T.FARM][0].pre(1,1)===false,'pre: blocked when house adjacent');
      // Starvation immediate
      state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.GRASS)]; state.map[0].disc=true; state.people=2; state.food=0; state.year=1; endTurn(); as(state.people===1,'shortage: immediate starvation');

      // Event deaths remove people/workers
      state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.FARM)]; state.map[0].disc=true; state.map[0].wrk=1; state.people=2; let keepRng=state.rng; state.rng=()=>0.1; let dFire={G:0,F:0,W:0,P:0,events:[]}; randomEvent(dFire); as(state.map[0].type===T.BURNT,'fire -> burnt'); as(state.people===1 && dFire.P===-1,'worker dies in fire'); state.rng=keepRng;
      state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.HOUSE)]; state.map[0].disc=true; state.people=2; keepRng=state.rng; state.rng=()=>0.7; let dStorm={G:0,F:0,W:0,P:0,events:[]}; randomEvent(dStorm); as(state.map[0].type===T.RUBBLE,'storm -> rubble'); as(state.people===1 && dStorm.P===-1,'resident dies in storm'); state.rng=keepRng;
      state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.FARM)]; state.map[0].disc=true; state.map[0].wrk=1; state.people=2; state.actions=state.people-farmWorkers(); state.rng=()=>0.1; endTurn(); as(state.actions===Math.max(0,state.people-farmWorkers()),'actions recomputed after events');
      let ddChk={G:0,F:0,W:0,P:0,events:[]}; randomEvent(ddChk); ddChk.events.forEach(s=>as(typeof s==='string'&&s.length>0,'event line is string'));

      // Farm synergy (+1F with 4-way staffed neighbor), 1-turn delay
      state.size={w:2,h:1,t:snap.size.t}; state.map=[cell(T.FARM),cell(T.FARM)]; state.map[0].disc=state.map[1].disc=true; state.map[0].wrk=1; state.map[1].wrk=1; state.people=2; state.actions=0; state.food=0; let d1=endTurn(); as(d1.F===4,'two staffed farms, first turn no synergy'); as((state.map[0].fx|0)===1 && (state.map[1].fx|0)===1,'synergy pending'); let d2=endTurn(); as(d2.F===6,'second turn synergy active +2F total'); as((state.map[0].fx|0)===2 && (state.map[1].fx|0)===2,'synergy active');
      // Diagonal no synergy
      state.size={w:2,h:2,t:snap.size.t}; state.map=[cell(T.FARM),cell(T.GRASS),cell(T.GRASS),cell(T.FARM)]; state.map[idx(0,0)].disc=state.map[idx(1,1)].disc=true; state.map[idx(0,0)].wrk=1; state.map[idx(1,1)].wrk=1; state.people=2; state.food=0; d1=endTurn(); d2=endTurn(); as(d2.F===4,'diagonal farms no synergy');
      // Removing worker disables next turn
      state.size={w:2,h:1,t:snap.size.t}; state.map=[cell(T.FARM),cell(T.FARM)]; state.map[0].disc=state.map[1].disc=true; state.map[0].wrk=1; state.map[1].wrk=1; state.people=2; state.food=0; endTurn(); endTurn(); as((state.map[0].fx|0)===2 && (state.map[1].fx|0)===2,'active set'); state.map[0].wrk=0; let d3=endTurn(); as((state.map[0].fx|0)===0,'synergy removed after worker removed'); as(d3.F===1+1,'only one staffed farm without synergy');

      // Growth: 10F -> +1P
      state.size={w:1,h:1,t:snap.size.t}; state.map=[cell(T.FARM)]; state.map[0].disc=true; state.map[0].wrk=1; state.people=0; state.food=0; for(let i=0;i<5;i++) endTurn(); as(state.people===1,'growth after storing 10 food'); as(state.food===0,'food spent on growth');
    }catch(e){console.error('Tests failed:', e);
    } finally {
        // Restore randomness hooks
  state.noEvents = false;
        try{ state.rng = keepSeedRng; }catch(_){ }
        Object.assign(state, snap);
        state.size = snap.size;
        state.map = snap.map;
        resize();
        hud();
        draw();
    }
}

// Run tests once KBTS is ready, then show start screen
function runWhenReady(){
    if(!window.KBTS){ setTimeout(runWhenReady, 0); return; }
    try{ tests(); }catch(e){ console.error(e); }
    showStart();
}
runWhenReady();
})();
