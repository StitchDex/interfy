import React, { useEffect, useMemo, useState } from 'react';
import { Cable, Cpu, EthernetPort, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import './systemConfiguration.css';

const EMPTY_CONFIGURATION = { nodes: [], ip_assignments: [], connections: [] };
const EMPTY_IP = { node_id: '', interface_name: '', ip_address: '', is_reserved: false, note: '' };
const EMPTY_CONNECTION = { server_ip_id: '', server_port: '', client_ip_id: '', client_port: '', protocol: 'TCP', note: '' };

function NodePicker({ nodes, value, onChange, label = '노드' }) {
  return (
    <label>{label}
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">노드 선택</option>
        {nodes.map(node => <option key={node.node_id} value={node.node_id}>{node.name}</option>)}
      </select>
    </label>
  );
}

export default function SystemConfigurationPanel({ api, projectId, onGoToDesign }) {
  const [tab, setTab] = useState('nodes');
  const [configuration, setConfiguration] = useState(EMPTY_CONFIGURATION);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [profile, setProfile] = useState({});
  const [ipDraft, setIpDraft] = useState(EMPTY_IP);
  const [editingIp, setEditingIp] = useState(null);
  const [connectionDraft, setConnectionDraft] = useState(EMPTY_CONNECTION);
  const [editingConnection, setEditingConnection] = useState(null);

  const base = `/projects/${projectId}/system-configuration`;
  const nodes = configuration.nodes;
  const ips = configuration.ip_assignments;
  const connections = configuration.connections;
  const node = useMemo(() => nodes.find(item => String(item.node_id) === String(nodeId)), [nodes, nodeId]);

  async function reload() {
    const data = await api.get(base);
    setConfiguration(data);
    setLoaded(true);
    setNodeId(current => data.nodes.some(row => String(row.node_id) === String(current)) ? current : (data.nodes[0]?.node_id ? String(data.nodes[0].node_id) : ''));
    return data;
  }

  useEffect(() => {
    setLoaded(false);
    setNodeId('');
    setIpDraft(EMPTY_IP);
    setEditingIp(null);
    setConnectionDraft(EMPTY_CONNECTION);
    setEditingConnection(null);
    setNotice('');
    reload().catch(error => setNotice(error.message));
  }, [projectId]);

  useEffect(() => {
    setProfile({
      device_id: node?.device_id == null ? '' : String(node.device_id),
      hardware_name: node?.hardware_name || '',
      hostname: node?.hostname || '',
      hardware_id: node?.hardware_id || '',
      software_id: node?.software_id || '',
      note: node?.note || '',
    });
  }, [nodeId, node?.device_id, node?.hardware_name, node?.hostname, node?.hardware_id, node?.software_id, node?.note]);

  async function execute(action, successMessage) {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      await action();
      await reload();
      setNotice(successMessage);
    } catch (error) {
      setNotice(`처리 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveNode(event) {
    event.preventDefault();
    if (!nodeId) return;
    await execute(async () => {
      await api.put(`${base}/nodes/${nodeId}`, {
        ...profile, device_id: profile.device_id === '' ? null : Number(profile.device_id),
      });
    }, '장비·SW 식별 정보를 저장했습니다.');
  }

  function selectIpForEdit(item) {
    setEditingIp(item.id);
    setIpDraft({ node_id: String(item.node_id), interface_name: item.interface_name, ip_address: item.ip_address, is_reserved: item.is_reserved, note: item.note || '' });
  }

  function clearIpForm() {
    setEditingIp(null);
    setIpDraft({ ...EMPTY_IP, node_id: nodeId || (nodes[0]?.node_id ? String(nodes[0].node_id) : '') });
  }

  async function saveIp(event) {
    event.preventDefault();
    await execute(async () => {
      const body = { ...ipDraft, node_id: Number(ipDraft.node_id), ip_address: ipDraft.ip_address.trim() };
      if (editingIp !== null) await api.patch(`${base}/ips/${editingIp}`, body);
      else await api.post(`${base}/ips`, body);
      clearIpForm();
    }, editingIp !== null ? 'IP 할당을 수정했습니다.' : 'IP를 등록했습니다.');
  }

  async function deleteIp(item) {
    if (!confirm(`${item.node_name} · ${item.ip_address} 할당을 삭제할까요?`)) return;
    await execute(async () => {
      await api.del(`${base}/ips/${item.id}`);
      if (editingIp === item.id) clearIpForm();
    }, 'IP 할당을 삭제했습니다.');
  }

  function selectConnectionForEdit(item) {
    setEditingConnection(item.id);
    setConnectionDraft({
      server_ip_id: String(item.server_ip_id),
      server_port: String(item.server_port),
      client_ip_id: String(item.client_ip_id),
      client_port: item.client_port == null ? '' : String(item.client_port),
      protocol: item.protocol,
      note: item.note || '',
    });
  }

  async function saveConnection(event) {
    event.preventDefault();
    await execute(async () => {
      const body = {
        ...connectionDraft,
        server_ip_id: Number(connectionDraft.server_ip_id),
        client_ip_id: Number(connectionDraft.client_ip_id),
        server_port: Number(connectionDraft.server_port),
        client_port: connectionDraft.client_port === '' ? null : Number(connectionDraft.client_port),
      };
      if (editingConnection !== null) await api.patch(`${base}/connections/${editingConnection}`, body);
      else await api.post(`${base}/connections`, body);
      setEditingConnection(null);
      setConnectionDraft(EMPTY_CONNECTION);
    }, editingConnection !== null ? '통신 연결을 수정했습니다.' : '통신 연결을 추가했습니다.');
  }

  async function deleteConnection(item) {
    if (!confirm(`${item.server_ip}:${item.server_port} ↔ ${item.client_ip} 연결을 삭제할까요?`)) return;
    await execute(async () => {
      await api.del(`${base}/connections/${item.id}`);
      if (editingConnection === item.id) { setEditingConnection(null); setConnectionDraft(EMPTY_CONNECTION); }
    }, '통신 연결을 삭제했습니다.');
  }

  return (
    <div className="system-config-page">
      <section className="card system-config-intro">
        <div>
          <h2>체계 구성</h2>
          <p>인터페이스 설계의 노드를 기준으로 장비 ID, 탑재 HW, 고유 식별자, IP/NIC 및 통신 연결을 한곳에서 관리합니다.</p>
        </div>
        <button type="button" className="ghost" onClick={() => execute(reload, '최신 정보를 불러왔습니다.')} disabled={busy}><RefreshCw size={15}/> 새로고침</button>
      </section>

      <div className="system-config-tabs" role="tablist" aria-label="체계 구성 관리">
        <button type="button" role="tab" aria-selected={tab === 'nodes'} className={tab === 'nodes' ? 'active' : ''} onClick={() => setTab('nodes')}><Cpu size={16}/> 장비·SW</button>
        <button type="button" role="tab" aria-selected={tab === 'ips'} className={tab === 'ips' ? 'active' : ''} onClick={() => setTab('ips')}><EthernetPort size={16}/> IP·NIC</button>
        <button type="button" role="tab" aria-selected={tab === 'connections'} className={tab === 'connections' ? 'active' : ''} onClick={() => setTab('connections')}><Cable size={16}/> 통신 연결</button>
      </div>

      {notice && <div className="notice" role="status">{notice}</div>}
      {!loaded && <div className="card">체계 구성 정보를 불러오는 중...</div>}

      {loaded && tab === 'nodes' && (
        <div className="system-config-stack">
          <section className="card">
            <div className="card-title">
              <div><h3>장비·SW 목록</h3><p>기존 인터페이스 노드를 재사용하므로 노드 이름을 변경해도 설정이 유지됩니다.</p></div>
              <button className="ghost" type="button" onClick={onGoToDesign}><Plus size={15}/> 노드 추가·관리</button>
            </div>
            <div className="table-wrap"><table className="system-config-table">
              <thead><tr><th>노드(SW)</th><th>Device ID</th><th>탑재 HW</th><th>Hostname</th><th>비고</th></tr></thead>
              <tbody>{nodes.map(item => (
                <tr key={item.node_id} onClick={() => setNodeId(String(item.node_id))} className={String(item.node_id) === String(nodeId) ? 'selected' : ''}>
                  <td><strong>{item.name}</strong></td><td>{item.device_id ?? '—'}</td><td>{item.hardware_name || '—'}</td><td>{item.hostname || '—'}</td><td>{item.note || '—'}</td>
                </tr>
              ))}
              {!nodes.length && <tr><td colSpan={5}>노드가 없습니다. 인터페이스 설계에서 먼저 노드를 추가해 주세요.</td></tr>}</tbody>
            </table></div>
          </section>
          {node && <section className="card">
            <h3>{node.name} · 식별 정보 편집</h3>
            <form className="system-config-form" onSubmit={saveNode}>
              <label>Device ID<input type="number" min="1" placeholder="예: 7" value={profile.device_id ?? ''} onChange={e => setProfile({ ...profile, device_id: e.target.value })}/></label>
              <label>탑재 HW<input value={profile.hardware_name || ''} maxLength={120} placeholder="예: 체계관리기" onChange={e => setProfile({ ...profile, hardware_name: e.target.value })}/></label>
              <label>Hostname<input value={profile.hostname || ''} maxLength={120} placeholder="장치 이름" onChange={e => setProfile({ ...profile, hostname: e.target.value })}/></label>
              <label>SW 고유 ID<input value={profile.software_id || ''} maxLength={120} onChange={e => setProfile({ ...profile, software_id: e.target.value })}/></label>
              <label>HW 고유 ID<input value={profile.hardware_id || ''} maxLength={120} onChange={e => setProfile({ ...profile, hardware_id: e.target.value })}/></label>
              <label className="wide">비고<textarea value={profile.note || ''} onChange={e => setProfile({ ...profile, note: e.target.value })}/></label>
              <div className="system-config-actions"><button disabled={busy} type="submit"><Save size={15}/> 저장</button></div>
            </form>
          </section>}
        </div>
      )}

      {loaded && tab === 'ips' && (
        <div className="system-config-stack">
          <section className="card">
            <h3>IP 주소 할당</h3>
            <p>예약 주소는 별도 노드가 아니라 해당 SW의 예약 IP로 등록합니다. 프로젝트 내 중복 IP는 차단됩니다.</p>
            <div className="table-wrap"><table className="system-config-table">
              <thead><tr><th>노드</th><th>NIC / 구분</th><th>IP 주소</th><th>상태</th><th>비고</th><th>관리</th></tr></thead>
              <tbody>{ips.map(item => (
                <tr key={item.id}>
                  <td>{item.node_name}</td><td>{item.interface_name || '—'}</td><td className="mono">{item.ip_address}</td>
                  <td>{item.is_reserved ? '예약' : '사용'}</td><td>{item.note || '—'}</td>
                  <td><div className="system-config-row-actions"><button type="button" className="ghost" onClick={() => selectIpForEdit(item)}>수정</button><button type="button" className="danger" onClick={() => deleteIp(item)} aria-label={`${item.ip_address} 삭제`}><Trash2 size={14}/></button></div></td>
                </tr>
              ))}
              {!ips.length && <tr><td colSpan={6}>등록된 IP가 없습니다.</td></tr>}</tbody>
            </table></div>
          </section>
          <section className="card">
            <h3>{editingIp == null ? 'IP 할당 추가' : 'IP 할당 수정'}</h3>
            <form className="system-config-form" onSubmit={saveIp}>
              <NodePicker nodes={nodes} value={ipDraft.node_id} onChange={value => setIpDraft({ ...ipDraft, node_id: value })}/>
              <label>NIC / IP 구분<input maxLength={120} placeholder="예: NIC1, reserved1" value={ipDraft.interface_name} onChange={e => setIpDraft({ ...ipDraft, interface_name: e.target.value })}/></label>
              <label>IP 주소<input required placeholder="192.168.7.70" value={ipDraft.ip_address} onChange={e => setIpDraft({ ...ipDraft, ip_address: e.target.value })}/></label>
              <label className="system-config-check"><input type="checkbox" checked={ipDraft.is_reserved} onChange={e => setIpDraft({ ...ipDraft, is_reserved: e.target.checked })}/> 예약 IP</label>
              <label className="wide">비고<input value={ipDraft.note} onChange={e => setIpDraft({ ...ipDraft, note: e.target.value })}/></label>
              <div className="system-config-actions">
                {editingIp != null && <button type="button" className="ghost" onClick={clearIpForm}>수정 취소</button>}
                <button type="submit" disabled={busy || !ipDraft.node_id || !ipDraft.ip_address.trim()}><Save size={15}/> {editingIp == null ? 'IP 추가' : '변경 저장'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {loaded && tab === 'connections' && (
        <div className="system-config-stack">
          <section className="card">
            <h3>통신 연결 목록</h3>
            <p>등록된 IP를 선택해 Server·Client 및 각 PORT를 관리합니다. 클라이언트 포트는 선택 사항입니다.</p>
            <div className="table-wrap"><table className="system-config-table">
              <thead><tr><th>프로토콜</th><th>Server 노드</th><th>Server IP : PORT</th><th>Client 노드</th><th>Client IP : PORT</th><th>비고</th><th>관리</th></tr></thead>
              <tbody>{connections.map(item => (
                <tr key={item.id}>
                  <td>{item.protocol}</td><td>{item.server_node_name}</td><td className="mono">{item.server_ip}:{item.server_port}</td>
                  <td>{item.client_node_name}</td><td className="mono">{item.client_ip}{item.client_port == null ? '' : `:${item.client_port}`}</td><td>{item.note || '—'}</td>
                  <td><div className="system-config-row-actions"><button type="button" className="ghost" onClick={() => selectConnectionForEdit(item)}>수정</button><button type="button" className="danger" onClick={() => deleteConnection(item)} aria-label={`${item.id} 연결 삭제`}><Trash2 size={14}/></button></div></td>
                </tr>
              ))}
              {!connections.length && <tr><td colSpan={7}>등록된 통신 연결이 없습니다.</td></tr>}</tbody>
            </table></div>
          </section>
          <section className="card">
            <h3>{editingConnection == null ? '통신 연결 추가' : '통신 연결 수정'}</h3>
            <form className="system-config-form" onSubmit={saveConnection}>
              <label>Server IP<select required value={connectionDraft.server_ip_id} onChange={e => setConnectionDraft({ ...connectionDraft, server_ip_id: e.target.value })}>
                <option value="">Server 선택</option>{ips.map(item => <option key={item.id} value={item.id}>{item.node_name} · {item.interface_name || 'IP'} · {item.ip_address}{item.is_reserved ? ' (예약)' : ''}</option>)}
              </select></label>
              <label>Server PORT<input required type="number" min={1} max={65535} value={connectionDraft.server_port} onChange={e => setConnectionDraft({ ...connectionDraft, server_port: e.target.value })}/></label>
              <label>Client IP<select required value={connectionDraft.client_ip_id} onChange={e => setConnectionDraft({ ...connectionDraft, client_ip_id: e.target.value })}>
                <option value="">Client 선택</option>{ips.map(item => <option key={item.id} value={item.id}>{item.node_name} · {item.interface_name || 'IP'} · {item.ip_address}{item.is_reserved ? ' (예약)' : ''}</option>)}
              </select></label>
              <label>Client PORT (선택)<input type="number" min={1} max={65535} value={connectionDraft.client_port} onChange={e => setConnectionDraft({ ...connectionDraft, client_port: e.target.value })}/></label>
              <label>프로토콜<select value={connectionDraft.protocol} onChange={e => setConnectionDraft({ ...connectionDraft, protocol: e.target.value })}><option value="TCP">TCP</option><option value="UDP">UDP</option></select></label>
              <label className="wide">비고<input value={connectionDraft.note} onChange={e => setConnectionDraft({ ...connectionDraft, note: e.target.value })}/></label>
              <div className="system-config-actions">
                {editingConnection != null && <button type="button" className="ghost" onClick={() => { setEditingConnection(null); setConnectionDraft(EMPTY_CONNECTION); }}>수정 취소</button>}
                <button type="submit" disabled={busy || !connectionDraft.server_ip_id || !connectionDraft.server_port || !connectionDraft.client_ip_id || connectionDraft.server_ip_id === connectionDraft.client_ip_id}><Save size={15}/> {editingConnection == null ? '연결 추가' : '변경 저장'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
