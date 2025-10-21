type Props = {
  name: string;
  price: string;
  tokens: string;
  note?: string;
  disabled?: boolean;
  onClick?: () => void;
  loading?: boolean;
};

export default function TierCard({ name, price, tokens, note, disabled, onClick, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-700 bg-stone-800 p-6">
        <div className="flex items-baseline justify-between mb-3">
          <div className="skel h-6 w-24"></div>
          <div className="skel h-8 w-20"></div>
        </div>
        <div className="skel h-4 w-32 mb-1"></div>
        <div className="skel h-3 w-40 mb-4"></div>
        <div className="skel h-10 w-full mt-4"></div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-700 bg-stone-800 p-6 hover:bg-stone-800/80 transition">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">{name}</h3>
        <div className="text-2xl font-bold text-white">
          {price}
          <span className="text-xs text-stone-400 font-normal"> /mo</span>
        </div>
      </div>
      <p className="text-sm text-stone-300 mb-1">{tokens}</p>
      {note && <p className="text-xs text-stone-400 mb-4">{note}</p>}
      <button
        disabled={disabled}
        onClick={onClick}
        className={`mt-4 w-full rounded-xl px-4 py-2.5 font-medium transition ${
          disabled
            ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
            : 'bg-stone-100 text-stone-900 hover:bg-white'
        }`}
      >
        {disabled ? 'Coming soon' : 'Get started'}
      </button>
    </div>
  );
}
