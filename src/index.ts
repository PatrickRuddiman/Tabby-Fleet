import 'reflect-metadata'
import { NgModule } from '@angular/core'

/**
 * Plugin entry point. Imports/declarations/providers stay empty here; task 022
 * fills in the full wire-up (TabbyCoreModule, TabbyTerminalModule, settings
 * providers, fleet components, etc.) once every consumer slice has landed.
 */
@NgModule({
  imports: [],
  declarations: [],
  providers: [],
})
export default class AgentFleetModule {}
