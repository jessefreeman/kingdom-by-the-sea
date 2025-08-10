// ===== Helpers =====
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rng32=a=>()=>{let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
const state={seed:0,rng:null,size:{w:10,h:8,t:parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile'),10)||24},map:[],year:1,gold:3,food:3,wood:2,people:3,actions:3,sel:null,riskRng:Math.random};
const idx=(x,y)=>y*state.size.w+x, inBounds=(x,y)=>x>=0&&y>=0&&x<state.size.w&&y<state.size.h;
const each=fn=>{for(let y=0;y<state.size.h;y++)for(let x=0;x<state.size.w;x++)fn(x,y,state.map[idx(x,y)])};
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]], rt=c=>c?(c.upg?c.upg.to:c.type):null;
const ov=(html,hook)=>{const w=document.createElement('div');w.className='overlay';Object.assign(w.style,{position:'absolute',inset:'0',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.55)'});w.innerHTML=`<div class="card">${html}</div>`;document.body.appendChild(w);if(hook)hook(w.querySelector('.card'),w);return w};

// ===== Data =====
const T={WATER:'water',GRASS:'grass',FOREST:'forest',HILL:'hill',MOUNTAIN:'mountain',HUT:'hut',HOUSE:'house',MANSION:'mansion',PALACE:'palace',CASTLE:'castle',FARM:'farm',MINE:'mine',BURNT:'burnt',RUBBLE:'rubble',DOCK:'dock',TOWN:'town'};
const HOUSELINE=[T.HUT,T.HOUSE,T.MANSION,T.PALACE,T.CASTLE];
const C={[T.WATER]:'#0c3b66',coast:'#155d96',[T.GRASS]:'#2e7d32',[T.FOREST]:'#1f5f24',[T.HILL]:'#7c6f4a',[T.MOUNTAIN]:'#5f5750',[T.FARM]:'#c68f39',[T.MINE]:'#8a7f78',[T.HUT]:'#9b5d2e',[T.HOUSE]:'#b97a3f',[T.MANSION]:'#d29a5a',[T.PALACE]:'#e2b874',[T.CASTLE]:'#e5d09a',[T.BURNT]:'#3a2d2d',[T.RUBBLE]:'#4a4a4a',[T.DOCK]:'#2563eb',fog:'#0a0d1a'};
const LABEL={[T.GRASS]:'G',[T.FOREST]:'F',[T.HILL]:'H',[T.MOUNTAIN]:'Mt',[T.HUT]:'Hu',[T.HOUSE]:'Ho',[T.MANSION]:'Ma',[T.PALACE]:'P',[T.CASTLE]:'C',[T.FARM]:'Fa',[T.MINE]:'Mi',[T.BURNT]:'B',[T.RUBBLE]:'R',[T.DOCK]:'Dk',[T.TOWN]:'T'};
const BASE={[T.FARM]:{F:2},[T.MINE]:{G:1},[T.HOUSE]:{G:1},[T.MANSION]:{G:2},[T.PALACE]:{G:3},[T.CASTLE]:{G:4},[T.DOCK]:{F:1,G:1}};

// Spacing helpers
function houseNearby(x,y){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(!inBounds(nx,ny))continue;const t=rt(state.map[idx(nx,ny)]); if(t&&HOUSELINE.includes(t)) return true} return false}
function noHouseNearby(x,y){ return !houseNearby(x,y); }

// ===== SPEC =====
const SPEC={
  [T.GRASS]:[{to:T.FARM,cost:{W:1},duration:1,perTurn:{F:1}}],
  [T.FARM]:[{to:T.HOUSE,cost:{G:1,W:1},duration:1,instant:{P:1},pre:noHouseNearby,req:'needs 1-tile spacing from other houses'}],
  [T.FOREST]:[{to:T.GRASS,cost:{},duration:1,instant:{W:2}}],
  [T.HILL]:[{to:T.MINE,cost:{G:1},duration:1,perTurn:{G:1}}],
  [T.WATER]:[{to:T.DOCK,cost:{W:1},duration:1,perTurn:{F:1,G:1},pre:(x,y)=>isCoast(x,y),req:'coast required'}],
  [T.HUT]:[{to:T.HOUSE,cost:{G:1,W:1},duration:1,pre:noHouseNearby,req:'needs 1-tile spacing from other houses'}],
  [T.HOUSE]:[{to:T.MANSION,cost:{G:2},duration:2,perTurn:{G:1}}],
  [T.MANSION]:[{to:T.PALACE,cost:{G:3},duration:2,perTurn:{G:2}}],
  [T.PALACE]:[{to:T.CASTLE,cost:{G:4},duration:3,perTurn:{G:3}}],
  [T.BURNT]:[{to:T.GRASS,cost:{W:1},duration:1}],
  [T.RUBBLE]:[{to:T.HUT,cost:{W:1},duration:1}]
};
const EXPLORE={RISK:0.25,FOOD:1};

// ===== State / Canvas =====
const cell=t=>({type:t,disc:false,upg:null,wrk:0,fx:0}); // farm: wrk workers, fx=synergy flag
const canvas=$('gameCanvas'), ctx=canvas.getContext('2d');
const resize=()=>{canvas.width=state.size.w*state.size.t;canvas.height=state.size.h*state.size.t; try{ if(typeof Renderer!=='undefined'&&Renderer.onResize) Renderer.onResize(); }catch(e){} };
function onWindowResize(){ Renderer.onResize(); }

// ===== Generation =====
function generate(seed=Date.now(),size='medium'){
  Object.assign(state.size,{small:{w:8,h:6},medium:{w:10,h:8},large:{w:12,h:8}}[size]);
  Object.assign(state,{seed, rng:rng32(seed), year:1,gold:3,food:3,wood:2,people:3,actions:3, sel:null});
  state.map=Array(state.size.w*state.size.h).fill(0).map(()=>cell(T.WATER));
  const cx=(state.size.w-1)/2, cy=(state.size.h-1)/2, maxR=Math.hypot(cx,cy);
  each((x,y,c)=>{const v=0.6-(Math.hypot(x-cx,y-cy)/maxR)+(state.rng()*0.35-0.15); c.type=v>0?T.GRASS:T.WATER});
  const L=[]; const n=Math.max(4,Math.floor((state.size.w*state.size.h)/12));
  for(let i=0;i<n;i++){const x=1+Math.floor(state.rng()*(state.size.w-2)),y=1+Math.floor(state.rng()*(state.size.h-2)); if(state.map[idx(x,y)].type!==T.WATER)L.push({x,y})}
  each((x,y,c)=>{if(c.type===T.WATER)return;let k=0;for(const m of L) if(Math.hypot(m.x-x,m.y-y)<=2.1) k++; c.type=k>=4?T.MOUNTAIN:k===3?T.HILL:k===2?T.FOREST:T.GRASS});
  for(const m of L){if(state.rng()<0.25){state.map[idx(m.x,m.y)].type=T.WATER;for(const d of DIRS){const nx=m.x+d[0],ny=m.y+d[1];if(inBounds(nx,ny)&&state.rng()<0.5)state.map[idx(nx,ny)].type=T.WATER}}}
  const gs=[]; each((x,y,c)=>{if(c.type===T.GRASS)gs.push({x,y})});
  const s=gs.sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy))[0]||{x:Math.floor(cx),y:Math.floor(cy)};
  state.map[idx(s.x,s.y)].type=T.HUT; ensureStartResources(s.x,s.y); reveal(s.x,s.y,1);
  let towns=0; each((x,y,c)=>{if(towns<2&&(c.type===T.GRASS||c.type===T.FOREST)&&(x+y)%7===0&&state.rng()<0.25){c.type=T.TOWN;towns++}});
  resize();hud();draw(); $('seedOut').textContent=state.seed; $('mapOut').textContent=`${state.size.w}×${state.size.h}`;
}
function reveal(cx,cy,r){for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){if(!inBounds(x,y))continue;const c=state.map[idx(x,y)]; if(c) c.disc=true}}
function ensureStartResources(sx,sy){const nbs=[];for(const d of DIRS){const nx=sx+d[0],ny=sy+d[1];if(!inBounds(nx,ny))continue;nbs.push({i:idx(nx,ny),cell:state.map[idx(nx,ny)],x:nx,y:ny})} if(!nbs.length)return; const pref=n=>n.cell.type===T.WATER?2:n.cell.type===T.MOUNTAIN?3:1; let forest=nbs.find(n=>n.cell.type===T.FOREST); if(!forest){forest=[...nbs].sort((a,b)=>pref(a)-pref(b))[0]; state.map[forest.i].type=T.FOREST} let grass=nbs.find(n=>n.cell.type===T.GRASS&&n.i!==forest.i); if(!grass){const cand=nbs.filter(n=>n.i!==forest.i); const pick=(cand.length?cand:[nbs[0]]).sort((a,b)=>pref(a)-pref(b))[0]; state.map[pick.i].type=T.GRASS}}

// ===== Rendering =====
const varA='#7bdff6';
const label=c=>!c||c.type===T.WATER?'':(c.disc?(LABEL[c.type]||(c.type.slice(0,2).toUpperCase())):'?');
function tile(x,y,c){
  const ts=state.size.t,px=x*ts,py=y*ts; if(!c){ctx.fillStyle='#0b0f22';ctx.fillRect(px,py,ts,ts);return}
  const t=rt(c); if(t===T.WATER){let coast=false; for(const d of DIRS){const nx=x+d[0],ny=y+d[1]; if(inBounds(nx,ny)){const n=rt(state.map[idx(nx,ny)])||T.WATER; if(n!==T.WATER){coast=true;break}}} ctx.fillStyle=coast?C.coast:C[T.WATER]} else ctx.fillStyle=C[t]||'#333';
  ctx.fillRect(px,py,ts,ts);
  if(!c.disc){ctx.fillStyle=C.fog;ctx.globalAlpha=.75;ctx.fillRect(px,py,ts,ts);ctx.globalAlpha=1}
  if(state.sel===idx(x,y)){ctx.strokeStyle=varA;ctx.lineWidth=2;ctx.strokeRect(px+1,py+1,ts-2,ts-2)}
  let tl=''; if(c.disc){const tt=c.upg?rt(c):c.type; tl=LABEL[tt]||(String(tt).slice(0,2).toUpperCase())}
  if(tl){ctx.save();ctx.globalAlpha=.25;ctx.font=`bold ${Math.max(9,Math.floor(ts*.6))}px ui-monospace,Menlo`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(tl,px+ts/2,py+ts/2+.5);ctx.restore()}
  if(c.type===T.FARM && (c.fx|0)===2 && c.disc){ctx.save();ctx.font=`bold ${Math.max(8,Math.floor(ts*.5))}px ui-monospace,Menlo`;ctx.textAlign='right';ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.globalAlpha=.9;ctx.fillText('+',px+ts-3,py+2);ctx.restore();}
  if(c.upg&&c.upg.total>1){ctx.save();ctx.fillStyle='#000';ctx.globalAlpha=.45;ctx.fillRect(px+2,py+ts-10,24,8);ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.font='bold 9px ui-monospace,Menlo'; const step=c.upg.prog||0; ctx.fillText(`${step}/${c.upg.total}`,px+14,py+ts-6);ctx.restore()}
}
// Renderer manager: allows swapping renderers (debug canvas vs. future three.js)
const Renderer = (()=>{
  let current='debug';
  const impls={
    debug:{
      init(){ canvas.style.display='block'; },
      draw(){ ctx.clearRect(0,0,canvas.width,canvas.height); each((x,y,c)=>tile(x,y,c)); },
      resize(){ resize(); },
      destroy(){ /* no-op for canvas */ }
    },
    three:{
      _inited:false,_loading:false,_wrap:null,_renderer:null,_scene:null,_camera:null,_tiles:null,_THREE:null,_angle:0,_radius:8,_height:6,_raf:null,
      async _load(){ if(this._THREE||this._loading) return; this._loading=true; try{ this._THREE = await import('https://unpkg.com/three@0.158.0/build/three.module.js'); } finally { this._loading=false; } },
      async init(){
        await this._load(); const THREE=this._THREE; if(!THREE) return; this._inited=true;
        const stage=document.getElementById('stageWrap');
        // Container below the 2D canvas
        const wrap=document.createElement('div'); wrap.id='threeWrap'; Object.assign(wrap.style,{position:'absolute',inset:'8px',zIndex:0}); stage.appendChild(wrap); this._wrap=wrap;
        // Make 2D canvas transparent and keep it on top for clicks/UI
        canvas.style.background='transparent'; canvas.style.zIndex=1; canvas.style.position='relative';
        // Renderer
        const rend=new THREE.WebGLRenderer({antialias:false,alpha:true}); rend.setPixelRatio(1); rend.domElement.style.imageRendering='pixelated'; wrap.appendChild(rend.domElement); this._renderer=rend;
        // Scene + camera
        const scene=new THREE.Scene(); scene.background=null; this._scene=scene;
        const cam=new THREE.PerspectiveCamera(45,1,0.1,1000); this._camera=cam;
        // Lights
        scene.add(new THREE.AmbientLight(0xffffff,0.9)); const dir=new THREE.DirectionalLight(0xffffff,0.6); dir.position.set(3,5,2); scene.add(dir);
        // Tile group
        this._tiles=new THREE.Group(); scene.add(this._tiles);
        // Controls (simple Y orbit)
        let dragging=false,lastX=0; const onDown=e=>{dragging=true; lastX=e.clientX}; const onMove=e=>{ if(!dragging) return; const dx=e.clientX-lastX; lastX=e.clientX; this._angle+=(dx*0.01); this._renderOnce(); }; const onUp=()=>{dragging=false};
        rend.domElement.addEventListener('mousedown',onDown); window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
        this._controls={onDown,onMove,onUp};
        this.resize();
        this._syncAllTiles();
        this._renderOnce();
      },
      _tileTextureFor(x,y,c){ const THREE=this._THREE; const ts=state.size.t|0; const size=Math.max(24,ts); const cnv=document.createElement('canvas'); cnv.width=size; cnv.height=size; const g=cnv.getContext('2d');
        // Base color per tile type, with simple coast detection like debug
        let t=rt(c)||T.WATER; let fill=C[t]||'#333'; if(t===T.WATER){ let coast=false; for(const d of DIRS){ const nx=x+d[0],ny=y+d[1]; if(inBounds(nx,ny)){ const n=rt(state.map[idx(nx,ny)])||T.WATER; if(n!==T.WATER){ coast=true; break; } } } fill=coast?C.coast:C[T.WATER]; }
        g.fillStyle=fill; g.fillRect(0,0,size,size);
        // Fog for undiscovered
        if(!c.disc){ g.fillStyle=C.fog; g.globalAlpha=0.75; g.fillRect(0,0,size,size); g.globalAlpha=1; }
        // Label like debug
        const tl=(c.disc?(LABEL[c.upg?rt(c):c.type]||(String(c.upg?rt(c):c.type).slice(0,2).toUpperCase())):'?');
        if(tl){ g.save(); g.globalAlpha=0.85; g.fillStyle='#ffffff'; g.textAlign='center'; g.textBaseline='middle'; g.font=`bold ${Math.max(9,Math.floor(size*0.55))}px ui-monospace,Menlo`; g.fillText(tl,size/2,size/2+0.5); g.restore(); }
        // Synergy + marker
        if(c.type===T.FARM && (c.fx|0)===2 && c.disc){ g.save(); g.globalAlpha=0.95; g.fillStyle='#fff'; g.textAlign='right'; g.textBaseline='top'; g.font=`bold ${Math.max(8,Math.floor(size*0.45))}px ui-monospace,Menlo`; g.fillText('+',size-3,2); g.restore(); }
        const tex=new THREE.CanvasTexture(cnv); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter; return tex; },
      _buildTileMesh(x,y,c){ const THREE=this._THREE; const tex=this._tileTextureFor(x,y,c); const geo=new THREE.BoxGeometry(1,0.2,1); const mat=new THREE.MeshLambertMaterial({map:tex,flatShading:true}); const mesh=new THREE.Mesh(geo,mat);
        mesh.position.set(x+0.5,0,y+0.5); return mesh; },
      _syncAllTiles(){ if(!this._inited) return; const THREE=this._THREE; const g=this._tiles; while(g.children.length){ const m=g.children.pop(); if(m.material&&m.material.map) m.material.map.dispose(); if(m.material) m.material.dispose(); if(m.geometry) m.geometry.dispose(); }
        for(let y=0;y<state.size.h;y++) for(let x=0;x<state.size.w;x++){ const c=state.map[idx(x,y)]; if(!c) continue; const m=this._buildTileMesh(x,y,c); g.add(m); }
        // Center camera radius based on map size
        const w=state.size.w, h=state.size.h; const maxDim=Math.max(w,h); this._radius=maxDim*0.9; this._height=Math.max(4, maxDim*0.6); this._angle=0.6;
        this._updateCamera();
      },
      _updateCamera(){ const cam=this._camera; if(!cam) return; const w=state.size.w, h=state.size.h; const cx=w/2, cz=h/2; const y=this._height; const r=this._radius; const ax=this._angle; const px=cx+Math.cos(ax)*r; const pz=cz+Math.sin(ax)*r; cam.position.set(px,y,pz); cam.lookAt(cx,0,cz); },
      _renderOnce(){ if(!this._inited) return; this._updateCamera(); this._renderer.render(this._scene,this._camera); },
      draw(){ if(!this._inited){ /* if not ready, try to init */ return; } this._syncAllTiles(); this._renderOnce(); },
      resize(){ if(!this._inited||!this._renderer||!this._camera) return; const w=canvas.clientWidth||canvas.width; const h=canvas.clientHeight||canvas.height; this._renderer.setSize(w,h,false); this._camera.aspect=w/h; this._camera.updateProjectionMatrix(); this._renderOnce(); },
      destroy(){ if(this._renderer){
          // remove mouse listeners
          if(this._controls){ this._renderer.domElement.removeEventListener('mousedown',this._controls.onDown); window.removeEventListener('mousemove',this._controls.onMove); window.removeEventListener('mouseup',this._controls.onUp); this._controls=null; }
          // dispose GL resources and remove canvas
          this._renderer.dispose(); const el=this._renderer.domElement; if(el&&el.parentNode){ el.parentNode.removeChild(el); }
        }
        this._renderer=null;
        if(this._wrap&&this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap); this._wrap=null;
        if(this._tiles){ this._tiles.children.forEach(m=>{ if(m.material&&m.material.map) m.material.map.dispose(); if(m.material) m.material.dispose(); if(m.geometry) m.geometry.dispose(); }); }
        this._scene=null; this._camera=null; this._tiles=null; this._inited=false; canvas.style.background=''; }
    }
  };
  function set(name){ if(!impls[name]) return; if(current&&impls[current]&&impls[current].destroy) impls[current].destroy(); current=name; impls[current].init(); }
  function get(){ return current }
  function draw(){ impls[current].draw() }
  function onResize(){ impls[current].resize() }
  return {set,get,draw,onResize};
})();

function draw(){ Renderer.draw() }

// ===== Input =====
const canvasClick=(e)=>{
  const r=canvas.getBoundingClientRect();
  const x=Math.floor((e.clientX-r.left)/state.size.t),y=Math.floor((e.clientY-r.top)/state.size.t);
  if(!inBounds(x,y))return; state.sel=idx(x,y); draw(); openPanel(x,y);
};
canvas.addEventListener('click',canvasClick);

// ===== Rules / UI =====
const afford=c=>(!('G' in c)||state.gold>=c.G)&&(!('W' in c)||state.wood>=c.W)&&(!('P' in c)||state.people>=c.P)&&(!('F' in c)||state.food>=c.F);
const pay=c=>{if(c.G)state.gold-=c.G;if(c.W)state.wood-=c.W;if(c.F)state.food-=c.F};
const whyNo=(spec,cell)=>{const r=[]; if(cell.upg)r.push('already upgrading'); if(state.actions<=0)r.push('no actions left'); const cc=spec.cost||{}; if(cc.G&&state.gold<cc.G)r.push('need G:'+cc.G); if(cc.W&&state.wood<cc.W)r.push('need W:'+cc.W); if(cc.F&&state.food<cc.F)r.push('need F:'+cc.F); if(cc.P&&state.people<cc.P)r.push('need P:'+cc.P); return r.join(', ')};
const fmtCost=c=>Object.entries(c||{}).filter(p=>p[0]!=='Y').map(p=>p[0]+':'+p[1]).join(' ');
const fmtYield=y=>!y?'':Object.entries(y).map(p=>p[0]+':+'+p[1]+'/t').join(' ');
const upgradeName=(from,to)=>from===T.BURNT?'CLEAR':from===T.RUBBLE?'REBUILD':String(to).toUpperCase();
function tileInfo(c){const y=BASE[c.type]; const needs=(c.type===T.FARM&&(!(c.wrk>0))); return {'yield': needs?'— (needs worker)':(y?fmtYield(y):'—'), status: c.upg?('Upgrading → '+upgradeName(c.type,c.upg.to)+' • '+c.upg.left+'t left'):'—'} }

const isAdj=(x,y)=>{for(const d of DIRS){const nx=x+d[0],ny=y+d[1]; if(!inBounds(nx,ny))continue; const nc=state.map[idx(nx,ny)]; if(nc&&nc.disc) return true} return false};
const canExplore=(x,y)=>{const c=state.map[idx(x,y)]; return !!c && !c.disc && isAdj(x,y) && state.actions>0 && state.people>0 && state.food>=EXPLORE.FOOD};
const whyNoExplore=(x,y)=>{const r=[],c=state.map[idx(x,y)]; if(!c)r.push('invalid'); else if(c.disc)r.push('already visible'); if(!isAdj(x,y))r.push('adjacent required'); if(state.actions<=0)r.push('no actions'); if(state.people<=0)r.push('no people'); if(state.food<EXPLORE.FOOD)r.push('need F:1'); return r.join(', ')};
function explore(x,y){ if(!canExplore(x,y))return; state.actions--; state.food=Math.max(0,state.food-EXPLORE.FOOD); const risk=state.year<=5?0.15:EXPLORE.RISK; if(state.riskRng()<risk&&state.people>0)state.people--; reveal(x,y,1); hud(); draw(); }

const hasAdjType=(x,y,t)=>{for(const d of DIRS){const nx=x+d[0],ny=y+d[1]; if(!inBounds(nx,ny))continue; const nc=state.map[idx(nx,ny)]; if(nc&&rt(nc)===t) return true} return false};
function isCoast(x,y){ if(!inBounds(x,y))return false; const c=state.map[idx(x,y)]; if(!c||rt(c)!==T.WATER)return false; return DIRS.some(d=>{const nx=x+d[0],ny=y+d[1]; return inBounds(nx,ny)&&rt(state.map[idx(nx,ny)])!==T.WATER}) }
const countType=t=>{let n=0; each((x,y,c)=>{if(c&&rt(c)===t)n++}); return n};
const uniqueAvailable=to=>(!((to===T.PALACE)&&countType(T.PALACE)>=1)) && (!((to===T.CASTLE)&&countType(T.CASTLE)>=1));
function bufferOK(x,y,from,to){ if(!houseNearby(x,y))return true; if(to===T.FARM) return true; if(from===T.FOREST&&to===T.GRASS) return true; return false }

function applyAdjacencyBonuses(d){
  each((x,y,c)=>{ 
    if([T.HOUSE,T.MANSION,T.PALACE,T.CASTLE].includes(c.type)&&hasAdjType(x,y,T.FARM)) d.G+=1;
    if(c.type===T.DOCK){ if(hasAdjType(x,y,T.FARM)) d.F+=1; if([T.HOUSE,T.MANSION,T.PALACE,T.CASTLE].some(t=>hasAdjType(x,y,t))) d.G+=1; }
  });
}

// ===== Workforce (Farms) & Synergy =====
const farmWorkers=()=>{let n=0; each((x,y,c)=>{if(c.type===T.FARM)n+=(c.wrk|0)}); return n};
function setFarmWorkers(x,y,delta){
  const i=idx(x,y),c=state.map[i]; if(!c||c.type!==T.FARM)return; const cur=c.wrk|0;
  if(delta>0){ if(state.actions<=0||cur>=1)return; c.wrk=cur+1; state.actions=Math.max(0,state.actions-1); }
  else { if(cur<=0)return; c.wrk=cur-1; state.actions=Math.min(state.people-farmWorkers(),state.actions+1); }
  hud(); draw(); openPanel(x,y);
}
const farmHasStaffedNeighbor=(x,y)=>{const c=state.map[idx(x,y)]; if(!c||c.type!==T.FARM||(c.wrk|0)<=0) return false; for(const d of DIRS){const nx=x+d[0],ny=y+d[1]; if(!inBounds(nx,ny))continue; const n=state.map[idx(nx,ny)]; if(n&&n.type===T.FARM&&(n.wrk|0)>0) return true} return false};
function updateFarmSynergy(d){
  // First pass: compute which farms have a 4-way staffed neighbor
  const hasArr=new Array(state.size.w*state.size.h).fill(false);
  each((x,y,c)=>{
    if(c.type!==T.FARM || (c.wrk|0)<=0) return;
    for(const dxy of DIRS){
      const nx=x+dxy[0], ny=y+dxy[1];
      if(!inBounds(nx,ny)) continue;
      const n=state.map[idx(nx,ny)];
      if(n && n.type===T.FARM && (n.wrk|0)>0){ hasArr[idx(x,y)]=true; break; }
    }
  });
  // Second pass: update fx state
  each((x,y,c)=>{
    if(c.type!==T.FARM){ if(c.fx) c.fx=0; return }
    const prev=c.fx|0, has=hasArr[idx(x,y)];
    if(has){ c.fx = prev===0?1:prev===1?2:2; if(c.fx===2 && prev!==2){ if(d) d.events.push(`Farm synergy active at (${x},${y})`) } }
    else { c.fx = 0; }
  });
}

function openPanel(x,y){
  const c=state.map[idx(x,y)], P=$('panel'); if(!c){P.innerHTML='';return}
  if(!c.disc){
    const can=canExplore(x,y),why=can?'':whyNoExplore(x,y),dis=can?'':`disabled title="${esc(why)}"`;
    P.innerHTML=`<div class="card">
      <div class="title">Unknown @ (${x},${y})</div>
      <div class="section">Explore: adjacent (4-dir) only • uses 1A + 1F • ${Math.round(EXPLORE.RISK*100)}% risk −1P</div>
      <button class="btn primary" ${dis} id="e">Explore</button>
    </div>`;
    const b=$('e'); if(b) b.onclick=()=>{explore(x,y);openPanel(x,y)}; return;
  }
  const info=tileInfo(c),opts=SPEC[c.type]||[];
  const farmCtrl=(c.type===T.FARM?`
    <div class="section">
      <div><b>Workers</b> ${(c.wrk|0)}/1 <span class="hint">(ties up 1 Action)</span></div>
      <div style="display:flex;gap:6px">
        <button class="btn" id="wMinus" ${((c.wrk|0)<=0)?'disabled':''}>− Remove</button>
        <button class="btn" id="wPlus" ${(state.actions<=0||(c.wrk|0)>=1)?'disabled':''}>+ Assign</button>
      </div>
    </div>`:'');
  const rows = opts.length?opts.map((o,i)=>{
    const baseOK=afford(o.cost)&&state.actions>0&&!c.upg, bufOK=bufferOK(x,y,c.type,o.to), siteOK=(!o.pre||o.pre(x,y))&&uniqueAvailable(o.to)&&bufOK, can=baseOK&&siteOK;
    const whyParts=[]; if(!baseOK)whyParts.push(whyNo(o,c)); if(baseOK&&!siteOK){ if(!bufOK)whyParts.push('residence buffer (farm-only)'); if(o.pre&&!o.pre(x,y))whyParts.push(o.req||'site requirement not met'); if(!uniqueAvailable(o.to))whyParts.push('unique limit reached') }
    const why=can?'':whyParts.filter(Boolean).join('; '), yd=[fmtYield(o.perTurn),fmtYield(o.instant)].filter(Boolean).join(' • '), dis=can?'':`disabled title="${esc(why)}"`;
    return `<div class="section">
      <div><b>Upgrade → ${upgradeName(c.type,o.to)}</b> <span class="hint">${o.duration}t</span></div>
      <div>Cost: ${fmtCost(o.cost)}${yd?(' • '+yd):''}</div>
      <button class="btn primary" ${dis} data-u="${i}">Start (−1A)</button>
    </div>`;
  }).join(''):'<div class="hint">No upgrades available.</div>';

  P.innerHTML=`<div class="card">
    <div class="title">${c.type.toUpperCase()} @ (${x},${y})</div>
    <div class="section"><div><b>Yield</b> ${info['yield']}</div><div><b>Status</b> ${info.status}</div></div>
    ${farmCtrl}${rows}
  </div>`;

  P.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{startUpgrade(x,y,c,SPEC[c.type][+b.dataset.u]);openPanel(x,y)});
  if(c.type===T.FARM){const add=P.querySelector('#wPlus'),rem=P.querySelector('#wMinus'); if(add)add.onclick=()=>setFarmWorkers(x,y,+1); if(rem)rem.onclick=()=>setFarmWorkers(x,y,-1)}
}

function startUpgrade(x,y,c,s){
  if(!s||c.upg||!afford(s.cost)||state.actions<=0||!uniqueAvailable(s.to)||(s.pre&&!s.pre(x,y))||!bufferOK(x,y,c.type,s.to))return;
  pay(s.cost); state.actions--;
  const total=s.duration||1; c.upg={to:s.to,left:total,spec:s,total,prog:0};
  if(total>1){c.upg.left--; c.upg.prog=1}
  reveal(x,y,1); hud(); draw();
}

// ===== Turn / Events =====
$('end').onclick=()=>endTurn();
function endTurn(){
  const d={G:0,F:0,W:0,P:0,events:[]};
  // 1) Base production & farms (use current tile types before upgrades complete)
  each((x,y,c)=>{ if(c.type===T.FARM){ if((c.wrk|0)>0) d.F+=2+(((c.fx|0)===2)?1:0) } else {const yld=BASE[c.type]; if(yld) for(const k in yld) d[k]+=yld[k]} });
  applyAdjacencyBonuses(d);
  // 2) Build progress (complete upgrades, aggregate instant into d; delay applying P to population until after feeding)
  each((x,y,c)=>{
    if(c&&c.upg){
      if(--c.upg.left<=0){
        const to=c.upg.to; const spec=c.upg.spec; c.type=to;
        if(spec&&spec.instant){
          for(const k in spec.instant){
            const v=spec.instant[k];
            if(k==='P'){ d.P+=v; } else { d[k]=(d[k]|0)+v; }
          }
        }
        c.upg=null; reveal(x,y,1);
        d.events.push(`Completed ${String(to).toUpperCase()} at (${x},${y})`);
      } else if(c.upg.total>1){
        c.upg.prog=(c.upg.total-c.upg.left);
      }
    }
  });
  // 3) Apply resource deltas to state (G/F/W only)
  state.gold+=d.G; state.food+=d.F; state.wood+=d.W;
  // 4) Feeding
  const need=state.people;
  const fed=Math.min(state.food, need);
  state.food -= fed;
  if (fed === need) d.events.push(`All ${need} people fed (−${need} F).`);
  else {
    const deficit = need - fed;
    d.events.push(`Shortage: needed ${need} F, had ${fed} F (${deficit} unfed).`);
    if (state.people > 0) { state.people--; d.P--; d.events.push('Starvation: −1 Person due to shortage.'); }
    state.food = 0;
  }
  // 5) Growth (10F -> +1P)
  const growth = Math.floor(state.food / 10);
  if (growth > 0) { state.people += growth; d.P += growth; state.food -= growth * 10; d.events.push(`Population growth: +${growth} (used ${growth*10} F).`); }
  else d.events.push(`Food stored: ${state.food}/10 toward next person.`);
  // 6) Apply population gains from upgrades at end of turn
  if (d.P>0){ state.people += d.P; }
  // Year/action, events, synergy
  state.year++;  state.actions=Math.max(0,state.people-farmWorkers());
  if(!state.noEvents) randomEvent(d);
  state.actions=Math.max(0,state.people-farmWorkers());
  updateFarmSynergy(d);
  hud(); draw(); summary(d); winLose();
  console.log('Debug: Food before calculation:', state.food);
  console.log('Debug: Workers on farms:', farmWorkers());
  console.log('Debug: Food added this turn:', d.F);
  return d;
}
function randomEvent(d){
  const EV=[{n:'Fire',w:25},{n:'Pirates',w:20},{n:'Plague',w:15},{n:'Storm',w:25},{n:'Treasure',w:8}];
  const tot=EV.reduce((s,e)=>s+e.w,0); let r=((state.rng?state.rng():Math.random())*tot), pick=EV[0].n;
  for(const e of EV){ r-=e.w; if(r<0){ pick=e.n; break; } }
  if(pick==='Fire'){
    const v=[]; each((x,y,c)=>{if(c&&c.disc&&(c.type===T.FOREST||c.type===T.FARM)) v.push({x,y,type:c.type})});
    if(v.length){
      const t=v[Math.floor((state.rng?state.rng():Math.random())*v.length)];
      const ci=state.map[idx(t.x,t.y)];
      let deathNote='';
      if(ci.type===T.FARM){
        if((ci.wrk|0)>0 && state.people>0){ state.people--; d.P--; deathNote=' — worker died (−1P)'; }
        ci.wrk=0; ci.fx=0;
      }
      ci.type=T.BURNT;
      d.events.push('Fire destroyed a '+t.type.toUpperCase()+' at ('+t.x+','+t.y+') → BURNT'+deathNote);
    }
  } else if(pick==='Pirates'){
    if(state.gold>0){state.gold--; d.G--; d.events.push('Pirates stole 1 gold')}
  } else if(pick==='Plague'){
    if(state.people>1){state.people--; d.P--; d.events.push('Plague took 1 person')}
  } else if(pick==='Storm'){
    const v=[]; each((x,y,c)=>{if(c&&c.disc&&[T.HOUSE,T.MANSION,T.PALACE,T.CASTLE,T.MINE,T.FARM].includes(c.type)) v.push({x,y,type:c.type})});
    if(v.length){
      const t=v[Math.floor((state.rng?state.rng():Math.random())*v.length)];
      const ci=state.map[idx(t.x,t.y)];
      let notes=[];
      if(HOUSELINE.includes(ci.type) && state.people>0){ state.people--; d.P--; notes.push('resident died −1P'); }
      if(ci.type===T.FARM && (ci.wrk|0)>0){ if(state.people>0){ state.people--; d.P--; } ci.wrk=0; ci.fx=0; notes.push('worker died −1P'); }
      ci.type=T.RUBBLE;
      d.events.push('Storm reduced '+t.type.toUpperCase()+' at ('+t.x+','+t.y+') → RUBBLE'+(notes.length?' — '+notes.join('; '):''));
    }
  } else { state.gold++; d.G++; d.events.push('Found hidden treasure (+1 gold)') }
}

// ===== Overlays / HUD / Save =====
function summary(d){
  const deltas=`Δ G:${d.G} F:${d.F} W:${d.W} P:${d.P}`;
  const evHtml=(d.events && d.events.length)?`<div class="section">${d.events.filter(Boolean).map(s=>`<div>• ${esc(s)}</div>`).join('')}</div>`:'<div class="section hint">No notable events.</div>';
  ov(`
    <div class="title">End of Year ${state.year-1}</div>
    <div class="section">${deltas}</div>
    ${evHtml}
    <button class="btn primary" id="ok">Continue</button>
  `,(box,wrap)=>{box.querySelector('#ok').onclick=()=>wrap.remove()});
}
function winLose(){let win=false; each((x,y,c)=>{if(c&&c.type===T.CASTLE)win=true}); if(state.people<=0) gameOver(false,'Your people are gone.'); else if(win) gameOver(true,'You raised a CASTLE!'); }
function gameOver(win,msg){ ov(`<div class="title">${win?'Victory':'Game Over'}</div><div class="section">${esc(msg)}</div><div class="section">Years:${state.year} • People:${state.people} • Gold:${state.gold}</div><button class="btn primary" id="again">New Run</button>`,(box,wrap)=>{box.querySelector('#again').onclick=()=>{wrap.remove(); showStart();}}) }
function hud(){ $('y').textContent=state.year; $('g').textContent=state.gold; $('f').textContent=state.food; $('w').textContent=state.wood; $('p').textContent=state.people; $('a').textContent=state.actions; }
const save=()=>localStorage.setItem('kbts-save',JSON.stringify(state));
const load=()=>{const raw=localStorage.getItem('kbts-save'); if(!raw)return; Object.assign(state,JSON.parse(raw)); state.rng=rng32(state.seed); resize(); hud(); draw(); $('seedOut').textContent=state.seed; $('mapOut').textContent=`${state.size.w}×${state.size.h}`};
$('save').onclick=save; $('load').onclick=load; $('reset').onclick=()=>{localStorage.removeItem('kbts-save'); clearOverlays(); showStart()};
function clearOverlays(){document.querySelectorAll('.overlay').forEach(el=>el.remove()); $('panel').innerHTML=''}
function showStart(){ clearOverlays(); ov(`
  <div class="title">New Game</div>
  <div class="section"><label>Map Size
    <select id="sz">
      <option value="small">Small (8×6)</option>
      <option value="medium" selected>Medium (10×8)</option>
      <option value="large">Large (12×8)</option>
    </select>
  </label></div>
  <div class="section"><label>Seed (optional)
    <input id="sd" type="number" placeholder="random" style="width:100%" />
  </label></div>
  <div style="display:flex;gap:8px;justify-content:flex-end">
    <button class="btn" id="cancelNew">Cancel</button>
    <button class="btn primary" id="startNew">Start</button>
  </div>`,(box,wrap)=>{
    box.querySelector('#cancelNew').onclick=()=>wrap.remove();
    box.querySelector('#startNew').onclick=()=>{const size=box.querySelector('#sz').value; const sd=parseInt(box.querySelector('#sd').value,10); generate(Number.isFinite(sd)?sd:Date.now(),size); wrap.remove();};
  }); }

// Boot
function start(size){generate(undefined,size)}
$('end').disabled=false;
showStart();

// Expose API for tests
window.KBTS={
  $, rng32, state, T, SPEC, BASE, DIRS, idx, inBounds, each, cell,
  generate, reveal, ensureStartResources, label, draw, resize, hud,
  canExplore, explore, isCoast, startUpgrade, applyAdjacencyBonuses,
  uniqueAvailable, noHouseNearby, houseNearby, setFarmWorkers, farmWorkers,
  updateFarmSynergy, endTurn, randomEvent, summary, countType, afford, whyNo,
  showStart, start, tileInfo,
  setRenderer: Renderer.set,
  getRenderer: Renderer.get
};
