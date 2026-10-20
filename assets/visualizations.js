/* rigid-body */
(function () {
  const root = document.getElementById('dof-rigid-body');
      if (!root || root.dataset.ready === 'true') return;
      root.dataset.ready = 'true';
  const svg = root.querySelector('.dof-scene');
  const group = root.querySelector('.scene-content');
  const NS = 'http://www.w3.org/2000/svg';
  const state = {mode:'plane',x:0,y:0,z:1.4,roll:0,pitch:0,yaw:20,open:75};
  const active = {plane:['x','y','yaw'],space:['x','y','z','roll','pitch','yaw'],hinge:['open']};
  const inputs = {};
  root.querySelectorAll('input').forEach(function (input) {
    const key = input.closest('[data-parameter]').dataset.parameter;
    inputs[key] = input;
    input.addEventListener('input',function () {state[key] = Number(input.value); updateValues(); draw();});
  });
  function node(tag, attrs, parent, text) {
    const e = document.createElementNS(NS,tag);
    Object.entries(attrs || {}).forEach(function (p) {e.setAttribute(p[0],p[1]);});
    if (text !== undefined) e.textContent = text;
    (parent || group).appendChild(e); return e;
  }
  function updateValues() {
    Object.keys(inputs).forEach(function (key) {
      const out = root.querySelector('output[for="'+inputs[key].id+'"]');
      out.textContent = ['x','y','z'].includes(key) ? state[key].toFixed(2)+' m' : Math.round(state[key])+'°';
    });
  }
  function switchMode(mode) {
    state.mode = mode;
    root.querySelectorAll('[data-mode]').forEach(function (b) {b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    root.querySelectorAll('[data-parameter]').forEach(function (el) {el.hidden = !active[mode].includes(el.dataset.parameter);});
    root.querySelector('.dof-count').textContent = '独立参数：'+active[mode].length+' 个';
    root.querySelector('.dof-view').textContent = {plane:'俯视 · 同一面始终朝上',space:'固定视角 · 改变物体的位置与朝向',hinge:'固定铰链轴 · 只有开合角度变化'}[mode];
    root.querySelector('.dof-yaw-label').textContent = mode==='plane'?'平面内转动':'转向角';
    draw();
  }
  root.querySelectorAll('[data-mode]').forEach(function (b) {b.addEventListener('click',function () {switchMode(b.dataset.mode);});});
  function draw() {
    const width = Math.max(280,svg.getBoundingClientRect().width);
    const height = parseFloat(getComputedStyle(svg).height) || 330;
    svg.setAttribute('viewBox','0 0 '+width+' '+height);
    group.replaceChildren();
    const flat = state.mode==='plane';
    const scale = flat ? Math.min(width/6.7,height/4.7) : Math.min(width/7.8,height/6.55);
    const origin = [width/2,flat?height/2:height*.64];
    function project(p) {
      return flat ? [origin[0]+p[0]*scale,origin[1]-p[1]*scale] : [origin[0]+(p[0]-p[1])*Math.SQRT1_2*scale,origin[1]+((p[0]+p[1])/Math.sqrt(6)-p[2]*Math.sqrt(2/3))*scale];
    }
    function line(a,b,cls,attrs) {
      const p=project(a),q=project(b);return node('line',Object.assign({x1:p[0],y1:p[1],x2:q[0],y2:q[1],class:cls},attrs||{}));
    }
    function path(points,attrs) {
      const d=points.map(function(p,i){const s=project(p);return(i?'L':'M')+s[0].toFixed(2)+','+s[1].toFixed(2);}).join(' ');
      return node('path',Object.assign({d:d},attrs||{}));
    }
    function textAt(p,text,dx,dy,anchor) {
      const t=project(p);return node('text',{x:t[0]+(dx||0),y:t[1]+(dy||0),'text-anchor':anchor||'start'},null,text);
    }
    function poly(points,cls,attrs) {
      return node('polygon',Object.assign({points:points.map(function(p){return project(p).join(',');}).join(' '),class:cls},attrs||{}));
    }
    const extent = flat?2.5:2.25;
    for(let i=-2;i<=2;i+=.5) {
      line([-extent,i,0],[extent,i,0],'dof-grid-line');
      line([i,-extent,0],[i,extent,0],'dof-grid-line');
    }
    if(flat) {
      line([-2.65,0,0],[2.65,0,0],'dof-axis');
      line([0,-1.95,0],[0,1.95,0],'dof-axis');
      textAt([2.65,0,0],'x',4,-6);textAt([0,1.95,0],'y',8,5);
    } else {
      line([0,0,0],[2.65,0,0],'dof-axis');line([0,0,0],[0,2.65,0],'dof-axis');line([0,0,0],[0,0,3.25],'dof-axis');
      textAt([2.65,0,0],'x',8,5);textAt([0,2.65,0],'y',-12,5);textAt([0,0,3.25],'z',8,3);
    }
    if(state.mode==='hinge') {
      const a=state.open*Math.PI/180;
      const hinge=[-.75,.4,0];
      const rotateDoor=function(p){return[hinge[0]+p[0]*Math.cos(a)-p[1]*Math.sin(a),hinge[1]+p[0]*Math.sin(a)+p[1]*Math.cos(a),p[2]];};
      const shut=[[0,0,0],[1.65,0,0],[1.65,0,2.4],[0,0,2.4],[0,0,0]].map(function(p){return[p[0]+hinge[0],p[1]+hinge[1],p[2]];});
      path(shut,{class:'dof-axis','stroke-dasharray':'4 4',opacity:'.65'});
      poly([[0,0,0],[1.65,0,0],[1.65,0,2.4],[0,0,2.4]].map(rotateDoor),'dof-cover dof-edge');
      line(hinge,[hinge[0],hinge[1],2.7],'dof-edge',{'stroke-width':3});
      textAt([hinge[0],hinge[1],2.65],'固定轴',-8,-8,'end');
      const h=project(rotateDoor([1.4,0,1.15]));node('circle',{cx:h[0],cy:h[1],r:4,fill:'var(--foreground)'});
      const arc=[];for(let i=0;i<=30;i++){const t=a*i/30;arc.push([hinge[0]+.8*Math.cos(t),hinge[1]+.8*Math.sin(t),.025]);}
      path(arc,{fill:'none',stroke:'var(--viz-series-1)','stroke-width':2});
      return;
    }
    const rx=(flat?0:state.roll)*Math.PI/180,ry=(flat?0:state.pitch)*Math.PI/180,rz=state.yaw*Math.PI/180;
    function transform(p) {
      const a=[p[0],p[1]*Math.cos(rx)-p[2]*Math.sin(rx),p[1]*Math.sin(rx)+p[2]*Math.cos(rx)];
      const b=[a[0]*Math.cos(ry)+a[2]*Math.sin(ry),a[1],-a[0]*Math.sin(ry)+a[2]*Math.cos(ry)];
      return[b[0]*Math.cos(rz)-b[1]*Math.sin(rz)+state.x,b[0]*Math.sin(rz)+b[1]*Math.cos(rz)+state.y,b[2]+(flat?.15:state.z)];
    }
    if(!flat) {
      line([state.x,state.y,0],[state.x,state.y,state.z],'dof-axis',{'stroke-dasharray':'3 4',opacity:'.5'});
      const foot=project([state.x,state.y,0]);node('circle',{cx:foot[0],cy:foot[1],r:3,fill:'var(--muted-foreground)'});
    }
    const local=[[-.95,-.63,-.12],[.95,-.63,-.12],[.95,.63,-.12],[-.95,.63,-.12],[-.95,-.63,.12],[.95,-.63,.12],[.95,.63,.12],[-.95,.63,.12]];
    const vertices=local.map(transform);
    const faces=[{ids:[0,3,2,1],cls:'dof-back'},{ids:[4,5,6,7],cls:'dof-cover',cover:true},{ids:[0,1,5,4],cls:'dof-side'},{ids:[1,2,6,5],cls:'dof-side'},{ids:[2,3,7,6],cls:'dof-side'},{ids:[3,0,4,7],cls:'dof-back'}];
    faces.forEach(function(f){f.depth=f.ids.reduce(function(a,i){return a+(flat?vertices[i][2]:vertices[i][0]+vertices[i][1]+vertices[i][2]);},0)/4;});
    faces.sort(function(a,b){return a.depth-b.depth;}).forEach(function(f){
      poly(f.ids.map(function(i){return vertices[i];}),f.cls+' dof-edge');
      if(f.cover) {
        const arrow=[[-.2,-.2,.123],[.15,-.2,.123],[.15,.02,.123],[.37,.02,.123],[-.025,.42,.123],[-.42,.02,.123],[-.2,.02,.123]];
        poly(arrow.map(transform),'dof-direction');
        line(transform([-.8,-.63,.123]),transform([-.8,.63,.123]),'dof-edge',{opacity:'.6'});
      }
    });
    const center=project([state.x,state.y,flat?.13:state.z]);
    if(flat) node('circle',{cx:center[0],cy:center[1],r:2.5,class:'dof-origin'});
  }
  updateValues(); switchMode('plane');
  new ResizeObserver(draw).observe(svg);
})();

/* three-points */
(() => {
      const root = document.getElementById('dof-three-points');
      if (!root || root.dataset.ready === 'true') return;
      root.dataset.ready = 'true';
      const svg = root.querySelector('.dof3-picture');
      const drawing = root.querySelector('#dof3-drawing');
      const status = root.querySelector('#dof3-status');
      const ns = 'http://www.w3.org/2000/svg';
      const state = {stage: 0, ax: 0, ay: 0, az: 0, longitude: -20, latitude: 20, spin: -40};
      const radius = 2;
      const along = 0.8;
      const circleRadius = 1.3;
      const radians = value => value * Math.PI / 180;
      const add = (a, b) => a.map((v, i) => v + b[i]);
      const scale = (a, s) => a.map(v => v * s);
      const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
      const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
      const append = (tag, attributes, text) => {
        const node = document.createElementNS(ns, tag);
        Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
        if (text !== undefined) node.textContent = text;
        drawing.appendChild(node);
        return node;
      };
      const geometry = () => {
        const theta = radians(state.longitude), phi = radians(state.latitude), gamma = radians(state.spin);
        const A = [state.ax, state.ay, state.az];
        const direction = [Math.cos(phi)*Math.cos(theta), Math.cos(phi)*Math.sin(theta), Math.sin(phi)];
        const tangent = [-Math.sin(theta), Math.cos(theta), 0];
        const normal = cross(direction, tangent);
        const B = add(A, scale(direction, radius));
        const center = add(A, scale(direction, along));
        const circlePoint = angle => add(center, add(scale(tangent, circleRadius*Math.cos(angle)), scale(normal, circleRadius*Math.sin(angle))));
        return {A, B, C: circlePoint(gamma), center, direction, tangent, normal, circlePoint};
      };
      const draw = () => {
        const width = Math.max(260, root.getBoundingClientRect().width || 736);
        const height = Math.max(280, Math.min(340, width * 0.54));
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('height', height);
        drawing.replaceChildren();
        const unit = Math.min((width - 62) / 6.15, (height - 52) / 5.8);
        const ca = Math.cos(radians(40)), sa = Math.sin(radians(40));
        const ce = Math.cos(radians(26)), se = Math.sin(radians(26));
        const project = p => [width * 0.5 + unit * (ca*p[0] - sa*p[1]), height * 0.51 + unit * (se*(sa*p[0]+ca*p[1])-ce*p[2])];
        const pointString = points => points.map(p => project(p).map(v => v.toFixed(2)).join(',')).join(' ');
        const line = (a, b, color, strokeWidth = 1, opacity = 1) => append('polyline', {points: pointString([a,b]), fill: 'none', stroke: color, 'stroke-width': strokeWidth, opacity});
        const curve = (points, color, strokeWidth = 1, opacity = 1) => append('polyline', {points: pointString(points), fill: 'none', stroke: color, 'stroke-width': strokeWidth, opacity});
        const label = (p, text, dx, dy, anchor = 'start') => {
          const xy = project(p);
          return append('text', {x: xy[0]+dx, y: xy[1]+dy, 'text-anchor': anchor, class: 'dof3-label text-small'}, text);
        };
        for (let g = -1.6; g <= 1.61; g += 0.4) {
          line([-1.6,g,-1.4], [1.6,g,-1.4], 'var(--border)', 1, 0.6);
          line([g,-1.6,-1.4], [g,1.6,-1.4], 'var(--border)', 1, 0.6);
        }
        const triad = [-1.65, 1.15, -1.3];
        const axisEnds = [add(triad,[0.55,0,0]), add(triad,[0,0.55,0]), add(triad,[0,0,0.55])];
        axisEnds.forEach((end,i) => {line(triad,end,'var(--muted-foreground)',1.2); label(end,['x','y','z'][i],i===1?-6:5,i===2?-4:4,i===1?'end':'start');});
        const model = geometry();
        const {A, B, C, direction} = model;
        if (state.stage === 1) {
          for (let latitude = -60; latitude <= 60; latitude += 30) {
            const phi = radians(latitude);
            const points = Array.from({length:97},(_,i) => {
              const theta = i * Math.PI*2/96;
              return add(A,[radius*Math.cos(phi)*Math.cos(theta), radius*Math.cos(phi)*Math.sin(theta), radius*Math.sin(phi)]);
            });
            curve(points, 'var(--border)', 1, 0.9);
          }
          for (let longitude = 0; longitude < 180; longitude += 30) {
            const theta = radians(longitude);
            const points = Array.from({length:97},(_,i) => {
              const phi = i * Math.PI*2/96;
              return add(A,[radius*Math.cos(phi)*Math.cos(theta),radius*Math.cos(phi)*Math.sin(theta),radius*Math.sin(phi)]);
            });
            curve(points, 'var(--border)', 1, 0.9);
          }
          append('text',{x:16,y:23,class:'text-small'},'B 的可选位置：球面');
        }
        if (state.stage === 2) {
          const points = Array.from({length:129},(_,i) => model.circlePoint(i*Math.PI*2/128));
          curve(points, 'var(--viz-series-3)', 1.5, 0.7);
          line(add(A,scale(direction,-0.35)), add(B,scale(direction,0.35)), 'var(--muted-foreground)', 1.2, 0.7);
          append('text',{x:16,y:23,class:'text-small'},'C 的可选位置：圆周');
        }
        if (state.stage === 0) append('text',{x:16,y:23,class:'text-small'},'A 的可选位置：三维空间');
        append('polygon',{points:pointString([A,B,C]),fill:'var(--viz-series-1)','fill-opacity':0.15,stroke:'none'});
        line(A,B,'var(--foreground)',2);
        line(A,C,'var(--foreground)',1.5);
        line(B,C,'var(--foreground)',1.5);
        const labeled = [
          {p:A,name:'A',color:'var(--viz-series-1)',fixed:state.stage>0,offset:[-10,19],anchor:'end'},
          {p:B,name:'B',color:'var(--viz-series-2)',fixed:state.stage>1,offset:[10,-10],anchor:'start'},
          {p:C,name:'C',color:'var(--viz-series-3)',fixed:false,offset:[10,19],anchor:'start'}
        ];
        const occupiedLabels = [];
        const overlaps = (a,b) => a.x < b.x+b.width+5 && a.x+a.width+5 > b.x && a.y < b.y+b.height+5 && a.y+a.height+5 > b.y;
        labeled.forEach(({p,name,color,fixed,offset,anchor}) => {
          const xy = project(p);
          if (fixed) append('circle',{cx:xy[0],cy:xy[1],r:8,fill:'var(--background)',stroke:'var(--foreground)','stroke-width':1});
          append('circle',{cx:xy[0],cy:xy[1],r:5,fill:color});
          const textNode = label(p,name+(fixed?' 固定':''),offset[0],offset[1],anchor);
          const positions = [[offset[0],offset[1],anchor],[12,-14,'start'],[-12,-14,'end'],[12,25,'start'],[-12,25,'end'],[0,-29,'middle'],[0,40,'middle']];
          let finalBox;
          for (const [dx,dy,textAnchor] of positions) {
            textNode.setAttribute('x',xy[0]+dx);
            textNode.setAttribute('y',xy[1]+dy);
            textNode.setAttribute('text-anchor',textAnchor);
            let box = textNode.getBBox();
            const shiftX = box.x < 8 ? 8-box.x : box.x+box.width>width-8 ? width-8-box.x-box.width : 0;
            const shiftY = box.y < 36 ? 36-box.y : box.y+box.height>height-32 ? height-32-box.y-box.height : 0;
            textNode.setAttribute('x',Number(textNode.getAttribute('x'))+shiftX);
            textNode.setAttribute('y',Number(textNode.getAttribute('y'))+shiftY);
            box = textNode.getBBox();
            finalBox = {x:box.x,y:box.y,width:box.width,height:box.height};
            if (!occupiedLabels.some(other=>overlaps(finalBox,other))) break;
          }
          occupiedLabels.push(finalBox);
        });
        append('text',{x:16,y:height-10,class:'text-small'},'三条边长度固定 · 视角固定');
        root.dataset.stage = state.stage;
        root.dataset.distances = [distance(A,B), distance(A,C), distance(B,C)].map(value=>value.toFixed(9)).join(',');
        root.dataset.coordinates = JSON.stringify({A,B,C});
      };
      const messages = [
        '本步新增 3 个参数：A 的位置。',
        'A 已固定；本步新增 2 个参数，确定 B 的方向。',
        'A、B 已固定；本步新增 1 个参数，确定 C 绕 AB 的角度。'
      ];
      root.querySelectorAll('[data-dof3-stage]').forEach(button => {
        button.addEventListener('click', () => {
          state.stage = Number(button.dataset.dof3Stage);
          root.querySelectorAll('[data-dof3-stage]').forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.dof3Stage)===state.stage)));
          root.querySelectorAll('[data-dof3-panel]').forEach(panel => {panel.hidden = Number(panel.dataset.dof3Panel)!==state.stage;});
          status.textContent = messages[state.stage];
          draw();
        });
      });
      ['ax','ay','az','longitude','latitude','spin'].forEach(key => {
        const input = root.querySelector('#dof3-'+key);
        const output = root.querySelector('#dof3-'+key+'-value');
        input.addEventListener('input', () => {
          state[key] = Number(input.value);
          output.value = key.startsWith('a') ? Number(input.value).toFixed(2)+' m' : input.value+'°';
          draw();
        });
      });
      const observer = new ResizeObserver(draw);
      observer.observe(root);
      draw();
    })();

/* configuration-space */
(() => {
    const root = document.getElementById('dof-cspace-explorer');
    if (!root || root.dataset.ready === 'true') return;
    const arm = document.getElementById('dof-cspace-arm');
    const torus = document.getElementById('dof-cspace-torus');
    const one = document.getElementById('dof-cspace-angle-one');
    const two = document.getElementById('dof-cspace-angle-two');
    const valueOne = document.getElementById('dof-cspace-value-one');
    const valueTwo = document.getElementById('dof-cspace-value-two');
    const status = document.getElementById('dof-cspace-status');
    const NS = 'http://www.w3.org/2000/svg';
    const TAU = Math.PI * 2;
    const state = { one: 40, two: 60, hidden: false };
    const neutral = 'var(--border)';
    const foreground = 'var(--foreground)';
    const seriesOne = 'var(--viz-series-1)';
    const seriesTwo = 'var(--viz-series-2)';
    let pendingFrame = 0;

    function el(tag, attrs, parent, text) {
      const node = document.createElementNS(NS, tag);
      Object.entries(attrs || {}).forEach(([key, val]) => node.setAttribute(key, String(val)));
      if (text !== undefined) node.textContent = text;
      if (parent) parent.appendChild(node);
      return node;
    }

    function initSvg(svg, title) {
      const width = Math.max(1, svg.parentElement.getBoundingClientRect().width);
      const height = Math.min(324, Math.max(270, width * 0.9));
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('height', height);
      svg.replaceChildren();
      el('title', {}, svg, title);
      return { width, height };
    }

    function line(parent, a, b, stroke, width = 1, extra = {}) {
      return el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke, 'stroke-width': width, ...extra }, parent);
    }

    function placeLabels(svg, labels, points, width, height) {
      const used = [];
      labels.forEach((item) => {
        const candidates = [[13,-17],[13,24],[-13,-17],[-13,24],[0,-29],[0,35],[21,4],[-21,4]];
        let chosen;
        let best = Infinity;
        const node = el('text', { class: 'direct-label' }, svg, item.text);
        candidates.forEach(([dx,dy]) => {
          const anchor = dx < 0 ? 'end' : dx > 0 ? 'start' : 'middle';
          node.setAttribute('x', item.point[0] + dx);
          node.setAttribute('y', item.point[1] + dy);
          node.setAttribute('text-anchor', anchor);
          const box = node.getBBox();
          const rect = { x:box.x-3, y:box.y-3, w:box.width+6, h:box.height+6 };
          const outside = Math.max(0, 6-rect.x) + Math.max(0, rect.x+rect.w-width+6) + Math.max(0, 6-rect.y) + Math.max(0, rect.y+rect.h-height+6);
          const overlap = used.reduce((sum, b) => sum + Math.max(0,Math.min(rect.x+rect.w,b.x+b.w)-Math.max(rect.x,b.x))*Math.max(0,Math.min(rect.y+rect.h,b.y+b.h)-Math.max(rect.y,b.y)), 0);
          const hits = points.reduce((sum, p) => sum + (p[0]>=rect.x-5 && p[0]<=rect.x+rect.w+5 && p[1]>=rect.y-5 && p[1]<=rect.y+rect.h+5 ? 1 : 0), 0);
          const score = outside*100 + overlap + hits*100 + Math.abs(dx)*0.02 + Math.abs(dy)*0.02;
          if (score < best) { best = score; chosen = { x: item.point[0]+dx, y:item.point[1]+dy, anchor, rect }; }
        });
        node.setAttribute('x', chosen.x);
        node.setAttribute('y', chosen.y);
        node.setAttribute('text-anchor', chosen.anchor);
        used.push(chosen.rect);
      });
    }

    function drawArm() {
      const { width:w, height:h } = initSvg(arm, `机械臂构型：关节1为${state.one}度，关节2为${state.two}度。`);
      const scale = Math.min((w-96)/3.5, (h-90)/3.5);
      const center = [w/2, h/2];
      const a = state.one * Math.PI / 180;
      const b = state.two * Math.PI / 180;
      const l1 = 1;
      const l2 = 0.75;
      const elbow = [center[0]+scale*l1*Math.cos(a), center[1]-scale*l1*Math.sin(a)];
      const tip = [elbow[0]+scale*l2*Math.cos(a+b), elbow[1]-scale*l2*Math.sin(a+b)];
      line(arm, [24,center[1]], [w-24,center[1]], neutral);
      line(arm, [center[0],24], [center[0],h-24], neutral);
      el('circle', { cx:center[0], cy:center[1], r:scale*(l1+l2), fill:'none', stroke:neutral, 'stroke-width':1, opacity:0.55 }, arm);
      line(arm, center, elbow, seriesOne, 8, {'stroke-linecap':'round'});
      line(arm, elbow, tip, seriesTwo, 8, {'stroke-linecap':'round'});
      el('circle', { cx:center[0],cy:center[1],r:7,fill:'var(--background)',stroke:foreground,'stroke-width':2 }, arm);
      el('circle', { cx:elbow[0],cy:elbow[1],r:6,fill:'var(--background)',stroke:seriesTwo,'stroke-width':2.5 }, arm);
      el('circle', { cx:tip[0],cy:tip[1],r:5,fill:foreground }, arm);
      placeLabels(arm, [
        {text:'关节 1',point:center},
        {text:'关节 2',point:elbow},
        {text:'末端',point:tip}
      ], [center,elbow,tip], w,h);
      root.dataset.endpoint = `${((tip[0]-center[0])/scale).toFixed(5)},${((center[1]-tip[1])/scale).toFixed(5)}`;
    }

    function torusPoint(u,v) {
      const radius = 1.65 + 0.61*Math.cos(v);
      return [radius*Math.cos(u),radius*Math.sin(u),0.61*Math.sin(v)];
    }

    function drawTorus() {
      const { width:w, height:h } = initSvg(torus, `构型空间上的当前点，对应两个关节角${state.one}度和${state.two}度。`);
      const scale = Math.min((w-40)/4.7, (h-60)/3.65);
      const yaw = -0.5;
      const tilt = 0.64;
      const cy = Math.cos(yaw), sy=Math.sin(yaw), ct=Math.cos(tilt), st=Math.sin(tilt);
      const project = p => {
        const xx=cy*p[0]-sy*p[1], yy=sy*p[0]+cy*p[1];
        return [w/2+scale*xx,h/2+scale*(st*yy-ct*p[2]),ct*yy+st*p[2]];
      };
      const NU=48, NV=24;
      const vertices = Array.from({length:NU},(_,i)=>Array.from({length:NV},(_,j)=>project(torusPoint(i/NU*TAU,j/NV*TAU))));
      const faces=[];
      for(let i=0;i<NU;i++) for(let j=0;j<NV;j++) {
        const ps=[vertices[i][j],vertices[(i+1)%NU][j],vertices[(i+1)%NU][(j+1)%NV],vertices[i][(j+1)%NV]];
        const u=(i+0.5)/NU*TAU, v=(j+0.5)/NV*TAU;
        const normal=[Math.cos(u)*Math.cos(v),Math.sin(u)*Math.cos(v),Math.sin(v)];
        const light=0.5+0.5*(0.25*normal[0]-0.35*normal[1]+0.78*normal[2]);
        faces.push({ps,depth:ps.reduce((s,p)=>s+p[2],0)/4,shade:Math.round(8+light*16),bounds:[Math.min(...ps.map(p=>p[0])),Math.max(...ps.map(p=>p[0])),Math.min(...ps.map(p=>p[1])),Math.max(...ps.map(p=>p[1]))]});
      }
      faces.sort((a,b)=>a.depth-b.depth);
      faces.forEach(face=>el('polygon', {
        points:face.ps.map(p=>`${p[0]},${p[1]}`).join(' '),
        fill:`color-mix(in srgb, var(--foreground) ${face.shade}%, var(--background))`,
        stroke:`color-mix(in srgb, var(--foreground) ${face.shade}%, var(--background))`,
        'stroke-width':0.45
      }, torus));

      const depthAt = (x,y) => {
        let max=-Infinity;
        const triDepth=(a,b,c)=> {
          const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
          if(Math.abs(den)<1e-9)return;
          const aa=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den;
          const bb=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;
          const cc=1-aa-bb;
          if(aa>=-0.005&&bb>=-0.005&&cc>=-0.005) max=Math.max(max,aa*a[2]+bb*b[2]+cc*c[2]);
        };
        faces.forEach(f=>{if(x<f.bounds[0]-0.2||x>f.bounds[1]+0.2||y<f.bounds[2]-0.2||y>f.bounds[3]+0.2)return;triDepth(f.ps[0],f.ps[1],f.ps[2]);triDepth(f.ps[0],f.ps[2],f.ps[3]);});
        return max;
      };
      function drawCurve(kind,angle,color) {
        const points=Array.from({length:121},(_,i)=>project(torusPoint(kind==='major'?i/120*TAU:angle,kind==='major'?angle:i/120*TAU)));
        for(let i=0;i<points.length-1;i++) {
          const p=points[i],q=points[i+1],mid=[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2];
          const hidden=mid[2]<depthAt(mid[0],mid[1])-0.025;
          line(torus,p,q,color,hidden?1:2,{opacity:hidden?0.2:0.88});
        }
      }
      const u=state.one/180*Math.PI, v=state.two/180*Math.PI;
      drawCurve('major',v,seriesOne);
      drawCurve('minor',u,seriesTwo);
      const p=project(torusPoint(u,v));
      state.hidden = p[2] < depthAt(p[0],p[1])-0.025;
      el('circle', { cx:p[0],cy:p[1],r:7,fill:state.hidden?'var(--background)':seriesOne,stroke:state.hidden?seriesOne:'var(--background)','stroke-width':2.5 }, torus);
      if(state.hidden) el('circle',{cx:p[0],cy:p[1],r:2,fill:seriesOne},torus);
      const anchor=p[0]>w*0.6?'end':'start';
      const tx=anchor==='end'?p[0]-12:p[0]+12;
      el('text',{x:tx,y:p[1]-13,'text-anchor':anchor,class:'direct-label'},torus,'当前组合');
      root.dataset.torusPoint=torusPoint(u,v).map(n=>n.toFixed(5)).join(',');
    }

    function draw() {
      pendingFrame=0;
      drawArm();
      drawTorus();
    }
    function queueDraw() {
      if(!pendingFrame) pendingFrame=requestAnimationFrame(draw);
    }
    function update(announce) {
      state.one=Number(one.value);
      state.two=Number(two.value);
      valueOne.value=`${state.one}°`;
      valueTwo.value=`${state.two}°`;
      one.setAttribute('aria-valuetext',`${state.one}度`);
      two.setAttribute('aria-valuetext',`${state.two}度`);
      root.dataset.angles=`${state.one},${state.two}`;
      draw();
      if(announce) status.textContent=state.hidden?'两个独立角度 · 空心标记为背面的当前组合':'两个独立角度 · 一个点对应一种摆法';
    }
    [one,two].forEach(input=>{
      input.addEventListener('input',()=>update(false));
      input.addEventListener('change',()=>update(true));
    });
    const observer=new ResizeObserver(queueDraw);
    observer.observe(root);
    root.dataset.ready='true';
    update(false);
  })();
