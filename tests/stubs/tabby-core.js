// Runtime stub for tabby-core used by ts-node + mocha. The real tabby-core is
// provided by the Tabby host at plugin load time (webpack externalizes it).

class ProfileProvider {}

class SplitTabComponent {
  constructor() {
    this._tabs = []
  }
  async add() {}
  layout() {}
  focus() {}
  removeTab() {}
  getAllTabs() { return this._tabs.slice() }
  getFocusedTab() { return null }
  getParentOf() { return null }
}

class TabbyCoreModule {}

class TabRecoveryProvider {}

class NotificationsService {
  info() {}
  error() {}
  notice() {}
}

class ConfigService {
  constructor() { this.store = {} }
  async save() {}
}

class AppService {
  openNewTab() {}
}

module.exports = {
  ProfileProvider,
  SplitTabComponent,
  TabbyCoreModule,
  TabRecoveryProvider,
  NotificationsService,
  ConfigService,
  AppService,
}
