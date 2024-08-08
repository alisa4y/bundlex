export class Graph {
  constructor() {
    this.root = { edges: [] }
  }
  forEach(callback) {
    traverse(this.root, callback)
  }
  toArray() {
    const result = []
    this.forEach(node => result.push(node))
    return result
  }
  findAll(predicate) {
    const result = []
    this.forEach((node, i, s) => {
      if (predicate(node, i, s)) result.push(node)
    })
    return result
  }
  filter(predicate) {
    const newG = new Graph()
    newG.root = copyAndFilter(this.root, predicate)
    return newG
  }
  map(mapFn) {
    const newG = new Graph()
    newG.root = copyAndMap(this.root, mapFn)
    return newG
  }
  reduce(callback, initialValue) {
    return reduceGraph(this.root, callback, initialValue)
  }
  find(predicate) {
    var _a
    return (_a = findNode(this.root, predicate)) === null || _a === void 0
      ? void 0
      : _a.node
  }
  sort(predicate) {
    const newG = new Graph()
    newG.root = sort(this.root, predicate)
    return newG
  }
  reverse() {
    const newG = new Graph()
    newG.root = reverse(this.root)
    return newG
  }
  getRoot() {
    return this.root.edges[0].node
  }
  static from(node, ...edgeKeys) {
    const gw = {
      node: node,
      edges: buildGraph(node, edgeKeys),
    }
    const newG = new Graph()
    newG.root.edges = [gw]
    return newG
  }
}
function buildGraph(node, edgeKeys) {
  return edgeKeys
    .flatMap(key => {
      var _a
      const nodes = (_a = node[key]) !== null && _a !== void 0 ? _a : []
      return Array.isArray(nodes) ? nodes : [nodes]
    })
    .map(n => ({
      node: n,
      edges: buildGraph(n, edgeKeys),
    }))
}
function traverse(gw, callback, visited = new Set()) {
  if (visited.has(gw)) return
  visited.add(gw)
  gw.edges.forEach((childGw, i) => {
    callback(childGw.node, i, gw.node)
    traverse(childGw, callback, visited)
  })
}
function copyAndFilter(gw, predicate, visited = new Map()) {
  if (visited.has(gw)) return visited.get(gw)
  const { node } = gw
  const newGw = { node }
  visited.set(gw, newGw)
  newGw.edges = gw.edges
    .filter((childGw, i) => predicate(childGw.node, i, node))
    .map(childGw => copyAndFilter(childGw, predicate, visited))
  return newGw
}
function copyAndMap(gw, mapFn, visited = new Map()) {
  if (visited.has(gw)) return visited.get(gw)
  const { node } = gw
  const newGw = { node: node }
  visited.set(gw, newGw)
  newGw.edges = gw.edges.map((childGw, i) => ({
    node: mapFn(childGw.node, i, node),
    edges: copyAndMap(childGw, mapFn, visited).edges,
  }))
  return newGw
}
function findNode(gw, predicate, visited = new Set()) {
  if (visited.has(gw)) return
  visited.add(gw)
  for (let i = 0; i < gw.edges.length; i++) {
    const childGw = gw.edges[i]
    if (predicate(childGw.node, i, gw.node)) return childGw
    const findDeep = findNode(childGw, predicate, visited)
    if (findDeep) return findDeep
  }
}
function sort(gw, predicate, visited = new Map()) {
  if (visited.has(gw)) return visited.get(gw)
  const { node } = gw
  const newGw = { node }
  visited.set(gw, newGw)
  newGw.edges = gw.edges
    .map(childGw => sort(childGw, predicate, visited))
    .sort((a, b) => predicate(a.node, b.node))
  return newGw
}
function reverse(gw, visited = new Map()) {
  if (visited.has(gw)) return visited.get(gw)
  const { node } = gw
  const newGw = { node }
  visited.set(gw, newGw)
  newGw.edges = gw.edges.map(childGw => reverse(childGw, visited)).reverse()
  return newGw
}
function reduceGraph(gw, callback, initialValue) {
  return gw.edges.reduce((acc, childGw, i) => {
    return callback(
      acc,
      childGw.node,
      reduceGraph(childGw, callback, cloneInitVal(initialValue)),
      i,
      gw.node
    )
  }, cloneInitVal(initialValue))
}
function cloneInitVal(v) {
  return typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v
}
