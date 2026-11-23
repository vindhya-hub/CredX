import { useEffect, useRef, useState } from "react";
import API, { errorMessage } from "../services/api";

const FALLBACK_SUGGESTIONS = [
  "How much did I spend on food last month?",
  "Show my recent card transactions",
  "What's my loan EMI?",
  "What's my credit limit?",
];

const TYPE_LABELS = {
  card_transaction: "Card purchase",
  wallet_transaction: "Wallet",
  card: "Card",
  loan: "Loan",
  wallet: "Wallet",
  account: "Account",
};

const INTENT_LABELS = {
  spending_summary: "Spending summary",
  card_transactions: "Card transactions",
  wallet_activity: "Wallet activity",
  wallet_balance: "Wallet balance",
  card_info: "Cards & credit",
  loan_info: "Loans",
  fraud_alerts: "Fraud alerts",
  credit_score: "Credit score",
  general: "Search",
  help: "Help",
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

const formatScore = (n) => (typeof n === "number" ? n.toFixed(2) : "–");

function Citation({ citation }) {
  return (
    <li className="rounded-xl border border-gray-800 bg-black/40 p-3 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#bfa34a]/15 px-2 py-0.5 text-[11px] uppercase tracking-wider text-[#f0e2a0]">
            {TYPE_LABELS[citation.type] || citation.type}
          </span>
          <span className="font-medium text-gray-100">{citation.title}</span>
        </div>
        <span className="text-xs text-gray-500">{formatDate(citation.date)}</span>
      </div>
      <p className="mt-1 text-sm text-gray-400">{citation.snippet}</p>
      <p className="mt-2 text-[11px] text-gray-500" title="BM25 keyword score, cosine similarity and the fused ranking score">
        keyword {formatScore(citation.scores?.keyword)} · semantic {formatScore(citation.scores?.vector)} · fused {formatScore(citation.scores?.fused)}
      </p>
    </li>
  );
}

function AssistantMessage({ message }) {
  const { data } = message;
  const filters = data.filters || {};
  const chips = [
    filters.timeRange?.label,
    ...(filters.categories || []),
    ...(filters.merchants || []),
    filters.card?.last4 ? `card ••••${filters.card.last4}` : filters.card?.brand || filters.card?.type,
  ].filter(Boolean);
  const retrieval = data.retrieval;

  return (
    <div className="max-w-3xl rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-black p-5 shadow-xl">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-[#bfa34a]">{INTENT_LABELS[data.intent] || data.intent}</span>
        {chips.map((chip) => (
          <span key={chip} className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-400">{chip}</span>
        ))}
      </div>

      <p className="leading-relaxed text-gray-100">{data.answer}</p>

      {data.citations?.length > 0 && (
        <details className="mt-4" open>
          <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-200">
            Based on {data.citations.length} record{data.citations.length === 1 ? "" : "s"} from your account
          </summary>
          <ul className="mt-3 space-y-2">
            {data.citations.map((citation) => <Citation key={citation.id} citation={citation} />)}
          </ul>
        </details>
      )}

      {retrieval && (
        <p className="mt-3 text-[11px] text-gray-600">
          Searched {retrieval.candidates} of {retrieval.documents} records ·{" "}
          {retrieval.embedder ? (retrieval.embedder.kind === "hashing" ? "keyword + hashing fallback embeddings" : `keyword + ${retrieval.embedder.id}`) : "no matching records"}{" "}
          · {retrieval.fusion.method} fusion ({retrieval.fusion.keywordWeight}/{retrieval.fusion.vectorWeight}) · {retrieval.tookMs} ms
        </p>
      )}
    </div>
  );
}

export default function Assistant() {
  const [suggestions, setSuggestions] = useState(FALLBACK_SUGGESTIONS);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let active = true;
    API.get("/assistant/suggestions")
      .then((res) => {
        if (active && res.data.suggestions?.length) setSuggestions(res.data.suggestions);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const ask = async (question) => {
    const query = question.trim();
    if (!query || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: query }]);
    setLoading(true);
    try {
      const res = await API.post("/assistant/query", {
        query,
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
      });
      setMessages((prev) => [...prev, { role: "assistant", data: res.data }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: errorMessage(err, "The assistant is unavailable right now.") }]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black px-6 py-10 text-white md:px-12">
      <div className="mx-auto flex max-w-4xl flex-col">
        <h1 className="mb-2 bg-gradient-to-r from-[#d4af37] via-[#f5e6b2] to-[#bfa34a] bg-clip-text text-4xl font-semibold text-transparent">
          CredX Assistant
        </h1>
        <p className="mb-8 text-gray-400">
          Ask about your spending, card transactions, cards, loans and wallet. Answers are computed only from your own account data, with the records they are based on.
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={loading}
              className="rounded-full border border-gray-700 bg-black/40 px-3 py-1.5 text-sm text-gray-300 transition hover:border-[#bfa34a] hover:text-white disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-col gap-4" aria-live="polite">
          {messages.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-800 p-6 text-center text-gray-500">
              Pick a suggestion or type a question below.
            </p>
          )}
          {messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={i} className="self-end max-w-xl rounded-2xl bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] px-4 py-2 text-black">
                  {m.text}
                </div>
              );
            }
            if (m.role === "error") {
              return (
                <div key={i} className="max-w-xl rounded-2xl border border-red-900 bg-red-950/40 px-4 py-2 text-red-300">
                  {m.text}
                </div>
              );
            }
            return <AssistantMessage key={i} message={m} />;
          })}
          {loading && <div className="text-sm text-gray-500">Searching your records…</div>}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="sticky bottom-4 flex gap-3 rounded-2xl border border-gray-800 bg-black/80 p-3 backdrop-blur">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder="e.g. How much did I spend at Amazon this month?"
            aria-label="Ask the assistant"
            className="flex-1 rounded-xl border border-gray-700 bg-black p-3 text-white focus:border-[#d4af37] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] px-6 py-3 font-medium text-black transition hover:scale-[1.02] disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
