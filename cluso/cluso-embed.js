(function(){const d=document.createElement("link").relList;if(d&&d.supports&&d.supports("modulepreload"))return;for(const b of document.querySelectorAll('link[rel="modulepreload"]'))c(b);new MutationObserver(b=>{for(const v of b)if(v.type==="childList")for(const E of v.addedNodes)E.tagName==="LINK"&&E.rel==="modulepreload"&&c(E)}).observe(document,{childList:!0,subtree:!0});function _(b){const v={};return b.integrity&&(v.integrity=b.integrity),b.referrerPolicy&&(v.referrerPolicy=b.referrerPolicy),b.crossOrigin==="use-credentials"?v.credentials="include":b.crossOrigin==="anonymous"?v.credentials="omit":v.credentials="same-origin",v}function c(b){if(b.ep)return;b.ep=!0;const v=_(b);fetch(b.href,v)}})();function Eh(u){return u&&u.__esModule&&Object.prototype.hasOwnProperty.call(u,"default")?u.default:u}var fr={exports:{}},Os={};var _m;function Th(){if(_m)return Os;_m=1;var u=Symbol.for("react.transitional.element"),d=Symbol.for("react.fragment");function _(c,b,v){var E=null;if(v!==void 0&&(E=""+v),b.key!==void 0&&(E=""+b.key),"key"in b){v={};for(var V in b)V!=="key"&&(v[V]=b[V])}else v=b;return b=v.ref,{$$typeof:u,type:c,key:E,ref:b!==void 0?b:null,props:v}}return Os.Fragment=d,Os.jsx=_,Os.jsxs=_,Os}var mm;function kh(){return mm||(mm=1,fr.exports=Th()),fr.exports}var s=kh(),_r={exports:{}},me={};var hm;function zh(){if(hm)return me;hm=1;var u=Symbol.for("react.transitional.element"),d=Symbol.for("react.portal"),_=Symbol.for("react.fragment"),c=Symbol.for("react.strict_mode"),b=Symbol.for("react.profiler"),v=Symbol.for("react.consumer"),E=Symbol.for("react.context"),V=Symbol.for("react.forward_ref"),O=Symbol.for("react.suspense"),A=Symbol.for("react.memo"),K=Symbol.for("react.lazy"),Z=Symbol.for("react.activity"),pe=Symbol.iterator;function he(p){return p===null||typeof p!="object"?null:(p=pe&&p[pe]||p["@@iterator"],typeof p=="function"?p:null)}var Re={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},ye=Object.assign,Ot={};function ee(p,S,H){this.props=p,this.context=S,this.refs=Ot,this.updater=H||Re}ee.prototype.isReactComponent={},ee.prototype.setState=function(p,S){if(typeof p!="object"&&typeof p!="function"&&p!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,p,S,"setState")},ee.prototype.forceUpdate=function(p){this.updater.enqueueForceUpdate(this,p,"forceUpdate")};function Gt(){}Gt.prototype=ee.prototype;function ct(p,S,H){this.props=p,this.context=S,this.refs=Ot,this.updater=H||Re}var et=ct.prototype=new Gt;et.constructor=ct,ye(et,ee.prototype),et.isPureReactComponent=!0;var ft=Array.isArray;function tt(){}var q={H:null,A:null,T:null,S:null},rt=Object.prototype.hasOwnProperty;function Tt(p,S,H){var B=H.ref;return{$$typeof:u,type:p,key:S,ref:B!==void 0?B:null,props:H}}function on(p,S){return Tt(p.type,S,p.props)}function at(p){return typeof p=="object"&&p!==null&&p.$$typeof===u}function oe(p){var S={"=":"=0",":":"=2"};return"$"+p.replace(/[=:]/g,function(H){return S[H]})}var Ie=/\/+/g;function _t(p,S){return typeof p=="object"&&p!==null&&p.key!=null?oe(""+p.key):S.toString(36)}function kt(p){switch(p.status){case"fulfilled":return p.value;case"rejected":throw p.reason;default:switch(typeof p.status=="string"?p.then(tt,tt):(p.status="pending",p.then(function(S){p.status==="pending"&&(p.status="fulfilled",p.value=S)},function(S){p.status==="pending"&&(p.status="rejected",p.reason=S)})),p.status){case"fulfilled":return p.value;case"rejected":throw p.reason}}throw p}function z(p,S,H,B,le){var ge=typeof p;(ge==="undefined"||ge==="boolean")&&(p=null);var Te=!1;if(p===null)Te=!0;else switch(ge){case"bigint":case"string":case"number":Te=!0;break;case"object":switch(p.$$typeof){case u:case d:Te=!0;break;case K:return Te=p._init,z(Te(p._payload),S,H,B,le)}}if(Te)return le=le(p),Te=B===""?"."+_t(p,0):B,ft(le)?(H="",Te!=null&&(H=Te.replace(Ie,"$&/")+"/"),z(le,S,H,"",function($){return $})):le!=null&&(at(le)&&(le=on(le,H+(le.key==null||p&&p.key===le.key?"":(""+le.key).replace(Ie,"$&/")+"/")+Te)),S.push(le)),1;Te=0;var Fe=B===""?".":B+":";if(ft(p))for(var Ze=0;Ze<p.length;Ze++)B=p[Ze],ge=Fe+_t(B,Ze),Te+=z(B,S,H,ge,le);else if(Ze=he(p),typeof Ze=="function")for(p=Ze.call(p),Ze=0;!(B=p.next()).done;)B=B.value,ge=Fe+_t(B,Ze++),Te+=z(B,S,H,ge,le);else if(ge==="object"){if(typeof p.then=="function")return z(kt(p),S,H,B,le);throw S=String(p),Error("Objects are not valid as a React child (found: "+(S==="[object Object]"?"object with keys {"+Object.keys(p).join(", ")+"}":S)+"). If you meant to render a collection of children, use an array instead.")}return Te}function U(p,S,H){if(p==null)return p;var B=[],le=0;return z(p,B,"","",function(ge){return S.call(H,ge,le++)}),B}function J(p){if(p._status===-1){var S=p._result;S=S(),S.then(function(H){(p._status===0||p._status===-1)&&(p._status=1,p._result=H)},function(H){(p._status===0||p._status===-1)&&(p._status=2,p._result=H)}),p._status===-1&&(p._status=0,p._result=S)}if(p._status===1)return p._result.default;throw p._result}var Ae=typeof reportError=="function"?reportError:function(p){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var S=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof p=="object"&&p!==null&&typeof p.message=="string"?String(p.message):String(p),error:p});if(!window.dispatchEvent(S))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",p);return}console.error(p)},ne={map:U,forEach:function(p,S,H){U(p,function(){S.apply(this,arguments)},H)},count:function(p){var S=0;return U(p,function(){S++}),S},toArray:function(p){return U(p,function(S){return S})||[]},only:function(p){if(!at(p))throw Error("React.Children.only expected to receive a single React element child.");return p}};return me.Activity=Z,me.Children=ne,me.Component=ee,me.Fragment=_,me.Profiler=b,me.PureComponent=ct,me.StrictMode=c,me.Suspense=O,me.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=q,me.__COMPILER_RUNTIME={__proto__:null,c:function(p){return q.H.useMemoCache(p)}},me.cache=function(p){return function(){return p.apply(null,arguments)}},me.cacheSignal=function(){return null},me.cloneElement=function(p,S,H){if(p==null)throw Error("The argument must be a React element, but you passed "+p+".");var B=ye({},p.props),le=p.key;if(S!=null)for(ge in S.key!==void 0&&(le=""+S.key),S)!rt.call(S,ge)||ge==="key"||ge==="__self"||ge==="__source"||ge==="ref"&&S.ref===void 0||(B[ge]=S[ge]);var ge=arguments.length-2;if(ge===1)B.children=H;else if(1<ge){for(var Te=Array(ge),Fe=0;Fe<ge;Fe++)Te[Fe]=arguments[Fe+2];B.children=Te}return Tt(p.type,le,B)},me.createContext=function(p){return p={$$typeof:E,_currentValue:p,_currentValue2:p,_threadCount:0,Provider:null,Consumer:null},p.Provider=p,p.Consumer={$$typeof:v,_context:p},p},me.createElement=function(p,S,H){var B,le={},ge=null;if(S!=null)for(B in S.key!==void 0&&(ge=""+S.key),S)rt.call(S,B)&&B!=="key"&&B!=="__self"&&B!=="__source"&&(le[B]=S[B]);var Te=arguments.length-2;if(Te===1)le.children=H;else if(1<Te){for(var Fe=Array(Te),Ze=0;Ze<Te;Ze++)Fe[Ze]=arguments[Ze+2];le.children=Fe}if(p&&p.defaultProps)for(B in Te=p.defaultProps,Te)le[B]===void 0&&(le[B]=Te[B]);return Tt(p,ge,le)},me.createRef=function(){return{current:null}},me.forwardRef=function(p){return{$$typeof:V,render:p}},me.isValidElement=at,me.lazy=function(p){return{$$typeof:K,_payload:{_status:-1,_result:p},_init:J}},me.memo=function(p,S){return{$$typeof:A,type:p,compare:S===void 0?null:S}},me.startTransition=function(p){var S=q.T,H={};q.T=H;try{var B=p(),le=q.S;le!==null&&le(H,B),typeof B=="object"&&B!==null&&typeof B.then=="function"&&B.then(tt,Ae)}catch(ge){Ae(ge)}finally{S!==null&&H.types!==null&&(S.types=H.types),q.T=S}},me.unstable_useCacheRefresh=function(){return q.H.useCacheRefresh()},me.use=function(p){return q.H.use(p)},me.useActionState=function(p,S,H){return q.H.useActionState(p,S,H)},me.useCallback=function(p,S){return q.H.useCallback(p,S)},me.useContext=function(p){return q.H.useContext(p)},me.useDebugValue=function(){},me.useDeferredValue=function(p,S){return q.H.useDeferredValue(p,S)},me.useEffect=function(p,S){return q.H.useEffect(p,S)},me.useEffectEvent=function(p){return q.H.useEffectEvent(p)},me.useId=function(){return q.H.useId()},me.useImperativeHandle=function(p,S,H){return q.H.useImperativeHandle(p,S,H)},me.useInsertionEffect=function(p,S){return q.H.useInsertionEffect(p,S)},me.useLayoutEffect=function(p,S){return q.H.useLayoutEffect(p,S)},me.useMemo=function(p,S){return q.H.useMemo(p,S)},me.useOptimistic=function(p,S){return q.H.useOptimistic(p,S)},me.useReducer=function(p,S,H){return q.H.useReducer(p,S,H)},me.useRef=function(p){return q.H.useRef(p)},me.useState=function(p){return q.H.useState(p)},me.useSyncExternalStore=function(p,S,H){return q.H.useSyncExternalStore(p,S,H)},me.useTransition=function(){return q.H.useTransition()},me.version="19.2.4",me}var gm;function Br(){return gm||(gm=1,_r.exports=zh()),_r.exports}var N=Br();const Ah=Eh(N);var mr={exports:{}},Ls={},hr={exports:{}},gr={};var pm;function Mh(){return pm||(pm=1,(function(u){function d(z,U){var J=z.length;z.push(U);e:for(;0<J;){var Ae=J-1>>>1,ne=z[Ae];if(0<b(ne,U))z[Ae]=U,z[J]=ne,J=Ae;else break e}}function _(z){return z.length===0?null:z[0]}function c(z){if(z.length===0)return null;var U=z[0],J=z.pop();if(J!==U){z[0]=J;e:for(var Ae=0,ne=z.length,p=ne>>>1;Ae<p;){var S=2*(Ae+1)-1,H=z[S],B=S+1,le=z[B];if(0>b(H,J))B<ne&&0>b(le,H)?(z[Ae]=le,z[B]=J,Ae=B):(z[Ae]=H,z[S]=J,Ae=S);else if(B<ne&&0>b(le,J))z[Ae]=le,z[B]=J,Ae=B;else break e}}return U}function b(z,U){var J=z.sortIndex-U.sortIndex;return J!==0?J:z.id-U.id}if(u.unstable_now=void 0,typeof performance=="object"&&typeof performance.now=="function"){var v=performance;u.unstable_now=function(){return v.now()}}else{var E=Date,V=E.now();u.unstable_now=function(){return E.now()-V}}var O=[],A=[],K=1,Z=null,pe=3,he=!1,Re=!1,ye=!1,Ot=!1,ee=typeof setTimeout=="function"?setTimeout:null,Gt=typeof clearTimeout=="function"?clearTimeout:null,ct=typeof setImmediate<"u"?setImmediate:null;function et(z){for(var U=_(A);U!==null;){if(U.callback===null)c(A);else if(U.startTime<=z)c(A),U.sortIndex=U.expirationTime,d(O,U);else break;U=_(A)}}function ft(z){if(ye=!1,et(z),!Re)if(_(O)!==null)Re=!0,tt||(tt=!0,oe());else{var U=_(A);U!==null&&kt(ft,U.startTime-z)}}var tt=!1,q=-1,rt=5,Tt=-1;function on(){return Ot?!0:!(u.unstable_now()-Tt<rt)}function at(){if(Ot=!1,tt){var z=u.unstable_now();Tt=z;var U=!0;try{e:{Re=!1,ye&&(ye=!1,Gt(q),q=-1),he=!0;var J=pe;try{t:{for(et(z),Z=_(O);Z!==null&&!(Z.expirationTime>z&&on());){var Ae=Z.callback;if(typeof Ae=="function"){Z.callback=null,pe=Z.priorityLevel;var ne=Ae(Z.expirationTime<=z);if(z=u.unstable_now(),typeof ne=="function"){Z.callback=ne,et(z),U=!0;break t}Z===_(O)&&c(O),et(z)}else c(O);Z=_(O)}if(Z!==null)U=!0;else{var p=_(A);p!==null&&kt(ft,p.startTime-z),U=!1}}break e}finally{Z=null,pe=J,he=!1}U=void 0}}finally{U?oe():tt=!1}}}var oe;if(typeof ct=="function")oe=function(){ct(at)};else if(typeof MessageChannel<"u"){var Ie=new MessageChannel,_t=Ie.port2;Ie.port1.onmessage=at,oe=function(){_t.postMessage(null)}}else oe=function(){ee(at,0)};function kt(z,U){q=ee(function(){z(u.unstable_now())},U)}u.unstable_IdlePriority=5,u.unstable_ImmediatePriority=1,u.unstable_LowPriority=4,u.unstable_NormalPriority=3,u.unstable_Profiling=null,u.unstable_UserBlockingPriority=2,u.unstable_cancelCallback=function(z){z.callback=null},u.unstable_forceFrameRate=function(z){0>z||125<z?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):rt=0<z?Math.floor(1e3/z):5},u.unstable_getCurrentPriorityLevel=function(){return pe},u.unstable_next=function(z){switch(pe){case 1:case 2:case 3:var U=3;break;default:U=pe}var J=pe;pe=U;try{return z()}finally{pe=J}},u.unstable_requestPaint=function(){Ot=!0},u.unstable_runWithPriority=function(z,U){switch(z){case 1:case 2:case 3:case 4:case 5:break;default:z=3}var J=pe;pe=z;try{return U()}finally{pe=J}},u.unstable_scheduleCallback=function(z,U,J){var Ae=u.unstable_now();switch(typeof J=="object"&&J!==null?(J=J.delay,J=typeof J=="number"&&0<J?Ae+J:Ae):J=Ae,z){case 1:var ne=-1;break;case 2:ne=250;break;case 5:ne=1073741823;break;case 4:ne=1e4;break;default:ne=5e3}return ne=J+ne,z={id:K++,callback:U,priorityLevel:z,startTime:J,expirationTime:ne,sortIndex:-1},J>Ae?(z.sortIndex=J,d(A,z),_(O)===null&&z===_(A)&&(ye?(Gt(q),q=-1):ye=!0,kt(ft,J-Ae))):(z.sortIndex=ne,d(O,z),Re||he||(Re=!0,tt||(tt=!0,oe()))),z},u.unstable_shouldYield=on,u.unstable_wrapCallback=function(z){var U=pe;return function(){var J=pe;pe=U;try{return z.apply(this,arguments)}finally{pe=J}}}})(gr)),gr}var ym;function Oh(){return ym||(ym=1,hr.exports=Mh()),hr.exports}var pr={exports:{}},Zt={};var bm;function Lh(){if(bm)return Zt;bm=1;var u=Br();function d(O){var A="https://react.dev/errors/"+O;if(1<arguments.length){A+="?args[]="+encodeURIComponent(arguments[1]);for(var K=2;K<arguments.length;K++)A+="&args[]="+encodeURIComponent(arguments[K])}return"Minified React error #"+O+"; visit "+A+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function _(){}var c={d:{f:_,r:function(){throw Error(d(522))},D:_,C:_,L:_,m:_,X:_,S:_,M:_},p:0,findDOMNode:null},b=Symbol.for("react.portal");function v(O,A,K){var Z=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:b,key:Z==null?null:""+Z,children:O,containerInfo:A,implementation:K}}var E=u.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function V(O,A){if(O==="font")return"";if(typeof A=="string")return A==="use-credentials"?A:""}return Zt.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=c,Zt.createPortal=function(O,A){var K=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!A||A.nodeType!==1&&A.nodeType!==9&&A.nodeType!==11)throw Error(d(299));return v(O,A,null,K)},Zt.flushSync=function(O){var A=E.T,K=c.p;try{if(E.T=null,c.p=2,O)return O()}finally{E.T=A,c.p=K,c.d.f()}},Zt.preconnect=function(O,A){typeof O=="string"&&(A?(A=A.crossOrigin,A=typeof A=="string"?A==="use-credentials"?A:"":void 0):A=null,c.d.C(O,A))},Zt.prefetchDNS=function(O){typeof O=="string"&&c.d.D(O)},Zt.preinit=function(O,A){if(typeof O=="string"&&A&&typeof A.as=="string"){var K=A.as,Z=V(K,A.crossOrigin),pe=typeof A.integrity=="string"?A.integrity:void 0,he=typeof A.fetchPriority=="string"?A.fetchPriority:void 0;K==="style"?c.d.S(O,typeof A.precedence=="string"?A.precedence:void 0,{crossOrigin:Z,integrity:pe,fetchPriority:he}):K==="script"&&c.d.X(O,{crossOrigin:Z,integrity:pe,fetchPriority:he,nonce:typeof A.nonce=="string"?A.nonce:void 0})}},Zt.preinitModule=function(O,A){if(typeof O=="string")if(typeof A=="object"&&A!==null){if(A.as==null||A.as==="script"){var K=V(A.as,A.crossOrigin);c.d.M(O,{crossOrigin:K,integrity:typeof A.integrity=="string"?A.integrity:void 0,nonce:typeof A.nonce=="string"?A.nonce:void 0})}}else A==null&&c.d.M(O)},Zt.preload=function(O,A){if(typeof O=="string"&&typeof A=="object"&&A!==null&&typeof A.as=="string"){var K=A.as,Z=V(K,A.crossOrigin);c.d.L(O,K,{crossOrigin:Z,integrity:typeof A.integrity=="string"?A.integrity:void 0,nonce:typeof A.nonce=="string"?A.nonce:void 0,type:typeof A.type=="string"?A.type:void 0,fetchPriority:typeof A.fetchPriority=="string"?A.fetchPriority:void 0,referrerPolicy:typeof A.referrerPolicy=="string"?A.referrerPolicy:void 0,imageSrcSet:typeof A.imageSrcSet=="string"?A.imageSrcSet:void 0,imageSizes:typeof A.imageSizes=="string"?A.imageSizes:void 0,media:typeof A.media=="string"?A.media:void 0})}},Zt.preloadModule=function(O,A){if(typeof O=="string")if(A){var K=V(A.as,A.crossOrigin);c.d.m(O,{as:typeof A.as=="string"&&A.as!=="script"?A.as:void 0,crossOrigin:K,integrity:typeof A.integrity=="string"?A.integrity:void 0})}else c.d.m(O)},Zt.requestFormReset=function(O){c.d.r(O)},Zt.unstable_batchedUpdates=function(O,A){return O(A)},Zt.useFormState=function(O,A,K){return E.H.useFormState(O,A,K)},Zt.useFormStatus=function(){return E.H.useHostTransitionStatus()},Zt.version="19.2.4",Zt}var xm;function Um(){if(xm)return pr.exports;xm=1;function u(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(u)}catch(d){console.error(d)}}return u(),pr.exports=Lh(),pr.exports}var vm;function Bh(){if(vm)return Ls;vm=1;var u=Oh(),d=Br(),_=Um();function c(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function b(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function v(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function E(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function V(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function O(e){if(v(e)!==e)throw Error(c(188))}function A(e){var t=e.alternate;if(!t){if(t=v(e),t===null)throw Error(c(188));return t!==e?null:e}for(var n=e,l=t;;){var a=n.return;if(a===null)break;var o=a.alternate;if(o===null){if(l=a.return,l!==null){n=l;continue}break}if(a.child===o.child){for(o=a.child;o;){if(o===n)return O(a),e;if(o===l)return O(a),t;o=o.sibling}throw Error(c(188))}if(n.return!==l.return)n=a,l=o;else{for(var i=!1,r=a.child;r;){if(r===n){i=!0,n=a,l=o;break}if(r===l){i=!0,l=a,n=o;break}r=r.sibling}if(!i){for(r=o.child;r;){if(r===n){i=!0,n=o,l=a;break}if(r===l){i=!0,l=o,n=a;break}r=r.sibling}if(!i)throw Error(c(189))}}if(n.alternate!==l)throw Error(c(190))}if(n.tag!==3)throw Error(c(188));return n.stateNode.current===n?e:t}function K(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=K(e),t!==null)return t;e=e.sibling}return null}var Z=Object.assign,pe=Symbol.for("react.element"),he=Symbol.for("react.transitional.element"),Re=Symbol.for("react.portal"),ye=Symbol.for("react.fragment"),Ot=Symbol.for("react.strict_mode"),ee=Symbol.for("react.profiler"),Gt=Symbol.for("react.consumer"),ct=Symbol.for("react.context"),et=Symbol.for("react.forward_ref"),ft=Symbol.for("react.suspense"),tt=Symbol.for("react.suspense_list"),q=Symbol.for("react.memo"),rt=Symbol.for("react.lazy"),Tt=Symbol.for("react.activity"),on=Symbol.for("react.memo_cache_sentinel"),at=Symbol.iterator;function oe(e){return e===null||typeof e!="object"?null:(e=at&&e[at]||e["@@iterator"],typeof e=="function"?e:null)}var Ie=Symbol.for("react.client.reference");function _t(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===Ie?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case ye:return"Fragment";case ee:return"Profiler";case Ot:return"StrictMode";case ft:return"Suspense";case tt:return"SuspenseList";case Tt:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case Re:return"Portal";case ct:return e.displayName||"Context";case Gt:return(e._context.displayName||"Context")+".Consumer";case et:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case q:return t=e.displayName||null,t!==null?t:_t(e.type)||"Memo";case rt:t=e._payload,e=e._init;try{return _t(e(t))}catch{}}return null}var kt=Array.isArray,z=d.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,U=_.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,J={pending:!1,data:null,method:null,action:null},Ae=[],ne=-1;function p(e){return{current:e}}function S(e){0>ne||(e.current=Ae[ne],Ae[ne]=null,ne--)}function H(e,t){ne++,Ae[ne]=e.current,e.current=t}var B=p(null),le=p(null),ge=p(null),Te=p(null);function Fe(e,t){switch(H(ge,t),H(le,e),H(B,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?D_(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=D_(t),e=R_(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}S(B),H(B,e)}function Ze(){S(B),S(le),S(ge)}function $(e){e.memoizedState!==null&&H(Te,e);var t=B.current,n=R_(t,e.type);t!==n&&(H(le,e),H(B,n))}function we(e){le.current===e&&(S(B),S(le)),Te.current===e&&(S(Te),ks._currentValue=J)}var yn,$n;function Kt(e){if(yn===void 0)try{throw Error()}catch(n){var t=n.stack.trim().match(/\n( *(at )?)/);yn=t&&t[1]||"",$n=-1<n.stack.indexOf(`
    at`)?" (<anonymous>)":-1<n.stack.indexOf("@")?"@unknown:0:0":""}return`
`+yn+e+$n}var ua=!1;function ca(e,t){if(!e||ua)return"";ua=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var l={DetermineComponentFrameRoot:function(){try{if(t){var R=function(){throw Error()};if(Object.defineProperty(R.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(R,[])}catch(T){var j=T}Reflect.construct(e,[],R)}else{try{R.call()}catch(T){j=T}e.call(R.prototype)}}else{try{throw Error()}catch(T){j=T}(R=e())&&typeof R.catch=="function"&&R.catch(function(){})}}catch(T){if(T&&j&&typeof T.stack=="string")return[T.stack,j.stack]}return[null,null]}};l.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var a=Object.getOwnPropertyDescriptor(l.DetermineComponentFrameRoot,"name");a&&a.configurable&&Object.defineProperty(l.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var o=l.DetermineComponentFrameRoot(),i=o[0],r=o[1];if(i&&r){var g=i.split(`
`),C=r.split(`
`);for(a=l=0;l<g.length&&!g[l].includes("DetermineComponentFrameRoot");)l++;for(;a<C.length&&!C[a].includes("DetermineComponentFrameRoot");)a++;if(l===g.length||a===C.length)for(l=g.length-1,a=C.length-1;1<=l&&0<=a&&g[l]!==C[a];)a--;for(;1<=l&&0<=a;l--,a--)if(g[l]!==C[a]){if(l!==1||a!==1)do if(l--,a--,0>a||g[l]!==C[a]){var L=`
`+g[l].replace(" at new "," at ");return e.displayName&&L.includes("<anonymous>")&&(L=L.replace("<anonymous>",e.displayName)),L}while(1<=l&&0<=a);break}}}finally{ua=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:"")?Kt(n):""}function al(e,t){switch(e.tag){case 26:case 27:case 5:return Kt(e.type);case 16:return Kt("Lazy");case 13:return e.child!==t&&t!==null?Kt("Suspense Fallback"):Kt("Suspense");case 19:return Kt("SuspenseList");case 0:case 15:return ca(e.type,!1);case 11:return ca(e.type.render,!1);case 1:return ca(e.type,!0);case 31:return Kt("Activity");default:return""}}function Ro(e){try{var t="",n=null;do t+=al(e,n),n=e,e=e.return;while(e);return t}catch(l){return`
Error generating stack: `+l.message+`
`+l.stack}}var ol=Object.prototype.hasOwnProperty,Qa=u.unstable_scheduleCallback,Ga=u.unstable_cancelCallback,$a=u.unstable_shouldYield,Xs=u.unstable_requestPaint,ie=u.unstable_now,Ml=u.unstable_getCurrentPriorityLevel,qa=u.unstable_ImmediatePriority,bn=u.unstable_UserBlockingPriority,ra=u.unstable_NormalPriority,sl=u.unstable_LowPriority,qn=u.unstable_IdlePriority,Qs=u.log,Gs=u.unstable_setDisableYieldValue,Ol=null,Oe=null;function Zn(e){if(typeof Qs=="function"&&Gs(e),Oe&&typeof Oe.setStrictMode=="function")try{Oe.setStrictMode(Ol,e)}catch{}}var ot=Math.clz32?Math.clz32:da,$s=Math.log,il=Math.LN2;function da(e){return e>>>=0,e===0?32:31-($s(e)/il|0)|0}var Za=256,fa=262144,dt=4194304;function Ve(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function _a(e,t,n){var l=e.pendingLanes;if(l===0)return 0;var a=0,o=e.suspendedLanes,i=e.pingedLanes;e=e.warmLanes;var r=l&134217727;return r!==0?(l=r&~o,l!==0?a=Ve(l):(i&=r,i!==0?a=Ve(i):n||(n=r&~e,n!==0&&(a=Ve(n))))):(r=l&~o,r!==0?a=Ve(r):i!==0?a=Ve(i):n||(n=l&~e,n!==0&&(a=Ve(n)))),a===0?0:t!==0&&t!==a&&(t&o)===0&&(o=a&-a,n=t&-t,o>=n||o===32&&(n&4194048)!==0)?t:a}function Vn(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function Jn(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Kn(){var e=dt;return dt<<=1,(dt&62914560)===0&&(dt=4194304),e}function ul(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function cl(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function Yo(e,t,n,l,a,o){var i=e.pendingLanes;e.pendingLanes=n,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=n,e.entangledLanes&=n,e.errorRecoveryDisabledLanes&=n,e.shellSuspendCounter=0;var r=e.entanglements,g=e.expirationTimes,C=e.hiddenUpdates;for(n=i&~n;0<n;){var L=31-ot(n),R=1<<L;r[L]=0,g[L]=-1;var j=C[L];if(j!==null)for(C[L]=null,L=0;L<j.length;L++){var T=j[L];T!==null&&(T.lane&=-536870913)}n&=~R}l!==0&&Ho(e,l,0),o!==0&&a===0&&e.tag!==0&&(e.suspendedLanes|=o&~(i&~t))}function Ho(e,t,n){e.pendingLanes|=t,e.suspendedLanes&=~t;var l=31-ot(t);e.entangledLanes|=t,e.entanglements[l]=e.entanglements[l]|1073741824|n&261930}function Uo(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var l=31-ot(n),a=1<<l;a&t|e[l]&t&&(e[l]|=t),n&=~a}}function qs(e,t){var n=t&-t;return n=(n&42)!==0?1:ma(n),(n&(e.suspendedLanes|t))!==0?0:n}function ma(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function st(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function rl(){var e=U.p;return e!==0?e:(e=window.event,e===void 0?32:sm(e.type))}function sn(e,t){var n=U.p;try{return U.p=e,t()}finally{U.p=n}}var it=Math.random().toString(36).slice(2),zt="__reactFiber$"+it,At="__reactProps$"+it,G="__reactContainer$"+it,Rn="__reactEvents$"+it,be="__reactListeners$"+it,Zs="__reactHandles$"+it,Xo="__reactResources$"+it,Ll="__reactMarker$"+it;function ha(e){delete e[zt],delete e[At],delete e[Rn],delete e[be],delete e[Zs]}function xn(e){var t=e[zt];if(t)return t;for(var n=e.parentNode;n;){if(t=n[G]||n[zt]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=$_(e);e!==null;){if(n=e[zt])return n;e=$_(e)}return t}e=n,n=e.parentNode}return null}function un(e){if(e=e[zt]||e[G]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function $t(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(c(33))}function vt(e){var t=e[Xo];return t||(t=e[Xo]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function mt(e){e[Ll]=!0}var Qo=new Set,Lt={};function Vt(e,t){Xe(e,t),Xe(e+"Capture",t)}function Xe(e,t){for(Lt[e]=t,e=0;e<t.length;e++)Qo.add(t[e])}var Go=RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"),vn={},$o={};function Bl(e){return ol.call($o,e)?!0:ol.call(vn,e)?!1:Go.test(e)?$o[e]=!0:(vn[e]=!0,!1)}function ga(e,t,n){if(Bl(t))if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var l=t.toLowerCase().slice(0,5);if(l!=="data-"&&l!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+n)}}function Va(e,t,n){if(n===null)e.removeAttribute(t);else{switch(typeof n){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+n)}}function Yn(e,t,n,l){if(l===null)e.removeAttribute(n);else{switch(typeof l){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(n);return}e.setAttributeNS(t,n,""+l)}}function qt(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function qo(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function pa(e,t,n){var l=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof l<"u"&&typeof l.get=="function"&&typeof l.set=="function"){var a=l.get,o=l.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return a.call(this)},set:function(i){n=""+i,o.call(this,i)}}),Object.defineProperty(e,t,{enumerable:l.enumerable}),{getValue:function(){return n},setValue:function(i){n=""+i},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Ja(e){if(!e._valueTracker){var t=qo(e)?"checked":"value";e._valueTracker=pa(e,t,""+e[t])}}function ya(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),l="";return e&&(l=qo(e)?e.checked?"true":"false":e.value),e=l,e!==n?(t.setValue(e),!0):!1}function Wn(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var Ka=/[\n"\\]/g;function Wt(e){return e.replace(Ka,function(t){return"\\"+t.charCodeAt(0).toString(16)+" "})}function In(e,t,n,l,a,o,i,r){e.name="",i!=null&&typeof i!="function"&&typeof i!="symbol"&&typeof i!="boolean"?e.type=i:e.removeAttribute("type"),t!=null?i==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+qt(t)):e.value!==""+qt(t)&&(e.value=""+qt(t)):i!=="submit"&&i!=="reset"||e.removeAttribute("value"),t!=null?ba(e,i,qt(t)):n!=null?ba(e,i,qt(n)):l!=null&&e.removeAttribute("value"),a==null&&o!=null&&(e.defaultChecked=!!o),a!=null&&(e.checked=a&&typeof a!="function"&&typeof a!="symbol"),r!=null&&typeof r!="function"&&typeof r!="symbol"&&typeof r!="boolean"?e.name=""+qt(r):e.removeAttribute("name")}function Sn(e,t,n,l,a,o,i,r){if(o!=null&&typeof o!="function"&&typeof o!="symbol"&&typeof o!="boolean"&&(e.type=o),t!=null||n!=null){if(!(o!=="submit"&&o!=="reset"||t!=null)){Ja(e);return}n=n!=null?""+qt(n):"",t=t!=null?""+qt(t):n,r||t===e.value||(e.value=t),e.defaultValue=t}l=l??a,l=typeof l!="function"&&typeof l!="symbol"&&!!l,e.checked=r?e.checked:!!l,e.defaultChecked=!!l,i!=null&&typeof i!="function"&&typeof i!="symbol"&&typeof i!="boolean"&&(e.name=i),Ja(e)}function ba(e,t,n){t==="number"&&Wn(e.ownerDocument)===e||e.defaultValue===""+n||(e.defaultValue=""+n)}function It(e,t,n,l){if(e=e.options,t){t={};for(var a=0;a<n.length;a++)t["$"+n[a]]=!0;for(n=0;n<e.length;n++)a=t.hasOwnProperty("$"+e[n].value),e[n].selected!==a&&(e[n].selected=a),a&&l&&(e[n].defaultSelected=!0)}else{for(n=""+qt(n),t=null,a=0;a<e.length;a++){if(e[a].value===n){e[a].selected=!0,l&&(e[a].defaultSelected=!0);return}t!==null||e[a].disabled||(t=e[a])}t!==null&&(t.selected=!0)}}function cn(e,t,n){if(t!=null&&(t=""+qt(t),t!==e.value&&(e.value=t),n==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=n!=null?""+qt(n):""}function Dl(e,t,n,l){if(t==null){if(l!=null){if(n!=null)throw Error(c(92));if(kt(l)){if(1<l.length)throw Error(c(93));l=l[0]}n=l}n==null&&(n=""),t=n}n=qt(t),e.defaultValue=n,l=e.textContent,l===n&&l!==""&&l!==null&&(e.value=l),Ja(e)}function wn(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var Wa=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function Zo(e,t,n){var l=t.indexOf("--")===0;n==null||typeof n=="boolean"||n===""?l?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":l?e.setProperty(t,n):typeof n!="number"||n===0||Wa.has(t)?t==="float"?e.cssFloat=n:e[t]=(""+n).trim():e[t]=n+"px"}function xa(e,t,n){if(t!=null&&typeof t!="object")throw Error(c(62));if(e=e.style,n!=null){for(var l in n)!n.hasOwnProperty(l)||t!=null&&t.hasOwnProperty(l)||(l.indexOf("--")===0?e.setProperty(l,""):l==="float"?e.cssFloat="":e[l]="");for(var a in t)l=t[a],t.hasOwnProperty(a)&&n[a]!==l&&Zo(e,a,l)}else for(var o in t)t.hasOwnProperty(o)&&Zo(e,o,t[o])}function Ia(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var Vo=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),hu=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function va(e){return hu.test(""+e)?"javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')":e}function Cn(){}var dl=null;function Ye(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var fl=null,_l=null;function Jo(e){var t=un(e);if(t&&(e=t.stateNode)){var n=e[At]||null;e:switch(e=t.stateNode,t.type){case"input":if(In(e,n.value,n.defaultValue,n.defaultValue,n.checked,n.defaultChecked,n.type,n.name),t=n.name,n.type==="radio"&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll('input[name="'+Wt(""+t)+'"][type="radio"]'),t=0;t<n.length;t++){var l=n[t];if(l!==e&&l.form===e.form){var a=l[At]||null;if(!a)throw Error(c(90));In(l,a.value,a.defaultValue,a.defaultValue,a.checked,a.defaultChecked,a.type,a.name)}}for(t=0;t<n.length;t++)l=n[t],l.form===e.form&&ya(l)}break e;case"textarea":cn(e,n.value,n.defaultValue);break e;case"select":t=n.value,t!=null&&It(e,!!n.multiple,t,!1)}}}var Rl=!1;function Fa(e,t,n){if(Rl)return e(t,n);Rl=!0;try{var l=e(t);return l}finally{if(Rl=!1,(fl!==null||_l!==null)&&(Mi(),fl&&(t=fl,e=_l,_l=fl=null,Jo(t),e)))for(t=0;t<e.length;t++)Jo(e[t])}}function Yl(e,t){var n=e.stateNode;if(n===null)return null;var l=n[At]||null;if(l===null)return null;n=l[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(l=!l.disabled)||(e=e.type,l=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!l;break e;default:e=!1}if(e)return null;if(n&&typeof n!="function")throw Error(c(231,t,typeof n));return n}var St=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Ko=!1;if(St)try{var Sa={};Object.defineProperty(Sa,"passive",{get:function(){Ko=!0}}),window.addEventListener("test",Sa,Sa),window.removeEventListener("test",Sa,Sa)}catch{Ko=!1}var jn=null,Hl=null,ml=null;function Vs(){if(ml)return ml;var e,t=Hl,n=t.length,l,a="value"in jn?jn.value:jn.textContent,o=a.length;for(e=0;e<n&&t[e]===a[e];e++);var i=n-e;for(l=1;l<=i&&t[n-l]===a[o-l];l++);return ml=a.slice(e,1<l?1-l:void 0)}function Pa(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Nn(){return!0}function eo(){return!1}function Bt(e){function t(n,l,a,o,i){this._reactName=n,this._targetInst=a,this.type=l,this.nativeEvent=o,this.target=i,this.currentTarget=null;for(var r in e)e.hasOwnProperty(r)&&(n=e[r],this[r]=n?n(o):o[r]);return this.isDefaultPrevented=(o.defaultPrevented!=null?o.defaultPrevented:o.returnValue===!1)?Nn:eo,this.isPropagationStopped=eo,this}return Z(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=Nn)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=Nn)},persist:function(){},isPersistent:Nn}),t}var hl={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Hn=Bt(hl),Fn=Z({},hl,{view:0,detail:0}),Js=Bt(Fn),to,f,m,M=Z({},Fn,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:wt,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==m&&(m&&e.type==="mousemove"?(to=e.screenX-m.screenX,f=e.screenY-m.screenY):f=to=0,m=e),to)},movementY:function(e){return"movementY"in e?e.movementY:f}}),Y=Bt(M),k=Z({},M,{dataTransfer:0}),Q=Bt(k),I=Z({},Fn,{relatedTarget:0}),F=Bt(I),_e=Z({},hl,{animationName:0,elapsedTime:0,pseudoElement:0}),de=Bt(_e),se=Z({},hl,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),re=Bt(se),fe=Z({},hl,{data:0}),ce=Bt(fe),te={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Ft={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},Qe={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Rt(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=Qe[e])?!!t[e]:!1}function wt(){return Rt}var Pt=Z({},Fn,{key:function(e){if(e.key){var t=te[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=Pa(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?Ft[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:wt,charCode:function(e){return e.type==="keypress"?Pa(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Pa(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),Ce=Bt(Pt),Se=Z({},M,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),yt=Bt(Se),ht=Z({},Fn,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:wt}),Pn=Bt(ht),Un=Z({},hl,{propertyName:0,elapsedTime:0,pseudoElement:0}),Ks=Bt(Un),gu=Z({},M,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),Ws=Bt(gu),pu=Z({},hl,{newState:0,oldState:0}),Jm=Bt(pu),Km=[9,13,27,32],yu=St&&"CompositionEvent"in window,Wo=null;St&&"documentMode"in document&&(Wo=document.documentMode);var Wm=St&&"TextEvent"in window&&!Wo,Xr=St&&(!yu||Wo&&8<Wo&&11>=Wo),Qr=" ",Gr=!1;function $r(e,t){switch(e){case"keyup":return Km.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function qr(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var no=!1;function Im(e,t){switch(e){case"compositionend":return qr(t);case"keypress":return t.which!==32?null:(Gr=!0,Qr);case"textInput":return e=t.data,e===Qr&&Gr?null:e;default:return null}}function Fm(e,t){if(no)return e==="compositionend"||!yu&&$r(e,t)?(e=Vs(),ml=Hl=jn=null,no=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return Xr&&t.locale!=="ko"?null:t.data;default:return null}}var Pm={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Zr(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!Pm[e.type]:t==="textarea"}function Vr(e,t,n,l){fl?_l?_l.push(l):_l=[l]:fl=l,t=Hi(t,"onChange"),0<t.length&&(n=new Hn("onChange","change",null,n,l),e.push({event:n,listeners:t}))}var Io=null,Fo=null;function e0(e){z_(e,0)}function Is(e){var t=$t(e);if(ya(t))return e}function Jr(e,t){if(e==="change")return t}var Kr=!1;if(St){var bu;if(St){var xu="oninput"in document;if(!xu){var Wr=document.createElement("div");Wr.setAttribute("oninput","return;"),xu=typeof Wr.oninput=="function"}bu=xu}else bu=!1;Kr=bu&&(!document.documentMode||9<document.documentMode)}function Ir(){Io&&(Io.detachEvent("onpropertychange",Fr),Fo=Io=null)}function Fr(e){if(e.propertyName==="value"&&Is(Fo)){var t=[];Vr(t,Fo,e,Ye(e)),Fa(e0,t)}}function t0(e,t,n){e==="focusin"?(Ir(),Io=t,Fo=n,Io.attachEvent("onpropertychange",Fr)):e==="focusout"&&Ir()}function n0(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return Is(Fo)}function l0(e,t){if(e==="click")return Is(t)}function a0(e,t){if(e==="input"||e==="change")return Is(t)}function o0(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var rn=typeof Object.is=="function"?Object.is:o0;function Po(e,t){if(rn(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var n=Object.keys(e),l=Object.keys(t);if(n.length!==l.length)return!1;for(l=0;l<n.length;l++){var a=n[l];if(!ol.call(t,a)||!rn(e[a],t[a]))return!1}return!0}function Pr(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function ed(e,t){var n=Pr(e);e=0;for(var l;n;){if(n.nodeType===3){if(l=e+n.textContent.length,e<=t&&l>=t)return{node:n,offset:t-e};e=l}e:{for(;n;){if(n.nextSibling){n=n.nextSibling;break e}n=n.parentNode}n=void 0}n=Pr(n)}}function td(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?td(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function nd(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=Wn(e.document);t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href=="string"}catch{n=!1}if(n)e=t.contentWindow;else break;t=Wn(e.document)}return t}function vu(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var s0=St&&"documentMode"in document&&11>=document.documentMode,lo=null,Su=null,es=null,wu=!1;function ld(e,t,n){var l=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;wu||lo==null||lo!==Wn(l)||(l=lo,"selectionStart"in l&&vu(l)?l={start:l.selectionStart,end:l.selectionEnd}:(l=(l.ownerDocument&&l.ownerDocument.defaultView||window).getSelection(),l={anchorNode:l.anchorNode,anchorOffset:l.anchorOffset,focusNode:l.focusNode,focusOffset:l.focusOffset}),es&&Po(es,l)||(es=l,l=Hi(Su,"onSelect"),0<l.length&&(t=new Hn("onSelect","select",null,t,n),e.push({event:t,listeners:l}),t.target=lo)))}function wa(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n["Webkit"+e]="webkit"+t,n["Moz"+e]="moz"+t,n}var ao={animationend:wa("Animation","AnimationEnd"),animationiteration:wa("Animation","AnimationIteration"),animationstart:wa("Animation","AnimationStart"),transitionrun:wa("Transition","TransitionRun"),transitionstart:wa("Transition","TransitionStart"),transitioncancel:wa("Transition","TransitionCancel"),transitionend:wa("Transition","TransitionEnd")},Cu={},ad={};St&&(ad=document.createElement("div").style,"AnimationEvent"in window||(delete ao.animationend.animation,delete ao.animationiteration.animation,delete ao.animationstart.animation),"TransitionEvent"in window||delete ao.transitionend.transition);function Ca(e){if(Cu[e])return Cu[e];if(!ao[e])return e;var t=ao[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in ad)return Cu[e]=t[n];return e}var od=Ca("animationend"),sd=Ca("animationiteration"),id=Ca("animationstart"),i0=Ca("transitionrun"),u0=Ca("transitionstart"),c0=Ca("transitioncancel"),ud=Ca("transitionend"),cd=new Map,ju="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");ju.push("scrollEnd");function Xn(e,t){cd.set(e,t),Vt(t,[e])}var Fs=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},En=[],oo=0,Nu=0;function Ps(){for(var e=oo,t=Nu=oo=0;t<e;){var n=En[t];En[t++]=null;var l=En[t];En[t++]=null;var a=En[t];En[t++]=null;var o=En[t];if(En[t++]=null,l!==null&&a!==null){var i=l.pending;i===null?a.next=a:(a.next=i.next,i.next=a),l.pending=a}o!==0&&rd(n,a,o)}}function ei(e,t,n,l){En[oo++]=e,En[oo++]=t,En[oo++]=n,En[oo++]=l,Nu|=l,e.lanes|=l,e=e.alternate,e!==null&&(e.lanes|=l)}function Eu(e,t,n,l){return ei(e,t,n,l),ti(e)}function ja(e,t){return ei(e,null,null,t),ti(e)}function rd(e,t,n){e.lanes|=n;var l=e.alternate;l!==null&&(l.lanes|=n);for(var a=!1,o=e.return;o!==null;)o.childLanes|=n,l=o.alternate,l!==null&&(l.childLanes|=n),o.tag===22&&(e=o.stateNode,e===null||e._visibility&1||(a=!0)),e=o,o=o.return;return e.tag===3?(o=e.stateNode,a&&t!==null&&(a=31-ot(n),e=o.hiddenUpdates,l=e[a],l===null?e[a]=[t]:l.push(t),t.lane=n|536870912),o):null}function ti(e){if(50<Ss)throw Ss=0,Dc=null,Error(c(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var so={};function r0(e,t,n,l){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=l,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function dn(e,t,n,l){return new r0(e,t,n,l)}function Tu(e){return e=e.prototype,!(!e||!e.isReactComponent)}function gl(e,t){var n=e.alternate;return n===null?(n=dn(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&65011712,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n.refCleanup=e.refCleanup,n}function dd(e,t){e.flags&=65011714;var n=e.alternate;return n===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=n.childLanes,e.lanes=n.lanes,e.child=n.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=n.memoizedProps,e.memoizedState=n.memoizedState,e.updateQueue=n.updateQueue,e.type=n.type,t=n.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function ni(e,t,n,l,a,o){var i=0;if(l=e,typeof e=="function")Tu(e)&&(i=1);else if(typeof e=="string")i=hh(e,n,B.current)?26:e==="html"||e==="head"||e==="body"?27:5;else e:switch(e){case Tt:return e=dn(31,n,t,a),e.elementType=Tt,e.lanes=o,e;case ye:return Na(n.children,a,o,t);case Ot:i=8,a|=24;break;case ee:return e=dn(12,n,t,a|2),e.elementType=ee,e.lanes=o,e;case ft:return e=dn(13,n,t,a),e.elementType=ft,e.lanes=o,e;case tt:return e=dn(19,n,t,a),e.elementType=tt,e.lanes=o,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case ct:i=10;break e;case Gt:i=9;break e;case et:i=11;break e;case q:i=14;break e;case rt:i=16,l=null;break e}i=29,n=Error(c(130,e===null?"null":typeof e,"")),l=null}return t=dn(i,n,t,a),t.elementType=e,t.type=l,t.lanes=o,t}function Na(e,t,n,l){return e=dn(7,e,l,t),e.lanes=n,e}function ku(e,t,n){return e=dn(6,e,null,t),e.lanes=n,e}function fd(e){var t=dn(18,null,null,0);return t.stateNode=e,t}function zu(e,t,n){return t=dn(4,e.children!==null?e.children:[],e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var _d=new WeakMap;function Tn(e,t){if(typeof e=="object"&&e!==null){var n=_d.get(e);return n!==void 0?n:(t={value:e,source:t,stack:Ro(t)},_d.set(e,t),t)}return{value:e,source:t,stack:Ro(t)}}var io=[],uo=0,li=null,ts=0,kn=[],zn=0,Ul=null,el=1,tl="";function pl(e,t){io[uo++]=ts,io[uo++]=li,li=e,ts=t}function md(e,t,n){kn[zn++]=el,kn[zn++]=tl,kn[zn++]=Ul,Ul=e;var l=el;e=tl;var a=32-ot(l)-1;l&=~(1<<a),n+=1;var o=32-ot(t)+a;if(30<o){var i=a-a%5;o=(l&(1<<i)-1).toString(32),l>>=i,a-=i,el=1<<32-ot(t)+a|n<<a|l,tl=o+e}else el=1<<o|n<<a|l,tl=e}function Au(e){e.return!==null&&(pl(e,1),md(e,1,0))}function Mu(e){for(;e===li;)li=io[--uo],io[uo]=null,ts=io[--uo],io[uo]=null;for(;e===Ul;)Ul=kn[--zn],kn[zn]=null,tl=kn[--zn],kn[zn]=null,el=kn[--zn],kn[zn]=null}function hd(e,t){kn[zn++]=el,kn[zn++]=tl,kn[zn++]=Ul,el=t.id,tl=t.overflow,Ul=e}var Yt=null,nt=null,Me=!1,Xl=null,An=!1,Ou=Error(c(519));function Ql(e){var t=Error(c(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw ns(Tn(t,e)),Ou}function gd(e){var t=e.stateNode,n=e.type,l=e.memoizedProps;switch(t[zt]=e,t[At]=l,n){case"dialog":Ne("cancel",t),Ne("close",t);break;case"iframe":case"object":case"embed":Ne("load",t);break;case"video":case"audio":for(n=0;n<Cs.length;n++)Ne(Cs[n],t);break;case"source":Ne("error",t);break;case"img":case"image":case"link":Ne("error",t),Ne("load",t);break;case"details":Ne("toggle",t);break;case"input":Ne("invalid",t),Sn(t,l.value,l.defaultValue,l.checked,l.defaultChecked,l.type,l.name,!0);break;case"select":Ne("invalid",t);break;case"textarea":Ne("invalid",t),Dl(t,l.value,l.defaultValue,l.children)}n=l.children,typeof n!="string"&&typeof n!="number"&&typeof n!="bigint"||t.textContent===""+n||l.suppressHydrationWarning===!0||L_(t.textContent,n)?(l.popover!=null&&(Ne("beforetoggle",t),Ne("toggle",t)),l.onScroll!=null&&Ne("scroll",t),l.onScrollEnd!=null&&Ne("scrollend",t),l.onClick!=null&&(t.onclick=Cn),t=!0):t=!1,t||Ql(e,!0)}function pd(e){for(Yt=e.return;Yt;)switch(Yt.tag){case 5:case 31:case 13:An=!1;return;case 27:case 3:An=!0;return;default:Yt=Yt.return}}function co(e){if(e!==Yt)return!1;if(!Me)return pd(e),Me=!0,!1;var t=e.tag,n;if((n=t!==3&&t!==27)&&((n=t===5)&&(n=e.type,n=!(n!=="form"&&n!=="button")||Ic(e.type,e.memoizedProps)),n=!n),n&&nt&&Ql(e),pd(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(c(317));nt=G_(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(c(317));nt=G_(e)}else t===27?(t=nt,na(e.type)?(e=nr,nr=null,nt=e):nt=t):nt=Yt?On(e.stateNode.nextSibling):null;return!0}function Ea(){nt=Yt=null,Me=!1}function Lu(){var e=Xl;return e!==null&&(ln===null?ln=e:ln.push.apply(ln,e),Xl=null),e}function ns(e){Xl===null?Xl=[e]:Xl.push(e)}var Bu=p(null),Ta=null,yl=null;function Gl(e,t,n){H(Bu,t._currentValue),t._currentValue=n}function bl(e){e._currentValue=Bu.current,S(Bu)}function Du(e,t,n){for(;e!==null;){var l=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,l!==null&&(l.childLanes|=t)):l!==null&&(l.childLanes&t)!==t&&(l.childLanes|=t),e===n)break;e=e.return}}function Ru(e,t,n,l){var a=e.child;for(a!==null&&(a.return=e);a!==null;){var o=a.dependencies;if(o!==null){var i=a.child;o=o.firstContext;e:for(;o!==null;){var r=o;o=a;for(var g=0;g<t.length;g++)if(r.context===t[g]){o.lanes|=n,r=o.alternate,r!==null&&(r.lanes|=n),Du(o.return,n,e),l||(i=null);break e}o=r.next}}else if(a.tag===18){if(i=a.return,i===null)throw Error(c(341));i.lanes|=n,o=i.alternate,o!==null&&(o.lanes|=n),Du(i,n,e),i=null}else i=a.child;if(i!==null)i.return=a;else for(i=a;i!==null;){if(i===e){i=null;break}if(a=i.sibling,a!==null){a.return=i.return,i=a;break}i=i.return}a=i}}function ro(e,t,n,l){e=null;for(var a=t,o=!1;a!==null;){if(!o){if((a.flags&524288)!==0)o=!0;else if((a.flags&262144)!==0)break}if(a.tag===10){var i=a.alternate;if(i===null)throw Error(c(387));if(i=i.memoizedProps,i!==null){var r=a.type;rn(a.pendingProps.value,i.value)||(e!==null?e.push(r):e=[r])}}else if(a===Te.current){if(i=a.alternate,i===null)throw Error(c(387));i.memoizedState.memoizedState!==a.memoizedState.memoizedState&&(e!==null?e.push(ks):e=[ks])}a=a.return}e!==null&&Ru(t,e,n,l),t.flags|=262144}function ai(e){for(e=e.firstContext;e!==null;){if(!rn(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function ka(e){Ta=e,yl=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function Ht(e){return yd(Ta,e)}function oi(e,t){return Ta===null&&ka(e),yd(e,t)}function yd(e,t){var n=t._currentValue;if(t={context:t,memoizedValue:n,next:null},yl===null){if(e===null)throw Error(c(308));yl=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else yl=yl.next=t;return n}var d0=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(n,l){e.push(l)}};this.abort=function(){t.aborted=!0,e.forEach(function(n){return n()})}},f0=u.unstable_scheduleCallback,_0=u.unstable_NormalPriority,Ct={$$typeof:ct,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function Yu(){return{controller:new d0,data:new Map,refCount:0}}function ls(e){e.refCount--,e.refCount===0&&f0(_0,function(){e.controller.abort()})}var as=null,Hu=0,fo=0,_o=null;function m0(e,t){if(as===null){var n=as=[];Hu=0,fo=Qc(),_o={status:"pending",value:void 0,then:function(l){n.push(l)}}}return Hu++,t.then(bd,bd),t}function bd(){if(--Hu===0&&as!==null){_o!==null&&(_o.status="fulfilled");var e=as;as=null,fo=0,_o=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function h0(e,t){var n=[],l={status:"pending",value:null,reason:null,then:function(a){n.push(a)}};return e.then(function(){l.status="fulfilled",l.value=t;for(var a=0;a<n.length;a++)(0,n[a])(t)},function(a){for(l.status="rejected",l.reason=a,a=0;a<n.length;a++)(0,n[a])(void 0)}),l}var xd=z.S;z.S=function(e,t){a_=ie(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&m0(e,t),xd!==null&&xd(e,t)};var za=p(null);function Uu(){var e=za.current;return e!==null?e:Pe.pooledCache}function si(e,t){t===null?H(za,za.current):H(za,t.pool)}function vd(){var e=Uu();return e===null?null:{parent:Ct._currentValue,pool:e}}var mo=Error(c(460)),Xu=Error(c(474)),ii=Error(c(542)),ui={then:function(){}};function Sd(e){return e=e.status,e==="fulfilled"||e==="rejected"}function wd(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(Cn,Cn),t=n),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,jd(e),e;default:if(typeof t.status=="string")t.then(Cn,Cn);else{if(e=Pe,e!==null&&100<e.shellSuspendCounter)throw Error(c(482));e=t,e.status="pending",e.then(function(l){if(t.status==="pending"){var a=t;a.status="fulfilled",a.value=l}},function(l){if(t.status==="pending"){var a=t;a.status="rejected",a.reason=l}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,jd(e),e}throw Ma=t,mo}}function Aa(e){try{var t=e._init;return t(e._payload)}catch(n){throw n!==null&&typeof n=="object"&&typeof n.then=="function"?(Ma=n,mo):n}}var Ma=null;function Cd(){if(Ma===null)throw Error(c(459));var e=Ma;return Ma=null,e}function jd(e){if(e===mo||e===ii)throw Error(c(483))}var ho=null,os=0;function ci(e){var t=os;return os+=1,ho===null&&(ho=[]),wd(ho,e,t)}function ss(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function ri(e,t){throw t.$$typeof===pe?Error(c(525)):(e=Object.prototype.toString.call(t),Error(c(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function Nd(e){function t(x,y){if(e){var w=x.deletions;w===null?(x.deletions=[y],x.flags|=16):w.push(y)}}function n(x,y){if(!e)return null;for(;y!==null;)t(x,y),y=y.sibling;return null}function l(x){for(var y=new Map;x!==null;)x.key!==null?y.set(x.key,x):y.set(x.index,x),x=x.sibling;return y}function a(x,y){return x=gl(x,y),x.index=0,x.sibling=null,x}function o(x,y,w){return x.index=w,e?(w=x.alternate,w!==null?(w=w.index,w<y?(x.flags|=67108866,y):w):(x.flags|=67108866,y)):(x.flags|=1048576,y)}function i(x){return e&&x.alternate===null&&(x.flags|=67108866),x}function r(x,y,w,D){return y===null||y.tag!==6?(y=ku(w,x.mode,D),y.return=x,y):(y=a(y,w),y.return=x,y)}function g(x,y,w,D){var ae=w.type;return ae===ye?L(x,y,w.props.children,D,w.key):y!==null&&(y.elementType===ae||typeof ae=="object"&&ae!==null&&ae.$$typeof===rt&&Aa(ae)===y.type)?(y=a(y,w.props),ss(y,w),y.return=x,y):(y=ni(w.type,w.key,w.props,null,x.mode,D),ss(y,w),y.return=x,y)}function C(x,y,w,D){return y===null||y.tag!==4||y.stateNode.containerInfo!==w.containerInfo||y.stateNode.implementation!==w.implementation?(y=zu(w,x.mode,D),y.return=x,y):(y=a(y,w.children||[]),y.return=x,y)}function L(x,y,w,D,ae){return y===null||y.tag!==7?(y=Na(w,x.mode,D,ae),y.return=x,y):(y=a(y,w),y.return=x,y)}function R(x,y,w){if(typeof y=="string"&&y!==""||typeof y=="number"||typeof y=="bigint")return y=ku(""+y,x.mode,w),y.return=x,y;if(typeof y=="object"&&y!==null){switch(y.$$typeof){case he:return w=ni(y.type,y.key,y.props,null,x.mode,w),ss(w,y),w.return=x,w;case Re:return y=zu(y,x.mode,w),y.return=x,y;case rt:return y=Aa(y),R(x,y,w)}if(kt(y)||oe(y))return y=Na(y,x.mode,w,null),y.return=x,y;if(typeof y.then=="function")return R(x,ci(y),w);if(y.$$typeof===ct)return R(x,oi(x,y),w);ri(x,y)}return null}function j(x,y,w,D){var ae=y!==null?y.key:null;if(typeof w=="string"&&w!==""||typeof w=="number"||typeof w=="bigint")return ae!==null?null:r(x,y,""+w,D);if(typeof w=="object"&&w!==null){switch(w.$$typeof){case he:return w.key===ae?g(x,y,w,D):null;case Re:return w.key===ae?C(x,y,w,D):null;case rt:return w=Aa(w),j(x,y,w,D)}if(kt(w)||oe(w))return ae!==null?null:L(x,y,w,D,null);if(typeof w.then=="function")return j(x,y,ci(w),D);if(w.$$typeof===ct)return j(x,y,oi(x,w),D);ri(x,w)}return null}function T(x,y,w,D,ae){if(typeof D=="string"&&D!==""||typeof D=="number"||typeof D=="bigint")return x=x.get(w)||null,r(y,x,""+D,ae);if(typeof D=="object"&&D!==null){switch(D.$$typeof){case he:return x=x.get(D.key===null?w:D.key)||null,g(y,x,D,ae);case Re:return x=x.get(D.key===null?w:D.key)||null,C(y,x,D,ae);case rt:return D=Aa(D),T(x,y,w,D,ae)}if(kt(D)||oe(D))return x=x.get(w)||null,L(y,x,D,ae,null);if(typeof D.then=="function")return T(x,y,w,ci(D),ae);if(D.$$typeof===ct)return T(x,y,w,oi(y,D),ae);ri(y,D)}return null}function W(x,y,w,D){for(var ae=null,Be=null,P=y,ve=y=0,ze=null;P!==null&&ve<w.length;ve++){P.index>ve?(ze=P,P=null):ze=P.sibling;var De=j(x,P,w[ve],D);if(De===null){P===null&&(P=ze);break}e&&P&&De.alternate===null&&t(x,P),y=o(De,y,ve),Be===null?ae=De:Be.sibling=De,Be=De,P=ze}if(ve===w.length)return n(x,P),Me&&pl(x,ve),ae;if(P===null){for(;ve<w.length;ve++)P=R(x,w[ve],D),P!==null&&(y=o(P,y,ve),Be===null?ae=P:Be.sibling=P,Be=P);return Me&&pl(x,ve),ae}for(P=l(P);ve<w.length;ve++)ze=T(P,x,ve,w[ve],D),ze!==null&&(e&&ze.alternate!==null&&P.delete(ze.key===null?ve:ze.key),y=o(ze,y,ve),Be===null?ae=ze:Be.sibling=ze,Be=ze);return e&&P.forEach(function(ia){return t(x,ia)}),Me&&pl(x,ve),ae}function ue(x,y,w,D){if(w==null)throw Error(c(151));for(var ae=null,Be=null,P=y,ve=y=0,ze=null,De=w.next();P!==null&&!De.done;ve++,De=w.next()){P.index>ve?(ze=P,P=null):ze=P.sibling;var ia=j(x,P,De.value,D);if(ia===null){P===null&&(P=ze);break}e&&P&&ia.alternate===null&&t(x,P),y=o(ia,y,ve),Be===null?ae=ia:Be.sibling=ia,Be=ia,P=ze}if(De.done)return n(x,P),Me&&pl(x,ve),ae;if(P===null){for(;!De.done;ve++,De=w.next())De=R(x,De.value,D),De!==null&&(y=o(De,y,ve),Be===null?ae=De:Be.sibling=De,Be=De);return Me&&pl(x,ve),ae}for(P=l(P);!De.done;ve++,De=w.next())De=T(P,x,ve,De.value,D),De!==null&&(e&&De.alternate!==null&&P.delete(De.key===null?ve:De.key),y=o(De,y,ve),Be===null?ae=De:Be.sibling=De,Be=De);return e&&P.forEach(function(Nh){return t(x,Nh)}),Me&&pl(x,ve),ae}function We(x,y,w,D){if(typeof w=="object"&&w!==null&&w.type===ye&&w.key===null&&(w=w.props.children),typeof w=="object"&&w!==null){switch(w.$$typeof){case he:e:{for(var ae=w.key;y!==null;){if(y.key===ae){if(ae=w.type,ae===ye){if(y.tag===7){n(x,y.sibling),D=a(y,w.props.children),D.return=x,x=D;break e}}else if(y.elementType===ae||typeof ae=="object"&&ae!==null&&ae.$$typeof===rt&&Aa(ae)===y.type){n(x,y.sibling),D=a(y,w.props),ss(D,w),D.return=x,x=D;break e}n(x,y);break}else t(x,y);y=y.sibling}w.type===ye?(D=Na(w.props.children,x.mode,D,w.key),D.return=x,x=D):(D=ni(w.type,w.key,w.props,null,x.mode,D),ss(D,w),D.return=x,x=D)}return i(x);case Re:e:{for(ae=w.key;y!==null;){if(y.key===ae)if(y.tag===4&&y.stateNode.containerInfo===w.containerInfo&&y.stateNode.implementation===w.implementation){n(x,y.sibling),D=a(y,w.children||[]),D.return=x,x=D;break e}else{n(x,y);break}else t(x,y);y=y.sibling}D=zu(w,x.mode,D),D.return=x,x=D}return i(x);case rt:return w=Aa(w),We(x,y,w,D)}if(kt(w))return W(x,y,w,D);if(oe(w)){if(ae=oe(w),typeof ae!="function")throw Error(c(150));return w=ae.call(w),ue(x,y,w,D)}if(typeof w.then=="function")return We(x,y,ci(w),D);if(w.$$typeof===ct)return We(x,y,oi(x,w),D);ri(x,w)}return typeof w=="string"&&w!==""||typeof w=="number"||typeof w=="bigint"?(w=""+w,y!==null&&y.tag===6?(n(x,y.sibling),D=a(y,w),D.return=x,x=D):(n(x,y),D=ku(w,x.mode,D),D.return=x,x=D),i(x)):n(x,y)}return function(x,y,w,D){try{os=0;var ae=We(x,y,w,D);return ho=null,ae}catch(P){if(P===mo||P===ii)throw P;var Be=dn(29,P,null,x.mode);return Be.lanes=D,Be.return=x,Be}}}var Oa=Nd(!0),Ed=Nd(!1),$l=!1;function Qu(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function Gu(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function ql(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Zl(e,t,n){var l=e.updateQueue;if(l===null)return null;if(l=l.shared,(He&2)!==0){var a=l.pending;return a===null?t.next=t:(t.next=a.next,a.next=t),l.pending=t,t=ti(e),rd(e,null,n),t}return ei(e,l,t,n),ti(e)}function is(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,(n&4194048)!==0)){var l=t.lanes;l&=e.pendingLanes,n|=l,t.lanes=n,Uo(e,n)}}function $u(e,t){var n=e.updateQueue,l=e.alternate;if(l!==null&&(l=l.updateQueue,n===l)){var a=null,o=null;if(n=n.firstBaseUpdate,n!==null){do{var i={lane:n.lane,tag:n.tag,payload:n.payload,callback:null,next:null};o===null?a=o=i:o=o.next=i,n=n.next}while(n!==null);o===null?a=o=t:o=o.next=t}else a=o=t;n={baseState:l.baseState,firstBaseUpdate:a,lastBaseUpdate:o,shared:l.shared,callbacks:l.callbacks},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}var qu=!1;function us(){if(qu){var e=_o;if(e!==null)throw e}}function cs(e,t,n,l){qu=!1;var a=e.updateQueue;$l=!1;var o=a.firstBaseUpdate,i=a.lastBaseUpdate,r=a.shared.pending;if(r!==null){a.shared.pending=null;var g=r,C=g.next;g.next=null,i===null?o=C:i.next=C,i=g;var L=e.alternate;L!==null&&(L=L.updateQueue,r=L.lastBaseUpdate,r!==i&&(r===null?L.firstBaseUpdate=C:r.next=C,L.lastBaseUpdate=g))}if(o!==null){var R=a.baseState;i=0,L=C=g=null,r=o;do{var j=r.lane&-536870913,T=j!==r.lane;if(T?(ke&j)===j:(l&j)===j){j!==0&&j===fo&&(qu=!0),L!==null&&(L=L.next={lane:0,tag:r.tag,payload:r.payload,callback:null,next:null});e:{var W=e,ue=r;j=t;var We=n;switch(ue.tag){case 1:if(W=ue.payload,typeof W=="function"){R=W.call(We,R,j);break e}R=W;break e;case 3:W.flags=W.flags&-65537|128;case 0:if(W=ue.payload,j=typeof W=="function"?W.call(We,R,j):W,j==null)break e;R=Z({},R,j);break e;case 2:$l=!0}}j=r.callback,j!==null&&(e.flags|=64,T&&(e.flags|=8192),T=a.callbacks,T===null?a.callbacks=[j]:T.push(j))}else T={lane:j,tag:r.tag,payload:r.payload,callback:r.callback,next:null},L===null?(C=L=T,g=R):L=L.next=T,i|=j;if(r=r.next,r===null){if(r=a.shared.pending,r===null)break;T=r,r=T.next,T.next=null,a.lastBaseUpdate=T,a.shared.pending=null}}while(!0);L===null&&(g=R),a.baseState=g,a.firstBaseUpdate=C,a.lastBaseUpdate=L,o===null&&(a.shared.lanes=0),Il|=i,e.lanes=i,e.memoizedState=R}}function Td(e,t){if(typeof e!="function")throw Error(c(191,e));e.call(t)}function kd(e,t){var n=e.callbacks;if(n!==null)for(e.callbacks=null,e=0;e<n.length;e++)Td(n[e],t)}var go=p(null),di=p(0);function zd(e,t){e=Tl,H(di,e),H(go,t),Tl=e|t.baseLanes}function Zu(){H(di,Tl),H(go,go.current)}function Vu(){Tl=di.current,S(go),S(di)}var fn=p(null),Mn=null;function Vl(e){var t=e.alternate;H(bt,bt.current&1),H(fn,e),Mn===null&&(t===null||go.current!==null||t.memoizedState!==null)&&(Mn=e)}function Ju(e){H(bt,bt.current),H(fn,e),Mn===null&&(Mn=e)}function Ad(e){e.tag===22?(H(bt,bt.current),H(fn,e),Mn===null&&(Mn=e)):Jl()}function Jl(){H(bt,bt.current),H(fn,fn.current)}function _n(e){S(fn),Mn===e&&(Mn=null),S(bt)}var bt=p(0);function fi(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||er(n)||tr(n)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var xl=0,xe=null,Je=null,jt=null,_i=!1,po=!1,La=!1,mi=0,rs=0,yo=null,g0=0;function gt(){throw Error(c(321))}function Ku(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!rn(e[n],t[n]))return!1;return!0}function Wu(e,t,n,l,a,o){return xl=o,xe=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,z.H=e===null||e.memoizedState===null?hf:dc,La=!1,o=n(l,a),La=!1,po&&(o=Od(t,n,l,a)),Md(e),o}function Md(e){z.H=_s;var t=Je!==null&&Je.next!==null;if(xl=0,jt=Je=xe=null,_i=!1,rs=0,yo=null,t)throw Error(c(300));e===null||Nt||(e=e.dependencies,e!==null&&ai(e)&&(Nt=!0))}function Od(e,t,n,l){xe=e;var a=0;do{if(po&&(yo=null),rs=0,po=!1,25<=a)throw Error(c(301));if(a+=1,jt=Je=null,e.updateQueue!=null){var o=e.updateQueue;o.lastEffect=null,o.events=null,o.stores=null,o.memoCache!=null&&(o.memoCache.index=0)}z.H=gf,o=t(n,l)}while(po);return o}function p0(){var e=z.H,t=e.useState()[0];return t=typeof t.then=="function"?ds(t):t,e=e.useState()[0],(Je!==null?Je.memoizedState:null)!==e&&(xe.flags|=1024),t}function Iu(){var e=mi!==0;return mi=0,e}function Fu(e,t,n){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~n}function Pu(e){if(_i){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}_i=!1}xl=0,jt=Je=xe=null,po=!1,rs=mi=0,yo=null}function Jt(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return jt===null?xe.memoizedState=jt=e:jt=jt.next=e,jt}function xt(){if(Je===null){var e=xe.alternate;e=e!==null?e.memoizedState:null}else e=Je.next;var t=jt===null?xe.memoizedState:jt.next;if(t!==null)jt=t,Je=e;else{if(e===null)throw xe.alternate===null?Error(c(467)):Error(c(310));Je=e,e={memoizedState:Je.memoizedState,baseState:Je.baseState,baseQueue:Je.baseQueue,queue:Je.queue,next:null},jt===null?xe.memoizedState=jt=e:jt=jt.next=e}return jt}function hi(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function ds(e){var t=rs;return rs+=1,yo===null&&(yo=[]),e=wd(yo,e,t),t=xe,(jt===null?t.memoizedState:jt.next)===null&&(t=t.alternate,z.H=t===null||t.memoizedState===null?hf:dc),e}function gi(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return ds(e);if(e.$$typeof===ct)return Ht(e)}throw Error(c(438,String(e)))}function ec(e){var t=null,n=xe.updateQueue;if(n!==null&&(t=n.memoCache),t==null){var l=xe.alternate;l!==null&&(l=l.updateQueue,l!==null&&(l=l.memoCache,l!=null&&(t={data:l.data.map(function(a){return a.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),n===null&&(n=hi(),xe.updateQueue=n),n.memoCache=t,n=t.data[t.index],n===void 0)for(n=t.data[t.index]=Array(e),l=0;l<e;l++)n[l]=on;return t.index++,n}function vl(e,t){return typeof t=="function"?t(e):t}function pi(e){var t=xt();return tc(t,Je,e)}function tc(e,t,n){var l=e.queue;if(l===null)throw Error(c(311));l.lastRenderedReducer=n;var a=e.baseQueue,o=l.pending;if(o!==null){if(a!==null){var i=a.next;a.next=o.next,o.next=i}t.baseQueue=a=o,l.pending=null}if(o=e.baseState,a===null)e.memoizedState=o;else{t=a.next;var r=i=null,g=null,C=t,L=!1;do{var R=C.lane&-536870913;if(R!==C.lane?(ke&R)===R:(xl&R)===R){var j=C.revertLane;if(j===0)g!==null&&(g=g.next={lane:0,revertLane:0,gesture:null,action:C.action,hasEagerState:C.hasEagerState,eagerState:C.eagerState,next:null}),R===fo&&(L=!0);else if((xl&j)===j){C=C.next,j===fo&&(L=!0);continue}else R={lane:0,revertLane:C.revertLane,gesture:null,action:C.action,hasEagerState:C.hasEagerState,eagerState:C.eagerState,next:null},g===null?(r=g=R,i=o):g=g.next=R,xe.lanes|=j,Il|=j;R=C.action,La&&n(o,R),o=C.hasEagerState?C.eagerState:n(o,R)}else j={lane:R,revertLane:C.revertLane,gesture:C.gesture,action:C.action,hasEagerState:C.hasEagerState,eagerState:C.eagerState,next:null},g===null?(r=g=j,i=o):g=g.next=j,xe.lanes|=R,Il|=R;C=C.next}while(C!==null&&C!==t);if(g===null?i=o:g.next=r,!rn(o,e.memoizedState)&&(Nt=!0,L&&(n=_o,n!==null)))throw n;e.memoizedState=o,e.baseState=i,e.baseQueue=g,l.lastRenderedState=o}return a===null&&(l.lanes=0),[e.memoizedState,l.dispatch]}function nc(e){var t=xt(),n=t.queue;if(n===null)throw Error(c(311));n.lastRenderedReducer=e;var l=n.dispatch,a=n.pending,o=t.memoizedState;if(a!==null){n.pending=null;var i=a=a.next;do o=e(o,i.action),i=i.next;while(i!==a);rn(o,t.memoizedState)||(Nt=!0),t.memoizedState=o,t.baseQueue===null&&(t.baseState=o),n.lastRenderedState=o}return[o,l]}function Ld(e,t,n){var l=xe,a=xt(),o=Me;if(o){if(n===void 0)throw Error(c(407));n=n()}else n=t();var i=!rn((Je||a).memoizedState,n);if(i&&(a.memoizedState=n,Nt=!0),a=a.queue,oc(Rd.bind(null,l,a,e),[e]),a.getSnapshot!==t||i||jt!==null&&jt.memoizedState.tag&1){if(l.flags|=2048,bo(9,{destroy:void 0},Dd.bind(null,l,a,n,t),null),Pe===null)throw Error(c(349));o||(xl&127)!==0||Bd(l,t,n)}return n}function Bd(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=xe.updateQueue,t===null?(t=hi(),xe.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function Dd(e,t,n,l){t.value=n,t.getSnapshot=l,Yd(t)&&Hd(e)}function Rd(e,t,n){return n(function(){Yd(t)&&Hd(e)})}function Yd(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!rn(e,n)}catch{return!0}}function Hd(e){var t=ja(e,2);t!==null&&an(t,e,2)}function lc(e){var t=Jt();if(typeof e=="function"){var n=e;if(e=n(),La){Zn(!0);try{n()}finally{Zn(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:vl,lastRenderedState:e},t}function Ud(e,t,n,l){return e.baseState=n,tc(e,Je,typeof l=="function"?l:vl)}function y0(e,t,n,l,a){if(xi(e))throw Error(c(485));if(e=t.action,e!==null){var o={payload:a,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(i){o.listeners.push(i)}};z.T!==null?n(!0):o.isTransition=!1,l(o),n=t.pending,n===null?(o.next=t.pending=o,Xd(t,o)):(o.next=n.next,t.pending=n.next=o)}}function Xd(e,t){var n=t.action,l=t.payload,a=e.state;if(t.isTransition){var o=z.T,i={};z.T=i;try{var r=n(a,l),g=z.S;g!==null&&g(i,r),Qd(e,t,r)}catch(C){ac(e,t,C)}finally{o!==null&&i.types!==null&&(o.types=i.types),z.T=o}}else try{o=n(a,l),Qd(e,t,o)}catch(C){ac(e,t,C)}}function Qd(e,t,n){n!==null&&typeof n=="object"&&typeof n.then=="function"?n.then(function(l){Gd(e,t,l)},function(l){return ac(e,t,l)}):Gd(e,t,n)}function Gd(e,t,n){t.status="fulfilled",t.value=n,$d(t),e.state=n,t=e.pending,t!==null&&(n=t.next,n===t?e.pending=null:(n=n.next,t.next=n,Xd(e,n)))}function ac(e,t,n){var l=e.pending;if(e.pending=null,l!==null){l=l.next;do t.status="rejected",t.reason=n,$d(t),t=t.next;while(t!==l)}e.action=null}function $d(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function qd(e,t){return t}function Zd(e,t){if(Me){var n=Pe.formState;if(n!==null){e:{var l=xe;if(Me){if(nt){t:{for(var a=nt,o=An;a.nodeType!==8;){if(!o){a=null;break t}if(a=On(a.nextSibling),a===null){a=null;break t}}o=a.data,a=o==="F!"||o==="F"?a:null}if(a){nt=On(a.nextSibling),l=a.data==="F!";break e}}Ql(l)}l=!1}l&&(t=n[0])}}return n=Jt(),n.memoizedState=n.baseState=t,l={pending:null,lanes:0,dispatch:null,lastRenderedReducer:qd,lastRenderedState:t},n.queue=l,n=ff.bind(null,xe,l),l.dispatch=n,l=lc(!1),o=rc.bind(null,xe,!1,l.queue),l=Jt(),a={state:t,dispatch:null,action:e,pending:null},l.queue=a,n=y0.bind(null,xe,a,o,n),a.dispatch=n,l.memoizedState=e,[t,n,!1]}function Vd(e){var t=xt();return Jd(t,Je,e)}function Jd(e,t,n){if(t=tc(e,t,qd)[0],e=pi(vl)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var l=ds(t)}catch(i){throw i===mo?ii:i}else l=t;t=xt();var a=t.queue,o=a.dispatch;return n!==t.memoizedState&&(xe.flags|=2048,bo(9,{destroy:void 0},b0.bind(null,a,n),null)),[l,o,e]}function b0(e,t){e.action=t}function Kd(e){var t=xt(),n=Je;if(n!==null)return Jd(t,n,e);xt(),t=t.memoizedState,n=xt();var l=n.queue.dispatch;return n.memoizedState=e,[t,l,!1]}function bo(e,t,n,l){return e={tag:e,create:n,deps:l,inst:t,next:null},t=xe.updateQueue,t===null&&(t=hi(),xe.updateQueue=t),n=t.lastEffect,n===null?t.lastEffect=e.next=e:(l=n.next,n.next=e,e.next=l,t.lastEffect=e),e}function Wd(){return xt().memoizedState}function yi(e,t,n,l){var a=Jt();xe.flags|=e,a.memoizedState=bo(1|t,{destroy:void 0},n,l===void 0?null:l)}function bi(e,t,n,l){var a=xt();l=l===void 0?null:l;var o=a.memoizedState.inst;Je!==null&&l!==null&&Ku(l,Je.memoizedState.deps)?a.memoizedState=bo(t,o,n,l):(xe.flags|=e,a.memoizedState=bo(1|t,o,n,l))}function Id(e,t){yi(8390656,8,e,t)}function oc(e,t){bi(2048,8,e,t)}function x0(e){xe.flags|=4;var t=xe.updateQueue;if(t===null)t=hi(),xe.updateQueue=t,t.events=[e];else{var n=t.events;n===null?t.events=[e]:n.push(e)}}function Fd(e){var t=xt().memoizedState;return x0({ref:t,nextImpl:e}),function(){if((He&2)!==0)throw Error(c(440));return t.impl.apply(void 0,arguments)}}function Pd(e,t){return bi(4,2,e,t)}function ef(e,t){return bi(4,4,e,t)}function tf(e,t){if(typeof t=="function"){e=e();var n=t(e);return function(){typeof n=="function"?n():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function nf(e,t,n){n=n!=null?n.concat([e]):null,bi(4,4,tf.bind(null,t,e),n)}function sc(){}function lf(e,t){var n=xt();t=t===void 0?null:t;var l=n.memoizedState;return t!==null&&Ku(t,l[1])?l[0]:(n.memoizedState=[e,t],e)}function af(e,t){var n=xt();t=t===void 0?null:t;var l=n.memoizedState;if(t!==null&&Ku(t,l[1]))return l[0];if(l=e(),La){Zn(!0);try{e()}finally{Zn(!1)}}return n.memoizedState=[l,t],l}function ic(e,t,n){return n===void 0||(xl&1073741824)!==0&&(ke&261930)===0?e.memoizedState=t:(e.memoizedState=n,e=s_(),xe.lanes|=e,Il|=e,n)}function of(e,t,n,l){return rn(n,t)?n:go.current!==null?(e=ic(e,n,l),rn(e,t)||(Nt=!0),e):(xl&42)===0||(xl&1073741824)!==0&&(ke&261930)===0?(Nt=!0,e.memoizedState=n):(e=s_(),xe.lanes|=e,Il|=e,t)}function sf(e,t,n,l,a){var o=U.p;U.p=o!==0&&8>o?o:8;var i=z.T,r={};z.T=r,rc(e,!1,t,n);try{var g=a(),C=z.S;if(C!==null&&C(r,g),g!==null&&typeof g=="object"&&typeof g.then=="function"){var L=h0(g,l);fs(e,t,L,gn(e))}else fs(e,t,l,gn(e))}catch(R){fs(e,t,{then:function(){},status:"rejected",reason:R},gn())}finally{U.p=o,i!==null&&r.types!==null&&(i.types=r.types),z.T=i}}function v0(){}function uc(e,t,n,l){if(e.tag!==5)throw Error(c(476));var a=uf(e).queue;sf(e,a,t,J,n===null?v0:function(){return cf(e),n(l)})}function uf(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:J,baseState:J,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:vl,lastRenderedState:J},next:null};var n={};return t.next={memoizedState:n,baseState:n,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:vl,lastRenderedState:n},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function cf(e){var t=uf(e);t.next===null&&(t=e.alternate.memoizedState),fs(e,t.next.queue,{},gn())}function cc(){return Ht(ks)}function rf(){return xt().memoizedState}function df(){return xt().memoizedState}function S0(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var n=gn();e=ql(n);var l=Zl(t,e,n);l!==null&&(an(l,t,n),is(l,t,n)),t={cache:Yu()},e.payload=t;return}t=t.return}}function w0(e,t,n){var l=gn();n={lane:l,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null},xi(e)?_f(t,n):(n=Eu(e,t,n,l),n!==null&&(an(n,e,l),mf(n,t,l)))}function ff(e,t,n){var l=gn();fs(e,t,n,l)}function fs(e,t,n,l){var a={lane:l,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null};if(xi(e))_f(t,a);else{var o=e.alternate;if(e.lanes===0&&(o===null||o.lanes===0)&&(o=t.lastRenderedReducer,o!==null))try{var i=t.lastRenderedState,r=o(i,n);if(a.hasEagerState=!0,a.eagerState=r,rn(r,i))return ei(e,t,a,0),Pe===null&&Ps(),!1}catch{}if(n=Eu(e,t,a,l),n!==null)return an(n,e,l),mf(n,t,l),!0}return!1}function rc(e,t,n,l){if(l={lane:2,revertLane:Qc(),gesture:null,action:l,hasEagerState:!1,eagerState:null,next:null},xi(e)){if(t)throw Error(c(479))}else t=Eu(e,n,l,2),t!==null&&an(t,e,2)}function xi(e){var t=e.alternate;return e===xe||t!==null&&t===xe}function _f(e,t){po=_i=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function mf(e,t,n){if((n&4194048)!==0){var l=t.lanes;l&=e.pendingLanes,n|=l,t.lanes=n,Uo(e,n)}}var _s={readContext:Ht,use:gi,useCallback:gt,useContext:gt,useEffect:gt,useImperativeHandle:gt,useLayoutEffect:gt,useInsertionEffect:gt,useMemo:gt,useReducer:gt,useRef:gt,useState:gt,useDebugValue:gt,useDeferredValue:gt,useTransition:gt,useSyncExternalStore:gt,useId:gt,useHostTransitionStatus:gt,useFormState:gt,useActionState:gt,useOptimistic:gt,useMemoCache:gt,useCacheRefresh:gt};_s.useEffectEvent=gt;var hf={readContext:Ht,use:gi,useCallback:function(e,t){return Jt().memoizedState=[e,t===void 0?null:t],e},useContext:Ht,useEffect:Id,useImperativeHandle:function(e,t,n){n=n!=null?n.concat([e]):null,yi(4194308,4,tf.bind(null,t,e),n)},useLayoutEffect:function(e,t){return yi(4194308,4,e,t)},useInsertionEffect:function(e,t){yi(4,2,e,t)},useMemo:function(e,t){var n=Jt();t=t===void 0?null:t;var l=e();if(La){Zn(!0);try{e()}finally{Zn(!1)}}return n.memoizedState=[l,t],l},useReducer:function(e,t,n){var l=Jt();if(n!==void 0){var a=n(t);if(La){Zn(!0);try{n(t)}finally{Zn(!1)}}}else a=t;return l.memoizedState=l.baseState=a,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:a},l.queue=e,e=e.dispatch=w0.bind(null,xe,e),[l.memoizedState,e]},useRef:function(e){var t=Jt();return e={current:e},t.memoizedState=e},useState:function(e){e=lc(e);var t=e.queue,n=ff.bind(null,xe,t);return t.dispatch=n,[e.memoizedState,n]},useDebugValue:sc,useDeferredValue:function(e,t){var n=Jt();return ic(n,e,t)},useTransition:function(){var e=lc(!1);return e=sf.bind(null,xe,e.queue,!0,!1),Jt().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,n){var l=xe,a=Jt();if(Me){if(n===void 0)throw Error(c(407));n=n()}else{if(n=t(),Pe===null)throw Error(c(349));(ke&127)!==0||Bd(l,t,n)}a.memoizedState=n;var o={value:n,getSnapshot:t};return a.queue=o,Id(Rd.bind(null,l,o,e),[e]),l.flags|=2048,bo(9,{destroy:void 0},Dd.bind(null,l,o,n,t),null),n},useId:function(){var e=Jt(),t=Pe.identifierPrefix;if(Me){var n=tl,l=el;n=(l&~(1<<32-ot(l)-1)).toString(32)+n,t="_"+t+"R_"+n,n=mi++,0<n&&(t+="H"+n.toString(32)),t+="_"}else n=g0++,t="_"+t+"r_"+n.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:cc,useFormState:Zd,useActionState:Zd,useOptimistic:function(e){var t=Jt();t.memoizedState=t.baseState=e;var n={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=n,t=rc.bind(null,xe,!0,n),n.dispatch=t,[e,t]},useMemoCache:ec,useCacheRefresh:function(){return Jt().memoizedState=S0.bind(null,xe)},useEffectEvent:function(e){var t=Jt(),n={impl:e};return t.memoizedState=n,function(){if((He&2)!==0)throw Error(c(440));return n.impl.apply(void 0,arguments)}}},dc={readContext:Ht,use:gi,useCallback:lf,useContext:Ht,useEffect:oc,useImperativeHandle:nf,useInsertionEffect:Pd,useLayoutEffect:ef,useMemo:af,useReducer:pi,useRef:Wd,useState:function(){return pi(vl)},useDebugValue:sc,useDeferredValue:function(e,t){var n=xt();return of(n,Je.memoizedState,e,t)},useTransition:function(){var e=pi(vl)[0],t=xt().memoizedState;return[typeof e=="boolean"?e:ds(e),t]},useSyncExternalStore:Ld,useId:rf,useHostTransitionStatus:cc,useFormState:Vd,useActionState:Vd,useOptimistic:function(e,t){var n=xt();return Ud(n,Je,e,t)},useMemoCache:ec,useCacheRefresh:df};dc.useEffectEvent=Fd;var gf={readContext:Ht,use:gi,useCallback:lf,useContext:Ht,useEffect:oc,useImperativeHandle:nf,useInsertionEffect:Pd,useLayoutEffect:ef,useMemo:af,useReducer:nc,useRef:Wd,useState:function(){return nc(vl)},useDebugValue:sc,useDeferredValue:function(e,t){var n=xt();return Je===null?ic(n,e,t):of(n,Je.memoizedState,e,t)},useTransition:function(){var e=nc(vl)[0],t=xt().memoizedState;return[typeof e=="boolean"?e:ds(e),t]},useSyncExternalStore:Ld,useId:rf,useHostTransitionStatus:cc,useFormState:Kd,useActionState:Kd,useOptimistic:function(e,t){var n=xt();return Je!==null?Ud(n,Je,e,t):(n.baseState=e,[e,n.queue.dispatch])},useMemoCache:ec,useCacheRefresh:df};gf.useEffectEvent=Fd;function fc(e,t,n,l){t=e.memoizedState,n=n(l,t),n=n==null?t:Z({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var _c={enqueueSetState:function(e,t,n){e=e._reactInternals;var l=gn(),a=ql(l);a.payload=t,n!=null&&(a.callback=n),t=Zl(e,a,l),t!==null&&(an(t,e,l),is(t,e,l))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var l=gn(),a=ql(l);a.tag=1,a.payload=t,n!=null&&(a.callback=n),t=Zl(e,a,l),t!==null&&(an(t,e,l),is(t,e,l))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=gn(),l=ql(n);l.tag=2,t!=null&&(l.callback=t),t=Zl(e,l,n),t!==null&&(an(t,e,n),is(t,e,n))}};function pf(e,t,n,l,a,o,i){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(l,o,i):t.prototype&&t.prototype.isPureReactComponent?!Po(n,l)||!Po(a,o):!0}function yf(e,t,n,l){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(n,l),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(n,l),t.state!==e&&_c.enqueueReplaceState(t,t.state,null)}function Ba(e,t){var n=t;if("ref"in t){n={};for(var l in t)l!=="ref"&&(n[l]=t[l])}if(e=e.defaultProps){n===t&&(n=Z({},n));for(var a in e)n[a]===void 0&&(n[a]=e[a])}return n}function bf(e){Fs(e)}function xf(e){console.error(e)}function vf(e){Fs(e)}function vi(e,t){try{var n=e.onUncaughtError;n(t.value,{componentStack:t.stack})}catch(l){setTimeout(function(){throw l})}}function Sf(e,t,n){try{var l=e.onCaughtError;l(n.value,{componentStack:n.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(a){setTimeout(function(){throw a})}}function mc(e,t,n){return n=ql(n),n.tag=3,n.payload={element:null},n.callback=function(){vi(e,t)},n}function wf(e){return e=ql(e),e.tag=3,e}function Cf(e,t,n,l){var a=n.type.getDerivedStateFromError;if(typeof a=="function"){var o=l.value;e.payload=function(){return a(o)},e.callback=function(){Sf(t,n,l)}}var i=n.stateNode;i!==null&&typeof i.componentDidCatch=="function"&&(e.callback=function(){Sf(t,n,l),typeof a!="function"&&(Fl===null?Fl=new Set([this]):Fl.add(this));var r=l.stack;this.componentDidCatch(l.value,{componentStack:r!==null?r:""})})}function C0(e,t,n,l,a){if(n.flags|=32768,l!==null&&typeof l=="object"&&typeof l.then=="function"){if(t=n.alternate,t!==null&&ro(t,n,a,!0),n=fn.current,n!==null){switch(n.tag){case 31:case 13:return Mn===null?Oi():n.alternate===null&&pt===0&&(pt=3),n.flags&=-257,n.flags|=65536,n.lanes=a,l===ui?n.flags|=16384:(t=n.updateQueue,t===null?n.updateQueue=new Set([l]):t.add(l),Hc(e,l,a)),!1;case 22:return n.flags|=65536,l===ui?n.flags|=16384:(t=n.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([l])},n.updateQueue=t):(n=t.retryQueue,n===null?t.retryQueue=new Set([l]):n.add(l)),Hc(e,l,a)),!1}throw Error(c(435,n.tag))}return Hc(e,l,a),Oi(),!1}if(Me)return t=fn.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=a,l!==Ou&&(e=Error(c(422),{cause:l}),ns(Tn(e,n)))):(l!==Ou&&(t=Error(c(423),{cause:l}),ns(Tn(t,n))),e=e.current.alternate,e.flags|=65536,a&=-a,e.lanes|=a,l=Tn(l,n),a=mc(e.stateNode,l,a),$u(e,a),pt!==4&&(pt=2)),!1;var o=Error(c(520),{cause:l});if(o=Tn(o,n),vs===null?vs=[o]:vs.push(o),pt!==4&&(pt=2),t===null)return!0;l=Tn(l,n),n=t;do{switch(n.tag){case 3:return n.flags|=65536,e=a&-a,n.lanes|=e,e=mc(n.stateNode,l,e),$u(n,e),!1;case 1:if(t=n.type,o=n.stateNode,(n.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||o!==null&&typeof o.componentDidCatch=="function"&&(Fl===null||!Fl.has(o))))return n.flags|=65536,a&=-a,n.lanes|=a,a=wf(a),Cf(a,e,n,l),$u(n,a),!1}n=n.return}while(n!==null);return!1}var hc=Error(c(461)),Nt=!1;function Ut(e,t,n,l){t.child=e===null?Ed(t,null,n,l):Oa(t,e.child,n,l)}function jf(e,t,n,l,a){n=n.render;var o=t.ref;if("ref"in l){var i={};for(var r in l)r!=="ref"&&(i[r]=l[r])}else i=l;return ka(t),l=Wu(e,t,n,i,o,a),r=Iu(),e!==null&&!Nt?(Fu(e,t,a),Sl(e,t,a)):(Me&&r&&Au(t),t.flags|=1,Ut(e,t,l,a),t.child)}function Nf(e,t,n,l,a){if(e===null){var o=n.type;return typeof o=="function"&&!Tu(o)&&o.defaultProps===void 0&&n.compare===null?(t.tag=15,t.type=o,Ef(e,t,o,l,a)):(e=ni(n.type,null,l,t,t.mode,a),e.ref=t.ref,e.return=t,t.child=e)}if(o=e.child,!wc(e,a)){var i=o.memoizedProps;if(n=n.compare,n=n!==null?n:Po,n(i,l)&&e.ref===t.ref)return Sl(e,t,a)}return t.flags|=1,e=gl(o,l),e.ref=t.ref,e.return=t,t.child=e}function Ef(e,t,n,l,a){if(e!==null){var o=e.memoizedProps;if(Po(o,l)&&e.ref===t.ref)if(Nt=!1,t.pendingProps=l=o,wc(e,a))(e.flags&131072)!==0&&(Nt=!0);else return t.lanes=e.lanes,Sl(e,t,a)}return gc(e,t,n,l,a)}function Tf(e,t,n,l){var a=l.children,o=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),l.mode==="hidden"){if((t.flags&128)!==0){if(o=o!==null?o.baseLanes|n:n,e!==null){for(l=t.child=e.child,a=0;l!==null;)a=a|l.lanes|l.childLanes,l=l.sibling;l=a&~o}else l=0,t.child=null;return kf(e,t,o,n,l)}if((n&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&si(t,o!==null?o.cachePool:null),o!==null?zd(t,o):Zu(),Ad(t);else return l=t.lanes=536870912,kf(e,t,o!==null?o.baseLanes|n:n,n,l)}else o!==null?(si(t,o.cachePool),zd(t,o),Jl(),t.memoizedState=null):(e!==null&&si(t,null),Zu(),Jl());return Ut(e,t,a,n),t.child}function ms(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function kf(e,t,n,l,a){var o=Uu();return o=o===null?null:{parent:Ct._currentValue,pool:o},t.memoizedState={baseLanes:n,cachePool:o},e!==null&&si(t,null),Zu(),Ad(t),e!==null&&ro(e,t,l,!0),t.childLanes=a,null}function Si(e,t){return t=Ci({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function zf(e,t,n){return Oa(t,e.child,null,n),e=Si(t,t.pendingProps),e.flags|=2,_n(t),t.memoizedState=null,e}function j0(e,t,n){var l=t.pendingProps,a=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(Me){if(l.mode==="hidden")return e=Si(t,l),t.lanes=536870912,ms(null,e);if(Ju(t),(e=nt)?(e=Q_(e,An),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Ul!==null?{id:el,overflow:tl}:null,retryLane:536870912,hydrationErrors:null},n=fd(e),n.return=t,t.child=n,Yt=t,nt=null)):e=null,e===null)throw Ql(t);return t.lanes=536870912,null}return Si(t,l)}var o=e.memoizedState;if(o!==null){var i=o.dehydrated;if(Ju(t),a)if(t.flags&256)t.flags&=-257,t=zf(e,t,n);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(c(558));else if(Nt||ro(e,t,n,!1),a=(n&e.childLanes)!==0,Nt||a){if(l=Pe,l!==null&&(i=qs(l,n),i!==0&&i!==o.retryLane))throw o.retryLane=i,ja(e,i),an(l,e,i),hc;Oi(),t=zf(e,t,n)}else e=o.treeContext,nt=On(i.nextSibling),Yt=t,Me=!0,Xl=null,An=!1,e!==null&&hd(t,e),t=Si(t,l),t.flags|=4096;return t}return e=gl(e.child,{mode:l.mode,children:l.children}),e.ref=t.ref,t.child=e,e.return=t,e}function wi(e,t){var n=t.ref;if(n===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof n!="function"&&typeof n!="object")throw Error(c(284));(e===null||e.ref!==n)&&(t.flags|=4194816)}}function gc(e,t,n,l,a){return ka(t),n=Wu(e,t,n,l,void 0,a),l=Iu(),e!==null&&!Nt?(Fu(e,t,a),Sl(e,t,a)):(Me&&l&&Au(t),t.flags|=1,Ut(e,t,n,a),t.child)}function Af(e,t,n,l,a,o){return ka(t),t.updateQueue=null,n=Od(t,l,n,a),Md(e),l=Iu(),e!==null&&!Nt?(Fu(e,t,o),Sl(e,t,o)):(Me&&l&&Au(t),t.flags|=1,Ut(e,t,n,o),t.child)}function Mf(e,t,n,l,a){if(ka(t),t.stateNode===null){var o=so,i=n.contextType;typeof i=="object"&&i!==null&&(o=Ht(i)),o=new n(l,o),t.memoizedState=o.state!==null&&o.state!==void 0?o.state:null,o.updater=_c,t.stateNode=o,o._reactInternals=t,o=t.stateNode,o.props=l,o.state=t.memoizedState,o.refs={},Qu(t),i=n.contextType,o.context=typeof i=="object"&&i!==null?Ht(i):so,o.state=t.memoizedState,i=n.getDerivedStateFromProps,typeof i=="function"&&(fc(t,n,i,l),o.state=t.memoizedState),typeof n.getDerivedStateFromProps=="function"||typeof o.getSnapshotBeforeUpdate=="function"||typeof o.UNSAFE_componentWillMount!="function"&&typeof o.componentWillMount!="function"||(i=o.state,typeof o.componentWillMount=="function"&&o.componentWillMount(),typeof o.UNSAFE_componentWillMount=="function"&&o.UNSAFE_componentWillMount(),i!==o.state&&_c.enqueueReplaceState(o,o.state,null),cs(t,l,o,a),us(),o.state=t.memoizedState),typeof o.componentDidMount=="function"&&(t.flags|=4194308),l=!0}else if(e===null){o=t.stateNode;var r=t.memoizedProps,g=Ba(n,r);o.props=g;var C=o.context,L=n.contextType;i=so,typeof L=="object"&&L!==null&&(i=Ht(L));var R=n.getDerivedStateFromProps;L=typeof R=="function"||typeof o.getSnapshotBeforeUpdate=="function",r=t.pendingProps!==r,L||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(r||C!==i)&&yf(t,o,l,i),$l=!1;var j=t.memoizedState;o.state=j,cs(t,l,o,a),us(),C=t.memoizedState,r||j!==C||$l?(typeof R=="function"&&(fc(t,n,R,l),C=t.memoizedState),(g=$l||pf(t,n,g,l,j,C,i))?(L||typeof o.UNSAFE_componentWillMount!="function"&&typeof o.componentWillMount!="function"||(typeof o.componentWillMount=="function"&&o.componentWillMount(),typeof o.UNSAFE_componentWillMount=="function"&&o.UNSAFE_componentWillMount()),typeof o.componentDidMount=="function"&&(t.flags|=4194308)):(typeof o.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=l,t.memoizedState=C),o.props=l,o.state=C,o.context=i,l=g):(typeof o.componentDidMount=="function"&&(t.flags|=4194308),l=!1)}else{o=t.stateNode,Gu(e,t),i=t.memoizedProps,L=Ba(n,i),o.props=L,R=t.pendingProps,j=o.context,C=n.contextType,g=so,typeof C=="object"&&C!==null&&(g=Ht(C)),r=n.getDerivedStateFromProps,(C=typeof r=="function"||typeof o.getSnapshotBeforeUpdate=="function")||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(i!==R||j!==g)&&yf(t,o,l,g),$l=!1,j=t.memoizedState,o.state=j,cs(t,l,o,a),us();var T=t.memoizedState;i!==R||j!==T||$l||e!==null&&e.dependencies!==null&&ai(e.dependencies)?(typeof r=="function"&&(fc(t,n,r,l),T=t.memoizedState),(L=$l||pf(t,n,L,l,j,T,g)||e!==null&&e.dependencies!==null&&ai(e.dependencies))?(C||typeof o.UNSAFE_componentWillUpdate!="function"&&typeof o.componentWillUpdate!="function"||(typeof o.componentWillUpdate=="function"&&o.componentWillUpdate(l,T,g),typeof o.UNSAFE_componentWillUpdate=="function"&&o.UNSAFE_componentWillUpdate(l,T,g)),typeof o.componentDidUpdate=="function"&&(t.flags|=4),typeof o.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof o.componentDidUpdate!="function"||i===e.memoizedProps&&j===e.memoizedState||(t.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||i===e.memoizedProps&&j===e.memoizedState||(t.flags|=1024),t.memoizedProps=l,t.memoizedState=T),o.props=l,o.state=T,o.context=g,l=L):(typeof o.componentDidUpdate!="function"||i===e.memoizedProps&&j===e.memoizedState||(t.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||i===e.memoizedProps&&j===e.memoizedState||(t.flags|=1024),l=!1)}return o=l,wi(e,t),l=(t.flags&128)!==0,o||l?(o=t.stateNode,n=l&&typeof n.getDerivedStateFromError!="function"?null:o.render(),t.flags|=1,e!==null&&l?(t.child=Oa(t,e.child,null,a),t.child=Oa(t,null,n,a)):Ut(e,t,n,a),t.memoizedState=o.state,e=t.child):e=Sl(e,t,a),e}function Of(e,t,n,l){return Ea(),t.flags|=256,Ut(e,t,n,l),t.child}var pc={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function yc(e){return{baseLanes:e,cachePool:vd()}}function bc(e,t,n){return e=e!==null?e.childLanes&~n:0,t&&(e|=hn),e}function Lf(e,t,n){var l=t.pendingProps,a=!1,o=(t.flags&128)!==0,i;if((i=o)||(i=e!==null&&e.memoizedState===null?!1:(bt.current&2)!==0),i&&(a=!0,t.flags&=-129),i=(t.flags&32)!==0,t.flags&=-33,e===null){if(Me){if(a?Vl(t):Jl(),(e=nt)?(e=Q_(e,An),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Ul!==null?{id:el,overflow:tl}:null,retryLane:536870912,hydrationErrors:null},n=fd(e),n.return=t,t.child=n,Yt=t,nt=null)):e=null,e===null)throw Ql(t);return tr(e)?t.lanes=32:t.lanes=536870912,null}var r=l.children;return l=l.fallback,a?(Jl(),a=t.mode,r=Ci({mode:"hidden",children:r},a),l=Na(l,a,n,null),r.return=t,l.return=t,r.sibling=l,t.child=r,l=t.child,l.memoizedState=yc(n),l.childLanes=bc(e,i,n),t.memoizedState=pc,ms(null,l)):(Vl(t),xc(t,r))}var g=e.memoizedState;if(g!==null&&(r=g.dehydrated,r!==null)){if(o)t.flags&256?(Vl(t),t.flags&=-257,t=vc(e,t,n)):t.memoizedState!==null?(Jl(),t.child=e.child,t.flags|=128,t=null):(Jl(),r=l.fallback,a=t.mode,l=Ci({mode:"visible",children:l.children},a),r=Na(r,a,n,null),r.flags|=2,l.return=t,r.return=t,l.sibling=r,t.child=l,Oa(t,e.child,null,n),l=t.child,l.memoizedState=yc(n),l.childLanes=bc(e,i,n),t.memoizedState=pc,t=ms(null,l));else if(Vl(t),tr(r)){if(i=r.nextSibling&&r.nextSibling.dataset,i)var C=i.dgst;i=C,l=Error(c(419)),l.stack="",l.digest=i,ns({value:l,source:null,stack:null}),t=vc(e,t,n)}else if(Nt||ro(e,t,n,!1),i=(n&e.childLanes)!==0,Nt||i){if(i=Pe,i!==null&&(l=qs(i,n),l!==0&&l!==g.retryLane))throw g.retryLane=l,ja(e,l),an(i,e,l),hc;er(r)||Oi(),t=vc(e,t,n)}else er(r)?(t.flags|=192,t.child=e.child,t=null):(e=g.treeContext,nt=On(r.nextSibling),Yt=t,Me=!0,Xl=null,An=!1,e!==null&&hd(t,e),t=xc(t,l.children),t.flags|=4096);return t}return a?(Jl(),r=l.fallback,a=t.mode,g=e.child,C=g.sibling,l=gl(g,{mode:"hidden",children:l.children}),l.subtreeFlags=g.subtreeFlags&65011712,C!==null?r=gl(C,r):(r=Na(r,a,n,null),r.flags|=2),r.return=t,l.return=t,l.sibling=r,t.child=l,ms(null,l),l=t.child,r=e.child.memoizedState,r===null?r=yc(n):(a=r.cachePool,a!==null?(g=Ct._currentValue,a=a.parent!==g?{parent:g,pool:g}:a):a=vd(),r={baseLanes:r.baseLanes|n,cachePool:a}),l.memoizedState=r,l.childLanes=bc(e,i,n),t.memoizedState=pc,ms(e.child,l)):(Vl(t),n=e.child,e=n.sibling,n=gl(n,{mode:"visible",children:l.children}),n.return=t,n.sibling=null,e!==null&&(i=t.deletions,i===null?(t.deletions=[e],t.flags|=16):i.push(e)),t.child=n,t.memoizedState=null,n)}function xc(e,t){return t=Ci({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function Ci(e,t){return e=dn(22,e,null,t),e.lanes=0,e}function vc(e,t,n){return Oa(t,e.child,null,n),e=xc(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function Bf(e,t,n){e.lanes|=t;var l=e.alternate;l!==null&&(l.lanes|=t),Du(e.return,t,n)}function Sc(e,t,n,l,a,o){var i=e.memoizedState;i===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:l,tail:n,tailMode:a,treeForkCount:o}:(i.isBackwards=t,i.rendering=null,i.renderingStartTime=0,i.last=l,i.tail=n,i.tailMode=a,i.treeForkCount=o)}function Df(e,t,n){var l=t.pendingProps,a=l.revealOrder,o=l.tail;l=l.children;var i=bt.current,r=(i&2)!==0;if(r?(i=i&1|2,t.flags|=128):i&=1,H(bt,i),Ut(e,t,l,n),l=Me?ts:0,!r&&e!==null&&(e.flags&128)!==0)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&Bf(e,n,t);else if(e.tag===19)Bf(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(a){case"forwards":for(n=t.child,a=null;n!==null;)e=n.alternate,e!==null&&fi(e)===null&&(a=n),n=n.sibling;n=a,n===null?(a=t.child,t.child=null):(a=n.sibling,n.sibling=null),Sc(t,!1,a,n,o,l);break;case"backwards":case"unstable_legacy-backwards":for(n=null,a=t.child,t.child=null;a!==null;){if(e=a.alternate,e!==null&&fi(e)===null){t.child=a;break}e=a.sibling,a.sibling=n,n=a,a=e}Sc(t,!0,n,null,o,l);break;case"together":Sc(t,!1,null,null,void 0,l);break;default:t.memoizedState=null}return t.child}function Sl(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),Il|=t.lanes,(n&t.childLanes)===0)if(e!==null){if(ro(e,t,n,!1),(n&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(c(153));if(t.child!==null){for(e=t.child,n=gl(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=gl(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function wc(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&ai(e)))}function N0(e,t,n){switch(t.tag){case 3:Fe(t,t.stateNode.containerInfo),Gl(t,Ct,e.memoizedState.cache),Ea();break;case 27:case 5:$(t);break;case 4:Fe(t,t.stateNode.containerInfo);break;case 10:Gl(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,Ju(t),null;break;case 13:var l=t.memoizedState;if(l!==null)return l.dehydrated!==null?(Vl(t),t.flags|=128,null):(n&t.child.childLanes)!==0?Lf(e,t,n):(Vl(t),e=Sl(e,t,n),e!==null?e.sibling:null);Vl(t);break;case 19:var a=(e.flags&128)!==0;if(l=(n&t.childLanes)!==0,l||(ro(e,t,n,!1),l=(n&t.childLanes)!==0),a){if(l)return Df(e,t,n);t.flags|=128}if(a=t.memoizedState,a!==null&&(a.rendering=null,a.tail=null,a.lastEffect=null),H(bt,bt.current),l)break;return null;case 22:return t.lanes=0,Tf(e,t,n,t.pendingProps);case 24:Gl(t,Ct,e.memoizedState.cache)}return Sl(e,t,n)}function Rf(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps)Nt=!0;else{if(!wc(e,n)&&(t.flags&128)===0)return Nt=!1,N0(e,t,n);Nt=(e.flags&131072)!==0}else Nt=!1,Me&&(t.flags&1048576)!==0&&md(t,ts,t.index);switch(t.lanes=0,t.tag){case 16:e:{var l=t.pendingProps;if(e=Aa(t.elementType),t.type=e,typeof e=="function")Tu(e)?(l=Ba(e,l),t.tag=1,t=Mf(null,t,e,l,n)):(t.tag=0,t=gc(null,t,e,l,n));else{if(e!=null){var a=e.$$typeof;if(a===et){t.tag=11,t=jf(null,t,e,l,n);break e}else if(a===q){t.tag=14,t=Nf(null,t,e,l,n);break e}}throw t=_t(e)||e,Error(c(306,t,""))}}return t;case 0:return gc(e,t,t.type,t.pendingProps,n);case 1:return l=t.type,a=Ba(l,t.pendingProps),Mf(e,t,l,a,n);case 3:e:{if(Fe(t,t.stateNode.containerInfo),e===null)throw Error(c(387));l=t.pendingProps;var o=t.memoizedState;a=o.element,Gu(e,t),cs(t,l,null,n);var i=t.memoizedState;if(l=i.cache,Gl(t,Ct,l),l!==o.cache&&Ru(t,[Ct],n,!0),us(),l=i.element,o.isDehydrated)if(o={element:l,isDehydrated:!1,cache:i.cache},t.updateQueue.baseState=o,t.memoizedState=o,t.flags&256){t=Of(e,t,l,n);break e}else if(l!==a){a=Tn(Error(c(424)),t),ns(a),t=Of(e,t,l,n);break e}else for(e=t.stateNode.containerInfo,e.nodeType===9?e=e.body:e=e.nodeName==="HTML"?e.ownerDocument.body:e,nt=On(e.firstChild),Yt=t,Me=!0,Xl=null,An=!0,n=Ed(t,null,l,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling;else{if(Ea(),l===a){t=Sl(e,t,n);break e}Ut(e,t,l,n)}t=t.child}return t;case 26:return wi(e,t),e===null?(n=J_(t.type,null,t.pendingProps,null))?t.memoizedState=n:Me||(n=t.type,e=t.pendingProps,l=Ui(ge.current).createElement(n),l[zt]=t,l[At]=e,Xt(l,n,e),mt(l),t.stateNode=l):t.memoizedState=J_(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return $(t),e===null&&Me&&(l=t.stateNode=q_(t.type,t.pendingProps,ge.current),Yt=t,An=!0,a=nt,na(t.type)?(nr=a,nt=On(l.firstChild)):nt=a),Ut(e,t,t.pendingProps.children,n),wi(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&Me&&((a=l=nt)&&(l=nh(l,t.type,t.pendingProps,An),l!==null?(t.stateNode=l,Yt=t,nt=On(l.firstChild),An=!1,a=!0):a=!1),a||Ql(t)),$(t),a=t.type,o=t.pendingProps,i=e!==null?e.memoizedProps:null,l=o.children,Ic(a,o)?l=null:i!==null&&Ic(a,i)&&(t.flags|=32),t.memoizedState!==null&&(a=Wu(e,t,p0,null,null,n),ks._currentValue=a),wi(e,t),Ut(e,t,l,n),t.child;case 6:return e===null&&Me&&((e=n=nt)&&(n=lh(n,t.pendingProps,An),n!==null?(t.stateNode=n,Yt=t,nt=null,e=!0):e=!1),e||Ql(t)),null;case 13:return Lf(e,t,n);case 4:return Fe(t,t.stateNode.containerInfo),l=t.pendingProps,e===null?t.child=Oa(t,null,l,n):Ut(e,t,l,n),t.child;case 11:return jf(e,t,t.type,t.pendingProps,n);case 7:return Ut(e,t,t.pendingProps,n),t.child;case 8:return Ut(e,t,t.pendingProps.children,n),t.child;case 12:return Ut(e,t,t.pendingProps.children,n),t.child;case 10:return l=t.pendingProps,Gl(t,t.type,l.value),Ut(e,t,l.children,n),t.child;case 9:return a=t.type._context,l=t.pendingProps.children,ka(t),a=Ht(a),l=l(a),t.flags|=1,Ut(e,t,l,n),t.child;case 14:return Nf(e,t,t.type,t.pendingProps,n);case 15:return Ef(e,t,t.type,t.pendingProps,n);case 19:return Df(e,t,n);case 31:return j0(e,t,n);case 22:return Tf(e,t,n,t.pendingProps);case 24:return ka(t),l=Ht(Ct),e===null?(a=Uu(),a===null&&(a=Pe,o=Yu(),a.pooledCache=o,o.refCount++,o!==null&&(a.pooledCacheLanes|=n),a=o),t.memoizedState={parent:l,cache:a},Qu(t),Gl(t,Ct,a)):((e.lanes&n)!==0&&(Gu(e,t),cs(t,null,null,n),us()),a=e.memoizedState,o=t.memoizedState,a.parent!==l?(a={parent:l,cache:l},t.memoizedState=a,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=a),Gl(t,Ct,l)):(l=o.cache,Gl(t,Ct,l),l!==a.cache&&Ru(t,[Ct],n,!0))),Ut(e,t,t.pendingProps.children,n),t.child;case 29:throw t.pendingProps}throw Error(c(156,t.tag))}function wl(e){e.flags|=4}function Cc(e,t,n,l,a){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(a&335544128)===a)if(e.stateNode.complete)e.flags|=8192;else if(r_())e.flags|=8192;else throw Ma=ui,Xu}else e.flags&=-16777217}function Yf(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!P_(t))if(r_())e.flags|=8192;else throw Ma=ui,Xu}function ji(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?Kn():536870912,e.lanes|=t,wo|=t)}function hs(e,t){if(!Me)switch(e.tailMode){case"hidden":t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case"collapsed":n=e.tail;for(var l=null;n!==null;)n.alternate!==null&&(l=n),n=n.sibling;l===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:l.sibling=null}}function lt(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,l=0;if(t)for(var a=e.child;a!==null;)n|=a.lanes|a.childLanes,l|=a.subtreeFlags&65011712,l|=a.flags&65011712,a.return=e,a=a.sibling;else for(a=e.child;a!==null;)n|=a.lanes|a.childLanes,l|=a.subtreeFlags,l|=a.flags,a.return=e,a=a.sibling;return e.subtreeFlags|=l,e.childLanes=n,t}function E0(e,t,n){var l=t.pendingProps;switch(Mu(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return lt(t),null;case 1:return lt(t),null;case 3:return n=t.stateNode,l=null,e!==null&&(l=e.memoizedState.cache),t.memoizedState.cache!==l&&(t.flags|=2048),bl(Ct),Ze(),n.pendingContext&&(n.context=n.pendingContext,n.pendingContext=null),(e===null||e.child===null)&&(co(t)?wl(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,Lu())),lt(t),null;case 26:var a=t.type,o=t.memoizedState;return e===null?(wl(t),o!==null?(lt(t),Yf(t,o)):(lt(t),Cc(t,a,null,l,n))):o?o!==e.memoizedState?(wl(t),lt(t),Yf(t,o)):(lt(t),t.flags&=-16777217):(e=e.memoizedProps,e!==l&&wl(t),lt(t),Cc(t,a,e,l,n)),null;case 27:if(we(t),n=ge.current,a=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==l&&wl(t);else{if(!l){if(t.stateNode===null)throw Error(c(166));return lt(t),null}e=B.current,co(t)?gd(t):(e=q_(a,l,n),t.stateNode=e,wl(t))}return lt(t),null;case 5:if(we(t),a=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==l&&wl(t);else{if(!l){if(t.stateNode===null)throw Error(c(166));return lt(t),null}if(o=B.current,co(t))gd(t);else{var i=Ui(ge.current);switch(o){case 1:o=i.createElementNS("http://www.w3.org/2000/svg",a);break;case 2:o=i.createElementNS("http://www.w3.org/1998/Math/MathML",a);break;default:switch(a){case"svg":o=i.createElementNS("http://www.w3.org/2000/svg",a);break;case"math":o=i.createElementNS("http://www.w3.org/1998/Math/MathML",a);break;case"script":o=i.createElement("div"),o.innerHTML="<script><\/script>",o=o.removeChild(o.firstChild);break;case"select":o=typeof l.is=="string"?i.createElement("select",{is:l.is}):i.createElement("select"),l.multiple?o.multiple=!0:l.size&&(o.size=l.size);break;default:o=typeof l.is=="string"?i.createElement(a,{is:l.is}):i.createElement(a)}}o[zt]=t,o[At]=l;e:for(i=t.child;i!==null;){if(i.tag===5||i.tag===6)o.appendChild(i.stateNode);else if(i.tag!==4&&i.tag!==27&&i.child!==null){i.child.return=i,i=i.child;continue}if(i===t)break e;for(;i.sibling===null;){if(i.return===null||i.return===t)break e;i=i.return}i.sibling.return=i.return,i=i.sibling}t.stateNode=o;e:switch(Xt(o,a,l),a){case"button":case"input":case"select":case"textarea":l=!!l.autoFocus;break e;case"img":l=!0;break e;default:l=!1}l&&wl(t)}}return lt(t),Cc(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,n),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==l&&wl(t);else{if(typeof l!="string"&&t.stateNode===null)throw Error(c(166));if(e=ge.current,co(t)){if(e=t.stateNode,n=t.memoizedProps,l=null,a=Yt,a!==null)switch(a.tag){case 27:case 5:l=a.memoizedProps}e[zt]=t,e=!!(e.nodeValue===n||l!==null&&l.suppressHydrationWarning===!0||L_(e.nodeValue,n)),e||Ql(t,!0)}else e=Ui(e).createTextNode(l),e[zt]=t,t.stateNode=e}return lt(t),null;case 31:if(n=t.memoizedState,e===null||e.memoizedState!==null){if(l=co(t),n!==null){if(e===null){if(!l)throw Error(c(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(c(557));e[zt]=t}else Ea(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;lt(t),e=!1}else n=Lu(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=n),e=!0;if(!e)return t.flags&256?(_n(t),t):(_n(t),null);if((t.flags&128)!==0)throw Error(c(558))}return lt(t),null;case 13:if(l=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(a=co(t),l!==null&&l.dehydrated!==null){if(e===null){if(!a)throw Error(c(318));if(a=t.memoizedState,a=a!==null?a.dehydrated:null,!a)throw Error(c(317));a[zt]=t}else Ea(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;lt(t),a=!1}else a=Lu(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=a),a=!0;if(!a)return t.flags&256?(_n(t),t):(_n(t),null)}return _n(t),(t.flags&128)!==0?(t.lanes=n,t):(n=l!==null,e=e!==null&&e.memoizedState!==null,n&&(l=t.child,a=null,l.alternate!==null&&l.alternate.memoizedState!==null&&l.alternate.memoizedState.cachePool!==null&&(a=l.alternate.memoizedState.cachePool.pool),o=null,l.memoizedState!==null&&l.memoizedState.cachePool!==null&&(o=l.memoizedState.cachePool.pool),o!==a&&(l.flags|=2048)),n!==e&&n&&(t.child.flags|=8192),ji(t,t.updateQueue),lt(t),null);case 4:return Ze(),e===null&&Zc(t.stateNode.containerInfo),lt(t),null;case 10:return bl(t.type),lt(t),null;case 19:if(S(bt),l=t.memoizedState,l===null)return lt(t),null;if(a=(t.flags&128)!==0,o=l.rendering,o===null)if(a)hs(l,!1);else{if(pt!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(o=fi(e),o!==null){for(t.flags|=128,hs(l,!1),e=o.updateQueue,t.updateQueue=e,ji(t,e),t.subtreeFlags=0,e=n,n=t.child;n!==null;)dd(n,e),n=n.sibling;return H(bt,bt.current&1|2),Me&&pl(t,l.treeForkCount),t.child}e=e.sibling}l.tail!==null&&ie()>zi&&(t.flags|=128,a=!0,hs(l,!1),t.lanes=4194304)}else{if(!a)if(e=fi(o),e!==null){if(t.flags|=128,a=!0,e=e.updateQueue,t.updateQueue=e,ji(t,e),hs(l,!0),l.tail===null&&l.tailMode==="hidden"&&!o.alternate&&!Me)return lt(t),null}else 2*ie()-l.renderingStartTime>zi&&n!==536870912&&(t.flags|=128,a=!0,hs(l,!1),t.lanes=4194304);l.isBackwards?(o.sibling=t.child,t.child=o):(e=l.last,e!==null?e.sibling=o:t.child=o,l.last=o)}return l.tail!==null?(e=l.tail,l.rendering=e,l.tail=e.sibling,l.renderingStartTime=ie(),e.sibling=null,n=bt.current,H(bt,a?n&1|2:n&1),Me&&pl(t,l.treeForkCount),e):(lt(t),null);case 22:case 23:return _n(t),Vu(),l=t.memoizedState!==null,e!==null?e.memoizedState!==null!==l&&(t.flags|=8192):l&&(t.flags|=8192),l?(n&536870912)!==0&&(t.flags&128)===0&&(lt(t),t.subtreeFlags&6&&(t.flags|=8192)):lt(t),n=t.updateQueue,n!==null&&ji(t,n.retryQueue),n=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),l=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(l=t.memoizedState.cachePool.pool),l!==n&&(t.flags|=2048),e!==null&&S(za),null;case 24:return n=null,e!==null&&(n=e.memoizedState.cache),t.memoizedState.cache!==n&&(t.flags|=2048),bl(Ct),lt(t),null;case 25:return null;case 30:return null}throw Error(c(156,t.tag))}function T0(e,t){switch(Mu(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return bl(Ct),Ze(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return we(t),null;case 31:if(t.memoizedState!==null){if(_n(t),t.alternate===null)throw Error(c(340));Ea()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(_n(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(c(340));Ea()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return S(bt),null;case 4:return Ze(),null;case 10:return bl(t.type),null;case 22:case 23:return _n(t),Vu(),e!==null&&S(za),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return bl(Ct),null;case 25:return null;default:return null}}function Hf(e,t){switch(Mu(t),t.tag){case 3:bl(Ct),Ze();break;case 26:case 27:case 5:we(t);break;case 4:Ze();break;case 31:t.memoizedState!==null&&_n(t);break;case 13:_n(t);break;case 19:S(bt);break;case 10:bl(t.type);break;case 22:case 23:_n(t),Vu(),e!==null&&S(za);break;case 24:bl(Ct)}}function gs(e,t){try{var n=t.updateQueue,l=n!==null?n.lastEffect:null;if(l!==null){var a=l.next;n=a;do{if((n.tag&e)===e){l=void 0;var o=n.create,i=n.inst;l=o(),i.destroy=l}n=n.next}while(n!==a)}}catch(r){$e(t,t.return,r)}}function Kl(e,t,n){try{var l=t.updateQueue,a=l!==null?l.lastEffect:null;if(a!==null){var o=a.next;l=o;do{if((l.tag&e)===e){var i=l.inst,r=i.destroy;if(r!==void 0){i.destroy=void 0,a=t;var g=n,C=r;try{C()}catch(L){$e(a,g,L)}}}l=l.next}while(l!==o)}}catch(L){$e(t,t.return,L)}}function Uf(e){var t=e.updateQueue;if(t!==null){var n=e.stateNode;try{kd(t,n)}catch(l){$e(e,e.return,l)}}}function Xf(e,t,n){n.props=Ba(e.type,e.memoizedProps),n.state=e.memoizedState;try{n.componentWillUnmount()}catch(l){$e(e,t,l)}}function ps(e,t){try{var n=e.ref;if(n!==null){switch(e.tag){case 26:case 27:case 5:var l=e.stateNode;break;case 30:l=e.stateNode;break;default:l=e.stateNode}typeof n=="function"?e.refCleanup=n(l):n.current=l}}catch(a){$e(e,t,a)}}function nl(e,t){var n=e.ref,l=e.refCleanup;if(n!==null)if(typeof l=="function")try{l()}catch(a){$e(e,t,a)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof n=="function")try{n(null)}catch(a){$e(e,t,a)}else n.current=null}function Qf(e){var t=e.type,n=e.memoizedProps,l=e.stateNode;try{e:switch(t){case"button":case"input":case"select":case"textarea":n.autoFocus&&l.focus();break e;case"img":n.src?l.src=n.src:n.srcSet&&(l.srcset=n.srcSet)}}catch(a){$e(e,e.return,a)}}function jc(e,t,n){try{var l=e.stateNode;W0(l,e.type,n,t),l[At]=t}catch(a){$e(e,e.return,a)}}function Gf(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&na(e.type)||e.tag===4}function Nc(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||Gf(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&na(e.type)||e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Ec(e,t,n){var l=e.tag;if(l===5||l===6)e=e.stateNode,t?(n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n).insertBefore(e,t):(t=n.nodeType===9?n.body:n.nodeName==="HTML"?n.ownerDocument.body:n,t.appendChild(e),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=Cn));else if(l!==4&&(l===27&&na(e.type)&&(n=e.stateNode,t=null),e=e.child,e!==null))for(Ec(e,t,n),e=e.sibling;e!==null;)Ec(e,t,n),e=e.sibling}function Ni(e,t,n){var l=e.tag;if(l===5||l===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(l!==4&&(l===27&&na(e.type)&&(n=e.stateNode),e=e.child,e!==null))for(Ni(e,t,n),e=e.sibling;e!==null;)Ni(e,t,n),e=e.sibling}function $f(e){var t=e.stateNode,n=e.memoizedProps;try{for(var l=e.type,a=t.attributes;a.length;)t.removeAttributeNode(a[0]);Xt(t,l,n),t[zt]=e,t[At]=n}catch(o){$e(e,e.return,o)}}var Cl=!1,Et=!1,Tc=!1,qf=typeof WeakSet=="function"?WeakSet:Set,Dt=null;function k0(e,t){if(e=e.containerInfo,Kc=Vi,e=nd(e),vu(e)){if("selectionStart"in e)var n={start:e.selectionStart,end:e.selectionEnd};else e:{n=(n=e.ownerDocument)&&n.defaultView||window;var l=n.getSelection&&n.getSelection();if(l&&l.rangeCount!==0){n=l.anchorNode;var a=l.anchorOffset,o=l.focusNode;l=l.focusOffset;try{n.nodeType,o.nodeType}catch{n=null;break e}var i=0,r=-1,g=-1,C=0,L=0,R=e,j=null;t:for(;;){for(var T;R!==n||a!==0&&R.nodeType!==3||(r=i+a),R!==o||l!==0&&R.nodeType!==3||(g=i+l),R.nodeType===3&&(i+=R.nodeValue.length),(T=R.firstChild)!==null;)j=R,R=T;for(;;){if(R===e)break t;if(j===n&&++C===a&&(r=i),j===o&&++L===l&&(g=i),(T=R.nextSibling)!==null)break;R=j,j=R.parentNode}R=T}n=r===-1||g===-1?null:{start:r,end:g}}else n=null}n=n||{start:0,end:0}}else n=null;for(Wc={focusedElem:e,selectionRange:n},Vi=!1,Dt=t;Dt!==null;)if(t=Dt,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,Dt=e;else for(;Dt!==null;){switch(t=Dt,o=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(n=0;n<e.length;n++)a=e[n],a.ref.impl=a.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&o!==null){e=void 0,n=t,a=o.memoizedProps,o=o.memoizedState,l=n.stateNode;try{var W=Ba(n.type,a);e=l.getSnapshotBeforeUpdate(W,o),l.__reactInternalSnapshotBeforeUpdate=e}catch(ue){$e(n,n.return,ue)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,n=e.nodeType,n===9)Pc(e);else if(n===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":Pc(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(c(163))}if(e=t.sibling,e!==null){e.return=t.return,Dt=e;break}Dt=t.return}}function Zf(e,t,n){var l=n.flags;switch(n.tag){case 0:case 11:case 15:Nl(e,n),l&4&&gs(5,n);break;case 1:if(Nl(e,n),l&4)if(e=n.stateNode,t===null)try{e.componentDidMount()}catch(i){$e(n,n.return,i)}else{var a=Ba(n.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(a,t,e.__reactInternalSnapshotBeforeUpdate)}catch(i){$e(n,n.return,i)}}l&64&&Uf(n),l&512&&ps(n,n.return);break;case 3:if(Nl(e,n),l&64&&(e=n.updateQueue,e!==null)){if(t=null,n.child!==null)switch(n.child.tag){case 27:case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}try{kd(e,t)}catch(i){$e(n,n.return,i)}}break;case 27:t===null&&l&4&&$f(n);case 26:case 5:Nl(e,n),t===null&&l&4&&Qf(n),l&512&&ps(n,n.return);break;case 12:Nl(e,n);break;case 31:Nl(e,n),l&4&&Kf(e,n);break;case 13:Nl(e,n),l&4&&Wf(e,n),l&64&&(e=n.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(n=Y0.bind(null,n),ah(e,n))));break;case 22:if(l=n.memoizedState!==null||Cl,!l){t=t!==null&&t.memoizedState!==null||Et,a=Cl;var o=Et;Cl=l,(Et=t)&&!o?El(e,n,(n.subtreeFlags&8772)!==0):Nl(e,n),Cl=a,Et=o}break;case 30:break;default:Nl(e,n)}}function Vf(e){var t=e.alternate;t!==null&&(e.alternate=null,Vf(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&ha(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var ut=null,en=!1;function jl(e,t,n){for(n=n.child;n!==null;)Jf(e,t,n),n=n.sibling}function Jf(e,t,n){if(Oe&&typeof Oe.onCommitFiberUnmount=="function")try{Oe.onCommitFiberUnmount(Ol,n)}catch{}switch(n.tag){case 26:Et||nl(n,t),jl(e,t,n),n.memoizedState?n.memoizedState.count--:n.stateNode&&(n=n.stateNode,n.parentNode.removeChild(n));break;case 27:Et||nl(n,t);var l=ut,a=en;na(n.type)&&(ut=n.stateNode,en=!1),jl(e,t,n),Ns(n.stateNode),ut=l,en=a;break;case 5:Et||nl(n,t);case 6:if(l=ut,a=en,ut=null,jl(e,t,n),ut=l,en=a,ut!==null)if(en)try{(ut.nodeType===9?ut.body:ut.nodeName==="HTML"?ut.ownerDocument.body:ut).removeChild(n.stateNode)}catch(o){$e(n,t,o)}else try{ut.removeChild(n.stateNode)}catch(o){$e(n,t,o)}break;case 18:ut!==null&&(en?(e=ut,U_(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,n.stateNode),Ao(e)):U_(ut,n.stateNode));break;case 4:l=ut,a=en,ut=n.stateNode.containerInfo,en=!0,jl(e,t,n),ut=l,en=a;break;case 0:case 11:case 14:case 15:Kl(2,n,t),Et||Kl(4,n,t),jl(e,t,n);break;case 1:Et||(nl(n,t),l=n.stateNode,typeof l.componentWillUnmount=="function"&&Xf(n,t,l)),jl(e,t,n);break;case 21:jl(e,t,n);break;case 22:Et=(l=Et)||n.memoizedState!==null,jl(e,t,n),Et=l;break;default:jl(e,t,n)}}function Kf(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Ao(e)}catch(n){$e(t,t.return,n)}}}function Wf(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Ao(e)}catch(n){$e(t,t.return,n)}}function z0(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new qf),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new qf),t;default:throw Error(c(435,e.tag))}}function Ei(e,t){var n=z0(e);t.forEach(function(l){if(!n.has(l)){n.add(l);var a=H0.bind(null,e,l);l.then(a,a)}})}function tn(e,t){var n=t.deletions;if(n!==null)for(var l=0;l<n.length;l++){var a=n[l],o=e,i=t,r=i;e:for(;r!==null;){switch(r.tag){case 27:if(na(r.type)){ut=r.stateNode,en=!1;break e}break;case 5:ut=r.stateNode,en=!1;break e;case 3:case 4:ut=r.stateNode.containerInfo,en=!0;break e}r=r.return}if(ut===null)throw Error(c(160));Jf(o,i,a),ut=null,en=!1,o=a.alternate,o!==null&&(o.return=null),a.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)If(t,e),t=t.sibling}var Qn=null;function If(e,t){var n=e.alternate,l=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:tn(t,e),nn(e),l&4&&(Kl(3,e,e.return),gs(3,e),Kl(5,e,e.return));break;case 1:tn(t,e),nn(e),l&512&&(Et||n===null||nl(n,n.return)),l&64&&Cl&&(e=e.updateQueue,e!==null&&(l=e.callbacks,l!==null&&(n=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=n===null?l:n.concat(l))));break;case 26:var a=Qn;if(tn(t,e),nn(e),l&512&&(Et||n===null||nl(n,n.return)),l&4){var o=n!==null?n.memoizedState:null;if(l=e.memoizedState,n===null)if(l===null)if(e.stateNode===null){e:{l=e.type,n=e.memoizedProps,a=a.ownerDocument||a;t:switch(l){case"title":o=a.getElementsByTagName("title")[0],(!o||o[Ll]||o[zt]||o.namespaceURI==="http://www.w3.org/2000/svg"||o.hasAttribute("itemprop"))&&(o=a.createElement(l),a.head.insertBefore(o,a.querySelector("head > title"))),Xt(o,l,n),o[zt]=e,mt(o),l=o;break e;case"link":var i=I_("link","href",a).get(l+(n.href||""));if(i){for(var r=0;r<i.length;r++)if(o=i[r],o.getAttribute("href")===(n.href==null||n.href===""?null:n.href)&&o.getAttribute("rel")===(n.rel==null?null:n.rel)&&o.getAttribute("title")===(n.title==null?null:n.title)&&o.getAttribute("crossorigin")===(n.crossOrigin==null?null:n.crossOrigin)){i.splice(r,1);break t}}o=a.createElement(l),Xt(o,l,n),a.head.appendChild(o);break;case"meta":if(i=I_("meta","content",a).get(l+(n.content||""))){for(r=0;r<i.length;r++)if(o=i[r],o.getAttribute("content")===(n.content==null?null:""+n.content)&&o.getAttribute("name")===(n.name==null?null:n.name)&&o.getAttribute("property")===(n.property==null?null:n.property)&&o.getAttribute("http-equiv")===(n.httpEquiv==null?null:n.httpEquiv)&&o.getAttribute("charset")===(n.charSet==null?null:n.charSet)){i.splice(r,1);break t}}o=a.createElement(l),Xt(o,l,n),a.head.appendChild(o);break;default:throw Error(c(468,l))}o[zt]=e,mt(o),l=o}e.stateNode=l}else F_(a,e.type,e.stateNode);else e.stateNode=W_(a,l,e.memoizedProps);else o!==l?(o===null?n.stateNode!==null&&(n=n.stateNode,n.parentNode.removeChild(n)):o.count--,l===null?F_(a,e.type,e.stateNode):W_(a,l,e.memoizedProps)):l===null&&e.stateNode!==null&&jc(e,e.memoizedProps,n.memoizedProps)}break;case 27:tn(t,e),nn(e),l&512&&(Et||n===null||nl(n,n.return)),n!==null&&l&4&&jc(e,e.memoizedProps,n.memoizedProps);break;case 5:if(tn(t,e),nn(e),l&512&&(Et||n===null||nl(n,n.return)),e.flags&32){a=e.stateNode;try{wn(a,"")}catch(W){$e(e,e.return,W)}}l&4&&e.stateNode!=null&&(a=e.memoizedProps,jc(e,a,n!==null?n.memoizedProps:a)),l&1024&&(Tc=!0);break;case 6:if(tn(t,e),nn(e),l&4){if(e.stateNode===null)throw Error(c(162));l=e.memoizedProps,n=e.stateNode;try{n.nodeValue=l}catch(W){$e(e,e.return,W)}}break;case 3:if(Gi=null,a=Qn,Qn=Xi(t.containerInfo),tn(t,e),Qn=a,nn(e),l&4&&n!==null&&n.memoizedState.isDehydrated)try{Ao(t.containerInfo)}catch(W){$e(e,e.return,W)}Tc&&(Tc=!1,Ff(e));break;case 4:l=Qn,Qn=Xi(e.stateNode.containerInfo),tn(t,e),nn(e),Qn=l;break;case 12:tn(t,e),nn(e);break;case 31:tn(t,e),nn(e),l&4&&(l=e.updateQueue,l!==null&&(e.updateQueue=null,Ei(e,l)));break;case 13:tn(t,e),nn(e),e.child.flags&8192&&e.memoizedState!==null!=(n!==null&&n.memoizedState!==null)&&(ki=ie()),l&4&&(l=e.updateQueue,l!==null&&(e.updateQueue=null,Ei(e,l)));break;case 22:a=e.memoizedState!==null;var g=n!==null&&n.memoizedState!==null,C=Cl,L=Et;if(Cl=C||a,Et=L||g,tn(t,e),Et=L,Cl=C,nn(e),l&8192)e:for(t=e.stateNode,t._visibility=a?t._visibility&-2:t._visibility|1,a&&(n===null||g||Cl||Et||Da(e)),n=null,t=e;;){if(t.tag===5||t.tag===26){if(n===null){g=n=t;try{if(o=g.stateNode,a)i=o.style,typeof i.setProperty=="function"?i.setProperty("display","none","important"):i.display="none";else{r=g.stateNode;var R=g.memoizedProps.style,j=R!=null&&R.hasOwnProperty("display")?R.display:null;r.style.display=j==null||typeof j=="boolean"?"":(""+j).trim()}}catch(W){$e(g,g.return,W)}}}else if(t.tag===6){if(n===null){g=t;try{g.stateNode.nodeValue=a?"":g.memoizedProps}catch(W){$e(g,g.return,W)}}}else if(t.tag===18){if(n===null){g=t;try{var T=g.stateNode;a?X_(T,!0):X_(g.stateNode,!1)}catch(W){$e(g,g.return,W)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break e;for(;t.sibling===null;){if(t.return===null||t.return===e)break e;n===t&&(n=null),t=t.return}n===t&&(n=null),t.sibling.return=t.return,t=t.sibling}l&4&&(l=e.updateQueue,l!==null&&(n=l.retryQueue,n!==null&&(l.retryQueue=null,Ei(e,n))));break;case 19:tn(t,e),nn(e),l&4&&(l=e.updateQueue,l!==null&&(e.updateQueue=null,Ei(e,l)));break;case 30:break;case 21:break;default:tn(t,e),nn(e)}}function nn(e){var t=e.flags;if(t&2){try{for(var n,l=e.return;l!==null;){if(Gf(l)){n=l;break}l=l.return}if(n==null)throw Error(c(160));switch(n.tag){case 27:var a=n.stateNode,o=Nc(e);Ni(e,o,a);break;case 5:var i=n.stateNode;n.flags&32&&(wn(i,""),n.flags&=-33);var r=Nc(e);Ni(e,r,i);break;case 3:case 4:var g=n.stateNode.containerInfo,C=Nc(e);Ec(e,C,g);break;default:throw Error(c(161))}}catch(L){$e(e,e.return,L)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function Ff(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;Ff(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function Nl(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)Zf(e,t.alternate,t),t=t.sibling}function Da(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:Kl(4,t,t.return),Da(t);break;case 1:nl(t,t.return);var n=t.stateNode;typeof n.componentWillUnmount=="function"&&Xf(t,t.return,n),Da(t);break;case 27:Ns(t.stateNode);case 26:case 5:nl(t,t.return),Da(t);break;case 22:t.memoizedState===null&&Da(t);break;case 30:Da(t);break;default:Da(t)}e=e.sibling}}function El(e,t,n){for(n=n&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var l=t.alternate,a=e,o=t,i=o.flags;switch(o.tag){case 0:case 11:case 15:El(a,o,n),gs(4,o);break;case 1:if(El(a,o,n),l=o,a=l.stateNode,typeof a.componentDidMount=="function")try{a.componentDidMount()}catch(C){$e(l,l.return,C)}if(l=o,a=l.updateQueue,a!==null){var r=l.stateNode;try{var g=a.shared.hiddenCallbacks;if(g!==null)for(a.shared.hiddenCallbacks=null,a=0;a<g.length;a++)Td(g[a],r)}catch(C){$e(l,l.return,C)}}n&&i&64&&Uf(o),ps(o,o.return);break;case 27:$f(o);case 26:case 5:El(a,o,n),n&&l===null&&i&4&&Qf(o),ps(o,o.return);break;case 12:El(a,o,n);break;case 31:El(a,o,n),n&&i&4&&Kf(a,o);break;case 13:El(a,o,n),n&&i&4&&Wf(a,o);break;case 22:o.memoizedState===null&&El(a,o,n),ps(o,o.return);break;case 30:break;default:El(a,o,n)}t=t.sibling}}function kc(e,t){var n=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==n&&(e!=null&&e.refCount++,n!=null&&ls(n))}function zc(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&ls(e))}function Gn(e,t,n,l){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)Pf(e,t,n,l),t=t.sibling}function Pf(e,t,n,l){var a=t.flags;switch(t.tag){case 0:case 11:case 15:Gn(e,t,n,l),a&2048&&gs(9,t);break;case 1:Gn(e,t,n,l);break;case 3:Gn(e,t,n,l),a&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&ls(e)));break;case 12:if(a&2048){Gn(e,t,n,l),e=t.stateNode;try{var o=t.memoizedProps,i=o.id,r=o.onPostCommit;typeof r=="function"&&r(i,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(g){$e(t,t.return,g)}}else Gn(e,t,n,l);break;case 31:Gn(e,t,n,l);break;case 13:Gn(e,t,n,l);break;case 23:break;case 22:o=t.stateNode,i=t.alternate,t.memoizedState!==null?o._visibility&2?Gn(e,t,n,l):ys(e,t):o._visibility&2?Gn(e,t,n,l):(o._visibility|=2,xo(e,t,n,l,(t.subtreeFlags&10256)!==0||!1)),a&2048&&kc(i,t);break;case 24:Gn(e,t,n,l),a&2048&&zc(t.alternate,t);break;default:Gn(e,t,n,l)}}function xo(e,t,n,l,a){for(a=a&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var o=e,i=t,r=n,g=l,C=i.flags;switch(i.tag){case 0:case 11:case 15:xo(o,i,r,g,a),gs(8,i);break;case 23:break;case 22:var L=i.stateNode;i.memoizedState!==null?L._visibility&2?xo(o,i,r,g,a):ys(o,i):(L._visibility|=2,xo(o,i,r,g,a)),a&&C&2048&&kc(i.alternate,i);break;case 24:xo(o,i,r,g,a),a&&C&2048&&zc(i.alternate,i);break;default:xo(o,i,r,g,a)}t=t.sibling}}function ys(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var n=e,l=t,a=l.flags;switch(l.tag){case 22:ys(n,l),a&2048&&kc(l.alternate,l);break;case 24:ys(n,l),a&2048&&zc(l.alternate,l);break;default:ys(n,l)}t=t.sibling}}var bs=8192;function vo(e,t,n){if(e.subtreeFlags&bs)for(e=e.child;e!==null;)e_(e,t,n),e=e.sibling}function e_(e,t,n){switch(e.tag){case 26:vo(e,t,n),e.flags&bs&&e.memoizedState!==null&&gh(n,Qn,e.memoizedState,e.memoizedProps);break;case 5:vo(e,t,n);break;case 3:case 4:var l=Qn;Qn=Xi(e.stateNode.containerInfo),vo(e,t,n),Qn=l;break;case 22:e.memoizedState===null&&(l=e.alternate,l!==null&&l.memoizedState!==null?(l=bs,bs=16777216,vo(e,t,n),bs=l):vo(e,t,n));break;default:vo(e,t,n)}}function t_(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function xs(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var l=t[n];Dt=l,l_(l,e)}t_(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)n_(e),e=e.sibling}function n_(e){switch(e.tag){case 0:case 11:case 15:xs(e),e.flags&2048&&Kl(9,e,e.return);break;case 3:xs(e);break;case 12:xs(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,Ti(e)):xs(e);break;default:xs(e)}}function Ti(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var n=0;n<t.length;n++){var l=t[n];Dt=l,l_(l,e)}t_(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:Kl(8,t,t.return),Ti(t);break;case 22:n=t.stateNode,n._visibility&2&&(n._visibility&=-3,Ti(t));break;default:Ti(t)}e=e.sibling}}function l_(e,t){for(;Dt!==null;){var n=Dt;switch(n.tag){case 0:case 11:case 15:Kl(8,n,t);break;case 23:case 22:if(n.memoizedState!==null&&n.memoizedState.cachePool!==null){var l=n.memoizedState.cachePool.pool;l!=null&&l.refCount++}break;case 24:ls(n.memoizedState.cache)}if(l=n.child,l!==null)l.return=n,Dt=l;else e:for(n=e;Dt!==null;){l=Dt;var a=l.sibling,o=l.return;if(Vf(l),l===n){Dt=null;break e}if(a!==null){a.return=o,Dt=a;break e}Dt=o}}}var A0={getCacheForType:function(e){var t=Ht(Ct),n=t.data.get(e);return n===void 0&&(n=e(),t.data.set(e,n)),n},cacheSignal:function(){return Ht(Ct).controller.signal}},M0=typeof WeakMap=="function"?WeakMap:Map,He=0,Pe=null,je=null,ke=0,Ge=0,mn=null,Wl=!1,So=!1,Ac=!1,Tl=0,pt=0,Il=0,Ra=0,Mc=0,hn=0,wo=0,vs=null,ln=null,Oc=!1,ki=0,a_=0,zi=1/0,Ai=null,Fl=null,Mt=0,Pl=null,Co=null,kl=0,Lc=0,Bc=null,o_=null,Ss=0,Dc=null;function gn(){return(He&2)!==0&&ke!==0?ke&-ke:z.T!==null?Qc():rl()}function s_(){if(hn===0)if((ke&536870912)===0||Me){var e=fa;fa<<=1,(fa&3932160)===0&&(fa=262144),hn=e}else hn=536870912;return e=fn.current,e!==null&&(e.flags|=32),hn}function an(e,t,n){(e===Pe&&(Ge===2||Ge===9)||e.cancelPendingCommit!==null)&&(jo(e,0),ea(e,ke,hn,!1)),cl(e,n),((He&2)===0||e!==Pe)&&(e===Pe&&((He&2)===0&&(Ra|=n),pt===4&&ea(e,ke,hn,!1)),ll(e))}function i_(e,t,n){if((He&6)!==0)throw Error(c(327));var l=!n&&(t&127)===0&&(t&e.expiredLanes)===0||Vn(e,t),a=l?B0(e,t):Yc(e,t,!0),o=l;do{if(a===0){So&&!l&&ea(e,t,0,!1);break}else{if(n=e.current.alternate,o&&!O0(n)){a=Yc(e,t,!1),o=!1;continue}if(a===2){if(o=t,e.errorRecoveryDisabledLanes&o)var i=0;else i=e.pendingLanes&-536870913,i=i!==0?i:i&536870912?536870912:0;if(i!==0){t=i;e:{var r=e;a=vs;var g=r.current.memoizedState.isDehydrated;if(g&&(jo(r,i).flags|=256),i=Yc(r,i,!1),i!==2){if(Ac&&!g){r.errorRecoveryDisabledLanes|=o,Ra|=o,a=4;break e}o=ln,ln=a,o!==null&&(ln===null?ln=o:ln.push.apply(ln,o))}a=i}if(o=!1,a!==2)continue}}if(a===1){jo(e,0),ea(e,t,0,!0);break}e:{switch(l=e,o=a,o){case 0:case 1:throw Error(c(345));case 4:if((t&4194048)!==t)break;case 6:ea(l,t,hn,!Wl);break e;case 2:ln=null;break;case 3:case 5:break;default:throw Error(c(329))}if((t&62914560)===t&&(a=ki+300-ie(),10<a)){if(ea(l,t,hn,!Wl),_a(l,0,!0)!==0)break e;kl=t,l.timeoutHandle=Y_(u_.bind(null,l,n,ln,Ai,Oc,t,hn,Ra,wo,Wl,o,"Throttled",-0,0),a);break e}u_(l,n,ln,Ai,Oc,t,hn,Ra,wo,Wl,o,null,-0,0)}}break}while(!0);ll(e)}function u_(e,t,n,l,a,o,i,r,g,C,L,R,j,T){if(e.timeoutHandle=-1,R=t.subtreeFlags,R&8192||(R&16785408)===16785408){R={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:Cn},e_(t,o,R);var W=(o&62914560)===o?ki-ie():(o&4194048)===o?a_-ie():0;if(W=ph(R,W),W!==null){kl=o,e.cancelPendingCommit=W(g_.bind(null,e,t,o,n,l,a,i,r,g,L,R,null,j,T)),ea(e,o,i,!C);return}}g_(e,t,o,n,l,a,i,r,g)}function O0(e){for(var t=e;;){var n=t.tag;if((n===0||n===11||n===15)&&t.flags&16384&&(n=t.updateQueue,n!==null&&(n=n.stores,n!==null)))for(var l=0;l<n.length;l++){var a=n[l],o=a.getSnapshot;a=a.value;try{if(!rn(o(),a))return!1}catch{return!1}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function ea(e,t,n,l){t&=~Mc,t&=~Ra,e.suspendedLanes|=t,e.pingedLanes&=~t,l&&(e.warmLanes|=t),l=e.expirationTimes;for(var a=t;0<a;){var o=31-ot(a),i=1<<o;l[o]=-1,a&=~i}n!==0&&Ho(e,n,t)}function Mi(){return(He&6)===0?(ws(0),!1):!0}function Rc(){if(je!==null){if(Ge===0)var e=je.return;else e=je,yl=Ta=null,Pu(e),ho=null,os=0,e=je;for(;e!==null;)Hf(e.alternate,e),e=e.return;je=null}}function jo(e,t){var n=e.timeoutHandle;n!==-1&&(e.timeoutHandle=-1,P0(n)),n=e.cancelPendingCommit,n!==null&&(e.cancelPendingCommit=null,n()),kl=0,Rc(),Pe=e,je=n=gl(e.current,null),ke=t,Ge=0,mn=null,Wl=!1,So=Vn(e,t),Ac=!1,wo=hn=Mc=Ra=Il=pt=0,ln=vs=null,Oc=!1,(t&8)!==0&&(t|=t&32);var l=e.entangledLanes;if(l!==0)for(e=e.entanglements,l&=t;0<l;){var a=31-ot(l),o=1<<a;t|=e[a],l&=~o}return Tl=t,Ps(),n}function c_(e,t){xe=null,z.H=_s,t===mo||t===ii?(t=Cd(),Ge=3):t===Xu?(t=Cd(),Ge=4):Ge=t===hc?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,mn=t,je===null&&(pt=1,vi(e,Tn(t,e.current)))}function r_(){var e=fn.current;return e===null?!0:(ke&4194048)===ke?Mn===null:(ke&62914560)===ke||(ke&536870912)!==0?e===Mn:!1}function d_(){var e=z.H;return z.H=_s,e===null?_s:e}function f_(){var e=z.A;return z.A=A0,e}function Oi(){pt=4,Wl||(ke&4194048)!==ke&&fn.current!==null||(So=!0),(Il&134217727)===0&&(Ra&134217727)===0||Pe===null||ea(Pe,ke,hn,!1)}function Yc(e,t,n){var l=He;He|=2;var a=d_(),o=f_();(Pe!==e||ke!==t)&&(Ai=null,jo(e,t)),t=!1;var i=pt;e:do try{if(Ge!==0&&je!==null){var r=je,g=mn;switch(Ge){case 8:Rc(),i=6;break e;case 3:case 2:case 9:case 6:fn.current===null&&(t=!0);var C=Ge;if(Ge=0,mn=null,No(e,r,g,C),n&&So){i=0;break e}break;default:C=Ge,Ge=0,mn=null,No(e,r,g,C)}}L0(),i=pt;break}catch(L){c_(e,L)}while(!0);return t&&e.shellSuspendCounter++,yl=Ta=null,He=l,z.H=a,z.A=o,je===null&&(Pe=null,ke=0,Ps()),i}function L0(){for(;je!==null;)__(je)}function B0(e,t){var n=He;He|=2;var l=d_(),a=f_();Pe!==e||ke!==t?(Ai=null,zi=ie()+500,jo(e,t)):So=Vn(e,t);e:do try{if(Ge!==0&&je!==null){t=je;var o=mn;t:switch(Ge){case 1:Ge=0,mn=null,No(e,t,o,1);break;case 2:case 9:if(Sd(o)){Ge=0,mn=null,m_(t);break}t=function(){Ge!==2&&Ge!==9||Pe!==e||(Ge=7),ll(e)},o.then(t,t);break e;case 3:Ge=7;break e;case 4:Ge=5;break e;case 7:Sd(o)?(Ge=0,mn=null,m_(t)):(Ge=0,mn=null,No(e,t,o,7));break;case 5:var i=null;switch(je.tag){case 26:i=je.memoizedState;case 5:case 27:var r=je;if(i?P_(i):r.stateNode.complete){Ge=0,mn=null;var g=r.sibling;if(g!==null)je=g;else{var C=r.return;C!==null?(je=C,Li(C)):je=null}break t}}Ge=0,mn=null,No(e,t,o,5);break;case 6:Ge=0,mn=null,No(e,t,o,6);break;case 8:Rc(),pt=6;break e;default:throw Error(c(462))}}D0();break}catch(L){c_(e,L)}while(!0);return yl=Ta=null,z.H=l,z.A=a,He=n,je!==null?0:(Pe=null,ke=0,Ps(),pt)}function D0(){for(;je!==null&&!$a();)__(je)}function __(e){var t=Rf(e.alternate,e,Tl);e.memoizedProps=e.pendingProps,t===null?Li(e):je=t}function m_(e){var t=e,n=t.alternate;switch(t.tag){case 15:case 0:t=Af(n,t,t.pendingProps,t.type,void 0,ke);break;case 11:t=Af(n,t,t.pendingProps,t.type.render,t.ref,ke);break;case 5:Pu(t);default:Hf(n,t),t=je=dd(t,Tl),t=Rf(n,t,Tl)}e.memoizedProps=e.pendingProps,t===null?Li(e):je=t}function No(e,t,n,l){yl=Ta=null,Pu(t),ho=null,os=0;var a=t.return;try{if(C0(e,a,t,n,ke)){pt=1,vi(e,Tn(n,e.current)),je=null;return}}catch(o){if(a!==null)throw je=a,o;pt=1,vi(e,Tn(n,e.current)),je=null;return}t.flags&32768?(Me||l===1?e=!0:So||(ke&536870912)!==0?e=!1:(Wl=e=!0,(l===2||l===9||l===3||l===6)&&(l=fn.current,l!==null&&l.tag===13&&(l.flags|=16384))),h_(t,e)):Li(t)}function Li(e){var t=e;do{if((t.flags&32768)!==0){h_(t,Wl);return}e=t.return;var n=E0(t.alternate,t,Tl);if(n!==null){je=n;return}if(t=t.sibling,t!==null){je=t;return}je=t=e}while(t!==null);pt===0&&(pt=5)}function h_(e,t){do{var n=T0(e.alternate,e);if(n!==null){n.flags&=32767,je=n;return}if(n=e.return,n!==null&&(n.flags|=32768,n.subtreeFlags=0,n.deletions=null),!t&&(e=e.sibling,e!==null)){je=e;return}je=e=n}while(e!==null);pt=6,je=null}function g_(e,t,n,l,a,o,i,r,g){e.cancelPendingCommit=null;do Bi();while(Mt!==0);if((He&6)!==0)throw Error(c(327));if(t!==null){if(t===e.current)throw Error(c(177));if(o=t.lanes|t.childLanes,o|=Nu,Yo(e,n,o,i,r,g),e===Pe&&(je=Pe=null,ke=0),Co=t,Pl=e,kl=n,Lc=o,Bc=a,o_=l,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,U0(ra,function(){return v_(),null})):(e.callbackNode=null,e.callbackPriority=0),l=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||l){l=z.T,z.T=null,a=U.p,U.p=2,i=He,He|=4;try{k0(e,t,n)}finally{He=i,U.p=a,z.T=l}}Mt=1,p_(),y_(),b_()}}function p_(){if(Mt===1){Mt=0;var e=Pl,t=Co,n=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||n){n=z.T,z.T=null;var l=U.p;U.p=2;var a=He;He|=4;try{If(t,e);var o=Wc,i=nd(e.containerInfo),r=o.focusedElem,g=o.selectionRange;if(i!==r&&r&&r.ownerDocument&&td(r.ownerDocument.documentElement,r)){if(g!==null&&vu(r)){var C=g.start,L=g.end;if(L===void 0&&(L=C),"selectionStart"in r)r.selectionStart=C,r.selectionEnd=Math.min(L,r.value.length);else{var R=r.ownerDocument||document,j=R&&R.defaultView||window;if(j.getSelection){var T=j.getSelection(),W=r.textContent.length,ue=Math.min(g.start,W),We=g.end===void 0?ue:Math.min(g.end,W);!T.extend&&ue>We&&(i=We,We=ue,ue=i);var x=ed(r,ue),y=ed(r,We);if(x&&y&&(T.rangeCount!==1||T.anchorNode!==x.node||T.anchorOffset!==x.offset||T.focusNode!==y.node||T.focusOffset!==y.offset)){var w=R.createRange();w.setStart(x.node,x.offset),T.removeAllRanges(),ue>We?(T.addRange(w),T.extend(y.node,y.offset)):(w.setEnd(y.node,y.offset),T.addRange(w))}}}}for(R=[],T=r;T=T.parentNode;)T.nodeType===1&&R.push({element:T,left:T.scrollLeft,top:T.scrollTop});for(typeof r.focus=="function"&&r.focus(),r=0;r<R.length;r++){var D=R[r];D.element.scrollLeft=D.left,D.element.scrollTop=D.top}}Vi=!!Kc,Wc=Kc=null}finally{He=a,U.p=l,z.T=n}}e.current=t,Mt=2}}function y_(){if(Mt===2){Mt=0;var e=Pl,t=Co,n=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||n){n=z.T,z.T=null;var l=U.p;U.p=2;var a=He;He|=4;try{Zf(e,t.alternate,t)}finally{He=a,U.p=l,z.T=n}}Mt=3}}function b_(){if(Mt===4||Mt===3){Mt=0,Xs();var e=Pl,t=Co,n=kl,l=o_;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?Mt=5:(Mt=0,Co=Pl=null,x_(e,e.pendingLanes));var a=e.pendingLanes;if(a===0&&(Fl=null),st(n),t=t.stateNode,Oe&&typeof Oe.onCommitFiberRoot=="function")try{Oe.onCommitFiberRoot(Ol,t,void 0,(t.current.flags&128)===128)}catch{}if(l!==null){t=z.T,a=U.p,U.p=2,z.T=null;try{for(var o=e.onRecoverableError,i=0;i<l.length;i++){var r=l[i];o(r.value,{componentStack:r.stack})}}finally{z.T=t,U.p=a}}(kl&3)!==0&&Bi(),ll(e),a=e.pendingLanes,(n&261930)!==0&&(a&42)!==0?e===Dc?Ss++:(Ss=0,Dc=e):Ss=0,ws(0)}}function x_(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,ls(t)))}function Bi(){return p_(),y_(),b_(),v_()}function v_(){if(Mt!==5)return!1;var e=Pl,t=Lc;Lc=0;var n=st(kl),l=z.T,a=U.p;try{U.p=32>n?32:n,z.T=null,n=Bc,Bc=null;var o=Pl,i=kl;if(Mt=0,Co=Pl=null,kl=0,(He&6)!==0)throw Error(c(331));var r=He;if(He|=4,n_(o.current),Pf(o,o.current,i,n),He=r,ws(0,!1),Oe&&typeof Oe.onPostCommitFiberRoot=="function")try{Oe.onPostCommitFiberRoot(Ol,o)}catch{}return!0}finally{U.p=a,z.T=l,x_(e,t)}}function S_(e,t,n){t=Tn(n,t),t=mc(e.stateNode,t,2),e=Zl(e,t,2),e!==null&&(cl(e,2),ll(e))}function $e(e,t,n){if(e.tag===3)S_(e,e,n);else for(;t!==null;){if(t.tag===3){S_(t,e,n);break}else if(t.tag===1){var l=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof l.componentDidCatch=="function"&&(Fl===null||!Fl.has(l))){e=Tn(n,e),n=wf(2),l=Zl(t,n,2),l!==null&&(Cf(n,l,t,e),cl(l,2),ll(l));break}}t=t.return}}function Hc(e,t,n){var l=e.pingCache;if(l===null){l=e.pingCache=new M0;var a=new Set;l.set(t,a)}else a=l.get(t),a===void 0&&(a=new Set,l.set(t,a));a.has(n)||(Ac=!0,a.add(n),e=R0.bind(null,e,t,n),t.then(e,e))}function R0(e,t,n){var l=e.pingCache;l!==null&&l.delete(t),e.pingedLanes|=e.suspendedLanes&n,e.warmLanes&=~n,Pe===e&&(ke&n)===n&&(pt===4||pt===3&&(ke&62914560)===ke&&300>ie()-ki?(He&2)===0&&jo(e,0):Mc|=n,wo===ke&&(wo=0)),ll(e)}function w_(e,t){t===0&&(t=Kn()),e=ja(e,t),e!==null&&(cl(e,t),ll(e))}function Y0(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),w_(e,n)}function H0(e,t){var n=0;switch(e.tag){case 31:case 13:var l=e.stateNode,a=e.memoizedState;a!==null&&(n=a.retryLane);break;case 19:l=e.stateNode;break;case 22:l=e.stateNode._retryCache;break;default:throw Error(c(314))}l!==null&&l.delete(t),w_(e,n)}function U0(e,t){return Qa(e,t)}var Di=null,Eo=null,Uc=!1,Ri=!1,Xc=!1,ta=0;function ll(e){e!==Eo&&e.next===null&&(Eo===null?Di=Eo=e:Eo=Eo.next=e),Ri=!0,Uc||(Uc=!0,Q0())}function ws(e,t){if(!Xc&&Ri){Xc=!0;do for(var n=!1,l=Di;l!==null;){if(e!==0){var a=l.pendingLanes;if(a===0)var o=0;else{var i=l.suspendedLanes,r=l.pingedLanes;o=(1<<31-ot(42|e)+1)-1,o&=a&~(i&~r),o=o&201326741?o&201326741|1:o?o|2:0}o!==0&&(n=!0,E_(l,o))}else o=ke,o=_a(l,l===Pe?o:0,l.cancelPendingCommit!==null||l.timeoutHandle!==-1),(o&3)===0||Vn(l,o)||(n=!0,E_(l,o));l=l.next}while(n);Xc=!1}}function X0(){C_()}function C_(){Ri=Uc=!1;var e=0;ta!==0&&F0()&&(e=ta);for(var t=ie(),n=null,l=Di;l!==null;){var a=l.next,o=j_(l,t);o===0?(l.next=null,n===null?Di=a:n.next=a,a===null&&(Eo=n)):(n=l,(e!==0||(o&3)!==0)&&(Ri=!0)),l=a}Mt!==0&&Mt!==5||ws(e),ta!==0&&(ta=0)}function j_(e,t){for(var n=e.suspendedLanes,l=e.pingedLanes,a=e.expirationTimes,o=e.pendingLanes&-62914561;0<o;){var i=31-ot(o),r=1<<i,g=a[i];g===-1?((r&n)===0||(r&l)!==0)&&(a[i]=Jn(r,t)):g<=t&&(e.expiredLanes|=r),o&=~r}if(t=Pe,n=ke,n=_a(e,e===t?n:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),l=e.callbackNode,n===0||e===t&&(Ge===2||Ge===9)||e.cancelPendingCommit!==null)return l!==null&&l!==null&&Ga(l),e.callbackNode=null,e.callbackPriority=0;if((n&3)===0||Vn(e,n)){if(t=n&-n,t===e.callbackPriority)return t;switch(l!==null&&Ga(l),st(n)){case 2:case 8:n=bn;break;case 32:n=ra;break;case 268435456:n=qn;break;default:n=ra}return l=N_.bind(null,e),n=Qa(n,l),e.callbackPriority=t,e.callbackNode=n,t}return l!==null&&l!==null&&Ga(l),e.callbackPriority=2,e.callbackNode=null,2}function N_(e,t){if(Mt!==0&&Mt!==5)return e.callbackNode=null,e.callbackPriority=0,null;var n=e.callbackNode;if(Bi()&&e.callbackNode!==n)return null;var l=ke;return l=_a(e,e===Pe?l:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),l===0?null:(i_(e,l,t),j_(e,ie()),e.callbackNode!=null&&e.callbackNode===n?N_.bind(null,e):null)}function E_(e,t){if(Bi())return null;i_(e,t,!0)}function Q0(){eh(function(){(He&6)!==0?Qa(qa,X0):C_()})}function Qc(){if(ta===0){var e=fo;e===0&&(e=Za,Za<<=1,(Za&261888)===0&&(Za=256)),ta=e}return ta}function T_(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:va(""+e)}function k_(e,t){var n=t.ownerDocument.createElement("input");return n.name=t.name,n.value=t.value,e.id&&n.setAttribute("form",e.id),t.parentNode.insertBefore(n,t),e=new FormData(e),n.parentNode.removeChild(n),e}function G0(e,t,n,l,a){if(t==="submit"&&n&&n.stateNode===a){var o=T_((a[At]||null).action),i=l.submitter;i&&(t=(t=i[At]||null)?T_(t.formAction):i.getAttribute("formAction"),t!==null&&(o=t,i=null));var r=new Hn("action","action",null,l,a);e.push({event:r,listeners:[{instance:null,listener:function(){if(l.defaultPrevented){if(ta!==0){var g=i?k_(a,i):new FormData(a);uc(n,{pending:!0,data:g,method:a.method,action:o},null,g)}}else typeof o=="function"&&(r.preventDefault(),g=i?k_(a,i):new FormData(a),uc(n,{pending:!0,data:g,method:a.method,action:o},o,g))},currentTarget:a}]})}}for(var Gc=0;Gc<ju.length;Gc++){var $c=ju[Gc],$0=$c.toLowerCase(),q0=$c[0].toUpperCase()+$c.slice(1);Xn($0,"on"+q0)}Xn(od,"onAnimationEnd"),Xn(sd,"onAnimationIteration"),Xn(id,"onAnimationStart"),Xn("dblclick","onDoubleClick"),Xn("focusin","onFocus"),Xn("focusout","onBlur"),Xn(i0,"onTransitionRun"),Xn(u0,"onTransitionStart"),Xn(c0,"onTransitionCancel"),Xn(ud,"onTransitionEnd"),Xe("onMouseEnter",["mouseout","mouseover"]),Xe("onMouseLeave",["mouseout","mouseover"]),Xe("onPointerEnter",["pointerout","pointerover"]),Xe("onPointerLeave",["pointerout","pointerover"]),Vt("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),Vt("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),Vt("onBeforeInput",["compositionend","keypress","textInput","paste"]),Vt("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),Vt("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),Vt("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Cs="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),Z0=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Cs));function z_(e,t){t=(t&4)!==0;for(var n=0;n<e.length;n++){var l=e[n],a=l.event;l=l.listeners;e:{var o=void 0;if(t)for(var i=l.length-1;0<=i;i--){var r=l[i],g=r.instance,C=r.currentTarget;if(r=r.listener,g!==o&&a.isPropagationStopped())break e;o=r,a.currentTarget=C;try{o(a)}catch(L){Fs(L)}a.currentTarget=null,o=g}else for(i=0;i<l.length;i++){if(r=l[i],g=r.instance,C=r.currentTarget,r=r.listener,g!==o&&a.isPropagationStopped())break e;o=r,a.currentTarget=C;try{o(a)}catch(L){Fs(L)}a.currentTarget=null,o=g}}}}function Ne(e,t){var n=t[Rn];n===void 0&&(n=t[Rn]=new Set);var l=e+"__bubble";n.has(l)||(A_(t,e,2,!1),n.add(l))}function qc(e,t,n){var l=0;t&&(l|=4),A_(n,e,l,t)}var Yi="_reactListening"+Math.random().toString(36).slice(2);function Zc(e){if(!e[Yi]){e[Yi]=!0,Qo.forEach(function(n){n!=="selectionchange"&&(Z0.has(n)||qc(n,!1,e),qc(n,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[Yi]||(t[Yi]=!0,qc("selectionchange",!1,t))}}function A_(e,t,n,l){switch(sm(t)){case 2:var a=xh;break;case 8:a=vh;break;default:a=ir}n=a.bind(null,t,n,e),a=void 0,!Ko||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(a=!0),l?a!==void 0?e.addEventListener(t,n,{capture:!0,passive:a}):e.addEventListener(t,n,!0):a!==void 0?e.addEventListener(t,n,{passive:a}):e.addEventListener(t,n,!1)}function Vc(e,t,n,l,a){var o=l;if((t&1)===0&&(t&2)===0&&l!==null)e:for(;;){if(l===null)return;var i=l.tag;if(i===3||i===4){var r=l.stateNode.containerInfo;if(r===a)break;if(i===4)for(i=l.return;i!==null;){var g=i.tag;if((g===3||g===4)&&i.stateNode.containerInfo===a)return;i=i.return}for(;r!==null;){if(i=xn(r),i===null)return;if(g=i.tag,g===5||g===6||g===26||g===27){l=o=i;continue e}r=r.parentNode}}l=l.return}Fa(function(){var C=o,L=Ye(n),R=[];e:{var j=cd.get(e);if(j!==void 0){var T=Hn,W=e;switch(e){case"keypress":if(Pa(n)===0)break e;case"keydown":case"keyup":T=Ce;break;case"focusin":W="focus",T=F;break;case"focusout":W="blur",T=F;break;case"beforeblur":case"afterblur":T=F;break;case"click":if(n.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":T=Y;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":T=Q;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":T=Pn;break;case od:case sd:case id:T=de;break;case ud:T=Ks;break;case"scroll":case"scrollend":T=Js;break;case"wheel":T=Ws;break;case"copy":case"cut":case"paste":T=re;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":T=yt;break;case"toggle":case"beforetoggle":T=Jm}var ue=(t&4)!==0,We=!ue&&(e==="scroll"||e==="scrollend"),x=ue?j!==null?j+"Capture":null:j;ue=[];for(var y=C,w;y!==null;){var D=y;if(w=D.stateNode,D=D.tag,D!==5&&D!==26&&D!==27||w===null||x===null||(D=Yl(y,x),D!=null&&ue.push(js(y,D,w))),We)break;y=y.return}0<ue.length&&(j=new T(j,W,null,n,L),R.push({event:j,listeners:ue}))}}if((t&7)===0){e:{if(j=e==="mouseover"||e==="pointerover",T=e==="mouseout"||e==="pointerout",j&&n!==dl&&(W=n.relatedTarget||n.fromElement)&&(xn(W)||W[G]))break e;if((T||j)&&(j=L.window===L?L:(j=L.ownerDocument)?j.defaultView||j.parentWindow:window,T?(W=n.relatedTarget||n.toElement,T=C,W=W?xn(W):null,W!==null&&(We=v(W),ue=W.tag,W!==We||ue!==5&&ue!==27&&ue!==6)&&(W=null)):(T=null,W=C),T!==W)){if(ue=Y,D="onMouseLeave",x="onMouseEnter",y="mouse",(e==="pointerout"||e==="pointerover")&&(ue=yt,D="onPointerLeave",x="onPointerEnter",y="pointer"),We=T==null?j:$t(T),w=W==null?j:$t(W),j=new ue(D,y+"leave",T,n,L),j.target=We,j.relatedTarget=w,D=null,xn(L)===C&&(ue=new ue(x,y+"enter",W,n,L),ue.target=w,ue.relatedTarget=We,D=ue),We=D,T&&W)t:{for(ue=V0,x=T,y=W,w=0,D=x;D;D=ue(D))w++;D=0;for(var ae=y;ae;ae=ue(ae))D++;for(;0<w-D;)x=ue(x),w--;for(;0<D-w;)y=ue(y),D--;for(;w--;){if(x===y||y!==null&&x===y.alternate){ue=x;break t}x=ue(x),y=ue(y)}ue=null}else ue=null;T!==null&&M_(R,j,T,ue,!1),W!==null&&We!==null&&M_(R,We,W,ue,!0)}}e:{if(j=C?$t(C):window,T=j.nodeName&&j.nodeName.toLowerCase(),T==="select"||T==="input"&&j.type==="file")var Be=Jr;else if(Zr(j))if(Kr)Be=a0;else{Be=n0;var P=t0}else T=j.nodeName,!T||T.toLowerCase()!=="input"||j.type!=="checkbox"&&j.type!=="radio"?C&&Ia(C.elementType)&&(Be=Jr):Be=l0;if(Be&&(Be=Be(e,C))){Vr(R,Be,n,L);break e}P&&P(e,j,C),e==="focusout"&&C&&j.type==="number"&&C.memoizedProps.value!=null&&ba(j,"number",j.value)}switch(P=C?$t(C):window,e){case"focusin":(Zr(P)||P.contentEditable==="true")&&(lo=P,Su=C,es=null);break;case"focusout":es=Su=lo=null;break;case"mousedown":wu=!0;break;case"contextmenu":case"mouseup":case"dragend":wu=!1,ld(R,n,L);break;case"selectionchange":if(s0)break;case"keydown":case"keyup":ld(R,n,L)}var ve;if(yu)e:{switch(e){case"compositionstart":var ze="onCompositionStart";break e;case"compositionend":ze="onCompositionEnd";break e;case"compositionupdate":ze="onCompositionUpdate";break e}ze=void 0}else no?$r(e,n)&&(ze="onCompositionEnd"):e==="keydown"&&n.keyCode===229&&(ze="onCompositionStart");ze&&(Xr&&n.locale!=="ko"&&(no||ze!=="onCompositionStart"?ze==="onCompositionEnd"&&no&&(ve=Vs()):(jn=L,Hl="value"in jn?jn.value:jn.textContent,no=!0)),P=Hi(C,ze),0<P.length&&(ze=new ce(ze,e,null,n,L),R.push({event:ze,listeners:P}),ve?ze.data=ve:(ve=qr(n),ve!==null&&(ze.data=ve)))),(ve=Wm?Im(e,n):Fm(e,n))&&(ze=Hi(C,"onBeforeInput"),0<ze.length&&(P=new ce("onBeforeInput","beforeinput",null,n,L),R.push({event:P,listeners:ze}),P.data=ve)),G0(R,e,C,n,L)}z_(R,t)})}function js(e,t,n){return{instance:e,listener:t,currentTarget:n}}function Hi(e,t){for(var n=t+"Capture",l=[];e!==null;){var a=e,o=a.stateNode;if(a=a.tag,a!==5&&a!==26&&a!==27||o===null||(a=Yl(e,n),a!=null&&l.unshift(js(e,a,o)),a=Yl(e,t),a!=null&&l.push(js(e,a,o))),e.tag===3)return l;e=e.return}return[]}function V0(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function M_(e,t,n,l,a){for(var o=t._reactName,i=[];n!==null&&n!==l;){var r=n,g=r.alternate,C=r.stateNode;if(r=r.tag,g!==null&&g===l)break;r!==5&&r!==26&&r!==27||C===null||(g=C,a?(C=Yl(n,o),C!=null&&i.unshift(js(n,C,g))):a||(C=Yl(n,o),C!=null&&i.push(js(n,C,g)))),n=n.return}i.length!==0&&e.push({event:t,listeners:i})}var J0=/\r\n?/g,K0=/\u0000|\uFFFD/g;function O_(e){return(typeof e=="string"?e:""+e).replace(J0,`
`).replace(K0,"")}function L_(e,t){return t=O_(t),O_(e)===t}function Ke(e,t,n,l,a,o){switch(n){case"children":typeof l=="string"?t==="body"||t==="textarea"&&l===""||wn(e,l):(typeof l=="number"||typeof l=="bigint")&&t!=="body"&&wn(e,""+l);break;case"className":Va(e,"class",l);break;case"tabIndex":Va(e,"tabindex",l);break;case"dir":case"role":case"viewBox":case"width":case"height":Va(e,n,l);break;case"style":xa(e,l,o);break;case"data":if(t!=="object"){Va(e,"data",l);break}case"src":case"href":if(l===""&&(t!=="a"||n!=="href")){e.removeAttribute(n);break}if(l==null||typeof l=="function"||typeof l=="symbol"||typeof l=="boolean"){e.removeAttribute(n);break}l=va(""+l),e.setAttribute(n,l);break;case"action":case"formAction":if(typeof l=="function"){e.setAttribute(n,"javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");break}else typeof o=="function"&&(n==="formAction"?(t!=="input"&&Ke(e,t,"name",a.name,a,null),Ke(e,t,"formEncType",a.formEncType,a,null),Ke(e,t,"formMethod",a.formMethod,a,null),Ke(e,t,"formTarget",a.formTarget,a,null)):(Ke(e,t,"encType",a.encType,a,null),Ke(e,t,"method",a.method,a,null),Ke(e,t,"target",a.target,a,null)));if(l==null||typeof l=="symbol"||typeof l=="boolean"){e.removeAttribute(n);break}l=va(""+l),e.setAttribute(n,l);break;case"onClick":l!=null&&(e.onclick=Cn);break;case"onScroll":l!=null&&Ne("scroll",e);break;case"onScrollEnd":l!=null&&Ne("scrollend",e);break;case"dangerouslySetInnerHTML":if(l!=null){if(typeof l!="object"||!("__html"in l))throw Error(c(61));if(n=l.__html,n!=null){if(a.children!=null)throw Error(c(60));e.innerHTML=n}}break;case"multiple":e.multiple=l&&typeof l!="function"&&typeof l!="symbol";break;case"muted":e.muted=l&&typeof l!="function"&&typeof l!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(l==null||typeof l=="function"||typeof l=="boolean"||typeof l=="symbol"){e.removeAttribute("xlink:href");break}n=va(""+l),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",n);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":l!=null&&typeof l!="function"&&typeof l!="symbol"?e.setAttribute(n,""+l):e.removeAttribute(n);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":l&&typeof l!="function"&&typeof l!="symbol"?e.setAttribute(n,""):e.removeAttribute(n);break;case"capture":case"download":l===!0?e.setAttribute(n,""):l!==!1&&l!=null&&typeof l!="function"&&typeof l!="symbol"?e.setAttribute(n,l):e.removeAttribute(n);break;case"cols":case"rows":case"size":case"span":l!=null&&typeof l!="function"&&typeof l!="symbol"&&!isNaN(l)&&1<=l?e.setAttribute(n,l):e.removeAttribute(n);break;case"rowSpan":case"start":l==null||typeof l=="function"||typeof l=="symbol"||isNaN(l)?e.removeAttribute(n):e.setAttribute(n,l);break;case"popover":Ne("beforetoggle",e),Ne("toggle",e),ga(e,"popover",l);break;case"xlinkActuate":Yn(e,"http://www.w3.org/1999/xlink","xlink:actuate",l);break;case"xlinkArcrole":Yn(e,"http://www.w3.org/1999/xlink","xlink:arcrole",l);break;case"xlinkRole":Yn(e,"http://www.w3.org/1999/xlink","xlink:role",l);break;case"xlinkShow":Yn(e,"http://www.w3.org/1999/xlink","xlink:show",l);break;case"xlinkTitle":Yn(e,"http://www.w3.org/1999/xlink","xlink:title",l);break;case"xlinkType":Yn(e,"http://www.w3.org/1999/xlink","xlink:type",l);break;case"xmlBase":Yn(e,"http://www.w3.org/XML/1998/namespace","xml:base",l);break;case"xmlLang":Yn(e,"http://www.w3.org/XML/1998/namespace","xml:lang",l);break;case"xmlSpace":Yn(e,"http://www.w3.org/XML/1998/namespace","xml:space",l);break;case"is":ga(e,"is",l);break;case"innerText":case"textContent":break;default:(!(2<n.length)||n[0]!=="o"&&n[0]!=="O"||n[1]!=="n"&&n[1]!=="N")&&(n=Vo.get(n)||n,ga(e,n,l))}}function Jc(e,t,n,l,a,o){switch(n){case"style":xa(e,l,o);break;case"dangerouslySetInnerHTML":if(l!=null){if(typeof l!="object"||!("__html"in l))throw Error(c(61));if(n=l.__html,n!=null){if(a.children!=null)throw Error(c(60));e.innerHTML=n}}break;case"children":typeof l=="string"?wn(e,l):(typeof l=="number"||typeof l=="bigint")&&wn(e,""+l);break;case"onScroll":l!=null&&Ne("scroll",e);break;case"onScrollEnd":l!=null&&Ne("scrollend",e);break;case"onClick":l!=null&&(e.onclick=Cn);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!Lt.hasOwnProperty(n))e:{if(n[0]==="o"&&n[1]==="n"&&(a=n.endsWith("Capture"),t=n.slice(2,a?n.length-7:void 0),o=e[At]||null,o=o!=null?o[n]:null,typeof o=="function"&&e.removeEventListener(t,o,a),typeof l=="function")){typeof o!="function"&&o!==null&&(n in e?e[n]=null:e.hasAttribute(n)&&e.removeAttribute(n)),e.addEventListener(t,l,a);break e}n in e?e[n]=l:l===!0?e.setAttribute(n,""):ga(e,n,l)}}}function Xt(e,t,n){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":Ne("error",e),Ne("load",e);var l=!1,a=!1,o;for(o in n)if(n.hasOwnProperty(o)){var i=n[o];if(i!=null)switch(o){case"src":l=!0;break;case"srcSet":a=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(c(137,t));default:Ke(e,t,o,i,n,null)}}a&&Ke(e,t,"srcSet",n.srcSet,n,null),l&&Ke(e,t,"src",n.src,n,null);return;case"input":Ne("invalid",e);var r=o=i=a=null,g=null,C=null;for(l in n)if(n.hasOwnProperty(l)){var L=n[l];if(L!=null)switch(l){case"name":a=L;break;case"type":i=L;break;case"checked":g=L;break;case"defaultChecked":C=L;break;case"value":o=L;break;case"defaultValue":r=L;break;case"children":case"dangerouslySetInnerHTML":if(L!=null)throw Error(c(137,t));break;default:Ke(e,t,l,L,n,null)}}Sn(e,o,r,g,C,i,a,!1);return;case"select":Ne("invalid",e),l=i=o=null;for(a in n)if(n.hasOwnProperty(a)&&(r=n[a],r!=null))switch(a){case"value":o=r;break;case"defaultValue":i=r;break;case"multiple":l=r;default:Ke(e,t,a,r,n,null)}t=o,n=i,e.multiple=!!l,t!=null?It(e,!!l,t,!1):n!=null&&It(e,!!l,n,!0);return;case"textarea":Ne("invalid",e),o=a=l=null;for(i in n)if(n.hasOwnProperty(i)&&(r=n[i],r!=null))switch(i){case"value":l=r;break;case"defaultValue":a=r;break;case"children":o=r;break;case"dangerouslySetInnerHTML":if(r!=null)throw Error(c(91));break;default:Ke(e,t,i,r,n,null)}Dl(e,l,a,o);return;case"option":for(g in n)n.hasOwnProperty(g)&&(l=n[g],l!=null)&&(g==="selected"?e.selected=l&&typeof l!="function"&&typeof l!="symbol":Ke(e,t,g,l,n,null));return;case"dialog":Ne("beforetoggle",e),Ne("toggle",e),Ne("cancel",e),Ne("close",e);break;case"iframe":case"object":Ne("load",e);break;case"video":case"audio":for(l=0;l<Cs.length;l++)Ne(Cs[l],e);break;case"image":Ne("error",e),Ne("load",e);break;case"details":Ne("toggle",e);break;case"embed":case"source":case"link":Ne("error",e),Ne("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(C in n)if(n.hasOwnProperty(C)&&(l=n[C],l!=null))switch(C){case"children":case"dangerouslySetInnerHTML":throw Error(c(137,t));default:Ke(e,t,C,l,n,null)}return;default:if(Ia(t)){for(L in n)n.hasOwnProperty(L)&&(l=n[L],l!==void 0&&Jc(e,t,L,l,n,void 0));return}}for(r in n)n.hasOwnProperty(r)&&(l=n[r],l!=null&&Ke(e,t,r,l,n,null))}function W0(e,t,n,l){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var a=null,o=null,i=null,r=null,g=null,C=null,L=null;for(T in n){var R=n[T];if(n.hasOwnProperty(T)&&R!=null)switch(T){case"checked":break;case"value":break;case"defaultValue":g=R;default:l.hasOwnProperty(T)||Ke(e,t,T,null,l,R)}}for(var j in l){var T=l[j];if(R=n[j],l.hasOwnProperty(j)&&(T!=null||R!=null))switch(j){case"type":o=T;break;case"name":a=T;break;case"checked":C=T;break;case"defaultChecked":L=T;break;case"value":i=T;break;case"defaultValue":r=T;break;case"children":case"dangerouslySetInnerHTML":if(T!=null)throw Error(c(137,t));break;default:T!==R&&Ke(e,t,j,T,l,R)}}In(e,i,r,g,C,L,o,a);return;case"select":T=i=r=j=null;for(o in n)if(g=n[o],n.hasOwnProperty(o)&&g!=null)switch(o){case"value":break;case"multiple":T=g;default:l.hasOwnProperty(o)||Ke(e,t,o,null,l,g)}for(a in l)if(o=l[a],g=n[a],l.hasOwnProperty(a)&&(o!=null||g!=null))switch(a){case"value":j=o;break;case"defaultValue":r=o;break;case"multiple":i=o;default:o!==g&&Ke(e,t,a,o,l,g)}t=r,n=i,l=T,j!=null?It(e,!!n,j,!1):!!l!=!!n&&(t!=null?It(e,!!n,t,!0):It(e,!!n,n?[]:"",!1));return;case"textarea":T=j=null;for(r in n)if(a=n[r],n.hasOwnProperty(r)&&a!=null&&!l.hasOwnProperty(r))switch(r){case"value":break;case"children":break;default:Ke(e,t,r,null,l,a)}for(i in l)if(a=l[i],o=n[i],l.hasOwnProperty(i)&&(a!=null||o!=null))switch(i){case"value":j=a;break;case"defaultValue":T=a;break;case"children":break;case"dangerouslySetInnerHTML":if(a!=null)throw Error(c(91));break;default:a!==o&&Ke(e,t,i,a,l,o)}cn(e,j,T);return;case"option":for(var W in n)j=n[W],n.hasOwnProperty(W)&&j!=null&&!l.hasOwnProperty(W)&&(W==="selected"?e.selected=!1:Ke(e,t,W,null,l,j));for(g in l)j=l[g],T=n[g],l.hasOwnProperty(g)&&j!==T&&(j!=null||T!=null)&&(g==="selected"?e.selected=j&&typeof j!="function"&&typeof j!="symbol":Ke(e,t,g,j,l,T));return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var ue in n)j=n[ue],n.hasOwnProperty(ue)&&j!=null&&!l.hasOwnProperty(ue)&&Ke(e,t,ue,null,l,j);for(C in l)if(j=l[C],T=n[C],l.hasOwnProperty(C)&&j!==T&&(j!=null||T!=null))switch(C){case"children":case"dangerouslySetInnerHTML":if(j!=null)throw Error(c(137,t));break;default:Ke(e,t,C,j,l,T)}return;default:if(Ia(t)){for(var We in n)j=n[We],n.hasOwnProperty(We)&&j!==void 0&&!l.hasOwnProperty(We)&&Jc(e,t,We,void 0,l,j);for(L in l)j=l[L],T=n[L],!l.hasOwnProperty(L)||j===T||j===void 0&&T===void 0||Jc(e,t,L,j,l,T);return}}for(var x in n)j=n[x],n.hasOwnProperty(x)&&j!=null&&!l.hasOwnProperty(x)&&Ke(e,t,x,null,l,j);for(R in l)j=l[R],T=n[R],!l.hasOwnProperty(R)||j===T||j==null&&T==null||Ke(e,t,R,j,l,T)}function B_(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function I0(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,n=performance.getEntriesByType("resource"),l=0;l<n.length;l++){var a=n[l],o=a.transferSize,i=a.initiatorType,r=a.duration;if(o&&r&&B_(i)){for(i=0,r=a.responseEnd,l+=1;l<n.length;l++){var g=n[l],C=g.startTime;if(C>r)break;var L=g.transferSize,R=g.initiatorType;L&&B_(R)&&(g=g.responseEnd,i+=L*(g<r?1:(r-C)/(g-C)))}if(--l,t+=8*(o+i)/(a.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var Kc=null,Wc=null;function Ui(e){return e.nodeType===9?e:e.ownerDocument}function D_(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function R_(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function Ic(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var Fc=null;function F0(){var e=window.event;return e&&e.type==="popstate"?e===Fc?!1:(Fc=e,!0):(Fc=null,!1)}var Y_=typeof setTimeout=="function"?setTimeout:void 0,P0=typeof clearTimeout=="function"?clearTimeout:void 0,H_=typeof Promise=="function"?Promise:void 0,eh=typeof queueMicrotask=="function"?queueMicrotask:typeof H_<"u"?function(e){return H_.resolve(null).then(e).catch(th)}:Y_;function th(e){setTimeout(function(){throw e})}function na(e){return e==="head"}function U_(e,t){var n=t,l=0;do{var a=n.nextSibling;if(e.removeChild(n),a&&a.nodeType===8)if(n=a.data,n==="/$"||n==="/&"){if(l===0){e.removeChild(a),Ao(t);return}l--}else if(n==="$"||n==="$?"||n==="$~"||n==="$!"||n==="&")l++;else if(n==="html")Ns(e.ownerDocument.documentElement);else if(n==="head"){n=e.ownerDocument.head,Ns(n);for(var o=n.firstChild;o;){var i=o.nextSibling,r=o.nodeName;o[Ll]||r==="SCRIPT"||r==="STYLE"||r==="LINK"&&o.rel.toLowerCase()==="stylesheet"||n.removeChild(o),o=i}}else n==="body"&&Ns(e.ownerDocument.body);n=a}while(n);Ao(t)}function X_(e,t){var n=e;e=0;do{var l=n.nextSibling;if(n.nodeType===1?t?(n._stashedDisplay=n.style.display,n.style.display="none"):(n.style.display=n._stashedDisplay||"",n.getAttribute("style")===""&&n.removeAttribute("style")):n.nodeType===3&&(t?(n._stashedText=n.nodeValue,n.nodeValue=""):n.nodeValue=n._stashedText||""),l&&l.nodeType===8)if(n=l.data,n==="/$"){if(e===0)break;e--}else n!=="$"&&n!=="$?"&&n!=="$~"&&n!=="$!"||e++;n=l}while(n)}function Pc(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var n=t;switch(t=t.nextSibling,n.nodeName){case"HTML":case"HEAD":case"BODY":Pc(n),ha(n);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(n.rel.toLowerCase()==="stylesheet")continue}e.removeChild(n)}}function nh(e,t,n,l){for(;e.nodeType===1;){var a=n;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!l&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(l){if(!e[Ll])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(o=e.getAttribute("rel"),o==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(o!==a.rel||e.getAttribute("href")!==(a.href==null||a.href===""?null:a.href)||e.getAttribute("crossorigin")!==(a.crossOrigin==null?null:a.crossOrigin)||e.getAttribute("title")!==(a.title==null?null:a.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(o=e.getAttribute("src"),(o!==(a.src==null?null:a.src)||e.getAttribute("type")!==(a.type==null?null:a.type)||e.getAttribute("crossorigin")!==(a.crossOrigin==null?null:a.crossOrigin))&&o&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var o=a.name==null?null:""+a.name;if(a.type==="hidden"&&e.getAttribute("name")===o)return e}else return e;if(e=On(e.nextSibling),e===null)break}return null}function lh(e,t,n){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!n||(e=On(e.nextSibling),e===null))return null;return e}function Q_(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=On(e.nextSibling),e===null))return null;return e}function er(e){return e.data==="$?"||e.data==="$~"}function tr(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function ah(e,t){var n=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||n.readyState!=="loading")t();else{var l=function(){t(),n.removeEventListener("DOMContentLoaded",l)};n.addEventListener("DOMContentLoaded",l),e._reactRetry=l}}function On(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var nr=null;function G_(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="/$"||n==="/&"){if(t===0)return On(e.nextSibling);t--}else n!=="$"&&n!=="$!"&&n!=="$?"&&n!=="$~"&&n!=="&"||t++}e=e.nextSibling}return null}function $_(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="$"||n==="$!"||n==="$?"||n==="$~"||n==="&"){if(t===0)return e;t--}else n!=="/$"&&n!=="/&"||t++}e=e.previousSibling}return null}function q_(e,t,n){switch(t=Ui(n),e){case"html":if(e=t.documentElement,!e)throw Error(c(452));return e;case"head":if(e=t.head,!e)throw Error(c(453));return e;case"body":if(e=t.body,!e)throw Error(c(454));return e;default:throw Error(c(451))}}function Ns(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);ha(e)}var Ln=new Map,Z_=new Set;function Xi(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var zl=U.d;U.d={f:oh,r:sh,D:ih,C:uh,L:ch,m:rh,X:fh,S:dh,M:_h};function oh(){var e=zl.f(),t=Mi();return e||t}function sh(e){var t=un(e);t!==null&&t.tag===5&&t.type==="form"?cf(t):zl.r(e)}var To=typeof document>"u"?null:document;function V_(e,t,n){var l=To;if(l&&typeof t=="string"&&t){var a=Wt(t);a='link[rel="'+e+'"][href="'+a+'"]',typeof n=="string"&&(a+='[crossorigin="'+n+'"]'),Z_.has(a)||(Z_.add(a),e={rel:e,crossOrigin:n,href:t},l.querySelector(a)===null&&(t=l.createElement("link"),Xt(t,"link",e),mt(t),l.head.appendChild(t)))}}function ih(e){zl.D(e),V_("dns-prefetch",e,null)}function uh(e,t){zl.C(e,t),V_("preconnect",e,t)}function ch(e,t,n){zl.L(e,t,n);var l=To;if(l&&e&&t){var a='link[rel="preload"][as="'+Wt(t)+'"]';t==="image"&&n&&n.imageSrcSet?(a+='[imagesrcset="'+Wt(n.imageSrcSet)+'"]',typeof n.imageSizes=="string"&&(a+='[imagesizes="'+Wt(n.imageSizes)+'"]')):a+='[href="'+Wt(e)+'"]';var o=a;switch(t){case"style":o=ko(e);break;case"script":o=zo(e)}Ln.has(o)||(e=Z({rel:"preload",href:t==="image"&&n&&n.imageSrcSet?void 0:e,as:t},n),Ln.set(o,e),l.querySelector(a)!==null||t==="style"&&l.querySelector(Es(o))||t==="script"&&l.querySelector(Ts(o))||(t=l.createElement("link"),Xt(t,"link",e),mt(t),l.head.appendChild(t)))}}function rh(e,t){zl.m(e,t);var n=To;if(n&&e){var l=t&&typeof t.as=="string"?t.as:"script",a='link[rel="modulepreload"][as="'+Wt(l)+'"][href="'+Wt(e)+'"]',o=a;switch(l){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":o=zo(e)}if(!Ln.has(o)&&(e=Z({rel:"modulepreload",href:e},t),Ln.set(o,e),n.querySelector(a)===null)){switch(l){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(n.querySelector(Ts(o)))return}l=n.createElement("link"),Xt(l,"link",e),mt(l),n.head.appendChild(l)}}}function dh(e,t,n){zl.S(e,t,n);var l=To;if(l&&e){var a=vt(l).hoistableStyles,o=ko(e);t=t||"default";var i=a.get(o);if(!i){var r={loading:0,preload:null};if(i=l.querySelector(Es(o)))r.loading=5;else{e=Z({rel:"stylesheet",href:e,"data-precedence":t},n),(n=Ln.get(o))&&lr(e,n);var g=i=l.createElement("link");mt(g),Xt(g,"link",e),g._p=new Promise(function(C,L){g.onload=C,g.onerror=L}),g.addEventListener("load",function(){r.loading|=1}),g.addEventListener("error",function(){r.loading|=2}),r.loading|=4,Qi(i,t,l)}i={type:"stylesheet",instance:i,count:1,state:r},a.set(o,i)}}}function fh(e,t){zl.X(e,t);var n=To;if(n&&e){var l=vt(n).hoistableScripts,a=zo(e),o=l.get(a);o||(o=n.querySelector(Ts(a)),o||(e=Z({src:e,async:!0},t),(t=Ln.get(a))&&ar(e,t),o=n.createElement("script"),mt(o),Xt(o,"link",e),n.head.appendChild(o)),o={type:"script",instance:o,count:1,state:null},l.set(a,o))}}function _h(e,t){zl.M(e,t);var n=To;if(n&&e){var l=vt(n).hoistableScripts,a=zo(e),o=l.get(a);o||(o=n.querySelector(Ts(a)),o||(e=Z({src:e,async:!0,type:"module"},t),(t=Ln.get(a))&&ar(e,t),o=n.createElement("script"),mt(o),Xt(o,"link",e),n.head.appendChild(o)),o={type:"script",instance:o,count:1,state:null},l.set(a,o))}}function J_(e,t,n,l){var a=(a=ge.current)?Xi(a):null;if(!a)throw Error(c(446));switch(e){case"meta":case"title":return null;case"style":return typeof n.precedence=="string"&&typeof n.href=="string"?(t=ko(n.href),n=vt(a).hoistableStyles,l=n.get(t),l||(l={type:"style",instance:null,count:0,state:null},n.set(t,l)),l):{type:"void",instance:null,count:0,state:null};case"link":if(n.rel==="stylesheet"&&typeof n.href=="string"&&typeof n.precedence=="string"){e=ko(n.href);var o=vt(a).hoistableStyles,i=o.get(e);if(i||(a=a.ownerDocument||a,i={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},o.set(e,i),(o=a.querySelector(Es(e)))&&!o._p&&(i.instance=o,i.state.loading=5),Ln.has(e)||(n={rel:"preload",as:"style",href:n.href,crossOrigin:n.crossOrigin,integrity:n.integrity,media:n.media,hrefLang:n.hrefLang,referrerPolicy:n.referrerPolicy},Ln.set(e,n),o||mh(a,e,n,i.state))),t&&l===null)throw Error(c(528,""));return i}if(t&&l!==null)throw Error(c(529,""));return null;case"script":return t=n.async,n=n.src,typeof n=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=zo(n),n=vt(a).hoistableScripts,l=n.get(t),l||(l={type:"script",instance:null,count:0,state:null},n.set(t,l)),l):{type:"void",instance:null,count:0,state:null};default:throw Error(c(444,e))}}function ko(e){return'href="'+Wt(e)+'"'}function Es(e){return'link[rel="stylesheet"]['+e+"]"}function K_(e){return Z({},e,{"data-precedence":e.precedence,precedence:null})}function mh(e,t,n,l){e.querySelector('link[rel="preload"][as="style"]['+t+"]")?l.loading=1:(t=e.createElement("link"),l.preload=t,t.addEventListener("load",function(){return l.loading|=1}),t.addEventListener("error",function(){return l.loading|=2}),Xt(t,"link",n),mt(t),e.head.appendChild(t))}function zo(e){return'[src="'+Wt(e)+'"]'}function Ts(e){return"script[async]"+e}function W_(e,t,n){if(t.count++,t.instance===null)switch(t.type){case"style":var l=e.querySelector('style[data-href~="'+Wt(n.href)+'"]');if(l)return t.instance=l,mt(l),l;var a=Z({},n,{"data-href":n.href,"data-precedence":n.precedence,href:null,precedence:null});return l=(e.ownerDocument||e).createElement("style"),mt(l),Xt(l,"style",a),Qi(l,n.precedence,e),t.instance=l;case"stylesheet":a=ko(n.href);var o=e.querySelector(Es(a));if(o)return t.state.loading|=4,t.instance=o,mt(o),o;l=K_(n),(a=Ln.get(a))&&lr(l,a),o=(e.ownerDocument||e).createElement("link"),mt(o);var i=o;return i._p=new Promise(function(r,g){i.onload=r,i.onerror=g}),Xt(o,"link",l),t.state.loading|=4,Qi(o,n.precedence,e),t.instance=o;case"script":return o=zo(n.src),(a=e.querySelector(Ts(o)))?(t.instance=a,mt(a),a):(l=n,(a=Ln.get(o))&&(l=Z({},n),ar(l,a)),e=e.ownerDocument||e,a=e.createElement("script"),mt(a),Xt(a,"link",l),e.head.appendChild(a),t.instance=a);case"void":return null;default:throw Error(c(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(l=t.instance,t.state.loading|=4,Qi(l,n.precedence,e));return t.instance}function Qi(e,t,n){for(var l=n.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'),a=l.length?l[l.length-1]:null,o=a,i=0;i<l.length;i++){var r=l[i];if(r.dataset.precedence===t)o=r;else if(o!==a)break}o?o.parentNode.insertBefore(e,o.nextSibling):(t=n.nodeType===9?n.head:n,t.insertBefore(e,t.firstChild))}function lr(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function ar(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var Gi=null;function I_(e,t,n){if(Gi===null){var l=new Map,a=Gi=new Map;a.set(n,l)}else a=Gi,l=a.get(n),l||(l=new Map,a.set(n,l));if(l.has(e))return l;for(l.set(e,null),n=n.getElementsByTagName(e),a=0;a<n.length;a++){var o=n[a];if(!(o[Ll]||o[zt]||e==="link"&&o.getAttribute("rel")==="stylesheet")&&o.namespaceURI!=="http://www.w3.org/2000/svg"){var i=o.getAttribute(t)||"";i=e+i;var r=l.get(i);r?r.push(o):l.set(i,[o])}}return l}function F_(e,t,n){e=e.ownerDocument||e,e.head.insertBefore(n,t==="title"?e.querySelector("head > title"):null)}function hh(e,t,n){if(n===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;return t.rel==="stylesheet"?(e=t.disabled,typeof t.precedence=="string"&&e==null):!0;case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function P_(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function gh(e,t,n,l){if(n.type==="stylesheet"&&(typeof l.media!="string"||matchMedia(l.media).matches!==!1)&&(n.state.loading&4)===0){if(n.instance===null){var a=ko(l.href),o=t.querySelector(Es(a));if(o){t=o._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=$i.bind(e),t.then(e,e)),n.state.loading|=4,n.instance=o,mt(o);return}o=t.ownerDocument||t,l=K_(l),(a=Ln.get(a))&&lr(l,a),o=o.createElement("link"),mt(o);var i=o;i._p=new Promise(function(r,g){i.onload=r,i.onerror=g}),Xt(o,"link",l),n.instance=o}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(n,t),(t=n.state.preload)&&(n.state.loading&3)===0&&(e.count++,n=$i.bind(e),t.addEventListener("load",n),t.addEventListener("error",n))}}var or=0;function ph(e,t){return e.stylesheets&&e.count===0&&Zi(e,e.stylesheets),0<e.count||0<e.imgCount?function(n){var l=setTimeout(function(){if(e.stylesheets&&Zi(e,e.stylesheets),e.unsuspend){var o=e.unsuspend;e.unsuspend=null,o()}},6e4+t);0<e.imgBytes&&or===0&&(or=62500*I0());var a=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&Zi(e,e.stylesheets),e.unsuspend)){var o=e.unsuspend;e.unsuspend=null,o()}},(e.imgBytes>or?50:800)+t);return e.unsuspend=n,function(){e.unsuspend=null,clearTimeout(l),clearTimeout(a)}}:null}function $i(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)Zi(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var qi=null;function Zi(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,qi=new Map,t.forEach(yh,e),qi=null,$i.call(e))}function yh(e,t){if(!(t.state.loading&4)){var n=qi.get(e);if(n)var l=n.get(null);else{n=new Map,qi.set(e,n);for(var a=e.querySelectorAll("link[data-precedence],style[data-precedence]"),o=0;o<a.length;o++){var i=a[o];(i.nodeName==="LINK"||i.getAttribute("media")!=="not all")&&(n.set(i.dataset.precedence,i),l=i)}l&&n.set(null,l)}a=t.instance,i=a.getAttribute("data-precedence"),o=n.get(i)||l,o===l&&n.set(null,a),n.set(i,a),this.count++,l=$i.bind(this),a.addEventListener("load",l),a.addEventListener("error",l),o?o.parentNode.insertBefore(a,o.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(a,e.firstChild)),t.state.loading|=4}}var ks={$$typeof:ct,Provider:null,Consumer:null,_currentValue:J,_currentValue2:J,_threadCount:0};function bh(e,t,n,l,a,o,i,r,g){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=ul(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=ul(0),this.hiddenUpdates=ul(null),this.identifierPrefix=l,this.onUncaughtError=a,this.onCaughtError=o,this.onRecoverableError=i,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=g,this.incompleteTransitions=new Map}function em(e,t,n,l,a,o,i,r,g,C,L,R){return e=new bh(e,t,n,i,g,C,L,R,r),t=1,o===!0&&(t|=24),o=dn(3,null,null,t),e.current=o,o.stateNode=e,t=Yu(),t.refCount++,e.pooledCache=t,t.refCount++,o.memoizedState={element:l,isDehydrated:n,cache:t},Qu(o),e}function tm(e){return e?(e=so,e):so}function nm(e,t,n,l,a,o){a=tm(a),l.context===null?l.context=a:l.pendingContext=a,l=ql(t),l.payload={element:n},o=o===void 0?null:o,o!==null&&(l.callback=o),n=Zl(e,l,t),n!==null&&(an(n,e,t),is(n,e,t))}function lm(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function sr(e,t){lm(e,t),(e=e.alternate)&&lm(e,t)}function am(e){if(e.tag===13||e.tag===31){var t=ja(e,67108864);t!==null&&an(t,e,67108864),sr(e,67108864)}}function om(e){if(e.tag===13||e.tag===31){var t=gn();t=ma(t);var n=ja(e,t);n!==null&&an(n,e,t),sr(e,t)}}var Vi=!0;function xh(e,t,n,l){var a=z.T;z.T=null;var o=U.p;try{U.p=2,ir(e,t,n,l)}finally{U.p=o,z.T=a}}function vh(e,t,n,l){var a=z.T;z.T=null;var o=U.p;try{U.p=8,ir(e,t,n,l)}finally{U.p=o,z.T=a}}function ir(e,t,n,l){if(Vi){var a=ur(l);if(a===null)Vc(e,t,l,Ji,n),im(e,l);else if(wh(a,e,t,n,l))l.stopPropagation();else if(im(e,l),t&4&&-1<Sh.indexOf(e)){for(;a!==null;){var o=un(a);if(o!==null)switch(o.tag){case 3:if(o=o.stateNode,o.current.memoizedState.isDehydrated){var i=Ve(o.pendingLanes);if(i!==0){var r=o;for(r.pendingLanes|=2,r.entangledLanes|=2;i;){var g=1<<31-ot(i);r.entanglements[1]|=g,i&=~g}ll(o),(He&6)===0&&(zi=ie()+500,ws(0))}}break;case 31:case 13:r=ja(o,2),r!==null&&an(r,o,2),Mi(),sr(o,2)}if(o=ur(l),o===null&&Vc(e,t,l,Ji,n),o===a)break;a=o}a!==null&&l.stopPropagation()}else Vc(e,t,l,null,n)}}function ur(e){return e=Ye(e),cr(e)}var Ji=null;function cr(e){if(Ji=null,e=xn(e),e!==null){var t=v(e);if(t===null)e=null;else{var n=t.tag;if(n===13){if(e=E(t),e!==null)return e;e=null}else if(n===31){if(e=V(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Ji=e,null}function sm(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(Ml()){case qa:return 2;case bn:return 8;case ra:case sl:return 32;case qn:return 268435456;default:return 32}default:return 32}}var rr=!1,la=null,aa=null,oa=null,zs=new Map,As=new Map,sa=[],Sh="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function im(e,t){switch(e){case"focusin":case"focusout":la=null;break;case"dragenter":case"dragleave":aa=null;break;case"mouseover":case"mouseout":oa=null;break;case"pointerover":case"pointerout":zs.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":As.delete(t.pointerId)}}function Ms(e,t,n,l,a,o){return e===null||e.nativeEvent!==o?(e={blockedOn:t,domEventName:n,eventSystemFlags:l,nativeEvent:o,targetContainers:[a]},t!==null&&(t=un(t),t!==null&&am(t)),e):(e.eventSystemFlags|=l,t=e.targetContainers,a!==null&&t.indexOf(a)===-1&&t.push(a),e)}function wh(e,t,n,l,a){switch(t){case"focusin":return la=Ms(la,e,t,n,l,a),!0;case"dragenter":return aa=Ms(aa,e,t,n,l,a),!0;case"mouseover":return oa=Ms(oa,e,t,n,l,a),!0;case"pointerover":var o=a.pointerId;return zs.set(o,Ms(zs.get(o)||null,e,t,n,l,a)),!0;case"gotpointercapture":return o=a.pointerId,As.set(o,Ms(As.get(o)||null,e,t,n,l,a)),!0}return!1}function um(e){var t=xn(e.target);if(t!==null){var n=v(t);if(n!==null){if(t=n.tag,t===13){if(t=E(n),t!==null){e.blockedOn=t,sn(e.priority,function(){om(n)});return}}else if(t===31){if(t=V(n),t!==null){e.blockedOn=t,sn(e.priority,function(){om(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function Ki(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=ur(e.nativeEvent);if(n===null){n=e.nativeEvent;var l=new n.constructor(n.type,n);dl=l,n.target.dispatchEvent(l),dl=null}else return t=un(n),t!==null&&am(t),e.blockedOn=n,!1;t.shift()}return!0}function cm(e,t,n){Ki(e)&&n.delete(t)}function Ch(){rr=!1,la!==null&&Ki(la)&&(la=null),aa!==null&&Ki(aa)&&(aa=null),oa!==null&&Ki(oa)&&(oa=null),zs.forEach(cm),As.forEach(cm)}function Wi(e,t){e.blockedOn===t&&(e.blockedOn=null,rr||(rr=!0,u.unstable_scheduleCallback(u.unstable_NormalPriority,Ch)))}var Ii=null;function rm(e){Ii!==e&&(Ii=e,u.unstable_scheduleCallback(u.unstable_NormalPriority,function(){Ii===e&&(Ii=null);for(var t=0;t<e.length;t+=3){var n=e[t],l=e[t+1],a=e[t+2];if(typeof l!="function"){if(cr(l||n)===null)continue;break}var o=un(n);o!==null&&(e.splice(t,3),t-=3,uc(o,{pending:!0,data:a,method:n.method,action:l},l,a))}}))}function Ao(e){function t(g){return Wi(g,e)}la!==null&&Wi(la,e),aa!==null&&Wi(aa,e),oa!==null&&Wi(oa,e),zs.forEach(t),As.forEach(t);for(var n=0;n<sa.length;n++){var l=sa[n];l.blockedOn===e&&(l.blockedOn=null)}for(;0<sa.length&&(n=sa[0],n.blockedOn===null);)um(n),n.blockedOn===null&&sa.shift();if(n=(e.ownerDocument||e).$$reactFormReplay,n!=null)for(l=0;l<n.length;l+=3){var a=n[l],o=n[l+1],i=a[At]||null;if(typeof o=="function")i||rm(n);else if(i){var r=null;if(o&&o.hasAttribute("formAction")){if(a=o,i=o[At]||null)r=i.formAction;else if(cr(a)!==null)continue}else r=i.action;typeof r=="function"?n[l+1]=r:(n.splice(l,3),l-=3),rm(n)}}}function dm(){function e(o){o.canIntercept&&o.info==="react-transition"&&o.intercept({handler:function(){return new Promise(function(i){return a=i})},focusReset:"manual",scroll:"manual"})}function t(){a!==null&&(a(),a=null),l||setTimeout(n,20)}function n(){if(!l&&!navigation.transition){var o=navigation.currentEntry;o&&o.url!=null&&navigation.navigate(o.url,{state:o.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var l=!1,a=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(n,100),function(){l=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),a!==null&&(a(),a=null)}}}function dr(e){this._internalRoot=e}Fi.prototype.render=dr.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(c(409));var n=t.current,l=gn();nm(n,l,e,t,null,null)},Fi.prototype.unmount=dr.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;nm(e.current,2,null,e,null,null),Mi(),t[G]=null}};function Fi(e){this._internalRoot=e}Fi.prototype.unstable_scheduleHydration=function(e){if(e){var t=rl();e={blockedOn:null,target:e,priority:t};for(var n=0;n<sa.length&&t!==0&&t<sa[n].priority;n++);sa.splice(n,0,e),n===0&&um(e)}};var fm=d.version;if(fm!=="19.2.4")throw Error(c(527,fm,"19.2.4"));U.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(c(188)):(e=Object.keys(e).join(","),Error(c(268,e)));return e=A(t),e=e!==null?K(e):null,e=e===null?null:e.stateNode,e};var jh={bundleType:0,version:"19.2.4",rendererPackageName:"react-dom",currentDispatcherRef:z,reconcilerVersion:"19.2.4"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var Pi=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Pi.isDisabled&&Pi.supportsFiber)try{Ol=Pi.inject(jh),Oe=Pi}catch{}}return Ls.createRoot=function(e,t){if(!b(e))throw Error(c(299));var n=!1,l="",a=bf,o=xf,i=vf;return t!=null&&(t.unstable_strictMode===!0&&(n=!0),t.identifierPrefix!==void 0&&(l=t.identifierPrefix),t.onUncaughtError!==void 0&&(a=t.onUncaughtError),t.onCaughtError!==void 0&&(o=t.onCaughtError),t.onRecoverableError!==void 0&&(i=t.onRecoverableError)),t=em(e,1,!1,null,null,n,l,null,a,o,i,dm),e[G]=t.current,Zc(e),new dr(t)},Ls.hydrateRoot=function(e,t,n){if(!b(e))throw Error(c(299));var l=!1,a="",o=bf,i=xf,r=vf,g=null;return n!=null&&(n.unstable_strictMode===!0&&(l=!0),n.identifierPrefix!==void 0&&(a=n.identifierPrefix),n.onUncaughtError!==void 0&&(o=n.onUncaughtError),n.onCaughtError!==void 0&&(i=n.onCaughtError),n.onRecoverableError!==void 0&&(r=n.onRecoverableError),n.formState!==void 0&&(g=n.formState)),t=em(e,1,!0,t,n??null,l,a,g,o,i,r,dm),t.context=tm(null),n=t.current,l=gn(),l=ma(l),a=ql(l),a.callback=null,Zl(n,a,l),n=l,t.current.lanes=n,cl(t,n),ll(t),e[G]=t.current,Zc(e),new Fi(t)},Ls.version="19.2.4",Ls}var Sm;function Dh(){if(Sm)return mr.exports;Sm=1;function u(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(u)}catch(d){console.error(d)}}return u(),mr.exports=Bh(),mr.exports}var Rh=Dh(),kr=Um();const Yh=`svg[fill=none] {
  fill: none !important;
}

@keyframes styles-module__popupEnter___AuQDN {
  from {
    opacity: 0;
    transform: translateX(-50%) scale(0.95) translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) scale(1) translateY(0);
  }
}
@keyframes styles-module__popupExit___JJKQX {
  from {
    opacity: 1;
    transform: translateX(-50%) scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) scale(0.95) translateY(4px);
  }
}
@keyframes styles-module__shake___jdbWe {
  0%, 100% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(0);
  }
  20% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(-3px);
  }
  40% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(3px);
  }
  60% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(-2px);
  }
  80% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(2px);
  }
}
.styles-module__popup___IhzrD {
  position: fixed;
  transform: translateX(-50%);
  width: 280px;
  padding: 0.75rem 1rem 14px;
  background: #1a1a1a;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08);
  cursor: default;
  z-index: 100001;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  will-change: transform, opacity;
  opacity: 0;
}
.styles-module__popup___IhzrD.styles-module__enter___L7U7N {
  animation: styles-module__popupEnter___AuQDN 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.styles-module__popup___IhzrD.styles-module__entered___COX-w {
  opacity: 1;
  transform: translateX(-50%) scale(1) translateY(0);
}
.styles-module__popup___IhzrD.styles-module__exit___5eGjE {
  animation: styles-module__popupExit___JJKQX 0.15s ease-in forwards;
}
.styles-module__popup___IhzrD.styles-module__entered___COX-w.styles-module__shake___jdbWe {
  animation: styles-module__shake___jdbWe 0.25s ease-out;
}

.styles-module__header___wWsSi {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5625rem;
}

.styles-module__element___fTV2z {
  font-size: 0.78rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.styles-module__headerToggle___WpW0b {
  display: flex;
  align-items: center;
  gap: 0.22rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  flex: 1;
  min-width: 0;
  text-align: left;
}
.styles-module__headerToggle___WpW0b .styles-module__element___fTV2z {
  flex: 1;
}

.styles-module__chevron___ZZJlR {
  color: rgba(255, 255, 255, 0.5);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}
.styles-module__chevron___ZZJlR.styles-module__expanded___2Hxgv {
  transform: rotate(90deg);
}

.styles-module__stylesWrapper___pnHgy {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.styles-module__stylesWrapper___pnHgy.styles-module__expanded___2Hxgv {
  grid-template-rows: 1fr;
}

.styles-module__stylesInner___YYZe2 {
  overflow: hidden;
}

.styles-module__stylesBlock___VfQKn {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.4rem;
  padding: 0.5rem 0.625rem;
  margin-bottom: 0.5rem;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.7rem;
  line-height: 1.5;
}

.styles-module__styleLine___1YQiD {
  color: rgba(255, 255, 255, 0.85);
  word-break: break-word;
}

.styles-module__styleProperty___84L1i {
  color: #c792ea;
}

.styles-module__styleValue___q51-h {
  color: rgba(255, 255, 255, 0.85);
}

.styles-module__timestamp___Dtpsv {
  font-size: 0.65rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
  margin-left: 0.48rem;
  flex-shrink: 0;
}

.styles-module__quote___mcMmQ {
  font-size: 11.5px;
  font-style: italic;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 0.5rem;
  padding: 0.4rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.25rem;
  line-height: 1.45;
}

.styles-module__textarea___jrSae {
  width: 100%;
  padding: 0.5rem 0.625rem;
  font-size: 0.8rem;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  resize: none;
  outline: none;
  transition: border-color 0.15s ease;
}
.styles-module__textarea___jrSae:focus {
  border-color: #3c82f7;
}
.styles-module__textarea___jrSae.styles-module__green___99l3h:focus {
  border-color: #34c759;
}
.styles-module__textarea___jrSae::placeholder {
  color: rgba(255, 255, 255, 0.35);
}
.styles-module__textarea___jrSae::-webkit-scrollbar {
  width: 6px;
}
.styles-module__textarea___jrSae::-webkit-scrollbar-track {
  background: transparent;
}
.styles-module__textarea___jrSae::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.styles-module__actions___D6x3f {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.styles-module__cancel___hRjnL,
.styles-module__submit___K-mIR {
  padding: 0.4rem 0.875rem;
  font-size: 0.78rem;
  font-weight: 500;
  border-radius: 0.9rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.styles-module__cancel___hRjnL {
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
}
.styles-module__cancel___hRjnL:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.styles-module__submit___K-mIR {
  color: white;
}
.styles-module__submit___K-mIR:hover:not(:disabled) {
  filter: brightness(0.9);
}
.styles-module__submit___K-mIR:disabled {
  cursor: not-allowed;
}

.styles-module__deleteWrapper___oSjdo {
  margin-right: auto;
}

.styles-module__deleteButton___4VuAE {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}
.styles-module__deleteButton___4VuAE:hover {
  background: rgba(255, 59, 48, 0.25);
  color: #ff3b30;
}
.styles-module__deleteButton___4VuAE:active {
  transform: scale(0.92);
}

.styles-module__light___6AaSQ.styles-module__popup___IhzrD {
  background: #fff;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.styles-module__light___6AaSQ .styles-module__element___fTV2z {
  color: rgba(0, 0, 0, 0.6);
}
.styles-module__light___6AaSQ .styles-module__timestamp___Dtpsv {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___6AaSQ .styles-module__chevron___ZZJlR {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___6AaSQ .styles-module__stylesBlock___VfQKn {
  background: rgba(0, 0, 0, 0.03);
}
.styles-module__light___6AaSQ .styles-module__styleLine___1YQiD {
  color: rgba(0, 0, 0, 0.75);
}
.styles-module__light___6AaSQ .styles-module__styleProperty___84L1i {
  color: #7c3aed;
}
.styles-module__light___6AaSQ .styles-module__styleValue___q51-h {
  color: rgba(0, 0, 0, 0.75);
}
.styles-module__light___6AaSQ .styles-module__quote___mcMmQ {
  color: rgba(0, 0, 0, 0.55);
  background: rgba(0, 0, 0, 0.04);
}
.styles-module__light___6AaSQ .styles-module__textarea___jrSae {
  background: rgba(0, 0, 0, 0.03);
  color: #1a1a1a;
  border-color: rgba(0, 0, 0, 0.12);
}
.styles-module__light___6AaSQ .styles-module__textarea___jrSae::placeholder {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___6AaSQ .styles-module__textarea___jrSae::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
}
.styles-module__light___6AaSQ .styles-module__cancel___hRjnL {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___6AaSQ .styles-module__cancel___hRjnL:hover {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.75);
}
.styles-module__light___6AaSQ .styles-module__deleteButton___4VuAE {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___6AaSQ .styles-module__deleteButton___4VuAE:hover {
  background: rgba(255, 59, 48, 0.15);
  color: #ff3b30;
}

.styles-module__popup___IhzrD.styles-module__glassDark___cwGD {
  background: rgba(10, 10, 14, 0.35) !important;
  backdrop-filter: blur(60px) saturate(1.8) brightness(0.9);
  -webkit-backdrop-filter: blur(60px) saturate(1.8) brightness(0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.07);
}
.styles-module__popup___IhzrD.styles-module__glassLight___cwGL {
  background: rgba(255, 255, 255, 0.35) !important;
  backdrop-filter: blur(60px) saturate(1.5);
  -webkit-backdrop-filter: blur(60px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255,255,255,0.85);
}
.styles-module__popup___IhzrD.styles-module__glassLight___cwGL .styles-module__element___fTV2z {
  color: rgba(0, 0, 0, 0.55);
}
.styles-module__popup___IhzrD.styles-module__glassLight___cwGL .styles-module__textarea___jrSae {
  background: rgba(0, 0, 0, 0.04);
  color: #1a1a1a;
  border-color: rgba(0, 0, 0, 0.12);
}
.styles-module__popup___IhzrD.styles-module__glassLight___cwGL .styles-module__textarea___jrSae::placeholder {
  color: rgba(0, 0, 0, 0.35);
}
.styles-module__popup___IhzrD.styles-module__glassLight___cwGL .styles-module__cancel___hRjnL {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__popup___IhzrD.styles-module__glassLight___cwGL .styles-module__cancel___hRjnL:hover {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.75);
}
.styles-module__popup___IhzrD.styles-module__glassLight___cwGL .styles-module__quote___mcMmQ {
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__popup___IhzrD.styles-module__glassLight___cwGL .styles-module__deleteButton___4VuAE {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__popup___IhzrD.styles-module__glassDark___cwGD .styles-module__textarea___jrSae {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}`,qe={popup:"styles-module__popup___IhzrD",enter:"styles-module__enter___L7U7N",entered:"styles-module__entered___COX-w",exit:"styles-module__exit___5eGjE",shake:"styles-module__shake___jdbWe",header:"styles-module__header___wWsSi",element:"styles-module__element___fTV2z",headerToggle:"styles-module__headerToggle___WpW0b",chevron:"styles-module__chevron___ZZJlR",expanded:"styles-module__expanded___2Hxgv",stylesWrapper:"styles-module__stylesWrapper___pnHgy",stylesInner:"styles-module__stylesInner___YYZe2",stylesBlock:"styles-module__stylesBlock___VfQKn",styleLine:"styles-module__styleLine___1YQiD",styleProperty:"styles-module__styleProperty___84L1i",styleValue:"styles-module__styleValue___q51-h",timestamp:"styles-module__timestamp___Dtpsv",quote:"styles-module__quote___mcMmQ",textarea:"styles-module__textarea___jrSae",actions:"styles-module__actions___D6x3f",cancel:"styles-module__cancel___hRjnL",submit:"styles-module__submit___K-mIR",deleteWrapper:"styles-module__deleteWrapper___oSjdo",deleteButton:"styles-module__deleteButton___4VuAE",light:"styles-module__light___6AaSQ",glassDark:"styles-module__glassDark___cwGD",glassLight:"styles-module__glassLight___cwGL"};if(typeof document<"u"){let u=document.getElementById("cluso-styles-popup");u||(u=document.createElement("style"),u.id="cluso-styles-popup",u.textContent=Yh,document.head.appendChild(u))}const Hh=({size:u=16})=>s.jsx("svg",{width:u,height:u,viewBox:"0 0 16 16",fill:"none",children:s.jsx("path",{d:"M4 4l8 8M12 4l-8 8",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})}),Uh=({size:u=16})=>s.jsx("svg",{width:u,height:u,viewBox:"0 0 16 16",fill:"none",children:s.jsx("path",{d:"M8 3v10M3 8h10",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})}),eu=({size:u=20})=>s.jsxs("svg",{width:u,height:u,viewBox:"0 0 20 20",fill:"none",children:[s.jsx("circle",{cx:"10",cy:"10.5",r:"5.25",stroke:"currentColor",strokeWidth:"1.25"}),s.jsx("path",{d:"M8.5 8.75C8.5 7.92 9.17 7.25 10 7.25C10.83 7.25 11.5 7.92 11.5 8.75C11.5 9.58 10.83 10.25 10 10.25V11",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("circle",{cx:"10",cy:"13",r:"0.75",fill:"currentColor"})]}),Xh=({size:u=24,copied:d=!1})=>s.jsxs("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",children:[s.jsx("style",{children:`
      .copy-icon, .check-icon {
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
    `}),s.jsxs("g",{className:"copy-icon",style:{opacity:d?0:1,transform:d?"scale(0.8)":"scale(1)",transformOrigin:"center"},children:[s.jsx("path",{d:"M4.75 11.25C4.75 10.4216 5.42157 9.75 6.25 9.75H12.75C13.5784 9.75 14.25 10.4216 14.25 11.25V17.75C14.25 18.5784 13.5784 19.25 12.75 19.25H6.25C5.42157 19.25 4.75 18.5784 4.75 17.75V11.25Z",stroke:"currentColor",strokeWidth:"1.5"}),s.jsx("path",{d:"M17.25 14.25H17.75C18.5784 14.25 19.25 13.5784 19.25 12.75V6.25C19.25 5.42157 18.5784 4.75 17.75 4.75H11.25C10.4216 4.75 9.75 5.42157 9.75 6.25V6.75",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]}),s.jsxs("g",{className:"check-icon",style:{opacity:d?1:0,transform:d?"scale(1)":"scale(0.8)",transformOrigin:"center"},children:[s.jsx("path",{d:"M12 20C7.58172 20 4 16.4182 4 12C4 7.58172 7.58172 4 12 4C16.4182 4 20 7.58172 20 12C20 16.4182 16.4182 20 12 20Z",stroke:"#22c55e",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M15 10L11 14.25L9.25 12.25",stroke:"#22c55e",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]})]}),Qh=({size:u=24,state:d="idle"})=>{const _=d==="idle",c=d==="sent",b=d==="failed",v=d==="sending";return s.jsxs("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",children:[s.jsx("style",{children:`
        .send-arrow-icon, .send-check-icon, .send-error-icon {
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
      `}),s.jsx("g",{className:"send-arrow-icon",style:{opacity:_?1:v?.5:0,transform:_?"scale(1)":"scale(0.8)",transformOrigin:"center"},children:s.jsx("path",{d:"M12 14.5V5.75M12 5.75L8.75 9M12 5.75L15.25 9M6 14.75V15.5C6 16.8807 7.11929 18 8.5 18H15.5C16.8807 18 18 16.8807 18 15.5V14.75M7.75 14.75H16.25",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})}),s.jsxs("g",{className:"send-check-icon",style:{opacity:c?1:0,transform:c?"scale(1)":"scale(0.8)",transformOrigin:"center"},children:[s.jsx("path",{d:"M12 20C7.58172 20 4 16.4182 4 12C4 7.58172 7.58172 4 12 4C16.4182 4 20 7.58172 20 12C20 16.4182 16.4182 20 12 20Z",stroke:"#22c55e",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M15 10L11 14.25L9.25 12.25",stroke:"#22c55e",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]}),s.jsxs("g",{className:"send-error-icon",style:{opacity:b?1:0,transform:b?"scale(1)":"scale(0.8)",transformOrigin:"center"},children:[s.jsx("path",{d:"M12 20C7.58172 20 4 16.4182 4 12C4 7.58172 7.58172 4 12 4C16.4182 4 20 7.58172 20 12C20 16.4182 16.4182 20 12 20Z",stroke:"#ef4444",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M12 8V12",stroke:"#ef4444",strokeWidth:"1.5",strokeLinecap:"round"}),s.jsx("circle",{cx:"12",cy:"15",r:"0.5",fill:"#ef4444",stroke:"#ef4444",strokeWidth:"1"})]})]})},Gh=({size:u=24,isOpen:d=!0})=>s.jsxs("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",children:[s.jsx("style",{children:`
      .eye-open, .eye-closed {
        transition: opacity 0.2s ease;
      }
    `}),s.jsxs("g",{className:"eye-open",style:{opacity:d?1:0},children:[s.jsx("path",{d:"M3.91752 12.7539C3.65127 12.2996 3.65037 11.7515 3.9149 11.2962C4.9042 9.59346 7.72688 5.49994 12 5.49994C16.2731 5.49994 19.0958 9.59346 20.0851 11.2962C20.3496 11.7515 20.3487 12.2996 20.0825 12.7539C19.0908 14.4459 16.2694 18.4999 12 18.4999C7.73064 18.4999 4.90918 14.4459 3.91752 12.7539Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M12 14.8261C13.5608 14.8261 14.8261 13.5608 14.8261 12C14.8261 10.4392 13.5608 9.17392 12 9.17392C10.4392 9.17392 9.17391 10.4392 9.17391 12C9.17391 13.5608 10.4392 14.8261 12 14.8261Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]}),s.jsxs("g",{className:"eye-closed",style:{opacity:d?0:1},children:[s.jsx("path",{d:"M18.6025 9.28503C18.9174 8.9701 19.4364 8.99481 19.7015 9.35271C20.1484 9.95606 20.4943 10.507 20.7342 10.9199C21.134 11.6086 21.1329 12.4454 20.7303 13.1328C20.2144 14.013 19.2151 15.5225 17.7723 16.8193C16.3293 18.1162 14.3852 19.2497 12.0008 19.25C11.4192 19.25 10.8638 19.1823 10.3355 19.0613C9.77966 18.934 9.63498 18.2525 10.0382 17.8493C10.2412 17.6463 10.5374 17.573 10.8188 17.6302C11.1993 17.7076 11.5935 17.75 12.0008 17.75C13.8848 17.7497 15.4867 16.8568 16.7693 15.7041C18.0522 14.5511 18.9606 13.1867 19.4363 12.375C19.5656 12.1543 19.5659 11.8943 19.4373 11.6729C19.2235 11.3049 18.921 10.8242 18.5364 10.3003C18.3085 9.98991 18.3302 9.5573 18.6025 9.28503ZM12.0008 4.75C12.5814 4.75006 13.1358 4.81803 13.6632 4.93953C14.2182 5.06741 14.362 5.74812 13.9593 6.15091C13.7558 6.35435 13.4589 6.42748 13.1771 6.36984C12.7983 6.29239 12.4061 6.25006 12.0008 6.25C10.1167 6.25 8.51415 7.15145 7.23028 8.31543C5.94678 9.47919 5.03918 10.8555 4.56426 11.6729C4.43551 11.8945 4.43582 12.1542 4.56524 12.375C4.77587 12.7343 5.07189 13.2012 5.44718 13.7105C5.67623 14.0213 5.65493 14.4552 5.38193 14.7282C5.0671 15.0431 4.54833 15.0189 4.28292 14.6614C3.84652 14.0736 3.50813 13.5369 3.27129 13.1328C2.86831 12.4451 2.86717 11.6088 3.26739 10.9199C3.78185 10.0345 4.77959 8.51239 6.22247 7.2041C7.66547 5.89584 9.61202 4.75 12.0008 4.75Z",fill:"currentColor"}),s.jsx("path",{d:"M5 19L19 5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})]}),$h=({size:u=16})=>s.jsxs("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",children:[s.jsx("path",{d:"M10.6504 5.81117C10.9939 4.39628 13.0061 4.39628 13.3496 5.81117C13.5715 6.72517 14.6187 7.15891 15.4219 6.66952C16.6652 5.91193 18.0881 7.33479 17.3305 8.57815C16.8411 9.38134 17.2748 10.4285 18.1888 10.6504C19.6037 10.9939 19.6037 13.0061 18.1888 13.3496C17.2748 13.5715 16.8411 14.6187 17.3305 15.4219C18.0881 16.6652 16.6652 18.0881 15.4219 17.3305C14.6187 16.8411 13.5715 17.2748 13.3496 18.1888C13.0061 19.6037 10.9939 19.6037 10.6504 18.1888C10.4285 17.2748 9.38135 16.8411 8.57815 17.3305C7.33479 18.0881 5.91193 16.6652 6.66952 15.4219C7.15891 14.6187 6.72517 13.5715 5.81117 13.3496C4.39628 13.0061 4.39628 10.9939 5.81117 10.6504C6.72517 10.4285 7.15891 9.38134 6.66952 8.57815C5.91193 7.33479 7.33479 5.91192 8.57815 6.66952C9.38135 7.15891 10.4285 6.72517 10.6504 5.81117Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("circle",{cx:"12",cy:"12",r:"2.5",stroke:"currentColor",strokeWidth:"1.5"})]}),qh=({size:u=16})=>s.jsx("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",children:s.jsx("path",{d:"M13.5 4C14.7426 4 15.75 5.00736 15.75 6.25V7H18.5C18.9142 7 19.25 7.33579 19.25 7.75C19.25 8.16421 18.9142 8.5 18.5 8.5H17.9678L17.6328 16.2217C17.61 16.7475 17.5912 17.1861 17.5469 17.543C17.5015 17.9087 17.4225 18.2506 17.2461 18.5723C16.9747 19.0671 16.5579 19.4671 16.0518 19.7168C15.7227 19.8791 15.3772 19.9422 15.0098 19.9717C14.6514 20.0004 14.2126 20 13.6865 20H10.3135C9.78735 20 9.34856 20.0004 8.99023 19.9717C8.62278 19.9422 8.27729 19.8791 7.94824 19.7168C7.44205 19.4671 7.02532 19.0671 6.75391 18.5723C6.57751 18.2506 6.49853 17.9087 6.45312 17.543C6.40883 17.1861 6.39005 16.7475 6.36719 16.2217L6.03223 8.5H5.5C5.08579 8.5 4.75 8.16421 4.75 7.75C4.75 7.33579 5.08579 7 5.5 7H8.25V6.25C8.25 5.00736 9.25736 4 10.5 4H13.5ZM7.86621 16.1562C7.89013 16.7063 7.90624 17.0751 7.94141 17.3584C7.97545 17.6326 8.02151 17.7644 8.06934 17.8516C8.19271 18.0763 8.38239 18.2577 8.6123 18.3711C8.70153 18.4151 8.83504 18.4545 9.11035 18.4766C9.39482 18.4994 9.76335 18.5 10.3135 18.5H13.6865C14.2367 18.5 14.6052 18.4994 14.8896 18.4766C15.165 18.4545 15.2985 18.4151 15.3877 18.3711C15.6176 18.2577 15.8073 18.0763 15.9307 17.8516C15.9785 17.7644 16.0245 17.6326 16.0586 17.3584C16.0938 17.0751 16.1099 16.7063 16.1338 16.1562L16.4668 8.5H7.5332L7.86621 16.1562ZM9.97656 10.75C10.3906 10.7371 10.7371 11.0626 10.75 11.4766L10.875 15.4766C10.8879 15.8906 10.5624 16.2371 10.1484 16.25C9.73443 16.2629 9.38794 15.9374 9.375 15.5234L9.25 11.5234C9.23706 11.1094 9.56255 10.7629 9.97656 10.75ZM14.0244 10.75C14.4384 10.7635 14.7635 11.1105 14.75 11.5244L14.6201 15.5244C14.6066 15.9384 14.2596 16.2634 13.8457 16.25C13.4317 16.2365 13.1067 15.8896 13.1201 15.4756L13.251 11.4756C13.2645 11.0617 13.6105 10.7366 14.0244 10.75ZM10.5 5.5C10.0858 5.5 9.75 5.83579 9.75 6.25V7H14.25V6.25C14.25 5.83579 13.9142 5.5 13.5 5.5H10.5Z",fill:"currentColor"})}),yr=({size:u=16})=>s.jsxs("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",children:[s.jsxs("g",{clipPath:"url(#clip0_2_53)",children:[s.jsx("path",{d:"M16.25 16.25L7.75 7.75",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M7.75 16.25L16.25 7.75",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]}),s.jsx("defs",{children:s.jsx("clipPath",{id:"clip0_2_53",children:s.jsx("rect",{width:"24",height:"24",fill:"white"})})})]}),Zh=({size:u=24})=>s.jsx("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",children:s.jsx("path",{d:"M16.7198 6.21973C17.0127 5.92683 17.4874 5.92683 17.7803 6.21973C18.0732 6.51262 18.0732 6.9874 17.7803 7.28027L13.0606 12L17.7803 16.7197C18.0732 17.0126 18.0732 17.4874 17.7803 17.7803C17.4875 18.0731 17.0127 18.0731 16.7198 17.7803L12.0001 13.0605L7.28033 17.7803C6.98746 18.0731 6.51268 18.0731 6.21979 17.7803C5.92689 17.4874 5.92689 17.0126 6.21979 16.7197L10.9395 12L6.21979 7.28027C5.92689 6.98738 5.92689 6.51262 6.21979 6.21973C6.51268 5.92683 6.98744 5.92683 7.28033 6.21973L12.0001 10.9395L16.7198 6.21973Z",fill:"currentColor"})}),Vh=({size:u=16})=>s.jsxs("svg",{width:u,height:u,viewBox:"0 0 20 20",fill:"none",children:[s.jsx("path",{d:"M9.99999 12.7082C11.4958 12.7082 12.7083 11.4956 12.7083 9.99984C12.7083 8.50407 11.4958 7.2915 9.99999 7.2915C8.50422 7.2915 7.29166 8.50407 7.29166 9.99984C7.29166 11.4956 8.50422 12.7082 9.99999 12.7082Z",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M10 3.9585V5.05698",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M10 14.9429V16.0414",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M5.7269 5.72656L6.50682 6.50649",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M13.4932 13.4932L14.2731 14.2731",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M3.95834 10H5.05683",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M14.9432 10H16.0417",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M5.7269 14.2731L6.50682 13.4932",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),s.jsx("path",{d:"M13.4932 6.50649L14.2731 5.72656",stroke:"currentColor",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"})]}),Jh=({size:u=16})=>s.jsx("svg",{width:u,height:u,viewBox:"0 0 20 20",fill:"none",children:s.jsx("path",{d:"M15.5 10.4955C15.4037 11.5379 15.0124 12.5314 14.3721 13.3596C13.7317 14.1878 12.8688 14.8165 11.8841 15.1722C10.8995 15.5278 9.83397 15.5957 8.81217 15.3679C7.79038 15.1401 6.8546 14.6259 6.11434 13.8857C5.37408 13.1454 4.85995 12.2096 4.63211 11.1878C4.40427 10.166 4.47215 9.10048 4.82781 8.11585C5.18346 7.13123 5.81218 6.26825 6.64039 5.62791C7.4686 4.98756 8.46206 4.59634 9.5045 4.5C8.89418 5.32569 8.60049 6.34302 8.67685 7.36695C8.75321 8.39087 9.19454 9.35339 9.92058 10.0794C10.6466 10.8055 11.6091 11.2468 12.6331 11.3231C13.657 11.3995 14.6743 11.1058 15.5 10.4955Z",stroke:"currentColor",strokeWidth:"1.13793",strokeLinecap:"round",strokeLinejoin:"round"})}),wm=({size:u=16})=>s.jsx("svg",{width:u,height:u,viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:s.jsx("path",{d:"M11.3799 6.9572L9.05645 4.63375M11.3799 6.9572L6.74949 11.5699C6.61925 11.6996 6.45577 11.791 6.277 11.8339L4.29549 12.3092C3.93194 12.3964 3.60478 12.0683 3.69297 11.705L4.16585 9.75693C4.20893 9.57947 4.29978 9.4172 4.42854 9.28771L9.05645 4.63375M11.3799 6.9572L12.3455 5.98759C12.9839 5.34655 12.9839 4.31002 12.3455 3.66897C11.7033 3.02415 10.6594 3.02415 10.0172 3.66897L9.06126 4.62892L9.05645 4.63375",stroke:"currentColor",strokeWidth:"0.9",strokeLinecap:"round",strokeLinejoin:"round"})}),Kh=({size:u=24})=>s.jsx("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:s.jsx("path",{d:"M13.5 4C14.7426 4 15.75 5.00736 15.75 6.25V7H18.5C18.9142 7 19.25 7.33579 19.25 7.75C19.25 8.16421 18.9142 8.5 18.5 8.5H17.9678L17.6328 16.2217C17.61 16.7475 17.5912 17.1861 17.5469 17.543C17.5015 17.9087 17.4225 18.2506 17.2461 18.5723C16.9747 19.0671 16.5579 19.4671 16.0518 19.7168C15.7227 19.8791 15.3772 19.9422 15.0098 19.9717C14.6514 20.0004 14.2126 20 13.6865 20H10.3135C9.78735 20 9.34856 20.0004 8.99023 19.9717C8.62278 19.9422 8.27729 19.8791 7.94824 19.7168C7.44205 19.4671 7.02532 19.0671 6.75391 18.5723C6.57751 18.2506 6.49853 17.9087 6.45312 17.543C6.40883 17.1861 6.39005 16.7475 6.36719 16.2217L6.03223 8.5H5.5C5.08579 8.5 4.75 8.16421 4.75 7.75C4.75 7.33579 5.08579 7 5.5 7H8.25V6.25C8.25 5.00736 9.25736 4 10.5 4H13.5ZM7.86621 16.1562C7.89013 16.7063 7.90624 17.0751 7.94141 17.3584C7.97545 17.6326 8.02151 17.7644 8.06934 17.8516C8.19271 18.0763 8.38239 18.2577 8.6123 18.3711C8.70153 18.4151 8.83504 18.4545 9.11035 18.4766C9.39482 18.4994 9.76335 18.5 10.3135 18.5H13.6865C14.2367 18.5 14.6052 18.4994 14.8896 18.4766C15.165 18.4545 15.2985 18.4151 15.3877 18.3711C15.6176 18.2577 15.8073 18.0763 15.9307 17.8516C15.9785 17.7644 16.0245 17.6326 16.0586 17.3584C16.0938 17.0751 16.1099 16.7063 16.1338 16.1562L16.4668 8.5H7.5332L7.86621 16.1562ZM9.97656 10.75C10.3906 10.7371 10.7371 11.0626 10.75 11.4766L10.875 15.4766C10.8879 15.8906 10.5624 16.2371 10.1484 16.25C9.73443 16.2629 9.38794 15.9374 9.375 15.5234L9.25 11.5234C9.23706 11.1094 9.56255 10.7629 9.97656 10.75ZM14.0244 10.75C14.4383 10.7635 14.7635 11.1105 14.75 11.5244L14.6201 15.5244C14.6066 15.9384 14.2596 16.2634 13.8457 16.25C13.4317 16.2365 13.1067 15.8896 13.1201 15.4756L13.251 11.4756C13.2645 11.0617 13.6105 10.7366 14.0244 10.75ZM10.5 5.5C10.0858 5.5 9.75 5.83579 9.75 6.25V7H14.25V6.25C14.25 5.83579 13.9142 5.5 13.5 5.5H10.5Z",fill:"currentColor"})}),Wh=({size:u=16})=>s.jsx("svg",{width:u,height:u,viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:s.jsx("path",{d:"M8.5 3.5L4 8L8.5 12.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})}),Ih=({size:u=24,annotationMode:d=!1})=>s.jsx("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",children:s.jsx("path",{d:"M5.5 3.5L5.5 17.5L9 13.5L12.5 20.5L14.5 19.5L11 12.5L16 12.5L5.5 3.5Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinejoin:"round",strokeLinecap:"round",fill:d?"currentColor":"none",style:{transition:"fill 0.15s ease"}})}),Fh=({size:u=24})=>s.jsxs("svg",{width:u,height:u,viewBox:"0 0 24 24",fill:"none",children:[s.jsx("circle",{cx:"10.5",cy:"10.5",r:"6",stroke:"currentColor",strokeWidth:"1.5"}),s.jsx("path",{d:"M15 15L20 20",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]}),Xm=["data-cluso-toolbar","data-cluso-popup","data-cluso-marker"],br=Xm.flatMap(u=>[`:not([${u}])`,`:not([${u}] *)`]).join(""),zr="feedback-freeze-styles",xr="__cluso_freeze";function Ph(){if(typeof window>"u")return{frozen:!1,installed:!0,origSetTimeout:setTimeout,origSetInterval:setInterval,origRAF:d=>0,pausedAnimations:[],frozenTimeoutQueue:[],frozenRAFQueue:[]};const u=window;return u[xr]||(u[xr]={frozen:!1,installed:!1,origSetTimeout:null,origSetInterval:null,origRAF:null,pausedAnimations:[],frozenTimeoutQueue:[],frozenRAFQueue:[]}),u[xr]}const Ee=Ph();typeof window<"u"&&!Ee.installed&&(Ee.origSetTimeout=window.setTimeout.bind(window),Ee.origSetInterval=window.setInterval.bind(window),Ee.origRAF=window.requestAnimationFrame.bind(window),window.setTimeout=(u,d,..._)=>typeof u=="string"?Ee.origSetTimeout(u,d):Ee.origSetTimeout((...c)=>{Ee.frozen?Ee.frozenTimeoutQueue.push(()=>u(...c)):u(...c)},d,..._),window.setInterval=(u,d,..._)=>typeof u=="string"?Ee.origSetInterval(u,d):Ee.origSetInterval((...c)=>{Ee.frozen||u(...c)},d,..._),window.requestAnimationFrame=u=>Ee.origRAF(d=>{Ee.frozen?Ee.frozenRAFQueue.push(u):u(d)}),Ee.installed=!0);const Le=Ee.origSetTimeout,e1=Ee.origSetInterval;function t1(u){return u?Xm.some(d=>!!u.closest?.(`[${d}]`)):!1}function n1(){if(typeof document>"u"||Ee.frozen)return;Ee.frozen=!0,Ee.frozenTimeoutQueue=[],Ee.frozenRAFQueue=[];let u=document.getElementById(zr);u||(u=document.createElement("style"),u.id=zr),u.textContent=`
    *${br},
    *${br}::before,
    *${br}::after {
      animation-play-state: paused !important;
      transition: none !important;
    }
  `,document.head.appendChild(u),Ee.pausedAnimations=[];try{document.getAnimations().forEach(d=>{if(d.playState!=="running")return;const _=d.effect?.target;t1(_)||(d.pause(),Ee.pausedAnimations.push(d))})}catch{}document.querySelectorAll("video").forEach(d=>{d.paused||(d.dataset.wasPaused="false",d.pause())})}function Cm(){if(typeof document>"u"||!Ee.frozen)return;Ee.frozen=!1;const u=Ee.frozenTimeoutQueue;Ee.frozenTimeoutQueue=[];for(const _ of u)Ee.origSetTimeout(()=>{if(Ee.frozen){Ee.frozenTimeoutQueue.push(_);return}try{_()}catch(c){console.warn("[cluso] Error replaying queued timeout:",c)}},0);const d=Ee.frozenRAFQueue;Ee.frozenRAFQueue=[];for(const _ of d)Ee.origRAF(c=>{if(Ee.frozen){Ee.frozenRAFQueue.push(_);return}_(c)});for(const _ of Ee.pausedAnimations)try{_.play()}catch(c){console.warn("[cluso] Error resuming animation:",c)}Ee.pausedAnimations=[],document.getElementById(zr)?.remove(),document.querySelectorAll("video").forEach(_=>{_.dataset.wasPaused==="false"&&(_.play().catch(()=>{}),delete _.dataset.wasPaused)})}const jm=Ah.forwardRef(function({element:d,timestamp:_,selectedText:c,placeholder:b="What should change?",initialValue:v="",submitLabel:E="Add",onSubmit:V,onCancel:O,onDelete:A,style:K,accentColor:Z="#3c82f7",isExiting:pe=!1,lightMode:he=!1,glassify:Re=!1,computedStyles:ye},Ot){const[ee,Gt]=N.useState(v),[ct,et]=N.useState(!1),[ft,tt]=N.useState("initial"),[q,rt]=N.useState(!1),[Tt,on]=N.useState(!1),at=N.useRef(null),oe=N.useRef(null),Ie=N.useRef(null),_t=N.useRef(null);N.useEffect(()=>{pe&&ft!=="exit"&&tt("exit")},[pe,ft]),N.useEffect(()=>{Le(()=>{tt("enter")},0);const ne=Le(()=>{tt("entered")},200),p=Le(()=>{const S=at.current;S&&(S.focus(),S.selectionStart=S.selectionEnd=S.value.length,S.scrollTop=S.scrollHeight)},50);return()=>{clearTimeout(ne),clearTimeout(p),Ie.current&&clearTimeout(Ie.current),_t.current&&clearTimeout(_t.current)}},[]);const kt=N.useCallback(()=>{_t.current&&clearTimeout(_t.current),et(!0),_t.current=Le(()=>{et(!1),at.current?.focus()},250)},[]);N.useImperativeHandle(Ot,()=>({shake:kt}),[kt]);const z=N.useCallback(()=>{tt("exit"),Ie.current=Le(()=>{O()},150)},[O]),U=N.useCallback(()=>{ee.trim()&&V(ee.trim())},[ee,V]),J=N.useCallback(ne=>{ne.nativeEvent.isComposing||(ne.key==="Enter"&&!ne.shiftKey&&(ne.preventDefault(),U()),ne.key==="Escape"&&z())},[U,z]),Ae=[qe.popup,he?qe.light:"",Re?he?qe.glassLight:qe.glassDark:"",ft==="enter"?qe.enter:"",ft==="entered"?qe.entered:"",ft==="exit"?qe.exit:"",ct?qe.shake:""].filter(Boolean).join(" ");return s.jsxs("div",{ref:oe,className:Ae,"data-cluso-popup":!0,style:K,onClick:ne=>ne.stopPropagation(),children:[s.jsxs("div",{className:qe.header,children:[ye&&Object.keys(ye).length>0?s.jsxs("button",{className:qe.headerToggle,onClick:()=>{const ne=Tt;on(!Tt),ne&&Le(()=>at.current?.focus(),0)},type:"button",children:[s.jsx("svg",{className:`${qe.chevron} ${Tt?qe.expanded:""}`,width:"14",height:"14",viewBox:"0 0 14 14",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:s.jsx("path",{d:"M5.5 10.25L9 7.25L5.75 4",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})}),s.jsx("span",{className:qe.element,children:d})]}):s.jsx("span",{className:qe.element,children:d}),_&&s.jsx("span",{className:qe.timestamp,children:_})]}),ye&&Object.keys(ye).length>0&&s.jsx("div",{className:`${qe.stylesWrapper} ${Tt?qe.expanded:""}`,children:s.jsx("div",{className:qe.stylesInner,children:s.jsx("div",{className:qe.stylesBlock,children:Object.entries(ye).map(([ne,p])=>s.jsxs("div",{className:qe.styleLine,children:[s.jsx("span",{className:qe.styleProperty,children:ne.replace(/([A-Z])/g,"-$1").toLowerCase()}),": ",s.jsx("span",{className:qe.styleValue,children:p}),";"]},ne))})})}),c&&s.jsxs("div",{className:qe.quote,children:["“",c.slice(0,80),c.length>80?"...":"","”"]}),s.jsx("textarea",{ref:at,className:qe.textarea,style:{borderColor:q?Z:void 0},placeholder:b,value:ee,onChange:ne=>Gt(ne.target.value),onFocus:()=>rt(!0),onBlur:()=>rt(!1),rows:2,onKeyDown:J}),s.jsxs("div",{className:qe.actions,children:[A&&s.jsx("div",{className:qe.deleteWrapper,children:s.jsx("button",{className:qe.deleteButton,onClick:A,type:"button",children:s.jsx(Kh,{size:22})})}),s.jsx("button",{className:qe.cancel,onClick:z,children:"Cancel"}),s.jsx("button",{className:qe.submit,style:{backgroundColor:Z,opacity:ee.trim()?1:.4},onClick:U,disabled:!ee.trim(),children:E})]})]})}),Dr=0,Rr=1,Yr=2,l1=5,a1=6,o1=11,s1=14,Hr=15;function i1(u){const d=Object.keys(u).find(_=>_.startsWith("__reactFiber$")||_.startsWith("__reactInternalInstance$"));return d?u[d]??null:null}function Ar(u){if(!u||typeof u=="string")return null;if(u.displayName)return u.displayName;if(u.name&&u.name!=="")return u.name;if(u.render){if(u.render.displayName)return u.render.displayName;if(u.render.name)return u.render.name}return u.type?Ar(u.type):null}function du(u){const{tag:d}=u;return d===l1||d===a1?null:d===Dr||d===Rr||d===Yr||d===o1||d===s1||d===Hr?Ar(u.type):null}function Mr(u){return u.length<=2||u.length<=3&&u===u.toLowerCase()}const u1=new Set(["children","className","style","key","ref"]);function Us(u,d=0){if(u===null)return"null";if(u===void 0)return"undefined";if(typeof u=="boolean"||typeof u=="number")return String(u);if(typeof u=="string")return u.length>60?JSON.stringify(u.slice(0,58)+"…"):JSON.stringify(u);if(typeof u=="function")return`fn ${u.name||"()"}`;if(typeof u=="symbol")return u.toString();if(Array.isArray(u))return d>0?`[…${u.length}]`:`[${u.slice(0,3).map(c=>Us(c,1)).join(", ")}${u.length>3?", …":""}]`;if(typeof u=="object"){if(d>0)return"{…}";const _=Object.keys(u).slice(0,4);if(_.length===0)return"{}";const c=_.map(v=>`${v}: ${Us(u[v],1)}`),b=Object.keys(u).length>4?", …":"";return`{ ${c.join(", ")}${b} }`}return String(u)}function c1(u){const d=u.memoizedProps;return!d||typeof d!="object"?[]:Object.entries(d).filter(([_])=>!u1.has(_)).slice(0,20).map(([_,c])=>({key:_,value:Us(c),raw:c}))}function r1(u){const{tag:d,memoizedState:_}=u;if(d===Rr&&_&&typeof _=="object")return Object.entries(_).map(([,b],v)=>({index:v,value:Us(b),raw:b}));if(d===Dr||d===Yr||d===Hr){const c=[];let b=_,v=0;for(;b&&v<20;){const E=b.memoizedState;if(E!=null&&typeof E!="function"&&!(typeof E=="object"&&E!==null&&"destroy"in E)&&!(typeof E=="object"&&E!==null&&"deps"in E&&"create"in E)){if(typeof E=="object"&&E!==null&&Object.keys(E).length===1&&"current"in E){b=b.next,v++;continue}c.push({index:v,value:Us(E),raw:E})}b=b.next,v++}return c}return[]}function d1(u){const d=u._debugSource;if(!d?.fileName)return null;const _=d.fileName.split("/"),c=_.slice(Math.max(0,_.length-3)).join("/");return d.lineNumber?`${c}:${d.lineNumber}`:c}function f1(u,d=8){const _=[];let c=u,b=0;for(;c&&b<d;){const v=du(c);v&&!Mr(v)&&_.push(v),c=c.return,b++}return _.length===0?"":_.slice(0,5).reverse().map(v=>`<${v}>`).join(" ")}function Qm(u){const d=i1(u);if(!d)return{componentName:null,componentPath:null,props:[],state:[],source:null,kind:"unknown"};let _=d,c=null;for(;_;){const K=du(_);if(K&&!Mr(K)){c=_;break}if(!c&&_._debugOwner){const Z=du(_._debugOwner);if(Z&&!Mr(Z)){c=_._debugOwner;break}}_=_.return}if(!c)return{componentName:null,componentPath:null,props:[],state:[],source:null,kind:"unknown"};const b=du(c),v=f1(c),E=c1(c),V=r1(c),O=d1(c),A=c.tag===Rr?"class":c.tag===Dr||c.tag===Yr||c.tag===Hr?"function":"unknown";return{componentName:b,componentPath:v,props:E,state:V,source:O,kind:A}}async function Nm(u,d,_){}const _1="_panel_1lz0f_2",m1="_topBar_1lz0f_22",h1="_tabs_1lz0f_32",g1="_tab_1lz0f_32",p1="_tabActive_1lz0f_50",y1="_tabDot_1lz0f_52",b1="_topActions_1lz0f_57",x1="_lockedBadge_1lz0f_59",v1="_closeBtn_1lz0f_67",S1="_elementHeader_1lz0f_77",w1="_elementTitle_1lz0f_87",C1="_elementIcon_1lz0f_91",j1="_elementName_1lz0f_93",N1="_elementPath_1lz0f_100",E1="_scroll_1lz0f_112",T1="_sectionHeader_1lz0f_121",k1="_sectionTitle_1lz0f_128",z1="_sectionActions_1lz0f_135",A1="_section_1lz0f_121",M1="_iconBtn_1lz0f_141",O1="_iconBtnActive_1lz0f_150",L1="_segGroup_1lz0f_153",B1="_segBtn_1lz0f_161",D1="_segBtnActive_1lz0f_171",R1="_rowGroup_1lz0f_174",Y1="_fieldRow_1lz0f_182",H1="_field_1lz0f_182",U1="_fieldWide_1lz0f_204",X1="_fieldLabel_1lz0f_206",Q1="_fieldValue_1lz0f_215",G1="_propRow_1lz0f_234",$1="_propLabel_1lz0f_242",q1="_propValue_1lz0f_249",Z1="_colorRow_1lz0f_261",V1="_colorSwatch_1lz0f_268",J1="_colorHex_1lz0f_291",K1="_colorAlpha_1lz0f_299",W1="_colorLabel_1lz0f_306",I1="_alignGrid_1lz0f_313",F1="_alignCell_1lz0f_324",P1="_alignCellActive_1lz0f_332",eg="_twoColLayout_1lz0f_335",tg="_paddingGroup_1lz0f_344",ng="_checkboxGroup_1lz0f_347",lg="_checkbox_1lz0f_347",ag="_checkboxBox_1lz0f_351",og="_checkboxLabel_1lz0f_362",sg="_divider_1lz0f_365",ig="_componentBadgeRow_1lz0f_372",ug="_componentBadge_1lz0f_372",cg="_kindBadge_1lz0f_385",rg="_sourceHint_1lz0f_393",dg="_sourceBlock_1lz0f_400",fg="_treeBlock_1lz0f_411",_g="_subLabel_1lz0f_418",mg="_emptyNote_1lz0f_426",X={panel:_1,topBar:m1,tabs:h1,tab:g1,tabActive:p1,tabDot:y1,topActions:b1,lockedBadge:x1,closeBtn:v1,elementHeader:S1,elementTitle:w1,elementIcon:C1,elementName:j1,elementPath:N1,scroll:E1,sectionHeader:T1,sectionTitle:k1,sectionActions:z1,section:A1,iconBtn:M1,iconBtnActive:O1,segGroup:L1,segBtn:B1,segBtnActive:D1,rowGroup:R1,fieldRow:Y1,field:H1,fieldWide:U1,fieldLabel:X1,fieldValue:Q1,propRow:G1,propLabel:$1,propValue:q1,colorRow:Z1,colorSwatch:V1,colorHex:J1,colorAlpha:K1,colorLabel:W1,alignGrid:I1,alignCell:F1,alignCellActive:P1,twoColLayout:eg,paddingGroup:tg,checkboxGroup:ng,checkbox:lg,checkboxBox:ag,checkboxLabel:og,divider:sg,componentBadgeRow:ig,componentBadge:ug,kindBadge:cg,sourceHint:rg,sourceBlock:dg,treeBlock:fg,subLabel:_g,emptyNote:mg};function vr(u){const d=u.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);return d?"#"+[d[1],d[2],d[3]].map(_=>parseInt(_).toString(16).padStart(2,"0")).join("").toUpperCase():u}function Sr(u){return!u||u==="transparent"||u==="rgba(0, 0, 0, 0)"}function tu(u){return`${Math.round(u)}`}function pn(u){return u.replace(/px$/,"")}function Ya({title:u,children:d}){return s.jsxs("div",{className:X.sectionHeader,children:[s.jsx("span",{className:X.sectionTitle,children:u}),d&&s.jsx("div",{className:X.sectionActions,children:d})]})}function Mo(){return s.jsx("div",{className:X.divider})}function Ha({children:u,active:d,title:_,onClick:c}){return s.jsx("button",{className:`${X.iconBtn} ${d?X.iconBtnActive:""}`,title:_,onClick:c,children:u})}function nu({children:u}){return s.jsx("div",{className:X.segGroup,children:u})}function Bn({children:u,active:d,title:_,onClick:c}){return s.jsx("button",{className:`${X.segBtn} ${d?X.segBtnActive:""}`,title:_,onClick:c,children:u})}function Dn({label:u,value:d,wide:_,mono:c,onCommit:b}){const[v,E]=N.useState(d);N.useEffect(()=>{E(d)},[d]);const V=N.useCallback(O=>{b?.(O.trim())},[b]);return s.jsxs("div",{className:`${X.field} ${_?X.fieldWide:""}`,children:[s.jsx("span",{className:X.fieldLabel,children:u}),s.jsx("input",{className:X.fieldValue,style:{fontFamily:c?"'SF Mono','Fira Mono',monospace":void 0},value:v,onChange:O=>E(O.target.value),onBlur:O=>V(O.target.value),onKeyDown:O=>{O.key==="Enter"&&(V(v),O.target.blur())}})]})}function lu({la:u,a:d,onA:_,lb:c,b,onB:v}){return s.jsxs("div",{className:X.fieldRow,children:[s.jsx(Dn,{label:u,value:d,mono:!0,onCommit:_}),s.jsx(Dn,{label:c,value:b,mono:!0,onCommit:v})]})}function fu({label:u,value:d}){return s.jsxs("div",{className:X.propRow,children:[s.jsx("span",{className:X.propLabel,children:u}),s.jsx("span",{className:X.propValue,children:d})]})}function wr({hex:u,alpha:d,label:_,onChangeColor:c,onChangeAlpha:b}){const v=N.useRef(null),[E,V]=N.useState(String(d));return N.useEffect(()=>V(String(d)),[d]),s.jsxs("div",{className:X.colorRow,style:{cursor:c?"pointer":void 0},onClick:()=>v.current?.click(),children:[s.jsx("div",{className:X.colorSwatch,style:{background:`#${u}`}}),c&&s.jsx("input",{type:"color",ref:v,value:`#${u.toUpperCase()}`,onChange:O=>c(O.target.value),onClick:O=>O.stopPropagation(),style:{position:"absolute",opacity:0,pointerEvents:"none",width:0,height:0}}),s.jsx("input",{className:X.colorHex,value:u,readOnly:!c,onChange:()=>{},onClick:O=>O.stopPropagation(),style:{background:"none",border:"none",outline:"none",color:"inherit",fontSize:"inherit",width:72,cursor:"text"}}),s.jsx("input",{className:X.colorAlpha,value:E+"%",onChange:O=>V(O.target.value.replace("%","")),onBlur:O=>{const A=parseInt(O.target.value);isNaN(A)||b?.(A)},onKeyDown:O=>{if(O.key==="Enter"){const A=parseInt(E);isNaN(A)||b?.(A),O.target.blur()}},onClick:O=>O.stopPropagation(),style:{background:"none",border:"none",outline:"none",color:"inherit",fontSize:"inherit",width:36,cursor:"text"}}),_&&s.jsx("span",{className:X.colorLabel,children:_})]})}function Em({checked:u,label:d,onChange:_}){return s.jsxs("label",{className:X.checkbox,onClick:()=>_?.(!u),style:{cursor:"pointer"},children:[s.jsx("span",{className:X.checkboxBox,"data-checked":u,children:u&&s.jsx("svg",{width:"9",height:"7",viewBox:"0 0 9 7",fill:"none",children:s.jsx("path",{d:"M1 3.5L3 5.5L8 1",stroke:"white",strokeWidth:"1.4",strokeLinecap:"round",strokeLinejoin:"round"})})}),s.jsx("span",{className:X.checkboxLabel,children:d})]})}const hg=()=>s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M1 1v11M4 4h7M4 9h5",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})}),gg=()=>s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M6.5 1v11M2 4h9M3.5 9h6",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})}),pg=()=>s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M12 1v11M2 4h7M4 9h5",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})}),yg=()=>s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M1 1h11M4 4v7M9 4v5",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})}),bg=()=>s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M1 6.5h11M4 2v9M9 3.5v6",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})}),xg=()=>s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M1 12h11M4 2v7M9 4v5",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})}),vg=()=>s.jsx("svg",{width:"12",height:"12",viewBox:"0 0 12 12",fill:"none",children:s.jsx("path",{d:"M2 6a4 4 0 104-4H4M4 1L2 3l2 2",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round",strokeLinejoin:"round"})}),Sg=()=>s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M6.5 2v9M3.5 8l3 3 3-3",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round",strokeLinejoin:"round"})}),wg=()=>s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M2 6.5h9M8 3.5l3 3-3 3",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round",strokeLinejoin:"round"})}),Cg=()=>s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M2 4h9M2 8.5h5.5a1.5 1.5 0 000-3H2M2 9l-1.5 1.5L2 12",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round",strokeLinejoin:"round"})}),Tm=()=>s.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:[s.jsx("rect",{x:"1.5",y:"1.5",width:"4",height:"4",rx:"0.8",stroke:"currentColor",strokeWidth:"1.2"}),s.jsx("rect",{x:"7.5",y:"1.5",width:"4",height:"4",rx:"0.8",stroke:"currentColor",strokeWidth:"1.2"}),s.jsx("rect",{x:"1.5",y:"7.5",width:"4",height:"4",rx:"0.8",stroke:"currentColor",strokeWidth:"1.2"}),s.jsx("rect",{x:"7.5",y:"7.5",width:"4",height:"4",rx:"0.8",stroke:"currentColor",strokeWidth:"1.2"})]}),jg=()=>s.jsx("svg",{width:"12",height:"12",viewBox:"0 0 12 12",fill:"none",children:s.jsx("path",{d:"M4.5 7.5l3-3M3 5l-.7.7a2.5 2.5 0 003.5 3.5L6.5 9M9 7l.7-.7a2.5 2.5 0 00-3.5-3.5L5.5 3",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})}),km=()=>s.jsx("svg",{width:"12",height:"12",viewBox:"0 0 12 12",fill:"none",children:s.jsx("path",{d:"M3 5l-.7.7a2.5 2.5 0 003.5 3.5L6.5 9M9 7l.7-.7a2.5 2.5 0 00-3.5-3.5L5.5 3M2 2l8 8",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round"})}),zm=()=>s.jsx("svg",{width:"11",height:"11",viewBox:"0 0 11 11",fill:"none",children:s.jsx("path",{d:"M5.5 1v9M1 5.5h9",stroke:"currentColor",strokeWidth:"1.4",strokeLinecap:"round"})}),Ng=()=>s.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:[s.jsx("path",{d:"M1.5 6.5S3.5 3 6.5 3s5 3.5 5 3.5-2 3.5-5 3.5-5-3.5-5-3.5z",stroke:"currentColor",strokeWidth:"1.2"}),s.jsx("circle",{cx:"6.5",cy:"6.5",r:"1.5",stroke:"currentColor",strokeWidth:"1.2"})]}),Or=()=>s.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:[s.jsx("circle",{cx:"6.5",cy:"6.5",r:"1.3",fill:"currentColor"}),s.jsx("ellipse",{cx:"6.5",cy:"6.5",rx:"5.5",ry:"2.2",stroke:"currentColor",strokeWidth:"1.1",fill:"none"}),s.jsx("ellipse",{cx:"6.5",cy:"6.5",rx:"5.5",ry:"2.2",stroke:"currentColor",strokeWidth:"1.1",fill:"none",transform:"rotate(60 6.5 6.5)"}),s.jsx("ellipse",{cx:"6.5",cy:"6.5",rx:"5.5",ry:"2.2",stroke:"currentColor",strokeWidth:"1.1",fill:"none",transform:"rotate(120 6.5 6.5)"})]});function Eg({value:u,onChange:d}){const _=["tl","tc","tr","ml","mc","mr","bl","bc","br"];return s.jsx("div",{className:X.alignGrid,children:_.map(c=>s.jsx("div",{className:`${X.alignCell} ${c===u?X.alignCellActive:""}`,onClick:()=>d?.(c),style:{cursor:"pointer"}},c))})}function Am(u){window.getComputedStyle(u).position==="static"&&(u.style.position="relative")}function Tg({el:u,accentColor:d}){const _=Qm(u),c=window.getComputedStyle(u),b=u.getBoundingClientRect(),v=u.tagName.toLowerCase(),E=tu(b.left+window.scrollX),V=tu(b.top+window.scrollY),O=pn(c.width)||tu(b.width),A=pn(c.height)||tu(b.height),K=c.display,Z=c.flexDirection,pe=c.justifyContent,he=c.alignItems,Re=c.gap&&c.gap!=="normal"?pn(c.gap):"0",ye=K==="flex"||K==="grid",Ot=pn(c.paddingTop),ee=pn(c.paddingRight),Gt=pn(c.paddingBottom),ct=pn(c.paddingLeft),et=pn(c.marginTop),ft=pn(c.marginRight),tt=pn(c.marginBottom),q=pn(c.marginLeft),rt=parseFloat(c.opacity??"1"),Tt=pn(c.borderRadius)||"0",on=c.backgroundColor,at=!Sr(on),oe=at?vr(on).replace("#",""):"FFFFFF",Ie=c.borderColor,_t=!!(c.border&&!c.border.startsWith("0px")&&!Sr(Ie)),kt=pn(c.fontSize),z=c.fontWeight,U=c.color,J=c.fontFamily?.split(",")[0]?.trim().replace(/['"]/g,"")??"",ne=new Set(["p","span","h1","h2","h3","h4","h5","h6","a","li","label","td","th","blockquote","code","strong","em","b","i","button"]).has(v),p=(()=>{const $=pe,we=he;return`${we==="flex-start"||we==="start"?"t":we==="center"?"m":we==="flex-end"||we==="end"?"b":"m"}${$==="flex-start"||$==="start"?"l":$==="center"?"c":$==="flex-end"||$==="end"?"r":"l"}`})(),S=($,we)=>{u.style.setProperty($,we),Nm()},H=($,we)=>{const yn=parseFloat(we),$n=isNaN(yn)?we:`${yn}px`;u.style.setProperty($,$n),Nm()},B=$=>{const we={l:"flex-start",c:"center",r:"flex-end"},yn={t:"flex-start",m:"center",b:"flex-end"},$n=$[0],Kt=$[1];S("justify-content",we[Kt]??"flex-start"),S("align-items",yn[$n]??"flex-start"),K!=="flex"&&K!=="grid"&&S("display","flex")},[le,ge]=N.useState(c.overflow==="hidden"),[Te,Fe]=N.useState(c.overflow==="auto"||c.overflow==="scroll"),Ze=($,we)=>{we?S("overflow","auto"):$?S("overflow","hidden"):S("overflow","visible")};return s.jsxs(s.Fragment,{children:[_.componentName&&s.jsxs(s.Fragment,{children:[s.jsx(Ya,{title:"Component"}),s.jsxs("div",{className:X.section,children:[s.jsxs("div",{className:X.componentBadgeRow,children:[s.jsxs("span",{className:X.componentBadge,style:{color:d,background:`${d}18`,borderColor:`${d}30`},children:[s.jsx(Or,{}),_.componentName]}),_.source&&s.jsx("span",{className:X.sourceHint,children:_.source})]}),_.props.length>0&&s.jsxs(s.Fragment,{children:[s.jsx("div",{className:X.subLabel,children:"Props"}),_.props.map($=>s.jsx(fu,{label:$.key,value:$.value},$.key))]}),_.state.length>0&&s.jsxs(s.Fragment,{children:[s.jsx("div",{className:X.subLabel,style:{marginTop:6},children:"State"}),_.state.map(($,we)=>s.jsx(fu,{label:`[${$.index}]`,value:$.value},we))]}),_.props.length===0&&_.state.length===0&&s.jsx("div",{className:X.emptyNote,children:"No props or state"})]}),s.jsx(Mo,{})]}),s.jsx(Ya,{title:"Position"}),s.jsxs("div",{className:X.section,children:[s.jsxs("div",{className:X.rowGroup,children:[s.jsxs(nu,{children:[s.jsx(Bn,{title:"Align left",onClick:()=>{S("margin-right","auto")},children:s.jsx(hg,{})}),s.jsx(Bn,{title:"Align center",onClick:()=>{S("margin-left","auto"),S("margin-right","auto")},children:s.jsx(gg,{})}),s.jsx(Bn,{title:"Align right",onClick:()=>{S("margin-left","auto")},children:s.jsx(pg,{})})]}),s.jsx("div",{style:{width:4}}),s.jsxs(nu,{children:[s.jsx(Bn,{title:"Align top",onClick:()=>{S("margin-bottom","auto")},children:s.jsx(yg,{})}),s.jsx(Bn,{title:"Align middle",onClick:()=>{S("margin-top","auto"),S("margin-bottom","auto")},children:s.jsx(bg,{})}),s.jsx(Bn,{title:"Align bottom",onClick:()=>{S("margin-top","auto")},children:s.jsx(xg,{})})]})]}),s.jsx(lu,{la:"X",a:E,onA:$=>{Am(u),H("left",$)},lb:"Y",b:V,onB:$=>{Am(u),H("top",$)}}),s.jsxs("div",{className:X.fieldRow,children:[s.jsx(Dn,{label:"W",value:O,mono:!0,onCommit:$=>H("width",$)}),s.jsx(Dn,{label:"H",value:A,mono:!0,onCommit:$=>H("height",$)}),s.jsx(Ha,{title:"Lock ratio",children:s.jsx(jg,{})})]}),s.jsxs("div",{className:X.fieldRow,children:[s.jsx(Dn,{label:s.jsx(vg,{}),value:`${Math.round(parseFloat(c.rotate||"0"))}°`,mono:!0,wide:!0,onCommit:$=>S("rotate",`${parseFloat($)}deg`)}),s.jsxs(nu,{children:[s.jsx(Bn,{title:"Flip H",onClick:()=>S("scale-x",c.transform.includes("matrix(-1")?"1":"-1"),children:s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M6.5 2v9M2 6.5l2-2v4l-2-2M11 6.5l-2-2v4l2-2",stroke:"currentColor",strokeWidth:"1.2",strokeLinecap:"round"})})}),s.jsx(Bn,{title:"Flip V",onClick:()=>S("scale-y",c.transform.includes("matrix(1, 0, 0, -1")?"1":"-1"),children:s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:s.jsx("path",{d:"M2 6.5h9M6.5 2l-2 2h4l-2-2M6.5 11l-2-2h4l-2 2",stroke:"currentColor",strokeWidth:"1.2",strokeLinecap:"round"})})})]})]})]}),s.jsx(Mo,{}),s.jsx(Ya,{title:"Auto layout",children:s.jsx(Ha,{title:"Layout options",children:s.jsx(Tm,{})})}),s.jsxs("div",{className:X.section,children:[s.jsx("div",{className:X.rowGroup,children:s.jsxs(nu,{children:[s.jsx(Bn,{active:Z==="column",title:"Vertical",onClick:()=>{S("flex-direction","column"),K!=="flex"&&S("display","flex")},children:s.jsx(Sg,{})}),s.jsx(Bn,{active:Z==="row"||!ye,title:"Horizontal",onClick:()=>{S("flex-direction","row"),K!=="flex"&&S("display","flex")},children:s.jsx(wg,{})}),s.jsx(Bn,{active:c.flexWrap==="wrap",title:"Wrap",onClick:()=>{S("flex-wrap",c.flexWrap==="wrap"?"nowrap":"wrap"),K!=="flex"&&S("display","flex")},children:s.jsx(Cg,{})}),s.jsx(Bn,{active:K==="grid",title:"Grid",onClick:()=>S("display",K==="grid"?"flex":"grid"),children:s.jsx(Tm,{})})]})}),s.jsx(lu,{la:"W",a:O,onA:$=>H("width",$),lb:"H",b:A,onB:$=>H("height",$)}),s.jsxs("div",{className:X.twoColLayout,children:[s.jsxs("div",{children:[s.jsx("div",{className:X.subLabel,children:"Alignment"}),s.jsx(Eg,{value:ye?p:"ml",onChange:B})]}),s.jsxs("div",{children:[s.jsx("div",{className:X.subLabel,children:"Gap"}),s.jsx(Dn,{label:"Gap",value:Re,mono:!0,wide:!0,onCommit:$=>H("gap",$)})]})]}),s.jsxs("div",{className:X.paddingGroup,children:[s.jsxs("div",{className:X.fieldRow,children:[s.jsx(Dn,{label:"↑",value:Ot,mono:!0,onCommit:$=>H("padding-top",$)}),s.jsx(Dn,{label:"↓",value:Gt,mono:!0,onCommit:$=>H("padding-bottom",$)})]}),s.jsxs("div",{className:X.fieldRow,children:[s.jsx(Dn,{label:"←",value:ct,mono:!0,onCommit:$=>H("padding-left",$)}),s.jsx(Dn,{label:"→",value:ee,mono:!0,onCommit:$=>H("padding-right",$)}),s.jsx(Ha,{title:"Independent padding",children:s.jsx(km,{})})]})]}),s.jsxs("div",{className:X.fieldRow,children:[s.jsx(Dn,{label:"↔",value:et===ft&&ft===tt&&tt===q?et:`${et} ${ft} ${tt} ${q}`,mono:!0,wide:!0,onCommit:$=>{const we=$.trim().split(/\s+/);we.length===1?H("margin",we[0]):we.length===2?(H("margin-top",we[0]),H("margin-right",we[1]),H("margin-bottom",we[0]),H("margin-left",we[1])):we.length===4&&(H("margin-top",we[0]),H("margin-right",we[1]),H("margin-bottom",we[2]),H("margin-left",we[3]))}}),s.jsx(Ha,{title:"Independent margin",children:s.jsx(km,{})})]}),s.jsxs("div",{className:X.checkboxGroup,children:[s.jsx(Em,{checked:le,label:"Clip content",onChange:$=>{ge($),Ze($,Te)}}),s.jsx(Em,{checked:Te,label:"Scrollable",onChange:$=>{Fe($),Ze(le,$)}})]})]}),s.jsx(Mo,{}),ne&&s.jsxs(s.Fragment,{children:[s.jsx(Ya,{title:"Typography"}),s.jsxs("div",{className:X.section,children:[s.jsx(Dn,{label:"Font",value:J||"-apple-system",wide:!0,onCommit:$=>S("font-family",$)}),s.jsx(lu,{la:"Size",a:kt,onA:$=>H("font-size",$),lb:"Weight",b:z,onB:$=>S("font-weight",$)}),!Sr(U)&&s.jsx(wr,{hex:vr(U).replace("#",""),alpha:100,onChangeColor:$=>S("color",$)})]}),s.jsx(Mo,{})]}),s.jsx(Ya,{title:"Appearance",children:s.jsx(Ha,{title:"Toggle visibility",onClick:()=>S("visibility",c.visibility==="hidden"?"visible":"hidden"),children:s.jsx(Ng,{})})}),s.jsx("div",{className:X.section,children:s.jsx(lu,{la:"Opacity",a:`${Math.round(rt*100)}`,onA:$=>S("opacity",`${parseFloat($)/100}`),lb:"Radius",b:Tt,onB:$=>H("border-radius",$)})}),s.jsx(Mo,{}),s.jsx(Ya,{title:"Fill",children:s.jsx(Ha,{title:"Add fill",onClick:()=>S("background-color","#3c82f7"),children:s.jsx(zm,{})})}),s.jsx("div",{className:X.section,children:at?s.jsx(wr,{hex:oe,alpha:Math.round(rt*100),onChangeColor:$=>S("background-color",$),onChangeAlpha:$=>S("opacity",`${$/100}`)}):s.jsx("div",{className:X.emptyNote,children:"No fill"})}),s.jsx(Mo,{}),s.jsx(Ya,{title:"Stroke",children:s.jsx(Ha,{title:"Add stroke",onClick:()=>{S("border-style","solid"),S("border-width","1px"),S("border-color","#000000")},children:s.jsx(zm,{})})}),s.jsx("div",{className:X.section,children:_t?s.jsx(wr,{hex:vr(Ie).replace("#",""),alpha:100,label:c.borderWidth,onChangeColor:$=>S("border-color",$)}):s.jsx("div",{className:X.emptyNote,children:"No stroke"})}),s.jsx("div",{style:{height:20}})]})}function kg({info:u,locked:d,onClose:_,accentColor:c="#3c82f7"}){const[b,v]=N.useState(!1),[E,V]=N.useState(!1),[O,A]=N.useState("design"),K=N.useRef(null);N.useEffect(()=>{if(u){V(!0);const ye=setTimeout(()=>v(!0),10);return()=>clearTimeout(ye)}else{v(!1);const ye=setTimeout(()=>V(!1),320);return()=>clearTimeout(ye)}},[u]),u&&(K.current=u);const Z=u??K.current;if(!E||!Z)return null;const pe=Z.element;if(!pe||!document.contains(pe))return null;const he=Qm(pe),Re=he.componentName??Z.name;return kr.createPortal(s.jsxs("div",{className:X.panel,style:{transform:b?"translateX(0)":"translateX(calc(100% + 8px))",opacity:b?1:0,"--accent":c},"data-cluso-toolbar":!0,"data-cluso-inspector-panel":!0,children:[s.jsxs("div",{className:X.topBar,children:[s.jsxs("div",{className:X.tabs,children:[s.jsx("button",{className:`${X.tab} ${O==="design"?X.tabActive:""}`,onClick:()=>A("design"),children:"Design"}),s.jsxs("button",{className:`${X.tab} ${O==="react"?X.tabActive:""}`,onClick:()=>A("react"),children:["React",he.componentName&&s.jsx("span",{className:X.tabDot,style:{background:c}})]})]}),s.jsxs("div",{className:X.topActions,children:[d&&s.jsx("span",{className:X.lockedBadge,style:{color:c,background:`${c}18`},children:s.jsxs("svg",{width:"7",height:"9",viewBox:"0 0 7 9",fill:"none",children:[s.jsx("rect",{x:"0.5",y:"3.5",width:"6",height:"5",rx:"1",fill:"currentColor"}),s.jsx("path",{d:"M1.5 3.5V2.5a2 2 0 014 0v1",stroke:"currentColor",strokeWidth:"1.1",strokeLinecap:"round"})]})}),s.jsx("button",{className:X.closeBtn,onClick:_,children:s.jsx("svg",{width:"9",height:"9",viewBox:"0 0 9 9",fill:"none",children:s.jsx("path",{d:"M1 1L8 8M8 1L1 8",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})})})]})]}),s.jsxs("div",{className:X.elementHeader,children:[s.jsxs("div",{className:X.elementTitle,children:[he.componentName?s.jsx("span",{className:X.elementIcon,style:{color:c},children:s.jsx(Or,{})}):s.jsx("span",{className:X.elementIcon,children:s.jsxs("svg",{width:"12",height:"12",viewBox:"0 0 12 12",fill:"none",children:[s.jsx("rect",{x:"1",y:"1",width:"10",height:"10",rx:"1.5",stroke:"currentColor",strokeWidth:"1.2",fill:"none"}),s.jsx("path",{d:"M4 5l-2 1 2 1M8 5l2 1-2 1",stroke:"currentColor",strokeWidth:"1",strokeLinecap:"round"})]})}),s.jsx("span",{className:X.elementName,children:Re})]}),he.componentPath&&s.jsx("span",{className:X.elementPath,children:he.componentPath})]}),s.jsx("div",{className:X.scroll,children:O==="design"?s.jsx(Tg,{el:pe,accentColor:c},pe.outerHTML.slice(0,60)):s.jsx("div",{className:X.section,style:{paddingTop:12},children:he.componentName?s.jsxs(s.Fragment,{children:[s.jsxs("div",{className:X.componentBadgeRow,children:[s.jsxs("span",{className:X.componentBadge,style:{color:c,background:`${c}18`,borderColor:`${c}30`},children:[s.jsx(Or,{}),he.componentName]}),s.jsx("span",{className:X.kindBadge,children:he.kind})]}),he.source&&s.jsx("div",{className:X.sourceBlock,children:he.source}),he.props.length>0&&s.jsxs(s.Fragment,{children:[s.jsx("div",{className:X.subLabel,style:{marginTop:12},children:"Props"}),he.props.map(ye=>s.jsx(fu,{label:ye.key,value:ye.value},ye.key))]}),he.state.length>0&&s.jsxs(s.Fragment,{children:[s.jsx("div",{className:X.subLabel,style:{marginTop:12},children:"State"}),he.state.map((ye,Ot)=>s.jsx(fu,{label:`hook[${ye.index}]`,value:ye.value},Ot))]}),he.props.length===0&&he.state.length===0&&s.jsx("div",{className:X.emptyNote,style:{marginTop:8},children:"No props or state found"}),s.jsx("div",{className:X.subLabel,style:{marginTop:12},children:"Tree"}),s.jsx("div",{className:X.treeBlock,children:he.componentPath})]}):s.jsx("div",{className:X.emptyNote,children:"No React component found for this element"})})})]}),document.body)}function Do(u){if(u.parentElement)return u.parentElement;const d=u.getRootNode();return d instanceof ShadowRoot?d.host:null}function Qt(u,d){let _=u;for(;_;){if(_.matches(d))return _;_=Do(_)}return null}function zg(u,d=4){const _=[];let c=u,b=0;for(;c&&b<d;){const v=c.tagName.toLowerCase();if(v==="html"||v==="body")break;let E=v;if(c.id)E=`#${c.id}`;else if(c.className&&typeof c.className=="string"){const O=c.className.split(/\s+/).find(A=>A.length>2&&!A.match(/^[a-z]{1,2}$/)&&!A.match(/[A-Z0-9]{5,}/));O&&(E=`.${O.split("_")[0]}`)}const V=Do(c);!c.parentElement&&V&&(E=`⟨shadow⟩ ${E}`),_.unshift(E),c=V,b++}return _.join(" > ")}function _u(u){const d=zg(u);if(u.dataset.element)return{name:u.dataset.element,path:d};const _=u.tagName.toLowerCase();if(["path","circle","rect","line","g"].includes(_)){const c=Qt(u,"svg");if(c){const b=Do(c);if(b instanceof HTMLElement)return{name:`graphic in ${_u(b).name}`,path:d}}return{name:"graphic element",path:d}}if(_==="svg"){const c=Do(u);if(c?.tagName.toLowerCase()==="button"){const b=c.textContent?.trim();return{name:b?`icon in "${b}" button`:"button icon",path:d}}return{name:"icon",path:d}}if(_==="button"){const c=u.textContent?.trim(),b=u.getAttribute("aria-label");return b?{name:`button [${b}]`,path:d}:{name:c?`button "${c.slice(0,25)}"`:"button",path:d}}if(_==="a"){const c=u.textContent?.trim(),b=u.getAttribute("href");return c?{name:`link "${c.slice(0,25)}"`,path:d}:b?{name:`link to ${b.slice(0,30)}`,path:d}:{name:"link",path:d}}if(_==="input"){const c=u.getAttribute("type")||"text",b=u.getAttribute("placeholder"),v=u.getAttribute("name");return b?{name:`input "${b}"`,path:d}:v?{name:`input [${v}]`,path:d}:{name:`${c} input`,path:d}}if(["h1","h2","h3","h4","h5","h6"].includes(_)){const c=u.textContent?.trim();return{name:c?`${_} "${c.slice(0,35)}"`:_,path:d}}if(_==="p"){const c=u.textContent?.trim();return c?{name:`paragraph: "${c.slice(0,40)}${c.length>40?"...":""}"`,path:d}:{name:"paragraph",path:d}}if(_==="span"||_==="label"){const c=u.textContent?.trim();return c&&c.length<40?{name:`"${c}"`,path:d}:{name:_,path:d}}if(_==="li"){const c=u.textContent?.trim();return c&&c.length<40?{name:`list item: "${c.slice(0,35)}"`,path:d}:{name:"list item",path:d}}if(_==="blockquote")return{name:"blockquote",path:d};if(_==="code"){const c=u.textContent?.trim();return c&&c.length<30?{name:`code: \`${c}\``,path:d}:{name:"code",path:d}}if(_==="pre")return{name:"code block",path:d};if(_==="img"){const c=u.getAttribute("alt");return{name:c?`image "${c.slice(0,30)}"`:"image",path:d}}if(_==="video")return{name:"video",path:d};if(["div","section","article","nav","header","footer","aside","main"].includes(_)){const c=u.className,b=u.getAttribute("role"),v=u.getAttribute("aria-label");if(v)return{name:`${_} [${v}]`,path:d};if(b)return{name:`${b}`,path:d};if(typeof c=="string"&&c){const E=c.split(/[\s_-]+/).map(V=>V.replace(/[A-Z0-9]{5,}.*$/,"")).filter(V=>V.length>2&&!/^[a-z]{1,2}$/.test(V)).slice(0,2);if(E.length>0)return{name:E.join(" "),path:d}}return{name:_==="div"?"container":_,path:d}}return{name:_,path:d}}function Bs(u){const d=[],_=u.textContent?.trim();_&&_.length<100&&d.push(_);const c=u.previousElementSibling;if(c){const v=c.textContent?.trim();v&&v.length<50&&d.unshift(`[before: "${v.slice(0,40)}"]`)}const b=u.nextElementSibling;if(b){const v=b.textContent?.trim();v&&v.length<50&&d.push(`[after: "${v.slice(0,40)}"]`)}return d.join(" ")}function au(u){const d=Do(u);if(!d)return"";const b=(u.getRootNode()instanceof ShadowRoot&&u.parentElement?Array.from(u.parentElement.children):Array.from(d.children)).filter(K=>K!==u&&K instanceof HTMLElement);if(b.length===0)return"";const v=b.slice(0,4).map(K=>{const Z=K.tagName.toLowerCase(),pe=K.className;let he="";if(typeof pe=="string"&&pe){const Re=pe.split(/\s+/).map(ye=>ye.replace(/[_][a-zA-Z0-9]{5,}.*$/,"")).find(ye=>ye.length>2&&!/^[a-z]{1,2}$/.test(ye));Re&&(he=`.${Re}`)}if(Z==="button"||Z==="a"){const Re=K.textContent?.trim().slice(0,15);if(Re)return`${Z}${he} "${Re}"`}return`${Z}${he}`});let V=d.tagName.toLowerCase();if(typeof d.className=="string"&&d.className){const K=d.className.split(/\s+/).map(Z=>Z.replace(/[_][a-zA-Z0-9]{5,}.*$/,"")).find(Z=>Z.length>2&&!/^[a-z]{1,2}$/.test(Z));K&&(V=`.${K}`)}const O=d.children.length,A=O>v.length+1?` (${O} total in ${V})`:"";return v.join(", ")+A}function Ds(u){const d=u.className;return typeof d!="string"||!d?"":d.split(/\s+/).filter(c=>c.length>0).map(c=>{const b=c.match(/^([a-zA-Z][a-zA-Z0-9_-]*?)(?:_[a-zA-Z0-9]{5,})?$/);return b?b[1]:c}).filter((c,b,v)=>v.indexOf(c)===b).join(", ")}const Gm=new Set(["none","normal","auto","0px","rgba(0, 0, 0, 0)","transparent","static","visible"]),Ag=new Set(["p","span","h1","h2","h3","h4","h5","h6","label","li","td","th","blockquote","figcaption","caption","legend","dt","dd","pre","code","em","strong","b","i","a","time","cite","q"]),Mg=new Set(["input","textarea","select"]),Og=new Set(["img","video","canvas","svg"]),Lg=new Set(["div","section","article","nav","header","footer","aside","main","ul","ol","form","fieldset"]);function ou(u){if(typeof window>"u")return{};const d=window.getComputedStyle(u),_={},c=u.tagName.toLowerCase();let b;Ag.has(c)?b=["color","fontSize","fontWeight","fontFamily","lineHeight"]:c==="button"||c==="a"&&u.getAttribute("role")==="button"?b=["backgroundColor","color","padding","borderRadius","fontSize"]:Mg.has(c)?b=["backgroundColor","color","padding","borderRadius","fontSize"]:Og.has(c)?b=["width","height","objectFit","borderRadius"]:Lg.has(c)?b=["display","padding","margin","gap","backgroundColor"]:b=["color","fontSize","margin","padding","backgroundColor"];for(const v of b){const E=v.replace(/([A-Z])/g,"-$1").toLowerCase(),V=d.getPropertyValue(E);V&&!Gm.has(V)&&(_[v]=V)}return _}const Bg=["color","backgroundColor","borderColor","fontSize","fontWeight","fontFamily","lineHeight","letterSpacing","textAlign","width","height","padding","margin","border","borderRadius","display","position","top","right","bottom","left","zIndex","flexDirection","justifyContent","alignItems","gap","opacity","visibility","overflow","boxShadow","transform"];function su(u){if(typeof window>"u")return"";const d=window.getComputedStyle(u),_=[];for(const c of Bg){const b=c.replace(/([A-Z])/g,"-$1").toLowerCase(),v=d.getPropertyValue(b);v&&!Gm.has(v)&&_.push(`${b}: ${v}`)}return _.join("; ")}function Dg(u){if(!u)return;const d={},_=u.split(";").map(c=>c.trim()).filter(Boolean);for(const c of _){const b=c.indexOf(":");if(b>0){const v=c.slice(0,b).trim(),E=c.slice(b+1).trim();v&&E&&(d[v]=E)}}return Object.keys(d).length>0?d:void 0}function iu(u){const d=[],_=u.getAttribute("role"),c=u.getAttribute("aria-label"),b=u.getAttribute("aria-describedby"),v=u.getAttribute("tabindex"),E=u.getAttribute("aria-hidden");return _&&d.push(`role="${_}"`),c&&d.push(`aria-label="${c}"`),b&&d.push(`aria-describedby="${b}"`),v&&d.push(`tabindex=${v}`),E==="true"&&d.push("aria-hidden"),u.matches("a, button, input, select, textarea, [tabindex]")&&d.push("focusable"),d.join(", ")}function uu(u){const d=[];let _=u;for(;_&&_.tagName.toLowerCase()!=="html";){const c=_.tagName.toLowerCase();let b=c;if(_.id)b=`${c}#${_.id}`;else if(_.className&&typeof _.className=="string"){const E=_.className.split(/\s+/).map(V=>V.replace(/[_][a-zA-Z0-9]{5,}.*$/,"")).find(V=>V.length>2);E&&(b=`${c}.${E}`)}const v=Do(_);!_.parentElement&&v&&(b=`⟨shadow⟩ ${b}`),d.unshift(b),_=v}return d.join(" > ")}const Lr="feedback-annotations-",$m=7;function mu(u){return`${Lr}${u}`}function Cr(u){if(typeof window>"u")return[];try{const d=localStorage.getItem(mu(u));if(!d)return[];const _=JSON.parse(d),c=Date.now()-$m*24*60*60*1e3;return _.filter(b=>!b.timestamp||b.timestamp>c)}catch{return[]}}function qm(u,d){if(!(typeof window>"u"))try{localStorage.setItem(mu(u),JSON.stringify(d))}catch{}}function Rg(){const u=new Map;if(typeof window>"u")return u;try{const d=Date.now()-$m*24*60*60*1e3;for(let _=0;_<localStorage.length;_++){const c=localStorage.key(_);if(c?.startsWith(Lr)){const b=c.slice(Lr.length),v=localStorage.getItem(c);if(v){const V=JSON.parse(v).filter(O=>!O.timestamp||O.timestamp>d);V.length>0&&u.set(b,V)}}}}catch{}return u}function Rs(u,d,_){const c=d.map(b=>({...b,_syncedTo:_}));qm(u,c)}const Yg="cluso-session-";function Ur(u){return`${Yg}${u}`}function Hg(u){if(typeof window>"u")return null;try{return localStorage.getItem(Ur(u))}catch{return null}}function jr(u,d){if(!(typeof window>"u"))try{localStorage.setItem(Ur(u),d)}catch{}}function Ug(u){if(!(typeof window>"u"))try{localStorage.removeItem(Ur(u))}catch{}}async function Nr(u,d){const _=await fetch(`${u}/sessions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:d})});if(!_.ok)throw new Error(`Failed to create session: ${_.status}`);return _.json()}async function Mm(u,d){const _=await fetch(`${u}/sessions/${d}`);if(!_.ok)throw new Error(`Failed to get session: ${_.status}`);return _.json()}async function cu(u,d,_){const c=await fetch(`${u}/sessions/${d}/annotations`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(_)});if(!c.ok)throw new Error(`Failed to sync annotation: ${c.status}`);return c.json()}async function Xg(u,d,_){const c=await fetch(`${u}/annotations/${d}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(_)});if(!c.ok)throw new Error(`Failed to update annotation: ${c.status}`);return c.json()}async function Om(u,d){const _=await fetch(`${u}/annotations/${d}`,{method:"DELETE"});if(!_.ok)throw new Error(`Failed to delete annotation: ${_.status}`)}const Ue={FunctionComponent:0,ClassComponent:1,IndeterminateComponent:2,HostRoot:3,HostPortal:4,HostComponent:5,HostText:6,Fragment:7,Mode:8,ContextConsumer:9,ContextProvider:10,ForwardRef:11,Profiler:12,SuspenseComponent:13,MemoComponent:14,SimpleMemoComponent:15,LazyComponent:16,IncompleteClassComponent:17,DehydratedFragment:18,SuspenseListComponent:19,ScopeComponent:21,OffscreenComponent:22,LegacyHiddenComponent:23,CacheComponent:24,TracingMarkerComponent:25,HostHoistable:26,HostSingleton:27,IncompleteFunctionComponent:28,Throw:29,ViewTransitionComponent:30,ActivityComponent:31},Lm=new Set(["Component","PureComponent","Fragment","Suspense","Profiler","StrictMode","Routes","Route","Outlet","Root","ErrorBoundaryHandler","HotReload","Hot"]),Bm=[/Boundary$/,/BoundaryHandler$/,/Provider$/,/Consumer$/,/^(Inner|Outer)/,/Router$/,/^Client(Page|Segment|Root)/,/^Server(Root|Component|Render)/,/^RSC/,/Context$/,/^Hot(Reload)?$/,/^(Dev|React)(Overlay|Tools|Root)/,/Overlay$/,/Handler$/,/^With[A-Z]/,/Wrapper$/,/^Root$/],Qg=[/Page$/,/View$/,/Screen$/,/Section$/,/Card$/,/List$/,/Item$/,/Form$/,/Modal$/,/Dialog$/,/Button$/,/Nav$/,/Header$/,/Footer$/,/Layout$/,/Panel$/,/Tab$/,/Menu$/];function Gg(u){const d=u?.mode??"filtered";let _=Lm;if(u?.skipExact){const c=u.skipExact instanceof Set?u.skipExact:new Set(u.skipExact);_=new Set([...Lm,...c])}return{maxComponents:u?.maxComponents??6,maxDepth:u?.maxDepth??30,mode:d,skipExact:_,skipPatterns:u?.skipPatterns?[...Bm,...u.skipPatterns]:Bm,userPatterns:u?.userPatterns??Qg,filter:u?.filter}}function $g(u){return u.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/([A-Z])([A-Z][a-z])/g,"$1-$2").toLowerCase()}function qg(u,d=10){const _=new Set;let c=u,b=0;for(;c&&b<d;)c.className&&typeof c.className=="string"&&c.className.split(/\s+/).forEach(v=>{if(v.length>1){const E=v.replace(/[_][a-zA-Z0-9]{5,}.*$/,"").toLowerCase();E.length>1&&_.add(E)}}),c=c.parentElement,b++;return _}function Zg(u,d){const _=$g(u);for(const c of d){if(c===_)return!0;const b=_.split("-").filter(E=>E.length>2),v=c.split("-").filter(E=>E.length>2);for(const E of b)for(const V of v)if(E===V||E.includes(V)||V.includes(E))return!0}return!1}function Vg(u,d,_,c){if(_.filter)return _.filter(u,d);switch(_.mode){case"all":return!0;case"filtered":return!(_.skipExact.has(u)||_.skipPatterns.some(b=>b.test(u)));case"smart":return _.skipExact.has(u)||_.skipPatterns.some(b=>b.test(u))?!1:!!(c&&Zg(u,c)||_.userPatterns.some(b=>b.test(u)));default:return!0}}let Oo=null;const Jg=new WeakMap;function Er(u){return Object.keys(u).some(d=>d.startsWith("__reactFiber$")||d.startsWith("__reactInternalInstance$")||d.startsWith("__reactProps$"))}function Kg(){if(Oo!==null)return Oo;if(typeof document>"u")return!1;if(document.body&&Er(document.body))return Oo=!0,!0;const u=["#root","#app","#__next","[data-reactroot]"];for(const d of u){const _=document.querySelector(d);if(_&&Er(_))return Oo=!0,!0}if(document.body){for(const d of document.body.children)if(Er(d))return Oo=!0,!0}return Oo=!1,!1}let Ys={map:Jg};function Wg(u){return Object.keys(u).find(_=>_.startsWith("__reactFiber$")||_.startsWith("__reactInternalInstance$"))||null}function Ig(u){const d=Wg(u);return d?u[d]:null}function Ua(u){return u?u.displayName?u.displayName:u.name?u.name:null:null}function Fg(u){const{tag:d,type:_,elementType:c}=u;if(d===Ue.HostComponent||d===Ue.HostText||d===Ue.HostHoistable||d===Ue.HostSingleton||d===Ue.Fragment||d===Ue.Mode||d===Ue.Profiler||d===Ue.DehydratedFragment||d===Ue.HostRoot||d===Ue.HostPortal||d===Ue.ScopeComponent||d===Ue.OffscreenComponent||d===Ue.LegacyHiddenComponent||d===Ue.CacheComponent||d===Ue.TracingMarkerComponent||d===Ue.Throw||d===Ue.ViewTransitionComponent||d===Ue.ActivityComponent)return null;if(d===Ue.ForwardRef){const b=c;if(b?.render){const v=Ua(b.render);if(v)return v}return b?.displayName?b.displayName:Ua(_)}if(d===Ue.MemoComponent||d===Ue.SimpleMemoComponent){const b=c;if(b?.type){const v=Ua(b.type);if(v)return v}return b?.displayName?b.displayName:Ua(_)}if(d===Ue.ContextProvider){const b=_;return b?._context?.displayName?`${b._context.displayName}.Provider`:null}if(d===Ue.ContextConsumer){const b=_;return b?.displayName?`${b.displayName}.Consumer`:null}if(d===Ue.LazyComponent){const b=c;return b?._status===1&&b._result?Ua(b._result):null}return d===Ue.SuspenseComponent||d===Ue.SuspenseListComponent?null:d===Ue.IncompleteClassComponent||d===Ue.IncompleteFunctionComponent||d===Ue.FunctionComponent||d===Ue.ClassComponent||d===Ue.IndeterminateComponent?Ua(_):null}function Pg(u){return u.length<=2||u.length<=3&&u===u.toLowerCase()}function ep(u,d){const _=Gg(d),c=_.mode==="all";if(c){const O=Ys.map.get(u);if(O!==void 0)return O}if(!Kg()){const O={path:null,components:[]};return c&&Ys.map.set(u,O),O}const b=_.mode==="smart"?qg(u):void 0,v=[];try{let O=Ig(u),A=0;for(;O&&A<_.maxDepth&&v.length<_.maxComponents;){const K=Fg(O);K&&!Pg(K)&&Vg(K,A,_,b)&&v.push(K),O=O.return,A++}}catch{const O={path:null,components:[]};return c&&Ys.map.set(u,O),O}if(v.length===0){const O={path:null,components:[]};return c&&Ys.map.set(u,O),O}const V={path:v.slice().reverse().map(O=>`<${O}>`).join(" "),components:v};return c&&Ys.map.set(u,V),V}const tp=`svg[fill=none] {
  fill: none !important;
}

@keyframes cw__enter___u8RRu {
  from {
    opacity: 0;
    transform: scale(0.5) rotate(90deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}
@keyframes cw__badgeIn___mVQLj {
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes cw__popIn___c-r1K {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes cw__popOut___Wctwz {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.85);
  }
}
@keyframes cw__riseUp___kgD36 {
  from {
    opacity: 0;
    transform: scale(0.85) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@keyframes cw__dropDown___zcdje {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.85) translateY(8px);
  }
}
@keyframes cw__dotIn___5FaAP {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.3);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
@keyframes cw__dotOut___GU5jX {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.3);
  }
}
@keyframes cw__show___b9qmf {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes cw__hide___6Ut6- {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes cw__tipIn___0N31w {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(2px) scale(0.891);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(0.909);
  }
}
@keyframes cw__ringIn___6WYHY {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes cw__hoverTipIn___FYGQx {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@keyframes cw__panelIn___MGfO8 {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    filter: blur(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0px);
  }
}
@keyframes cw__panelOut___Zfymi {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0px);
  }
  to {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    filter: blur(5px);
  }
}
.cw__root___wNsdK {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 328px;
  z-index: 100000;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  pointer-events: none;
  transition: left 0s, top 0s, right 0s, bottom 0s;
}

.cw__shell___dIhma {
  user-select: none;
  margin-left: auto;
  align-self: flex-end;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  color: #fff;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18), 0 4px 14px rgba(0, 0, 0, 0.09);
  pointer-events: auto;
  cursor: grab;
  transition: width 0.38s cubic-bezier(0.19, 1, 0.22, 1), transform 0.38s cubic-bezier(0.19, 1, 0.22, 1);
}
.cw__shell___dIhma.styles-module__dragging___xrolZ {
  transition: width 0.4s cubic-bezier(0.19, 1, 0.22, 1);
  cursor: grabbing;
}
.cw__shell___dIhma.styles-module__entrance___sgHd8 {
  animation: cw__enter___u8RRu 0.48s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
}
.cw__shell___dIhma.styles-module__collapsed___Rydsn {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  padding: 0;
  cursor: pointer;
}
.cw__shell___dIhma.styles-module__collapsed___Rydsn svg {
  margin-top: -1px;
}
.cw__shell___dIhma.styles-module__collapsed___Rydsn:hover {
  background: #2a2a2a;
}
.cw__shell___dIhma.styles-module__collapsed___Rydsn:active {
  transform: scale(0.95);
}
.cw__shell___dIhma.styles-module__expanded___ofKPx {
  height: 44px;
  border-radius: 1.4rem;
  padding: 0.35rem;
  width: 337px;
}
.cw__shell___dIhma.styles-module__expanded___ofKPx.styles-module__serverConnected___Gfbou {
  width: 328px;
}

.cw__toggle___0yfyP {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.1s cubic-bezier(0.19, 1, 0.22, 1);
}
.cw__toggle___0yfyP.styles-module__visible___KHwEW {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
.cw__toggle___0yfyP.styles-module__hidden___Ae8H4 {
  opacity: 0;
  pointer-events: none;
}

.cw__controls___9GJWU {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  transition: filter 0.8s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.8s cubic-bezier(0.19, 1, 0.22, 1), transform 0.6s cubic-bezier(0.19, 1, 0.22, 1);
}
.cw__controls___9GJWU.styles-module__visible___KHwEW {
  opacity: 1;
  filter: blur(0px);
  transform: scale(1);
  visibility: visible;
  pointer-events: auto;
}
.cw__controls___9GJWU.styles-module__hidden___Ae8H4 {
  pointer-events: none;
  opacity: 0;
  filter: blur(10px);
  transform: scale(0.4);
}

.styles-module__badge___2XsgF {
  position: absolute;
  top: -12px;
  right: -12px;
  user-select: none;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 8px;
  background: #3c82f7;
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  opacity: 1;
  transition: transform 0.3s ease, opacity 0.2s ease;
  transform: scale(1);
}
.styles-module__badge___2XsgF.cw__hide___6Ut6- {
  opacity: 0;
  transform: scale(0);
  pointer-events: none;
}
.styles-module__badge___2XsgF.styles-module__entrance___sgHd8 {
  animation: cw__badgeIn___mVQLj 0.3s cubic-bezier(0.34, 1.2, 0.64, 1) 0.4s both;
}

.cw__btn___8Q0jc {
  position: relative;
  cursor: pointer !important;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease, opacity 0.2s ease;
}
.cw__btn___8Q0jc:hover:not(:disabled):not([data-active=true]):not([data-failed=true]):not([data-auto-sync=true]):not([data-error=true]):not([data-no-hover=true]) {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.cw__btn___8Q0jc:active:not(:disabled) {
  transform: scale(0.92);
}
.cw__btn___8Q0jc:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.cw__btn___8Q0jc[data-active=true] {
  color: #3c82f7;
  background: rgba(60, 130, 247, 0.25);
}
.cw__btn___8Q0jc[data-error=true] {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.25);
}
.cw__btn___8Q0jc[data-danger]:hover:not(:disabled):not([data-active=true]):not([data-failed=true]) {
  background: rgba(255, 59, 48, 0.25);
  color: #ff3b30;
}
.cw__btn___8Q0jc[data-no-hover=true], .cw__btn___8Q0jc.styles-module__statusShowing___te6iu {
  cursor: default !important;
  pointer-events: none;
  background: transparent !important;
}
.cw__btn___8Q0jc[data-auto-sync=true] {
  color: #34c759;
  background: transparent;
  cursor: default;
}
.cw__btn___8Q0jc[data-failed=true] {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.25);
}

.styles-module__buttonBadge___NeFWb {
  position: absolute;
  top: 0px;
  right: 0px;
  min-width: 16px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: #3c82f7;
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px #1a1a1a, 0 1px 3px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}
.styles-module__buttonBadge___NeFWb.styles-module__light___r6n4Y {
  box-shadow: 0 0 0 2px #fff, 0 1px 3px rgba(0, 0, 0, 0.2);
}

@keyframes cw__pulseOn___EDodZ {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.5);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(52, 199, 89, 0);
  }
}
@keyframes cw__pulsePending___cCYte {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 166, 35, 0.5);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(245, 166, 35, 0);
  }
}
.styles-module__mcpIndicator___zGJeL {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 6px;
  height: 5px;
  border-radius: 50%;
  pointer-events: none;
  transition: background 0.3s ease, opacity 0.15s ease, transform 0.15s ease;
  opacity: 1;
  transform: scale(1);
}
.styles-module__mcpIndicator___zGJeL.styles-module__connected___7c28g {
  background: #34c759;
  animation: cw__pulseOn___EDodZ 2.5s ease-in-out infinite;
}
.styles-module__mcpIndicator___zGJeL.styles-module__connecting___uo-CW {
  background: #f5a623;
  animation: cw__pulsePending___cCYte 1.5s ease-in-out infinite;
}
.styles-module__mcpIndicator___zGJeL.styles-module__hidden___Ae8H4 {
  opacity: 0;
  transform: scale(0);
  animation: none;
}

@keyframes cw__connPulse___-Zycw {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.9);
  }
}
.styles-module__connectionIndicatorWrapper___L-e-3 {
  width: 8px;
  height: 34px;
  margin-left: 6px;
  margin-right: 6px;
}

.styles-module__connectionIndicator___afk9p {
  position: relative;
  width: 8px;
  height: 7px;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease, background 0.3s ease;
  cursor: default;
}

.styles-module__connectionIndicatorVisible___C-i5B {
  opacity: 1;
}

.styles-module__connectionIndicatorConnected___IY8pR {
  background: #34c759;
  animation: cw__connPulse___-Zycw 2.5s ease-in-out infinite;
}

.styles-module__connectionIndicatorDisconnected___kmpaZ {
  background: #ff3b30;
  animation: none;
}

.styles-module__connectionIndicatorConnecting___QmSLH {
  background: #f59e0b;
  animation: cw__connPulse___-Zycw 1s ease-in-out infinite;
}

.cw__btnWrap___rBcdv {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cw__btnWrap___rBcdv:hover .cw__tip___Burd9 {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) scale(1);
  transition-delay: 0.8s;
}
.cw__btnWrap___rBcdv:has(.cw__btn___8Q0jc:disabled):hover .cw__tip___Burd9 {
  opacity: 0;
  visibility: hidden;
}

.styles-module__sendButtonWrapper___UUxG6 {
  width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  margin-left: -0.375rem;
  transition: width 0.4s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s cubic-bezier(0.19, 1, 0.22, 1), margin 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}
.styles-module__sendButtonWrapper___UUxG6 .cw__btn___8Q0jc {
  transform: scale(0.8);
  transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}
.styles-module__sendButtonWrapper___UUxG6.styles-module__sendButtonVisible___WPSQU {
  width: 34px;
  opacity: 1;
  overflow: visible;
  pointer-events: auto;
  margin-left: 0;
}
.styles-module__sendButtonWrapper___UUxG6.styles-module__sendButtonVisible___WPSQU .cw__btn___8Q0jc {
  transform: scale(1);
}

.cw__tip___Burd9 {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%) scale(0.95);
  padding: 5px 10px;
  background: #1a1a1a;
  color: rgba(255, 255, 255, 0.9);
  font-size: 11.5px;
  font-weight: 500;
  border-radius: 8px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  z-index: 100001;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: opacity 0.135s ease, transform 0.135s ease, visibility 0.135s ease;
}
.cw__tip___Burd9::after {
  content: "";
  position: absolute;
  top: calc(100% - 4px);
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 8px;
  height: 7px;
  background: #1a1a1a;
  border-radius: 0 0 2px 0;
}

.styles-module__shortcut___lEAQk {
  margin-left: 4px;
  opacity: 0.5;
}

.styles-module__tooltipBelow___m6ats .cw__tip___Burd9 {
  bottom: auto;
  top: calc(100% + 14px);
  transform: translateX(-50%) scale(0.95);
}
.styles-module__tooltipBelow___m6ats .cw__tip___Burd9::after {
  top: -4px;
  bottom: auto;
  border-radius: 2px 0 0 0;
}

.styles-module__tooltipBelow___m6ats .cw__btnWrap___rBcdv:hover .cw__tip___Burd9 {
  transform: translateX(-50%) scale(1);
}

.styles-module__tooltipsHidden___VtLJG .cw__tip___Burd9 {
  opacity: 0 !important;
  visibility: hidden !important;
  transition: none !important;
}

.styles-module__tooltipVisible___0jcCv,
.styles-module__tooltipsHidden___VtLJG .styles-module__tooltipVisible___0jcCv {
  opacity: 1 !important;
  visibility: visible !important;
  transform: translateX(-50%) scale(1) !important;
  transition-delay: 0s !important;
}

.styles-module__buttonWrapperAlignLeft___myzIp .cw__tip___Burd9 {
  left: 50%;
  transform: translateX(-12px) scale(0.95);
}
.styles-module__buttonWrapperAlignLeft___myzIp .cw__tip___Burd9::after {
  left: 16px;
}
.styles-module__buttonWrapperAlignLeft___myzIp:hover .cw__tip___Burd9 {
  transform: translateX(-12px) scale(1);
}

.styles-module__tooltipBelow___m6ats .styles-module__buttonWrapperAlignLeft___myzIp .cw__tip___Burd9 {
  transform: translateX(-12px) scale(0.95);
}
.styles-module__tooltipBelow___m6ats .styles-module__buttonWrapperAlignLeft___myzIp:hover .cw__tip___Burd9 {
  transform: translateX(-12px) scale(1);
}

.styles-module__buttonWrapperAlignRight___HCQFR .cw__tip___Burd9 {
  left: 50%;
  transform: translateX(calc(-100% + 12px)) scale(0.95);
}
.styles-module__buttonWrapperAlignRight___HCQFR .cw__tip___Burd9::after {
  left: auto;
  right: 8px;
}
.styles-module__buttonWrapperAlignRight___HCQFR:hover .cw__tip___Burd9 {
  transform: translateX(calc(-100% + 12px)) scale(1);
}

.styles-module__tooltipBelow___m6ats .styles-module__buttonWrapperAlignRight___HCQFR .cw__tip___Burd9 {
  transform: translateX(calc(-100% + 12px)) scale(0.95);
}
.styles-module__tooltipBelow___m6ats .styles-module__buttonWrapperAlignRight___HCQFR:hover .cw__tip___Burd9 {
  transform: translateX(calc(-100% + 12px)) scale(1);
}

.styles-module__divider___c--s1 {
  width: 1px;
  height: 11px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 0.125rem;
}

.cw__mask___Q1O9y {
  position: fixed;
  inset: 0;
  z-index: 99997;
  pointer-events: none;
}
.cw__mask___Q1O9y > * {
  pointer-events: auto;
}

.cw__ring___ogakW {
  position: fixed;
  border: 2px solid rgba(60, 130, 247, 0.5);
  border-radius: 4px;
  pointer-events: none !important;
  background: rgba(60, 130, 247, 0.04);
  box-sizing: border-box;
  will-change: opacity;
  contain: layout style;
}
.cw__ring___ogakW.styles-module__enter___WFIki {
  animation: cw__ringIn___6WYHY 0.12s ease-out forwards;
}

.styles-module__multiSelectOutline___cSJ-m {
  position: fixed;
  border: 2px dashed rgba(52, 199, 89, 0.6);
  border-radius: 4px;
  pointer-events: none !important;
  background: rgba(52, 199, 89, 0.05);
  box-sizing: border-box;
  will-change: opacity;
}
.styles-module__multiSelectOutline___cSJ-m.styles-module__enter___WFIki {
  animation: cw__show___b9qmf 0.15s ease-out forwards;
}
.styles-module__multiSelectOutline___cSJ-m.styles-module__exit___fyOJ0 {
  animation: cw__hide___6Ut6- 0.15s ease-out forwards;
}

.styles-module__singleSelectOutline___QhX-O {
  position: fixed;
  border: 2px solid rgba(60, 130, 247, 0.6);
  border-radius: 4px;
  pointer-events: none !important;
  background: rgba(60, 130, 247, 0.05);
  box-sizing: border-box;
  will-change: opacity;
}
.styles-module__singleSelectOutline___QhX-O.styles-module__enter___WFIki {
  animation: cw__show___b9qmf 0.15s ease-out forwards;
}
.styles-module__singleSelectOutline___QhX-O.styles-module__exit___fyOJ0 {
  animation: cw__hide___6Ut6- 0.15s ease-out forwards;
}

.cw__hoverTip___bvLk7 {
  position: fixed;
  font-size: 0.7rem;
  font-weight: 500;
  color: #fff;
  background: rgba(0, 0, 0, 0.85);
  padding: 0.35rem 0.6rem;
  border-radius: 0.4rem;
  pointer-events: none !important;
  white-space: nowrap;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cw__hoverTip___bvLk7.styles-module__enter___WFIki {
  animation: cw__hoverTipIn___FYGQx 0.1s ease-out forwards;
}

.styles-module__hoverReactPath___gx1IJ {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 0.14rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.styles-module__hoverElementName___QMLMl {
  overflow: hidden;
  text-overflow: ellipsis;
}

.cw__dotsLayer___-25j1 {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0;
  z-index: 99998;
  pointer-events: none;
}
.cw__dotsLayer___-25j1 > * {
  pointer-events: auto;
}

.cw__fixedDots___ffyX6 {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99998;
  pointer-events: none;
}
.cw__fixedDots___ffyX6 > * {
  pointer-events: auto;
}

.cw__dot___6sQrs {
  position: absolute;
  width: 22px;
  height: 21px;
  background: #3c82f7;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(0, 0, 0, 0.04);
  user-select: none;
  will-change: transform, opacity;
  contain: layout style;
  z-index: 1;
}
.cw__dot___6sQrs:hover {
  z-index: 2;
}
.cw__dot___6sQrs:not(.styles-module__enter___WFIki):not(.styles-module__exit___fyOJ0):not(.styles-module__clearing___FQ--7) {
  transition: background-color 0.15s ease, transform 0.1s ease;
}
.cw__dot___6sQrs.styles-module__enter___WFIki {
  animation: cw__dotIn___5FaAP 0.24s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.cw__dot___6sQrs.styles-module__exit___fyOJ0 {
  animation: cw__dotOut___GU5jX 0.2s ease-out both;
  pointer-events: none;
}
.cw__dot___6sQrs.styles-module__clearing___FQ--7 {
  animation: cw__dotOut___GU5jX 0.15s ease-out both;
  pointer-events: none;
}
.cw__dot___6sQrs:not(.styles-module__enter___WFIki):not(.styles-module__exit___fyOJ0):not(.styles-module__clearing___FQ--7):hover {
  transform: translate(-50%, -50%) scale(1.1);
}
.cw__dot___6sQrs.styles-module__pending___2IHLC {
  position: fixed;
  background: #3c82f7;
}
.cw__dot___6sQrs.styles-module__fixed___dBMHC {
  position: fixed;
}
.cw__dot___6sQrs.styles-module__multiSelect___YWiuz {
  background: #34c759;
  width: 26px;
  height: 25px;
  border-radius: 6px;
  font-size: 0.78rem;
}
.cw__dot___6sQrs.styles-module__multiSelect___YWiuz.styles-module__pending___2IHLC {
  background: #34c759;
}
.cw__dot___6sQrs.styles-module__hovered___ZgXIy {
  background: #ff3b30;
}

.styles-module__renumber___nCTxD {
  display: block;
  animation: cw__numRoll___Wgbq3 0.2s ease-out;
}

@keyframes cw__numRoll___Wgbq3 {
  0% {
    transform: translateX(-40%);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}
.styles-module__markerTooltip___aLJID {
  position: absolute;
  top: calc(100% + 9px);
  left: 50%;
  transform: translateX(-50%) scale(0.909);
  z-index: 100002;
  background: #1a1a1a;
  padding: 7px 0.75rem;
  border-radius: 0.7rem;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-weight: 400;
  color: #fff;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.07);
  min-width: 116px;
  max-width: 200px;
  pointer-events: none;
  cursor: default;
}
.styles-module__markerTooltip___aLJID.styles-module__enter___WFIki {
  animation: cw__tipIn___0N31w 0.1s ease-out forwards;
}

.styles-module__markerQuote___FHmrz {
  display: block;
  font-size: 11.5px;
  font-style: italic;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 0.32rem;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.styles-module__markerNote___QkrrS {
  display: block;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.4;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-bottom: 2px;
}

.styles-module__markerHint___2iF-6 {
  display: block;
  font-size: 0.65rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.36rem;
  white-space: nowrap;
}

.cw__panel___OxX3Y {
  position: absolute;
  right: 5px;
  bottom: calc(100% + 0.45rem);
  z-index: 1;
  overflow: hidden;
  background: #1c1c1c;
  border-radius: 0.9rem;
  padding: 12px 0 15px;
  min-width: 210px;
  cursor: default;
  opacity: 1;
  box-shadow: 0 1px 7px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.05);
  transition: background 0.25s ease, box-shadow 0.25s ease;
}
.cw__panel___OxX3Y::before, .cw__panel___OxX3Y::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 16px;
  z-index: 2;
  pointer-events: none;
}
.cw__panel___OxX3Y::before {
  left: 0;
  background: linear-gradient(to right, #1c1c1c 0%, transparent 100%);
}
.cw__panel___OxX3Y::after {
  right: 0;
  background: linear-gradient(to left, #1c1c1c 0%, transparent 100%);
}
.cw__panel___OxX3Y .styles-module__settingsHeader___pwDY9,
.cw__panel___OxX3Y .styles-module__settingsBrand___0gJeM,
.cw__panel___OxX3Y .styles-module__settingsBrandSlash___uTG18,
.cw__panel___OxX3Y .styles-module__settingsVersion___TUcFq,
.cw__panel___OxX3Y .styles-module__settingsSection___m-YM2,
.cw__panel___OxX3Y .styles-module__settingsLabel___8UjfX,
.cw__panel___OxX3Y .styles-module__cycleButton___FMKfw,
.cw__panel___OxX3Y .styles-module__cycleDot___nPgLY,
.cw__panel___OxX3Y .styles-module__dropdownButton___16NPz,
.cw__panel___OxX3Y .styles-module__toggleLabel___Xm8Aa,
.cw__panel___OxX3Y .styles-module__customCheckbox___U39ax,
.cw__panel___OxX3Y .styles-module__sliderLabel___U8sPr,
.cw__panel___OxX3Y .styles-module__slider___GLdxp,
.cw__panel___OxX3Y .styles-module__helpIcon___xQg56,
.cw__panel___OxX3Y .styles-module__themeToggle___2rUjA {
  transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
}
.cw__panel___OxX3Y.styles-module__enter___WFIki {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0px);
  transition: opacity 0.2s ease, transform 0.2s ease, filter 0.2s ease;
}
.cw__panel___OxX3Y.styles-module__exit___fyOJ0 {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
  filter: blur(5px);
  pointer-events: none;
  transition: opacity 0.1s ease, transform 0.1s ease, filter 0.1s ease;
}
.cw__panel___OxX3Y.styles-module__dark___ILIQf {
  background: #1a1a1a;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.07);
}
.cw__panel___OxX3Y.styles-module__dark___ILIQf .styles-module__settingsLabel___8UjfX {
  color: rgba(255, 255, 255, 0.6);
}
.cw__panel___OxX3Y.styles-module__dark___ILIQf .styles-module__settingsOption___UNa12 {
  color: rgba(255, 255, 255, 0.85);
}
.cw__panel___OxX3Y.styles-module__dark___ILIQf .styles-module__settingsOption___UNa12:hover {
  background: rgba(255, 255, 255, 0.1);
}
.cw__panel___OxX3Y.styles-module__dark___ILIQf .styles-module__settingsOption___UNa12.styles-module__selected___OwRqP {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}
.cw__panel___OxX3Y.styles-module__dark___ILIQf .styles-module__toggleLabel___Xm8Aa {
  color: rgba(255, 255, 255, 0.85);
}

.styles-module__settingsPanelContainer___Xksv8 {
  overflow: visible;
  position: relative;
  display: flex;
  padding: 0 1rem;
}
.styles-module__settingsPanelContainer___Xksv8.styles-module__transitioning___qxzCk {
  overflow-x: clip;
  overflow-y: visible;
}

.styles-module__settingsPage___6YfHH {
  min-width: 100%;
  flex-shrink: 0;
  transition: transform 0.33s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-out;
  opacity: 1;
}

.styles-module__settingsPage___6YfHH.styles-module__slideLeft___Ps01J {
  transform: translateX(-100%);
  opacity: 0;
}

.styles-module__automationsPage___uvCq6 {
  position: absolute;
  top: 0;
  left: 100%;
  width: 100%;
  height: 100%;
  padding: 3px 1rem 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  transition: transform 0.33s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out 0.1s;
  opacity: 0;
}

.styles-module__automationsPage___uvCq6.styles-module__slideIn___4-qXe {
  transform: translateX(-100%);
  opacity: 1;
}

.styles-module__settingsNavLink___wCzJt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: color 0.15s ease;
}
.styles-module__settingsNavLink___wCzJt:hover {
  color: rgba(255, 255, 255, 0.9);
}
.styles-module__settingsNavLink___wCzJt.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__settingsNavLink___wCzJt.styles-module__light___r6n4Y:hover {
  color: rgba(0, 0, 0, 0.8);
}
.styles-module__settingsNavLink___wCzJt svg {
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.15s ease;
}
.styles-module__settingsNavLink___wCzJt:hover svg {
  color: #fff;
}
.styles-module__settingsNavLink___wCzJt.styles-module__light___r6n4Y svg {
  color: rgba(0, 0, 0, 0.25);
}
.styles-module__settingsNavLink___wCzJt.styles-module__light___r6n4Y:hover svg {
  color: rgba(0, 0, 0, 0.8);
}

.styles-module__settingsNavLinkRight___ZWwhj {
  display: flex;
  align-items: center;
  gap: 6px;
}

.styles-module__mcpNavIndicator___cl9pO {
  width: 8px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.styles-module__mcpNavIndicator___cl9pO.styles-module__connected___7c28g {
  background: #34c759;
  animation: cw__mcpBeat___uNggr 2.5s ease-in-out infinite;
}
.styles-module__mcpNavIndicator___cl9pO.styles-module__connecting___uo-CW {
  background: #f5a623;
  animation: cw__mcpBeat___uNggr 1.5s ease-in-out infinite;
}

.styles-module__settingsBackButton___bIe2j {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 0 12px 0;
  margin: -6px 0 0.5rem 0;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 0;
  background: transparent;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: -0.15px;
  color: #fff;
  cursor: pointer;
  transition: transform 0.12s cubic-bezier(0.32, 0.72, 0, 1);
}
.styles-module__settingsBackButton___bIe2j svg {
  opacity: 0.4;
  flex-shrink: 0;
  transition: opacity 0.15s ease, transform 0.18s cubic-bezier(0.32, 0.72, 0, 1);
}
.styles-module__settingsBackButton___bIe2j:hover svg {
  opacity: 1;
}
.styles-module__settingsBackButton___bIe2j.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.85);
  border-bottom-color: rgba(0, 0, 0, 0.08);
}

.styles-module__automationHeader___InP0r {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.8rem;
  font-weight: 400;
  color: #fff;
}
.styles-module__automationHeader___InP0r .styles-module__helpIcon___xQg56 svg {
  transform: none;
}
.styles-module__automationHeader___InP0r.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.85);
}

.styles-module__automationDescription___NKlmo {
  font-size: 0.7rem;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
  line-height: 13px;
}
.styles-module__automationDescription___NKlmo.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.5);
}

.styles-module__learnMoreLink___8xv-x {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: underline dotted;
  text-decoration-color: rgba(255, 255, 255, 0.2);
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}
.styles-module__learnMoreLink___8xv-x:hover {
  color: #fff;
}
.styles-module__learnMoreLink___8xv-x.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.6);
  text-decoration-color: rgba(0, 0, 0, 0.2);
}
.styles-module__learnMoreLink___8xv-x.styles-module__light___r6n4Y:hover {
  color: rgba(0, 0, 0, 0.85);
}

.styles-module__autoSendRow___UblX5 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.styles-module__autoSendLabel___icDc2 {
  font-size: 0.7rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.15s ease;
}
.styles-module__autoSendLabel___icDc2.styles-module__active___-zoN6 {
  color: #66b8ff;
}
.styles-module__autoSendLabel___icDc2.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__autoSendLabel___icDc2.styles-module__light___r6n4Y.styles-module__active___-zoN6 {
  color: #3c82f7;
}

.styles-module__webhookUrlInput___2375C {
  display: block;
  width: 100%;
  flex: 1;
  min-height: 56px;
  box-sizing: border-box;
  margin-top: 11px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 400;
  color: #fff;
  outline: none;
  resize: none;
  cursor: text !important;
  user-select: text;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.styles-module__webhookUrlInput___2375C::placeholder {
  color: rgba(255, 255, 255, 0.3);
}
.styles-module__webhookUrlInput___2375C:focus {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
}
.styles-module__webhookUrlInput___2375C.styles-module__light___r6n4Y {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.03);
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__webhookUrlInput___2375C.styles-module__light___r6n4Y::placeholder {
  color: rgba(0, 0, 0, 0.3);
}
.styles-module__webhookUrlInput___2375C.styles-module__light___r6n4Y:focus {
  border-color: rgba(0, 0, 0, 0.25);
  background: rgba(0, 0, 0, 0.05);
}

.styles-module__settingsHeader___pwDY9 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  margin-bottom: 0.5rem;
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.styles-module__settingsBrand___0gJeM {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #fff;
}

.styles-module__settingsBrandSlash___uTG18 {
  color: rgba(255, 255, 255, 0.5);
}

.styles-module__settingsVersion___TUcFq {
  font-size: 10.5px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
  margin-left: auto;
  letter-spacing: -0.01em;
}

.styles-module__settingsSection___m-YM2 + .styles-module__settingsSection___m-YM2 {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}
.styles-module__settingsSection___m-YM2.styles-module__settingsSectionExtraPadding___jdhFV {
  padding-top: calc(0.5rem + 4px);
}

.styles-module__settingsSectionGrow___h-5HZ {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.styles-module__settingsRow___3sdhc {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
}
.styles-module__settingsRow___3sdhc.styles-module__settingsRowMarginTop___zA0Sp {
  margin-top: 8px;
}

.styles-module__dropdownContainer___BVnxe {
  position: relative;
}

.styles-module__dropdownButton___16NPz {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.22rem 0.5rem;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  letter-spacing: -0.01em;
}
.styles-module__dropdownButton___16NPz:hover {
  background: rgba(255, 255, 255, 0.08);
}
.styles-module__dropdownButton___16NPz svg {
  opacity: 0.6;
}

.styles-module__cycleButton___FMKfw {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  letter-spacing: -0.01em;
}
.styles-module__cycleButton___FMKfw.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__cycleButton___FMKfw:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.styles-module__settingsRowDisabled___EgS0V .styles-module__settingsLabel___8UjfX {
  color: rgba(255, 255, 255, 0.2);
}
.styles-module__settingsRowDisabled___EgS0V .styles-module__settingsLabel___8UjfX.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.2);
}
.styles-module__settingsRowDisabled___EgS0V .styles-module__toggleSwitch___l4Ygm {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes cw__cycleIn___Q6zJf {
  0% {
    opacity: 0;
    transform: translateY(-6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.styles-module__cycleButtonText___fD1LR {
  display: inline-block;
  animation: cw__cycleIn___Q6zJf 0.2s ease-out;
}

.styles-module__cycleDots___LWuoQ {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.styles-module__cycleDot___nPgLY {
  width: 3px;
  height: 2.5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: scale(0.667);
  transition: background-color 0.25s ease-out, transform 0.25s ease-out;
}
.styles-module__cycleDot___nPgLY.styles-module__active___-zoN6 {
  background: #fff;
  transform: scale(1);
}
.styles-module__cycleDot___nPgLY.styles-module__light___r6n4Y {
  background: rgba(0, 0, 0, 0.2);
}
.styles-module__cycleDot___nPgLY.styles-module__light___r6n4Y.styles-module__active___-zoN6 {
  background: rgba(0, 0, 0, 0.7);
}

.styles-module__dropdownMenu___k73ER {
  position: absolute;
  right: 0;
  top: calc(100% + 0.22rem);
  background: #1a1a1a;
  border-radius: 0.5rem;
  padding: 0.22rem;
  min-width: 116px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
  z-index: 10;
  animation: cw__popIn___c-r1K 0.15s ease-out;
}

.styles-module__dropdownItem___ylsLj {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, color 0.15s ease;
  letter-spacing: -0.01em;
}
.styles-module__dropdownItem___ylsLj:hover {
  background: rgba(255, 255, 255, 0.08);
}
.styles-module__dropdownItem___ylsLj.styles-module__selected___OwRqP {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-weight: 600;
}

.styles-module__settingsLabel___8UjfX {
  font-size: 0.8rem;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 0.15rem;
}
.styles-module__settingsLabel___8UjfX.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.5);
}

.styles-module__settingsLabelMarker___ewdtV {
  padding-top: 3px;
  margin-bottom: 10px;
}

.styles-module__settingsOptions___LyrBA {
  display: flex;
  gap: 0.22rem;
}

.styles-module__settingsOption___UNa12 {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.22rem;
  padding: 0.35rem 0.5rem;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  font-size: 0.7rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.7);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.styles-module__settingsOption___UNa12:hover {
  background: rgba(0, 0, 0, 0.05);
}
.styles-module__settingsOption___UNa12.styles-module__selected___OwRqP {
  background: rgba(60, 130, 247, 0.15);
  color: #3c82f7;
}

.styles-module__sliderContainer___ducXj {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.styles-module__slider___GLdxp {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3.5px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.styles-module__slider___GLdxp::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 13px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.styles-module__slider___GLdxp::-moz-range-thumb {
  width: 14px;
  height: 13px;
  background: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.styles-module__slider___GLdxp:hover::-webkit-slider-thumb {
  transform: scale(1.15);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}
.styles-module__slider___GLdxp:hover::-moz-range-thumb {
  transform: scale(1.15);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.styles-module__sliderLabels___FhLDB {
  display: flex;
  justify-content: space-between;
}

.styles-module__sliderLabel___U8sPr {
  font-size: 0.65rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: color 0.15s ease;
}
.styles-module__sliderLabel___U8sPr:hover {
  color: rgba(255, 255, 255, 0.7);
}
.styles-module__sliderLabel___U8sPr.styles-module__active___-zoN6 {
  color: rgba(255, 255, 255, 0.9);
}

.styles-module__colorOptions___iHCNX {
  display: flex;
  gap: 0.45rem;
  margin-top: 0.36rem;
  margin-bottom: 1px;
}

.styles-module__colorOption___IodiY {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}
.styles-module__colorOption___IodiY:hover {
  transform: scale(1.15);
}
.styles-module__colorOption___IodiY.styles-module__selected___OwRqP {
  transform: scale(0.83);
}

.styles-module__colorOptionRing___U2xpo {
  display: flex;
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 50%;
  transition: border-color 0.3s ease;
}
.styles-module__settingsToggle___fBrFn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
}
.styles-module__settingsToggle___fBrFn + .styles-module__settingsToggle___fBrFn {
  margin-top: calc(0.5rem + 6px);
}
.styles-module__settingsToggle___fBrFn input[type=checkbox] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.styles-module__settingsToggle___fBrFn.styles-module__settingsToggleMarginBottom___MZUyF {
  margin-bottom: calc(0.5rem + 6px);
}

.styles-module__customCheckbox___U39ax {
  position: relative;
  width: 14px;
  height: 13px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.25s ease, border-color 0.25s ease;
}
.styles-module__customCheckbox___U39ax svg {
  color: #1a1a1a;
  opacity: 1;
  transition: opacity 0.15s ease;
}
input[type=checkbox]:checked + .styles-module__customCheckbox___U39ax {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgb(255, 255, 255);
}
.styles-module__customCheckbox___U39ax.styles-module__light___r6n4Y {
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
}
.styles-module__customCheckbox___U39ax.styles-module__light___r6n4Y.styles-module__checked___mnZLo {
  border-color: #1a1a1a;
  background: #1a1a1a;
}
.styles-module__customCheckbox___U39ax.styles-module__light___r6n4Y.styles-module__checked___mnZLo svg {
  color: #fff;
}

.styles-module__toggleLabel___Xm8Aa {
  font-size: 0.8rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 0.22rem;
}
.styles-module__toggleLabel___Xm8Aa.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.5);
}

.styles-module__toggleSwitch___l4Ygm {
  position: relative;
  display: inline-block;
  width: 24px;
  height: 15px;
  flex-shrink: 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.styles-module__toggleSwitch___l4Ygm input {
  opacity: 0;
  width: 0;
  height: 0;
}
.styles-module__toggleSwitch___l4Ygm input:checked + .styles-module__toggleSlider___wprIn {
  background: #3c82f7;
}
.styles-module__toggleSwitch___l4Ygm input:checked + .styles-module__toggleSlider___wprIn::before {
  transform: translateX(8px);
}
.styles-module__toggleSwitch___l4Ygm.styles-module__disabled___332Jw {
  opacity: 0.4;
  pointer-events: none;
}
.styles-module__toggleSwitch___l4Ygm.styles-module__disabled___332Jw .styles-module__toggleSlider___wprIn {
  cursor: not-allowed;
}

.styles-module__toggleSlider___wprIn {
  position: absolute;
  cursor: pointer;
  inset: 0;
  border-radius: 15px;
  background: #484848;
}
.styles-module__light___r6n4Y .styles-module__toggleSlider___wprIn {
  background: #dddddd;
}
.styles-module__toggleSlider___wprIn::before {
  content: "";
  position: absolute;
  height: 11px;
  width: 12px;
  left: 2px;
  bottom: 2px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

@keyframes cw__mcpBeat___uNggr {
  0% {
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.5);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(52, 199, 89, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
  }
}
@keyframes cw__mcpError___fov9B {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.5);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(255, 59, 48, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
  }
}
.styles-module__mcpStatusDot___ibgkc {
  width: 8px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.styles-module__mcpStatusDot___ibgkc.styles-module__connecting___uo-CW {
  background: #f5a623;
  animation: cw__mcpBeat___uNggr 1.5s infinite;
}
.styles-module__mcpStatusDot___ibgkc.styles-module__connected___7c28g {
  background: #34c759;
  animation: cw__mcpBeat___uNggr 2.5s ease-in-out infinite;
}
.styles-module__mcpStatusDot___ibgkc.styles-module__disconnected___cHPxR {
  background: #ff3b30;
  animation: cw__mcpError___fov9B 2s infinite;
}

.styles-module__helpIcon___xQg56 {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  margin-left: 0;
}
.styles-module__helpIcon___xQg56 svg {
  display: block;
  transform: translateY(1px);
  color: rgba(255, 255, 255, 0.2);
  transition: color 0.15s ease;
}
.styles-module__helpIcon___xQg56:hover svg {
  color: rgba(255, 255, 255, 0.5);
}
.styles-module__helpIcon___xQg56.styles-module__helpIconNudgeDown___0cqpM svg {
  transform: translateY(1px);
}
.styles-module__helpIcon___xQg56.styles-module__helpIconNoNudge___abogC svg {
  transform: translateY(0.5px);
}
.styles-module__helpIcon___xQg56.styles-module__helpIconNudge1-5___DM2TQ svg {
  transform: translateY(1.5px);
}
.styles-module__helpIcon___xQg56.styles-module__helpIconNudge2___TfWgC svg {
  transform: translateY(2px);
}

.styles-module__dragSelection___kZLq2 {
  position: fixed;
  top: 0;
  left: 0;
  border: 2px solid rgba(52, 199, 89, 0.6);
  border-radius: 4px;
  background: rgba(52, 199, 89, 0.08);
  pointer-events: none;
  z-index: 99997;
  will-change: transform, width, height;
  contain: layout style;
}

.styles-module__dragCount___KM90j {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #34c759;
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.22rem 0.5rem;
  border-radius: 0.9rem;
  min-width: 1.5rem;
  text-align: center;
}

.styles-module__highlightsContainer___-0xzG {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 99996;
}

.styles-module__selectedElementHighlight___fyVlI {
  position: fixed;
  top: 0;
  left: 0;
  border: 2px solid rgba(52, 199, 89, 0.5);
  border-radius: 4px;
  background: rgba(52, 199, 89, 0.06);
  pointer-events: none;
  will-change: transform, width, height;
  contain: layout style;
}

.styles-module__light___r6n4Y.cw__shell___dIhma {
  background: #fff;
  color: rgba(0, 0, 0, 0.85);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04);
}
.styles-module__light___r6n4Y.cw__shell___dIhma.styles-module__collapsed___Rydsn:hover {
  background: #f5f5f5;
}
.styles-module__light___r6n4Y.cw__btn___8Q0jc {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___r6n4Y.cw__btn___8Q0jc:hover:not(:disabled):not([data-active=true]):not([data-failed=true]):not([data-auto-sync=true]):not([data-error=true]):not([data-no-hover=true]) {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.cw__btn___8Q0jc[data-active=true] {
  color: #3c82f7;
  background: rgba(60, 130, 247, 0.15);
}
.styles-module__light___r6n4Y.cw__btn___8Q0jc[data-error=true] {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.15);
}
.styles-module__light___r6n4Y.cw__btn___8Q0jc[data-danger]:hover:not(:disabled):not([data-active=true]):not([data-failed=true]) {
  background: rgba(255, 59, 48, 0.15);
  color: #ff3b30;
}
.styles-module__light___r6n4Y.cw__btn___8Q0jc[data-auto-sync=true] {
  color: #34c759;
  background: transparent;
}
.styles-module__light___r6n4Y.cw__btn___8Q0jc[data-failed=true] {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.15);
}
.styles-module__light___r6n4Y.cw__tip___Burd9 {
  background: #fff;
  color: rgba(0, 0, 0, 0.85);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04);
}
.styles-module__light___r6n4Y.cw__tip___Burd9::after {
  background: #fff;
}
.styles-module__light___r6n4Y.styles-module__divider___c--s1 {
  background: rgba(0, 0, 0, 0.1);
}
.styles-module__light___r6n4Y.styles-module__markerTooltip___aLJID {
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.styles-module__light___r6n4Y.styles-module__markerTooltip___aLJID .styles-module__markerQuote___FHmrz {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___r6n4Y.styles-module__markerTooltip___aLJID .styles-module__markerNote___QkrrS {
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.styles-module__markerTooltip___aLJID .styles-module__markerHint___2iF-6 {
  color: rgba(0, 0, 0, 0.35);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y::before {
  background: linear-gradient(to right, #fff 0%, transparent 100%);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y::after {
  background: linear-gradient(to left, #fff 0%, transparent 100%);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__settingsHeader___pwDY9 {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__settingsBrand___0gJeM {
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__settingsBrandSlash___uTG18 {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__settingsVersion___TUcFq {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__settingsSection___m-YM2 {
  border-top-color: rgba(0, 0, 0, 0.08);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__settingsLabel___8UjfX {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__cycleButton___FMKfw {
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__cycleDot___nPgLY {
  background: rgba(0, 0, 0, 0.2);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__cycleDot___nPgLY.styles-module__active___-zoN6 {
  background: rgba(0, 0, 0, 0.7);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__dropdownButton___16NPz {
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__dropdownButton___16NPz:hover {
  background: rgba(0, 0, 0, 0.05);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__toggleLabel___Xm8Aa {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__customCheckbox___U39ax {
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__customCheckbox___U39ax.styles-module__checked___mnZLo {
  border-color: #1a1a1a;
  background: #1a1a1a;
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__customCheckbox___U39ax.styles-module__checked___mnZLo svg {
  color: #fff;
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__sliderLabel___U8sPr {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__sliderLabel___U8sPr:hover {
  color: rgba(0, 0, 0, 0.7);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__sliderLabel___U8sPr.styles-module__active___-zoN6 {
  color: rgba(0, 0, 0, 0.9);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__slider___GLdxp {
  background: rgba(0, 0, 0, 0.1);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__slider___GLdxp::-webkit-slider-thumb {
  background: #1a1a1a;
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__slider___GLdxp::-moz-range-thumb {
  background: #1a1a1a;
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__helpIcon___xQg56 svg {
  color: rgba(0, 0, 0, 0.2);
}
.styles-module__light___r6n4Y.cw__panel___OxX3Y .styles-module__helpIcon___xQg56:hover svg {
  color: rgba(0, 0, 0, 0.5);
}

.styles-module__themeToggle___2rUjA {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 21px;
  margin-left: 0.48rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.styles-module__themeToggle___2rUjA:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}
.styles-module__light___r6n4Y .styles-module__themeToggle___2rUjA {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___r6n4Y .styles-module__themeToggle___2rUjA:hover {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.7);
}

.styles-module__themeIconWrapper___LsJIM {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 20px;
  height: 20px;
}

.styles-module__themeIcon___lCCmo {
  display: flex;
  align-items: center;
  justify-content: center;
  animation: cw__themeSwap___TU6ML 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes cw__themeSwap___TU6ML {
  0% {
    opacity: 0;
    transform: scale(0.8) rotate(-30deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}





.cw__glassDark___cwGD {
  background: rgba(10, 10, 14, 0.35) !important;
  backdrop-filter: blur(60px) saturate(1.8) brightness(0.9) !important;
  -webkit-backdrop-filter: blur(60px) saturate(1.8) brightness(0.9) !important;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.07) !important;
}
.cw__glassLight___cwGL {
  background: rgba(255, 255, 255, 0.35) !important;
  backdrop-filter: blur(60px) saturate(1.5) !important;
  -webkit-backdrop-filter: blur(60px) saturate(1.5) !important;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.65) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255,255,255,0.85) !important;
}
[data-glass=light] .cw__shell___dIhma .cw__btn___8Q0jc {
  color: rgba(0, 0, 0, 0.6);
}
[data-glass=light] .cw__shell___dIhma .cw__btn___8Q0jc:hover:not(:disabled):not([data-active=true]):not([data-failed=true]):not([data-auto-sync=true]):not([data-error=true]):not([data-no-hover=true]) {
  background: rgba(0, 0, 0, 0.07);
  color: rgba(0, 0, 0, 0.85);
}
[data-glass=light] .styles-module__divider___c--s1 {
  background: rgba(0, 0, 0, 0.12);
}
[data-glass=dark] .cw__panel___OxX3Y,
[data-glass=light] .cw__panel___OxX3Y {
  backdrop-filter: blur(60px) saturate(1.8) brightness(0.9) !important;
  -webkit-backdrop-filter: blur(60px) saturate(1.8) brightness(0.9) !important;
}
[data-glass=dark] .cw__panel___OxX3Y {
  background: rgba(10, 10, 14, 0.35) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.07) !important;
}
[data-glass=light] .cw__panel___OxX3Y {
  background: rgba(255, 255, 255, 0.35) !important;
  backdrop-filter: blur(60px) saturate(1.5) !important;
  -webkit-backdrop-filter: blur(60px) saturate(1.5) !important;
  border: 1px solid rgba(255, 255, 255, 0.65) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255,255,255,0.85) !important;
}
[data-glass] .cw__panel___OxX3Y::before,
[data-glass] .cw__panel___OxX3Y::after {
  display: none;
}`,h={toolbar:"cw__root___wNsdK",toolbarContainer:"cw__shell___dIhma",dragging:"styles-module__dragging___xrolZ",entrance:"styles-module__entrance___sgHd8",toolbarEnter:"cw__enter___u8RRu",collapsed:"styles-module__collapsed___Rydsn",expanded:"styles-module__expanded___ofKPx",serverConnected:"styles-module__serverConnected___Gfbou",toggleContent:"cw__toggle___0yfyP",visible:"styles-module__visible___KHwEW",hidden:"styles-module__hidden___Ae8H4",controlsContent:"cw__controls___9GJWU",badge:"styles-module__badge___2XsgF",fadeOut:"cw__hide___6Ut6-",badgeEnter:"cw__badgeIn___mVQLj",controlButton:"cw__btn___8Q0jc",statusShowing:"styles-module__statusShowing___te6iu",buttonBadge:"styles-module__buttonBadge___NeFWb",light:"styles-module__light___r6n4Y",mcpIndicator:"styles-module__mcpIndicator___zGJeL",connected:"styles-module__connected___7c28g",mcpIndicatorPulseConnected:"cw__pulseOn___EDodZ",connecting:"styles-module__connecting___uo-CW",mcpIndicatorPulseConnecting:"cw__pulsePending___cCYte",connectionIndicatorWrapper:"styles-module__connectionIndicatorWrapper___L-e-3",connectionIndicator:"styles-module__connectionIndicator___afk9p",connectionIndicatorVisible:"styles-module__connectionIndicatorVisible___C-i5B",connectionIndicatorConnected:"styles-module__connectionIndicatorConnected___IY8pR",connectionPulse:"cw__connPulse___-Zycw",connectionIndicatorDisconnected:"styles-module__connectionIndicatorDisconnected___kmpaZ",connectionIndicatorConnecting:"styles-module__connectionIndicatorConnecting___QmSLH",buttonWrapper:"cw__btnWrap___rBcdv",buttonTooltip:"cw__tip___Burd9",sendButtonWrapper:"styles-module__sendButtonWrapper___UUxG6",sendButtonVisible:"styles-module__sendButtonVisible___WPSQU",shortcut:"styles-module__shortcut___lEAQk",tooltipBelow:"styles-module__tooltipBelow___m6ats",tooltipsSuppressed:"styles-module__tooltipsHidden___VtLJG",tooltipVisible:"styles-module__tooltipVisible___0jcCv",buttonWrapperAlignLeft:"styles-module__buttonWrapperAlignLeft___myzIp",buttonWrapperAlignRight:"styles-module__buttonWrapperAlignRight___HCQFR",divider:"styles-module__divider___c--s1",overlay:"cw__mask___Q1O9y",hoverHighlight:"cw__ring___ogakW",enter:"styles-module__enter___WFIki",hoverHighlightIn:"cw__ringIn___6WYHY",multiSelectOutline:"styles-module__multiSelectOutline___cSJ-m",fadeIn:"cw__show___b9qmf",exit:"styles-module__exit___fyOJ0",singleSelectOutline:"styles-module__singleSelectOutline___QhX-O",hoverTooltip:"cw__hoverTip___bvLk7",hoverTooltipIn:"cw__hoverTipIn___FYGQx",hoverReactPath:"styles-module__hoverReactPath___gx1IJ",hoverElementName:"styles-module__hoverElementName___QMLMl",markersLayer:"cw__dotsLayer___-25j1",fixedMarkersLayer:"cw__fixedDots___ffyX6",marker:"cw__dot___6sQrs",clearing:"styles-module__clearing___FQ--7",markerIn:"cw__dotIn___5FaAP",markerOut:"cw__dotOut___GU5jX",pending:"styles-module__pending___2IHLC",fixed:"styles-module__fixed___dBMHC",multiSelect:"styles-module__multiSelect___YWiuz",hovered:"styles-module__hovered___ZgXIy",renumber:"styles-module__renumber___nCTxD",renumberRoll:"cw__numRoll___Wgbq3",markerTooltip:"styles-module__markerTooltip___aLJID",tooltipIn:"cw__tipIn___0N31w",markerQuote:"styles-module__markerQuote___FHmrz",markerNote:"styles-module__markerNote___QkrrS",markerHint:"styles-module__markerHint___2iF-6",settingsPanel:"cw__panel___OxX3Y",settingsHeader:"styles-module__settingsHeader___pwDY9",settingsBrand:"styles-module__settingsBrand___0gJeM",settingsBrandSlash:"styles-module__settingsBrandSlash___uTG18",settingsVersion:"styles-module__settingsVersion___TUcFq",settingsSection:"styles-module__settingsSection___m-YM2",settingsLabel:"styles-module__settingsLabel___8UjfX",cycleButton:"styles-module__cycleButton___FMKfw",cycleDot:"styles-module__cycleDot___nPgLY",dropdownButton:"styles-module__dropdownButton___16NPz",toggleLabel:"styles-module__toggleLabel___Xm8Aa",customCheckbox:"styles-module__customCheckbox___U39ax",sliderLabel:"styles-module__sliderLabel___U8sPr",slider:"styles-module__slider___GLdxp",helpIcon:"styles-module__helpIcon___xQg56",themeToggle:"styles-module__themeToggle___2rUjA",dark:"styles-module__dark___ILIQf",settingsOption:"styles-module__settingsOption___UNa12",selected:"styles-module__selected___OwRqP",settingsPanelContainer:"styles-module__settingsPanelContainer___Xksv8",transitioning:"styles-module__transitioning___qxzCk",activePage:"styles-module__settingsPage___6YfHH",slideLeft:"styles-module__slideLeft___Ps01J",automationsPage:"styles-module__automationsPage___uvCq6",slideIn:"styles-module__slideIn___4-qXe",settingsNavLink:"styles-module__settingsNavLink___wCzJt",settingsNavLinkRight:"styles-module__settingsNavLinkRight___ZWwhj",mcpNavIndicator:"styles-module__mcpNavIndicator___cl9pO",mcpPulse:"cw__mcpBeat___uNggr",settingsBackButton:"styles-module__settingsBackButton___bIe2j",automationHeader:"styles-module__automationHeader___InP0r",automationDescription:"styles-module__automationDescription___NKlmo",learnMoreLink:"styles-module__learnMoreLink___8xv-x",autoSendRow:"styles-module__autoSendRow___UblX5",autoSendLabel:"styles-module__autoSendLabel___icDc2",active:"styles-module__active___-zoN6",webhookUrlInput:"styles-module__webhookUrlInput___2375C",settingsSectionExtraPadding:"styles-module__settingsSectionExtraPadding___jdhFV",settingsSectionGrow:"styles-module__settingsSectionGrow___h-5HZ",settingsRow:"styles-module__settingsRow___3sdhc",settingsRowMarginTop:"styles-module__settingsRowMarginTop___zA0Sp",dropdownContainer:"styles-module__dropdownContainer___BVnxe",settingsRowDisabled:"styles-module__settingsRowDisabled___EgS0V",toggleSwitch:"styles-module__toggleSwitch___l4Ygm",cycleButtonText:"styles-module__cycleButtonText___fD1LR",cycleTextIn:"cw__cycleIn___Q6zJf",cycleDots:"styles-module__cycleDots___LWuoQ",dropdownMenu:"styles-module__dropdownMenu___k73ER",scaleIn:"cw__popIn___c-r1K",dropdownItem:"styles-module__dropdownItem___ylsLj",settingsLabelMarker:"styles-module__settingsLabelMarker___ewdtV",settingsOptions:"styles-module__settingsOptions___LyrBA",sliderContainer:"styles-module__sliderContainer___ducXj",sliderLabels:"styles-module__sliderLabels___FhLDB",colorOptions:"styles-module__colorOptions___iHCNX",colorOption:"styles-module__colorOption___IodiY",colorOptionRing:"styles-module__colorOptionRing___U2xpo",settingsToggle:"styles-module__settingsToggle___fBrFn",settingsToggleMarginBottom:"styles-module__settingsToggleMarginBottom___MZUyF",checked:"styles-module__checked___mnZLo",toggleSlider:"styles-module__toggleSlider___wprIn",disabled:"styles-module__disabled___332Jw",mcpStatusDot:"styles-module__mcpStatusDot___ibgkc",disconnected:"styles-module__disconnected___cHPxR",mcpPulseError:"cw__mcpError___fov9B",helpIconNudgeDown:"styles-module__helpIconNudgeDown___0cqpM",helpIconNoNudge:"styles-module__helpIconNoNudge___abogC","helpIconNudge1-5":"styles-module__helpIconNudge1-5___DM2TQ",helpIconNudge2:"styles-module__helpIconNudge2___TfWgC",dragSelection:"styles-module__dragSelection___kZLq2",dragCount:"styles-module__dragCount___KM90j",highlightsContainer:"styles-module__highlightsContainer___-0xzG",selectedElementHighlight:"styles-module__selectedElementHighlight___fyVlI",themeIconWrapper:"styles-module__themeIconWrapper___LsJIM",themeIcon:"styles-module__themeIcon___lCCmo",themeIconIn:"cw__themeSwap___TU6ML",glassDark:"cw__glassDark___cwGD",glassLight:"cw__glassLight___cwGL",scaleOut:"cw__popOut___Wctwz",slideUp:"cw__riseUp___kgD36",slideDown:"cw__dropDown___zcdje",settingsPanelIn:"cw__panelIn___MGfO8",settingsPanelOut:"cw__panelOut___Zfymi"};if(typeof document<"u"){let u=document.getElementById("cluso-styles-toolbar");u||(u=document.createElement("style"),u.id="cluso-styles-toolbar",u.textContent=tp,document.head.appendChild(u))}function ru(u,d="filtered"){const{name:_,path:c}=_u(u);if(d==="off")return{name:_,elementName:_,path:c,reactComponents:null};const b=ep(u,{mode:d});return{name:b.path?`${b.path} ${_}`:_,elementName:_,path:c,reactComponents:b.path}}let Dm=!1;const Rm={outputDetail:"standard",autoClearAfterCopy:!1,annotationColor:"#3c82f7",glassify:!1,blockInteractions:!0,reactEnabled:!0,markerClickBehavior:"edit",webhookUrl:"",webhooksEnabled:!0},Lo=u=>{if(!u||!u.trim())return!1;try{const d=new URL(u.trim());return d.protocol==="http:"||d.protocol==="https:"}catch{return!1}},np={compact:"off",standard:"filtered",detailed:"smart",forensic:"all"},Hs=[{value:"compact",label:"Light"},{value:"standard",label:"Standard"},{value:"detailed",label:"Detailed"},{value:"forensic",label:"Full"}],lp=[{value:"#AF52DE",label:"Purple"},{value:"#3c82f7",label:"Blue"},{value:"#5AC8FA",label:"Cyan"},{value:"#34C759",label:"Green"},{value:"#FFD60A",label:"Yellow"},{value:"#FF9500",label:"Orange"},{value:"#FF3B30",label:"Red"}],Bo=2;function Xa(u,d){let _=document.elementFromPoint(u,d);if(!_)return null;for(;_?.shadowRoot;){const c=_.shadowRoot.elementFromPoint(u,d);if(!c||c===_)break;_=c}return _}function Tr(u){let d=u;for(;d&&d!==document.body;){const c=window.getComputedStyle(d).position;if(c==="fixed"||c==="sticky")return!0;d=d.parentElement}return!1}function Ym(u,d,_="standard",c="filtered"){if(u.length===0)return"";const b=typeof window<"u"?`${window.innerWidth}×${window.innerHeight}`:"unknown";let v=`## Page Feedback: ${d}
`;return _==="forensic"?(v+=`
**Environment:**
`,v+=`- Viewport: ${b}
`,typeof window<"u"&&(v+=`- URL: ${window.location.href}
`,v+=`- User Agent: ${navigator.userAgent}
`,v+=`- Timestamp: ${new Date().toISOString()}
`,v+=`- Device Pixel Ratio: ${window.devicePixelRatio}
`),v+=`
---
`):_!=="compact"&&(v+=`**Viewport:** ${b}
`),v+=`
`,u.forEach((E,V)=>{_==="compact"?(v+=`${V+1}. **${E.element}**: ${E.comment}`,E.selectedText&&(v+=` (re: "${E.selectedText.slice(0,30)}${E.selectedText.length>30?"...":""}")`),v+=`
`):_==="forensic"?(v+=`### ${V+1}. ${E.element}
`,E.isMultiSelect&&E.fullPath&&(v+=`*Forensic data shown for first element of selection*
`),E.fullPath&&(v+=`**Full DOM Path:** ${E.fullPath}
`),E.cssClasses&&(v+=`**CSS Classes:** ${E.cssClasses}
`),E.boundingBox&&(v+=`**Position:** x:${Math.round(E.boundingBox.x)}, y:${Math.round(E.boundingBox.y)} (${Math.round(E.boundingBox.width)}×${Math.round(E.boundingBox.height)}px)
`),v+=`**Annotation at:** ${E.x.toFixed(1)}% from left, ${Math.round(E.y)}px from top
`,E.selectedText&&(v+=`**Selected text:** "${E.selectedText}"
`),E.nearbyText&&!E.selectedText&&(v+=`**Context:** ${E.nearbyText.slice(0,100)}
`),E.computedStyles&&(v+=`**Computed Styles:** ${E.computedStyles}
`),E.accessibility&&(v+=`**Accessibility:** ${E.accessibility}
`),E.nearbyElements&&(v+=`**Nearby Elements:** ${E.nearbyElements}
`),E.reactComponents&&(v+=`**React:** ${E.reactComponents}
`),v+=`**Feedback:** ${E.comment}

`):(v+=`### ${V+1}. ${E.element}
`,v+=`**Location:** ${E.elementPath}
`,E.reactComponents&&(v+=`**React:** ${E.reactComponents}
`),_==="detailed"&&(E.cssClasses&&(v+=`**Classes:** ${E.cssClasses}
`),E.boundingBox&&(v+=`**Position:** ${Math.round(E.boundingBox.x)}px, ${Math.round(E.boundingBox.y)}px (${Math.round(E.boundingBox.width)}×${Math.round(E.boundingBox.height)}px)
`)),E.selectedText&&(v+=`**Selected text:** "${E.selectedText}"
`),_==="detailed"&&E.nearbyText&&!E.selectedText&&(v+=`**Context:** ${E.nearbyText.slice(0,100)}
`),v+=`**Feedback:** ${E.comment}

`)}),v.trim()}function Zm({demoAnnotations:u,demoDelay:d=1e3,enableDemoMode:_=!1,runtimeMode:c="default",showToolbar:b=!0,hideCollapsedToolbar:v=!1,active:E,onActiveChange:V,visibleControls:O,onAnnotationAdd:A,onAnnotationDelete:K,onAnnotationUpdate:Z,onAnnotationsClear:pe,onCopy:he,onSubmit:Re,submitButtonLabel:ye,copyToClipboard:Ot=!0,endpoint:ee,sessionId:Gt,onSessionCreated:ct,webhookUrl:et}={}){const[ft,tt]=N.useState(!1),q=E??ft,rt=c==="embedded-release",Tt=v||rt,on=ye??(rt?"Send to App":"Send Annotations"),at=N.useCallback(f=>{const m=typeof f=="function"?f(q):f;E===void 0&&tt(m),V?.(m)},[E,q,V]),[oe,Ie]=N.useState([]),[_t,kt]=N.useState(!0),[z,U]=N.useState(!1),[J,Ae]=N.useState(!1),[ne,p]=N.useState(null),[S,H]=N.useState({x:0,y:0}),[B,le]=N.useState(null),[ge,Te]=N.useState(!1),[Fe,Ze]=N.useState("idle"),[$,we]=N.useState(!1),[yn,$n]=N.useState(!1),[Kt,ua]=N.useState(null),[ca,al]=N.useState(null),[Ro,ol]=N.useState([]),[Qa,Ga]=N.useState(null),[$a,Xs]=N.useState(null),[ie,Ml]=N.useState(null),[qa,bn]=N.useState(null),[ra,sl]=N.useState([]),[qn,Qs]=N.useState(0),[Gs,Ol]=N.useState(!1),[Oe,Zn]=N.useState(!1),[ot,$s]=N.useState(!1),[il,da]=N.useState(!1),[Za,fa]=N.useState(!1),dt={pause:O?.pause??!0,markers:O?.markers??!0,copy:O?.copy??!0,send:O?.send??!0,clear:O?.clear??!0,settings:O?.settings??!0,inspector:O?.inspector??!0,exit:O?.exit??!0};N.useEffect(()=>{(!b||!dt.settings)&&da(!1)},[dt.settings,b]);const[Ve,_a]=N.useState(!1),[Vn,Jn]=N.useState(null),[Kn,ul]=N.useState(!1),[cl,Yo]=N.useState("main"),[Ho,Uo]=N.useState(!1),[qs,ma]=N.useState(!1),[st,rl]=N.useState([]),sn=N.useRef({cmd:!1,shift:!1}),it=()=>{ma(!0)},zt=()=>{ma(!1)},At=({content:f,children:m})=>{const[M,Y]=N.useState(!1),[k,Q]=N.useState(!1),[I,F]=N.useState(!1),[_e,de]=N.useState({top:0,right:0}),se=N.useRef(null),re=N.useRef(null),fe=N.useRef(null),ce=()=>{if(se.current){const Qe=se.current.getBoundingClientRect();de({top:Qe.top+Qe.height/2,right:window.innerWidth-Qe.left+8})}},te=()=>{Y(!0),F(!0),fe.current&&(clearTimeout(fe.current),fe.current=null),ce(),re.current=Le(()=>{Q(!0)},500)},Ft=()=>{Y(!1),re.current&&(clearTimeout(re.current),re.current=null),Q(!1),fe.current=Le(()=>{F(!1)},150)};return N.useEffect(()=>()=>{re.current&&clearTimeout(re.current),fe.current&&clearTimeout(fe.current)},[]),s.jsxs(s.Fragment,{children:[s.jsx("span",{ref:se,onMouseEnter:te,onMouseLeave:Ft,children:m}),I&&kr.createPortal(s.jsx("div",{"data-cluso-toolbar":!0,style:{position:"fixed",top:_e.top,right:_e.right,transform:"translateY(-50%)",padding:"6px 10px",background:"#383838",color:"rgba(255, 255, 255, 0.7)",fontSize:"11px",fontWeight:400,lineHeight:"14px",borderRadius:"10px",width:"180px",textAlign:"left",zIndex:100020,pointerEvents:"none",boxShadow:"0px 1px 8px rgba(0, 0, 0, 0.28)",opacity:k&&!Ho?1:0,transition:"opacity 0.15s ease"},children:f}),document.body)]})},[G,Rn]=N.useState(Rm),[be,Zs]=N.useState(!0),[Xo,Ll]=N.useState(!1),ha=Lo(G.webhookUrl)||Lo(et||""),xn=!!Re||ha,un=typeof window<"u"&&(window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1"||window.location.hostname==="0.0.0.0"||window.location.hostname.endsWith(".local")),$t=un&&G.reactEnabled?np[G.outputDetail]:"off",[vt,mt]=N.useState(Gt??null),Qo=N.useRef(!1),[Lt,Vt]=N.useState(ee?"connecting":"disconnected"),[Xe,Go]=N.useState(null),[vn,$o]=N.useState(!1),[Bl,ga]=N.useState(null),[Va,Yn]=N.useState(0),qt=N.useRef(!1),[qo,pa]=N.useState(new Set),[Ja,ya]=N.useState(new Set),[Wn,Ka]=N.useState(!1),[Wt,In]=N.useState(!1),[Sn,ba]=N.useState(!1),It=N.useRef(null),cn=N.useRef(null),Dl=N.useRef(null),wn=N.useRef(null),Wa=N.useRef(!1),Zo=N.useRef(0),xa=N.useRef(null),Ia=N.useRef(null),Vo=8,hu=50,va=N.useRef(null),Cn=N.useRef(null),dl=N.useRef(null),Ye=typeof window<"u"?window.location.pathname:"/";N.useEffect(()=>{if(il)fa(!0);else{ma(!1),Yo("main");const f=Le(()=>fa(!1),0);return()=>clearTimeout(f)}},[il]),N.useEffect(()=>{Uo(!0);const f=Le(()=>Uo(!1),350);return()=>clearTimeout(f)},[cl]);const fl=q&&_t;N.useEffect(()=>{if(fl){Ae(!1),U(!0),pa(new Set);const f=Le(()=>{pa(m=>{const M=new Set(m);return oe.forEach(Y=>M.add(Y.id)),M})},350);return()=>clearTimeout(f)}else if(z){Ae(!0);const f=Le(()=>{U(!1),Ae(!1)},250);return()=>clearTimeout(f)}},[fl]),N.useEffect(()=>{Zn(!0),Qs(window.scrollY);const f=Cr(Ye);Ie(f),Dm||(Ll(!0),Dm=!0,Le(()=>Ll(!1),750));try{const m=localStorage.getItem("feedback-toolbar-settings");m&&Rn({...Rm,...JSON.parse(m)})}catch{}try{const m=localStorage.getItem("feedback-toolbar-theme");m!==null&&Zs(m==="dark")}catch{}try{const m=localStorage.getItem("feedback-toolbar-position");if(m){const M=JSON.parse(m);typeof M.x=="number"&&typeof M.y=="number"&&Go(M)}}catch{}},[Ye]),N.useEffect(()=>{Oe&&localStorage.setItem("feedback-toolbar-settings",JSON.stringify(G))},[G,Oe]),N.useEffect(()=>{Oe&&localStorage.setItem("feedback-toolbar-theme",be?"dark":"light")},[be,Oe]);const _l=N.useRef(!1);N.useEffect(()=>{const f=_l.current;_l.current=vn,f&&!vn&&Xe&&Oe&&localStorage.setItem("feedback-toolbar-position",JSON.stringify(Xe))},[vn,Xe,Oe]),N.useEffect(()=>{if(!ee||!Oe||Qo.current)return;Qo.current=!0,Vt("connecting"),(async()=>{try{const m=Hg(Ye),M=Gt||m;let Y=!1;if(M)try{const k=await Mm(ee,M);mt(k.id),Vt("connected"),jr(Ye,k.id),Y=!0;const Q=Cr(Ye),I=new Set(k.annotations.map(_e=>_e.id)),F=Q.filter(_e=>!I.has(_e.id));if(F.length>0){const de=`${typeof window<"u"?window.location.origin:""}${Ye}`,re=(await Promise.allSettled(F.map(ce=>cu(ee,k.id,{...ce,sessionId:k.id,url:de})))).map((ce,te)=>ce.status==="fulfilled"?ce.value:(console.warn("[Cluso] Failed to sync annotation:",ce.reason),F[te])),fe=[...k.annotations,...re];Ie(fe),Rs(Ye,fe,k.id)}else Ie(k.annotations),Rs(Ye,k.annotations,k.id)}catch(k){console.warn("[Cluso] Could not join session, creating new:",k),Ug(Ye)}if(!Y){const k=typeof window<"u"?window.location.href:"/",Q=await Nr(ee,k);mt(Q.id),Vt("connected"),jr(Ye,Q.id),ct?.(Q.id);const I=Rg(),F=typeof window<"u"?window.location.origin:"",_e=[];for(const[de,se]of I){const re=se.filter(te=>!te._syncedTo);if(re.length===0)continue;const fe=`${F}${de}`,ce=de===Ye;_e.push((async()=>{try{const te=ce?Q:await Nr(ee,fe),Qe=(await Promise.allSettled(re.map(Rt=>cu(ee,te.id,{...Rt,sessionId:te.id,url:fe})))).map((Rt,wt)=>Rt.status==="fulfilled"?Rt.value:(console.warn("[Cluso] Failed to sync annotation:",Rt.reason),re[wt]));if(Rs(de,Qe,te.id),ce){const Rt=new Set(re.map(wt=>wt.id));Ie(wt=>{const Pt=wt.filter(Ce=>!Rt.has(Ce.id));return[...Qe,...Pt]})}}catch(te){console.warn(`[Cluso] Failed to sync annotations for ${de}:`,te)}})())}await Promise.allSettled(_e)}}catch(m){Vt("disconnected"),console.warn("[Cluso] Failed to initialize session, using local storage:",m)}})()},[ee,Gt,Oe,ct,Ye]),N.useEffect(()=>{if(!ee||!Oe)return;const f=async()=>{try{(await fetch(`${ee}/health`)).ok?Vt("connected"):Vt("disconnected")}catch{Vt("disconnected")}};f();const m=e1(f,1e4);return()=>clearInterval(m)},[ee,Oe]),N.useEffect(()=>{if(!ee||!Oe||!vt)return;const f=new EventSource(`${ee}/sessions/${vt}/events`),m=["resolved","dismissed"],M=Y=>{try{const k=JSON.parse(Y.data);if(m.includes(k.payload?.status)){const Q=k.payload.id;ya(I=>new Set(I).add(Q)),Le(()=>{Ie(I=>I.filter(F=>F.id!==Q)),ya(I=>{const F=new Set(I);return F.delete(Q),F})},150)}}catch{}};return f.addEventListener("annotation.updated",M),()=>{f.removeEventListener("annotation.updated",M),f.close()}},[ee,Oe,vt]),N.useEffect(()=>{if(!ee||!Oe)return;const f=Ia.current==="disconnected",m=Lt==="connected";Ia.current=Lt,f&&m&&(async()=>{try{const Y=Cr(Ye);if(Y.length===0)return;const Q=`${typeof window<"u"?window.location.origin:""}${Ye}`;let I=vt,F=[];if(I)try{F=(await Mm(ee,I)).annotations}catch{I=null}I||(I=(await Nr(ee,Q)).id,mt(I),jr(Ye,I));const _e=new Set(F.map(se=>se.id)),de=Y.filter(se=>!_e.has(se.id));if(de.length>0){const re=(await Promise.allSettled(de.map(ce=>cu(ee,I,{...ce,sessionId:I,url:Q})))).map((ce,te)=>ce.status==="fulfilled"?ce.value:(console.warn("[Cluso] Failed to sync annotation on reconnect:",ce.reason),de[te])),fe=[...F,...re];Ie(fe),Rs(Ye,fe,I)}}catch(Y){console.warn("[Cluso] Failed to sync on reconnect:",Y)}})()},[Lt,ee,Oe,vt,Ye]),N.useEffect(()=>{if(!_||!Oe||!u||u.length===0||oe.length>0)return;const f=[];return f.push(Le(()=>{at(!0)},d-200)),u.forEach((m,M)=>{const Y=d+M*300;f.push(Le(()=>{const k=document.querySelector(m.selector);if(!k)return;const Q=k.getBoundingClientRect(),{name:I,path:F}=_u(k),_e={id:`demo-${Date.now()}-${M}`,x:(Q.left+Q.width/2)/window.innerWidth*100,y:Q.top+Q.height/2+window.scrollY,comment:m.comment,element:I,elementPath:F,timestamp:Date.now(),selectedText:m.selectedText,boundingBox:{x:Q.left,y:Q.top+window.scrollY,width:Q.width,height:Q.height},nearbyText:Bs(k),cssClasses:Ds(k)};Ie(de=>[...de,_e])},Y))}),()=>{f.forEach(clearTimeout)}},[_,Oe,u,d]),N.useEffect(()=>{const f=()=>{Qs(window.scrollY),Ol(!0),dl.current&&clearTimeout(dl.current),dl.current=Le(()=>{Ol(!1)},150)};return window.addEventListener("scroll",f,{passive:!0}),()=>{window.removeEventListener("scroll",f),dl.current&&clearTimeout(dl.current)}},[]),N.useEffect(()=>{Oe&&oe.length>0?vt?Rs(Ye,oe,vt):qm(Ye,oe):Oe&&oe.length===0&&localStorage.removeItem(mu(Ye))},[oe,Ye,Oe,vt]);const Jo=N.useCallback(()=>{ot||(n1(),$s(!0))},[ot]),Rl=N.useCallback(()=>{ot&&(Cm(),$s(!1))},[ot]),Fa=N.useCallback(()=>{ot?Rl():Jo()},[ot,Jo,Rl]),Yl=N.useCallback(()=>{if(Ve||st.length===0)return;const f=st[0],m=f.element,M=st.length>1,Y=st.map(k=>k.element.getBoundingClientRect());if(M){const k={left:Math.min(...Y.map(te=>te.left)),top:Math.min(...Y.map(te=>te.top)),right:Math.max(...Y.map(te=>te.right)),bottom:Math.max(...Y.map(te=>te.bottom))},Q=st.slice(0,5).map(te=>te.name).join(", "),I=st.length>5?` +${st.length-5} more`:"",F=Y.map(te=>({x:te.left,y:te.top+window.scrollY,width:te.width,height:te.height})),de=st[st.length-1].element,se=Y[Y.length-1],re=se.left+se.width/2,fe=se.top+se.height/2,ce=Tr(de);le({x:re/window.innerWidth*100,y:ce?fe:fe+window.scrollY,clientY:fe,element:`${st.length} elements: ${Q}${I}`,elementPath:"multi-select",boundingBox:{x:k.left,y:k.top+window.scrollY,width:k.right-k.left,height:k.bottom-k.top},isMultiSelect:!0,isFixed:ce,elementBoundingBoxes:F,multiSelectElements:st.map(te=>te.element),targetElement:de,fullPath:uu(m),accessibility:iu(m),computedStyles:su(m),computedStylesObj:ou(m),nearbyElements:au(m),cssClasses:Ds(m),nearbyText:Bs(m)})}else{const k=Y[0],Q=Tr(m);le({x:k.left/window.innerWidth*100,y:Q?k.top:k.top+window.scrollY,clientY:k.top,element:f.name,elementPath:f.path,boundingBox:{x:k.left,y:Q?k.top:k.top+window.scrollY,width:k.width,height:k.height},isFixed:Q,fullPath:uu(m),accessibility:iu(m),computedStyles:su(m),computedStylesObj:ou(m),nearbyElements:au(m),cssClasses:Ds(m),nearbyText:Bs(m),reactComponents:f.reactComponents})}rl([]),p(null)},[st,Ve]);N.useEffect(()=>{q||(le(null),Ml(null),bn(null),sl([]),p(null),da(!1),rl([]),sn.current={cmd:!1,shift:!1},Jn(null),ul(!1),ot&&Rl())},[q,ot,Rl]),N.useEffect(()=>()=>{Cm()},[]),N.useEffect(()=>{if(!q)return;const f=document.createElement("style");return f.id="cluso-cursor-styles",f.textContent=`
      body * {
        cursor: crosshair !important;
      }
      body p, body span, body h1, body h2, body h3, body h4, body h5, body h6,
      body li, body td, body th, body label, body blockquote, body figcaption,
      body caption, body legend, body dt, body dd, body pre, body code,
      body em, body strong, body b, body i, body u, body s, body a,
      body time, body address, body cite, body q, body abbr, body dfn,
      body mark, body small, body sub, body sup, body [contenteditable],
      body p *, body span *, body h1 *, body h2 *, body h3 *, body h4 *,
      body h5 *, body h6 *, body li *, body a *, body label *, body pre *,
      body code *, body blockquote *, body [contenteditable] * {
        cursor: text !important;
      }
      [data-cluso-toolbar], [data-cluso-toolbar] * {
        cursor: default !important;
      }
      [data-cluso-toolbar] textarea,
      [data-cluso-toolbar] input[type="text"],
      [data-cluso-toolbar] input[type="url"] {
        cursor: text !important;
      }
      [data-cluso-toolbar] button,
      [data-cluso-toolbar] button *,
      [data-cluso-toolbar] label,
      [data-cluso-toolbar] label *,
      [data-cluso-toolbar] a,
      [data-cluso-toolbar] a *,
      [data-cluso-toolbar] [role="button"],
      [data-cluso-toolbar] [role="button"] * {
        cursor: pointer !important;
      }
      [data-cluso-marker], [data-cluso-marker] * {
        cursor: pointer !important;
      }
    `,document.head.appendChild(f),()=>{const m=document.getElementById("cluso-cursor-styles");m&&m.remove()}},[q]),N.useEffect(()=>{if(!q||B)return;const f=m=>{const M=m.composedPath()[0]||m.target;if(Qt(M,"[data-cluso-toolbar]")){p(null),Ve&&!Kn&&Jn(null);return}const Y=Xa(m.clientX,m.clientY);if(!Y||Qt(Y,"[data-cluso-toolbar]")){p(null),Ve&&!Kn&&Jn(null);return}const{name:k,elementName:Q,path:I,reactComponents:F}=ru(Y,$t),_e=Y.getBoundingClientRect();p({element:k,elementName:Q,elementPath:I,rect:_e,reactComponents:F}),H({x:m.clientX,y:m.clientY}),Ve&&!Kn&&Jn({element:Y,name:Q,reactComponents:F})};return document.addEventListener("mousemove",f),()=>document.removeEventListener("mousemove",f)},[q,B,$t,Ve,Kn]),N.useEffect(()=>{if(!q)return;const f=m=>{if(Wa.current){Wa.current=!1;return}const M=m.composedPath()[0]||m.target;if(Ve){if(Qt(M,"[data-cluso-inspector-panel]")||m.clientX>window.innerWidth-285||Qt(M,"[data-cluso-toolbar]"))return;const Qe=Xa(m.clientX,m.clientY);if(!Qe||Qt(Qe,"[data-cluso-toolbar]"))return;m.preventDefault(),m.stopPropagation();const{name:Rt,reactComponents:wt}=ru(Qe,$t);Jn({element:Qe,name:Rt,reactComponents:wt}),ul(!0);return}if(Qt(M,"[data-cluso-toolbar]")||Qt(M,"[data-cluso-popup]")||Qt(M,"[data-cluso-marker]"))return;if(m.metaKey&&m.shiftKey&&!B&&!ie){m.preventDefault(),m.stopPropagation();const Qe=Xa(m.clientX,m.clientY);if(!Qe)return;const Rt=Qe.getBoundingClientRect(),{name:wt,path:Pt,reactComponents:Ce}=ru(Qe,$t),Se=st.findIndex(yt=>yt.element===Qe);Se>=0?rl(yt=>yt.filter((ht,Pn)=>Pn!==Se)):rl(yt=>[...yt,{element:Qe,rect:Rt,name:wt,path:Pt,reactComponents:Ce??void 0}]);return}const Y=Qt(M,"button, a, input, select, textarea, [role='button'], [onclick]");if(G.blockInteractions&&Y&&(m.preventDefault(),m.stopPropagation()),B){if(Y&&!G.blockInteractions)return;m.preventDefault(),va.current?.shake();return}if(ie){if(Y&&!G.blockInteractions)return;m.preventDefault(),Cn.current?.shake();return}m.preventDefault();const k=Xa(m.clientX,m.clientY);if(!k)return;const{name:Q,path:I,reactComponents:F}=ru(k,$t),_e=k.getBoundingClientRect(),de=m.clientX/window.innerWidth*100;if(Ve){Jn({element:k,name:Q,reactComponents:F}),ul(!0);return}const se=Tr(k),re=se?m.clientY:m.clientY+window.scrollY,fe=window.getSelection();let ce;fe&&fe.toString().trim().length>0&&(ce=fe.toString().trim().slice(0,500));const te=ou(k),Ft=su(k);le({x:de,y:re,clientY:m.clientY,element:Q,elementPath:I,selectedText:ce,boundingBox:{x:_e.left,y:se?_e.top:_e.top+window.scrollY,width:_e.width,height:_e.height},nearbyText:Bs(k),cssClasses:Ds(k),isFixed:se,fullPath:uu(k),accessibility:iu(k),computedStyles:Ft,computedStylesObj:te,nearbyElements:au(k),reactComponents:F??void 0,targetElement:k}),p(null)};return document.addEventListener("click",f,!0),()=>document.removeEventListener("click",f,!0)},[q,B,ie,G.blockInteractions,$t,st,Ve,Kn]),N.useEffect(()=>{if(!q)return;const f=Y=>{Y.key==="Meta"&&(sn.current.cmd=!0),Y.key==="Shift"&&(sn.current.shift=!0)},m=Y=>{const k=sn.current.cmd&&sn.current.shift;Y.key==="Meta"&&(sn.current.cmd=!1),Y.key==="Shift"&&(sn.current.shift=!1);const Q=sn.current.cmd&&sn.current.shift;k&&!Q&&st.length>0&&Yl()},M=()=>{sn.current={cmd:!1,shift:!1},rl([])};return document.addEventListener("keydown",f),document.addEventListener("keyup",m),window.addEventListener("blur",M),()=>{document.removeEventListener("keydown",f),document.removeEventListener("keyup",m),window.removeEventListener("blur",M)}},[q,st,Yl]),N.useEffect(()=>{if(!q||B)return;const f=m=>{if(Ve)return;const M=m.composedPath()[0]||m.target;Qt(M,"[data-cluso-toolbar]")||Qt(M,"[data-cluso-marker]")||Qt(M,"[data-cluso-popup]")||new Set(["P","SPAN","H1","H2","H3","H4","H5","H6","LI","TD","TH","LABEL","BLOCKQUOTE","FIGCAPTION","CAPTION","LEGEND","DT","DD","PRE","CODE","EM","STRONG","B","I","U","S","A","TIME","ADDRESS","CITE","Q","ABBR","DFN","MARK","SMALL","SUB","SUP"]).has(M.tagName)||M.isContentEditable||(It.current={x:m.clientX,y:m.clientY})};return document.addEventListener("mousedown",f),()=>document.removeEventListener("mousedown",f)},[q,B,Ve]),N.useEffect(()=>{if(!q||B)return;const f=m=>{if(Ve||!It.current)return;const M=m.clientX-It.current.x,Y=m.clientY-It.current.y,k=M*M+Y*Y,Q=Vo*Vo;if(!Sn&&k>=Q&&(cn.current=It.current,ba(!0)),(Sn||k>=Q)&&cn.current){if(Dl.current){const Ce=Math.min(cn.current.x,m.clientX),Se=Math.min(cn.current.y,m.clientY),yt=Math.abs(m.clientX-cn.current.x),ht=Math.abs(m.clientY-cn.current.y);Dl.current.style.transform=`translate(${Ce}px, ${Se}px)`,Dl.current.style.width=`${yt}px`,Dl.current.style.height=`${ht}px`}const I=Date.now();if(I-Zo.current<hu)return;Zo.current=I;const F=cn.current.x,_e=cn.current.y,de=Math.min(F,m.clientX),se=Math.min(_e,m.clientY),re=Math.max(F,m.clientX),fe=Math.max(_e,m.clientY),ce=(de+re)/2,te=(se+fe)/2,Ft=new Set,Qe=[[de,se],[re,se],[de,fe],[re,fe],[ce,te],[ce,se],[ce,fe],[de,te],[re,te]];for(const[Ce,Se]of Qe){const yt=document.elementsFromPoint(Ce,Se);for(const ht of yt)ht instanceof HTMLElement&&Ft.add(ht)}const Rt=document.querySelectorAll("button, a, input, img, p, h1, h2, h3, h4, h5, h6, li, label, td, th, div, span, section, article, aside, nav");for(const Ce of Rt)if(Ce instanceof HTMLElement){const Se=Ce.getBoundingClientRect(),yt=Se.left+Se.width/2,ht=Se.top+Se.height/2,Pn=yt>=de&&yt<=re&&ht>=se&&ht<=fe,Un=Math.min(Se.right,re)-Math.max(Se.left,de),Ks=Math.min(Se.bottom,fe)-Math.max(Se.top,se),gu=Un>0&&Ks>0?Un*Ks:0,Ws=Se.width*Se.height,pu=Ws>0?gu/Ws:0;(Pn||pu>.5)&&Ft.add(Ce)}const wt=[],Pt=new Set(["BUTTON","A","INPUT","IMG","P","H1","H2","H3","H4","H5","H6","LI","LABEL","TD","TH","SECTION","ARTICLE","ASIDE","NAV"]);for(const Ce of Ft){if(Qt(Ce,"[data-cluso-toolbar]")||Qt(Ce,"[data-cluso-marker]"))continue;const Se=Ce.getBoundingClientRect();if(!(Se.width>window.innerWidth*.8&&Se.height>window.innerHeight*.5)&&!(Se.width<10||Se.height<10)&&Se.left<re&&Se.right>de&&Se.top<fe&&Se.bottom>se){const yt=Ce.tagName;let ht=Pt.has(yt);if(!ht&&(yt==="DIV"||yt==="SPAN")){const Pn=Ce.textContent&&Ce.textContent.trim().length>0,Un=Ce.onclick!==null||Ce.getAttribute("role")==="button"||Ce.getAttribute("role")==="link"||Ce.classList.contains("clickable")||Ce.hasAttribute("data-clickable");(Pn||Un)&&!Ce.querySelector("p, h1, h2, h3, h4, h5, h6, button, a")&&(ht=!0)}if(ht){let Pn=!1;for(const Un of wt)if(Un.left<=Se.left&&Un.right>=Se.right&&Un.top<=Se.top&&Un.bottom>=Se.bottom){Pn=!0;break}Pn||wt.push(Se)}}}if(wn.current){const Ce=wn.current;for(;Ce.children.length>wt.length;)Ce.removeChild(Ce.lastChild);wt.forEach((Se,yt)=>{let ht=Ce.children[yt];ht||(ht=document.createElement("div"),ht.className=h.selectedElementHighlight,Ce.appendChild(ht)),ht.style.transform=`translate(${Se.left}px, ${Se.top}px)`,ht.style.width=`${Se.width}px`,ht.style.height=`${Se.height}px`})}}};return document.addEventListener("mousemove",f,{passive:!0}),()=>document.removeEventListener("mousemove",f)},[q,B,Sn,Vo,Ve]),N.useEffect(()=>{if(!q)return;const f=m=>{if(Ve)return;const M=Sn,Y=cn.current;if(Sn&&Y){Wa.current=!0;const k=Math.min(Y.x,m.clientX),Q=Math.min(Y.y,m.clientY),I=Math.max(Y.x,m.clientX),F=Math.max(Y.y,m.clientY),_e=[];document.querySelectorAll("button, a, input, img, p, h1, h2, h3, h4, h5, h6, li, label, td, th").forEach(ce=>{if(!(ce instanceof HTMLElement)||Qt(ce,"[data-cluso-toolbar]")||Qt(ce,"[data-cluso-marker]"))return;const te=ce.getBoundingClientRect();te.width>window.innerWidth*.8&&te.height>window.innerHeight*.5||te.width<10||te.height<10||te.left<I&&te.right>k&&te.top<F&&te.bottom>Q&&_e.push({element:ce,rect:te})});const se=_e.filter(({element:ce})=>!_e.some(({element:te})=>te!==ce&&ce.contains(te))),re=m.clientX/window.innerWidth*100,fe=m.clientY+window.scrollY;if(se.length>0){const ce=se.reduce((Pt,{rect:Ce})=>({left:Math.min(Pt.left,Ce.left),top:Math.min(Pt.top,Ce.top),right:Math.max(Pt.right,Ce.right),bottom:Math.max(Pt.bottom,Ce.bottom)}),{left:1/0,top:1/0,right:-1/0,bottom:-1/0}),te=se.slice(0,5).map(({element:Pt})=>_u(Pt).name).join(", "),Ft=se.length>5?` +${se.length-5} more`:"",Qe=se[0].element,Rt=ou(Qe),wt=su(Qe);le({x:re,y:fe,clientY:m.clientY,element:`${se.length} elements: ${te}${Ft}`,elementPath:"multi-select",boundingBox:{x:ce.left,y:ce.top+window.scrollY,width:ce.right-ce.left,height:ce.bottom-ce.top},isMultiSelect:!0,fullPath:uu(Qe),accessibility:iu(Qe),computedStyles:wt,computedStylesObj:Rt,nearbyElements:au(Qe),cssClasses:Ds(Qe),nearbyText:Bs(Qe)})}else{const ce=Math.abs(I-k),te=Math.abs(F-Q);ce>20&&te>20&&le({x:re,y:fe,clientY:m.clientY,element:"Area selection",elementPath:`region at (${Math.round(k)}, ${Math.round(Q)})`,boundingBox:{x:k,y:Q+window.scrollY,width:ce,height:te},isMultiSelect:!0})}p(null)}else M&&(Wa.current=!0);It.current=null,cn.current=null,ba(!1),wn.current&&(wn.current.innerHTML="")};return document.addEventListener("mouseup",f),()=>document.removeEventListener("mouseup",f)},[q,Sn,Ve]);const St=N.useCallback(async(f,m,M)=>{const Y=G.webhookUrl||et;if(!Y||!G.webhooksEnabled&&!M)return!1;try{return(await fetch(Y,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:f,timestamp:Date.now(),url:typeof window<"u"?window.location.href:void 0,...m})})).ok}catch(k){return console.warn("[Cluso] Webhook failed:",k),!1}},[et,G.webhookUrl,G.webhooksEnabled]),Ko=N.useCallback(f=>{if(!B)return;const m={id:Date.now().toString(),x:B.x,y:B.y,comment:f,element:B.element,elementPath:B.elementPath,timestamp:Date.now(),selectedText:B.selectedText,boundingBox:B.boundingBox,nearbyText:B.nearbyText,cssClasses:B.cssClasses,isMultiSelect:B.isMultiSelect,isFixed:B.isFixed,fullPath:B.fullPath,accessibility:B.accessibility,computedStyles:B.computedStyles,nearbyElements:B.nearbyElements,reactComponents:B.reactComponents,elementBoundingBoxes:B.elementBoundingBoxes,...ee&&vt?{sessionId:vt,url:typeof window<"u"?window.location.href:void 0,status:"pending"}:{}};Ie(M=>[...M,m]),xa.current=m.id,Le(()=>{xa.current=null},300),Le(()=>{pa(M=>new Set(M).add(m.id))},250),A?.(m),St("annotation.add",{annotation:m}),Ka(!0),Le(()=>{le(null),Ka(!1)},150),window.getSelection()?.removeAllRanges(),ee&&vt&&cu(ee,vt,m).then(M=>{M.id!==m.id&&(Ie(Y=>Y.map(k=>k.id===m.id?{...k,id:M.id}:k)),pa(Y=>{const k=new Set(Y);return k.delete(m.id),k.add(M.id),k}))}).catch(M=>{console.warn("[Cluso] Failed to sync annotation:",M)})},[B,A,St,ee,vt]),Sa=N.useCallback(()=>{Ka(!0),Le(()=>{le(null),Ka(!1)},150)},[]),jn=N.useCallback(f=>{const m=oe.findIndex(Y=>Y.id===f),M=oe[m];ie?.id===f&&(In(!0),Le(()=>{Ml(null),bn(null),sl([]),In(!1)},150)),Ga(f),ya(Y=>new Set(Y).add(f)),M&&(K?.(M),St("annotation.delete",{annotation:M})),ee&&Om(ee,f).catch(Y=>{console.warn("[Cluso] Failed to delete annotation from server:",Y)}),Le(()=>{Ie(Y=>Y.filter(k=>k.id!==f)),ya(Y=>{const k=new Set(Y);return k.delete(f),k}),Ga(null),m<oe.length-1&&(Xs(m),Le(()=>Xs(null),200))},150)},[oe,ie,K,St,ee]),Hl=N.useCallback(f=>{if(Ml(f),ua(null),al(null),ol([]),f.elementBoundingBoxes?.length){const m=[];for(const M of f.elementBoundingBoxes){const Y=M.x+M.width/2,k=M.y+M.height/2-window.scrollY,Q=Xa(Y,k);Q&&m.push(Q)}sl(m),bn(null)}else if(f.boundingBox){const m=f.boundingBox,M=m.x+m.width/2,Y=f.isFixed?m.y+m.height/2:m.y+m.height/2-window.scrollY,k=Xa(M,Y);if(k){const Q=k.getBoundingClientRect(),I=Q.width/m.width,F=Q.height/m.height;I<.5||F<.5?bn(null):bn(k)}else bn(null);sl([])}else bn(null),sl([])},[]),ml=N.useCallback(f=>{if(!f){ua(null),al(null),ol([]);return}if(ua(f.id),f.elementBoundingBoxes?.length){const m=[];for(const M of f.elementBoundingBoxes){const Y=M.x+M.width/2,k=M.y+M.height/2-window.scrollY,I=document.elementsFromPoint(Y,k).find(F=>!F.closest("[data-cluso-marker]")&&!F.closest("[data-cluso-root]"));I&&m.push(I)}ol(m),al(null)}else if(f.boundingBox){const m=f.boundingBox,M=m.x+m.width/2,Y=f.isFixed?m.y+m.height/2:m.y+m.height/2-window.scrollY,k=Xa(M,Y);if(k){const Q=k.getBoundingClientRect(),I=Q.width/m.width,F=Q.height/m.height;I<.5||F<.5?al(null):al(k)}else al(null);ol([])}else al(null),ol([])},[]),Vs=N.useCallback(f=>{if(!ie)return;const m={...ie,comment:f};Ie(M=>M.map(Y=>Y.id===ie.id?m:Y)),Z?.(m),St("annotation.update",{annotation:m}),ee&&Xg(ee,ie.id,{comment:f}).catch(M=>{console.warn("[Cluso] Failed to update annotation on server:",M)}),In(!0),Le(()=>{Ml(null),bn(null),sl([]),In(!1)},150)},[ie,Z,St,ee]),Pa=N.useCallback(()=>{In(!0),Le(()=>{Ml(null),bn(null),sl([]),In(!1)},150)},[]),Nn=N.useCallback(()=>{const f=oe.length;if(f===0)return;pe?.(oe),St("annotations.clear",{annotations:oe}),ee&&Promise.all(oe.map(M=>Om(ee,M.id).catch(Y=>{console.warn("[Cluso] Failed to delete annotation from server:",Y)}))),$n(!0),we(!0);const m=f*30+200;Le(()=>{Ie([]),pa(new Set),localStorage.removeItem(mu(Ye)),$n(!1)},m),Le(()=>we(!1),1500)},[Ye,oe,pe,St,ee]),eo=N.useCallback(async()=>{const f=typeof window<"u"?window.location.pathname+window.location.search+window.location.hash:Ye,m=Ym(oe,f,G.outputDetail,$t);if(m){if(Ot)try{await navigator.clipboard.writeText(m)}catch{}he?.(m),Te(!0),Le(()=>Te(!1),2e3),G.autoClearAfterCopy&&Le(()=>Nn(),500)}},[oe,Ye,G.outputDetail,$t,G.autoClearAfterCopy,Nn,Ot,he]),Bt=N.useCallback(async()=>{const f=typeof window<"u"?window.location.pathname+window.location.search+window.location.hash:Ye,m=Ym(oe,f,G.outputDetail,$t);if(!m||(Re&&Re(m,oe),!xn))return;Ze("sending"),await new Promise(Y=>Le(Y,150));const M=ha?await St("submit",{output:m,annotations:oe},!0):!0;Ze(M?"sent":"failed"),Le(()=>Ze("idle"),2500),M&&G.autoClearAfterCopy&&Le(()=>Nn(),500)},[Re,St,oe,Ye,G.outputDetail,$t,G.autoClearAfterCopy,Nn,xn,ha]);N.useEffect(()=>{if(!Bl)return;const f=10,m=Y=>{const k=Y.clientX-Bl.x,Q=Y.clientY-Bl.y,I=Math.sqrt(k*k+Q*Q);if(!vn&&I>f&&$o(!0),vn||I>f){let F=Bl.toolbarX+k,_e=Bl.toolbarY+Q;const de=20,se=297,re=44,ce=se-(q?Lt==="connected"?297:257:40),te=de-ce,Ft=window.innerWidth-de-se;F=Math.max(te,Math.min(Ft,F)),_e=Math.max(de,Math.min(window.innerHeight-re-de,_e)),Go({x:F,y:_e})}},M=()=>{vn&&(qt.current=!0),$o(!1),ga(null)};return document.addEventListener("mousemove",m),document.addEventListener("mouseup",M),()=>{document.removeEventListener("mousemove",m),document.removeEventListener("mouseup",M)}},[Bl,vn,q,Lt]);const hl=N.useCallback(f=>{if(f.target.closest("button")||f.target.closest(`.${h.settingsPanel}`))return;const m=f.currentTarget.parentElement;if(!m)return;const M=m.getBoundingClientRect(),Y=window.innerWidth-M.width-24,k=window.innerHeight-M.height-24,Q=Xe?.x??Y,I=Xe?.y??k,F=(Math.random()-.5)*10;Yn(F),il&&da(!1),ga({x:f.clientX,y:f.clientY,toolbarX:Q,toolbarY:I})},[Xe,il,da]);if(N.useEffect(()=>{if(!Xe)return;const f=()=>{let k=Xe.x,Q=Xe.y;const _e=20-(297-(q?Lt==="connected"?297:257:40)),de=window.innerWidth-20-297;k=Math.max(_e,Math.min(de,k)),Q=Math.max(20,Math.min(window.innerHeight-44-20,Q)),(k!==Xe.x||Q!==Xe.y)&&Go({x:k,y:Q})};return f(),window.addEventListener("resize",f),()=>window.removeEventListener("resize",f)},[Xe,q,Lt]),N.useEffect(()=>{const f=m=>{const M=m.target,Y=M.tagName==="INPUT"||M.tagName==="TEXTAREA"||M.isContentEditable;if(m.key==="Escape"){if(st.length>0){rl([]);return}B||q&&(it(),at(!1))}if((m.metaKey||m.ctrlKey)&&m.shiftKey&&(m.key==="f"||m.key==="F")){m.preventDefault(),it(),at(k=>!k);return}if(!(Y||m.metaKey||m.ctrlKey)&&((m.key==="p"||m.key==="P")&&(m.preventDefault(),it(),Fa()),(m.key==="h"||m.key==="H")&&oe.length>0&&(m.preventDefault(),it(),kt(k=>!k)),(m.key==="c"||m.key==="C")&&oe.length>0&&(m.preventDefault(),it(),eo()),(m.key==="x"||m.key==="X")&&oe.length>0&&(m.preventDefault(),it(),Nn()),m.key==="s"||m.key==="S")){const k=Lo(G.webhookUrl)||Lo(et||"");oe.length>0&&k&&Fe==="idle"&&(m.preventDefault(),it(),Bt())}};return document.addEventListener("keydown",f),()=>document.removeEventListener("keydown",f)},[q,B,oe.length,G.webhookUrl,et,Fe,Bt,Fa,eo,Nn,st]),!Oe)return null;const Hn=oe.length>0,Fn=oe.filter(f=>!Ja.has(f.id)),Js=oe.filter(f=>Ja.has(f.id)),to=f=>{const Q=f.x/100*window.innerWidth,I=typeof f.y=="string"?parseFloat(f.y):f.y,F={};window.innerHeight-I-22-10<80&&(F.top="auto",F.bottom="calc(100% + 10px)");const de=Q-200/2,se=10;if(de<se){const re=se-de;F.left=`calc(50% + ${re}px)`}else if(de+200>window.innerWidth-se){const re=de+200-(window.innerWidth-se);F.left=`calc(50% - ${re}px)`}return F};return kr.createPortal(s.jsxs(s.Fragment,{children:[b&&(q||!Tt)&&s.jsx("div",{className:h.toolbar,"data-glass":G.glassify?be?"dark":"light":void 0,"data-cluso-toolbar":!0,style:Xe?{left:Xe.x,top:Xe.y,right:"auto",bottom:"auto"}:void 0,children:s.jsxs("div",{className:`${h.toolbarContainer} ${be?"":h.light} ${q?h.expanded:h.collapsed} ${Xo?h.entrance:""} ${vn?h.dragging:""} ${!G.webhooksEnabled&&(Lo(G.webhookUrl)||Lo(et||""))?h.serverConnected:""} ${G.glassify?be?h.glassDark:h.glassLight:""}`,onClick:q?void 0:f=>{if(qt.current){qt.current=!1,f.preventDefault();return}at(!0)},onMouseDown:hl,role:q?void 0:"button",tabIndex:q?-1:0,title:q?void 0:"Start feedback mode",style:{...vn&&{transform:`scale(1.05) rotate(${Va}deg)`,cursor:"grabbing"}},children:[s.jsxs("div",{className:`${h.toggleContent} ${q?h.hidden:h.visible}`,children:[s.jsx(Fh,{size:22}),Hn&&s.jsx("span",{className:`${h.badge} ${q?h.fadeOut:""} ${Xo?h.entrance:""}`,style:{backgroundColor:G.annotationColor},children:oe.length})]}),s.jsxs("div",{className:`${h.controlsContent} ${q?h.visible:h.hidden} ${Xe&&Xe.y<100?h.tooltipBelow:""} ${qs||il?h.tooltipsSuppressed:""}`,onMouseLeave:zt,children:[dt.pause&&s.jsxs("div",{className:`${h.buttonWrapper} ${Xe&&Xe.x<120?h.buttonWrapperAlignLeft:""}`,children:[s.jsx("button",{className:`${h.controlButton} ${be?"":h.light}`,onClick:f=>{f.stopPropagation(),it(),Fa()},"data-active":ot,children:s.jsx(Ih,{size:22,annotationMode:q})}),s.jsxs("span",{className:h.buttonTooltip,children:[ot?"Resume animations":"Pause animations",s.jsx("span",{className:h.shortcut,children:"P"})]})]}),dt.markers&&s.jsxs("div",{className:h.buttonWrapper,children:[s.jsx("button",{className:`${h.controlButton} ${be?"":h.light}`,onClick:f=>{f.stopPropagation(),it(),kt(!_t)},disabled:!Hn,children:s.jsx(Gh,{size:24,isOpen:_t})}),s.jsxs("span",{className:h.buttonTooltip,children:[_t?"Hide markers":"Show markers",s.jsx("span",{className:h.shortcut,children:"H"})]})]}),dt.copy&&s.jsxs("div",{className:h.buttonWrapper,children:[s.jsx("button",{className:`${h.controlButton} ${be?"":h.light} ${ge?h.statusShowing:""}`,onClick:f=>{f.stopPropagation(),it(),eo()},disabled:!Hn,"data-active":ge,children:s.jsx(Xh,{size:24,copied:ge})}),s.jsxs("span",{className:h.buttonTooltip,children:["Copy feedback",s.jsx("span",{className:h.shortcut,children:"C"})]})]}),dt.send&&s.jsxs("div",{className:`${h.buttonWrapper} ${h.sendButtonWrapper} ${xn?h.sendButtonVisible:""}`,children:[s.jsxs("button",{className:`${h.controlButton} ${be?"":h.light} ${Fe==="sent"||Fe==="failed"?h.statusShowing:""}`,onClick:f=>{f.stopPropagation(),it(),Bt()},disabled:!Hn||!xn||Fe==="sending","data-no-hover":Fe==="sent"||Fe==="failed",tabIndex:xn?0:-1,children:[s.jsx(Qh,{size:24,state:Fe}),Hn&&Fe==="idle"&&s.jsx("span",{className:`${h.buttonBadge} ${be?"":h.light}`,style:{backgroundColor:G.annotationColor},children:oe.length})]}),s.jsxs("span",{className:h.buttonTooltip,children:[on,s.jsx("span",{className:h.shortcut,children:"S"})]})]}),dt.clear&&s.jsxs("div",{className:h.buttonWrapper,children:[s.jsx("button",{className:`${h.controlButton} ${be?"":h.light}`,onClick:f=>{f.stopPropagation(),it(),Nn()},disabled:!Hn,"data-danger":!0,children:s.jsx(qh,{size:24})}),s.jsxs("span",{className:h.buttonTooltip,children:["Clear all",s.jsx("span",{className:h.shortcut,children:"X"})]})]}),dt.settings&&s.jsxs("div",{className:h.buttonWrapper,children:[s.jsx("button",{className:`${h.controlButton} ${be?"":h.light}`,onClick:f=>{f.stopPropagation(),it(),da(!il)},children:s.jsx($h,{size:24})}),ee&&Lt!=="disconnected"&&s.jsx("span",{className:`${h.mcpIndicator} ${be?"":h.light} ${h[Lt]} ${il?h.hidden:""}`,title:Lt==="connected"?"MCP Connected":"MCP Connecting..."}),s.jsx("span",{className:h.buttonTooltip,children:"Settings"})]}),dt.inspector&&s.jsxs("div",{className:h.buttonWrapper,children:[s.jsx("button",{className:`${h.controlButton} ${be?"":h.light}`,onClick:f=>{f.stopPropagation(),it();const m=!Ve;_a(m),m?(le(null),Ml(null),ba(!1),It.current=null):(Jn(null),ul(!1))},"data-active":Ve,title:"Inspector panel",children:s.jsxs("svg",{width:"20",height:"20",viewBox:"0 0 20 20",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:[s.jsx("circle",{cx:"8.5",cy:"8.5",r:"4.5",stroke:"currentColor",strokeWidth:"1.5"}),s.jsx("line",{x1:"12.5",y1:"12.5",x2:"16.5",y2:"16.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),s.jsx("line",{x1:"8.5",y1:"5.5",x2:"8.5",y2:"6.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),s.jsx("line",{x1:"8.5",y1:"10.5",x2:"8.5",y2:"11.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),s.jsx("line",{x1:"5.5",y1:"8.5",x2:"6.5",y2:"8.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),s.jsx("line",{x1:"10.5",y1:"8.5",x2:"11.5",y2:"8.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}),s.jsx("span",{className:h.buttonTooltip,children:"Properties panel"})]}),(dt.pause||dt.markers||dt.copy||dt.send||dt.clear||dt.settings||dt.inspector)&&dt.exit&&s.jsx("div",{className:`${h.divider} ${be?"":h.light}`}),dt.exit&&s.jsxs("div",{className:`${h.buttonWrapper} ${Xe&&typeof window<"u"&&Xe.x>window.innerWidth-120?h.buttonWrapperAlignRight:""}`,children:[s.jsx("button",{className:`${h.controlButton} ${be?"":h.light}`,onClick:f=>{f.stopPropagation(),it(),at(!1)},children:s.jsx(Zh,{size:24})}),s.jsxs("span",{className:h.buttonTooltip,children:["Exit",s.jsx("span",{className:h.shortcut,children:"Esc"})]})]})]}),s.jsx("div",{className:`${h.settingsPanel} ${be?h.dark:h.light} ${Za?h.enter:h.exit}`,onClick:f=>f.stopPropagation(),style:Xe&&Xe.y<230?{bottom:"auto",top:"calc(100% + 0.5rem)"}:void 0,children:s.jsxs("div",{className:`${h.settingsPanelContainer} ${Ho?h.transitioning:""}`,children:[s.jsxs("div",{className:`${h.activePage} ${cl==="automations"?h.slideLeft:""}`,children:[s.jsxs("div",{className:h.settingsHeader,children:[s.jsxs("span",{className:h.settingsBrand,children:[s.jsx("span",{className:h.settingsBrandSlash,style:{color:G.annotationColor,transition:"color 0.2s ease"},children:"/"}),"cluso"]}),s.jsxs("span",{className:h.settingsVersion,children:["v","2.2.1"]}),s.jsx("button",{className:h.themeToggle,onClick:()=>Zs(!be),title:be?"Switch to light mode":"Switch to dark mode",children:s.jsx("span",{className:h.themeIconWrapper,children:s.jsx("span",{className:h.themeIcon,children:be?s.jsx(Vh,{size:20}):s.jsx(Jh,{size:20})},be?"sun":"moon")})})]}),s.jsxs("div",{className:h.settingsSection,children:[s.jsxs("div",{className:h.settingsRow,children:[s.jsxs("div",{className:`${h.settingsLabel} ${be?"":h.light}`,children:["Capture Detail",s.jsx(At,{content:"How much context is captured per annotation — more detail helps AI agents locate elements precisely",children:s.jsx("span",{className:h.helpIcon,children:s.jsx(eu,{size:20})})})]}),s.jsxs("button",{className:`${h.cycleButton} ${be?"":h.light}`,onClick:()=>{const m=(Hs.findIndex(M=>M.value===G.outputDetail)+1)%Hs.length;Rn(M=>({...M,outputDetail:Hs[m].value}))},children:[s.jsx("span",{className:h.cycleButtonText,children:Hs.find(f=>f.value===G.outputDetail)?.label},G.outputDetail),s.jsx("span",{className:h.cycleDots,children:Hs.map((f,m)=>s.jsx("span",{className:`${h.cycleDot} ${be?"":h.light} ${G.outputDetail===f.value?h.active:""}`},f.value))})]})]}),s.jsxs("div",{className:`${h.settingsRow} ${h.settingsRowMarginTop} ${un?"":h.settingsRowDisabled}`,children:[s.jsxs("div",{className:`${h.settingsLabel} ${be?"":h.light}`,children:["Include React",s.jsx(At,{content:un?"Capture the React component tree for each element — useful for component-level fixes":"Disabled — production builds minify component names, making detection unreliable. Use on localhost in development mode.",children:s.jsx("span",{className:h.helpIcon,children:s.jsx(eu,{size:20})})})]}),s.jsxs("label",{className:`${h.toggleSwitch} ${un?"":h.disabled}`,children:[s.jsx("input",{type:"checkbox",checked:un&&G.reactEnabled,disabled:!un,onChange:()=>Rn(f=>({...f,reactEnabled:!f.reactEnabled}))}),s.jsx("span",{className:h.toggleSlider})]})]})]}),s.jsxs("div",{className:h.settingsSection,children:[s.jsx("div",{className:`${h.settingsLabel} ${h.settingsLabelMarker} ${be?"":h.light}`,children:"Accent"}),s.jsx("div",{className:h.colorOptions,children:lp.map(f=>s.jsx("div",{role:"button",onClick:()=>Rn(m=>({...m,annotationColor:f.value})),style:{borderColor:G.annotationColor===f.value?f.value:"transparent"},className:`${h.colorOptionRing} ${G.annotationColor===f.value?h.selected:""}`,children:s.jsx("div",{className:`${h.colorOption} ${G.annotationColor===f.value?h.selected:""}`,style:{backgroundColor:f.value},title:f.label})},f.value))})]}),s.jsx("div",{className:h.settingsSection,children:s.jsxs("div",{className:h.settingsRow,children:[s.jsx("span",{className:`${h.settingsLabel} ${be?"":h.light}`,children:"Glassify"}),s.jsxs("label",{className:h.toggleSwitch,children:[s.jsx("input",{type:"checkbox",checked:G.glassify,onChange:()=>Rn(f=>({...f,glassify:!f.glassify}))}),s.jsx("span",{className:h.toggleSlider})]})]})}),s.jsx("div",{className:`${h.settingsSection} ${h.settingsSectionExtraPadding}`,children:s.jsxs("button",{className:`${h.settingsNavLink} ${be?"":h.light}`,onClick:()=>Yo("automations"),children:[s.jsx("span",{children:"Connectivity"}),s.jsxs("span",{className:h.settingsNavLinkRight,children:[ee&&Lt!=="disconnected"&&s.jsx("span",{className:`${h.mcpNavIndicator} ${h[Lt]}`}),s.jsx("svg",{width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:s.jsx("path",{d:"M7.5 12.5L12 8L7.5 3.5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})]})]})})]}),s.jsxs("div",{className:`${h.activePage} ${h.automationsPage} ${cl==="automations"?h.slideIn:""}`,children:[s.jsxs("button",{className:`${h.settingsBackButton} ${be?"":h.light}`,onClick:()=>Yo("main"),children:[s.jsx(Wh,{size:16}),s.jsx("span",{children:"Connectivity"})]}),s.jsxs("div",{className:h.settingsSection,children:[s.jsxs("div",{className:h.settingsRow,children:[s.jsxs("span",{className:`${h.automationHeader} ${be?"":h.light}`,children:["MCP Server",s.jsx(At,{content:"Connect to a local MCP server so AI agents can read and act on your annotations in real-time.",children:s.jsx("span",{className:`${h.helpIcon} ${h.helpIconNudgeDown}`,children:s.jsx(eu,{size:20})})})]}),ee&&s.jsx("div",{className:`${h.mcpStatusDot} ${h[Lt]}`,title:Lt==="connected"?"Connected":Lt==="connecting"?"Connecting...":"Disconnected"})]}),s.jsxs("p",{className:`${h.automationDescription} ${be?"":h.light}`,style:{paddingBottom:6},children:["MCP connection allows agents to receive and act on annotations."," ",s.jsx("a",{href:"https://cluso.dev/mcp",target:"_blank",rel:"noopener noreferrer",className:`${h.learnMoreLink} ${be?"":h.light}`,children:"Learn more"})]})]}),s.jsxs("div",{className:`${h.settingsSection} ${h.settingsSectionGrow}`,children:[s.jsxs("div",{className:h.settingsRow,children:[s.jsxs("span",{className:`${h.automationHeader} ${be?"":h.light}`,children:["Webhooks",s.jsx(At,{content:"POST annotation data to a URL whenever annotations are added or changed.",children:s.jsx("span",{className:`${h.helpIcon} ${h.helpIconNoNudge}`,children:s.jsx(eu,{size:20})})})]}),s.jsxs("div",{className:h.autoSendRow,children:[s.jsx("span",{className:`${h.autoSendLabel} ${be?"":h.light} ${G.webhooksEnabled?h.active:""}`,children:"Send"}),s.jsxs("label",{className:`${h.toggleSwitch} ${G.webhookUrl?"":h.disabled}`,children:[s.jsx("input",{type:"checkbox",checked:G.webhooksEnabled,disabled:!G.webhookUrl,onChange:()=>Rn(f=>({...f,webhooksEnabled:!f.webhooksEnabled}))}),s.jsx("span",{className:h.toggleSlider})]})]})]}),s.jsx("p",{className:`${h.automationDescription} ${be?"":h.light}`,children:"The webhook URL will receive live annotation changes and annotation data."}),s.jsx("input",{type:"url",className:`${h.webhookUrlInput} ${be?"":h.light}`,placeholder:"e.g. https://hooks.zapier.com/hooks/catch/123",value:G.webhookUrl,style:{"--marker-color":G.annotationColor,minHeight:"unset",height:"34px",resize:"none",marginBottom:"12px"},onChange:f=>Rn(m=>({...m,webhookUrl:f.target.value}))})]})]})]})})]})}),s.jsxs("div",{className:h.markersLayer,"data-cluso-toolbar":!0,children:[z&&Fn.filter(f=>!f.isFixed).map((f,m)=>{const M=!J&&Kt===f.id,Y=Qa===f.id,k=(M||Y)&&!ie,Q=f.isMultiSelect,I=Q?"#34C759":G.annotationColor,F=oe.findIndex(re=>re.id===f.id),_e=!qo.has(f.id),de=J?h.exit:yn?h.clearing:_e?h.enter:"",se=k&&G.markerClickBehavior==="delete";return s.jsxs("div",{className:`${h.marker} ${Q?h.multiSelect:""} ${de} ${se?h.hovered:""}`,"data-cluso-marker":!0,style:{left:`${f.x}%`,top:f.y,backgroundColor:se?void 0:I,animationDelay:J?`${(Fn.length-1-m)*20}ms`:`${m*20}ms`},onMouseEnter:()=>!J&&f.id!==xa.current&&ml(f),onMouseLeave:()=>ml(null),onClick:re=>{re.stopPropagation(),J||(G.markerClickBehavior==="delete"?jn(f.id):Hl(f))},onContextMenu:re=>{G.markerClickBehavior==="delete"&&(re.preventDefault(),re.stopPropagation(),J||Hl(f))},children:[k?se?s.jsx(yr,{size:Q?18:16}):s.jsx(wm,{size:16}):s.jsx("span",{className:$a!==null&&F>=$a?h.renumber:void 0,children:F+1}),M&&!ie&&s.jsxs("div",{className:`${h.markerTooltip} ${be?"":h.light} ${h.enter}`,style:to(f),children:[s.jsxs("span",{className:h.markerQuote,children:[f.element,f.selectedText&&` "${f.selectedText.slice(0,30)}${f.selectedText.length>30?"...":""}"`]}),s.jsx("span",{className:h.markerNote,children:f.comment})]})]},f.id)}),z&&!J&&Js.filter(f=>!f.isFixed).map(f=>{const m=f.isMultiSelect;return s.jsx("div",{className:`${h.marker} ${h.hovered} ${m?h.multiSelect:""} ${h.exit}`,"data-cluso-marker":!0,style:{left:`${f.x}%`,top:f.y},children:s.jsx(yr,{size:m?12:10})},f.id)})]}),s.jsxs("div",{className:h.fixedMarkersLayer,"data-cluso-toolbar":!0,children:[z&&Fn.filter(f=>f.isFixed).map((f,m)=>{const M=Fn.filter(fe=>fe.isFixed),Y=!J&&Kt===f.id,k=Qa===f.id,Q=(Y||k)&&!ie,I=f.isMultiSelect,F=I?"#34C759":G.annotationColor,_e=oe.findIndex(fe=>fe.id===f.id),de=!qo.has(f.id),se=J?h.exit:yn?h.clearing:de?h.enter:"",re=Q&&G.markerClickBehavior==="delete";return s.jsxs("div",{className:`${h.marker} ${h.fixed} ${I?h.multiSelect:""} ${se} ${re?h.hovered:""}`,"data-cluso-marker":!0,style:{left:`${f.x}%`,top:f.y,backgroundColor:re?void 0:F,animationDelay:J?`${(M.length-1-m)*20}ms`:`${m*20}ms`},onMouseEnter:()=>!J&&f.id!==xa.current&&ml(f),onMouseLeave:()=>ml(null),onClick:fe=>{fe.stopPropagation(),J||(G.markerClickBehavior==="delete"?jn(f.id):Hl(f))},onContextMenu:fe=>{G.markerClickBehavior==="delete"&&(fe.preventDefault(),fe.stopPropagation(),J||Hl(f))},children:[Q?re?s.jsx(yr,{size:I?18:16}):s.jsx(wm,{size:16}):s.jsx("span",{className:$a!==null&&_e>=$a?h.renumber:void 0,children:_e+1}),Y&&!ie&&s.jsxs("div",{className:`${h.markerTooltip} ${be?"":h.light} ${h.enter}`,style:to(f),children:[s.jsxs("span",{className:h.markerQuote,children:[f.element,f.selectedText&&` "${f.selectedText.slice(0,30)}${f.selectedText.length>30?"...":""}"`]}),s.jsx("span",{className:h.markerNote,children:f.comment})]})]},f.id)}),z&&!J&&Js.filter(f=>f.isFixed).map(f=>{const m=f.isMultiSelect;return s.jsx("div",{className:`${h.marker} ${h.fixed} ${h.hovered} ${m?h.multiSelect:""} ${h.exit}`,"data-cluso-marker":!0,style:{left:`${f.x}%`,top:f.y},children:s.jsx(Hh,{size:m?12:10})},f.id)})]}),q&&s.jsxs("div",{className:h.overlay,"data-cluso-toolbar":!0,style:{...B||ie?{zIndex:99999}:void 0,...Ve?{pointerEvents:"none"}:void 0},children:[ne?.rect&&!B&&!Gs&&!Sn&&s.jsx("div",{className:`${h.hoverHighlight} ${h.enter}`,style:{left:ne.rect.left,top:ne.rect.top,width:ne.rect.width,height:ne.rect.height,borderRadius:Bo,borderColor:`${G.annotationColor}80`,backgroundColor:`${G.annotationColor}0A`}}),Ve&&Kn&&Vn?.element&&document.contains(Vn.element)&&(()=>{const f=Vn.element.getBoundingClientRect();return s.jsx("div",{style:{position:"fixed",left:f.left,top:f.top,width:f.width,height:f.height,border:`2px solid ${G.annotationColor}`,borderRadius:Bo,backgroundColor:`${G.annotationColor}12`,pointerEvents:"none",boxSizing:"border-box",zIndex:99998,boxShadow:`0 0 0 1px ${G.annotationColor}30`}})})(),st.filter(f=>document.contains(f.element)).map((f,m)=>{const M=f.element.getBoundingClientRect(),Y=st.length>1;return s.jsx("div",{className:Y?h.multiSelectOutline:h.singleSelectOutline,style:{position:"fixed",left:M.left,top:M.top,width:M.width,height:M.height,borderRadius:Bo,...Y?{}:{borderColor:`${G.annotationColor}99`,backgroundColor:`${G.annotationColor}0D`}}},m)}),Kt&&!B&&(()=>{const f=oe.find(k=>k.id===Kt);if(!f?.boundingBox)return null;if(f.elementBoundingBoxes?.length)return Ro.length>0?Ro.filter(k=>document.contains(k)).map((k,Q)=>{const I=k.getBoundingClientRect();return s.jsx("div",{className:`${h.multiSelectOutline} ${h.enter}`,style:{left:I.left,top:I.top,width:I.width,height:I.height,borderRadius:Bo}},`hover-outline-live-${Q}`)}):f.elementBoundingBoxes.map((k,Q)=>s.jsx("div",{className:`${h.multiSelectOutline} ${h.enter}`,style:{left:k.x,top:k.y-qn,width:k.width,height:k.height,borderRadius:Bo}},`hover-outline-${Q}`));const m=ca&&document.contains(ca)?ca.getBoundingClientRect():null,M=m?{x:m.left,y:m.top,width:m.width,height:m.height}:{x:f.boundingBox.x,y:f.isFixed?f.boundingBox.y:f.boundingBox.y-qn,width:f.boundingBox.width,height:f.boundingBox.height},Y=f.isMultiSelect;return s.jsx("div",{className:`${Y?h.multiSelectOutline:h.singleSelectOutline} ${h.enter}`,style:{left:M.x,top:M.y,width:M.width,height:M.height,borderRadius:Bo,...Y?{}:{borderColor:`${G.annotationColor}99`,backgroundColor:`${G.annotationColor}0D`}}})})(),ne&&!B&&!Gs&&!Sn&&s.jsxs("div",{className:`${h.hoverTooltip} ${h.enter}`,style:{left:Math.max(8,Math.min(S.x,window.innerWidth-100)),top:Math.max(S.y-(ne.reactComponents?48:32),8)},children:[ne.reactComponents&&s.jsx("div",{className:h.hoverReactPath,children:ne.reactComponents}),s.jsx("div",{className:h.hoverElementName,children:ne.elementName})]}),B&&s.jsxs(s.Fragment,{children:[B.multiSelectElements?.length?B.multiSelectElements.filter(f=>document.contains(f)).map((f,m)=>{const M=f.getBoundingClientRect();return s.jsx("div",{className:`${h.multiSelectOutline} ${Wn?h.exit:h.enter}`,style:{left:M.left,top:M.top,width:M.width,height:M.height}},`pending-multi-${m}`)}):B.targetElement&&document.contains(B.targetElement)?(()=>{const f=B.targetElement.getBoundingClientRect();return s.jsx("div",{className:`${h.singleSelectOutline} ${Wn?h.exit:h.enter}`,style:{left:f.left,top:f.top,width:f.width,height:f.height,borderColor:`${G.annotationColor}99`,backgroundColor:`${G.annotationColor}0D`}})})():B.boundingBox&&s.jsx("div",{className:`${B.isMultiSelect?h.multiSelectOutline:h.singleSelectOutline} ${Wn?h.exit:h.enter}`,style:{left:B.boundingBox.x,top:B.boundingBox.y-qn,width:B.boundingBox.width,height:B.boundingBox.height,...B.isMultiSelect?{}:{borderColor:`${G.annotationColor}99`,backgroundColor:`${G.annotationColor}0D`}}}),(()=>{const f=B.x,m=B.isFixed?B.y:B.y-qn;return s.jsxs(s.Fragment,{children:[s.jsx("div",{className:`${h.marker} ${h.pending} ${B.isMultiSelect?h.multiSelect:""} ${Wn?h.exit:h.enter}`,style:{left:`${f}%`,top:m,backgroundColor:B.isMultiSelect?"#34C759":G.annotationColor},children:s.jsx(Uh,{size:12})}),s.jsx(jm,{ref:va,element:B.element,selectedText:B.selectedText,computedStyles:B.computedStylesObj,placeholder:B.element==="Area selection"?"What should change in this area?":B.isMultiSelect?"Feedback for this group of elements...":"What should change?",onSubmit:Ko,onCancel:Sa,isExiting:Wn,lightMode:!be,glassify:G.glassify,accentColor:B.isMultiSelect?"#34C759":G.annotationColor,style:{left:Math.max(160,Math.min(window.innerWidth-160,f/100*window.innerWidth)),...m>window.innerHeight-290?{bottom:window.innerHeight-m+20}:{top:m+20}}})]})})()]}),ie&&s.jsxs(s.Fragment,{children:[ie.elementBoundingBoxes?.length?ra.length>0?ra.filter(f=>document.contains(f)).map((f,m)=>{const M=f.getBoundingClientRect();return s.jsx("div",{className:`${h.multiSelectOutline} ${h.enter}`,style:{left:M.left,top:M.top,width:M.width,height:M.height}},`edit-multi-live-${m}`)}):ie.elementBoundingBoxes.map((f,m)=>s.jsx("div",{className:`${h.multiSelectOutline} ${h.enter}`,style:{left:f.x,top:f.y-qn,width:f.width,height:f.height}},`edit-multi-${m}`)):(()=>{const f=qa&&document.contains(qa)?qa.getBoundingClientRect():null,m=f?{x:f.left,y:f.top,width:f.width,height:f.height}:ie.boundingBox?{x:ie.boundingBox.x,y:ie.isFixed?ie.boundingBox.y:ie.boundingBox.y-qn,width:ie.boundingBox.width,height:ie.boundingBox.height}:null;return m?s.jsx("div",{className:`${ie.isMultiSelect?h.multiSelectOutline:h.singleSelectOutline} ${h.enter}`,style:{left:m.x,top:m.y,width:m.width,height:m.height,...ie.isMultiSelect?{}:{borderColor:`${G.annotationColor}99`,backgroundColor:`${G.annotationColor}0D`}}}):null})(),s.jsx(jm,{ref:Cn,element:ie.element,selectedText:ie.selectedText,computedStyles:Dg(ie.computedStyles),placeholder:"Edit your feedback...",initialValue:ie.comment,submitLabel:"Save",onSubmit:Vs,onCancel:Pa,onDelete:()=>jn(ie.id),isExiting:Wt,lightMode:!be,glassify:G.glassify,accentColor:ie.isMultiSelect?"#34C759":G.annotationColor,style:(()=>{const f=ie.isFixed?ie.y:ie.y-qn;return{left:Math.max(160,Math.min(window.innerWidth-160,ie.x/100*window.innerWidth)),...f>window.innerHeight-290?{bottom:window.innerHeight-f+20}:{top:f+20}}})()})]}),Sn&&s.jsxs(s.Fragment,{children:[s.jsx("div",{ref:Dl,className:h.dragSelection}),s.jsx("div",{ref:wn,className:h.highlightsContainer})]})]}),s.jsx(kg,{info:Ve?Vn:null,locked:Kn,accentColor:G.annotationColor,onClose:()=>{Jn(null),ul(!1),_a(!1)}})]}),document.body)}const ap="__CLUSO_EMBEDDED_CONFIG__",Hm="__CLUSO_HOST__";class Vm extends N.Component{constructor(d){super(d),this.state={error:null}}static getDerivedStateFromError(d){return{error:d}}render(){return this.state.error?s.jsxs("div",{style:{position:"fixed",bottom:20,right:20,background:"#ff3b30",color:"#fff",padding:"12px 16px",borderRadius:8,maxWidth:400,fontSize:13,zIndex:99999,fontFamily:"monospace"},children:[s.jsx("strong",{children:"Toolbar error:"}),s.jsx("br",{}),this.state.error.message,s.jsx("br",{}),s.jsx("pre",{style:{fontSize:10,marginTop:8,overflow:"auto",maxHeight:120},children:this.state.error.stack})]}):this.props.children}}function Al(u,d={}){try{console.log(`__CLUSO_${u}__:${JSON.stringify(d)}`)}catch{}}function op(){return typeof window>"u"?null:window[ap]||null}function sp({config:u}){const[d,_]=N.useState(!!u?.defaultActive),c=N.useMemo(()=>({pause:!1,markers:!1,copy:!1,send:!1,clear:!1,settings:!1,inspector:!1,exit:!1,...u?.visibleControls||{}}),[u]);return N.useEffect(()=>(window[Hm]={setActive(b){_(!!b)},toggleActive(){_(b=>!b)},getActive(){return d}},Al("READY",{embedded:!0,active:d}),Al("ACTIVE",{active:d}),()=>{delete window[Hm]}),[d]),s.jsx(Vm,{children:s.jsx(Zm,{runtimeMode:u?.runtimeMode??"default",active:d,onActiveChange:b=>{_(b),Al("ACTIVE",{active:b})},showToolbar:u?.showToolbar??!1,hideCollapsedToolbar:u?.hideCollapsedToolbar??!1,visibleControls:c,submitButtonLabel:u?.submitButtonLabel,copyToClipboard:u?.copyToClipboard??!1,onAnnotationAdd:b=>{Al("ANNOTATION_ADD",{annotation:b})},onAnnotationDelete:b=>{Al("ANNOTATION_DELETE",{annotation:b})},onAnnotationUpdate:b=>{Al("ANNOTATION_UPDATE",{annotation:b})},onAnnotationsClear:b=>{Al("ANNOTATIONS_CLEAR",{annotations:b})},onCopy:b=>{Al("COPY",{markdown:b})},onSubmit:(b,v)=>{Al("SUBMIT",{output:b,annotations:v}),u?.autoExitAfterSubmit!==!1&&_(!1)}})})}function ip(){return s.jsxs(s.Fragment,{children:[s.jsxs("nav",{className:"nav",children:[s.jsx("div",{className:"nav-logo",children:"Acme Dashboard"}),s.jsxs("ul",{className:"nav-links",children:[s.jsx("li",{children:s.jsx("a",{href:"#",children:"Overview"})}),s.jsx("li",{children:s.jsx("a",{href:"#",children:"Analytics"})}),s.jsx("li",{children:s.jsx("a",{href:"#",children:"Projects"})}),s.jsx("li",{children:s.jsx("a",{href:"#",children:"Settings"})}),s.jsx("li",{children:s.jsx("a",{href:"#",className:"nav-cta",children:"Upgrade"})})]})]}),s.jsxs("main",{className:"page",children:[s.jsxs("div",{className:"hero",children:[s.jsx("div",{className:"hero-badge",children:"✦ Cluso Demo"}),s.jsxs("h1",{children:["Annotate anything,",s.jsx("br",{}),"instantly"]}),s.jsxs("p",{children:["The ",s.jsx("strong",{children:"real"})," Cluso toolbar (v2.2.1 from npm) is active. Press ",s.jsx("kbd",{children:"⌘⇧F"})," to toggle, then click any element."]}),s.jsxs("div",{className:"hero-actions",children:[s.jsx("button",{className:"btn-primary",children:"Get Started"}),s.jsx("button",{className:"btn-secondary",children:"View Docs"})]})]}),s.jsxs("div",{className:"stats",children:[s.jsxs("div",{className:"stat-card",children:[s.jsx("div",{className:"stat-value",children:"$84,392"}),s.jsx("div",{className:"stat-label",children:"Monthly Revenue"}),s.jsx("div",{className:"stat-trend",children:"↑ 12.4% vs last month"})]}),s.jsxs("div",{className:"stat-card",children:[s.jsx("div",{className:"stat-value",children:"2,847"}),s.jsx("div",{className:"stat-label",children:"Active Users"}),s.jsx("div",{className:"stat-trend",children:"↑ 8.1% vs last month"})]}),s.jsxs("div",{className:"stat-card",children:[s.jsx("div",{className:"stat-value",children:"98.7%"}),s.jsx("div",{className:"stat-label",children:"Uptime (30 days)"}),s.jsx("div",{className:"stat-trend",style:{color:"#34c759"},children:"All systems operational"})]})]}),s.jsxs("div",{className:"two-col",children:[s.jsxs("div",{className:"card",children:[s.jsxs("div",{className:"card-header",children:[s.jsx("span",{className:"card-title",children:"Recent Deployments"}),s.jsx("a",{href:"#",className:"card-action",children:"View all"})]}),s.jsx("div",{className:"card-body",children:s.jsxs("table",{className:"data-table",children:[s.jsx("thead",{children:s.jsxs("tr",{children:[s.jsx("th",{children:"Project"}),s.jsx("th",{children:"Branch"}),s.jsx("th",{children:"Status"}),s.jsx("th",{children:"Duration"})]})}),s.jsx("tbody",{children:[{name:"acme-web",branch:"main",status:"live",dur:"1m 12s",grad:"135deg,#667eea,#764ba2"},{name:"api-server",branch:"feat/auth",status:"building",dur:"0m 43s",grad:"135deg,#f093fb,#f5576c"},{name:"docs-site",branch:"fix/typos",status:"live",dur:"0m 28s",grad:"135deg,#4facfe,#00f2fe"},{name:"worker-jobs",branch:"hotfix/cron",status:"error",dur:"2m 05s",grad:"135deg,#43e97b,#38f9d7"},{name:"dashboard-ui",branch:"chore/deps",status:"live",dur:"1m 38s",grad:"135deg,#fa709a,#fee140"}].map(u=>s.jsxs("tr",{children:[s.jsx("td",{children:s.jsxs("div",{className:"user-cell",children:[s.jsx("div",{className:"avatar",style:{background:`linear-gradient(${u.grad})`}}),u.name]})}),s.jsx("td",{children:u.branch}),s.jsx("td",{children:s.jsxs("span",{className:`status-badge ${u.status}`,children:["● ",u.status.charAt(0).toUpperCase()+u.status.slice(1)]})}),s.jsx("td",{children:u.dur})]},u.name))})]})})]}),s.jsxs("div",{children:[s.jsxs("div",{className:"sidebar-card",children:[s.jsx("div",{className:"sidebar-title",children:"Activity"}),[{color:"#3b82f6",text:s.jsxs(s.Fragment,{children:["New deployment pushed to ",s.jsx("strong",{children:"main"})]}),time:"2 minutes ago"},{color:"#34c759",text:s.jsxs(s.Fragment,{children:["Build passed for ",s.jsx("strong",{children:"api-server"})]}),time:"15 minutes ago"},{color:"#ff3b30",text:s.jsxs(s.Fragment,{children:["Build failed: ",s.jsx("strong",{children:"worker-jobs"})]}),time:"1 hour ago"},{color:"#af52de",text:s.jsxs(s.Fragment,{children:["New user ",s.jsx("strong",{children:"sarah@acme.com"})," joined"]}),time:"3 hours ago"}].map((u,d)=>s.jsxs("div",{className:"activity-item",children:[s.jsx("div",{className:"activity-dot",style:{background:u.color}}),s.jsxs("div",{children:[s.jsx("div",{children:u.text}),s.jsx("div",{className:"activity-meta",children:u.time})]})]},d))]}),s.jsxs("div",{className:"sidebar-card",children:[s.jsx("div",{className:"sidebar-title",children:"Resource Usage"}),[{label:"Bandwidth",pct:73,color:"#0071e3"},{label:"Compute",pct:41,color:"#af52de"},{label:"Build minutes",pct:88,color:"#ff3b30"},{label:"Storage",pct:22,color:"#34c759"}].map(u=>s.jsxs("div",{className:"progress-item",children:[s.jsxs("div",{className:"progress-header",children:[s.jsx("span",{children:u.label}),s.jsxs("span",{children:[u.pct,"%"]})]}),s.jsx("div",{className:"progress-bar",children:s.jsx("div",{className:"progress-fill",style:{width:`${u.pct}%`,background:u.color}})})]},u.label))]})]})]}),s.jsxs("div",{className:"card",style:{marginBottom:16},children:[s.jsx("div",{className:"card-header",children:s.jsx("span",{className:"card-title",children:"Pricing"})}),s.jsx("div",{className:"card-body",children:s.jsx("div",{className:"plans",children:[{name:"Hobby",price:"$0",features:["3 projects","1 team member","100 GB bandwidth"],na:["Custom domains","Priority support"]},{name:"Pro",price:"$29",features:["Unlimited projects","5 team members","1 TB bandwidth","Custom domains"],na:["Priority support"],featured:!0},{name:"Enterprise",price:"$99",features:["Unlimited projects","Unlimited members","10 TB bandwidth","Custom domains","Priority support"],na:[]}].map(u=>s.jsxs("div",{className:`plan${u.featured?" featured":""}`,children:[u.featured&&s.jsx("div",{className:"plan-badge",children:"Most popular"}),s.jsx("div",{className:"plan-name",children:u.name}),s.jsxs("div",{className:"plan-price",children:[u.price," ",s.jsx("span",{children:"/ mo"})]}),s.jsxs("ul",{className:"plan-features",children:[u.features.map(d=>s.jsx("li",{children:d},d)),u.na.map(d=>s.jsx("li",{className:"na",children:d},d))]})]},u.name))})})]}),s.jsxs("div",{className:"two-col",children:[s.jsxs("div",{className:"card",children:[s.jsx("div",{className:"card-header",children:s.jsx("span",{className:"card-title",children:"From the blog"})}),s.jsxs("div",{className:"card-body",children:[s.jsxs("blockquote",{children:['"Simple can be harder than complex: You have to work hard to get your thinking clean to make it ',s.jsx("strong",{children:"simple"}),`. But it's worth it in the end because once you get there, you can move mountains."`,s.jsx("br",{}),s.jsx("br",{}),"— Steve Jobs"]}),[{grad:"135deg,#667eea,#764ba2",cat:"Engineering",title:"How we cut build times by 60% with incremental compilation"},{grad:"135deg,#f093fb,#f5576c",cat:"Design",title:"Designing for feedback: lessons from 12 months of iteration"}].map(u=>s.jsxs("div",{className:"article-card",children:[s.jsx("div",{className:"article-thumb",style:{background:`linear-gradient(${u.grad})`}}),s.jsxs("div",{children:[s.jsx("div",{className:"article-meta",children:u.cat}),s.jsx("div",{className:"article-title",children:u.title})]})]},u.title))]})]}),s.jsxs("div",{className:"card",children:[s.jsx("div",{className:"card-header",children:s.jsx("span",{className:"card-title",children:"Skeleton loaders — try Pause"})}),s.jsx("div",{className:"card-body",children:[1,2,3].map(u=>s.jsxs("div",{className:"skeleton-row",children:[s.jsx("div",{className:"skeleton skeleton-circle"}),s.jsxs("div",{className:"skeleton-lines",children:[s.jsx("div",{className:"skeleton skeleton-line",style:{width:`${60+u*10}%`}}),s.jsx("div",{className:"skeleton skeleton-line"})]})]},u))})]})]})]}),s.jsxs("footer",{className:"footer",children:[s.jsx("span",{children:"© 2026 Acme Corp. Cluso demo."}),s.jsxs("div",{className:"footer-links",children:[s.jsx("a",{href:"#",children:"Privacy"}),s.jsx("a",{href:"#",children:"Terms"}),s.jsx("a",{href:"#",children:"Contact"})]})]})]})}function up(){const u=op();return u?s.jsx(sp,{config:u}):s.jsxs(s.Fragment,{children:[s.jsx(Vm,{children:s.jsx(Zm,{onAnnotationAdd:d=>console.log("added",d),onAnnotationDelete:d=>console.log("deleted",d),onCopy:d=>console.log(`copied:
`,d),onSubmit:(d,_)=>console.log("submitted",{output:d,annotations:_})})}),s.jsx(ip,{})]})}Rh.createRoot(document.getElementById("root")).render(s.jsx(N.StrictMode,{children:s.jsx(up,{})}));
