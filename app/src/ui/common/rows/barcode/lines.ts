// The easter eggs in the key strips' barcodes: each box's barcode is a
// real Code 128 of its own line here, a joke about what is in that box, so
// whoever decodes the faint bars finds it where the eye sees a serial. A
// box names its line by id (KeyHead's `barcode`); a day's box names its
// day's (weekdays.ts). No line twice, and short, since each letter widens
// the barcode: 13 at most, capitals, digits, spaces and dashes (the check
// holds both).
// After a change, the next Metro start (every build, a release's too)
// rewrites bars.ts; pnpm -C app barcodes does it by hand.
export const BARCODE_LINES = {
  // An agent's pages
  agentSettings: 'MAKE IT YOURS',
  agentSchedules: 'SEE YOU AT 9',
  agentMessages: 'PASS A NOTE',
  agentModel: 'BRAIN PICKER',
  checksAcp: 'ROLL CALL',
  checksApp: 'CHECK CHECK',
  machineAgents: 'SHARE NICELY',
  mascotStage: 'STRIKE A POSE',
  newAgentModel: 'PICK A BRAIN',

  // Systems
  systems: 'MULTIVERSE',
  systemAgents: 'ROOMMATES',
  systemDetails: 'KNOW YOUR OS',
  officialSystems: 'TUX SAYS HI',
  unofficialSystems: 'OFF THE MENU',
  dockerHub: 'WHALE HELLO',
  armVersions: 'ARM DAY',
  addSystem: 'EENY MEENY',

  // Custom agents
  customKinds: 'HAND CRAFTED',
  hireBadge: 'YOU ARE HIRED',
  installChoice: 'SOME ASSEMBLY',
  runtimes: 'NODE IT ALL',
  phoneToolsField: 'HOLD THE LINE',
  reviewStarts: 'AND ACTION',
  reviewInstall: 'I AM ROOT',
  reviewUpdate: 'NEW AND SHINY',
  reviewVersion: 'V FOR VERSION',
  reviewPhoneTools: 'TAP TAP TAP',
  reviewAcp: 'HIP HIP ACP',

  // Local models
  modelsOnPhone: 'POCKET BRAINS',
  modelUsedBy: 'FAN CLUB',
  modelContext: 'REMEMBER ME',
  modelRam: 'DOWNLOAD RAM',
  noteSize: 'STICKY NOTES',
  modelMore: 'NERD STUFF',

  // The RAM warning
  memoryRam: 'MORE RAM PLZ',
  memoryAgents: 'RAM HUNGRY',
  memoryModels: 'HEAVY LIFTERS',
  memoryEmpty: 'ROOM TO SPARE',

  // Messages
  messageLevels: 'YOU GOT MAIL',
  emptyInbox: 'CRICKETS',
  screenCounter: 'ONE AT A TIME',
  messagesToday: 'HOT OFF PRESS',
  messagesYesterday: 'OLD NEWS',
  messagesEarlier: 'DUSTY MAIL',

  // Schedules
  schedulesToday: 'SEIZE THE DAY',
  schedulesTomorrow: 'SLEEP ON IT',
  schedulesOff: 'ON A BREAK',
  recentRuns: 'DONE AND DONE',
  scheduleAgent: 'YOU ARE UP',

  // Any other day's box, Messages' or Schedules', by its weekday
  sunday: 'SUNDAY FUNDAY',
  monday: 'MONDAY AGAIN',
  tuesday: 'TACO TUESDAY',
  wednesday: 'HUMP DAY',
  thursday: 'ALMOST FRIDAY',
  friday: 'FRIYAY',
  saturday: 'LAZY SATURDAY',

  // Settings
  settingsHub: 'JUNK DRAWER',
  theme: 'DARK SIDE',
  extraKeys: 'ANY KEY',
  atLaunch: 'LIFTOFF',
  phoneControl: 'LOOK NO HANDS',
  lockMode: 'FINGER GUNS',

  // Privacy
  usageStats: 'JUST NUMBERS',
  privacyAlso: 'PS ALSO THIS',
  privacyTools: 'YOUR CALL',
  backRoom: 'STAFF ONLY',
  privacyDeclared: 'NO SECRETS',
  privacyNever: 'STAYS HOME',

  // About and updates
  specPlate: 'FACTORY NEW',
  aboutLinks: 'SMALL PRINT',
  credits: 'ROLL CREDITS',
  liteBox: 'UNBOX ME',
  buildLabel: 'HOT OFF CI',
  buildRoute: 'ON ITS WAY',

  // Account and telling a friend
  crewPass: 'ALL ACCESS',
  crewPassBlank: 'NOT ON LIST',
  accountFollows: 'TAG ALONG',
  accountComing: 'SOON-ISH',
  shareLinks: 'WORD OF MOUTH',
  shareFunnel: 'GOING VIRAL',
} as const;

/** A box's barcode line, by what the box is. */
export type BarcodeId = keyof typeof BARCODE_LINES;

export const LINE_MAX = 13;
