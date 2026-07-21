export interface ProConItem {
  text: string;
  importance: number; // 1 to 5
  explanation: string;
}

export interface OptionProsCons {
  option: string;
  pros: ProConItem[];
  cons: ProConItem[];
}

export interface ComparisonRow {
  criterion: string;
  ratings: Record<string, number>; // optionName -> score (1-5)
  explanations: Record<string, string>; // optionName -> details
}

export interface ComparisonMatrix {
  criteria: string[];
  rows: ComparisonRow[];
}

export interface SWOTData {
  option: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface VerdictData {
  recommendation: string;
  tiebreakerScore: number; // 0 to 100 representing confidence or preference index
  summary: string;
  keyFactors: string[];
  reflectionQuestions: string[];
}

export interface DecisionAnalysis {
  id: string;
  title: string;
  description: string;
  options: string[];
  prosCons: OptionProsCons[];
  comparisonMatrix: ComparisonMatrix;
  swot: SWOTData[];
  verdict: VerdictData;
  createdAt: string;
  // User-adjusted weights/custom states for interactivity
  userWeights?: {
    prosCons?: Record<string, Record<string, number>>; // option -> pro/con text -> weight
    criteria?: Record<string, number>; // criterion -> weight
  };
}

export interface SavedDecisionSummary {
  id: string;
  title: string;
  options: string[];
  recommendation: string;
  createdAt: string;
}
