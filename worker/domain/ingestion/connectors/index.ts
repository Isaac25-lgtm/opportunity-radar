import type { Connector } from '../types';
import { jsonConnector, manualConnector, rssConnector } from './generic';
import { greenhouseConnector, leverConnector, reliefWebConnector, remotiveConnector } from './jobs';
import { grantsGovConnector, worldBankConnector } from './official';

export const CONNECTORS: Record<string, Connector> = {
  worldbank: worldBankConnector,
  grantsgov: grantsGovConnector,
  remotive: remotiveConnector,
  reliefweb: reliefWebConnector,
  lever: leverConnector,
  greenhouse: greenhouseConnector,
  rss: rssConnector,
  json: jsonConnector,
  manual: manualConnector,
};

export const CONNECTOR_TYPES = Object.keys(CONNECTORS);
