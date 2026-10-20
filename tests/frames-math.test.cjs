const assert = require('node:assert/strict');
const M = require('../assets/frames.js');
const epsilon = 1e-12;
let checks = 0;
function close(actual, expected, name) {
  const a = actual.flat(Infinity), b = expected.flat(Infinity);
  assert.equal(a.length,b.length,name+' size');
  for(let i=0;i<a.length;i++) assert.ok(Math.abs(a[i]-b[i])<epsilon,name+' at '+i+': '+a[i]+' vs '+b[i]);
  checks++;
}

close(M.multiplyVector(M.Rz(M.rad(90)),[1,0,0]),[0,1,0],'positive right-hand z rotation');
close(M.multiplyVector(M.Rx(M.rad(90)),[0,1,0]),[0,0,1],'positive right-hand x rotation');
close(M.multiplyVector(M.Ry(M.rad(90)),[0,0,1]),[1,0,0],'positive right-hand y rotation');
close(M.multiplyVector(M.Rz(M.rad(90)),[1,.5,0]),[-.5,1,0],'active rotation moves world point');
close(M.multiplyVector(M.transpose(M.Rz(M.rad(90))),[1,.5,0]),[.5,-1,0],'passive coordinates of fixed world point');

for(const roll of [-170,-35,0,47,160]) {
  for(const pitch of [-80,-20,0,65,80]) {
    for(const yaw of [-180,-30,0,90,175]) {
      const R=M.euler(roll,pitch,yaw);
      close(M.multiply(M.transpose(R),R),M.identity(3),'orthonormal columns');
      close([M.determinant(R)],[1],'right-handed determinant');
      const v=[.7,-.2,1.3];
      close([M.norm(M.multiplyVector(R,v))],[M.norm(v)],'rotation preserves norm');
      const t=[.8,-.5,1.2],T=M.makeTransform(R,t),Ti=M.invertTransform(T);
      close(M.multiply(Ti,T),M.identity(4),'homogeneous inverse');
      close(M.transformPoint(Ti,M.transformPoint(T,v)),v,'point round trip');
    }
  }
}

const Tc=M.makeTransform(M.Rz(M.rad(90)),[1,2,3]);
close(M.transformPoint(Tc,[.7,.35,.5]),[.65,2.7,3.5],'rotate then translate numeric reference');
const Twb=M.makeTransform(M.Rz(M.rad(90)),[1,0,0]);
const Tbc=M.makeTransform(M.Rz(M.rad(-30)),[.7,.2,.65]);
const Twc=M.multiply(Twb,Tbc);
close(Twc,M.makeTransform(M.Rz(M.rad(60)),[.8,.7,.65]),'known chain matrix');
close(M.transformPoint(Twc,[.7,.35,.5]),M.transformPoint(Twb,M.transformPoint(Tbc,[.7,.35,.5])),'chain point composition');
assert.ok(M.maxDifference(M.multiply(Twb,Tbc),M.multiply(Tbc,Twb))>.1,'chain multiplication is order-sensitive');
checks++;
console.log('frames-math: '+checks+' checks passed (90° axes, active/passive, SO(3), inverse, chain).');
