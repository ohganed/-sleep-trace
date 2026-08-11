(()=>{
  "use strict";

  const APP_ID="sleep-trace";
  const SCHEMA_VERSION="1.0";
  const LEGACY_KEY="sleep-trace-sessions-v1";
  const ENVELOPE_KEY="lifeos.sleep-trace.storage.v1";

  function parseJson(raw,fallback){
    if(raw==null) return fallback;
    try{return JSON.parse(raw)}catch{return fallback}
  }

  function readLegacy(){
    const value=parseJson(localStorage.getItem(LEGACY_KEY),null);
    return Array.isArray(value)?value:null;
  }

  function readEnvelope(){
    const value=parseJson(localStorage.getItem(ENVELOPE_KEY),null);
    if(!value||value.schemaVersion!==SCHEMA_VERSION||value.appId!==APP_ID||!Array.isArray(value.payload)) return null;
    return value;
  }

  function writeEnvelope(payload,source="legacy-mirror"){
    try{
      localStorage.setItem(ENVELOPE_KEY,JSON.stringify({
        schemaVersion:SCHEMA_VERSION,
        appId:APP_ID,
        updatedAt:new Date().toISOString(),
        source,
        payload
      }));
      return true;
    }catch{return false}
  }

  function restoreLegacyFromEnvelope(){
    if(localStorage.getItem(LEGACY_KEY)!=null) return false;
    const envelope=readEnvelope();
    if(!envelope) return false;
    try{
      localStorage.setItem(LEGACY_KEY,JSON.stringify(envelope.payload));
      return true;
    }catch{return false}
  }

  restoreLegacyFromEnvelope();
  const initial=readLegacy();
  if(initial) writeEnvelope(initial,"initial-mirror");

  const nativeSetItem=Storage.prototype.setItem;
  const nativeRemoveItem=Storage.prototype.removeItem;

  Storage.prototype.setItem=function(key,value){
    nativeSetItem.call(this,key,value);
    if(this===localStorage&&key===LEGACY_KEY){
      const payload=parseJson(value,null);
      if(Array.isArray(payload)) writeEnvelope(payload,"legacy-mirror");
    }
  };

  Storage.prototype.removeItem=function(key){
    nativeRemoveItem.call(this,key);
    if(this===localStorage&&key===LEGACY_KEY){
      try{nativeRemoveItem.call(localStorage,ENVELOPE_KEY)}catch{}
    }
  };

  window.LifeOSStorage={
    appId:APP_ID,
    schemaVersion:SCHEMA_VERSION,
    legacyKey:LEGACY_KEY,
    envelopeKey:ENVELOPE_KEY,
    readEnvelope,
    mirrorNow(){const value=readLegacy();return value?writeEnvelope(value,"manual-mirror"):false}
  };

  const diagnostics=document.createElement("script");
  diagnostics.src="./storage-diagnostics.js";
  diagnostics.defer=true;
  document.head.append(diagnostics);
})();
