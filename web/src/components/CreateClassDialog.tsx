// web/src/components/CreateClassDialog.tsx
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function CreateClassDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void; }) {
  const [name, setName] = useState(""); 
  const [desc, setDesc] = useState(""); 
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setBusy(false); return; }
    const user_id = session.user.id;

    // live-count guard: max 1 class on free
    const { count } = await supabase.from("classes").select("id", { count: "exact", head: true }).eq("user_id", user_id);
    if ((count ?? 0) >= 1) { setBusy(false); onClose(); return; }

    // optimistic pathway: we trust RLS to set user_id on insert policies
    const { error } = await supabase.from("classes").insert({ name, description: desc });
    setBusy(false);
    if (!error) { onCreated(); onClose(); setName(""); setDesc(""); }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <h3 className="mb-2 text-lg font-semibold text-stone-100">Create Class</h3>
      <div className="space-y-3">
        <input className="w-full rounded-xl bg-stone-800 px-3 py-2 text-stone-100 outline-none ring-1 ring-stone-700" placeholder="Class name" value={name} onChange={e=>setName(e.target.value)} />
        <textarea className="w-full rounded-xl bg-stone-800 px-3 py-2 text-stone-100 outline-none ring-1 ring-stone-700" placeholder="Description (optional)" value={desc} onChange={e=>setDesc(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} className="bg-stone-700 hover:bg-stone-600">Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || busy}>Create</Button>
        </div>
      </div>
    </Dialog>
  );
}
