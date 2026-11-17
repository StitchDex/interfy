import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../public/Interfy-Partner-Editor.html', import.meta.url), 'utf8');
const begin = source.indexOf('function ExportPanel(');
const end = source.indexOf('function ', begin + 10);
const panel = source.slice(begin, end > begin ? end : undefined);

test('tag output offers JSON download next to .h/.idl/.cs', () => {
  assert.match(source, /<h2>태그 출력<\/h2>/);
  assert.match(source, /<button disabled=\{!selectedLabel\} onClick=\{\(\) => selectedLabel && downloadExport\(\`\/labels\/\$\{selectedLabel\.id\}\/export\/json\`/);
  assert.match(source, />태그 JSON<\/button>/);
});

test('tag JSON describes offline editing and partial-update workflow', () => {
  assert.match(source, /태그 JSON은 선택한 태그의 메시지와 참조 자료형/);
  assert.match(source, /태그 이름·소속 자체의 변경은 부분 업데이트 대상이 아닙니다/);
  assert.match(editor, /dataObject\.format!=='interfy-project'/);
  assert.match(editor, /JSON 저장/);
  assert.match(editor, /dataObject\.labels=Array\.isArray\(dataObject\.labels\)/);
});
