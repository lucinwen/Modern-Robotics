(function(global){
  'use strict';
  const radians=d=>d*Math.PI/180;
  const TRUE_CAMERA=Object.freeze({yaw:30,t:[.65,-.65,.20]});
  const rotate=(p,d)=>{const a=radians(d),c=Math.cos(a),s=Math.sin(a);return[c*p[0]-s*p[1],s*p[0]+c*p[1],p[2]];};
  const plus=(a,b)=>a.map((v,i)=>v+b[i]);
  const minus=(a,b)=>a.map((v,i)=>v-b[i]);
  const norm2=p=>p.reduce((s,v)=>s+v*v,0);
  const toWorld=(p,yaw,t)=>plus(rotate(p,yaw),t);
  const toCamera=p=>rotate(minus(p,TRUE_CAMERA.t),-TRUE_CAMERA.yaw);
  function cupPoints(){
    const points=[];
    for(let j=0;j<=10;j++)for(let k=0;k<36;k++){const a=2*Math.PI*k/36;points.push([.27*Math.cos(a),.27*Math.sin(a),.065*j]);}
    for(let k=0;k<36;k++){const a=2*Math.PI*k/36;points.push([.22*Math.cos(a),.22*Math.sin(a),.65]);}
    for(let j=0;j<=20;j++){const a=-Math.PI/2+Math.PI*j/20;for(let k=0;k<6;k++){const b=2*Math.PI*k/6;points.push([.25+.25*Math.cos(a)+.035*Math.cos(b)*Math.cos(a),.035*Math.sin(b),.33+.23*Math.sin(a)+.035*Math.cos(b)*Math.sin(a)]);}}
    return points.map(p=>toWorld(p,-15,[0,.55,0]));
  }
  const MODEL=cupPoints();
  function disturbance(i){return[0,1,2].map(k=>.0105*Math.sin((i+1)*12.9898+(k+1)*39.346));}
  function sample(state){
    const pairs=[];
    MODEL.forEach((world,i)=>{
      if(state.occlusion&&world[0]>.04)return;
      const delta=state.noise?disturbance(i):[0,0,0];
      const camera=plus(toCamera(world),delta);
      const estimated=toWorld(camera,state.yaw,[state.tx,TRUE_CAMERA.t[1],TRUE_CAMERA.t[2]]);
      pairs.push({world,camera,estimated,delta,index:i});
    });
    return{pairs,alignment:Math.sqrt(pairs.reduce((s,p)=>s+norm2(minus(p.estimated,p.world)),0)/pairs.length),noise:Math.sqrt(pairs.reduce((s,p)=>s+norm2(p.delta),0)/pairs.length)};
  }
  const api=Object.freeze({TRUE_CAMERA,MODEL,rotate,toWorld,toCamera,sample});
  global.Day1PerceptionMath=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document==='undefined')return;
  const root=document.getElementById('day1-point-cloud');if(!root)return;
  const state={yaw:-20,tx:-.2,noise:true,occlusion:false};
  const NS='http://www.w3.org/2000/svg';
  const scenes=Array.from(root.querySelectorAll('[data-scene]'));
  function element(parent,tag,attrs,text){const n=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!==undefined)n.textContent=text;parent.appendChild(n);return n;}
  function drawScene(svg,kind,data){
    const width=Math.max(280,svg.getBoundingClientRect().width),height=svg.getBoundingClientRect().height||280;
    svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.replaceChildren();
    element(svg,'title',{},kind==='camera'?'合成采样点：相机局部坐标 C':'估计外参变换后的点，与世界参考模型对比');
    const iso=p=>[(p[0]-p[1])*.707,(p[0]+p[1])*.33-p[2]*.95];
    const domain=kind==='camera'?[[-.55,-.10,-.32],[1.05,1.9,.75]]:[[-1.05,-.5,-.12],[1.1,2,1]];
    const corners=[];for(const x of[domain[0][0],domain[1][0]])for(const y of[domain[0][1],domain[1][1]])for(const z of[domain[0][2],domain[1][2]])corners.push(iso([x,y,z]));
    data.pairs.forEach(p=>corners.push(iso(kind==='camera'?p.camera:p.estimated)));
    if(kind==='world')MODEL.forEach(p=>corners.push(iso(p)));
    const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),lo=[Math.min(...xs),Math.min(...ys)],hi=[Math.max(...xs),Math.max(...ys)];
    const scale=Math.min((width-48)/(hi[0]-lo[0]),(height-48)/(hi[1]-lo[1]));
    const project=p=>{const q=iso(p);return[width/2+(q[0]-(lo[0]+hi[0])/2)*scale,height/2+(q[1]-(lo[1]+hi[1])/2)*scale];};
    const line=(a,b,color,extra)=>{const p=project(a),q=project(b);element(svg,'line',Object.assign({x1:p[0],y1:p[1],x2:q[0],y2:q[1],stroke:color,'stroke-width':1},extra||{}));};
    for(let v=-.5;v<=1.5;v+=.5){line([v,0,0],[v,1.6,0],'var(--border)',{opacity:.55});line([-.5,v,0],[1.1,v,0],'var(--border)',{opacity:.55});}
    const axes=[[[.55,0,0],'x'],[[0,.55,0],'y'],[[0,0,.55],'z']];
    axes.forEach(([p,label])=>{line([0,0,0],p,'var(--muted-foreground)');const q=project(p);element(svg,'text',{x:q[0]+5,y:q[1]+3},label+(kind==='camera'?'C':'W'));});
    const o=project([0,0,0]);element(svg,'text',{x:o[0]-5,y:o[1]+14,'text-anchor':'end'},'O'+(kind==='camera'?'C':'W'));
    if(kind==='world'){
      MODEL.forEach(p=>{const q=project(p);element(svg,'circle',{cx:q[0],cy:q[1],r:1.6,fill:'none',stroke:'var(--muted-foreground)','stroke-width':.65,opacity:.55});});
      data.pairs.filter((_,i)=>i%35===0).forEach(p=>line(p.world,p.estimated,'var(--viz-series-2)',{'stroke-dasharray':'3 3',opacity:.5}));
    }
    data.pairs.slice().sort((a,b)=>{const p=kind==='camera'?a.camera:a.estimated,q=kind==='camera'?b.camera:b.estimated;return p[0]+p[1]+p[2]-q[0]-q[1]-q[2];}).forEach(p=>{const q=project(kind==='camera'?p.camera:p.estimated);element(svg,'circle',{cx:q[0],cy:q[1],r:kind==='camera'?1.9:1.7,fill:'var(--viz-series-1)',opacity:.87});});
    element(svg,'text',{x:width-8,y:height-8,'text-anchor':'end'},'单位 m');
  }
  function update(){
    root.querySelectorAll('[data-perception]').forEach(input=>{const k=input.dataset.perception;if(input.type==='checkbox')input.checked=state[k];else input.value=state[k];});
    root.querySelector('[data-value="yaw"]').textContent=state.yaw+'°';root.querySelector('[data-value="tx"]').textContent=state.tx.toFixed(2)+' m';
    const data=sample(state);
    root.querySelector('[data-metric="count"]').textContent=data.pairs.length+' / '+MODEL.length;
    root.querySelector('[data-metric="alignment"]').textContent=(data.alignment*100).toFixed(2)+' cm';
    root.querySelector('[data-metric="noise"]').textContent=(data.noise*100).toFixed(2)+' cm';
    root.dataset.alignmentError=data.alignment.toFixed(10);root.dataset.noiseError=data.noise.toFixed(10);root.dataset.pointCount=data.pairs.length;
    scenes.forEach(svg=>drawScene(svg,svg.dataset.scene,data));
  }
  function announce(){const data=sample(state);root.querySelector('[data-perception-announcement]').textContent='当前 '+data.pairs.length+' 个测量点。对齐误差 '+(data.alignment*100).toFixed(2)+' 厘米，测量噪声 '+(data.noise*100).toFixed(2)+' 厘米。抓取姿态仍未求解、未执行。';}
  root.querySelectorAll('[data-perception]').forEach(input=>{input.addEventListener('input',()=>{state[input.dataset.perception]=input.type==='checkbox'?input.checked:Number(input.value);update();});input.addEventListener('change',announce);});
  root.querySelectorAll('[data-perception-preset]').forEach(button=>button.addEventListener('click',()=>{const truth=button.dataset.perceptionPreset==='true';state.yaw=truth?TRUE_CAMERA.yaw:-20;state.tx=truth?TRUE_CAMERA.t[0]:-.2;update();announce();}));
  update();if(typeof ResizeObserver!=='undefined')scenes.forEach(svg=>new ResizeObserver(update).observe(svg));
})(typeof globalThis!=='undefined'?globalThis:this);
