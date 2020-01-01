const util = require('util');
const jp = require('jsonpath');
const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

k8sApi.listNode().then((res) => {
  //console.log(util.inspect(res.body, {depth: 10, colors: true}));
  // $.items[?(@.metadata.labels["kubernetes.io/hostname"])].status.addresses[?(@.type=="InternalIP")].address
  //.node-role.kubernetes.io/master
  console.log(jp.query(res.body, '$..status.addresses[?(@.type=="InternalIP")].address'))
});

// const cm = k8s.V1ConfigMap();
// k8sApi.createNamespacedConfigMap('default', cm)



