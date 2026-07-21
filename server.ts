import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { setGlobalDispatcher, Agent } from "undici";

dotenv.config();

// Increase Node global fetch timeout to prevent HeadersTimeoutError (for large LLM structured outputs)
setGlobalDispatcher(new Agent({
  headersTimeout: 150000, // 2.5 minutes
  bodyTimeout: 150000,
  connectTimeout: 60000,
}));

const app = express();
const PORT = 3000;

app.use(express.json());

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please add it in your Secrets / Settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
        timeout: 150000, // 2.5 minutes timeout
      }
    });
  }
  return aiClient;
}

// REST API for decision analysis
app.post("/api/analyze", async (req, res) => {
  try {
    const { decision, options, context } = req.body;
    if (!decision) {
      return res.status(400).json({ error: "Decision prompt is required" });
    }

    const ai = getGeminiClient();
    
    let prompt = `Analise esta decisão: "${decision}"`;
    if (options && options.length > 0) {
      prompt += `\nCompare especificamente estas opções: ${options.map((o: string) => `"${o}"`).join(", ")}`;
    } else {
      prompt += `\nPrimeiro, identifique as 2 ou 3 opções mais lógicas e comuns a serem consideradas para esta decisão.`;
    }
    if (context) {
      prompt += `\nContexto adicional / Preferências: "${context}"`;
    }

    prompt += `\n\nForneça uma análise abrangente, objetiva e detalhada. Ela deve incluir obrigatoriamente (em Português do Brasil):
1. Prós e contras claros para cada opção com notas de importância (1 a 5).
2. Uma matriz de comparação avaliando as opções em relação a critérios relevantes (ex: custo, esforço, impacto, etc.).
3. Uma análise SWOT para cada opção.
4. Um veredito de desempate final claro e sintetizado, pontuação (índice de confiança de 0 a 100 favorecendo a opção recomendada), fatores determinantes e perguntas de reflexão.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "A concise, clear title of the decision being made." },
        description: { type: Type.STRING, description: "A brief summary of the decision context." },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of the key options considered (usually 2 or 3)."
        },
        prosCons: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              option: { type: Type.STRING, description: "The name of the option." },
              pros: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "The pro point." },
                    importance: { type: Type.INTEGER, description: "Weight of importance from 1 (low) to 5 (high)." },
                    explanation: { type: Type.STRING, description: "Brief explanation of why this is a pro." }
                  },
                  required: ["text", "importance", "explanation"]
                }
              },
              cons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "The con point." },
                    importance: { type: Type.INTEGER, description: "Weight of importance from 1 (low) to 5 (high)." },
                    explanation: { type: Type.STRING, description: "Brief explanation of why this is a con." }
                  },
                  required: ["text", "importance", "explanation"]
                }
              }
            },
            required: ["option", "pros", "cons"]
          }
        },
        comparisonMatrix: {
          type: Type.OBJECT,
          properties: {
            criteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of criteria used to compare the options."
            },
            rows: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  criterion: { type: Type.STRING, description: "The criterion name." },
                  optionsData: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        option: { type: Type.STRING, description: "The name of the option." },
                        score: { type: Type.INTEGER, description: "Rating from 1 (poor) to 5 (excellent) on this criterion." },
                        explanation: { type: Type.STRING, description: "Justification for this rating." }
                      },
                      required: ["option", "score", "explanation"]
                    }
                  }
                },
                required: ["criterion", "optionsData"]
              }
            }
          },
          required: ["criteria", "rows"]
        },
        swot: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              option: { type: Type.STRING, description: "The name of the option." },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
              threats: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["option", "strengths", "weaknesses", "opportunities", "threats"]
          }
        },
        verdict: {
          type: Type.OBJECT,
          properties: {
            recommendation: { type: Type.STRING, description: "The best choice or recommended course of action." },
            tiebreakerScore: { type: Type.INTEGER, description: "Confidence rating/score from 0 to 100 for the recommended option." },
            summary: { type: Type.STRING, description: "A detailed but punchy explanation of the final tiebreaker verdict." },
            keyFactors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Top 2-3 deciding factors that tipped the scale." },
            reflectionQuestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 deep reflection questions for the user." }
          },
          required: ["recommendation", "tiebreakerScore", "summary", "keyFactors", "reflectionQuestions"]
        }
      },
      required: ["title", "description", "options", "prosCons", "comparisonMatrix", "swot", "verdict"]
    };

    const modelsToTry = [
      "gemini-flash-latest",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite"
    ];

    let response: any = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[Gemini API] Requesting ${modelName} (attempt ${attempt}/2)...`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: "Você é 'O Desempate' (The Tiebreaker), um consultor de tomada de decisões altamente sofisticado. Seu objetivo é ajudar os usuários a superarem a paralisia de análise. Forneça revisões afiadas, de altíssima qualidade, objetivas e analíticas das escolhas em PORTUGUÊS (BRASIL). Todos os campos textuais, prós/contras, pontos SWOT, títulos, descrições, critérios e resumos no JSON de resposta DEVEM estar em português do Brasil. IMPORTANTE: Mantenha todas as explicações textuais, prós/contras, pontos SWOT e resumos extremamente diretos, concisos e enxutos (no máximo 1 ou 2 frases por campo textual) para garantir um processamento rápido e evitar timeouts de servidor. Sua resposta deve ser estritamente no formato JSON solicitado.",
              responseMimeType: "application/json",
              responseSchema: responseSchema,
            }
          });
          break; // success, break out of attempts
        } catch (error: any) {
          lastError = error;
          console.error(`[Gemini API Error] model ${modelName} (attempt ${attempt}):`, error);

          const errorMessage = (error?.message || "").toUpperCase();
          const isTransient = errorMessage.includes("503") || 
                              errorMessage.includes("504") ||
                              errorMessage.includes("502") ||
                              errorMessage.includes("500") ||
                              errorMessage.includes("UNAVAILABLE") || 
                              errorMessage.includes("429") || 
                              errorMessage.includes("RESOURCE_EXHAUSTED") ||
                              errorMessage.includes("HIGH DEMAND") ||
                              errorMessage.includes("TEMPORARY") ||
                              errorMessage.includes("DEADLINE") ||
                              errorMessage.includes("TIMEOUT");

          if (isTransient) {
            if (attempt < 2) {
              const delay = attempt * 1500;
              console.log(`[Gemini API] Transient error. Waiting ${delay}ms before retry...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            console.log(`[Gemini API] Failed 2 attempts on ${modelName}. Trying fallback model...`);
          } else {
            console.log(`[Gemini API] Non-transient error on ${modelName}. Trying fallback model...`);
            break; // Skip to next model
          }
        }
      }
      if (response) {
        break; // found a successful response
      }
    }

    if (!response) {
      throw lastError || new Error("All fallback models failed to generate a response");
    }

    const text = response.text;
    if (!text) {
      throw new Error("No response generated from Gemini API");
    }

    const rawData = JSON.parse(text);

    // Map rows from optionsData array to records for client suitability
    const mappedRows = rawData.comparisonMatrix.rows.map((row: any) => {
      const ratings: Record<string, number> = {};
      const explanations: Record<string, string> = {};
      row.optionsData.forEach((item: any) => {
        ratings[item.option] = item.score;
        explanations[item.option] = item.explanation;
      });
      return {
        criterion: row.criterion,
        ratings,
        explanations
      };
    });

    const analysis = {
      id: Math.random().toString(36).substring(2, 11),
      title: rawData.title,
      description: rawData.description,
      options: rawData.options,
      prosCons: rawData.prosCons,
      comparisonMatrix: {
        criteria: rawData.comparisonMatrix.criteria,
        rows: mappedRows
      },
      swot: rawData.swot,
      verdict: rawData.verdict,
      createdAt: new Date().toISOString()
    };

    res.json(analysis);
  } catch (error: any) {
    console.error("Analysis failed:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred during analysis" });
  }
});

// Setup Vite Dev Server / Static Serve
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
