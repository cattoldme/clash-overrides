"""Offline coverage guard; immutable source provenance is stored with fixtures."""
import json
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import yaml

ROOT=Path(__file__).resolve().parents[1]
FIXTURES=ROOT/'tests'/'fixtures'

class ScopeTests(unittest.TestCase):
    def check(self, directory):
        return subprocess.run([sys.executable,str(ROOT/'scripts'/'check_rule_scope.py'),
                               '--snapshot',str(directory)],capture_output=True,text=True,
                              encoding='utf-8',timeout=15)

    def test_split_union_matches_pinned_full_classical_snapshot(self):
        result=self.check(FIXTURES)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        report=json.loads(result.stdout)
        self.assertEqual(report,{'Global':35190,'Apple':1593})

    def test_missing_domain_is_detected_even_if_file_hash_is_updated(self):
        with tempfile.TemporaryDirectory(prefix='.scope-test-',dir=ROOT) as directory:
            target=Path(directory)
            self.assertEqual(target.resolve().parent,ROOT.resolve())
            for filename in ['reviewed-sources.json','global-domain.yaml','global-residual.yaml',
                             'apple-domain.yaml','apple-residual.yaml']:
                shutil.copyfile(FIXTURES/filename,target/filename)
            payload=yaml.safe_load((target/'global-domain.yaml').read_text(encoding='utf-8'))
            payload['payload'].pop()
            (target/'global-domain.yaml').write_text(yaml.safe_dump(payload),encoding='utf-8')
            manifest=json.loads((target/'reviewed-sources.json').read_text(encoding='utf-8'))
            manifest['files']['global-domain.yaml']['sha256']=hashlib.sha256((target/'global-domain.yaml').read_bytes()).hexdigest()
            (target/'reviewed-sources.json').write_text(json.dumps(manifest),encoding='utf-8')
            result=self.check(target)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('Global',result.stdout+result.stderr)

    def test_classical_ip_process_and_keyword_residuals_are_kept(self):
        for name in ['global','apple']:
            rules=yaml.safe_load((FIXTURES/(name+'-residual.yaml')).read_text(encoding='utf-8'))['payload']
            kinds={rule.split(',')[0] for rule in rules}
            self.assertTrue({'IP-CIDR','IP-CIDR6','DOMAIN-KEYWORD','PROCESS-NAME'}<=kinds)

if __name__=='__main__':
    unittest.main()
