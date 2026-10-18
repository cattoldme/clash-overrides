const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function output(script) {
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),context);
  return JSON.parse(JSON.stringify(context.main({proxies:[{name:'香港 Test',type:'ss',
    server:'192.0.2.1',port:10000,cipher:'aes-128-gcm',password:'TEST-ONLY'}]})));
}
for(const script of ['linkcube-generic.js','flclash-single.js']) {
  test(script+' checks HTTP 204 instead of counting error pages as healthy',()=>{
    const groups=output(script)['proxy-groups'].filter(group=>group.type!=='select');
    assert(groups.length>0);
    for(const group of groups) {
      assert.equal(group['expected-status'],'204');
      assert.equal(group.timeout,5000);
      assert.equal(group['max-failed-times'],5);
    }
  });
  test(script+' uses maintained domain sources for Disney HBO and YouTube',()=>{
    const providers=output(script)['rule-providers'];
    for(const [name,category] of [['Disney','disney'],['HBO','hbo'],['YouTube','youtube']]) {
      assert.equal(providers[name].behavior,'domain');
      assert.equal(providers[name].url,
        'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/'+category+'.yaml');
    }
  });
  test(script+' matches Global and Apple domains before their complete classical residuals',()=>{
    const c=output(script);
    for(const [name,target] of [['Global','🚀 Proxies'],['Apple','🍎 Apple']]) {
      const i=c.rules.indexOf('RULE-SET,'+name+'Domain,'+target+',no-resolve');
      assert(i>=0);
      assert.equal(c.rules[i+1],'RULE-SET,'+name+','+target+',no-resolve');
      const domain=c['rule-providers'][name+'Domain'],residual=c['rule-providers'][name];
      assert.equal(domain.behavior,'domain');
      assert.equal(domain.url,'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/'+name+'/'+name+'_Domain.yaml');
      assert.equal(residual.behavior,'classical');
      assert.equal(residual.url,'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/'+name+'/'+name+'.yaml');
      assert(i<c.rules.indexOf('GEOIP,CN,DIRECT'));
    }
  });
}

for(const [name,positive,negative] of [
  ['disney',['www.disneyplus.com','api.bamgrid.com'],
    ['tenant123.execute-api.us-east-1.amazonaws.com','assets.adobedtm.com','sdk.iad-01.braze.com','cws.conviva.com']],
  ['hbo',['www.hbo.com','www.max.com'],
    ['tenant123.execute-api.ap-southeast-1.amazonaws.com','tenant123.execute-api.us-east-1.amazonaws.com','players.brightcove.net']],
  ['youtube',['www.youtube.com','video.googlevideo.com'],
    ['edgedl.me.gvt1.com','redirector.gvt1.com','redirector.gvt2.com']],
])test(name+' reviewed upstream keeps platform hosts without unrelated shared services',()=>{
  const payload=fs.readFileSync(path.join(__dirname,'fixtures',name+'.yaml'),'utf8').split(/\r?\n/)
    .filter(line=>/^\s*-\s+/.test(line)).map(line=>line.trim().replace(/^-\s+/,''));
  const matches=host=>payload.some(rule=>rule.startsWith('+.')
    ?host===rule.slice(2)||host.endsWith(rule.slice(1)):host===rule);
  for(const host of positive)assert(matches(host),host);
  for(const host of negative)assert(!matches(host),host);
});
