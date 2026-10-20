/* Column vectors throughout: R_a_b and T_a_b map coordinates from b to a. */
(function () {
  'use strict';
  const rad = degrees => degrees * Math.PI / 180;
  const identity = n => Array.from({length:n}, (_,i) => Array.from({length:n}, (_,j) => Number(i === j)));
  const transpose = A => A[0].map((_,j) => A.map(row => row[j]));
  const multiply = (A,B) => A.map(row => B[0].map((_,j) => row.reduce((sum,value,k) => sum + value * B[k][j],0)));
  const multiplyVector = (A,v) => A.map(row => row.reduce((sum,value,i) => sum + value*v[i],0));
  const add = (a,b) => a.map((value,i) => value+b[i]);
  const scale = (v,k) => v.map(value => value*k);
  const subtract = (a,b) => a.map((value,i) => value-b[i]);
  const norm = v => Math.hypot(...v);
  const Rx = a => [[1,0,0],[0,Math.cos(a),-Math.sin(a)],[0,Math.sin(a),Math.cos(a)]];
  const Ry = a => [[Math.cos(a),0,Math.sin(a)],[0,1,0],[-Math.sin(a),0,Math.cos(a)]];
  const Rz = a => [[Math.cos(a),-Math.sin(a),0],[Math.sin(a),Math.cos(a),0],[0,0,1]];
  const euler = (roll,pitch,yaw) => multiply(multiply(Rz(rad(yaw)),Ry(rad(pitch))),Rx(rad(roll)));
  const determinant = A => A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1]) - A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0]) + A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
  const makeTransform = (R,t) => [...R.map((row,i) => [...row,t[i]]),[0,0,0,1]];
  const transformPoint = (T,p) => multiplyVector(T,[...p,1]).slice(0,3);
  const invertTransform = T => {
    const RT = transpose(T.slice(0,3).map(row => row.slice(0,3)));
    const t = T.slice(0,3).map(row => row[3]);
    return makeTransform(RT,scale(multiplyVector(RT,t),-1));
  };
  const maxDifference = (A,B) => Math.max(...A.flatMap((row,i) => row.map((value,j) => Math.abs(value-B[i][j]))));
  const api = {rad,identity,transpose,multiply,multiplyVector,add,scale,subtract,norm,Rx,Ry,Rz,euler,determinant,makeTransform,transformPoint,invertTransform,maxDifference};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const NS = 'http://www.w3.org/2000/svg';
  const axisColors = ['var(--viz-series-1)','var(--viz-series-2)','var(--viz-series-3)'];
  const fg = 'var(--foreground)', muted = 'var(--muted-foreground)', grid = 'var(--border)';
  const format = (value,digits=2) => (Math.abs(value)<0.5*10**(-digits) ? 0 : value).toFixed(digits);
  const vectorText = v => '('+v.map(value=>format(value)).join(', ')+')';
  const scientific = value => value === 0 ? '0' : value.toExponential(1);

  function element(tag,attributes,parent,text) {
    const node = document.createElementNS(NS,tag);
    Object.entries(attributes || {}).forEach(([key,value])=>node.setAttribute(key,String(value)));
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function prepareSvg(svg,title) {
    const width = svg.getBoundingClientRect().width || svg.parentElement.getBoundingClientRect().width || 360;
    const height = parseFloat(getComputedStyle(svg).height) || 320;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.replaceChildren();
    element('title',{},svg,title);
    svg._labelBoxes = [];
    return {width,height};
  }

  function line(svg,a,b,color=fg,weight=1.5,dashed=false,opacity=1) {
    return element('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:color,'stroke-width':weight,'stroke-dasharray':dashed?'4 4':'none',opacity},svg);
  }

  function arrow(svg,a,b,color=fg,weight=2,dashed=false) {
    line(svg,a,b,color,weight,dashed);
    const d=subtract(b,a), length=norm(d);
    if(length<1) return;
    const u=scale(d,1/length), size=Math.min(7,length*.3), n=[-u[1],u[0]];
    const back=subtract(b,scale(u,size));
    element('polygon',{points:[b,add(back,scale(n,size*.42)),subtract(back,scale(n,size*.42))].map(p=>p.join(',')).join(' '),fill:color},svg);
  }

  function dot(svg,p,color=fg,r=4,hollow=false) {
    element('circle',{cx:p[0],cy:p[1],r,fill:hollow?'var(--background)':color,stroke:color,'stroke-width':1.5},svg);
  }

  function label(svg,p,text,preferred=[9,-9],mutedText=false) {
    const bounds=svg.viewBox.baseVal;
    const candidates=[preferred,[9,-14],[9,23],[-9,-14],[-9,23],[0,-25],[0,33]];
    const node=element('text',{class:'mr-svg-label'},svg,text);
    if(mutedText) node.style.fill=muted;
    let best, bestScore=Infinity;
    candidates.forEach(([dx,dy])=>{
      node.setAttribute('x',p[0]+dx); node.setAttribute('y',p[1]+dy);
      node.setAttribute('text-anchor',dx<0?'end':dx>0?'start':'middle');
      let box=node.getBBox();
      const shiftX=box.x<7?7-box.x:box.x+box.width>bounds.width-7?bounds.width-7-box.x-box.width:0;
      const shiftY=box.y<8?8-box.y:box.y+box.height>bounds.height-8?bounds.height-8-box.y-box.height:0;
      const x=p[0]+dx+shiftX,y=p[1]+dy+shiftY;
      node.setAttribute('x',x); node.setAttribute('y',y); box=node.getBBox();
      const overlaps=svg._labelBoxes.reduce((sum,b)=>sum+Math.max(0,Math.min(box.x+box.width+4,b.x+b.width)-Math.max(box.x-4,b.x))*Math.max(0,Math.min(box.y+box.height+3,b.y+b.height)-Math.max(box.y-3,b.y)),0);
      const score=overlaps+Math.abs(shiftX)*5+Math.abs(shiftY)*5+Math.abs(dx-preferred[0])*.1+Math.abs(dy-preferred[1])*.1;
      if(score<bestScore) {bestScore=score;best={x,y,anchor:dx<0?'end':dx>0?'start':'middle',box:{x:box.x,y:box.y,width:box.width,height:box.height}};}
    });
    node.setAttribute('x',best.x); node.setAttribute('y',best.y); node.setAttribute('text-anchor',best.anchor);
    svg._labelBoxes.push(best.box);
    return node;
  }

  function makeProjection(width,height,extent=2.3,center=[0,0,0]) {
    const unit=Math.min((width-58)/(2*extent),(height-54)/(2*extent));
    const az=rad(35), el=rad(26), ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
    return p=>{
      const q=subtract(p,center);
      return [width/2+unit*(ca*q[0]-sa*q[1]),height*.55+unit*(se*(sa*q[0]+ca*q[1])-ce*q[2])];
    };
  }

  function grid3D(svg,project,extent=1.8,z=0) {
    for(let v=-extent;v<=extent+.001;v+=.5) {
      line(svg,project([-extent,v,z]),project([extent,v,z]),grid,1,false,.65);
      line(svg,project([v,-extent,z]),project([v,extent,z]),grid,1,false,.65);
    }
  }

  function frame3D(svg,project,origin,R,suffix,length=1,colored=true,dashed=false) {
    const axes=transpose(R), start=project(origin);
    axes.forEach((axis,i)=>{
      const end=project(add(origin,scale(axis,length)));
      arrow(svg,start,end,colored?axisColors[i]:muted,colored?2.8:1.3,dashed);
      label(svg,end,['x','y','z'][i]+'_'+suffix,[i===1?-8:8,i===2?-9:15],!colored);
    });
    dot(svg,start,colored?fg:muted,2.5);
  }

  function matrix(holder,A,title,columnHeaders) {
    const table=document.createElement('table'); table.className='mr-matrix';
    const caption=document.createElement('caption'); caption.textContent=title;table.appendChild(caption);
    const classes=['mr-column-x','mr-column-y','mr-column-z'];
    if(columnHeaders) {
      const head=document.createElement('thead'), tr=document.createElement('tr');
      columnHeaders.forEach((name,j)=>{const th=document.createElement('th');th.scope='col';th.textContent=name;th.className=classes[j]||'';tr.appendChild(th);});head.appendChild(tr);table.appendChild(head);
    }
    const body=document.createElement('tbody');
    A.forEach(row=>{const tr=document.createElement('tr');row.forEach((value,j)=>{const td=document.createElement('td');td.textContent=format(value);if(columnHeaders)td.className=classes[j]||'';tr.appendChild(td);});body.appendChild(tr);});
    table.appendChild(body);holder.replaceChildren(table);
  }

  function observe(root,draw) {
    let queued=false;
    const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;draw();});};
    new ResizeObserver(queue).observe(root);
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
  }

  function initRotation() {
    const root=document.getElementById('mr-frames-rotation');
    if(!root || root.dataset.ready==='true')return; root.dataset.ready='true';
    const svg=root.querySelector('[data-frame-scene]');
    const inputs=Array.from(root.querySelectorAll('[data-frame-angle]'));
    function draw() {
      const values=Object.fromEntries(inputs.map(input=>[input.dataset.frameAngle,Number(input.value)]));
      const R=euler(values.roll,values.pitch,values.yaw), check=multiply(transpose(R),R);
      const {width,height}=prepareSvg(svg,'世界坐标系固定；物体系姿态对应旋转矩阵的三列。');
      const project=makeProjection(width,height,1.65);
      grid3D(svg,project,1.5,-.6);
      frame3D(svg,project,[0,0,0],identity(3),'w',1.5,false,true);
      const local=[[-.42,-.32,-.3],[.42,-.32,-.3],[.42,.32,-.3],[-.42,.32,-.3],[-.42,-.32,.3],[.42,-.32,.3],[.42,.32,.3],[-.42,.32,.3]];
      const vertices=local.map(p=>multiplyVector(R,p));
      const faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(ids=>({ids,depth:ids.reduce((sum,i)=>sum+vertices[i][0]+vertices[i][1]+vertices[i][2],0)})).sort((a,b)=>a.depth-b.depth);
      faces.forEach(({ids})=>element('polygon',{points:ids.map(i=>project(vertices[i]).join(',')).join(' '),fill:'color-mix(in srgb, var(--viz-series-1) 8%, var(--background))',stroke:grid,'stroke-width':1,'fill-opacity':.8},svg));
      frame3D(svg,project,[0,0,0],R,'b',1,true,false);
      label(svg,project([0,0,0]),'O_w = O_b',[-13,25],true);
      matrix(root.querySelector('[data-rotation-matrix]'),R,'R_w_b · b → w',['x_b','y_b','z_b']);
      matrix(root.querySelector('[data-rotation-check]'),check,'R_w_bᵀ R_w_b');
      root.querySelector('[data-rotation-det]').textContent='det R = '+format(determinant(R),6);
      root.querySelector('[data-rotation-error]').textContent='与 I₃ 的最大误差：'+scientific(maxDifference(check,identity(3)));
      inputs.forEach(input=>{root.querySelector('[data-frame-value="'+input.dataset.frameAngle+'"]').value=input.value+'°';input.setAttribute('aria-valuetext',input.value+'度');});
      root.dataset.rotation=JSON.stringify(R);
      root.dataset.orthogonalityError=String(maxDifference(check,identity(3)));
      root.dataset.determinant=String(determinant(R));
    }
    inputs.forEach(input=>input.addEventListener('input',draw));
    observe(root,draw);draw();
  }

  function initActivePassive() {
    const root=document.getElementById('mr-active-passive');
    if(!root || root.dataset.ready==='true')return;root.dataset.ready='true';
    const slider=root.querySelector('#mr-active-passive-angle');
    const activeSvg=root.querySelector('[data-active-scene]'),passiveSvg=root.querySelector('[data-passive-scene]');
    const p=[1,.5,0];
    function plane(svg,title) {
      const {width,height}=prepareSvg(svg,title);
      const unit=Math.min((width-60)/3.6,(height-70)/3.6), center=[width/2,height/2];
      const project=q=>[center[0]+q[0]*unit,center[1]-q[1]*unit];
      for(let v=-1.5;v<=1.501;v+=.5){line(svg,project([-1.6,v]),project([1.6,v]),grid,1);line(svg,project([v,-1.6]),project([v,1.6]),grid,1);}
      arrow(svg,project([-1.5,0]),project([1.65,0]),muted,1.4);
      arrow(svg,project([0,-1.5]),project([0,1.65]),muted,1.4);
      label(svg,project([1.65,0]),'x_w',[-5,18],true);label(svg,project([0,1.65]),'y_w',[8,4],true);
      dot(svg,center,muted,2.5);
      return {project,center,unit};
    }
    function draw() {
      const angle=Number(slider.value),R=Rz(rad(angle)),rotated=multiplyVector(R,p),expressed=multiplyVector(transpose(R),p);
      const a=plane(activeSvg,'主动旋转：点的位置改变，世界坐标系不变。');
      const radius=Math.hypot(p[0],p[1]),start=Math.atan2(p[1],p[0]);
      const arc=Array.from({length:65},(_,i)=>a.project([radius*Math.cos(start+rad(angle)*i/64),radius*Math.sin(start+rad(angle)*i/64)]));
      element('polyline',{points:arc.map(q=>q.join(',')).join(' '),fill:'none',stroke:axisColors[0],'stroke-width':2,'stroke-dasharray':'4 3'},activeSvg);
      line(activeSvg,a.center,a.project(p),muted,1.3,true);
      arrow(activeSvg,a.center,a.project(rotated),axisColors[0],2.6);
      dot(activeSvg,a.project(p),muted,4,true);dot(activeSvg,a.project(rotated),axisColors[0],5);
      label(activeSvg,a.project(p),'原位置 p',[8,20],true);
      label(activeSvg,a.project(rotated),'新位置 p′',[9,-12]);

      const b=plane(passiveSvg,'被动换坐标：世界点保持原位，物体坐标系转动。');
      const ex=multiplyVector(R,[1,0,0]),ey=multiplyVector(R,[0,1,0]);
      arrow(passiveSvg,b.project(scale(ex,-1.4)),b.project(scale(ex,1.55)),axisColors[0],2);
      arrow(passiveSvg,b.project(scale(ey,-1.4)),b.project(scale(ey,1.55)),axisColors[1],2);
      label(passiveSvg,b.project(scale(ex,1.55)),'x_b',[8,16]);label(passiveSvg,b.project(scale(ey,1.55)),'y_b',[8,-9]);
      const footX=scale(ex,expressed[0]),footY=scale(ey,expressed[1]);
      line(passiveSvg,b.project(footX),b.project(p),axisColors[1],1.6,true);
      line(passiveSvg,b.project(footY),b.project(p),axisColors[0],1.6,true);
      line(passiveSvg,b.center,b.project(footX),axisColors[0],3.5);
      line(passiveSvg,b.center,b.project(footY),axisColors[1],3.5);
      dot(passiveSvg,b.project(p),fg,5);label(passiveSvg,b.project(p),'同一点 p 固定',[9,-12]);
      root.querySelector('[data-active-value]').textContent='p′_w = '+vectorText(rotated.slice(0,2));
      root.querySelector('[data-passive-value]').textContent='p_b = '+vectorText(expressed.slice(0,2));
      root.querySelector('[data-active-angle-value]').value=angle+'°';
      slider.setAttribute('aria-valuetext',angle+'度');
      root.dataset.worldPoint=JSON.stringify(p);
      root.dataset.rotatedPoint=JSON.stringify(rotated);
      root.dataset.bodyCoordinates=JSON.stringify(expressed);
    }
    slider.addEventListener('input',draw);
    slider.addEventListener('change',()=>{
      const active=JSON.parse(root.dataset.rotatedPoint),passive=JSON.parse(root.dataset.bodyCoordinates);
      root.querySelector('[data-active-status]').textContent='主动旋转结果 '+vectorText(active.slice(0,2))+'；固定点在物体系的读数 '+vectorText(passive.slice(0,2));
    });
    observe(root,draw);draw();
  }

  function initTransform() {
    const root=document.getElementById('mr-homogeneous-transform');
    if(!root || root.dataset.ready==='true')return;root.dataset.ready='true';
    const svg=root.querySelector('[data-transform-scene]');
    const inputs=Array.from(root.querySelectorAll('[data-transform-input]'));
    const state={mode:'single',step:'translation'};
    const pc=[.7,.35,.5];
    function announceResult(prefix) {
      const pw=JSON.parse(root.dataset.worldPoint);
      root.querySelector('[data-transform-status]').textContent=(prefix?prefix+' · ':'')+'固定输入 p_c = '+vectorText(pc)+' m；世界表达 p_w = '+vectorText(pw)+' m';
    }
    function draw() {
      const value=Object.fromEntries(inputs.map(input=>[input.dataset.transformInput,Number(input.value)]));
      const chain=state.mode==='chain';
      const Rwb=Rz(rad(value.baseYaw)),twb=[.55,-.35,.15];
      const Rbc=Rz(rad(-30)),tbc=[value.cameraOffset,.2,.65];
      const Twb=makeTransform(Rwb,twb),Tbc=makeTransform(Rbc,tbc);
      const Twc=chain?multiply(Twb,Tbc):makeTransform(Rz(rad(value.yaw)),[value.tx,value.ty,value.tz]);
      const Rwc=Twc.slice(0,3).map(row=>row.slice(0,3)),twc=Twc.slice(0,3).map(row=>row[3]);
      const rotated=multiplyVector(Rwc,pc),pw=transformPoint(Twc,pc),recovered=transformPoint(invertTransform(Twc),pw);
      const pb=transformPoint(Tbc,pc),viaBase=transformPoint(Twb,pb);
      const {width,height}=prepareSvg(svg,chain?'相机坐标通过底座坐标转换为世界坐标。':'相机点的坐标经旋转和平移表达为世界坐标。');
      const project=makeProjection(width,height,2.8,[.3,.25,.5]);
      grid3D(svg,project,2,0);
      frame3D(svg,project,[0,0,0],identity(3),'w',1.4,false,false);
      frame3D(svg,project,twc,Rwc,'c',.75,true,false);
      label(svg,project(twc),'O_c',[-12,22]);
      if(chain) {
        frame3D(svg,project,twb,Rwb,'b',.95,false,true);
        label(svg,project(twb),'O_b',[-12,23],true);
        arrow(svg,project([0,0,0]),project(twb),muted,1.5,true);
        arrow(svg,project(twb),project(twc),muted,1.5,true);
        line(svg,project(twc),project(pw),axisColors[0],2.2);
      } else {
        arrow(svg,project([0,0,0]),project(rotated),axisColors[1],state.step==='rotation'?3:1.5,true);
        dot(svg,project(rotated),axisColors[1],state.step==='rotation'?5:3,true);
        label(svg,project(rotated),'R p_c',[-10,20]);
        arrow(svg,project(rotated),project(pw),axisColors[2],state.step==='translation'?3:1.2,true);
        arrow(svg,project([0,0,0]),project(twc),muted,1.5,true);
        label(svg,project(scale(twc,.5)),'t_w_c',[-8,-10],true);
        line(svg,project(twc),project(pw),axisColors[0],2.2);
      }
      dot(svg,project(pw),fg,5);
      label(svg,project(pw),'p（世界位置）',[9,-12]);
      matrix(root.querySelector('[data-transform-matrix]'),Twc,'T_w_c · c → w');
      matrix(root.querySelector('[data-transform-base-matrix]'),Twb,'T_w_b · b → w');
      matrix(root.querySelector('[data-transform-camera-matrix]'),Tbc,'T_b_c · c → b');
      root.querySelector('[data-transform-point]').textContent='p_w = '+vectorText(pw)+' m';
      root.querySelector('[data-transform-inverse]').textContent='T_c_w [p_w; 1] → '+vectorText(recovered)+' m';
      root.querySelector('[data-transform-error]').textContent='逆向恢复误差：'+scientific(norm(subtract(recovered,pc)))+' m';
      root.querySelector('[data-transform-step-value]').textContent=state.step==='rotation'?'① 旋转项 R_w_c p_c = '+vectorText(rotated)+' m':'② '+vectorText(rotated)+' + '+vectorText(twc)+' = '+vectorText(pw)+' m';
      root.querySelector('[data-transform-chain-point]').textContent='p_b = '+vectorText(pb)+' m → p_w = '+vectorText(viaBase)+' m';
      root.querySelector('[data-transform-equation]').textContent=chain?'[p_w; 1] = T_w_b T_b_c [p_c; 1]':'p_w = R_w_c p_c + t_w_c';
      root.querySelector('[data-transform-scene-caption]').textContent=chain?'世界 w ← 底座 b ← 相机 c':'世界系 w 与相机系 c';
      root.querySelector('[data-transform-base-legend]').hidden=!chain;
      inputs.forEach(input=>{const key=input.dataset.transformInput;root.querySelector('[data-transform-value="'+key+'"]').value=key==='yaw'||key==='baseYaw'?input.value+'°':format(Number(input.value))+' m';});
      root.dataset.transform=JSON.stringify(Twc);
      root.dataset.cameraPoint=JSON.stringify(pc);
      root.dataset.worldPoint=JSON.stringify(pw);
      root.dataset.recoveredPoint=JSON.stringify(recovered);
      root.dataset.chainError=String(norm(subtract(viaBase,transformPoint(multiply(Twb,Tbc),pc))));
    }
    root.querySelectorAll('[data-transform-mode]').forEach(button=>button.addEventListener('click',()=>{
      state.mode=button.dataset.transformMode;
      root.querySelectorAll('[data-transform-mode]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.transformMode===state.mode)));
      root.querySelectorAll('[data-transform-controls]').forEach(item=>{item.hidden=item.dataset.transformControls!==state.mode;});
      draw();
      announceResult(state.mode==='chain'?'相机 → 底座 → 世界':'相机 → 世界');
    }));
    root.querySelectorAll('[data-transform-step]').forEach(button=>button.addEventListener('click',()=>{
      state.step=button.dataset.transformStep;
      root.querySelectorAll('[data-transform-step]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.transformStep===state.step)));
      draw();
      root.querySelector('[data-transform-status]').textContent=root.querySelector('[data-transform-step-value]').textContent;
    }));
    inputs.forEach(input=>{
      input.addEventListener('input',draw);
      input.addEventListener('change',()=>announceResult('坐标变换已更新'));
    });
    observe(root,draw);draw();
  }

  function initialize() { initRotation();initActivePassive();initTransform(); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
