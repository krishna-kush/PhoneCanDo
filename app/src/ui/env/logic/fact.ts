// One row of a facts table (parts/FactTable.tsx): what it is and its
// value. A system's page and a machine's page build them. Pure.

export type Fact = {
  label: string;
  value: string;
  /** `dim`: nothing there (a tool the machine lacks); `alert`: it needs a look (one the agent needs). */
  tone?: 'dim' | 'alert';
};
