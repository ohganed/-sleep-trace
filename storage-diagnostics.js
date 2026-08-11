(()=>{
  "use strict";

  function safeParse(raw){
    if(raw==null) return null;
    try{return JSON.parse(raw)}catch{return null}
  }

  function getReport(){
    const layer=window.LifeOSStorage;
    if(!layer){
      return {overall:"異常",layerStatus:"unavailable",schema:"-",legacy:"不明",envelope:"不明",lastMirror:"-",source:"-",errors:["Storage Layerを検出できません"]};
    }

    const legacyRaw=localStorage.getItem(layer.legacyKey);
    const envelopeRaw=localStorage.getItem(layer.envelopeKey);
    const legacy=safeParse(legacyRaw);
    const envelope=safeParse(envelopeRaw);
    const errors=[];

    if(legacyRaw!=null && !Array.isArray(legacy)) errors.push("旧データのJSON解析に失敗");
    if(envelopeRaw!=null && (!envelope || envelope.appId!==layer.appId || envelope.schemaVersion!==layer.schemaVersion || !Array.isArray(envelope.payload))) errors.push("LifeOS Envelopeが不正");

    const legacyDetected=Array.isArray(legacy);
    const envelopeDetected=!!envelope && envelope.appId===layer.appId && envelope.schemaVersion===layer.schemaVersion && Array.isArray(envelope.payload);
    const active=legacyDetected && envelopeDetected && errors.length===0;

    return {
      overall: errors.length===0 ? "正常" : "要確認",
      layerStatus: active ? "mirroring" : (envelopeDetected ? "envelope-only" : (legacyDetected ? "legacy-only" : "empty")),
      schema: layer.schemaVersion,
      legacy: legacyDetected ? "検出" : "なし",
      envelope: envelopeDetected ? "検出" : "なし",
      lastMirror: envelopeDetected && envelope.updatedAt ? new Date(envelope.updatedAt).toLocaleString("ja-JP") : "-",
      source: envelopeDetected ? (envelope.source || "-") : "-",
      errors
    };
  }

  function render(){
    let card=document.getElementById("lifeos-storage-diagnostics");
    if(!card){
      card=document.createElement("section");
      card.id="lifeos-storage-diagnostics";
      card.className="card limits";
      const footer=document.querySelector("footer");
      if(footer) footer.before(card); else document.querySelector(".app")?.append(card);
    }
    const r=getReport();
    card.innerHTML=`
      <p class="eyebrow">LifeOS Storage Diagnostics</p>
      <h2 style="margin:0 0 12px;font-size:19px">ストレージ診断</h2>
      <p style="color:var(--muted);font-size:12px;line-height:1.65">保存内容そのものは表示せず、LifeOS保存基盤の状態だけを確認します。</p>
      <div style="display:grid;gap:7px;margin:14px 0;color:#eeebfa;font-size:13px;line-height:1.55">
        <div><strong>総合:</strong> ${r.overall}</div>
        <div><strong>Storage Layer:</strong> ${r.layerStatus}</div>
        <div><strong>Schema:</strong> ${r.schema}</div>
        <div><strong>旧データ:</strong> ${r.legacy}</div>
        <div><strong>LifeOS Envelope:</strong> ${r.envelope}</div>
        <div><strong>最終ミラー:</strong> ${r.lastMirror}</div>
        <div><strong>保存元:</strong> ${r.source}</div>
        <div><strong>エラー:</strong> ${r.errors.length ? r.errors.join(" / ") : "なし"}</div>
      </div>
      <button id="lifeos-diagnostics-refresh" class="secondary" style="width:100%;flex:none">診断を更新</button>`;
    document.getElementById("lifeos-diagnostics-refresh")?.addEventListener("click",()=>{
      try{window.LifeOSStorage?.mirrorNow?.()}catch{}
      render();
    },{once:true});
  }

  window.LifeOSStorageDiagnostics=Object.freeze({getReport,render});
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",render,{once:true});
  else render();
})();
