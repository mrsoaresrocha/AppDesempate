import React, { useState, useEffect } from "react";
import { 
  Brain, Scale, FileSpreadsheet, Compass, Plus, Trash, 
  Loader2, CheckCircle, XCircle, Info, Sparkles, TrendingUp, 
  History, SlidersHorizontal, ArrowRight, ChevronDown, ChevronUp, 
  RefreshCw, Download, BookOpen, Award, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DecisionAnalysis, SavedDecisionSummary } from "./types";
import { calculateDynamicScores, getRatingColorClass, DEFAULT_EXAMPLES } from "./utils";

const LOADING_STEPS = [
  "Analisando compensações (trade-offs) principais...",
  "Pesando prós e contras...",
  "Gerando matriz de comparação multicritério...",
  "Esboçando quadrantes estratégicos SWOT...",
  "Consultando o motor de IA do Desempate...",
  "Calibrando parâmetros de recomendação...",
  "Sintetizando perguntas de reflexão final..."
];

export default function App() {
  // Input states
  const [decision, setDecision] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [context, setContext] = useState("");

  // UI state
  const [currentAnalysis, setCurrentAnalysis] = useState<DecisionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"proscons" | "comparison" | "swot">("proscons");
  const [selectedSwotOption, setSelectedSwotOption] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);

  // Dynamic weighting states
  const [userWeights, setUserWeights] = useState<{
    prosCons: Record<string, Record<string, number>>; // option -> text -> weight
    criteria: Record<string, number>; // criterion -> weight
  }>({
    prosCons: {},
    criteria: {}
  });

  // Saved answers to reflection questions
  const [reflectionAnswers, setReflectionAnswers] = useState<Record<string, string>>({});
  const [finalChoice, setFinalChoice] = useState<string>("");
  const [isLockedIn, setIsLockedIn] = useState(false);

  // Persistence
  const [savedDecisions, setSavedDecisions] = useState<DecisionAnalysis[]>([]);

  // Load saved decisions from localStorage
  useEffect(() => {
    const loaded = localStorage.getItem("the_tiebreaker_decisions");
    if (loaded) {
      try {
        const parsed = JSON.parse(loaded) as DecisionAnalysis[];
        setSavedDecisions(parsed);
      } catch (e) {
        console.error("Failed to load decisions:", e);
      }
    }
  }, []);

  // Sync saved decisions to localStorage
  const saveDecisionsToStorage = (decisions: DecisionAnalysis[]) => {
    localStorage.setItem("the_tiebreaker_decisions", JSON.stringify(decisions));
    setSavedDecisions(decisions);
  };

  // Cycling loading phrases
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 3500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Options fields manipulation
  const handleAddOption = () => {
    if (options.length < 5) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const copy = [...options];
      copy.splice(index, 1);
      setOptions(copy);
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const copy = [...options];
    copy[index] = val;
    setOptions(copy);
  };

  // Reset current analysis state to define a new dilemma
  const handleNewDecision = () => {
    setDecision("");
    setOptions(["", ""]);
    setContext("");
    setCurrentAnalysis(null);
    setReflectionAnswers({});
    setFinalChoice("");
    setIsLockedIn(false);
    setError(null);
  };

  // Load a preset example
  const handleLoadExample = (preset: typeof DEFAULT_EXAMPLES[0]) => {
    setDecision(preset.decision);
    setOptions(preset.options);
    setContext(preset.context);
  };

  // Handle analysis generation
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision.trim()) {
      setError("Por favor, descreva a decisão que você está enfrentando.");
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentAnalysis(null);
    setReflectionAnswers({});
    setFinalChoice("");
    setIsLockedIn(false);

    // Filter empty options
    const finalOptions = options.filter(o => o.trim() !== "");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decision.trim(),
          options: finalOptions.length > 0 ? finalOptions : undefined,
          context: context.trim() || undefined
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Falha ao analisar a decisão.");
      }

      const data = (await response.json()) as DecisionAnalysis;
      
      // Initialize dynamic weights
      const initialProsConsWeights: Record<string, Record<string, number>> = {};
      data.prosCons.forEach(pc => {
        initialProsConsWeights[pc.option] = {};
        pc.pros.forEach(p => { initialProsConsWeights[pc.option][p.text] = p.importance; });
        pc.cons.forEach(c => { initialProsConsWeights[pc.option][c.text] = c.importance; });
      });

      const initialCriteriaWeights: Record<string, number> = {};
      data.comparisonMatrix.criteria.forEach(c => {
        initialCriteriaWeights[c] = 1; // Default multiplier is 1x
      });

      setUserWeights({
        prosCons: initialProsConsWeights,
        criteria: initialCriteriaWeights
      });

      setCurrentAnalysis(data);
      setSelectedSwotOption(data.options[0]);

      // Add to history
      const updatedHistory = [data, ...savedDecisions.filter(d => d.title !== data.title)].slice(0, 20);
      saveDecisionsToStorage(updatedHistory);

    } catch (err: any) {
      setError(err.message || "Algo deu errado ao consultar o oráculo de decisões.");
    } finally {
      setLoading(false);
    }
  };

  // Delete decision from history
  const handleDeleteDecision = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedDecisions.filter(d => d.id !== id);
    saveDecisionsToStorage(updated);
    if (currentAnalysis?.id === id) {
      setCurrentAnalysis(null);
    }
  };

  // Load decision from history
  const handleSelectHistory = (decisionItem: DecisionAnalysis) => {
    setCurrentAnalysis(decisionItem);
    setSelectedSwotOption(decisionItem.options[0]);
    setIsLockedIn(false);
    setReflectionAnswers({});
    setFinalChoice("");
    
    // Set up weights if they exist in the saved object, or reconstruct defaults
    if (decisionItem.userWeights) {
      setUserWeights({
        prosCons: decisionItem.userWeights.prosCons || {},
        criteria: decisionItem.userWeights.criteria || {}
      });
    } else {
      const initialProsConsWeights: Record<string, Record<string, number>> = {};
      decisionItem.prosCons.forEach(pc => {
        initialProsConsWeights[pc.option] = {};
        pc.pros.forEach(p => { initialProsConsWeights[pc.option][p.text] = p.importance; });
        pc.cons.forEach(c => { initialProsConsWeights[pc.option][c.text] = c.importance; });
      });

      const initialCriteriaWeights: Record<string, number> = {};
      decisionItem.comparisonMatrix.criteria.forEach(c => {
        initialCriteriaWeights[c] = 1;
      });

      setUserWeights({
        prosCons: initialProsConsWeights,
        criteria: initialCriteriaWeights
      });
    }
    setShowHistory(false);
  };

  // Update a single Pro/Con item importance weight
  const handleUpdateProConWeight = (option: string, text: string, isPro: boolean, newWeight: number) => {
    if (newWeight < 1 || newWeight > 5) return;
    setUserWeights(prev => {
      const updated = { ...prev.prosCons };
      if (!updated[option]) updated[option] = {};
      updated[option][text] = newWeight;
      const nextWeights = { ...prev, prosCons: updated };
      
      // Save updated weights in the current analysis object
      if (currentAnalysis) {
        const updatedAnalysis = { ...currentAnalysis, userWeights: nextWeights };
        setCurrentAnalysis(updatedAnalysis);
        // Sync history
        const updatedHistory = savedDecisions.map(d => d.id === currentAnalysis.id ? updatedAnalysis : d);
        saveDecisionsToStorage(updatedHistory);
      }
      return nextWeights;
    });
  };

  // Update a comparison criterion multiplier
  const handleUpdateCriterionMultiplier = (criterion: string, multiplier: number) => {
    setUserWeights(prev => {
      const updated = { ...prev.criteria, [criterion]: multiplier };
      const nextWeights = { ...prev, criteria: updated };
      
      if (currentAnalysis) {
        const updatedAnalysis = { ...currentAnalysis, userWeights: nextWeights };
        setCurrentAnalysis(updatedAnalysis);
        const updatedHistory = savedDecisions.map(d => d.id === currentAnalysis.id ? updatedAnalysis : d);
        saveDecisionsToStorage(updatedHistory);
      }
      return nextWeights;
    });
  };

  // Dynamic Scores recalculation
  const dynamicScores = currentAnalysis 
    ? calculateDynamicScores(currentAnalysis, userWeights)
    : {};

  // Find dynamic recommendation
  let dynamicWinner = "";
  let highestScore = -1;
  Object.entries(dynamicScores).forEach(([option, score]) => {
    if (score > highestScore) {
      highestScore = score;
      dynamicWinner = option;
    }
  });

  const handleLockInDecision = () => {
    if (!finalChoice) return;
    setIsLockedIn(true);
    // Persist final choice back into stored object
    if (currentAnalysis) {
      const updatedAnalysis = {
        ...currentAnalysis,
        verdict: {
          ...currentAnalysis.verdict,
          summary: `${currentAnalysis.verdict.summary}\n\n🔒 ESCOLHA CONFIRMADA: Você escolheu oficialmente "${finalChoice}" após reflexão.`
        }
      };
      const updatedHistory = savedDecisions.map(d => d.id === currentAnalysis.id ? updatedAnalysis : d);
      saveDecisionsToStorage(updatedHistory);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-200 antialiased" id="the-tiebreaker-app">
      
      {/* Header Bar */}
      <header className="h-16 px-6 md:px-8 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 sticky top-0 z-40" id="header-bar">
        <div className="flex items-center gap-3">
          {/* Logo - Minimalist Scale Balance */}
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <div className="w-1 h-4 bg-white transform rotate-[30deg] translate-x-[2px]"></div>
            <div className="w-1 h-4 bg-white transform -rotate-[30deg] -translate-x-[2px]"></div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight uppercase text-slate-900">O Desempate</h1>
          </div>
        </div>

        <nav className="hidden md:flex gap-6 text-xs font-bold uppercase tracking-wider text-slate-500">
          <button
            type="button"
            onClick={() => {
              if (savedDecisions.length > 0 && !currentAnalysis) {
                setCurrentAnalysis(savedDecisions[0]);
              }
              setShowHistory(false);
            }}
            className={`hover:text-slate-900 transition-colors pb-1 ${
              currentAnalysis && !showHistory ? "text-slate-900 border-b-2 border-slate-900" : ""
            }`}
          >
            Análise Ativa
          </button>
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className={`hover:text-slate-900 transition-colors pb-1 ${
              showHistory ? "text-slate-900 border-b-2 border-slate-900" : ""
            }`}
          >
            Histórico ({savedDecisions.length})
          </button>
        </nav>

        <button
          onClick={handleNewDecision}
          className="px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors"
          id="new-decision-btn"
        >
          Nova Decisão
        </button>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Collapsible History Section */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8 border border-slate-200 rounded-xl bg-white shadow-sm"
              id="history-panel"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                  <History className="h-4 w-4 text-slate-600" />
                  <span>Seu Histórico de Decisões</span>
                </h3>
                <button 
                  onClick={() => setShowHistory(false)} 
                  className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-950 transition-colors"
                >
                  Fechar Painel
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {savedDecisions.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-slate-400">
                    <p className="text-xs font-medium">Nenhuma decisão analisada ainda. Comece descrevendo seu dilema abaixo.</p>
                  </div>
                ) : (
                  savedDecisions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectHistory(item)}
                      className={`cursor-pointer p-4 rounded-xl border transition-all relative group hover:border-slate-400 hover:shadow-sm ${
                        currentAnalysis?.id === item.id 
                          ? "border-slate-900 bg-slate-50" 
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <button
                        onClick={(e) => handleDeleteDecision(item.id, e)}
                        className="absolute top-3 right-3 text-slate-300 hover:text-rose-600 p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        title="Excluir decisão"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>

                      <p className="text-[10px] font-mono text-slate-400 mb-1">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                      <h4 className="font-bold text-slate-900 line-clamp-1 mb-1.5 pr-4">{item.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{item.description}</p>
                      
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold line-clamp-1 max-w-[150px]">
                          Recom.: {item.verdict.recommendation}
                        </span>
                        <span className="text-[10px] text-slate-900 font-bold flex items-center">
                          Nota {item.verdict.tiebreakerScore}% <ArrowRight className="h-2.5 w-2.5 ml-1" />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Outer Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT PANEL: Inputs and Formulation */}
          <section className="lg:col-span-4 space-y-6">
            
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center space-x-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-600" />
                <span>Formular Dilema</span>
              </h2>

              <form onSubmit={handleAnalyze} className="space-y-5">
                
                {/* Preset Fast-Loader */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Cenários Rápidos de Teste
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_EXAMPLES.map((ex, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleLoadExample(ex)}
                        className="text-[11px] bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium transition-colors"
                      >
                        {ex.title.split(" vs.")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* The Core Question */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5" htmlFor="decision-input">
                    Qual decisão você está enfrentando? <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    id="decision-input"
                    rows={3}
                    placeholder="Ex: Devo aceitar a oferta de Líder Sênior ou continuar no meu emprego atual?"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Specific Options */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
                      Especificar Opções (Opcional)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      disabled={options.length >= 4}
                      className="text-xs text-slate-900 hover:text-slate-600 flex items-center space-x-1 font-bold uppercase tracking-wide disabled:text-slate-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Adicionar Opção</span>
                    </button>
                  </div>
                  
                  <p className="text-[10px] text-slate-400 mb-2.5">Deixe em branco para que o agente de IA determine as alternativas lógicas de escolha.</p>

                  <div className="space-y-2">
                    {options.map((option, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-slate-400 w-5">{idx + 1}.</span>
                        <input
                          type="text"
                          placeholder={`Opção ${idx + 1}`}
                          value={option}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                        />
                        {options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Context & Preferences */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5" htmlFor="context-input">
                    Adicionar contexto ou preferências (Opcional)
                  </label>
                  <textarea
                    id="context-input"
                    rows={2.5}
                    placeholder="Ex: Eu priorizo baixo estresse inicial, trabalho híbrido, mas estabilidade de longo prazo..."
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                {error && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start space-x-2.5 text-xs text-rose-800">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center space-x-2 disabled:bg-slate-200 disabled:text-slate-400"
                  id="submit-analysis-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sintetizando espaço de decisão...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-white" />
                      <span>Analisar Opções & Desempatar</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Quick Tips */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-xs text-slate-500 space-y-3">
              <h4 className="font-bold text-slate-900 flex items-center space-x-1.5 uppercase tracking-wide">
                <Info className="h-4 w-4 text-slate-500" />
                <span>A Metodologia</span>
              </h4>
              <ul className="space-y-1.5 list-disc list-inside text-slate-600">
                <li>A IA constrói Prós e Contras personalizados, matrizes comparativas e quadrantes SWOT de forma analítica.</li>
                <li>Ajuste fino dos pesos de importância para fatores e critérios específicos.</li>
                <li>O <strong className="text-slate-900 font-semibold">Placar Interativo ao Vivo</strong> recalcula os modelos de comparação em tempo real.</li>
              </ul>
            </div>
          </section>

          {/* RIGHT PANEL: Results or Splash */}
          <section className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {loading ? (
                /* Gorgeous, cycling loading stage */
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="min-h-[480px] flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl p-8 text-center space-y-6 shadow-sm"
                  id="loading-spinner"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-slate-100 rounded-full blur-xl animate-pulse" />
                    <Loader2 className="h-12 w-12 text-slate-900 animate-spin relative" />
                  </div>
                  
                  <div className="space-y-2 max-w-sm">
                    <h3 className="font-bold uppercase tracking-wider text-slate-900 text-sm">Sintetizando Espaço de Decisão</h3>
                    <div className="h-6 overflow-hidden">
                      <AnimatePresence mode="popLayout">
                        <motion.p
                          key={loadingStep}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="text-xs text-slate-500 font-mono uppercase tracking-wide"
                        >
                          {LOADING_STEPS[loadingStep]}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Quadros de comparação de alta fidelidade estão sendo formatados</p>
                  </div>
                </motion.div>

              ) : currentAnalysis ? (
                /* Main Results Dashboard */
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                  id="results-view"
                >
                  {/* Top Verdict Briefing */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none">
                      <Scale className="h-40 w-40 text-slate-900" />
                    </div>

                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 relative">
                      <div className="space-y-3 max-w-xl">
                        <span className="bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded uppercase tracking-widest font-bold inline-flex items-center space-x-1.5">
                          <Award className="h-3.5 w-3.5" />
                          <span>Veredito de Desempate da IA</span>
                        </span>
                        <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 leading-snug">{currentAnalysis.title}</h2>
                        <p className="text-xs text-slate-500 font-medium">{currentAnalysis.description}</p>
                      </div>

                      {/* Score Highlight Box */}
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex items-center space-x-4 flex-shrink-0 min-w-[240px]">
                        <div className="relative h-14 w-14 flex-shrink-0">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="28" cy="28" r="24" stroke="#e2e8f0" strokeWidth="4" fill="transparent" />
                            <circle cx="28" cy="28" r="24" stroke="#0f172a" strokeWidth="4" fill="transparent"
                              strokeDasharray={2 * Math.PI * 24}
                              strokeDashoffset={2 * Math.PI * 24 * (1 - (currentAnalysis.verdict.tiebreakerScore / 100))}
                              className="transition-all duration-500"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-900">
                            {currentAnalysis.verdict.tiebreakerScore}%
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Escolha Recomendada</p>
                          <p className="text-xs font-bold uppercase text-slate-900 truncate max-w-[160px]">{currentAnalysis.verdict.recommendation}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-6">
                      <div className="md:col-span-8 space-y-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estratégia de Síntese</h4>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{currentAnalysis.verdict.summary}</p>
                      </div>
                      
                      <div className="md:col-span-4 space-y-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Principais Fatores Decisivos</h4>
                        <ul className="space-y-1.5">
                          {currentAnalysis.verdict.keyFactors.map((factor, idx) => (
                            <li key={idx} className="flex items-start space-x-2 text-xs text-slate-700">
                              <span className="bg-slate-900 text-white font-bold h-4 w-4 rounded flex items-center justify-center flex-shrink-0 text-[9px] mt-0.5">{idx + 1}</span>
                              <span className="font-medium text-[11px]">{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* DYNAMIC LIVE SCOREBOARD */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-slate-600" />
                          <span>Placar Interativo ao Vivo</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Recalcula os índices de comparação ao vivo à medida que você personaliza os controles abaixo.</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        Vencedor: {dynamicWinner}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentAnalysis.options.map((option) => {
                        const score = dynamicScores[option] ?? 50;
                        const isWinner = option === dynamicWinner;
                        return (
                          <div 
                            key={option} 
                            className={`p-4 rounded-xl border transition-all ${
                              isWinner 
                                ? "bg-slate-50 border-slate-400" 
                                : "bg-white border-slate-200"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-xs font-bold uppercase text-slate-800 truncate block max-w-[200px]" title={option}>
                                  {option}
                                </span>
                              </div>
                              <span className={`text-xs font-bold font-mono ${isWinner ? 'text-slate-900' : 'text-slate-400'}`}>
                                {score}%
                              </span>
                            </div>

                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                  isWinner ? "bg-slate-900" : "bg-slate-400"
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interactive Details tabs */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    
                    {/* Navigation Tabs */}
                    <div className="flex border-b border-slate-200 bg-slate-50">
                      <button
                        onClick={() => setActiveTab("proscons")}
                        className={`flex-1 py-4 text-center font-bold text-xs uppercase tracking-wider border-b-2 flex items-center justify-center space-x-2 transition-all ${
                          activeTab === "proscons"
                            ? "border-slate-900 text-slate-900 bg-white"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                        id="tab-proscons"
                      >
                        <Scale className="h-4 w-4" />
                        <span>1. Lista Ponderada de Prós & Contras</span>
                      </button>

                      <button
                        onClick={() => setActiveTab("comparison")}
                        className={`flex-1 py-4 text-center font-bold text-xs uppercase tracking-wider border-b-2 flex items-center justify-center space-x-2 transition-all ${
                          activeTab === "comparison"
                            ? "border-slate-900 text-slate-900 bg-white"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                        id="tab-comparison"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>2. Matriz de Critérios de Avaliação</span>
                      </button>

                      <button
                        onClick={() => setActiveTab("swot")}
                        className={`flex-1 py-4 text-center font-bold text-xs uppercase tracking-wider border-b-2 flex items-center justify-center space-x-2 transition-all ${
                          activeTab === "swot"
                            ? "border-slate-900 text-slate-900 bg-white"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                        id="tab-swot"
                      >
                        <Compass className="h-4 w-4" />
                        <span>3. Análise SWOT</span>
                      </button>
                    </div>

                    {/* Content Frame */}
                    <div className="p-6">
                      
                      {/* 1. PROS AND CONS VIEW */}
                      {activeTab === "proscons" && (
                        <div className="space-y-6" id="proscons-panel">
                          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1.5">
                            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                            <span>Controles de peso interativos: personalize as prioridades dos fatores de 1 (baixo) a 5 (alto) abaixo.</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {currentAnalysis.prosCons.map((pc) => (
                              <div key={pc.option} className="space-y-4 border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                                <h4 className="font-bold text-slate-900 border-b pb-2 text-xs uppercase tracking-wide flex items-center justify-between">
                                  <span>{pc.option}</span>
                                  <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-mono font-bold">
                                    {(userWeights.prosCons?.[pc.option] ? Object.values(userWeights.prosCons[pc.option]).reduce((a: number, b: number) => a + b, 0) : 0)} Pontos no Total
                                  </span>
                                </h4>

                                {/* PROS */}
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <h5 className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Prós</h5>
                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-bold">Fatores Positivos</span>
                                  </div>
                                  {pc.pros.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Nenhum ponto pró identificado.</p>
                                  ) : (
                                    pc.pros.map((pro, index) => {
                                      const weight = userWeights.prosCons?.[pc.option]?.[pro.text] ?? pro.importance;
                                      return (
                                        <div key={index} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 transition-all">
                                          <div className="flex justify-between items-start gap-3">
                                            <div className="flex gap-2 items-start flex-1">
                                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                                              <p className="text-xs font-semibold text-slate-800">{pro.text}</p>
                                            </div>
                                            
                                            {/* Weighted Adjuster */}
                                            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded flex-shrink-0 text-slate-800">
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateProConWeight(pc.option, pro.text, true, weight - 1)}
                                                className="text-xs font-bold px-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900"
                                              >
                                                -
                                              </button>
                                              <span className="text-[10px] font-bold text-slate-700 px-1 w-7 text-center">
                                                Peso: {weight}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateProConWeight(pc.option, pro.text, true, weight + 1)}
                                                className="text-xs font-bold px-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                          <p className="text-[11px] text-slate-500 leading-relaxed pl-3.5">{pro.explanation}</p>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                {/* CONS */}
                                <div className="space-y-3 pt-2">
                                  <div className="flex justify-between items-center">
                                    <h5 className="text-[10px] font-bold text-rose-700 uppercase tracking-widest">Contras</h5>
                                    <span className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded uppercase font-bold">Fatores de Risco</span>
                                  </div>
                                  {pc.cons.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Nenhum ponto contra identificado.</p>
                                  ) : (
                                    pc.cons.map((con, index) => {
                                      const weight = userWeights.prosCons?.[pc.option]?.[con.text] ?? con.importance;
                                      return (
                                        <div key={index} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 transition-all">
                                          <div className="flex justify-between items-start gap-3">
                                            <div className="flex gap-2 items-start flex-1">
                                              <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></div>
                                              <p className="text-xs font-semibold text-slate-800">{con.text}</p>
                                            </div>
                                            
                                            {/* Weighted Adjuster */}
                                            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded flex-shrink-0 text-slate-800">
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateProConWeight(pc.option, con.text, false, weight - 1)}
                                                className="text-xs font-bold px-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900"
                                              >
                                                -
                                              </button>
                                              <span className="text-[10px] font-bold text-slate-700 px-1 w-7 text-center">
                                                Peso: {weight}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateProConWeight(pc.option, con.text, false, weight + 1)}
                                                className="text-xs font-bold px-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                          <p className="text-[11px] text-slate-500 leading-relaxed pl-3.5">{con.explanation}</p>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 2. COMPARISON MATRIX VIEW */}
                      {activeTab === "comparison" && (
                        <div className="space-y-6 overflow-x-auto" id="comparison-panel">
                          <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="py-3 px-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Critério de Avaliação</th>
                                <th className="py-3 px-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Peso do Critério</th>
                                {currentAnalysis.options.map((option) => (
                                  <th key={option} className="py-3 px-4 text-xs font-bold uppercase text-slate-900 tracking-wide font-bold">
                                    {option}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {currentAnalysis.comparisonMatrix.rows.map((row) => {
                                const criterionWeight = userWeights.criteria[row.criterion] ?? 1;
                                return (
                                  <tr key={row.criterion} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 px-4 font-bold text-slate-800 text-xs uppercase tracking-wide">{row.criterion}</td>
                                    
                                    {/* Criterion Weight Controller */}
                                    <td className="py-4 px-4">
                                      <div className="flex space-x-1">
                                        {[1, 2, 3].map((val) => (
                                          <button
                                            key={val}
                                            type="button"
                                            onClick={() => handleUpdateCriterionMultiplier(row.criterion, val)}
                                            className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${
                                              criterionWeight === val
                                                ? "bg-slate-900 text-white"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            }`}
                                          >
                                            {val}x
                                          </button>
                                        ))}
                                      </div>
                                    </td>

                                    {/* Option cells with scores & details */}
                                    {currentAnalysis.options.map((option) => {
                                      const score = row.ratings[option] ?? 3;
                                      const colorClass = getRatingColorClass(score);
                                      const explanation = row.explanations[option] ?? "Avaliado.";
                                      return (
                                        <td key={option} className="py-4 px-4">
                                          <div className="space-y-1.5 max-w-xs">
                                            <span className={`inline-block px-2.5 py-0.5 text-[10px] rounded uppercase tracking-wide font-bold border ${colorClass}`}>
                                              Nota: {score}/5
                                            </span>
                                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{explanation}</p>
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* 3. SWOT ANALYSIS VIEW */}
                      {activeTab === "swot" && (
                        <div className="space-y-6" id="swot-panel">
                          
                          {/* Option Switcher for SWOT */}
                          <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selecionar Opção:</span>
                            <div className="flex space-x-2">
                              {currentAnalysis.options.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => setSelectedSwotOption(option)}
                                  className={`text-xs px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-all ${
                                    selectedSwotOption === option
                                      ? "bg-slate-900 text-white shadow"
                                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 2x2 SWOT grid */}
                          {currentAnalysis.swot.filter(s => s.option === selectedSwotOption).map((item) => (
                            <div key={item.option} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              
                              {/* STRENGTHS */}
                              <div className="p-5 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3">
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest flex items-center space-x-2">
                                  <span className="h-5 w-5 bg-slate-900 text-white font-bold rounded flex items-center justify-center text-[10px]">F</span>
                                  <span>Forças (Strengths)</span>
                                </h4>
                                <ul className="space-y-2">
                                  {item.strengths.map((s, idx) => (
                                    <li key={idx} className="text-xs text-slate-600 flex items-start space-x-2 leading-relaxed">
                                      <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                      <span>{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* WEAKNESSES */}
                              <div className="p-5 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3">
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest flex items-center space-x-2">
                                  <span className="h-5 w-5 bg-slate-900 text-white font-bold rounded flex items-center justify-center text-[10px]">F</span>
                                  <span>Fraquezas (Weaknesses)</span>
                                </h4>
                                <ul className="space-y-2">
                                  {item.weaknesses.map((w, idx) => (
                                    <li key={idx} className="text-xs text-slate-600 flex items-start space-x-2 leading-relaxed">
                                      <XCircle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                      <span>{w}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* OPPORTUNITIES */}
                              <div className="p-5 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3">
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest flex items-center space-x-2">
                                  <span className="h-5 w-5 bg-slate-900 text-white font-bold rounded flex items-center justify-center text-[10px]">O</span>
                                  <span>Oportunidades (Opportunities)</span>
                                </h4>
                                <ul className="space-y-2">
                                  {item.opportunities.map((o, idx) => (
                                    <li key={idx} className="text-xs text-slate-600 flex items-start space-x-2 leading-relaxed">
                                      <Sparkles className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                      <span>{o}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* THREATS */}
                              <div className="p-5 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3">
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest flex items-center space-x-2">
                                  <span className="h-5 w-5 bg-slate-900 text-white font-bold rounded flex items-center justify-center text-[10px]">A</span>
                                  <span>Ameaças (Threats)</span>
                                </h4>
                                <ul className="space-y-2">
                                  {item.threats.map((t, idx) => (
                                    <li key={idx} className="text-xs text-slate-600 flex items-start space-x-2 leading-relaxed">
                                      <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                      <span>{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  </div>

                  {/* INTERACTIVE PERSONAL REFLECTION WORKSPACE */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm space-y-6">
                    <div className="flex items-center space-x-2">
                      <Compass className="h-5 w-5 text-slate-600" />
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Oficina de Reflexão Pessoal</h3>
                    </div>
                    
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      A modelagem objetiva fornece diretrizes baseadas em dados, mas o alinhamento final exige uma autoanálise deliberada. Contemple estas perguntas personalizadas sintetizadas pela IA:
                    </p>

                    <div className="space-y-6">
                      {currentAnalysis.verdict.reflectionQuestions.map((question, index) => (
                        <div key={index} className="space-y-2">
                          <label className="block text-xs font-bold text-slate-700 leading-relaxed">
                            {index + 1}. {question}
                          </label>
                          <textarea
                            rows={2}
                            disabled={isLockedIn}
                            placeholder="Esboce seus pensamentos ou notas aqui..."
                            value={reflectionAnswers[question] ?? ""}
                            onChange={(e) => setReflectionAnswers({ ...reflectionAnswers, [question]: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </div>
                      ))}
                    </div>

                    {/* LOCK IN YOUR DECISION */}
                    <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Confirme sua escolha</span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {currentAnalysis.options.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => !isLockedIn && setFinalChoice(option)}
                              disabled={isLockedIn}
                              className={`text-xs px-3.5 py-1.5 rounded font-bold uppercase tracking-wide transition-all ${
                                finalChoice === option
                                  ? "bg-slate-900 text-white shadow ring-2 ring-slate-900 ring-offset-2"
                                  : "bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200"
                              } disabled:opacity-80`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isLockedIn ? (
                          <div className="flex items-center space-x-2 text-slate-900 text-xs font-bold uppercase tracking-wider bg-slate-100 px-4 py-2.5 rounded border border-slate-200">
                            <CheckCircle className="h-4 w-4" />
                            <span>Escolha Confirmada e Bloqueada</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleLockInDecision}
                            disabled={!finalChoice}
                            className="bg-slate-900 hover:bg-slate-850 text-white py-2.5 px-5 rounded text-xs font-bold uppercase tracking-wider shadow transition-all flex items-center space-x-2 disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            <span>Confirmar escolha</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                </motion.div>
              ) : (
                /* Empty/Initial Splash Page */
                <motion.div
                  key="splash"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="min-h-[480px] bg-white border border-dashed border-slate-300 rounded-xl p-8 md:p-12 text-center flex flex-col items-center justify-center space-y-6 shadow-sm"
                  id="empty-splash"
                >
                  <div className="p-4 bg-slate-50 text-slate-900 rounded-full border border-slate-200">
                    <Scale className="h-10 w-10" />
                  </div>
                  
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">Seu Painel de Desempate</h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Descreva um dilema pendente ou selecione um cenário de teste ativo abaixo. O Desempate construirá balanços ponderados de alta fidelidade, matrizes SWOT e rubricas detalhadas, dando a você controle total para modelar compensações com total clareza.
                    </p>
                  </div>

                  {/* Preset Fast Selection Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl pt-4">
                    {DEFAULT_EXAMPLES.map((ex, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleLoadExample(ex)}
                        className="cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/50 text-left transition-all hover:bg-white space-y-2 group"
                      >
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 line-clamp-1 group-hover:text-slate-950">{ex.title}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-normal">{ex.decision}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Toolbar - Clean Minimalism styling */}
            <footer className="mt-8 h-12 border border-slate-200 bg-white rounded-xl px-4 md:px-6 flex items-center justify-between shrink-0" id="bottom-toolbar">
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Modelo: Gemini 3.5
                </span>
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Matriz Ativa
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="px-2.5 py-1 border border-slate-200 rounded text-[10px] font-bold uppercase hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  EXPORTAR PDF
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Link de compartilhamento copiado!");
                  }}
                  className="px-2.5 py-1 border border-slate-200 rounded text-[10px] font-bold uppercase hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  COPIAR LINK
                </button>
              </div>
            </footer>

          </section>

        </div>
      </main>
    </div>
  );
}
