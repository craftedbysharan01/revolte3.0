/**
 * The app Revolte "built" in the sandbox: a real, working page rendered in an iframe (not a picture).
 * Filter by status, search endpoints, and press Retry now on a failed delivery to watch it retry and deliver.
 */
export const SANDBOX_APP = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;background:#0f0f10;color:#f7f6f3;font:14px/1.4 "Host Grotesk",system-ui,sans-serif;padding:24px}
h1{font-size:18px;font-weight:500;margin:0}.top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.muted{color:#a1a1a8;font-size:12px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin:16px 0}
.stat{border:1px solid #ffffff1f;border-radius:10px;padding:12px 14px;background:none;color:inherit;text-align:left;font:inherit;cursor:pointer}
.stat.on{background:#ffffff14;border-color:#ffffff40}.stat b{display:block;font-size:20px;font-weight:500;margin-top:2px}
.bar{display:flex;gap:10px;margin-bottom:6px}input{flex:1;min-width:0;background:none;border:1px solid #ffffff1f;border-radius:8px;color:inherit;padding:8px 10px;font:inherit}
input:focus{outline:none;border-color:#ffffff66}table{width:100%;border-collapse:collapse}th{font-weight:400;text-align:left;color:#a1a1a8;font-size:12px;padding:8px 0}
td{padding:12px 0;border-top:1px solid #ffffff1f}.pill{border-radius:99px;padding:2px 9px;font-size:12px;white-space:nowrap}
.Failed{background:#3a1717;color:#ff8c8c}.Retrying{background:#16264d;color:#8fb0ff}.Delivered{background:#12301d;color:#7fe0a0}
button.r{background:#f7f6f3;color:#0f0f10;border:0;border-radius:6px;padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}
button.r:disabled{opacity:.5;cursor:default}.empty{padding:28px 0;text-align:center;color:#a1a1a8}
@media(max-width:520px){.hide{display:none}body{padding:16px}}
</style></head><body>
<div class="top"><h1>Webhook deliveries</h1><span class="muted">Last 24 hours</span></div>
<div class="stats" id="stats"></div>
<div class="bar"><input id="q" placeholder="Search endpoints" aria-label="Search endpoints"></div>
<table><thead><tr><th>Endpoint</th><th class="hide">Event</th><th class="hide">Attempts</th><th>Status</th><th></th></tr></thead><tbody id="rows"></tbody></table>
<div id="none" class="empty" hidden>No deliveries match.</div>
<script>
var delivered=1280,rows=[["acme-payments/hook","invoice.paid",8,"Failed"],["shopline/events","order.created",3,"Retrying"],["ledgerly/in","refund.issued",1,"Delivered"],["northwind/hooks","invoice.paid",2,"Delivered"],["brightpay/notify","payout.sent",8,"Failed"],["tidal/webhooks","order.updated",4,"Retrying"]].map(function(r){return{e:r[0],ev:r[1],a:r[2],s:r[3]}});
var f="All",$=function(i){return document.getElementById(i)};
function count(s){return rows.filter(function(r){return r.s===s}).length}
function draw(){var q=$("q").value.toLowerCase();
 var tabs=[["All",delivered+rows.length],["Failed",count("Failed")],["Retrying",count("Retrying")],["Delivered",delivered+count("Delivered")]];
 $("stats").innerHTML=tabs.map(function(t){return '<button class="stat'+(f===t[0]?' on':'')+'" data-f="'+t[0]+'"><span class="muted">'+t[0]+'</span><b>'+t[1].toLocaleString()+'</b></button>'}).join("");
 var v=rows.filter(function(r){return(f==="All"||r.s===f)&&r.e.indexOf(q)>-1});
 $("rows").innerHTML=v.map(function(r){return '<tr><td>'+r.e+'</td><td class="hide muted">'+r.ev+'</td><td class="hide muted">'+r.a+'</td><td><span class="pill '+r.s+'">'+r.s+'</span></td><td style="text-align:right">'+(r.s==="Failed"?'<button class="r" data-r="'+r.e+'">Retry now</button>':'')+'</td></tr>'}).join("");
 $("none").hidden=v.length>0}
document.addEventListener("click",function(e){var t=e.target.closest("[data-f],[data-r]");if(!t)return;
 if(t.dataset.f){f=t.dataset.f;draw();return}
 var r=rows.find(function(x){return x.e===t.dataset.r});r.s="Retrying";r.a++;draw();
 setTimeout(function(){r.s="Delivered";r.a++;draw()},1600)});
$("q").addEventListener("input",draw);draw();
</script></body></html>`
