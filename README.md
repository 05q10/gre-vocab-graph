# GRE Vocab Graph 🧠🕸️

Vocab Graph is an intelligent, visual knowledge base for learning vocabulary. Instead of memorizing flat lists of words, Vocab Graph allows you to map out words and their semantic relationships (synonyms, antonyms, related concepts) in an interactive, visually stunning node-based graph.

Designed for GRE/GMAT prep or any language enthusiast, it leverages a Graph Database (Neo4j) and AI (OpenAI) to automatically discover and map relationships between words the moment you add them!

## ✨ Features

- **Interactive Visual Graph**: Pan, zoom, and explore your vocabulary using a fluid node-and-edge graph rendered with React Flow.
- **Focus Mode**: Click on any word to instantly fade out unrelated nodes and highlight its immediate semantic neighborhood.
- **AI-Powered Ingestion**: Add a word, and the AI automatically fetches its definition, part of speech, and maps it to existing words in your graph (Synonyms, Antonyms, Similar To, Related To, Confused With).
- **Natural Language Prompting (NLP)**: Use the built-in AI assistant to query or command the graph in plain English. For example, *"Daunting is a synonym of intimidating"* or *"Show me all words that mean elated"*.
- **Daily Statistics & Streak Tracker**: A dedicated dashboard featuring a GitHub-style heatmap to track your daily word additions and maintain a learning streak.
- **Duplicate Prevention**: Intelligently prevents exact duplicates to keep your graph clean and save on API costs.
- **Mobile Responsive Layout**: Carefully crafted UI that looks beautiful and is fully functional on both desktop and mobile devices.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions) & React
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [Heroicons](https://heroicons.com/)
- **Graph Engine**: [React Flow](https://reactflow.dev/) (`@xyflow/react`) for interactive UI rendering & [Dagre](https://github.com/dagrejs/dagre) for auto-layout.
- **Database**: [Neo4j](https://neo4j.com/) (A native graph database perfect for mapping semantic relationships).
- **AI & Embeddings**: [OpenAI API](https://openai.com/) for NLP intent parsing and entity extraction, and Transformers.js (`@xenova/transformers`) for local/edge vector processing.
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) (Google OAuth integration).

## 🚀 Getting Started

If you'd like to run Vocab Graph locally, follow these steps:

### Prerequisites
1. **Node.js** (v18+ recommended)
2. **Neo4j AuraDB** (or a local Neo4j desktop instance)
3. **OpenAI API Key**
4. **Google Cloud Console Credentials** (For NextAuth Google Login)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/05q10/gre-vocab-graph.git
   cd gre-vocab-graph
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add the following keys:
   ```env
   # Neo4j Database
   NEO4J_URI=neo4j+s://<your-db-id>.databases.neo4j.io
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=<your-db-password>

   # OpenAI
   OPENAI_API_KEY=sk-<your-openai-api-key>

   # NextAuth
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=<your-random-secret-string>

   # Google OAuth
   GOOGLE_ID=<your-google-client-id>
   GOOGLE_SECRET=<your-google-client-secret>
   ```

4. **Initialize the Database Constraints (Optional but recommended):**
   ```bash
   npm run db:init
   ```

5. **Run the Development Server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000) and sign in!

## 📖 How to Use

1. **Add a Word**: Click the Floating Action Button (`+`) on the bottom right. Enter a word. The AI will process it and build connections to your existing graph.
2. **Explore**: Go to the **Graph View**. Click and drag the background to pan. Scroll to zoom.
3. **Focus & Edit**: Click a node to open the side panel. Here you can view definitions, add personal remarks, delete relationships, or remove the word entirely.
4. **Ask AI**: Click the Sparkles (`✨`) button to open the NLP command center. Type natural language commands to add connections or search your graph semantically.
5. **Track Progress**: Visit the **Statistics** page to see your total relationships, core network nodes, and keep your daily learning streak alive!

## 📄 License
MIT License. Feel free to clone, modify, and build upon this for your own educational apps!
