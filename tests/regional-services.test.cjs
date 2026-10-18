const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const names=['香港','日本','新加坡','美国','台湾'];
const services=[['Mora','🇯🇵 JP'],['HuluUSA','🇺🇸 US'],['Peacock','🇺🇸 US'],['Pandora','🇺🇸 US'],['myTVSUPER','🇭🇰 HK']];
const sources={
  Mora:{behavior:'classical',url:'https://raw.githubusercontent.com/Hawaiine/mihomo-rules/main/ruleset/mora/mora.yaml',path:'./ruleset/hawaiine/mora.yaml'},
  myTVSUPER:{behavior:'domain',url:'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/mytvsuper.yaml',path:'./ruleset/metacubex/mytvsuper.yaml'},
};
for(const service of ['HuluUSA','Peacock','Pandora'])sources[service]={behavior:'classical',
  url:'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/'+service+'/'+service+'.yaml',
  path:'./ruleset/blackmatrix7/'+service+'.yaml'};
function load(script,setup='') {
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),ctx);
  if(setup)vm.runInContext(setup,ctx);
  return regions=>JSON.parse(JSON.stringify(ctx.main({proxies:regions.map(name=>({
    name,type:'ss',server:'192.0.2.1',port:10000,cipher:'aes-128-gcm',password:'TEST-ONLY',
  })),dns:{enable:true}})));
}
const fixtures={};
for(const [service,file] of [['Mora','mora.yaml'],['HuluUSA','huluusa.yaml'],['HuluJP','hulujp.yaml'],
  ['Peacock','peacock.yaml'],['Pandora','pandora.yaml'],['myTVSUPER','mytvsuper.yaml']])
  fixtures[service]=fs.readFileSync(path.join(__dirname,'fixtures',file),'utf8').split(/\r?\n/)
    .map(line=>line.trim().replace(/^-\s*/,''))
    .filter(line=>line && !line.startsWith('#') && line!=='payload:');
function matches(line,host) {
  if(line.startsWith('+.'))return host===line.slice(2)||host.endsWith(line.slice(1));
  const [type,value]=line.split(',');
  return type==='DOMAIN'?host===value:type==='DOMAIN-SUFFIX'&&(host===value||host.endsWith('.'+value));
}
function route(config,host) {
  for(const rule of config.rules) {
    const fields=rule.split(',');
    if(fields[0]==='RULE-SET' && fixtures[fields[1]]?.some(line=>matches(line,host)))return fields[2];
    if(matches(rule,host))return fields[2];
  }
}
for(const script of ['linkcube-generic.js','flclash-single.js']) {
  test(script+' removes the unmaintained handwritten Japan website list while retaining maintained categories',()=>{
    const c=load(script)(names);
    for(const domain of ['lemino.docomo.ne.jp','fod.fujitv.co.jp','telasa.jp','wowow.co.jp','animestore.docomo.ne.jp',
      'fanza.com','dmmgames.com','duga.jp','mgstage.com','sod.co.jp','sodprime.com','prestige-av.com',
      's1s1s1.com','moodyz.com','ideapocket.com','madonna-av.com','getchu.com','gyutto.com','digiket.com']) {
      assert(!c.rules.some(rule=>rule.startsWith('DOMAIN-SUFFIX,'+domain+',')),domain+' must not have a handwritten route');
      assert(!Object.hasOwn(c.dns['nameserver-policy'],'+.'+domain),domain+' must not have a handwritten DNS policy');
    }
    for(const service of ['Abema','DMM','HuluJP','Niconico','TVer'])
      assert(c.rules.includes('RULE-SET,'+service+',🇯🇵 JP,no-resolve'));
    for(const category of ['unext','radiko','nhk','dlsite'])
      assert(c.rules.includes('GEOSITE,'+category+',🇯🇵 JP'));
  });
  test(script+' sends the five added regional services directly to the required country groups',()=>{
    const c=load(script)(names);
    for(const [service,target] of services) {
      const index=c.rules.indexOf('RULE-SET,'+service+','+target+',no-resolve');
      assert(index>=0,service+' missing country rule');
      for(const fallback of ['RULE-SET,Disney,🎬 Streaming,no-resolve','RULE-SET,Google,🔎 Google,no-resolve','GEOSITE,cn,DIRECT','RULE-SET,Global,🚀 Proxies,no-resolve'])
        assert(index<c.rules.indexOf(fallback),service+' must precede '+fallback);
      assert.deepEqual(c['rule-providers'][service],{type:'http',format:'yaml',...sources[service],interval:86400,proxy:'🚀 Proxies'});
    }
    assert.equal(Object.keys(c['rule-providers']).length,35);
  });
  test(script+' falls back to Proxies for absent countries across all 32 region combinations',()=>{
    const main=load(script);
    for(let mask=0;mask<32;mask++) {
      const c=main(mask?names.filter((_,index)=>mask&(1<<index)):['德国']);
      const groups=new Set(c['proxy-groups'].map(group=>group.name));
      for(const [service,target] of services) {
        const expected=groups.has(target)?target:'🚀 Proxies';
        assert(c.rules.includes('RULE-SET,'+service+','+expected+',no-resolve'),service+' mask='+mask);
      }
      const jp=groups.has('🇯🇵 JP')?'🇯🇵 JP':'🚀 Proxies';
      assert(c.rules.includes('DOMAIN-SUFFIX,prod.hjholdings.tv,'+jp));
      for(const service of ['Abema','DMM','HuluJP','Niconico','TVer'])
        assert(c.rules.includes('RULE-SET,'+service+','+jp+',no-resolve'));
      for(const category of ['unext','radiko','nhk','dlsite'])
        assert(c.rules.includes('GEOSITE,'+category+','+jp));
      for(const [host,target] of [
        ['api.mora.jp','🇯🇵 JP'],['www.hulu.jp','🇯🇵 JP'],['prod.hjholdings.tv','🇯🇵 JP'],
        ['api.prod.hjholdings.tv','🇯🇵 JP'],['www.hulu.com','🇺🇸 US'],
        ['www.peacocktv.com','🇺🇸 US'],['www.pandora.com','🇺🇸 US'],['www.mytvsuper.com','🇭🇰 HK'],
      ])assert.equal(route(c,host),groups.has(target)?target:'🚀 Proxies',host+' mask='+mask);
    }
  });
  test(script+' separates Hulu JP interfaces from the US list and preserves other service domains',()=>{
    const c=load(script)(names);
    assert(fixtures.HuluUSA.includes('DOMAIN-SUFFIX,prod.hjholdings.tv'),'upstream overlap must be reproduced');
    assert(c.rules.indexOf('DOMAIN-SUFFIX,prod.hjholdings.tv,🇯🇵 JP')<c.rules.indexOf('RULE-SET,HuluUSA,🇺🇸 US,no-resolve'));
    for(const [host,target] of [
      ['api.mora.jp','🇯🇵 JP'],['www.hulu.com','🇺🇸 US'],['hulu.playback.edge.bamgrid.com','🇺🇸 US'],
      ['www.hulu.jp','🇯🇵 JP'],['prod.hjholdings.tv','🇯🇵 JP'],['api.prod.hjholdings.tv','🇯🇵 JP'],
      ['www.peacocktv.com','🇺🇸 US'],['www.pandora.com','🇺🇸 US'],['audio.p-cdn.us','🇺🇸 US'],['www.mytvsuper.com','🇭🇰 HK'],
    ])assert.equal(route(c,host),target,host);
    for(const host of ['www.sony.com','www.tvb.com','other.amazonaws.com','www.pandora.net','peacocktv.com.example.org'])
      assert.equal(route(c,host),undefined,host+' must not be captured by the added providers');
  });
  test(script+' keeps custom exceptions ahead of regional routing and DNS',()=>{
    const domains=['mora.jp','hulu.com','peacocktv.com','pandora.com','mytvsuper.com','prod.hjholdings.tv'];
    const c=load(script,'CUSTOM_DIRECT_DOMAINS.push(...'+JSON.stringify(domains)+')')(names);
    for(const host of domains) {
      assert.equal(route(c,host),'DIRECT',host);
      assert.deepEqual(c.dns['nameserver-policy']['+.'+host],c.dns.nameserver);
    }
  });
}
