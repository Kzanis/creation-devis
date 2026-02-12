import https from 'https';
const API_KEY = process.env.N8N_KEY;
const BASE = 'https://creatorweb.fr';

function req(method, path, body) {
  return new Promise((res, rej) => {
    const url = new URL(path, BASE);
    const r = https.request(url, { method, headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY } }, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => { try { res({ status: resp.statusCode, body: JSON.parse(d) }); } catch(e) { res({ status: resp.statusCode, body: d }); } });
    });
    r.on('error', rej);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const IDS = ['OdnqqTTsciKb4TDs', 'EWdex8FWZ61BmTiS'];

for (const id of IDS) {
  console.log('\n> Workflow', id);
  const get = await req('GET', `/api/v1/workflows/${id}`);
  const wf = get.body;
  console.log('  Name:', wf.name);
  console.log('  Nodes:', wf.nodes?.length);

  // PUT avec seulement les champs autorisés
  const put = await req('PUT', `/api/v1/workflows/${id}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings
  });
  console.log('  PUT:', put.status === 200 ? 'OK' : 'FAIL - ' + JSON.stringify(put.body).slice(0, 100));
}

console.log('\nTerminé. Rafraîchissez n8n.');
