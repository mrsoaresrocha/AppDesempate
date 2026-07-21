# O Desempate (The Tiebreaker) ⚖️

**O Desempate** é um consultor analítico inteligente e interativo projetado para ajudar você a superar a paralisia de análise e tomar decisões complexas com clareza, racionalidade e profundidade. Utilizando modelos de inteligência artificial da série **Gemini**, o aplicativo decompõe qualquer dilema em uma análise estruturada multidimensional.

---

## 🚀 Principais Recursos

- **🧠 Decomposição Inteligente por IA**: Basta descrever o seu dilema (e opcionalmente as alternativas e preferências) para que o agente de IA formule as opções mais lógicas e crie o cenário analítico inicial.
- **📊 Placar Interativo ao Vivo (Interactive Scoreboard)**: Um motor de cálculo em tempo real que recalcula os índices de atratividade de cada opção à medida que você ajusta os pesos de importância.
- **1️⃣ Lista Ponderada de Prós & Contras**: Avalie cada fator positivo e negativo com notas de importância de 1 (baixo) a 5 (alto) e veja o placar reagir instantaneamente.
- **2️⃣ Matriz de Critérios de Avaliação**: Compare as opções lado a lado em critérios como *Custo*, *Esforço*, *Impacto* e *Alinhamento*, com notas dinâmicas e justificativas detalhadas geradas pela IA.
- **3️⃣ Análise SWOT (F.O.F.A.)**: Visualize as Forças (Strengths), Fraquezas (Weaknesses), Oportunidades (Opportunities) e Ameaças (Threats) de forma estratégica para cada alternativa.
- **💭 Oficina de Reflexão Pessoal**: Perguntas personalizadas e profundas geradas pela IA para ajudar você a alinhar os dados objetivos com sua intuição antes de confirmar e bloquear (*lock-in*) a escolha final.
- **📄 Exportação e Compartilhamento**: Exporte a análise completa em formato **PDF** otimizado para impressão ou copie o link para compartilhar.

---

## 🛠️ Tecnologias Utilizadas

O projeto foi construído utilizando uma arquitetura full-stack moderna e segura:

- **Frontend**:
  - [React](https://react.dev/) (com TypeScript)
  - [Tailwind CSS](https://tailwindcss.com/) para design responsivo e moderno baseado na estética de alta legibilidade (Slate/Off-white)
  - [Lucide React](https://lucide.dev/) para conjunto de ícones vetoriais limpos e consistentes
  - [Framer Motion](https://www.framer.com/motion/) para transições de estado fluidas e animações de carregamento elegantes

- **Backend**:
  - [Express.js](https://expressjs.com/) servindo como proxy seguro e otimizado
  - [@google/genai](https://github.com/google/generative-ai-js) para integração estruturada com o modelo **Gemini 2.5/3.5**
  - Validação rigorosa de esquemas JSON para garantir respostas da IA rápidas e à prova de falhas

---

## 📦 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v18 ou superior)
- Uma chave de API do Gemini ([Google AI Studio](https://aistudio.google.com/))

### Passos para Instalação

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/seu-usuario/o-desempate.git
   cd o-desempate
   ```

2. **Instalar Dependências**:
   ```bash
   npm install
   ```

3. **Configurar as Variáveis de Ambiente**:
   Crie um arquivo `.env` na raiz do projeto com a sua chave da API do Gemini:
   ```env
   GEMINI_API_KEY=sua_chave_de_api_aqui
   ```

4. **Iniciar o Servidor de Desenvolvimento**:
   ```bash
   npm run dev
   ```
   Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

5. **Construir para Produção**:
   ```bash
   npm run build
   ```

---

## ⚖️ Metodologia e Design

O design do aplicativo segue uma filosofia minimalista e focada no conteúdo, utilizando espaçamento generoso, tipografia refinada e interações de alta fidelidade para que o processo de escolha seja leve e extremamente intuitivo.
