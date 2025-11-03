export function Pagination({ page, total, onPrev, onNext }:{
  page:number; total:number; onPrev:()=>void; onNext:()=>void;
}){
  return (
    <div className="flex items-center justify-between mt-6">
      <div className="text-sm text-muted">Page {page} / {total}</div>
      <div className="flex items-center gap-2">
        <button className="btn" disabled={page<=1} onClick={onPrev}>Prev</button>
        <button className="btn" disabled={page>=total} onClick={onNext}>Next</button>
      </div>
    </div>
  );
}
