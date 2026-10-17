"""Offline YAML checks. Requires Python 3 and PyYAML; does not run Mihomo."""
import json
from pathlib import Path
import subprocess
import unittest
import yaml
ROOT = Path(__file__).resolve().parents[1]

class UniqueLoader(yaml.SafeLoader):
    pass

def unique_mapping(loader, node, deep=False):
    result = {}
    for key_node, val_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in result:
            raise ValueError('Duplicate YAML key: ' + str(key))
        result[key] = loader.construct_object(val_node, deep=deep)
    return result
UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)

class MergeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = yaml.load((ROOT/'linkcube-generic-merge.yaml').read_text(encoding='utf-8'), Loader=UniqueLoader)

    def test_process_lookup_not_forced_globally(self):
        self.assertEqual(self.config['find-process-mode'], 'strict')

    def test_client_controls_mode_ports_and_tun_switch(self):
        for key in ['mode', 'mixed-port', 'port', 'socks-port', 'external-controller', 'allow-lan', 'ipv6']:
            self.assertNotIn(key, self.config)
        self.assertNotIn('enable', self.config['tun'])
        self.assertEqual(self.config['tun']['strict-route'], False)

    def test_explicit_fakeip_baseline_is_safe_for_replace_or_merge(self):
        d = self.config['dns']
        self.assertEqual(d['fake-ip-filter-mode'], 'blacklist')
        self.assertIn('+.lan', d['fake-ip-filter'])
        self.assertIn('+.home.arpa', d['fake-ip-filter'])
        self.assertEqual(d['ipv6'], False)

    def test_no_unrouted_foreign_fallback_in_merge(self):
        d = self.config['dns']
        self.assertFalse(d.get('fallback'))
        self.assertNotIn('geosite:gfw', d.get('nameserver-policy', {}))
        self.assertGreaterEqual(len(d['default-nameserver']), 2)
        self.assertTrue(all(x.endswith('#DIRECT') for x in d['nameserver']))

    def test_full_geodata_auto_updates_remain(self):
        self.assertTrue(self.config['geo-auto-update'])
        self.assertEqual(self.config['geo-update-interval'], 24)
        self.assertTrue(self.config['geox-url']['geo-site'].endswith('/geosite.dat'))
        self.assertNotIn('lite', self.config['geox-url']['geo-site'])

    def test_does_not_embed_nodes_hosts_or_secrets(self):
        for key in ['proxies', 'proxy-providers', 'hosts', 'secret', 'authentication']:
            self.assertNotIn(key, self.config)

    def test_actual_merge_plus_script_has_valid_dynamic_dns_references(self):
        cfg = dict(self.config)
        cfg['proxies'] = [{'name': '日本 Test', 'type': 'ss', 'server': '192.0.2.1', 'port': 10000,
                           'cipher': 'aes-128-gcm', 'password': 'TEST-ONLY'}]
        runner = "const fs=require('fs'),vm=require('vm');const c=vm.createContext({});vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);process.stdout.write(JSON.stringify(c.main(JSON.parse(fs.readFileSync(0,'utf8')))));"
        result = subprocess.run(['node', '-e', runner, str(ROOT/'linkcube-generic.js')], input=json.dumps(cfg),
                                text=True, encoding='utf-8', capture_output=True, timeout=10, check=True)
        out = json.loads(result.stdout)
        groups = {g['name'] for g in out['proxy-groups']}
        for url in out['dns']['fallback']:
            self.assertIn(url.split('#',1)[1], groups)
        for key in out['dns']['nameserver-policy']:
            if key.startswith('rule-set:'):
                for provider in key.removeprefix('rule-set:').split(','):
                    self.assertIn(provider, out['rule-providers'])
        self.assertNotIn('enable', out['tun'])
        self.assertTrue(out['dns']['direct-nameserver-follow-policy'])

    def test_standalone_matches_the_two_file_output(self):
        fixture = {'mode': 'rule', 'mixed-port': 7890,
                   'hosts': {'router.lan': '192.0.2.2'},
                   'proxies': [{'name': '日本 Test', 'type': 'ss', 'server': '192.0.2.1',
                                'port': 10000, 'cipher': 'aes-128-gcm', 'password': 'TEST-ONLY'}]}
        merged = {**self.config, **fixture}
        runner = "const fs=require('fs'),vm=require('vm');const c=vm.createContext({});vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);process.stdout.write(JSON.stringify(c.main(JSON.parse(fs.readFileSync(0,'utf8')))));"
        outputs = []
        for script, config in [('linkcube-generic.js', merged), ('flclash-single.js', fixture)]:
            result = subprocess.run(['node', '-e', runner, str(ROOT/script)], input=json.dumps(config),
                                    text=True, encoding='utf-8', capture_output=True, timeout=10, check=True)
            outputs.append(json.loads(result.stdout))
        self.assertEqual(outputs[0], outputs[1])

if __name__ == '__main__':
    unittest.main()
