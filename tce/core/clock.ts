// Injected time and id sources. Core and client code never call Date.now(),
// Math.random() or crypto directly, so tests are deterministic.

export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

export interface IdGenerator {
  /** A fresh lowercase RFC 4122 version-4 UUID. */
  uuid(): string;
}
