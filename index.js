const jp = require('jsonpath');
const k8s = require('@kubernetes/client-node');

async function cmExists(ns, name) {
  try {
    console.log(`INFO: check exists ${ns}/${name}`);
    const res = await k8sApi.listNamespacedConfigMap(ns);
    for (let item of res.body.items)
      if (item.metadata.name == name) return true;
      return false;
  } catch (e) {
    console.error('ERROR:', e.response.statusCode, e.response.statusMessage, e.response.request.response.body.message);
  }
}

async function cmRead(ns, name) {
  try {
    console.log(`INFO: read definition ${ns}/${name}`);
    const res = await k8sApi.readNamespacedConfigMap(name, ns);
    return res.body;
  } catch (e) {
    console.error('ERROR:', e.response.statusCode, e.response.statusMessage, e.response.request.response.body.message);
  }
}


async function cmDelete(ns, name) {
  console.log(`INFO: delete configmap ${ns}/${name}`);
  try {
    return await k8sApi.deleteNamespacedConfigMap(name, ns);
  } catch (e) {
    console.error('ERROR:', e.response.statusCode, e.response.statusMessage, e.response.request.response.body.message);
  }
}

async function cmCreate(ns, name, configYaml) {
  console.log(`INFO: create configmap ${ns}/${name}`);
  try {
    const configMap = {
      metadata: {
          name,
      },
      data: {
        config: configYaml
      }
    };
    return await k8sApi.createNamespacedConfigMap(ns, configMap)
  } catch (e) {
    console.error('ERROR:', e.response.statusCode, e.response.statusMessage, e.response.request.response.body.message);
  }
}

async function getNodes() {
  try {
    const res = await k8sApi.listNode();
    return res.body.items;
  } catch (e) {
    console.error('ERROR:', e.response.statusCode, e.response.statusMessage, e.response.request.response.body.message);
    return [];
  }
}

async function createConfig() {
  console.log(`INFO: get cluster nodes`);
  const config = { // config template
    'address-pools': [
      {
        name: 'default',
        protocol: 'layer2',
        addresses: []
      },
      {
        name: 'other',
        protocol: 'layer2',
        'auto-assign': false,
        addresses: []
      },
    ]
  };
  const nodes = await getNodes();
  if (!nodes.length) return console.error('ERROR: cannot load node list');
  for (var node of nodes) {
    const isMaster = !!jp.query(node, '$.metadata.labels["node-role.kubernetes.io/master"]').length;
    const address = jp.value(node, '$.status.addresses[?(@.type=="InternalIP")].address');
    if (isMaster)
      config['address-pools'][0].addresses.push(`${address}/32`);
    else
      config['address-pools'][1].addresses.push(`${address}/32`);
  }
  return k8s.dumpYaml(config);
}

async function updateConfig(ns, name) {
  console.log(`INFO: check changes`);
  const config = await createConfig();
  if (!config) return console.error('ERROR: empty config');
  if (await cmExists(ns, name)) {
    const cm = await cmRead(ns, name);
    if (cm.data.config && cm.data.config == config)
      return console.log(`INFO: no changes are found`);
    await cmDelete(ns, name);
  }
  return await cmCreate(ns, name, config);
}

async function main(ns, name) {

  setInterval(async () => {
    if (!update) return;
    update = false;
    await updateConfig(ns, name);
  }, 15 * 1000);  // 15 sec

  console.log(`INFO: watch nodes`);
  let update = true;
  const watch = new k8s.Watch(kc);
  watch.watch('/api/v1/watch/nodes', {}, async (type, obj) => {
    if (!['ADDED','DELETED'].includes(type)) return;
    console.log('INFO:', type, obj.metadata.name);
    update = true;
  }, (e) => {
    console.error('ERROR:', e);
  });

}

const prod = process.env.NODE_ENV == 'production';
const ns = process.env.CONFIG_NS ? process.env.CONFIG_NS : 'default';
const name = process.env.CONFIG_NAME ? process.env.CONFIG_NAME : 'config';
console.log(`INFO: production: ${prod}, ns: ${ns}, name: ${name}`);

const kc = new k8s.KubeConfig();
prod ? kc.loadFromCluster() : kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
main(ns, name);

