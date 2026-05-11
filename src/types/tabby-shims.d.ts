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
  export type PartialProfile<P extends Profile = Profile> = Partial<P> & { options?: Partial<P['options']> }

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
  }

  export class TabbyCoreModule {}

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
  }
}

declare module 'tabby-terminal' {
  export class TabbyTerminalModule {}
}

declare module 'tabby-settings' {
  export class TabbySettingsModule {}
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
  export class NgbAccordionModule {}
  export class NgbModalModule {}
}
