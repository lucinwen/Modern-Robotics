(function(global){
  'use strict';
  const EPS=1e-8;
  const SCOPE='axis_aligned_2d_geometry_and_symbolic_rules_only_no_physics_or_control';
  function contactWitness(a,b){
    let start,end,axis;
    if(Math.abs(a[2]-b[0])<=EPS||Math.abs(b[2]-a[0])<=EPS){
      const x=Math.abs(a[2]-b[0])<=EPS?a[2]:a[0];
      start=[x,Math.max(a[1],b[1])];end=[x,Math.min(a[3],b[3])];axis='vertical';
    }else if(Math.abs(a[3]-b[1])<=EPS||Math.abs(b[3]-a[1])<=EPS){
      const y=Math.abs(a[3]-b[1])<=EPS?a[3]:a[1];
      start=[Math.max(a[0],b[0]),y];end=[Math.min(a[2],b[2]),y];axis='horizontal';
    }else return null;
    const length=axis==='vertical'?end[1]-start[1]:end[0]-start[0];
    return length>0?{start,end,length,axis}:null;
  }
  const sharedWallLength=(a,b)=>{const w=contactWitness(a,b);return w?w.length:0;};
  function overlapArea(a,b){return Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));}
  function reachable(start,target,edges){const adj=new Map();edges.forEach(([a,b])=>{if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);});const q=[start],seen=new Set(q);for(let i=0;i<q.length;i++){const id=q[i];if(id===target)return true;for(const n of adj.get(id)||[])if(!seen.has(n)){seen.add(n);q.push(n);}}return false;}
  function analyze(world){
    const result=(status,reason,geom,topo,task=false)=>({status,reason,geometry_valid:geom,topology_connected:topo,rule_task_feasible:task,scope:SCOPE});
    let roomList,doors,robot,objects,goal,rooms,ids,target;
    try{
      ({rooms:roomList,doors,robot,objects,goal}=world);ids=roomList.map(r=>r.id);
      if(!ids.length||new Set(ids).size!==ids.length)throw Error('room ids missing, empty or duplicated');
      rooms=new Map(roomList.map(r=>[r.id,r.box.map(Number)]));
      if([...rooms.values()].some(b=>b.length!==4||!(b[0]<b[2])||!(b[1]<b[3])))throw Error('invalid room box');
      if(!rooms.has(robot.start)||!(Number(robot.width_m)>0))throw Error('invalid robot start or width');
      if(new Set(objects.map(o=>o.id)).size!==objects.length)throw Error('duplicated object id');
      const obj=objects.find(o=>o.id===goal.object);if(goal.type!=='hold'||!obj)throw Error('unsupported goal');target=obj.room;if(!rooms.has(target))throw Error('unknown target room');
      doors.forEach(d=>{const[a,b]=d.between;if(!rooms.has(a)||!rooms.has(b)||a===b||!(Number(d.width_m)>0))throw Error('invalid door');});
    }catch(e){return result('invalid_input','invalid data or unsupported demo goal: '+e.message,false,false);}
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)if(overlapArea(rooms.get(ids[i]),rooms.get(ids[j]))>EPS)return result('invalid_geometry','interior overlap: '+ids[i]+'/'+ids[j],false,false);
    const all=[],usable=[],narrow=[],locked=[],capabilities=new Set(robot.capabilities||[]),keys=new Set(robot.keys||[]),width=Number(robot.width_m);
    for(const d of doors){
      const[a,b]=d.between,wall=sharedWallLength(rooms.get(a),rooms.get(b)),dw=Number(d.width_m);
      if(wall<=EPS||dw>wall+EPS)return result('invalid_geometry','door '+d.id+' lacks a sufficient shared wall',false,false);
      all.push([a,b]);
      if(dw+EPS<width){narrow.push(d.id);continue;}
      if(d.locked&&(!capabilities.has('unlock')||!d.key||!keys.has(d.key))){locked.push(d.id);continue;}
      usable.push([a,b]);
    }
    const topo=reachable(robot.start,target,all);
    if(!topo)return result('blocked_topology','no declared door graph path to target',true,false);
    if(!capabilities.has('move')&&robot.start!==target)return result('blocked_action','robot lacks move capability',true,true);
    if(!reachable(robot.start,target,usable)){let cause='narrow doors: '+narrow.join(',');if(locked.length)cause+=(narrow.length?'; ':'')+'locked doors: '+locked.join(',');return result(narrow.length?'blocked_geometry':'blocked_state',cause||'route blocked',true,true);}
    const obj=objects.find(o=>o.id===goal.object);
    if(!capabilities.has('grasp')||!obj.graspable)return result('blocked_action','no valid grasp under declared demo rules',true,true);
    return result('rule_feasible','restricted graph/geometry/state rules all pass',true,true,true);
  }
  const defaults=()=>({doorWidth:.9,robotWidth:.6,bx:4,by:0,edge:true,locked:false,move:true,grasp:true,unlock:false,key:false});
  function worldFromState(s){return{rooms:[{id:'A',box:[0,0,4,4]},{id:'B',box:[s.bx,s.by,s.bx+4,s.by+4]}],doors:s.edge?[{id:'D',between:['A','B'],width_m:s.doorWidth,locked:s.locked,key:'K'}]:[],robot:{start:'A',width_m:s.robotWidth,capabilities:['move','grasp','unlock'].filter(k=>s[k]),keys:s.key?['K']:[]},objects:[{id:'cup',room:'B',graspable:true}],goal:{type:'hold',object:'cup'}};}
  const api=Object.freeze({EPS,SCOPE,analyze,contactWitness,sharedWallLength,overlapArea,reachable,worldFromState,defaults});global.Day1RoomRules=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document==='undefined')return;
  const root=document.getElementById('day1-room-validation');if(!root)return;
  let state=defaults();const NS='http://www.w3.org/2000/svg';
  const plan=root.querySelector('[data-rooms-scene="plan"]'),graph=root.querySelector('[data-rooms-scene="graph"]');
  function el(parent,tag,attrs,text){const n=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!==undefined)n.textContent=text;parent.appendChild(n);return n;}
  function drawPlan(a,b,witness){
    const width=Math.max(260,plan.getBoundingClientRect().width),height=plan.getBoundingClientRect().height||340;plan.setAttribute('viewBox',`0 0 ${width} ${height}`);plan.replaceChildren();
    el(plan,'title',{},'房间 A、B 的二维 AABB 与共墙证据，单位米');
    const lo=[Math.min(0,b[0])-.4,Math.min(0,b[1])-.4],hi=[Math.max(4,b[2])+.4,Math.max(4,b[3])+.4],scale=Math.min((width-45)/(hi[0]-lo[0]),(height-45)/(hi[1]-lo[1]));
    const ox=(width-(hi[0]-lo[0])*scale)/2,oy=(height-(hi[1]-lo[1])*scale)/2;
    const p=q=>[ox+(q[0]-lo[0])*scale,height-oy-(q[1]-lo[1])*scale];
    const line=(x,y,attrs)=>{const q=p(x),r=p(y);return el(plan,'line',Object.assign({x1:q[0],y1:q[1],x2:r[0],y2:r[1]},attrs));};
    const text=(q,s,extra)=>{const r=p(q);return el(plan,'text',Object.assign({x:r[0],y:r[1],'text-anchor':'middle'},extra||{}),s);};
    for(let x=Math.ceil(lo[0]);x<=hi[0];x++){line([x,lo[1]],[x,hi[1]],{stroke:'var(--border)','stroke-width':.7,opacity:.55});if(x%2===0)text([x,lo[1]],String(x),{dy:15});}
    for(let y=Math.ceil(lo[1]);y<=hi[1];y++){line([lo[0],y],[hi[0],y],{stroke:'var(--border)','stroke-width':.7,opacity:.55});if(y%2===0)text([lo[0],y],String(y),{dx:-8,dy:4,'text-anchor':'end'});}
    [a,b].forEach((box,i)=>{const q=p([box[0],box[3]]);el(plan,'rect',{x:q[0],y:q[1],width:(box[2]-box[0])*scale,height:(box[3]-box[1])*scale,fill:`var(--viz-series-${i+1})`,'fill-opacity':.075,stroke:'var(--muted-foreground)','stroke-width':1.3});text([(box[0]+box[2])/2,box[3]-.4],'房间 '+(i?'B':'A'));});
    if(overlapArea(a,b)>0){const box=[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])],q=p([box[0],box[3]]);el(plan,'rect',{x:q[0],y:q[1],width:(box[2]-box[0])*scale,height:(box[3]-box[1])*scale,fill:'var(--viz-series-3)','fill-opacity':.25});}
    if(witness){
      line(witness.start,witness.end,{stroke:'var(--viz-series-2)','stroke-width':4});
      if(state.edge){const center=witness.start.map((v,i)=>(v+witness.end[i])/2),vertical=witness.axis==='vertical',delta=vertical?[0,state.doorWidth/2]:[state.doorWidth/2,0],start=center.map((v,i)=>v-delta[i]),end=center.map((v,i)=>v+delta[i]);
        const fits=state.doorWidth<=witness.length+EPS;line(start,end,{stroke:'var(--background)','stroke-width':9});line(start,end,{stroke:fits?'var(--viz-series-1)':'var(--viz-series-3)','stroke-width':2,'stroke-dasharray':fits?'none':'3 2'});
        [start,end].forEach(q=>line(vertical?[q[0]-.1,q[1]]:[q[0],q[1]-.1],vertical?[q[0]+.1,q[1]]:[q[0],q[1]+.1],{stroke:'var(--foreground)','stroke-width':1.4}));
        text(vertical?[center[0]+.18,end[1]+.2]:[center[0],center[1]+.25],'D '+state.doorWidth.toFixed(2)+' m',{'text-anchor':vertical?'start':'middle'});
      }
    }else if(state.edge){line([4,1.55],[4,2.45],{stroke:'var(--viz-series-3)','stroke-width':2,'stroke-dasharray':'3 3'});text([4,1.25],'门无有效接面');}
    const r=p([1.3-state.robotWidth/2,2+state.robotWidth/2]);el(plan,'rect',{x:r[0],y:r[1],width:state.robotWidth*scale,height:state.robotWidth*scale,fill:'var(--viz-series-1)','fill-opacity':.3,stroke:'var(--viz-series-1)','stroke-width':1.5});text([1.3,1.2],'机器人');text([1.3,.83],state.robotWidth.toFixed(2)+' m');
    const cup=p([b[0]+2,b[1]+2]);el(plan,'circle',{cx:cup[0],cy:cup[1],r:4,fill:'var(--viz-series-2)'});text([b[0]+2,b[1]+1.4],'杯子');
    el(plan,'text',{x:width-3,y:height-3,'text-anchor':'end'},'x → · 单位 m');el(plan,'text',{x:4,y:14},'y ↑');
  }
  function drawGraph(){const width=Math.max(180,graph.getBoundingClientRect().width),height=graph.getBoundingClientRect().height||145;graph.setAttribute('viewBox',`0 0 ${width} ${height}`);graph.replaceChildren();el(graph,'title',{},'声明的门图；存在连线不代表几何或任务可行');const cy=height*.46,x1=width*.22,x2=width*.78;if(state.edge){el(graph,'line',{x1:x1+22,y1:cy,x2:x2-22,y2:cy,stroke:'var(--foreground)','stroke-width':1.5});el(graph,'text',{x:width/2,y:cy-14,'text-anchor':'middle'},'门 D');}['A','B'].forEach((id,i)=>{el(graph,'circle',{cx:i?x2:x1,cy,r:22,fill:'var(--background)',stroke:'var(--muted-foreground)','stroke-width':1.3});el(graph,'text',{x:i?x2:x1,y:cy+4,'text-anchor':'middle'},id);});el(graph,'text',{x:width/2,y:height-10,'text-anchor':'middle'},state.edge?'已声明连接':'没有声明连接');}
  function check(name,text,result){const n=root.querySelector('[data-rooms-check="'+name+'"]');n.textContent=text;n.dataset.result=result;}
  function update(){
    root.querySelectorAll('[data-rooms]').forEach(input=>{const key=input.dataset.rooms;if(input.type==='checkbox')input.checked=state[key];else input.value=state[key];});
    root.querySelectorAll('[data-rooms-output]').forEach(out=>out.textContent=state[out.dataset.roomsOutput].toFixed(2)+' m');
    const world=worldFromState(state),a=world.rooms[0].box,b=world.rooms[1].box,witness=contactWitness(a,b),area=overlapArea(a,b),result=analyze(world),wall=witness?witness.length:0;
    root.querySelector('[data-rooms-value="box-b"]').textContent='B = ['+b.map(v=>Number(v.toFixed(2))).join(', ')+'] m';
    root.querySelector('[data-rooms-value="witness"]').textContent=witness?'接段 ('+witness.start.map(v=>v.toFixed(2)).join(', ')+') → ('+witness.end.map(v=>v.toFixed(2)).join(', ')+') m；长度 '+wall.toFixed(2)+' m':'无正长度共墙接段';
    check('graph',state.edge?'存在 A—B 门边声明':'没有 A—B 门边',state.edge?'pass':'fail');
    check('overlap',area>EPS?'无效：内部重叠 '+area.toFixed(3)+' m²':'无内部面积重叠',area>EPS?'fail':'pass');
    check('wall',!state.edge?'未声明门；接面仍可单独观察':wall<=EPS?'门缺少正长度共墙':state.doorWidth>wall+EPS?'门净宽超过共墙长度':'门洞位于接段中点，且完整落在接段内',!state.edge?'unknown':wall<=EPS||state.doorWidth>wall+EPS?'fail':'pass');
    const margin=state.doorWidth-state.robotWidth;
    check('width',!state.edge?'未声明门':(state.doorWidth+EPS>=state.robotWidth?'宽度数值足够':'净宽不足')+'；总宽度余量 '+margin.toFixed(2)+' m',!state.edge?'unknown':state.doorWidth+EPS>=state.robotWidth?'pass':'fail');
    const unlockOK=!state.locked||(state.unlock&&state.key);
    check('state',!state.edge?'未声明门':!state.locked?'门未上锁':unlockOK?'门已锁；具备解锁能力和匹配钥匙':'门已锁；缺少解锁能力或匹配钥匙',!state.edge?'unknown':unlockOK?'pass':'fail');
    check('capability',(!state.move?'缺少移动能力':!state.grasp?'缺少抓取能力':'已声明 move、grasp；杯子标记为可抓取'),state.move&&state.grasp?'pass':'fail');
    const labels={invalid_geometry:'几何输入无效',blocked_topology:'图关系不通',blocked_geometry:'净宽规则阻断',blocked_state:'门锁条件阻断',blocked_action:'能力条件不满足',rule_feasible:'受限规则通过，执行仍未验证',invalid_input:'输入无效'};
    root.querySelector('[data-rooms-value="status"]').textContent=result.status+' · '+labels[result.status];
    root.querySelector('[data-rooms-value="reason"]').textContent=result.reason;
    root.dataset.status=result.status;root.dataset.contactLength=wall.toFixed(10);root.dataset.overlapArea=area.toFixed(10);root.dataset.ruleFeasible=String(result.rule_task_feasible);
    drawPlan(a,b,witness);drawGraph();
  }
  function announce(){const summary=root.querySelector('[data-rooms-value="status"]').textContent.split(' · ').slice(1).join(' · ');root.querySelector('[data-rooms-announcement]').textContent=summary+'。连续路径、抓取与物理执行未验证。';}
  root.querySelectorAll('[data-rooms]').forEach(input=>{input.addEventListener('input',()=>{state[input.dataset.rooms]=input.type==='checkbox'?input.checked:Number(input.value);update();});input.addEventListener('change',announce);});
  root.querySelectorAll('[data-rooms-preset]').forEach(button=>button.addEventListener('click',()=>{state=defaults();const kind=button.dataset.roomsPreset;if(kind==='narrow')state.doorWidth=.4;if(kind==='gap')state.bx=5;if(kind==='overlap')state.bx=3;if(kind==='locked')state.locked=true;update();announce();}));
  update();if(typeof ResizeObserver!=='undefined'){new ResizeObserver(update).observe(plan);new ResizeObserver(update).observe(graph);}
})(typeof globalThis!=='undefined'?globalThis:this);
