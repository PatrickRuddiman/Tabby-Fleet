// Ambient module declarations for the Tabby host packages we import. webpack
// externalizes tabby-* at build time (Tabby provides the real classes at
// runtime); tests/stubs/* provides runtime stubs used by ts-node + mocha.

declare module 'tabby-core' {
  export interface Profile<O = any> {
    id?: string
    name?: string
    type?: string
    options: O
    color?: string | null
    icon?: string | null
    isBuiltin?: boolean
  }
  export type PartialProfile<P extends Profile = Profile> = Partial<P> & {
    options?: Partial<P['options']>
    isTemplate?: boolean
    weight?: number
    icon?: string
  }

  export interface NewTabParameters<T = any> {
    type: any
    inputs?: Record<string, any>
  }

  export abstract class ProfileProvider<P extends Profile = Profile> {
    abstract id: string
    abstract name: string
    settingsComponent?: any
    configDefaults: { options: any } | undefined
    abstract getBuiltinProfiles(): Promise<PartialProfile<P>[]>
    abstract getNewTabParameters(profile: P): Promise<NewTabParameters>
    abstract getDescription(profile: PartialProfile<P>): string
    getSuggestedName?(profile: PartialProfile<P>): string | null
    deleteProfile?(profile: P): void
  }

  export class SplitTabComponent {
    add(tab: any, relative: any, side: 't' | 'r' | 'b' | 'l'): Promise<void>
    layout(): void
    focus(tab: any): void
    removeTab(tab: any): void
    getAllTabs(): any[]
    getFocusedTab(): any
    getParentOf(tab: any, root?: any): any
    focusChanged$: any
    initialized$: any
    destroyed$: any
    root: SplitContainer
  }

  export class SplitContainer {
    orientation: 'h' | 'v'
    children: any[]
    ratios: number[]
    getAllTabs(): any[]
    normalize(): void
  }

  // Default export — the module class. Real name in tabby-core is AppModule.
  const TabbyCoreModule: any
  export default TabbyCoreModule

  export abstract class TabRecoveryProvider<T = any> {
    abstract applicableTo(token: any): Promise<boolean>
    abstract recover(token: any): Promise<NewTabParameters<T> | null>
  }

  export class NotificationsService {
    info(text: string, details?: string): void
    error(text: string, details?: string): void
    notice(text: string): void
  }

  export class ConfigService {
    store: any
    save(): Promise<void>
    changed$: any
  }

  export class AppService {
    openNewTab(params: NewTabParameters): any
    activeTab: any
    tabOpened$: any
    tabsChanged$: any
  }

  export class TabsService {
    create(params: { type: any; inputs?: Record<string, any> }): any
  }

  export abstract class PlatformService {
    abstract pickDirectory(title?: string, buttonLabel?: string): Promise<string | null>
  }

  export class ProfilesService {
    getProfiles(options?: { includeBuiltin?: boolean }): Promise<Profile[]>
    providerForProfile<P extends Profile = Profile>(profile: PartialProfile<P>): ProfileProvider<P> | null
  }
}

declare module 'tabby-terminal' {
  const TabbyTerminalModule: any
  export default TabbyTerminalModule
  export interface TerminalColorScheme {
    name: string
    foreground?: string
    background?: string
    cursor?: string
    colors?: string[]
    [key: string]: any
  }
  export abstract class TerminalColorSchemeProvider {
    abstract getSchemes(): Promise<TerminalColorScheme[]>
  }
}

declare module 'tabby-settings' {
  const TabbySettingsModule: any
  export default TabbySettingsModule
  export abstract class SettingsTabProvider {
    abstract id: string
    abstract title: string
    iconClass?: string
    abstract getComponentType(): any
  }
}

declare module '@angular/forms' {
  export class FormsModule {}
}

declare module '@angular/common' {
  export class CommonModule {}
}

declare module '@ng-bootstrap/ng-bootstrap' {
  export class NgbModal {
    open(content: any, options?: any): NgbModalRef
  }
  export class NgbModalRef {
    componentInstance: any
    result: Promise<any>
  }
  export class NgbActiveModal {
    close(result?: any): void
    dismiss(reason?: any): void
  }
  export class NgbModule {}
}
