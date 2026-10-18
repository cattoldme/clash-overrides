// Offline structure/regression tests. No DNS queries, provider downloads or real nodes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(process.env.SCRIPT_PATH || path.join(__dirname, '..', 'linkcube-generic.js'), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
function load(setup = '') {
  const ctx = vm.createContext({});
  vm.runInContext(source, ctx, {timeout: 1000});
  if (setup) vm.runInContext(setup, ctx, {timeout: 1000});
  return cfg => ctx.main(cfg);
}
function input(names = ['香港 01', '日本 01', '新加坡 01', '美国 01', '台湾 01']) {
  return {proxies: names.map(name => ({name, type: 'ss', server: '192.0.2.1', port: 10000, cipher: 'aes-128-gcm', password: 'TEST-ONLY'})),
    dns: {enable: true, 'enhanced-mode': 'fake-ip', 'nameserver-policy': {'geosite:gfw': ['tls://8.8.4.4']}},
    mode: 'rule', tun: {enable: false}, 'mixed-port': 7890};
}
function output(names) {return plain(load()(input(names)));}
test('Google offers region groups like YouTube instead of individual nodes',()=>{
  const c=output();
  const google=c['proxy-groups'].find(g=>g.name==='Google');
  const youtube=c['proxy-groups'].find(g=>g.name==='YouTube');
  assert.equal(google.type,'select');
  assert.deepEqual(google.proxies,['Proxies','HK','JP','SG','US','TW','Manual']);
  assert.deepEqual(new Set(google.proxies),new Set(youtube.proxies));
  assert(!google.proxies.some(name=>c.proxies.some(node=>node.name===name)));
});
test('Prime Video uses narrow maintained domain rules before China and Global',()=>{
  const c=output();
  const rule='RULE-SET,AmazonPrimeVideo,Streaming,no-resolve';
  assert(c.rules.includes(rule));
  assert(c.rules.indexOf(rule)<c.rules.indexOf('GEOSITE,cn,DIRECT'));
  assert(c.rules.indexOf(rule)<c.rules.indexOf('RULE-SET,Global,Proxies,no-resolve'));
  const provider=c['rule-providers'].AmazonPrimeVideo;
  assert.equal(provider.behavior,'domain');
  assert.equal(provider.interval,86400);
  assert.equal(provider.url,'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/primevideo.yaml');
});
function graph(config) {
  const groups = new Map(config['proxy-groups'].map(g => [g.name, g]));
  const valid = new Set(['DIRECT','REJECT',...config.proxies.map(p=>p.name),...groups.keys()]);
  assert.equal(groups.size, config['proxy-groups'].length);
  function visit(name, trail) {
    assert(!trail.has(name), 'cycle at '+name);
    const g = groups.get(name); if (!g) return;
    assert(g.proxies.length > 0);
    assert.equal(new Set(g.proxies).size, g.proxies.length);
    for (const n of g.proxies) {assert(valid.has(n), 'missing '+n); visit(n, new Set([...trail,name]));}
  }
  for (const name of groups.keys()) visit(name,new Set());
  for (const rule of config.rules) {
    const p=rule.split(','); const target=p[0]==='MATCH'?p[1]:p[2];
    assert(valid.has(target), 'unknown rule target '+rule);
    if(p[0]==='RULE-SET') assert(config['rule-providers'][p[1]],'unknown ruleset '+rule);
  }
  assert.equal(config.rules.filter(r=>r.startsWith('MATCH,')).length,1);
  assert(config.rules.at(-1).startsWith('MATCH,'));
}
for (let mask=1;mask<32;mask++) {
  test('valid graph for region mask '+mask,()=>graph(output(['香港','日本','新加坡','美国','台湾'].filter((_,i)=>mask&(1<<i)))));
}
test('unknown regions remain manually selectable',()=>graph(output(['德国 01','AU Sydney','RUS Moscow'])));
test('LAN IP rules precede services and do not resolve',()=>{
  const c=output();
  for(const cidr of ['127.0.0.0/8','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16','100.64.0.0/10']) {
    const i=c.rules.indexOf('IP-CIDR,'+cidr+',DIRECT,no-resolve');assert(i>=0 && i<20);
  }
  assert(c.rules.includes('GEOSITE,private,DIRECT'));
});
test('only final IP fallback is allowed to initiate routing resolution',()=>{
  const c=output();
  for(const r of c.rules.filter(r=>r.startsWith('RULE-SET,'))) assert(r.endsWith(',no-resolve'),r);
  assert.deepEqual(c.rules.slice(-2),['GEOIP,CN,DIRECT','MATCH,Final']);
});
test('known foreign domains precede resolving China IP fallback',()=>{
  const r=output().rules;
  assert(r.indexOf('RULE-SET,Global,Proxies,no-resolve')<r.indexOf('GEOIP,CN,DIRECT'));
});
test('reuse full geosite cn and remove duplicate/broad providers',()=>{
  const c=output();assert(c.rules.includes('GEOSITE,cn,DIRECT'));
  for(const key of ['Lan','Download','China','OpenAI']) assert(!Object.hasOwn(c['rule-providers'],key),key);
});
test('OpenAI uses maintained domain categories, not shared ASN rules',()=>{
  const r=output().rules;assert(r.includes('GEOSITE,openai,AI'));
  assert(!r.some(x=>x.startsWith('IP-ASN,')||x.includes('DOMAIN-KEYWORD,openai')));
});
test('four AI categories precede Microsoft and Google',()=>{
  const r=output().rules;
  for(const category of ['openai','google-gemini','anthropic','xai']) {
    const i=r.indexOf('GEOSITE,'+category+',AI');
    assert(i>=0 && i<r.indexOf('RULE-SET,Microsoft,Microsoft,no-resolve'));
    assert(i<r.indexOf('RULE-SET,Google,Google,no-resolve'));
  }
});

test('Steam CDN stays direct; store rules beat broad Steam matching',()=>{
  const r=output().rules;
  const store=r.indexOf('RULE-SET,SteamWeb,Steam,no-resolve');
  const cdn=r.indexOf('RULE-SET,SteamCN,DIRECT,no-resolve');
  const steam=r.indexOf('RULE-SET,Steam,Steam,no-resolve');
  assert(store>=0 && cdn>store && steam>cdn);
  assert(r.includes('RULE-SET,GameDownload,DIRECT,no-resolve'));
  assert(!r.includes('PROCESS-NAME,steam.exe,DIRECT'));
  assert(!r.includes('PROCESS-NAME,steamservice.exe,DIRECT'));
});
test('only dedicated torrent process fallback, no general download bypass',()=>{
  const r=output().rules;assert(r.includes('PROCESS-NAME,qbittorrent.exe,DIRECT'));
  assert(!r.some(x=>x.includes('aria2c')||x.includes('fdm')||x.includes('RULE-SET,Download,')));
  assert(r.indexOf('GEOSITE,cn,DIRECT')<r.indexOf('PROCESS-NAME,qbittorrent.exe,DIRECT'));
});
test('domestic-oriented groups still default direct',()=>{
  const c=output();for(const name of ['Bilibili','Microsoft','Apple','PayPal'])
    assert.equal(c['proxy-groups'].find(g=>g.name===name).proxies[0],'DIRECT');
});
test('explicitly routed encrypted foreign DNS, domestic DNS and bootstrap',()=>{
  const d=output().dns;assert(d.fallback.length>=2);
  for(const s of d.fallback) assert(s.startsWith('https://')&&s.endsWith('#Proxies'),s);
  for(const key of ['nameserver','direct-nameserver','proxy-server-nameserver'])
    assert(d[key].length>=2 && d[key].every(s=>s.endsWith('#DIRECT')));
  assert.equal(d['respect-rules'],false);
  assert.equal(d['direct-nameserver-follow-policy'],true);
  assert.equal(d['fallback-lazy-query'],true);
  assert.deepEqual(d['nameserver-policy']['geosite:gfw'],d.fallback);
  assert.deepEqual(d['nameserver-policy']['geosite:private'],['system']);
});
test('DNS strips stale rule-provider policy references and keeps local domain override',()=>{
  const c=input();c.dns['nameserver-policy']={'rule-set:OldRules':['1.0.0.1'],'+.corp.example':['192.168.1.1']};
  const d=plain(load()(c)).dns;assert(!d['nameserver-policy']['rule-set:OldRules']);
  assert.deepEqual(d['nameserver-policy']['+.corp.example'],['192.168.1.1']);
});
test('fake-ip blacklist keeps existing entries; LAN/WeChat compatibility appended once',()=>{
  const c=input();c.dns['fake-ip-filter']=['+.example.com','+.weixin.qq.com'];
  const f=plain(load()(c)).dns['fake-ip-filter'];
  for(const v of ['+.example.com','+.weixin.qq.com','+.lan','+.home.arpa']) assert(f.includes(v),v);
  assert.equal(f.length,new Set(f).size);
});
for(const mode of ['whitelist','rule']) test('preserve '+mode+' fake-ip filter semantics',()=>{
  const c=input();c.dns['fake-ip-filter-mode']=mode;c.dns['fake-ip-filter']=['MATCH,fake-ip'];
  assert.deepEqual(plain(load()(c)).dns['fake-ip-filter'],['MATCH,fake-ip']);
});
test('explicit DNS disabled remains untouched',()=>{
  const c=input();c.dns.enable=false;const before=plain(c.dns);assert.deepEqual(plain(load()(c)).dns,before);
});
test('no DNS object means script does not silently enable it',()=>{
  const c=input();delete c.dns;assert(!Object.hasOwn(load()(c),'dns'));
});
test('null, empty and provider-only inputs are unchanged',()=>{
  const main=load();for(const c of [null,{}, {proxies:[]}, {'proxy-providers':{p:{type:'file',path:'./p.yaml'}}}])
    assert.equal(main(c),c);
});
test('mixed provider subscription is left intact, not silently truncated',()=>{
  const c=input();c['proxy-providers']={p:{type:'file',path:'./p.yaml'}};const before=plain(c);
  assert.deepEqual(plain(load()(c)),before);
});
test('duplicate nodes rejected before mutating config',()=>{
  const c=input(['日本','日本']);const before=plain(c);assert.throws(()=>load()(c),/重名|duplicate/i);assert.deepEqual(c,before);
});
test('generated group/node name collision rejected',()=>{
  assert.throws(()=>load()(input(['Proxies'])),/冲突|collision/i);
});
test('node credentials and client mode/TUN/ports are not rewritten',()=>{
  const c=input();const nodes=plain(c.proxies);c.mode='global';c.tun.enable=true;
  const out=plain(load()(c));assert.deepEqual(out.proxies,nodes);assert.equal(out.mode,'global');
  assert.equal(out.tun.enable,true);assert.equal(out['mixed-port'],7890);
});
test('reapplying overwrite is idempotent',()=>{
  const main=load(), c=input();main(c);const before=plain(c);main(c);assert.deepEqual(plain(c),before);
});
test('unused group probes are lazy',()=>{
  for(const g of output()['proxy-groups'].filter(g=>g.type==='url-test'||g.type==='fallback')) assert.equal(g.lazy,true);
});
test('country flags do not misclassify AUS or RUS as US',()=>{
  const c=output(['AUS Sydney','RUS Moscow','日本 01']);assert(!c['proxy-groups'].some(g=>g.name==='US'));
});
test('user overrides affect both traffic and DNS; proxy override wins conflicts',()=>{
  const c=plain(load('CUSTOM_DIRECT_DOMAINS.push("assets.example.com");CUSTOM_PROXY_DOMAINS.push("secure.example.com");')(input()));
  assert(c.rules.includes('DOMAIN-SUFFIX,assets.example.com,DIRECT'));
  assert(c.rules.includes('DOMAIN-SUFFIX,secure.example.com,Proxies'));
  assert.deepEqual(c.dns['nameserver-policy']['+.assets.example.com'],c.dns.nameserver);
  assert.deepEqual(c.dns['nameserver-policy']['+.secure.example.com'],c.dns.fallback);
});
// Mihomo matches policy segments in order; domain specificity cannot beat an earlier category.
for(const [domain,selector,direct] of [
  ['claude.ai','geosite:gfw',true],
  ['auth.openai.com','geosite:openai',true],
  ['qq.com','geosite:cn',false],
  ['cdn.steamstatic.com','rule-set:SteamCN,GameDownload',false],
]) test('custom DNS exception precedes overlapping '+selector,()=>{
  const list=direct?'CUSTOM_DIRECT_DOMAINS':'CUSTOM_PROXY_DOMAINS';
  const main=load(list+'.push('+JSON.stringify(domain)+');'), c=input();
  for(let pass=0;pass<2;pass++) {
    const out=plain(main(c)), policy=out.dns['nameserver-policy'], keys=Object.keys(policy);
    const key='+.'+domain;
    assert(keys.indexOf(key)>=0 && keys.indexOf(key)<keys.indexOf(selector),key+' must precede '+selector);
    assert.deepEqual(policy[key],direct?out.dns.nameserver:out.dns.fallback);
    assert(out.rules.includes('DOMAIN-SUFFIX,'+domain+','+(direct?'DIRECT':'Proxies')));
  }
});
test('custom domain must not inject malformed rule text',()=>{
  assert.throws(()=>load('CUSTOM_DIRECT_DOMAINS.push("bad.example,DIRECT");')(input()),/域名|domain/i);
});
test('more-specific custom domain wins consistently with DNS suffix policy',()=>{
  const c=plain(load('CUSTOM_PROXY_DOMAINS.push("example.com");CUSTOM_DIRECT_DOMAINS.push("cdn.example.com");')(input()));
  assert(c.rules.indexOf('DOMAIN-SUFFIX,cdn.example.com,DIRECT')<c.rules.indexOf('DOMAIN-SUFFIX,example.com,Proxies'));
});
test('same custom suffix listed twice resolves to proxy once',()=>{
  const c=plain(load('CUSTOM_PROXY_DOMAINS.push("same.example");CUSTOM_DIRECT_DOMAINS.push("same.example");')(input()));
  const r=c.rules.filter(r=>r.includes(',same.example,'));assert.deepEqual(r,['DOMAIN-SUFFIX,same.example,Proxies']);
});
test('node chain referencing removed subscription group fails before mutation',()=>{
  const c=input();c.proxies[0]['dialer-proxy']='Old subscription group';const before=plain(c);
  assert.throws(()=>load()(c),/链式|dialer/i);assert.deepEqual(c,before);
});
test('node chain referencing retained raw node is preserved',()=>{
  const c=input();c.proxies[0]['dialer-proxy']=c.proxies[1].name;const before=plain(c.proxies);
  assert.deepEqual(plain(load()(c)).proxies,before);
});
test('unclassified host resolving to LAN or CGNAT gets a late direct fallback',()=>{
  const r=output().rules;
  const i=r.indexOf('GEOIP,lan,DIRECT');assert(i>=0);
  assert(i>r.indexOf('RULE-SET,Global,Proxies,no-resolve'));
  assert.deepEqual(r.slice(i,i+4),['GEOIP,lan,DIRECT','IP-CIDR,100.64.0.0/10,DIRECT,no-resolve','GEOIP,CN,DIRECT','MATCH,Final']);
});

for (const [service, name] of [['TikTok', 'TikTok'], ['Spotify', 'Spotify']]) {
  test(service+' has an independent proxy-default group before general routing',()=>{
    const c=output();
    const g=c['proxy-groups'].find(g=>g.name===name);
    assert(g, 'missing independent group');
    assert.equal(g.type,'select');
    assert.deepEqual(g.proxies,['Proxies','HK','JP','SG','US','TW','Manual']);
    const rule='RULE-SET,'+service+','+name+',no-resolve';
    assert(c.rules.includes(rule));
    for(const fallback of ['GEOSITE,cn,DIRECT','RULE-SET,Global,Proxies,no-resolve','GEOIP,CN,DIRECT','MATCH,Final'])
      assert(c.rules.indexOf(rule)<c.rules.indexOf(fallback));
    assert(!c.rules.includes('RULE-SET,'+service+',Streaming,no-resolve'));
    const provider=c['rule-providers'][service];
    assert.equal(provider.url,'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/'+service+'/'+service+'.yaml');
    assert.equal(provider.behavior,'classical');
    assert.equal(provider.interval,86400);
    assert.equal(c['proxy-groups'].find(g=>g.name==='Proxies').proxies[0],'Auto');
  });
  test(service+' offers every existing region, Proxies and Manual for all region combinations',()=>{
    for(let mask=1;mask<32;mask++) {
      const c=output(['香港','日本','新加坡','美国','台湾'].filter((_,i)=>mask&(1<<i)));
      const regions=['HK','JP','SG','US','TW'].filter(region=>c['proxy-groups'].some(g=>g.name===region));
      assert.deepEqual(c['proxy-groups'].find(g=>g.name===name).proxies,['Proxies',...regions,'Manual']);
      graph(c);
    }
  });
  test(service+' still defaults to Proxies when US nodes are absent',()=>{
    for(const names of [['香港 01'],['香港 01','日本 01','新加坡 01'],['德国 01']]) {
      const c=output(names);
      const regions=['HK','JP','SG','TW'].filter(region=>c['proxy-groups'].some(g=>g.name===region));
      assert.deepEqual(c['proxy-groups'].find(g=>g.name===name).proxies,['Proxies',...regions,'Manual']);
      graph(c);
    }
  });
}

const privateProvider = {type:'inline',behavior:'domain',payload:['+.office.example']};
test('DNS retains only providers referenced by preserved fake-IP and proxy-server policies',()=>{
  const c=input();
  c['rule-providers']={private:privateProvider,extra:{...privateProvider},unused:{...privateProvider}};
  c.dns['fake-ip-filter-mode']='rule';
  c.dns['fake-ip-filter']=['RULE-SET,private,real-ip','MATCH,fake-ip'];
  c.dns['proxy-server-nameserver-policy']={'rule-set:private,extra':['192.0.2.53']};
  const out=plain(load()(c));
  assert.deepEqual(out['rule-providers'].private,privateProvider);
  assert.deepEqual(out['rule-providers'].extra,privateProvider);
  assert(!Object.hasOwn(out['rule-providers'],'unused'));
  assert.deepEqual(plain(load()(plain(out))),out);
});
for(const kind of ['missing','collision','provider-old-group']) test('DNS rejects '+kind+' dependencies before modifying input',()=>{
  const c=input();
  const name=kind==='collision'?'Netflix':'private';
  c.dns['fake-ip-filter-mode']='rule';
  c.dns['fake-ip-filter']=['RULE-SET,'+name+',real-ip','MATCH,fake-ip'];
  c['proxy-groups']=[{name:'OldGroup',type:'select',proxies:['DIRECT']}];
  if(kind!=='missing') c['rule-providers']={[name]:{...privateProvider,...(kind==='provider-old-group'?{proxy:'OldGroup'}:{})}};
  const before=plain(c);
  assert.throws(()=>load()(c),/DNS|规则集|出口/);
  assert.deepEqual(c,before);
});
for(const field of ['nameserver-policy','proxy-server-nameserver-policy']) {
  for(const encoded of [false,true]) test('DNS rejects removed group in '+field+' encoded='+encoded+' before mutation',()=>{
    const c=input();
    c['proxy-groups']=[{name:'Old Group',type:'select',proxies:['DIRECT']}];
    c.dns[field]={'office.example':'https://192.0.2.53/dns-query#'+(encoded?'Old%20Group':'Old Group')+'&h3=true'};
    const before=plain(c);
    assert.throws(()=>load()(c),/Old Group/);
    assert.deepEqual(c,before);
  });
}
test('DNS keeps real interface selectors and retained node exits',()=>{
  const c=input();
  c.dns['nameserver-policy']={'office.example':['https://192.0.2.53/dns-query#Ethernet&h3=true','udp://192.0.2.54#'+c.proxies[0].name]};
  const expected=plain(c.dns['nameserver-policy']['office.example']);
  assert.deepEqual(plain(load()(c)).dns['nameserver-policy']['office.example'],expected);
});
test('Netflix uses narrow maintained domain rules rather than shared AWS ranges',()=>{
  const provider=output()['rule-providers'].Netflix;
  assert.equal(provider.behavior,'domain');
  assert.equal(provider.url,'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.yaml');
  assert.equal(provider.path,'./ruleset/metacubex/netflix.yaml');
});

for(const mode of [undefined,'blacklist','whitelist']) test('DNS preserves domain-set filter dependency in '+mode,()=>{
  const c=input();
  if(mode) c.dns['fake-ip-filter-mode']=mode;
  c.dns['fake-ip-filter']=['rule-set:private'];
  c['rule-providers']={private:privateProvider};
  const out=plain(load()(c));
  assert.deepEqual(out['rule-providers'].private,privateProvider);
  assert(out.dns['fake-ip-filter'].includes('rule-set:private'));
});

test('unused old providers may collide with rebuilt names without blocking ordinary subscriptions',()=>{
  const c=input();
  c['rule-providers']={SteamCN:privateProvider,GameDownload:privateProvider};
  const out=plain(load()(c));
  assert.notDeepEqual(out['rule-providers'].SteamCN,privateProvider);
  assert.notDeepEqual(out['rule-providers'].GameDownload,privateProvider);
});
test('equivalent referenced built-in provider permits different YAML field order',()=>{
  const c=output();
  const entries=Object.entries(c['rule-providers'].Netflix).reverse();
  c['rule-providers'].Netflix=Object.fromEntries(entries);
  c.dns['fake-ip-filter-mode']='rule';
  c.dns['fake-ip-filter']=['RULE-SET,Netflix,real-ip','MATCH,fake-ip'];
  assert.doesNotThrow(()=>load()(c));
});
