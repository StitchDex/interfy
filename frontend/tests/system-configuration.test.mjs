import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/SystemConfigurationPanel.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/systemConfiguration.css', import.meta.url), 'utf8');

test('system configuration is a separate design menu, not a replacement', () => {
  assert.match(main, /인터페이스 설계<\/button>/);
  assert.match(main, /체계 구성<\/button>/);
  assert.match(main, /<SystemConfigurationPanel/);
  assert.match(main, /systemConfiguration: '체계 구성'/);
});

test('system configuration exposes three modules with CRUD forms', () => {
  for (const label of ['장비·SW', 'IP·NIC', '통신 연결']) {
    assert.ok(panel.includes(label));
  }
  assert.match(panel, /api\.put\(/);
  assert.match(panel, /api\.post\(/);
  assert.match(panel, /api\.patch\(/);
  assert.match(panel, /api\.del\(/);
});

test('device profile links to existing node identity, reserved IP and binding-based server/client endpoints', () => {
  assert.match(panel, /item\.node_id/);
  assert.match(panel, /hardware_name/);
  assert.match(panel, /software_id/);
  assert.match(panel, /is_reserved/);
  assert.match(panel, /server_binding_id/);
  assert.match(panel, /client_binding_id/);
  assert.match(styles, /\.system-config-form/);
});
