import { supabase } from "@/lib/supabase";
import RelatoriosClient from "./RelatoriosClient";

export default async function RelatoriosPage() {
  const { data: chamados } = await supabase
    .from('chamados')
    .select('*, clientes(id, nome, empresa, email, telefone)')
    .order('created_at', { ascending: false });

  return <RelatoriosClient chamados={(chamados as any) || []} />;
}
