import{a as me,f as ge}from"../chunks/Cr208-j7.js";import"../chunks/5MLvTHux.js";import{o as be}from"../chunks/DMX1FUzG.js";import{z as ye,s as ve,t as we,H as xe,a2 as R,C as ke,Z as W,az as V,ay as G,a1 as Ee,Y as Ce,N as ae,aL as ie,ao as Se,F as se,at as Fe,w as Pe,aO as $e,aN as q,as as Z,ar as Ae,W as Y,J as _e,al as Te,aJ as Ne,ai as Ie,$ as Le,u as F,aC as N,ap as P,af as He,ae as Oe,au as Q}from"../chunks/DxEMXgkL.js";import{e as M,s as ee}from"../chunks/B7UPCQzy.js";import{_ as De,s as je,a as Re}from"../chunks/4zZ_TcYv.js";function Me(e,n){let t=null,r=R;var a;if(R){t=Ee;for(var o=Ce(document.head);o!==null&&(o.nodeType!==ke||o.data!==e);)o=W(o);if(o===null)V(!1);else{var i=W(o);o.remove(),G(i)}}R||(a=document.head.appendChild(ye()));try{ve(()=>{var s=we(()=>n(a));s.f|=xe})}finally{r&&(V(!0),G(t))}}function Ue(e,n,t){ae(()=>{var r=ie(()=>n(e,t==null?void 0:t())||{});if(t&&(r!=null&&r.update)){var a=!1,o={};Se(()=>{var i=t();se(i),a&&Fe(o,i)&&(o=i,r.update(i))}),a=!0}if(r!=null&&r.destroy)return()=>r.destroy()})}function Ye(e){return function(...n){var t=n[0];return t.preventDefault(),e==null?void 0:e.apply(this,n)}}function Ke(e=!1){const n=Pe,t=n.l.u;if(!t)return;let r=()=>se(n.s);if(e){let a=0,o={};const i=_e(()=>{let s=!1;const c=n.s;for(const d in c)c[d]!==o[d]&&(o[d]=c[d],s=!0);return s&&a++,a});r=()=>Y(i)}t.b.length&&$e(()=>{te(n,r),Z(t.b)}),q(()=>{const a=ie(()=>t.m.map(Ae));return()=>{for(const o of a)typeof o=="function"&&o()}}),t.a.length&&q(()=>{te(n,r),Z(t.a)})}function te(e,n){if(e.l.s)for(const t of e.l.s)Y(t);n()}var Be=Object.defineProperty,Xe=(e,n,t)=>n in e?Be(e,n,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[n]=t,y=(e,n,t)=>Xe(e,typeof n!="symbol"?n+"":n,t);function ze(e,n,t){const r=e.getBoundingClientRect(),a=r.width||1,o=r.height||1,i=ne((n-r.left)/a),s=ne((t-r.top)/o),c=Math.round(n+window.scrollX),d=Math.round(t+window.scrollY);return{xPercent:i,yPercent:s,xPx:c,yPx:d}}function Je(){return{width:window.innerWidth,height:window.innerHeight,devicePixelRatio:window.devicePixelRatio||1}}function We(e,n){if(e){const t=e.getBoundingClientRect();return{x:t.left+window.scrollX+t.width*n.xPercent,y:t.top+window.scrollY+t.height*n.yPercent,orphaned:!1}}return{x:n.xPx,y:n.yPx,orphaned:!0}}function ne(e){return Number.isNaN(e)||e<0?0:e>1?1:e}var Ve="iwkapps-fb-author:";function le(e){return`${Ve}${e}`}function ce(){try{return typeof localStorage>"u"?null:localStorage}catch{return null}}function Ge(e){const n=ce();if(!n)return null;try{const t=n.getItem(le(e));if(!t)return null;const r=JSON.parse(t);if(typeof r=="object"&&r!==null&&"name"in r&&typeof r.name=="string"){const a=r.name.trim();if(a.length===0)return null;const o=r.email,i=typeof o=="string"?o.trim():"";return i.length>0?{name:a,email:i}:{name:a}}return null}catch{return null}}function qe(e,n){const t=ce();if(t)try{t.setItem(le(e),JSON.stringify(n))}catch{}}var Ze=5;function Qe(e){return!(e.length===0||e.length>64||/[0-9a-f]{8,}/i.test(e)||/[\s"'<>`]/.test(e))}function et(e){return!(e.length===0||e.length>48||/[0-9a-f]{6,}/i.test(e)||/[:[\]]/.test(e)||/^(sm|md|lg|xl|2xl|hover|focus|active|dark)-/.test(e))}function tt(e){let n=e;for(;n&&n!==document.documentElement;){const t=n.getAttribute("data-feedback-id");if(t&&t.length>0)return{id:t,node:n};n=n.parentElement}return null}function nt(e){return e.length===0||e.length>96?!1:/^[A-Za-z0-9_.:\-]+$/.test(e)}function rt(e){const n=Array.from(e.classList);for(const t of n)if(et(t))return t;return null}function ot(e){const n=e.parentElement;if(!n)return 1;let t=0;for(const r of Array.from(n.children))if(r.tagName===e.tagName&&(t++,r===e))return t;return t}function at(e){const n=e.tagName.toLowerCase(),t=e.parentElement;return!t||Array.from(t.children).filter(a=>a.tagName===e.tagName).length===1?n:`${n}:nth-of-type(${ot(e)})`}function it(e){const n=[];let t=e,r=0;for(;t&&t!==document.body&&t!==document.documentElement&&r<Ze;)n.unshift(at(t)),t=t.parentElement,r++;return n.join(" > ")}function st(e){if(!(e instanceof Element))throw new TypeError("resolveSelector: target must be an Element");const n=tt(e);if(n&&nt(n.id))return`[data-feedback-id="${n.id}"]`;const t=e.id;if(t&&Qe(t))return`#${CSS.escape(t)}`;const r=it(e);if(r.length>0)return r;const a=e.tagName.toLowerCase(),o=rt(e);return o?`${a}.${CSS.escape(o)}`:a}function de(e,n=document){if(typeof e!="string"||e.length===0)return null;try{return n.querySelector(e)}catch{return null}}var re=18,$=8,lt=class{constructor(e){y(this,"layer"),y(this,"current",null),this.layer=e}isOpen(){return this.current!==null}ownsEvent(e){return this.current?e.composedPath().includes(this.current.el):!1}hide(){this.current&&(this.current.el.remove(),this.current=null)}showComposer(e,n){this.hide();const t=this.buildComposer(n);return this.layer.appendChild(t),this.current={type:"composer",el:t,pageX:e.pageX,pageY:e.pageY},this.repositionInternal(),queueMicrotask(()=>{const r=t.querySelector("textarea, input");r==null||r.focus()}),t}showThread(e,n,t){this.hide();const r=this.buildThread(e,t);return this.layer.appendChild(r),this.current={type:"thread",el:r,pageX:n.pageX,pageY:n.pageY},this.repositionInternal(),r}reposition(e){this.current&&(e&&(this.current.pageX=e.pageX,this.current.pageY=e.pageY),this.repositionInternal())}repositionInternal(){if(!this.current)return;const e=this.current.pageX-window.scrollX,n=this.current.pageY-window.scrollY;this.applyPosition(this.current.el,e,n)}applyPosition(e,n,t){const r=window.innerWidth,a=window.innerHeight,o=e.getBoundingClientRect(),i=o.width||320,s=o.height||200;let c=n+re;c+i>r-$&&(c=n-re-i),c<$&&(c=$);let d=t;d+s>a-$&&(d=a-s-$),d<$&&(d=$),e.style.left=`${c}px`,e.style.top=`${d}px`}buildComposer(e){const n=this.makeShell("New comment",()=>e.onCancel()),t=n.querySelector(".popover-body"),r=this.buildIdentityFields(e.initialAuthor);t.appendChild(r.el);const a=document.createElement("textarea");a.className="popover-textarea",a.placeholder="Describe what you see...",a.rows=4,t.appendChild(a);const o=document.createElement("div");o.className="popover-actions";const i=document.createElement("button");i.type="button",i.className="btn btn-ghost",i.textContent="Cancel",i.addEventListener("click",()=>e.onCancel());const s=document.createElement("button");return s.type="button",s.className="btn btn-primary popover-submit",s.textContent="Send",s.addEventListener("click",async()=>{const c=a.value.trim();if(c.length===0){a.focus();return}const d=r.read();if(d){s.disabled=!0;try{await e.onSubmit(c,d)}finally{s.disabled=!1}}}),o.appendChild(i),o.appendChild(s),t.appendChild(o),n}buildThread(e,n){const t=`Status: ${e.status}`,r=this.makeShell(t,()=>n.onClose());r.classList.add("popover-thread"),r.dataset.status=e.status;const a=r.querySelector(".popover-body"),o=document.createElement("div");o.className="popover-toolbar";const i=ct(e.status);for(const h of i){const p=document.createElement("button");p.type="button",p.className="btn btn-toolbar",p.dataset.status=h,p.textContent=dt(h),p.addEventListener("click",()=>{n.onStatus(h)}),o.appendChild(p)}a.appendChild(o);const s=document.createElement("ul");if(s.className="popover-thread-list",e.thread.length===0){const h=document.createElement("li");h.className="popover-empty",h.textContent="No comments yet.",s.appendChild(h)}else for(const h of e.thread){const p=document.createElement("li");p.className="popover-comment";const w=document.createElement("div");w.className="popover-comment-meta",w.textContent=h.author.name;const E=document.createElement("div");E.className="popover-comment-body",E.textContent=h.body,p.appendChild(w),p.appendChild(E),s.appendChild(p)}a.appendChild(s);const c=this.buildIdentityFields(n.initialAuthor);a.appendChild(c.el);const d=document.createElement("textarea");d.className="popover-textarea",d.placeholder="Reply...",d.rows=3,a.appendChild(d);const v=document.createElement("div");v.className="popover-actions";const m=document.createElement("button");return m.type="button",m.className="btn btn-primary popover-submit",m.textContent="Reply",m.addEventListener("click",async()=>{const h=d.value.trim();if(h.length===0){d.focus();return}const p=c.read();if(p){m.disabled=!0;try{await n.onReply(h,p)}finally{m.disabled=!1}}}),v.appendChild(m),a.appendChild(v),r}makeShell(e,n){const t=document.createElement("div");t.className="popover",t.setAttribute("role","dialog"),t.setAttribute("aria-label",e);const r=document.createElement("div");r.className="popover-header";const a=document.createElement("span");a.className="popover-title",a.textContent=e,r.appendChild(a);const o=document.createElement("button");o.type="button",o.className="popover-close",o.setAttribute("aria-label","Close"),o.textContent="×",o.addEventListener("click",()=>n()),r.appendChild(o),t.appendChild(r);const i=document.createElement("div");return i.className="popover-body",t.appendChild(i),t}buildIdentityFields(e){const n=document.createElement("div");n.className="popover-identity";const t=document.createElement("input");t.type="text",t.placeholder="Your name",t.className="popover-input popover-name",t.required=!0,t.autocomplete="name";const r=document.createElement("input");return r.type="email",r.placeholder="Email (optional)",r.className="popover-input popover-email",r.autocomplete="email",e&&(t.value=e.name,e.email&&(r.value=e.email)),n.appendChild(t),n.appendChild(r),{el:n,read(){const a=t.value.trim();if(a.length===0)return t.focus(),null;const o=r.value.trim();return o.length>0?{name:a,email:o}:{name:a}}}}};function ct(e){switch(e){case"open":return["resolved","archived"];case"resolved":return["open","archived"];case"archived":return["open"]}}function dt(e){switch(e){case"open":return"Reopen";case"resolved":return"Resolve";case"archived":return"Archive"}}var pt="data-iwkapps-feedback-host",ut=`
:host { all: initial; }

.layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.highlight {
  position: fixed;
  border: 2px solid #1F5132;
  background: rgba(31, 81, 50, 0.08);
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.6) inset;
  transition: top 60ms linear, left 60ms linear, width 60ms linear, height 60ms linear;
  display: none;
  pointer-events: none;
  z-index: 1;
}

.hud {
  position: fixed;
  padding: 6px 10px;
  background: #1F5132;
  color: #F5FFF8;
  font: 500 12px/1.2 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  border-radius: 4px;
  pointer-events: none;
  display: none;
  z-index: 2;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pin {
  position: fixed;
  width: 28px;
  height: 28px;
  margin-left: -14px;
  margin-top: -28px;
  background: #1F5132;
  color: #F5FFF8;
  border: 2px solid #F5FFF8;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  font: 600 11px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  transition: transform 80ms ease;
  z-index: 3;
}
.pin:hover { transform: rotate(-45deg) scale(1.08); }
.pin > span { transform: rotate(45deg); }
.pin.orphaned { opacity: 0.55; filter: grayscale(0.4); }
.pin.resolved { background: #2F7A4D; }
.pin.archived { background: #6B7280; }

.popover-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}

.popover {
  position: fixed;
  width: 320px;
  max-height: min(70vh, 520px);
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  color: #111827;
  border: 1px solid rgba(31, 81, 50, 0.18);
  border-radius: 10px;
  box-shadow: 0 18px 36px -12px rgba(15, 35, 24, 0.32),
              0 4px 8px -2px rgba(15, 35, 24, 0.16);
  font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  pointer-events: auto;
  overflow: hidden;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #1F5132;
  color: #F5FFF8;
}
.popover-title {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.01em;
  text-transform: capitalize;
}
.popover-close {
  background: transparent;
  color: inherit;
  border: 0;
  font-size: 18px;
  line-height: 1;
  padding: 2px 6px;
  cursor: pointer;
  border-radius: 4px;
}
.popover-close:hover { background: rgba(255,255,255,0.15); }

.popover-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.popover-toolbar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.popover-thread-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.popover-comment {
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 8px 10px;
  background: #F9FAFB;
}
.popover-comment-meta {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 2px;
}
.popover-comment-body { white-space: pre-wrap; word-break: break-word; }
.popover-empty {
  font-size: 12px;
  color: #6B7280;
  font-style: italic;
}

.popover-identity {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.popover-input,
.popover-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  font: inherit;
  color: inherit;
  background: #FFFFFF;
  resize: vertical;
}
.popover-input:focus,
.popover-textarea:focus {
  outline: none;
  border-color: #1F5132;
  box-shadow: 0 0 0 3px rgba(31, 81, 50, 0.15);
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  font: 600 13px/1 inherit;
  cursor: pointer;
}
.btn[disabled] { opacity: 0.6; cursor: not-allowed; }
.btn-primary {
  background: #1F5132;
  color: #F5FFF8;
}
.btn-primary:hover { background: #295F3D; }
.btn-ghost {
  background: transparent;
  color: #1F5132;
  border-color: rgba(31, 81, 50, 0.3);
}
.btn-ghost:hover { background: rgba(31, 81, 50, 0.05); }
.btn-toolbar {
  background: rgba(31, 81, 50, 0.08);
  color: #1F5132;
  border-color: rgba(31, 81, 50, 0.18);
  font-weight: 500;
  font-size: 12px;
  padding: 5px 10px;
}
.btn-toolbar:hover { background: rgba(31, 81, 50, 0.16); }

@media (prefers-color-scheme: dark) {
  .popover {
    background: #0F1F17;
    color: #E5F2EB;
    border-color: rgba(120, 200, 160, 0.22);
  }
  .popover-comment {
    background: #102A20;
    border-color: rgba(120, 200, 160, 0.18);
  }
  .popover-comment-meta { color: #B6D8C5; }
  .popover-empty { color: #94B3A4; }
  .popover-input,
  .popover-textarea {
    background: #102A20;
    color: inherit;
    border-color: rgba(120, 200, 160, 0.22);
  }
  .btn-ghost { color: #B6D8C5; border-color: rgba(120, 200, 160, 0.3); }
  .btn-ghost:hover { background: rgba(120, 200, 160, 0.08); }
  .btn-toolbar {
    background: rgba(120, 200, 160, 0.12);
    color: #B6D8C5;
    border-color: rgba(120, 200, 160, 0.22);
  }
  .btn-toolbar:hover { background: rgba(120, 200, 160, 0.2); }
}
`,ht=class{constructor(){y(this,"host"),y(this,"root"),y(this,"highlight"),y(this,"hud"),y(this,"pinLayer"),y(this,"popoverLayer"),y(this,"popover"),y(this,"rafHandle",null),y(this,"pendingFeedback",[]),y(this,"onPinClick",null),this.host=document.createElement("div"),this.host.setAttribute(pt,""),this.host.style.cssText=["position: fixed","inset: 0","width: 0","height: 0","pointer-events: none","z-index: 2147483647"].join(";"),document.body.appendChild(this.host),this.root=this.host.attachShadow({mode:"open"});const e=document.createElement("style");e.textContent=ut,this.root.appendChild(e),this.pinLayer=H("pinLayer"),this.highlight=H("highlight","div"),this.hud=H("hud","div"),this.popoverLayer=H("popover-layer"),this.root.append(this.pinLayer,this.highlight,this.hud,this.popoverLayer),this.popover=new lt(this.popoverLayer)}setEnabledStyles(e){e||(this.hideHighlight(),this.hideHud())}showHighlight(e){const n=e.getBoundingClientRect();this.highlight.style.display="block",this.highlight.style.left=`${n.left}px`,this.highlight.style.top=`${n.top}px`,this.highlight.style.width=`${n.width}px`,this.highlight.style.height=`${n.height}px`}hideHighlight(){this.highlight.style.display="none"}showHud(e){const n=e.tagName.toLowerCase(),t=(e.getAttribute("class")||"").trim(),r=e.getAttribute("data-feedback-id"),a=r?`${n} [data-feedback-id="${r}"]`:t?`${n}.${t.split(/\s+/).slice(0,2).join(".")}`:n,o=e.getBoundingClientRect();this.hud.textContent=a,this.hud.style.display="block";const i=28,s=o.top-i-6>0?o.top-i-6:Math.min(o.bottom+6,window.innerHeight-i),c=Math.max(8,Math.min(o.left,window.innerWidth-320));this.hud.style.top=`${s}px`,this.hud.style.left=`${c}px`}hideHud(){this.hud.style.display="none"}ownsEvent(e){const n=e.composedPath();return n.includes(this.host)||n.some(t=>t===this.root)}popoverOwnsEvent(e){return this.popover.ownsEvent(e)}renderPins(e,n){this.onPinClick=n,this.pendingFeedback=e,this.scheduleRepositionPins()}reposition(){this.scheduleRepositionPins(),this.popover.reposition()}popoverManager(){return this.popover}scheduleRepositionPins(){this.rafHandle===null&&(this.rafHandle=requestAnimationFrame(()=>{this.rafHandle=null,this.layoutPins()}))}layoutPins(){const e=document.createDocumentFragment();for(const n of this.pendingFeedback){const t=de(n.selector),r=We(t,n.coordinates),a=document.createElement("button");a.type="button";const o=["pin"];r.orphaned&&o.push("orphaned"),n.status==="resolved"&&o.push("resolved"),n.status==="archived"&&o.push("archived"),a.className=o.join(" "),a.setAttribute("data-feedback-id",n.id),a.setAttribute("aria-label",`Feedback ${n.id}`),a.style.left=`${r.x-window.scrollX}px`,a.style.top=`${r.y-window.scrollY}px`;const i=document.createElement("span");i.textContent=String(n.thread.length||1),a.appendChild(i),a.addEventListener("click",s=>{var c;s.stopPropagation(),(c=this.onPinClick)==null||c.call(this,n)}),e.appendChild(a)}this.pinLayer.replaceChildren(e)}destroy(){this.rafHandle!==null&&(cancelAnimationFrame(this.rafHandle),this.rafHandle=null),this.popover.hide(),this.host.remove()}};function H(e,n="div"){const t=document.createElement(n);return t.className=e,(e==="pinLayer"||e==="popover-layer")&&t.classList.add("layer"),t}var ft="data-iwkapps-feedback-host",mt={mimeType:"image/png",quality:.92,scale:1};async function gt(e={}){if(typeof window>"u"||typeof document>"u")return null;const n={...mt,...e},t=await bt();if(!t)return null;const r=document.querySelector(`[${ft}]`),a=(r==null?void 0:r.style.visibility)??"";r&&(r.style.visibility="hidden");try{const o=await t(document.documentElement,{backgroundColor:null,scale:n.scale,width:window.innerWidth,height:window.innerHeight,x:window.scrollX,y:window.scrollY,windowWidth:window.innerWidth,windowHeight:window.innerHeight,logging:!1,useCORS:!0,allowTaint:!1});return await yt(o,n.mimeType,n.quality)}catch{return null}finally{r&&(r.style.visibility=a)}}var O=null;async function bt(){return O||(O=(async()=>{try{const e=await De(()=>import("../chunks/CBrSDip1.js"),[],import.meta.url);return e.default??e??null}catch{return null}})(),O)}function yt(e,n,t){return new Promise(r=>{var a;if(typeof e.toBlob=="function")e.toBlob(r,n,t);else try{const o=e.toDataURL(n,t),[i,s]=o.split(","),c=atob(s??""),d=new Uint8Array(c.length);for(let m=0;m<c.length;m++)d[m]=c.charCodeAt(m);const v=((a=i==null?void 0:i.match(/data:([^;]+);/))==null?void 0:a[1])??n;r(new Blob([d],{type:v}))}catch{r(null)}})}function vt(e){const n=e.fetch??globalThis.fetch.bind(globalThis),t=e.apiUrl.replace(/\/$/,"");function r(){const o={"content-type":"application/json",accept:"application/json",...e.headers??{}};return e.apiKey&&(o["x-feedback-key"]=e.apiKey),o}async function a(o){if(!o.ok){const i=await o.text().catch(()=>"");throw new Error(`feedback-sdk: ${o.status} ${o.statusText} ${i}`)}return await o.json()}return{async list(o){const i=new URLSearchParams;i.set("projectId",o.projectId),o.pageUrl&&i.set("pageUrl",o.pageUrl),o.status&&i.set("status",o.status);const s=await n(`${t}/v1/feedback?${i.toString()}`,{method:"GET",headers:r()});return a(s)},async create(o){const i=await n(`${t}/v1/feedback`,{method:"POST",headers:r(),body:JSON.stringify(o)});return a(i)},async reply(o,i){const s=await n(`${t}/v1/feedback/${encodeURIComponent(o)}/comments`,{method:"POST",headers:r(),body:JSON.stringify(i)});return a(s)},async setStatus(o,i){const s=await n(`${t}/v1/feedback/${encodeURIComponent(o)}`,{method:"PATCH",headers:r(),body:JSON.stringify({status:i})});return a(s)},async uploadScreenshot(o,i){const s=new FormData;s.append("file",i,`${o}.png`);const c={};e.apiKey&&(c["x-feedback-key"]=e.apiKey),e.headers&&Object.assign(c,e.headers);const d=await n(`${t}/v1/feedback/${encodeURIComponent(o)}/screenshot`,{method:"POST",headers:c,body:s});return a(d)}}}function oe(e){if(typeof window>"u"||typeof document>"u")return xt();if(!e.projectId)throw new Error("initFeedback: `projectId` is required");const n=e.transport??(()=>{if(!e.apiUrl)throw new Error("initFeedback: provide either `transport` or `apiUrl`");return vt({apiUrl:e.apiUrl,apiKey:e.apiKey})})(),t=new ht,r={enabled:!!e.enabled,hoverTarget:null,candidate:null,feedbacks:[],destroyed:!1};let a=null,o=null;const i=e.getPageUrl??(()=>window.location.pathname+window.location.search),s=e.selectParentModifier??"Alt",c=e.getAuthor??(()=>Ge(e.projectId)),d=e.setAuthor??(l=>{qe(e.projectId,l)}),v=e.captureScreenshots!==!1,m=e.captureScreenshot??(()=>gt());function h(l){switch(s){case"Alt":return l.altKey;case"Shift":return l.shiftKey;case"Meta":return l.metaKey;case"Control":return l.ctrlKey}}function p(l){if(e.onError)try{e.onError(l)}catch{}else typeof console<"u"&&console.error("[feedback-sdk]",l)}function w(l){if(!r.enabled||t.ownsEvent(l)||a||o)return;const u=wt(l.clientX,l.clientY,t);if(!u){r.hoverTarget=null,t.hideHighlight(),t.hideHud();return}r.hoverTarget=u,r.candidate=u,t.showHighlight(u),t.showHud(u)}function E(l){var g;if(t.popoverOwnsEvent(l)||!r.enabled||t.ownsEvent(l))return;if(h(l)){const f=((g=r.candidate)==null?void 0:g.parentElement)??null;f&&f!==document.body&&f!==document.documentElement&&(r.candidate=f,t.showHighlight(f),t.showHud(f)),l.preventDefault(),l.stopPropagation();return}const u=r.candidate??r.hoverTarget;u&&(l.preventDefault(),l.stopPropagation(),D(u,l.clientX,l.clientY))}function T(l){if(l.key==="Escape"){if(a||o){k(),K();return}r.enabled&&(r.candidate=null,r.hoverTarget=null,t.hideHighlight(),t.hideHud())}}function S(){t.reposition()}function D(l,u,g){const f=st(l),C=ze(l,u,g);a={selector:f,coordinates:C,pageX:u+window.scrollX,pageY:g+window.scrollY},t.hideHighlight(),t.hideHud();let _=null;v&&(_=m().catch(()=>null)),t.popoverManager().showComposer({pageX:a.pageX,pageY:a.pageY},{initialAuthor:c(),onSubmit:async(he,X)=>{var J;const z=a;if(z)try{const I=await ue(z,{author:X,body:he});d(X),(J=e.onPinCreate)==null||J.call(e,I),a=null,t.popoverManager().hide(),_&&n.uploadScreenshot&&_.then(async L=>{if(!L)return;const fe=await n.uploadScreenshot(I.id,L);j(fe)}).catch(L=>p(L))}catch(I){p(I)}},onCancel:()=>k()})}function k(){a&&(a=null,t.popoverManager().hide())}function b(l){o=l.id;const u=pe(l);t.popoverManager().showThread(l,u,{initialAuthor:c(),onReply:async(g,f)=>{try{const C=await n.reply(l.id,{author:f,body:g});d(f),j(C),t.popoverManager().hide(),o=null,b(C)}catch(C){p(C)}},onStatus:async g=>{try{const f=await n.setStatus(l.id,g);j(f),t.popoverManager().hide(),o=null,b(f)}catch(f){p(f)}},onClose:()=>K()})}function K(){o&&(o=null,t.popoverManager().hide())}function pe(l){const u=de(l.selector);if(u){const g=u.getBoundingClientRect();return{pageX:g.left+window.scrollX+g.width*l.coordinates.xPercent,pageY:g.top+window.scrollY+g.height*l.coordinates.yPercent}}return{pageX:l.coordinates.xPx,pageY:l.coordinates.yPx}}async function ue(l,u){const g=Je(),f=i(),C={projectId:e.projectId,pageUrl:f,selector:l.selector,coordinates:l.coordinates,viewport:g,comment:u},_=await n.create(C);return r.feedbacks=[...r.feedbacks,_],t.renderPins(r.feedbacks,b),_}function j(l){r.feedbacks=r.feedbacks.map(u=>u.id===l.id?l:u),t.renderPins(r.feedbacks,b)}async function B(){try{const l=await n.list({projectId:e.projectId});r.feedbacks=l.items,t.renderPins(r.feedbacks,b)}catch(l){p(l)}}return document.addEventListener("mousemove",w,!0),document.addEventListener("click",E,!0),document.addEventListener("keydown",T,!0),window.addEventListener("scroll",S,!0),window.addEventListener("resize",S),B(),t.setEnabledStyles(r.enabled),{setEnabled(l){r.destroyed||(r.enabled=l,t.setEnabledStyles(l),l||k())},isEnabled(){return r.enabled},async refresh(){r.destroyed||await B()},destroy(){r.destroyed||(r.destroyed=!0,document.removeEventListener("mousemove",w,!0),document.removeEventListener("click",E,!0),document.removeEventListener("keydown",T,!0),window.removeEventListener("scroll",S,!0),window.removeEventListener("resize",S),t.destroy())}}}function wt(e,n,t){const r=document.elementsFromPoint(e,n);for(const a of r)if(!t.ownsEvent({composedPath:()=>[a]})&&!(a===document.documentElement||a===document.body))return a;return null}function xt(){return{setEnabled(){},isEnabled(){return!1},async refresh(){},destroy(){}}}function U(e,n){let t=null,r=n;return typeof window<"u"&&(t=oe(n),x.attach(t)),{update(a){const o=a.projectId!==r.projectId||a.apiUrl!==r.apiUrl||a.transport!==r.transport||a.apiKey!==r.apiKey;r=a,o&&t&&(t.destroy(),x.detach(),typeof window<"u"&&(t=oe(a),x.attach(t)))},destroy(){t==null||t.destroy(),t=null,x.detach()}}}function kt(){const e=new Set;let n=!1,t=null;function r(){for(const a of e)a(n)}return{subscribe(a){return e.add(a),a(n),()=>e.delete(a)},set(a){n=a,t==null||t.setEnabled(a),r()},toggle(){this.set(!n)},attach(a){t=a,n=a.isEnabled(),r()},detach(){t=null,n=!1,r()}}}var x=kt();function Et(){return{subscribe:x.subscribe.bind(x),set:x.set.bind(x),toggle:x.toggle.bind(x)}}function Ct(e={}){const n=e.initial?e.initial.map(A):[],t=e.generateId??St,r=e.latencyMs??0;async function a(){r>0&&await new Promise(o=>setTimeout(o,r))}return{async list(o){return await a(),{items:n.filter(s=>s.projectId===o.projectId).filter(s=>o.pageUrl?s.pageUrl===o.pageUrl:!0).filter(s=>o.status?s.status===o.status:!0).map(A)}},async create(o){await a();const i=new Date().toISOString(),s=t(),c={id:s,projectId:o.projectId,pageUrl:o.pageUrl,selector:o.selector,coordinates:{...o.coordinates},viewport:{...o.viewport},status:"open",thread:o.comment?[{id:`cm_${s}_0`,author:{...o.comment.author},body:o.comment.body,createdAt:i}]:[],createdAt:i,updatedAt:i};return n.push(c),A(c)},async reply(o,i){await a();const s=n.find(d=>d.id===o);if(!s)throw new Error(`feedback not found: ${o}`);const c=new Date().toISOString();return s.thread.push({id:`cm_${o}_${s.thread.length}`,author:{...i.author},body:i.body,createdAt:c}),s.updatedAt=c,A(s)},async setStatus(o,i){await a();const s=n.find(c=>c.id===o);if(!s)throw new Error(`feedback not found: ${o}`);return s.status=i,s.updatedAt=new Date().toISOString(),A(s)},async uploadScreenshot(o,i){await a();const s=n.find(c=>c.id===o);if(!s)throw new Error(`feedback not found: ${o}`);return s.screenshotKey=`screenshots/${o}.png`,s.updatedAt=new Date().toISOString(),A(s)},_all(){return n.map(A)},_reset(){n.length=0}}}function St(){return`fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`}function A(e){return JSON.parse(JSON.stringify(e))}var Ft=ge(`<div><header class="hero svelte-1uha8ag"><div class="brand svelte-1uha8ag">@iwkapps/feedback-sdk</div> <h1 class="svelte-1uha8ag">Pin a comment to anything on this page.</h1> <p class="lede svelte-1uha8ag">Toggle feedback mode, hover any element, click to leave a note. Hold <kbd class="svelte-1uha8ag">Alt</kbd> while
      clicking to walk one parent up. Press <kbd class="svelte-1uha8ag">Esc</kbd> to cancel.</p> <div class="hero-actions svelte-1uha8ag"><button class="btn btn-primary svelte-1uha8ag" type="button" data-feedback-id="hero-toggle"> </button> <button class="btn btn-ghost svelte-1uha8ag" type="button"> </button></div> <small class="hint svelte-1uha8ag">Shortcut: <kbd class="svelte-1uha8ag">Ctrl/⌘ + Shift + F</kbd></small></header> <main class="cards svelte-1uha8ag"><section class="card svelte-1uha8ag" data-feedback-id="card-hero"><h2 class="svelte-1uha8ag">Hero copy</h2> <p class="svelte-1uha8ag">Click anywhere on this card while feedback mode is on. The SDK captures a stable DOM
        selector (this card has <code class="svelte-1uha8ag">data-feedback-id="card-hero"</code>), the relative position
        inside the bounding box, and the absolute page pixel as a fallback.</p></section> <section class="card svelte-1uha8ag" data-feedback-id="card-pricing"><h2 class="svelte-1uha8ag">Pricing</h2> <ul><li class="svelte-1uha8ag"><strong>Free</strong> · for prototypes and personal use</li> <li class="svelte-1uha8ag"><strong>Team</strong> · self-hosted, unlimited projects</li> <li class="svelte-1uha8ag"><strong>Enterprise</strong> · talk to us</li></ul></section> <section class="card svelte-1uha8ag" data-feedback-id="card-form"><h2 class="svelte-1uha8ag">Contact</h2> <form class="svelte-1uha8ag"><label class="svelte-1uha8ag">Email <input type="email" placeholder="you@example.com" class="svelte-1uha8ag"/></label> <label class="svelte-1uha8ag">Message <textarea rows="3" placeholder="What would you change?" class="svelte-1uha8ag"></textarea></label> <button type="submit" class="btn btn-primary svelte-1uha8ag">Send</button></form></section></main></div>`);function It(e,n){Te(n,!1);const t=()=>Re(i,"$enabled",r),[r,a]=je(),o=Ct(),i=Et();let s=Oe(!1);function c(){navigator.clipboard.writeText("bun add @iwkapps/feedback-sdk"),Q(s,!0),setTimeout(()=>Q(s,!1),1200)}be(()=>{const k=b=>{(b.metaKey||b.ctrlKey)&&b.shiftKey&&b.key.toLowerCase()==="f"&&(b.preventDefault(),i.toggle())};return window.addEventListener("keydown",k),()=>window.removeEventListener("keydown",k)}),Ke();var d=Ft();Me("1uha8ag",k=>{ae(()=>{Le.title="Feedback SDK · SvelteKit example"})});var v=F(d),m=N(F(v),6),h=F(m),p=F(h,!0);P(h);var w=N(h,2),E=F(w,!0);P(w),P(m),He(2),P(v);var T=N(v,2),S=N(F(T),4),D=N(F(S),2);P(S),P(T),P(d),Ue(d,(k,b)=>U==null?void 0:U(k,b),()=>({projectId:"demo",transport:o,captureScreenshots:!1})),Ne(()=>{ee(p,t()?"Stop feedback":"Start feedback"),ee(E,Y(s)?"Copied":"Copy install")}),M("click",h,()=>i.toggle()),M("click",w,c),M("submit",D,Ye(()=>alert("not implemented in the demo"))),me(e,d),Ie(),a()}export{It as component};
