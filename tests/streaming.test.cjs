const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const target='🎬 Streaming';
const services=['AmazonPrimeVideo','Netflix','Disney','HBO','Crunchyroll','ParamountPlus'];
const upstreams={
  Crunchyroll:{url:'https://raw.githubusercontent.com/liandu2024/clash/main/list/Crunchyroll.list',
    format:'text',path:'./ruleset/liandu2024/Crunchyroll.list'},
  ParamountPlus:{url:'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/ParamountPlus/ParamountPlus.yaml',
    format:'yaml',path:'./ruleset/blackmatrix7/ParamountPlus.yaml'},
};
function output(script,setup='') {
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),ctx);
  if(setup)vm.runInContext(setup,ctx);
  return JSON.parse(JSON.stringify(ctx.main({proxies:['香港','日本','新加坡','美国','台湾'].map(name=>({
    name,type:'ss',server:'192.0.2.1',port:10000,cipher:'aes-128-gcm',password:'TEST-ONLY',
  })),dns:{enable:true}})));
}
// Evaluate generated domain rules against the unmodified upstream snapshot.
function paramountRoute(config,host) {
  const payload=fs.readFileSync(path.join(__dirname,'fixtures','paramountplus.yaml'),'utf8')
    .split(/\r?\n/).map(line=>line.trim().replace(/^-\s*/,''));
  const matches=([type,domain])=>host===domain ||
    (type==='DOMAIN-SUFFIX' && host.endsWith('.'+domain));
  return config.rules.find(rule=>{
    const parts=rule.split(',');
    return (['DOMAIN','DOMAIN-SUFFIX'].includes(parts[0]) && matches(parts)) ||
      (parts[0]==='RULE-SET' && parts[1]==='ParamountPlus' &&
        payload.some(line=>matches(line.split(','))));
  })?.split(',')[2];
}
for(const script of ['linkcube-generic.js','flclash-single.js']) {
  test(script+' keeps the NBC shared manifest host on Proxies while Paramount-only hosts use Streaming',()=>{
    const c=output(script);
    assert.equal(paramountRoute(c,'link.theplatform.com'),'🚀 Proxies');
    for(const host of ['www.paramountplus.com','video.cbsaavideo.com','assets.pplusstatic.com','cbsi.live.ott.irdeto.com'])
      assert.equal(paramountRoute(c,host),target,host);
    assert.equal(paramountRoute(c,'example.theplatform.com'),undefined);
  });
  test(script+' lets a custom direct exception override the shared manifest host guard',()=>{
    const c=output(script,'CUSTOM_DIRECT_DOMAINS.push("link.theplatform.com")');
    assert.equal(paramountRoute(c,'link.theplatform.com'),'DIRECT');
  });
  test(script+' routes exactly six streaming platforms before general platform and China rules',()=>{
    const c=output(script);
    assert.deepEqual(c.rules.filter(rule=>rule.split(',')[2]===target),
      services.map(service=>'RULE-SET,'+service+','+target+',no-resolve'));
    for(const service of services) {
      const index=c.rules.indexOf('RULE-SET,'+service+','+target+',no-resolve');
      for(const fallback of ['RULE-SET,Google,🔎 Google,no-resolve','GEOSITE,cn,DIRECT','RULE-SET,Global,🚀 Proxies,no-resolve','GEOIP,CN,DIRECT'])
        assert(index<c.rules.indexOf(fallback),service+' must precede '+fallback);
      assert(c['rule-providers'][service],service+' needs a provider');
    }
  });
  test(script+' uses dedicated maintained providers for Crunchyroll and Paramount+',()=>{
    const c=output(script);
    for(const [service,expected] of Object.entries(upstreams))
      assert.deepEqual(c['rule-providers'][service],{type:'http',behavior:'classical',
        ...expected,interval:86400,proxy:'🚀 Proxies'});
    assert.equal(Object.keys(c['rule-providers']).length,33);
  });
  test(script+' keeps custom exceptions ahead of the added streaming providers',()=>{
    const domains=['api.crunchyroll.com','www.paramountplus.com'];
    const c=output(script,'CUSTOM_DIRECT_DOMAINS.push(...'+JSON.stringify(domains)+')');
    for(const [index,service] of ['Crunchyroll','ParamountPlus'].entries())
      assert(c.rules.indexOf('DOMAIN-SUFFIX,'+domains[index]+',DIRECT')<
        c.rules.indexOf('RULE-SET,'+service+','+target+',no-resolve'));
  });
}
for(const [service,positive,negative] of [
  ['Crunchyroll',['www.crunchyroll.com','video.crunchyrollcdn.com','api.crunchyrollsvc.com'],
    ['www.sony.com','example.akamaized.net','crunchyroll.com.example.org']],
  ['ParamountPlus',['www.paramountplus.com','video.cbsaavideo.com','assets.pplusstatic.com','link.theplatform.com'],
    ['www.cbsnews.com','example.theplatform.com','example.cloudfront.net','example.s3.us-west-2.amazonaws.com']],
]) test(service+' raw upstream snapshot includes platform/shared hosts without broad parent-company or CDN suffixes',()=>{
  const fixture=service==='Crunchyroll'?'crunchyroll.list':'paramountplus.yaml';
  const lines=fs.readFileSync(path.join(__dirname,'fixtures',fixture),'utf8').split(/\r?\n/)
    .map(line=>line.trim().replace(/^-\s*/,''))
    .filter(line=>line && !line.startsWith('#') && line!=='payload:');
  assert(lines.length>0);
  for(const line of lines)assert(/^(DOMAIN|DOMAIN-SUFFIX),[^,\s]+$/.test(line),line);
  const matches=host=>lines.some(line=>{
    const [type,domain]=line.split(',');
    return host===domain || (type==='DOMAIN-SUFFIX' && host.endsWith('.'+domain));
  });
  for(const host of positive)assert(matches(host),host);
  for(const host of negative)assert(!matches(host),host);
});
