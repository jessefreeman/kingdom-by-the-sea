// Global renderer manager for KBTS: provides 'debug' (2D canvas) and 'three' (3D) renderers.
// It defers reading state/constants from window.KBTS at call time to avoid load-order issues.
(function(){
  function getCanvas(){ return document.getElementById('gameCanvas'); }
  function getCtx(){ const c=getCanvas(); return c?c.getContext('2d'):null; }
  function rt(c){ return c?(c.upg?c.upg.to:c.type):null }
  const KBTS_Renderer={
    _current:'debug',
    _impls:{},
    set(name){ if(!KBTS_Renderer._impls[name]) return; KBTS_Renderer._impls[KBTS_Renderer._current]?.destroy?.(); KBTS_Renderer._current=name; KBTS_Renderer._impls[name].init(); },
    get(){ return KBTS_Renderer._current },
    draw(){ KBTS_Renderer._impls[KBTS_Renderer._current]?.draw?.() },
    onResize(){ KBTS_Renderer._impls[KBTS_Renderer._current]?.resize?.() }
  };

  // Debug (canvas) implementation
  KBTS_Renderer._impls.debug={
    init(){ const c=getCanvas(); if(c){ c.style.display='block'; c.style.background=''; c.style.position='relative'; c.style.zIndex=''; } },
    _tile(x,y,c){
      const KB=window.KBTS; const ctx=getCtx();
      if(!ctx||!KB||!KB.state||!KB.T||!KB.C||!KB.LABEL||!KB.DIRS||!KB.idx||!KB.inBounds) return;
      const {T,C,LABEL,DIRS,idx,inBounds,state}=KB;
      const ts=state.size.t,px=x*ts,py=y*ts; if(!c){ctx.fillStyle='#0b0f22';ctx.fillRect(px,py,ts,ts);return}
      const t=rt(c); if(t===T.WATER){let coast=false; for(const d of DIRS){const nx=x+d[0],ny=y+d[1]; if(inBounds(nx,ny)){const n=rt(state.map[idx(nx,ny)])||T.WATER; if(n!==T.WATER){coast=true;break}}} ctx.fillStyle=coast?C.coast:C[T.WATER]} else ctx.fillStyle=C[t]||'#333';
      ctx.fillRect(px,py,ts,ts);
      if(!c.disc){ctx.fillStyle=C.fog;ctx.globalAlpha=.75;ctx.fillRect(px,py,ts,ts);ctx.globalAlpha=1}
      if(state.sel===idx(x,y)){ctx.strokeStyle='#7bdff6';ctx.lineWidth=2;ctx.strokeRect(px+1,py+1,ts-2,ts-2)}
      let tl=''; if(c.disc){const tt=c.upg?rt(c):c.type; tl=LABEL[tt]||(String(tt).slice(0,2).toUpperCase())}
  if(tl){ctx.save();ctx.globalAlpha=.25;ctx.font=`bold ${Math.max(9,Math.floor(ts*.6))}px ui-monospace,Menlo`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(tl,px+ts/2,py+ts/2+.5);ctx.restore()}
  if(c.type===T.FARM && (c.fx|0)===2 && c.disc){ctx.save();ctx.font=`bold ${Math.max(8,Math.floor(ts*.5))}px ui-monospace,Menlo`;ctx.textAlign='right';ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.globalAlpha=.9;ctx.fillText('+',px+ts-3,py+2);ctx.restore();}
      if(c.upg&&c.upg.total>1){ctx.save();ctx.fillStyle='#000';ctx.globalAlpha=.45;ctx.fillRect(px+2,py+ts-10,24,8);ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.font='bold 9px ui-monospace,Menlo'; const step=c.upg.prog||0; ctx.fillText(`${step}/${c.upg.total}`,px+14,py+ts-6);ctx.restore()}
    },
  draw(){ const ctx=getCtx(), c=getCanvas(); if(!ctx||!c||!window.KBTS) return; ctx.clearRect(0,0,c.width,c.height); const {each}=window.KBTS; if(typeof each!=='function') return; each((x,y,cell)=>KBTS_Renderer._impls.debug._tile(x,y,cell)); },
    resize(){ if(!window.KBTS) return; const {state}=window.KBTS; const c=getCanvas(); if(!c) return; c.width=state.size.w*state.size.t; c.height=state.size.h*state.size.t; },
    destroy(){ /* no-op */ }
  };

  // Three.js implementation with flat per-tile textures
  KBTS_Renderer._impls.three={
    _inited:false,_loading:false,_wrap:null,_renderer:null,_scene:null,_camera:null,_tiles:null,_THREE:null,_angle:0,_radius:8,_height:6,_controls:null,
    async _load(){ if(this._THREE||this._loading) return; this._loading=true; try{ this._THREE = await import('https://unpkg.com/three@0.158.0/build/three.module.js'); } finally { this._loading=false; } },
    async init(){ await this._load(); const THREE=this._THREE; if(!THREE){ return; } this._inited=true; const stage=document.getElementById('stageWrap'); const wrap=document.createElement('div'); wrap.id='threeWrap'; Object.assign(wrap.style,{position:'absolute',inset:'8px',zIndex:0}); stage.appendChild(wrap); this._wrap=wrap;
      const canvas=getCanvas(); if(canvas){ canvas.style.background='transparent'; canvas.style.zIndex=1; canvas.style.position='relative'; }
      const rend=new THREE.WebGLRenderer({antialias:false,alpha:true}); rend.setPixelRatio(1); rend.domElement.style.imageRendering='pixelated'; wrap.appendChild(rend.domElement); this._renderer=rend;
      const scene=new THREE.Scene(); scene.background=null; this._scene=scene;
      const cam=new THREE.PerspectiveCamera(45,1,0.1,1000); this._camera=cam;
      scene.add(new THREE.AmbientLight(0xffffff,0.9)); const dir=new THREE.DirectionalLight(0xffffff,0.6); dir.position.set(3,5,2); scene.add(dir);
      this._tiles=new THREE.Group(); scene.add(this._tiles);
      let dragging=false,lastX=0; const onDown=e=>{dragging=true; lastX=e.clientX}; const onMove=e=>{ if(!dragging) return; const dx=e.clientX-lastX; lastX=e.clientX; this._angle+=(dx*0.01); this._renderOnce(); }; const onUp=()=>{dragging=false};
      rend.domElement.addEventListener('mousedown',onDown); window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp); this._controls={onDown,onMove,onUp};
      this.resize(); this._syncAllTiles(); this._renderOnce();
    },
  _tileTextureFor(x,y,c){ const THREE=this._THREE; const KB=window.KBTS; if(!KB||!KB.state||!KB.T||!KB.C||!KB.LABEL||!KB.DIRS||!KB.idx||!KB.inBounds) return null; const {T,C,LABEL,DIRS,idx,inBounds,state}=KB; const ts=state.size.t|0; const size=Math.max(24,ts); const cnv=document.createElement('canvas'); cnv.width=size; cnv.height=size; const g=cnv.getContext('2d');
      let t=rt(c)||T.WATER; let fill=C[t]||'#333'; if(t===T.WATER){ let coast=false; for(const d of DIRS){ const nx=x+d[0],ny=y+d[1]; if(inBounds(nx,ny)){ const n=rt(state.map[idx(nx,ny)])||T.WATER; if(n!==T.WATER){ coast=true; break; } } } fill=coast?C.coast:C[T.WATER]; }
      g.fillStyle=fill; g.fillRect(0,0,size,size);
      if(!c.disc){ g.fillStyle=C.fog; g.globalAlpha=0.75; g.fillRect(0,0,size,size); g.globalAlpha=1; }
      const tl=(c.disc?(LABEL[c.upg?rt(c):c.type]||(String(c.upg?rt(c):c.type).slice(0,2).toUpperCase())):'?');
      if(tl){ g.save(); g.globalAlpha=0.85; g.fillStyle='#ffffff'; g.textAlign='center'; g.textBaseline='middle'; g.font=`bold ${Math.max(9,Math.floor(size*0.55))}px ui-monospace,Menlo`; g.fillText(tl,size/2,size/2+0.5); g.restore(); }
      if(c.type===T.FARM && (c.fx|0)===2 && c.disc){ g.save(); g.globalAlpha=0.95; g.fillStyle='#fff'; g.textAlign='right'; g.textBaseline='top'; g.font=`bold ${Math.max(8,Math.floor(size*0.45))}px ui-monospace,Menlo`; g.fillText('+',size-3,2); g.restore(); }
      const tex=new THREE.CanvasTexture(cnv); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter; return tex; },
    _buildTileMesh(x,y,c){ const THREE=this._THREE; const tex=this._tileTextureFor(x,y,c); const geo=new THREE.BoxGeometry(1,0.2,1); const mat=new THREE.MeshLambertMaterial({map:tex,flatShading:true}); const mesh=new THREE.Mesh(geo,mat); mesh.position.set(x+0.5,0,y+0.5); return mesh; },
    _syncAllTiles(){ if(!this._inited||!window.KBTS) return; const g=this._tiles; while(g.children.length){ const m=g.children.pop(); if(m.material&&m.material.map) m.material.map.dispose(); if(m.material) m.material.dispose(); if(m.geometry) m.geometry.dispose(); }
      const {state,idx}=window.KBTS; for(let y=0;y<state.size.h;y++) for(let x=0;x<state.size.w;x++){ const c=state.map[idx(x,y)]; if(!c) continue; const m=this._buildTileMesh(x,y,c); g.add(m); }
      const w=state.size.w, h=state.size.h; const maxDim=Math.max(w,h); this._radius=maxDim*0.9; this._height=Math.max(4, maxDim*0.6); this._angle=0.6; this._updateCamera();
    },
    _updateCamera(){ if(!this._camera||!window.KBTS) return; const {state}=window.KBTS; const w=state.size.w, h=state.size.h; const cx=w/2, cz=h/2; const y=this._height; const r=this._radius; const ax=this._angle; const px=cx+Math.cos(ax)*r; const pz=cz+Math.sin(ax)*r; this._camera.position.set(px,y,pz); this._camera.lookAt(cx,0,cz); },
    _renderOnce(){ if(!this._inited) return; this._updateCamera(); this._renderer.render(this._scene,this._camera); },
  draw(){ if(!this._inited){ return; } if(!window.KBTS||!window.KBTS.state){ return; } this._syncAllTiles(); this._renderOnce(); },
    resize(){ if(!this._inited||!this._renderer||!this._camera) return; const c=getCanvas(); const w=(c&&c.clientWidth)|| (c?c.width:0); const h=(c&&c.clientHeight)|| (c?c.height:0); if(w&&h){ this._renderer.setSize(w,h,false); this._camera.aspect=w/h; this._camera.updateProjectionMatrix(); this._renderOnce(); } },
    destroy(){ if(this._renderer){ if(this._controls){ this._renderer.domElement.removeEventListener('mousedown',this._controls.onDown); window.removeEventListener('mousemove',this._controls.onMove); window.removeEventListener('mouseup',this._controls.onUp); this._controls=null; } this._renderer.dispose(); const el=this._renderer.domElement; if(el&&el.parentNode){ el.parentNode.removeChild(el); } }
      this._renderer=null; if(this._wrap&&this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap); this._wrap=null; if(this._tiles){ this._tiles.children.forEach(m=>{ if(m.material&&m.material.map) m.material.map.dispose(); if(m.material) m.material.dispose(); if(m.geometry) m.geometry.dispose(); }); }
      this._scene=null; this._camera=null; this._tiles=null; this._inited=false; const c=getCanvas(); if(c){ c.style.background=''; }
    }
  };

  // Expose
  window.KBTS_Renderer = KBTS_Renderer;
})();
