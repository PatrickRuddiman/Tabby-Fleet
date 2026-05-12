// Runtime stub for tabby-core used by ts-node + mocha. The real tabby-core is
// provided by the Tabby host at plugin load time (webpack externalizes it).

const { Subject } = require('rxjs')

class ProfileProvider {}
class TabRecoveryProvider {}
class TabbyCoreModule {}

class FakeClassList {
  constructor() { this._set = new Set() }
  add(c) { this._set.add(c) }
  remove(c) { this._set.delete(c) }
  contains(c) { return this._set.has(c) }
}

class FakeStyle {
  constructor() { this._props = new Map() }
  setProperty(name, value) { this._props.set(name, String(value)) }
  getPropertyValue(name) { return this._props.get(name) || '' }
}

class SplitContainer {
  constructor(orientation, children) {
    this.orientation = orientation
    this.children = children || []
    this.ratios = []
  }
}

class FakePane {
  constructor(id) {
    this.id = id
    this.focused$ = new Subject()
    this.blurred$ = new Subject()
    this.destroyed$ = new Subject()
    this.extras = {}
  }
}

class SplitTabComponent {
  constructor() {
    this._tabs = []
    this._addTabCalls = []
    this._removeTabCalls = []
    this._layoutCalls = 0
    this.focusChanged$ = new Subject()
    this.destroyed$ = new Subject()
    this.initialized$ = new Subject()
    this.tabRemoved$ = new Subject()
    this.elementRef = {
      nativeElement: {
        classList: new FakeClassList(),
        style: new FakeStyle(),
      },
    }
    this.root = new SplitContainer('h', [])
  }
  async add(tab, relative, side) {
    this._tabs.push(tab)
    this._addTabCalls.push({ tab, relative, side })
  }
  async addTab(tab, relative, side) {
    return this.add(tab, relative, side)
  }
  removeTab(tab) {
    const i = this._tabs.indexOf(tab)
    if (i >= 0) this._tabs.splice(i, 1)
    this._removeTabCalls.push(tab)
  }
  layout() {
    this._layoutCalls++
  }
  focus(tab) {}
  getAllTabs() { return this._tabs.slice() }
  getFocusedTab() { return null }
  getParentOf(tab, root) { return null }
}

class NotificationsService {
  constructor() { this._calls = [] }
  info(text, details) { this._calls.push({ kind: 'info', text, details }) }
  error(text, details) { this._calls.push({ kind: 'error', text, details }) }
  notice(text) { this._calls.push({ kind: 'notice', text }) }
}

class ConfigService {
  constructor() { this.store = {}; this.changed$ = new Subject() }
  async save() {}
}

class AppService {
  openNewTab() {}
}

module.exports = {
  default: TabbyCoreModule,
  ProfileProvider,
  TabRecoveryProvider,
  TabbyCoreModule,
  SplitTabComponent,
  SplitContainer,
  FakePane,
  FakeClassList,
  FakeStyle,
  NotificationsService,
  ConfigService,
  AppService,
}
