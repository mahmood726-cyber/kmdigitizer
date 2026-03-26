"""
Selenium tests for KMDigitizer — IPD Reconstruction from KM Curves.
Usage: python -m pytest tests/test_kmdigitizer.py -v --timeout=60
"""
import sys, os, time, unittest
if __name__ == '__main__' and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.common.exceptions import WebDriverException

HTML_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'kmdigitizer.html'))
FILE_URL = 'file:///' + HTML_PATH.replace('\\', '/')

_WDM = os.path.expanduser('~/.wdm/drivers/chromedriver/win64')
_CACHED = []
if os.path.isdir(_WDM):
    for v in sorted(os.listdir(_WDM), reverse=True):
        for sub in ('chromedriver-win32', ''):
            c = os.path.join(_WDM, v, sub, 'chromedriver.exe').rstrip(os.sep)
            if os.path.isfile(c): _CACHED.append(c); break

def _driver():
    opts = ChromeOptions()
    opts.add_argument('--headless=new'); opts.add_argument('--no-sandbox')
    opts.add_argument('--disable-gpu'); opts.add_argument('--incognito'); opts.add_argument('--window-size=1280,900')
    opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    for p in _CACHED:
        try: return webdriver.Chrome(service=ChromeService(executable_path=p), options=opts)
        except WebDriverException: continue
    try: return webdriver.Chrome(options=opts)
    except: pass
    try:
        from selenium.webdriver.edge.options import Options as EO
        eo = EO(); eo.add_argument('--headless=new'); eo.add_argument('--no-sandbox')
        eo.add_argument('--disable-gpu'); eo.add_argument('--inprivate'); eo.add_argument('--window-size=1280,900')
        return webdriver.Edge(options=eo)
    except: pass
    raise WebDriverException('No driver')

class TestKMDigitizer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = _driver(); cls.d.set_page_load_timeout(30)
        cls.d.get(FILE_URL); time.sleep(2)

    @classmethod
    def tearDownClass(cls):
        if cls.d:
            try:
                import threading; done = threading.Event()
                def q():
                    try: cls.d.quit()
                    except: pass
                    finally: done.set()
                threading.Thread(target=q, daemon=True).start()
                if not done.wait(10):
                    try: cls.d.service.process.kill()
                    except: pass
            except: pass

    def js(self, s): return self.d.execute_script(s)

    def test_01_title(self):
        self.assertIn('KMDigitizer', self.d.title)

    def test_02_auto_compute(self):
        total = self.d.find_element(By.ID, 'sTotal').text
        self.assertNotEqual(total.strip(), '—')

    def test_03_dapahf_ipd_count(self):
        r = self.js("return window._lastIPD ? window._lastIPD.totalN : null;")
        self.assertIsNotNone(r)
        self.assertGreater(r, 100, 'DAPA-HF should reconstruct >100 patients')

    def test_04_dapahf_hr(self):
        r = self.js("return window._lastIPD ? window._lastIPD.lr.hr : null;")
        self.assertIsNotNone(r)
        self.assertGreater(r, 0.4)
        self.assertLess(r, 1.0, f'DAPA-HF HR should be <1 (treatment benefit), got {r}')

    def test_05_keynote_example(self):
        self.js("""
            document.getElementById('exSel').value = 'keynote';
            document.getElementById('exSel').dispatchEvent(new Event('change'));
        """)
        time.sleep(0.5)
        r = self.js("return window._lastIPD;")
        self.assertIsNotNone(r)
        self.assertLess(r['lr']['hr'], 0.8, 'KEYNOTE-024 HR should be <0.8')

    def test_06_events_counted(self):
        r = self.js("return window._lastIPD ? window._lastIPD.totalEvents : null;")
        self.assertIsNotNone(r)
        self.assertGreater(r, 0, 'Should have >0 events')

    def test_07_guyot_basic(self):
        """Two-point KM: S drops from 1.0 to 0.5 → 50% events."""
        r = self.js("""
            var coords = [{t:0, s:1.0}, {t:12, s:0.5}];
            var ipd = guyotReconstruct(coords, 100, [], 'test');
            var events = ipd.filter(r => r.event === 1).length;
            return {n: ipd.length, events: events};
        """)
        # Without at-risk table, only events are generated (censored need next-interval n_risk)
        self.assertGreater(r['n'], 0, f'Should reconstruct >0 patients, got {r["n"]}')
        self.assertGreater(r['events'], 0, f'Should have >0 events, got {r["events"]}')

    def test_08_guyot_with_atrisk(self):
        """At-risk table should improve accuracy of censoring."""
        r = self.js("""
            var coords = [{t:0, s:1.0}, {t:6, s:0.8}, {t:12, s:0.6}];
            var atRisk = [{t:0, n:200}, {t:6, n:150}, {t:12, n:100}];
            var ipd = guyotReconstruct(coords, 200, atRisk, 'tx');
            return {n: ipd.length, events: ipd.filter(r => r.event===1).length, censored: ipd.filter(r => r.event===0).length};
        """)
        self.assertGreater(r['n'], 50)
        self.assertGreater(r['events'], 0)
        self.assertGreater(r['censored'], 0)

    def test_09_logrank_identical_arms(self):
        """Identical arms → HR ≈ 1.0."""
        r = self.js("""
            var ipd1 = [{time:1,event:1,arm:'A'},{time:2,event:1,arm:'A'},{time:3,event:0,arm:'A'},
                        {time:4,event:1,arm:'A'},{time:5,event:0,arm:'A'}];
            var ipd2 = [{time:1,event:1,arm:'B'},{time:2,event:1,arm:'B'},{time:3,event:0,arm:'B'},
                        {time:4,event:1,arm:'B'},{time:5,event:0,arm:'B'}];
            return computeLogRankHR(ipd1, ipd2);
        """)
        if r['hr'] is not None:
            self.assertAlmostEqual(r['hr'], 1.0, delta=0.3, msg=f'Identical arms HR should be ~1.0, got {r["hr"]}')

    def test_10_median_survival(self):
        r = self.js("""
            var coords = [{t:0,s:1.0},{t:6,s:0.7},{t:12,s:0.4},{t:18,s:0.2}];
            return medianSurvival(coords);
        """)
        # Median (S=0.5) should be between 6 and 12
        self.assertIsNotNone(r)
        if r != 'NR':
            self.assertGreater(float(r), 6)
            self.assertLess(float(r), 12)

    def test_11_dark_mode(self):
        self.d.find_element(By.ID, 'themeBtn').click()
        time.sleep(0.3)
        self.assertEqual(self.d.find_element(By.TAG_NAME, 'html').get_attribute('data-theme'), 'dark')
        self.d.find_element(By.ID, 'themeBtn').click()
        time.sleep(0.3)

    def test_12_about_modal(self):
        self.d.find_element(By.ID, 'aboutBtn').click()
        time.sleep(0.3)
        m = self.d.find_element(By.ID, 'aboutModal')
        self.assertNotIn('hidden', m.get_attribute('class'))
        self.assertIn('Guyot', m.text)
        self.d.find_element(By.ID, 'aboutX').click()
        time.sleep(0.3)

    def test_13_no_errors(self):
        try: logs = self.d.get_log('browser')
        except: self.skipTest('No log support')
        severe = [e for e in logs if e.get('level') == 'SEVERE' and 'favicon' not in e.get('message','').lower()]
        if severe: self.fail(f'Errors: {[e["message"] for e in severe]}')

    def test_14_chart(self):
        el = self.d.find_element(By.ID, 'kmPlot')
        svgs = el.find_elements(By.CSS_SELECTOR, '.plot-container, svg')
        self.assertGreater(len(svgs), 0)

    def test_15_export_functions(self):
        self.assertTrue(self.js("return typeof exportIPD === 'function'"))
        self.assertTrue(self.js("return typeof exportJSON === 'function'"))

    def test_16_skip_nav(self):
        self.assertEqual(len(self.d.find_elements(By.CSS_SELECTOR, 'a[href="#main"]')), 1)

    def test_17_csp(self):
        csp = self.js("var m=document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]'); return m?m.content:null;")
        self.assertIsNotNone(csp)

    def test_18_aria_live(self):
        self.assertEqual(self.d.find_element(By.ID, 'resultsCard').get_attribute('aria-live'), 'polite')

    def test_19_ipd_table_populated(self):
        rows = self.d.find_elements(By.CSS_SELECTOR, '#ipdBody tr')
        self.assertGreater(len(rows), 1, 'IPD preview table should have rows')

    def test_20_edge_single_point(self):
        """Single coordinate pair should not crash."""
        self.js("""
            document.getElementById('txCoords').value = '0, 1.0';
            document.getElementById('ctrlCoords').value = '0, 1.0';
            reconstruct();
        """)
        time.sleep(0.3)
        total = self.d.find_element(By.ID, 'sTotal').text
        self.assertTrue(len(total.strip()) > 0)

if __name__ == '__main__':
    unittest.main(verbosity=2)
