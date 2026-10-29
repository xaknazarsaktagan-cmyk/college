// 3D сахна: кітаптар стегі + бітіруші қалпағы (таза CSS 3D, кітапхана қажет емес)
(function(){
const root=document.getElementById("scene");
if(!root)return;
const D=Math.PI/180,reduce=matchMedia("(prefers-reduced-motion:reduce)");
const faces=[];

function el(cls,css,parent){
  const e=document.createElement("div");
  if(cls)e.className=cls;
  if(css)e.style.cssText=css;
  if(parent)parent.appendChild(e);
  return e;
}
function group(parent,cls,x,y,z){return el(cls,`transform:translate3d(${x}px,${y}px,${z}px)`,parent)}

function box(parent,o){
  const w=o.w,h=o.h,d=o.d,ry=o.ry||0,s=o.s||{};
  const b=el("bx",`width:${w}px;height:${h}px;margin:${-h/2}px 0 0 ${-w/2}px;transform:translate3d(${o.x||0}px,${o.y||0}px,${o.z||0}px) rotateY(${ry}deg)`,parent);
  const F={
    front:[w,h,0,0,`translateZ(${d/2}px)`,[0,0,1]],
    back:[w,h,0,0,`rotateY(180deg) translateZ(${d/2}px)`,[0,0,-1]],
    right:[d,h,(w-d)/2,0,`rotateY(90deg) translateZ(${w/2}px)`,[1,0,0]],
    left:[d,h,(w-d)/2,0,`rotateY(-90deg) translateZ(${w/2}px)`,[-1,0,0]],
    top:[w,d,0,(h-d)/2,`rotateX(90deg) translateZ(${h/2}px)`,[0,-1,0]],
    bottom:[w,d,0,(h-d)/2,`rotateX(-90deg) translateZ(${h/2}px)`,[0,1,0]]
  };
  for(const k in F){
    const f=F[k],css=(s[k]!==undefined?s[k]:s.all)||"";
    const e=el("fc"+(k==="front"&&o.label?" sp":""),`width:${f[0]}px;height:${f[1]}px;left:${f[2]}px;top:${f[3]}px;transform:${f[4]};${css}`,b);
    if(k==="front"&&o.label)e.textContent=o.label;
    faces.push({e:e,n:f[5],yaw:ry,v:-1});
  }
  return b;
}
function panel(parent,w,h,a,R,css){
  const e=el("fc",`width:${w}px;height:${h}px;margin:${-h/2}px 0 0 ${-w/2}px;transform:rotateY(${a}deg) translateZ(${R}px);${css}`,parent);
  faces.push({e:e,n:[Math.sin(a*D),0,Math.cos(a*D)],yaw:0,v:-1});
}

const GOLD="linear-gradient(180deg,#f2c85c,#c7921f)";
const THREAD="repeating-linear-gradient(90deg,#ebb941 0 2px,#b98720 2px 3.5px)";
function pages(c){
  return `background:linear-gradient(${c},${c}) top/100% 5px no-repeat,linear-gradient(${c},${c}) bottom/100% 5px no-repeat,repeating-linear-gradient(0deg,#f4ecd6 0 2px,#ddd2b4 2px 3px)`;
}
function spine(c){
  return `background:linear-gradient(90deg,transparent 0 12px,#e3b552 12px 14px,transparent 14px calc(100% - 14px),#e3b552 calc(100% - 14px) calc(100% - 12px),transparent calc(100% - 12px)),linear-gradient(180deg,rgba(255,255,255,.14),rgba(0,0,0,.14)),${c}`;
}
function cover(c){return `background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(0,0,0,.14)),${c}`}
function book(o){
  box(root,{w:o.w,h:o.h,d:o.d,y:o.y,ry:o.ry,label:o.label,
    s:{front:spine(o.c),back:pages(o.c),left:pages(o.c),right:pages(o.c),top:cover(o.c),bottom:cover(o.c)}});
}

el("sh","",root);
book({w:270,h:40,d:196,y:-20, ry:0,  c:"#c90035",label:tr("book1")});
book({w:250,h:34,d:180,y:-57, ry:11, c:"#353139",label:tr("book2")});
book({w:230,h:30,d:168,y:-89, ry:-8, c:"#96969e",label:tr("book3")});

addEventListener("abit-lang",()=>root.querySelectorAll(".fc.sp").forEach((e,i)=>{e.textContent=tr("book"+(i+1))}));

const cap=group(root,"cap",0,0,0);
const crown=group(cap,"",0,-132.5,0);
for(let i=0;i<8;i++)panel(crown,51,57,i*45,60,"background:linear-gradient(180deg,#48484f,#242428)");

const navy="background:#303035";
box(cap,{w:230,h:9,d:230,y:-162.5,ry:45,s:{
  all:navy,bottom:"background:#19191c",
  top:"background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.045) 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,rgba(0,0,0,.07) 0 2px,transparent 2px 5px);background-color:#414148"}});
box(cap,{w:14,h:7,d:14,y:-170.5,s:{all:"background:"+GOLD}});
box(cap,{w:158,h:3,d:3,x:79,y:-168.5,s:{all:"background:"+GOLD}});

const tas=group(cap,"tas",0,0,0);
box(tas,{w:3,h:50,d:3,y:25,s:{all:"background:"+GOLD}});
box(tas,{w:9,h:7,d:9,y:53.5,s:{all:"background:"+GOLD}});
box(tas,{w:13,h:30,d:13,y:72,s:{all:"background:"+THREAD,top:"background:"+GOLD,bottom:"background:#b98720"}});

const L=[-.482,-.701,.526];
function shade(Y,X){
  const cY=Math.cos(Y*D),sY=Math.sin(Y*D),cX=Math.cos(X*D),sX=Math.sin(X*D);
  for(const f of faces){
    const b=f.yaw*D,cb=Math.cos(b),sb=Math.sin(b);
    const x1=f.n[0]*cb+f.n[2]*sb,z1=-f.n[0]*sb+f.n[2]*cb,y1=f.n[1];
    const x2=x1*cY+z1*sY,z2=-x1*sY+z1*cY;
    const y3=y1*cX-z2*sX,z3=y1*sX+z2*cX;
    const lit=Math.max(0,x2*L[0]+y3*L[1]+z3*L[2]);
    const v=Math.round((.02+.44*(1-lit))*100)/100;
    if(v!==f.v){f.v=v;f.e.style.setProperty("--s",v)}
  }
}

const spin=root.dataset.spin==="1";
let px=0,py=0,cx=0,cy=0;
addEventListener("pointermove",e=>{px=e.clientX/innerWidth-.5;py=e.clientY/innerHeight-.5},{passive:true});
function render(t){
  const sway=reduce.matches?0:Math.sin(t/2600)*36;
  cx+=(px-cx)*.06;cy+=(py-cy)*.06;
  // data-spin="1": басты бетте толық 360° үздіксіз айналады (≈24 сек / айналым)
  const Y=spin?(-30+(t*.015)%360+cx*20):(-30+sway+cx*26),X=-19+cy*7;
  root.style.transform=`rotateX(${X}deg) rotateY(${Y}deg)`;
  shade(Y,X);
}
function loop(t){
  if(root.offsetParent!==null)render(t);
  requestAnimationFrame(loop);
}
render(0);
if(!reduce.matches)requestAnimationFrame(loop);
addEventListener("abit-login-ok",()=>{if(!reduce.matches)cap.classList.add("toss")});
})();
