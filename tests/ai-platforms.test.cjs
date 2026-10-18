const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const categories=['openai','google-gemini','anthropic','xai'];
const names=['香港','新加坡','美国','日本','台湾'];
function load(script,setup='') {
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),ctx);
  if(setup)vm.runInContext(setup,ctx);
  return regions=>JSON.parse(JSON.stringify(ctx.main({
    proxies:regions.map(name=>({name,type:'ss',server:'192.0.2.1',port:10000,cipher:'aes-128-gcm',password:'TEST-ONLY'})),
    dns:{enable:true},
  })));
}
for(const script of ['linkcube-generic.js','flclash-single.js']) {
  test(script+' keeps only nodes outside the five regions in Manual and rejects an empty selection',()=>{
    const main=load(script);
    for(let mask=0;mask<32;mask++) {
      const regional=names.filter((_,index)=>mask&(1<<index));
      for(const other of [['德国','澳大利亚'],[]]) {
        if(!regional.length && !other.length)continue;
        const c=main([...regional,...other]);
        const manual=c['proxy-groups'].find(group=>group.name==='Manual');
        assert.equal(manual.type,'select');
        assert.deepEqual(manual.proxies,other.length?other:['REJECT'],'mask '+mask);
        for(const [name,group] of [['香港','HK'],['日本','JP'],['新加坡','SG'],['美国','US'],['台湾','TW']]) {
          const region=c['proxy-groups'].find(item=>item.name===group);
          if(regional.includes(name))assert.deepEqual(region.proxies,[name]);
          else assert.equal(region,undefined);
        }
      }
    }
    const aliases=['🇭🇰 Hong Kong 01','JP Tokyo','SG Singapore','US Seattle','TW Taipei','DE Frankfurt','AU Sydney'];
    assert.deepEqual(main(aliases)['proxy-groups'].find(group=>group.name==='Manual').proxies,
      ['DE Frankfurt','AU Sydney']);
  });
  test(script+' filters Bahamut and Bilibili regions while retaining Proxies and Manual for every combination',()=>{
    const main=load(script);
    for(let mask=0;mask<32;mask++) {
      const regions=mask?names.filter((_,index)=>mask&(1<<index)):['德国'];
      const c=main(regions);
      const choices=codes=>codes.filter(([name])=>regions.includes(name)).map(([,group])=>group);
      const bahamut=[...choices([['台湾','TW'],['香港','HK']]),'Proxies','Manual'];
      const bilibili=['DIRECT',...choices([['台湾','TW'],['香港','HK'],['新加坡','SG']]),'Proxies','Manual'];
      for(const [name,expected] of [['Bahamut',bahamut],['Bilibili',bilibili]]) {
        const group=c['proxy-groups'].find(group=>group.name===name);
        assert.equal(group.type,'select');
        assert.deepEqual(group.proxies,expected,name+' mask '+mask);
      }
    }
  });
  test(script+' uses only four maintained AI categories for routing and DNS',()=>{
    const c=load(script)(names);
    assert.deepEqual(c.rules.filter(rule=>rule.endsWith(',AI')),categories.map(name=>'GEOSITE,'+name+',AI'));
    const policy=c.dns['nameserver-policy'],keys=Object.keys(policy);
    for(const category of categories) {
      assert.deepEqual(policy['geosite:'+category],c.dns.fallback);
      assert(keys.indexOf('geosite:'+category)<keys.indexOf('geosite:cn'));
      assert(c.rules.indexOf('GEOSITE,'+category+',AI')<c.rules.indexOf('GEOSITE,cn,DIRECT'));
    }
    for(const domain of ['claude.ai','anthropic.com','gemini.google.com','generativelanguage.googleapis.com','copilot.microsoft.com','sydney.bing.com','openaimerge.com'])
      assert(!Object.hasOwn(policy,'+.'+domain),'removed handwritten DNS '+domain);
  });
  test(script+' gives AI, TikTok, Spotify, Streaming, YouTube, Telegram, Google, GitHub and Steam proxy-first choices for every region combination',()=>{
    const main=load(script);
    for(let mask=0;mask<32;mask++) {
      const regions=mask?names.filter((_,index)=>mask&(1<<index)):['德国'];
      const c=main(regions);
      const expected=['Proxies',
        ...[['香港','HK'],['日本','JP'],['新加坡','SG'],['美国','US'],['台湾','TW']].filter(([name])=>regions.includes(name)).map(([,group])=>group),
        'Manual'];
      for(const name of ['AI','TikTok','Spotify','Streaming','YouTube','Telegram','Google','GitHub','Steam']) {
        const group=c['proxy-groups'].find(group=>group.name===name);
        assert.equal(group.type,'select');
        assert.deepEqual(group.proxies,expected,name);
      }
    }
  });
  test(script+' keeps custom direct exceptions ahead of each AI category and DNS selector',()=>{
    const domains=['auth.openai.com','aistudio.google.com','api.anthropic.com','grok.com'];
    const c=load(script,'CUSTOM_DIRECT_DOMAINS.push(...'+JSON.stringify(domains)+')')(names);
    const keys=Object.keys(c.dns['nameserver-policy']);
    for(let i=0;i<categories.length;i++) {
      assert(c.rules.indexOf('DOMAIN-SUFFIX,'+domains[i]+',DIRECT')<c.rules.indexOf('GEOSITE,'+categories[i]+',AI'));
      assert(keys.indexOf('+.'+domains[i])<keys.indexOf('geosite:'+categories[i]));
      assert.deepEqual(c.dns['nameserver-policy']['+.'+domains[i]],c.dns.nameserver);
    }
  });
}
