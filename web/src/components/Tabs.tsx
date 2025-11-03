type Props = { value: string; onChange: (v:string)=>void; items: string[] };

export function Tabs({ value, onChange, items }: Props) {
  return (
    <div className="inline-flex bdr radius overflow-hidden">
      {items.map(i=>(
        <button key={i}
          className={`px-3 py-2 text-sm ${i===value ? "surface-2 font-semibold" : "surface"}`}
          onClick={()=>onChange(i)}>
          {i}
        </button>
      ))}
    </div>
  );
}
