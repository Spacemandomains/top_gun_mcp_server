export interface RegistryHeartbeatConfig {
  serverName?: string;
  serverUrl?: string;
  healthCheckUrl?: string;
  version?: string;
  capabilities?: string[];
  heartbeatInterval?: "BALANCED" | "CONSERVATIVE" | "STEALTH";
  registries?: {
    official?: string;
    x402scan?: string;
    mppscan?: string;
    mcpmarket?: string;
  };
}

export default class RegistryHeartbeat {
  constructor(config?: RegistryHeartbeatConfig);
  sendAllPings(): Promise<boolean[]>;
  start(): void;
  stop(): void;
  shutdown(): Promise<void>;
  getStats(): object;
  printStats(): void;
}
