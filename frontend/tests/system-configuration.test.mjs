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

test('sidebar keeps output immediately below system configuration, before management pages', () => {
  const sidebar = main.slice(
    main.indexOf('<aside className="message-sidebar compact-sidebar">'),
    main.indexOf('</aside>', main.indexOf('<aside className="message-sidebar compact-sidebar">')),
  );
  const items = ['인터페이스 설계</button>', '체계 구성</button>', '출력</button>', '프로젝트 설정</button>', '이력 관리</button>', '계정</button>'];
  const positions = items.map(item => sidebar.indexOf(item));
  assert.ok(positions.every(position => position >= 0), 'all sidebar items should exist');
  assert.ok(positions.every((position, i) => i === 0 || position > positions[i - 1]), 'sidebar order should match design, output, management');
  assert.ok(!sidebar.includes('>산출</div>'));
});

test('left editors precede their right-hand tables for IP, port and connections', () => {
  const ipSection = panel.slice(panel.indexOf("{loaded && tab === 'ips'"), panel.indexOf("{loaded && tab === 'connections'"));
  const connectionSection = panel.slice(panel.indexOf("{loaded && tab === 'connections'"));
  assert.equal((ipSection.match(/className="system-config-split"/g) || []).length, 2);
  assert.equal((connectionSection.match(/className="system-config-split"/g) || []).length, 1);
  for (const [section, editor, list] of [
    [ipSection, 'IP 할당 추가', 'IP 주소 할당'],
    [ipSection, 'IP / PORT 바인딩 추가', '<h3>포트 바인딩</h3>'],
    [connectionSection, '통신 연결 추가', 'system-connection-list'],
  ]) {
    assert.ok(section.indexOf(editor) >= 0 && section.indexOf(editor) < section.indexOf(list),
      `${editor} editor must precede its list`);
  }
  assert.equal((panel.match(/className="system-config-form system-config-form-compact"/g) || []).length, 3);
  assert.match(styles, /grid-template-columns: minmax\(265px, 310px\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.system-config-table th, \.system-config-table td \{ padding: 7px 8px; font-size: 12px;/);
});
