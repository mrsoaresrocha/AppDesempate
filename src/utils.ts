import { DecisionAnalysis } from "./types";

/**
 * Calculates dynamic preference scores for each option based on user-adjusted weights.
 * We normalize the scores so they sum to 100% or represent a clear comparative index.
 */
export function calculateDynamicScores(
  analysis: DecisionAnalysis,
  userWeights: {
    prosCons?: Record<string, Record<string, number>>; // option -> pro/con text -> weight
    criteria?: Record<string, number>; // criterion -> weight
  }
): Record<string, number> {
  const optionScores: Record<string, number> = {};

  analysis.options.forEach((option) => {
    // Start with a base score
    let score = 0;

    // 1. Calculate Pros & Cons contribution
    const optProsCons = analysis.prosCons.find((pc) => pc.option === option);
    if (optProsCons) {
      let prosSum = 0;
      let consSum = 0;

      optProsCons.pros.forEach((pro) => {
        const weight = userWeights.prosCons?.[option]?.[pro.text] ?? pro.importance;
        prosSum += weight;
      });

      optProsCons.cons.forEach((con) => {
        const weight = userWeights.prosCons?.[option]?.[con.text] ?? con.importance;
        consSum += weight;
      });

      // Simple net score from pros and cons: pros outweigh cons
      score += (prosSum - consSum) * 1.5;
    }

    // 2. Calculate Comparison Matrix contribution
    analysis.comparisonMatrix.rows.forEach((row) => {
      const rating = row.ratings[option] ?? 3; // default neutral
      const criterionWeight = userWeights.criteria?.[row.criterion] ?? 1; // default multiplier
      
      // score adds rating (1-5) * criterion weight (1-3)
      score += rating * criterionWeight * 2;
    });

    optionScores[option] = score;
  });

  // Normalize scores to percentages or relative index
  const minScore = Math.min(...Object.values(optionScores));
  
  // To avoid dividing by zero or negative relative weights, shift scores if min is negative
  const shiftedScores: Record<string, number> = {};
  let shiftedSum = 0;
  
  analysis.options.forEach((option) => {
    const shifted = Math.max(1, optionScores[option] - (minScore < 0 ? minScore : 0) + 10);
    shiftedScores[option] = shifted;
    shiftedSum += shifted;
  });

  const finalPercentages: Record<string, number> = {};
  analysis.options.forEach((option) => {
    finalPercentages[option] = shiftedSum > 0 
      ? Math.round((shiftedScores[option] / shiftedSum) * 100) 
      : 50;
  });

  return finalPercentages;
}

/**
 * Gets a friendly color scale class for a given rating (1-5)
 */
export function getRatingColorClass(rating: number): string {
  switch (rating) {
    case 5:
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case 4:
      return "bg-teal-50 text-teal-700 border-teal-200";
    case 3:
      return "bg-slate-50 text-slate-700 border-slate-200";
    case 2:
      return "bg-amber-50 text-amber-700 border-amber-200";
    case 1:
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

/**
 * Clean mock templates for some default decision choices to provide as interactive examples
 */
export const DEFAULT_EXAMPLES = [
  {
    title: "Comprar Carro Elétrico vs. Manter SUV a Gasolina",
    decision: "Devo comprar um veículo elétrico agora ou continuar dirigindo meu SUV atual movido a gasolina?",
    options: ["Comprar Veículo Elétrico", "Manter SUV a Gasolina"],
    context: "Tenho um trajeto diário de 30 minutos. Preocupo-me com a pegada de carbono, mas tenho receio em relação à infraestrutura de recarga e ao preço inicial de compra."
  },
  {
    title: "Cursar Ciência da Computação vs. Design de Produto UX/UI",
    decision: "Qual caminho de carreira/curso devo seguir: Ciência da Computação ou Design de UX?",
    options: ["Ciência da Computação", "Design de Produto UX/UI"],
    context: "Gosto tanto de lógica de programação quanto de design visual. Quero forte estabilidade profissional, mas também realização criativa."
  },
  {
    title: "Modelo de Assinatura SaaS vs. Compra de Licença Única",
    decision: "Como devemos monetizar nosso novo aplicativo de produtividade?",
    options: ["Assinatura Mensal SaaS", "Licença Única Vitalícia"],
    context: "Somos uma equipe de dois desenvolvedores. Precisamos de receita contínua, mas os usuários estão sofrendo com a fadiga de assinaturas."
  }
];
