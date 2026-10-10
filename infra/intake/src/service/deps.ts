import type { Contract } from '../logic/contract.ts';
import type { Logger } from '../logic/log.ts';
import type { BriefLinks, BriefRegistry, Clock, CrmStore, EngagementStore, Ids, LockPort, Mailer, Notifier, RateStore, Settings, SuppressionStore } from './ports.ts';

/** Everything the service needs, injected. Built once at cold start by src/azure/wiring.ts, or by tests/fakes.ts. */
export interface Deps {
  readonly contract: Contract;
  readonly settings: Settings;
  readonly clock: Clock;
  readonly ids: Ids;
  readonly rate: RateStore;
  readonly lock: LockPort;
  readonly engagements: EngagementStore;
  readonly crm: CrmStore;
  readonly suppression: SuppressionStore;
  readonly registry: BriefRegistry;
  readonly links: BriefLinks;
  readonly mailer: Mailer;
  readonly notifier: Notifier;
  readonly log: Logger;
}
