let id2 = function (__exports = {}) {
  const logic = id5()

  const functional = id6()

  const object = id7()

  const ReactiveObject = id8()

  const html = id9()

  const string = id10()

  Object.assign(__exports, logic)
  Object.assign(__exports, functional)
  Object.assign(__exports, object)
  Object.assign(__exports, ReactiveObject)
  Object.assign(__exports, html)
  Object.assign(__exports, string)
  id2 = () => __exports
  return __exports
}
let id5 = function (__exports = {}) {
  const { curry } = id6()

  const ox = () => {}
  const falsePromise = new Promise(ox)
  const isNumber = n => !isNaN(parseFloat(n)) && isFinite(n)
  const timeout = ms => new Promise(r => setTimeout(r, ms))
  const sleep = timeout

  function err(msg) {
    throw new Error(msg)
  }
  function getRandomInt(min = 0, max = 1) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min) + min) //The maximum is exclusive and the minimum is inclusive
  }
  function debounce(fn, ms = 0) {
    let timeout, args
    const execFn = () => fn(...args)
    return (...p) => {
      args = p
      clearTimeout(timeout)
      timeout = setTimeout(execFn, ms)
    }
  }
  function Debouncer(fn) {
    let timeout, args, set, ret
    const execFn = () => fn(...args)
    const setExec = () => {
      ret.exec = () => {
        clearTimeout(timeout)
        fn(...args)
        set = setExec
        ret.exec = ox
      }
      set = ox
    }
    set = setExec
    ret = {
      debounce: (...p) => {
        args = p
        clearTimeout(timeout)
        timeout = setTimeout(execFn, 0)
        set()
      },
      exec: ox,
    }
    return ret
  }
  const wait = fn => {
    let execFn, waitedFn
    const ready = () => (execFn = start)
    const waiting = (...p) => (waitedFn = curry(start, ...p))
    const start = (execFn = async (...p) => {
      execFn = waiting
      waitedFn = ready
      await fn(...p)
      waitedFn()
    })
    return (...p) => execFn(...p)
  }
  const throttle = (fn, ms = 0) =>
    wait((...p) => {
      fn(...p)
      return timeout(ms)
    })
  const shield = (fn, ms = 0) => {
    const start = (...p) => {
      fn(...p)
      execFn = ox
      setTimeout(() => (execFn = start), ms)
    }
    let execFn = start
    return (...p) => execFn(...p)
  }

  function factory(setterFunction, o = {}) {
    setterFunction = setterFunction.bind(o)
    return new Proxy(o, {
      get(target, prop) {
        return target[prop] || (target[prop] = setterFunction(prop))
      },
    })
  }
  function cacher(setterFunction, m = new Map()) {
    setterFunction = setterFunction.bind(m)
    let v
    function fun(...params) {
      let prop
      try {
        prop = JSON.stringify(params)
      } catch (e) {
        console.warn(e)
        prop = params
      }
      return m.get(prop) || (m.set(prop, (v = setterFunction(...params))) && v)
    }
    fun._map = m
    return fun
  }
  const cell =
    (f, m) =>
    (...args) => {
      const ret = f(m, ...args)
      return ret instanceof Promise ? ret.then(v => (m = v)) : (m = ret)
    }

  __exports.ox = ox
  __exports.falsePromise = falsePromise
  __exports.isNumber = isNumber
  __exports.timeout = timeout
  __exports.sleep = sleep
  __exports.err = err
  __exports.getRandomInt = getRandomInt
  __exports.debounce = debounce
  __exports.Debouncer = Debouncer
  __exports.wait = wait
  __exports.throttle = throttle
  __exports.shield = shield
  __exports.factory = factory
  __exports.cacher = cacher
  __exports.cell = cell
  id5 = () => __exports
  return __exports
}
let id6 = function (__exports = {}) {
  const trail =
    (f1, ...fns) =>
    (...p) =>
      fns.reduce((pf, f) => f(pf), f1(...p))
  const queue =
    (...fns) =>
    (...p) => {
      const lastFn = fns.pop()
      fns.forEach(f => f(...p))
      return lastFn(...p)
    }
  const beat =
    (...fs) =>
    (...p) =>
      fs.some(f => f(...p))
  const curry =
    (f, ...args) =>
    (...args2) =>
      f(...args, ...args2)
  const aim =
    (f, ...args) =>
    (...args2) =>
      f(...args2, ...args)
  const fork =
    (...fns) =>
    (...p) =>
      fns.map(f => f(...p))
  const guard =
    (f, ...gfns) =>
    (...p) =>
      gfns.every(gf => gf(...p)) && f(...p)
  const or =
    (f, ...gfns) =>
    (...p) =>
      gfns.some(gf => gf(...p)) && f(...p)

  // ----------------  renaming for better coding ----------------

  const $I = queue
  const $L = trail
  const $B = beat
  const $P = curry
  const $X = aim
  const $E = fork
  const $G = guard
  const $T = or

  __exports.trail = trail
  __exports.queue = queue
  __exports.beat = beat
  __exports.curry = curry
  __exports.aim = aim
  __exports.fork = fork
  __exports.guard = guard
  __exports.or = or
  __exports.$I = $I
  __exports.$L = $L
  __exports.$B = $B
  __exports.$P = $P
  __exports.$X = $X
  __exports.$E = $E
  __exports.$G = $G
  __exports.$T = $T
  id6 = () => __exports
  return __exports
}
let id7 = function (__exports = {}) {
  const oKeys = Object.keys
  const some = (o, f) => oKeys(o).some(k => f(o[k], k, o))
  const every = (o, f) => oKeys(o).every(k => f(o[k], k, o))
  const each = (o, f) => oKeys(o).forEach(k => f(o[k], k, o))
  const map = (o, f) =>
    reduce(
      o,
      (acc, v, k) => {
        acc[k] = f(v, k, o)
        return acc
      },
      {}
    )
  const join = (o, sep = ",") =>
    reduce(
      o,
      (acc, v) => {
        acc.push(v)
        return acc
      },
      []
    ).join(sep)

  const sort = (o, f) =>
    oKeys(o)
      .sort((a, b) => f(o[a], o[b]))
      .reduce((acc, k) => {
        acc[k] = o[k]
        return acc
      }, {})

  const filter = (o, f) =>
    reduce(
      o,
      (acc, v, k) => {
        if (f(v, k, o)) acc[k] = v
        return acc
      },
      {}
    )

  const pluck = (o, ...keys) => keys.reduce((acc, k) => acc[k], o)
  const find = (o, f) =>
    pluck(
      o,
      oKeys(o).find(k => f(o[k], k, o))
    )
  const reduce = (o, f, initialValue) => {
    let keys = oKeys(o)
    if (!initialValue) {
      initialValue = o[keys[0]]
      keys = keys.slice(1)
    }
    return keys.reduce((acc, k) => f(acc, o[k], k, o), initialValue)
  }
  const isEmptyObject = obj =>
    oKeys(obj).length === 0 || every(obj, v => v === undefined)
  const ownKeys = Reflect.ownKeys
  const eachW = (o, f) => ownKeys(o).forEach(k => f(o[k], k, o))

  const $O_prototype = {
    map,
    join,
    filter,
    sort,
    reduce,
    find,
    pluck,
    each,
    every,
    some,
    keys: oKeys,
    fetchKeys,
    expandKeys,
    flattenKeys,
    stringify,
    existProps,
    existBranch,
  }
  const $O = o =>
    new Proxy(o, {
      get(target, prop, receiver) {
        return $O_prototype[prop]
          ? (...args) => {
              const ret = $O_prototype[prop](target, ...args)
              return isObject(ret) ? $O(ret) : ret
            }
          : target[prop]
      },
    })

  function expandKeys(o, delimiter = ",", out = {}) {
    Object.keys(o).forEach(key => {
      const value = isObject(o[key]) ? expandKeys(o[key], delimiter) : o[key]
      key
        .toString()
        .split(delimiter)
        .map(k => k.trim())
        .forEach(k => (out[k] = value))
    })
    return out
  }
  function fetchKeys(o, keyString, delimiter = ".") {
    return keyString.split(delimiter).reduce((o, k) => o[k], o)
  }
  function isPartialEqual(a, b) {
    if (typeof a !== typeof b) return false
    return typeof a === "object"
      ? every(a, (v, key) => isPartialEqual(v, b[key]))
      : a === b
  }
  function isShallowEqual(a, b) {
    if (typeof a !== typeof b) return false
    return every(a, (v, k) => v === b[k])
  }
  function isDeepEqual(a, b) {
    if (oKeys(a).length !== oKeys(b).length) return false
    return every(a, (v, k) => isPartialEqual(v, b[k]))
  }
  function flattenKeys(o, path = "", delimiter = ",", out = {}) {
    Object.keys(o).forEach(key =>
      isObject(o[key])
        ? flattenKeys(o[key], path + key + delimiter, delimiter, out)
        : (out[path + key] = o[key])
    )
    return out
  }
  function isObject(o) {
    return o?.constructor.name === "Object"
  }
  function existProps(obj, ...props) {
    return props.every(p => obj[p] !== undefined)
  }
  function existBranch(obj, ...props) {
    return props.every(p => obj[p] !== undefined && (obj = obj[p]))
  }
  function copy(o) {
    return JSON.parse(JSON.stringify(o))
  }
  function setProp(o, value, ...props) {
    const lastProp = props.pop()
    o = props.reduce((o, p) => {
      o[p] ??= {}
      return o[p]
    }, o)
    o[lastProp] = value
    return o[lastProp]
  }
  function hasASameKey(a, b) {
    return oKeys(a).find(k => b[k] !== undefined)
  }
  function errIfSimilarKey(a, b, msg = "") {
    const sameKey = hasASameKey(a, b)
    if (sameKey) err(`${msg} similar key: ${sameKey}`)
  }
  const _switchTo = (switchs, key, ...p) => {
    const value = switchs[key]
    switch (typeof value) {
      case "function":
        return value(...p)
      case "object":
        return _switchTo(value, value._(...p), ...p)
      case "undefined":
        return switchs.default(...p)
      default:
        return value
    }
  }
  const opt = switchs => {
    switchs = expandKeys(switchs)
    return (...p) => _switchTo(switchs, switchs._(...p), ...p)
  }

  const $F = opt

  const stringifySwitcher = $F({
    _: v => {
      let type = v === null ? "null" : typeof v
      return type === "object" && Array.isArray(v) ? "array" : type
    },
    array: v => `[${v.map(val => stringify(val)).join(",")}]`,
    object: o =>
      `{${$O(o)
        .filter(v => v !== undefined)
        .map((v, k) => `"${k}":${stringify(v)}`)
        .join(",")}}`,
    "number, boolean, function": v => v.toString(),
    string: v => `"${v}"`,
    "null, undefined": () => "null",
  })
  function stringify(o, seenObj = new Set()) {
    if (seenObj.has(o)) return "[Circular Object]"
    else if (typeof o === "object") seenObj.add(o)
    return stringifySwitcher(o)
  }
  function converToMap(o, m = new Map()) {
    each(o, (v, k) => m.set(k, isObject(v) ? converToMap(v) : v))
    return m
  }

  __exports.oKeys = oKeys
  __exports.some = some
  __exports.every = every
  __exports.each = each
  __exports.map = map
  __exports.join = join
  __exports.sort = sort
  __exports.filter = filter
  __exports.pluck = pluck
  __exports.find = find
  __exports.reduce = reduce
  __exports.isEmptyObject = isEmptyObject
  __exports.ownKeys = ownKeys
  __exports.eachW = eachW
  __exports.$O = $O
  __exports.expandKeys = expandKeys
  __exports.fetchKeys = fetchKeys
  __exports.isPartialEqual = isPartialEqual
  __exports.isShallowEqual = isShallowEqual
  __exports.isDeepEqual = isDeepEqual
  __exports.flattenKeys = flattenKeys
  __exports.isObject = isObject
  __exports.existProps = existProps
  __exports.existBranch = existBranch
  __exports.copy = copy
  __exports.setProp = setProp
  __exports.hasASameKey = hasASameKey
  __exports.errIfSimilarKey = errIfSimilarKey
  __exports.opt = opt
  __exports.$F = $F
  __exports.stringify = stringify
  __exports.converToMap = converToMap
  id7 = () => __exports
  return __exports
}
let id8 = function (__exports = {}) {
  const { $P } = id6()

  const { Debouncer, factory } = id5()

  const { each } = id7()

  const setStats = parent => {
    const s = {
      owners: new Set(),
      inOwners: new Set(),
      listeners: new Set(),
      computableQueue: [],
      computables: [],
      isComputable: false,
      compute: Debouncer(f => f(), 0),
    }
    s.children = factory($P(setStats, s))
    parent && s.owners.add(parent)
    return s
  }
  const allowedConstructors = new Set(["Object", "Array"])

  function ReactiveObject(
    store = {},
    state,
    computeQueue = ComputeQueue(),
    stats = setStats()
  ) {
    const proxy = new Proxy(store, {
      set: (o, prop, val) => {
        const s = stats.children[prop]
        if (typeof val === "function") {
          s.computableQueue.push(val)
          s.isComputable = true
        } else {
          if (val?.__isRO) {
            val.__owners.add(stats)
            stats.inOwners.add(val.__owners)
            o[prop] = val
          } else if (allowedConstructors.has(val?.constructor.name)) {
            o[prop] = ReactiveObject(val, state, computeQueue, s)
          } else {
            o[prop] = val
          }
          notify(s)
        }
        return true
      },
      get: (o, prop) => {
        switch (prop) {
          case "constructor":
            return o[prop]
          case "__compute":
            return computeQueue.exec()
          case "__observe":
            return (il, c) => observeProxy(proxy, stats, il, c)
          case "__isRO":
            return true
          case "__owners":
            return stats.owners
          default:
            const s = stats.children[prop]
            if (s.isComputable) {
              if (s.computableQueue.length) {
                const ar = s.computableQueue
                s.computableQueue = []
                ar.forEach(fn => compute(prop, fn))
              }
              _state.__compute
              computeQueue.exec()
            }
            return o[prop]
        }
      },
      deleteProperty: (o, prop) => {
        cleanupStats(stats.children[prop])
        delete o[prop]
        return true
      },
    })
    Object.assign(proxy, store)
    const _state = state || proxy
    function compute(prop, fn) {
      const s = stats.children[prop]
      const computable = () => {
        computeQueue.add(s.compute)
        s.compute.debounce(() => {
          computeQueue.delete(s.compute)
          proxy[prop] = fn(_state)
        })
      }
      const inListeners = new Set()
      s.computables.push({ inListeners, computable })
      proxy[prop] = fn(_state.__observe(inListeners, computable))
    }
    return proxy
  }
  const RO = ReactiveObject
  function observeProxy(proxy, stats, inListeners, computable) {
    return new Proxy(proxy, {
      get(o, prop) {
        const s = stats.children[prop]
        addListener(s, inListeners, computable)
        return o[prop]
      },
    })
  }

  function ComputeQueue() {
    let queue = new Set()
    return {
      add: debouncer => queue.add(debouncer),
      delete: debouncer => queue.delete(debouncer),
      exec: () => {
        while (queue.size) {
          const set = queue
          queue = new Set()
          set.forEach(debouncer => debouncer.exec())
        }
      },
    }
  }
  function addListener(stats, inListeners, computable) {
    stats.listeners.add(computable)
    inListeners.add(stats.listeners)
  }
  function notify(stats) {
    stats.listeners.forEach(f => f())
    stats.owners.forEach(notify)
  }
  function cleanupStats(stats) {
    stats.computableQueue.length = 0
    stats.computables.forEach(({ inListeners, computable }) => {
      inListeners.forEach(listeners => listeners.delete(computable))
    })
    each(stats.children, cleanupStats)
  }

  __exports.ReactiveObject = ReactiveObject
  __exports.RO = RO
  id8 = () => __exports
  return __exports
}
let id9 = function (__exports = {}) {
  const { each, oKeys } = id7()

  function qs(selector, elm = document) {
    return elm.querySelector(selector)
  }
  function qsa(selector, elm = document) {
    return [...elm.querySelectorAll(selector)]
  }
  function ce(tag, options = {}) {
    const elm = document.createElement(tag)
    each(options, (value, key) => {
      if (key === "text") {
        elm.textContent = value
      } else if (key === "html") {
        elm.innerHTML = value
      } else if (key === "class") {
        elm.className = value
      } else if (key === "dataset") {
        each(value, (value, key) => {
          elm.dataset[key] = value
        })
      } else if (key.startsWith("data-") && key.length > 5) {
        elm.dataset[key.slice(5)] = value
      } else if (key === "children") {
        value.forEach(({ tag, options }) => {
          elm.appendChild(ce(tag, options))
        })
      } else {
        elm.setAttribute(key, value)
      }
    })
    return elm
  }
  function ael(elm, evName, cb) {
    elm.addEventListener(evName, cb)
  }
  function ObserveElm(callback, elm = document.body) {
    const observer = new MutationObserver(callback)
    observer.observe(elm, {
      childList: true,
      subtree: true,
    })
    return observer
  }
  function domTraversal(cb, elm = document.body) {
    cb(elm)
    for (let child of elm.children) {
      domTraversal(cb, child)
    }
  }
  const jss = (instructions, root = document.body) => {
    function applyInstructions(elm) {
      each(instructions, (fn, selector) => {
        if (!elm.__applied?.[selector] && elm.matches(selector)) {
          const cleanup = fn(elm)
          if (typeof cleanup === "function") {
            elm.__cleanup ??= {}
            elm.__cleanup[selector] = cleanup
          }
          elm.__applied ??= {}
          elm.__applied[selector] = true
        }
      })
    }
    ael(window, "load", () => {
      domTraversal(applyInstructions)
      ObserveElm(mutationList => {
        mutationList.forEach(mutation => {
          if (mutation.type === "childList") {
            ;[...mutation.addedNodes]
              .filter(node => node.nodeType === 1)
              .forEach(elm => domTraversal(applyInstructions, elm))
            ;[...mutation.removedNodes]
              .filter(node => node.type === 1)
              .forEach(elm =>
                domTraversal(
                  el => el.__cleanup && each(el.__cleanup, fn => fn()),
                  elm
                )
              )
          } else if (mutation.type === "attributes") {
            const elm = mutation.target
            if (
              elm.__applied &&
              oKeys(elm.__applied).some(selector => !elm.matches(selector))
            ) {
              if (elm.__cleanup) {
                each(elm.__cleanup, fn => fn())
              }
              const clone = elm.cloneNode(true)
              elm.parentNode.replaceChild(clone, elm)
              applyInstructions(clone)
            } else applyInstructions(elm)
          }
        })
      }, root)
    })
  }

  const loadScript = src =>
    new Promise((resolve, reject) => {
      const script = document.createElement("script")
      document.body.appendChild(script)
      script.onload = resolve(script)
      script.onerror = reject
      script.async = true
      script.src = src
    })

  __exports.qs = qs
  __exports.qsa = qsa
  __exports.ce = ce
  __exports.ael = ael
  __exports.ObserveElm = ObserveElm
  __exports.domTraversal = domTraversal
  __exports.jss = jss
  __exports.loadScript = loadScript
  id9 = () => __exports
  return __exports
}
let id10 = function (__exports = {}) {
  function replaceMulti(str, rs) {
    return Promise.all(
      rs.reduce(
        (parts, [rgx, callback]) => {
          return parts
            .map(s =>
              typeof s === "string" ? collectReplaceParts(s, rgx, callback) : s
            )
            .flat()
        },
        [str]
      )
    ).then(parts => parts.join(""))
  }

  function replaceAsync(str, rgx, callback) {
    return Promise.all(collectReplaceParts(str, rgx, callback)).thes(s =>
      s.join("")
    )
  }
  function collectReplaceParts(str, rgx, callback) {
    let parts = [],
      i = 0
    if (Object.prototype.toString.call(rgx) == "[object RegExp]") {
      if (rgx.global) rgx.lastIndex = i
      let m
      while ((m = rgx.exec(str))) {
        let args = m.concat([m.index, m.input])
        i !== m.index && parts.push(str.slice(i, m.index))
        parts.push(callback(...args))
        i = rgx.lastIndex
        if (!rgx.global) break // for non-global regexes only take the first match
        if (m[0].length === 0) rgx.lastIndex++
      }
    } else {
      rgx = String(rgx)
      i = str.indexOf(rgx)
      i !== m.index && parts.push(str.slice(i, m.index))
      parts.push(callback(rgx, i, str))
      i += rgx.length
    }
    parts.push(str.slice(i))
    return parts
  }

  __exports.replaceMulti = replaceMulti
  __exports.replaceAsync = replaceAsync
  id10 = () => __exports
  return __exports
}
const id11 = function (__exports = {}) {
  const { reduce } = id2()

  const o = { a: 1, b: 2, c: 3 }

  console.assert(reduce(o, (acc, v) => acc + v, 0) === 6, "expected 6")

  id11 = () => __exports
  return __exports
}
