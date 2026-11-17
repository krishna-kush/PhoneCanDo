// Every page of the stack, loaded the first time it opens rather than at
// launch: an import runs a page's whole module tree before the first frame,
// and most launches open few pages. Metro keeps a module once it has run, so
// a page loads once and stays; Home, the drawer and the stack itself are
// plain imports and load first.
export const Pages = {
  get AgentInstallLogPage(): typeof import('../env/agent/AgentInstallLogPage').default {
    return require('../env/agent/AgentInstallLogPage').default;
  },
  get AgentInstallPage(): typeof import('../env/agent/AgentInstallPage').default {
    return require('../env/agent/AgentInstallPage').default;
  },
  get AgentMachinePage(): typeof import('../env/agent/AgentMachinePage').default {
    return require('../env/agent/AgentMachinePage').default;
  },
  get AgentModelPage(): typeof import('../env/agent/AgentModelPage').default {
    return require('../env/agent/AgentModelPage').default;
  },
  get AgentChecksPage(): typeof import('../env/agent/checks/AgentChecksPage').default {
    return require('../env/agent/checks/AgentChecksPage').default;
  },
  get AgentMascotPage(): typeof import('../env/agent/mascot/AgentMascotPage').default {
    return require('../env/agent/mascot/AgentMascotPage').default;
  },
  get AgentPage(): typeof import('../env/agent/AgentPage').default {
    return require('../env/agent/AgentPage').default;
  },
  get CustomAgentForm(): typeof import('../env/custom-agents/CustomAgentForm').default {
    return require('../env/custom-agents/CustomAgentForm').default;
  },
  get CustomAgentList(): typeof import('../env/custom-agents/CustomAgentList').default {
    return require('../env/custom-agents/CustomAgentList').default;
  },
  get ImportAgent(): typeof import('../env/custom-agents/ImportAgent').default {
    return require('../env/custom-agents/ImportAgent').default;
  },
  get EnvList(): typeof import('../env/list/EnvList').default {
    return require('../env/list/EnvList').default;
  },
  get SystemPage(): typeof import('../env/list/SystemPage').default {
    return require('../env/list/SystemPage').default;
  },
  get ChooseAgent(): typeof import('../env/new-agent/ChooseAgent').default {
    return require('../env/new-agent/ChooseAgent').default;
  },
  get ChoosePlace(): typeof import('../env/new-agent/ChoosePlace').default {
    return require('../env/new-agent/ChoosePlace').default;
  },
  get AddSystem(): typeof import('../env/new-env/AddSystem').default {
    return require('../env/new-env/AddSystem').default;
  },
  get ConfirmPull(): typeof import('../env/new-env/ConfirmPull').default {
    return require('../env/new-env/ConfirmPull').default;
  },
  get OsPicker(): typeof import('../env/new-env/OsPicker').default {
    return require('../env/new-env/OsPicker').default;
  },
  get PullProgress(): typeof import('../env/new-env/PullProgress').default {
    return require('../env/new-env/PullProgress').default;
  },
  get TagPicker(): typeof import('../env/new-env/TagPicker').default {
    return require('../env/new-env/TagPicker').default;
  },
  get MessagesPage(): typeof import('../messages/MessagesPage').default {
    return require('../messages/MessagesPage').default;
  },
  get ModelLogPage(): typeof import('../models/model/ModelLogPage').default {
    return require('../models/model/ModelLogPage').default;
  },
  get ModelPage(): typeof import('../models/model/ModelPage').default {
    return require('../models/model/ModelPage').default;
  },
  get ModelsPage(): typeof import('../models/ModelsPage').default {
    return require('../models/ModelsPage').default;
  },
  get RepoPage(): typeof import('../models/RepoPage').default {
    return require('../models/RepoPage').default;
  },
  get SchedulesPage(): typeof import('../schedule/SchedulesPage').default {
    return require('../schedule/SchedulesPage').default;
  },
  get ScheduleRulesPage(): typeof import('../schedule/rules/RulesPage').default {
    return require('../schedule/rules/RulesPage').default;
  },
  get AboutPage(): typeof import('../settings/AboutPage').default {
    return require('../settings/AboutPage').default;
  },
  get SettingsPage(): typeof import('../settings/SettingsPage').default {
    return require('../settings/SettingsPage').default;
  },
  get SettingsScreen(): typeof import('../settings/SettingsScreen').default {
    return require('../settings/SettingsScreen').default;
  },
  get ShiftPage(): typeof import('../starter/ShiftPage').default {
    return require('../starter/ShiftPage').default;
  },
  get FolderPicker(): typeof import('../terminal/FolderPicker').default {
    return require('../terminal/FolderPicker').default;
  },
  get TerminalPage(): typeof import('../terminal/TerminalPage').default {
    return require('../terminal/TerminalPage').default;
  },
};
