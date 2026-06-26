export interface JiraIssue {
  id: string;
  key: string;
  issuekey?: string;
  issueKey?: string;
  summary?: string;
  fields: JiraIssueFields;
}

export interface JiraIssueFields {
  issuekey?: string;
  issueKey?: string;
  summary: string;
  status: JiraStatus;
  assignee: JiraUser | null;
  reporter: JiraUser | null;
  priority: JiraPriority | null;
  issuetype: JiraIssueType;
  timeestimate: string | null;
  timespent: string | null;
  timeoriginalestimate: string | null;
  startdate: string | null;
  duedate: string | null;
  resolutiondate: string | null;
  created: string;
  updated: string;
  labels: string[];
  sprint: JiraSprint | null;
  resolution: JiraResolution | null;
  description: string | null;
  epic?: {
    key: string;
    fields: {
      name: string;
      color: string;
    };
  } | null;
  parent?: {
    key: string;
    fields: {
      summary: string;
    };
  } | null;
  subtasks?: JiraIssue[];
  startDate?: string | null;
  customfield_10300?: string | null;
  customfield_10302?: string | null;
}

export interface JiraStatusCategory {
  self: string;
  id: number;
  key: string;
  colorName: string;
  name: string;
}

export interface JiraStatus {
  self?: string;
  id: string;
  name: string;
  category: string;
  iconUrl?: string;
  statusCategory?: JiraStatusCategory;
}

export interface JiraUser {
  displayName: string;
  name: string;
  email?: string;
  avatarUrls?: Record<string, string>;
  active?: boolean;
}

export interface JiraPriority {
  name: string;
  iconUrl?: string;
  id?: string;
  severity?: string;
}

export interface JiraIssueType {
  name: string;
  iconUrl?: string;
  id?: string;
  subtask?: boolean;
}

export interface JiraSprint {
  name: string;
  id: number;
  state: 'future' | 'current' | 'closed';
  startDate: string | null;
  endDate: string | null;
}

export interface JiraResolution {
  name: string;
  description: string;
}

export interface JiraResolutionOption {
  self: string;
  name: string;
  id: string;
}

export interface JiraFieldSchema {
  type: string;
  system?: string;
  custom?: string;
  customId?: number;
}

export interface JiraTransitionField {
  required: boolean;
  schema: JiraFieldSchema;
  name: string;
  fieldId: string;
  operations: string[];
  allowedValues?: JiraResolutionOption[];
  fields?: Record<string, JiraTransitionField>;
  hasDefaultValue?: boolean;
  defaultValue?: unknown;
}

export interface JiraTransition {
  id: string;
  name: string;
  description: string;
  opsbarSequence: number;
  to: JiraStatus;
  fields: Record<string, JiraTransitionField>;
}

export interface JiraTransitionsResponse {
  expand: string;
  transitions: JiraTransition[];
}

export interface JiraEditMetaField {
  required: boolean;
  schema: {
    type: string;
    system?: string;
    custom?: string;
    customId?: number;
  };
  name: string;
  fieldId: string;
  operations: string[];
  allowedValues?: unknown[];
  autoCompleteUrl?: string;
}

export interface JiraEditMeta {
  fields: Record<string, JiraEditMetaField>;
}

export interface JiraSearchResponse {
  total: number;
  maxResults: number;
  issues: JiraIssue[];
}

export interface JiraGroupedData {
  label: string;
  estimatedSeconds: number;
  loggedSeconds: number;
}

export interface DashboardIssue {
  key: string;
  id: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
  issuetype: string;
  estimated: string;
  originalEstimate: string;
  logged: string;
  resolutionDate: string;
  created: string;
  updated: string;
  sprint: string;
  epic: string;
  labels: string[];
  resolution: string;
  startDate: string;
  dueDate: string;
}





