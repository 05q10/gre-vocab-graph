import AddWordForm from "../components/AddWordForm";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            GRE Vocabulary Graph
          </h1>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto">
            Build a comprehensive semantic network of GRE vocabulary words. 
            Add a word, and our AI pipeline will automatically detect and create relationships 
            with existing words in the graph.
          </p>
        </div>
        
        <AddWordForm />
      </div>
    </div>
  );
}
