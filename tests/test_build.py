"""The generator must detect either stale import, without modifying it in check mode."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]

class BuildTests(unittest.TestCase):
    def test_check_detects_stale_mobile_even_when_desktop_is_current(self):
        with tempfile.TemporaryDirectory(prefix='.build-test-',dir=ROOT) as directory:
            target=Path(directory)
            self.assertEqual(target.resolve().parent,ROOT.resolve())
            (target/'scripts').mkdir()
            for filename in ['linkcube-generic.js','linkcube-generic-merge.yaml',
                             'flclash-single.js','flclash-mobile.js','scripts/build_flclash.py']:
                shutil.copyfile(ROOT/filename,target/filename)
            mobile=target/'flclash-mobile.js'
            mobile.write_text('// stale test import\n',encoding='utf-8')
            result=subprocess.run([sys.executable,str(target/'scripts'/'build_flclash.py'),'--check'],
                                  capture_output=True,text=True,encoding='utf-8',timeout=10)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('flclash-mobile.js',result.stdout+result.stderr)
            self.assertNotIn('flclash-single.js',result.stdout+result.stderr)
            self.assertEqual(mobile.read_text(encoding='utf-8'),'// stale test import\n')

if __name__=='__main__':
    unittest.main()
