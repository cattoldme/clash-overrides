const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const snapshot=require('./fixtures/ai-services.json');
const categories=Object.keys(snapshot.categories);
const positive=['api.anthropic.com','claudeusercontent.com','aistudio.google.com','notebooklm.google.com',
  'antigravity.googleapis.com','copilot-proxy.githubusercontent.com','api.githubcopilot.com',
  'api.cursor.com','server.codeium.com','api.jetbrains.ai','www.perplexity.ai','api.x.ai',
  'www.poe.com','huggingface.co','api.elevenlabs.io','api.groq.com','openrouter.ai','api.mistral.ai',
  'www.midjourney.com','api.cohere.com','copilot.cloud.microsoft','copilot.com'];
const negative=['deepseek.com','qwen.ai','doubao.com','kimi.com','moonshot.cn','minimax.io',
  'www.google.com','www.googleapis.com','github.com','raw.githubusercontent.com','microsoft.com',
  'example.s3.amazonaws.com','example.cloudfront.net','example.blob.core.windows.net','themeforest.net'];
for(const script of ['linkcube-generic.js','flclash-single.js']) {
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),ctx);
  const input=()=>({proxies:['香港','新加坡','美国','日本'].map(name=>({name,type:'ss',server:'192.0.2.1',port:10000,cipher:'aes-128-gcm',password:'TEST-ONLY'})),dns:{enable:true}});
  function output(){return JSON.parse(JSON.stringify(ctx.main(input())));}
  test(script+' routes maintained AI categories before platform and China rules with aligned DNS',()=>{
    const c=output();
    const keys=Object.keys(c.dns['nameserver-policy']);
    for(const category of categories) {
      const rule='GEOSITE,'+category+',🤖 AI';
      assert(c.rules.includes(rule),category);
      for(const general of ['RULE-SET,Google,🔎 Google,no-resolve','RULE-SET,GitHub,🐙 GitHub,no-resolve','RULE-SET,Microsoft,🪟 Microsoft,no-resolve','GEOSITE,cn,DIRECT'])
        assert(c.rules.indexOf(rule)<c.rules.indexOf(general),category+' priority');
      assert.deepEqual(c.dns['nameserver-policy']['geosite:'+category],c.dns.fallback);
      assert(keys.indexOf('geosite:'+category)<keys.indexOf('geosite:cn'),category+' DNS priority');
    }
    assert.deepEqual(c['proxy-groups'].find(g=>g.name==='🤖 AI').proxies,['🇸🇬 SG','🇺🇸 US','🇯🇵 JP','🧭 Manual']);
  });
  test(script+' AI snapshot covers expected services without domestic AI or shared platform suffixes',()=>{
    const rules=output().rules.filter(rule=>rule.endsWith(',🤖 AI'));
    const suffixMatch=(host,value)=>host===value||host.endsWith('.'+value);
    function matches(host){return rules.some(rule=>{
      const [type,name]=rule.split(',');
      if(type==='DOMAIN-SUFFIX')return suffixMatch(host,name);
      if(type==='GEOSITE')return (snapshot.categories[name]||[]).some(value=>value.startsWith('+.')?suffixMatch(host,value.slice(2)):host===value);
      return false;
    });}
    for(const host of positive)assert(matches(host),'missing '+host);
    for(const host of negative)assert(!matches(host),'unexpected AI match '+host);
  });
  test(script+' custom direct exception stays ahead of new AI categories and DNS selectors',()=>{
    vm.runInContext('CUSTOM_DIRECT_DOMAINS.push("aistudio.google.com")',ctx);
    const c=output();
    assert(c.rules.indexOf('DOMAIN-SUFFIX,aistudio.google.com,DIRECT')<c.rules.indexOf('GEOSITE,google-gemini,🤖 AI'));
    const keys=Object.keys(c.dns['nameserver-policy']);
    assert(keys.indexOf('+.aistudio.google.com')<keys.indexOf('geosite:google-gemini'));
    assert.deepEqual(c.dns['nameserver-policy']['+.aistudio.google.com'],c.dns.nameserver);
  });
}
