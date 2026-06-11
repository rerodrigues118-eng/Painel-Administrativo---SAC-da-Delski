import { supabase } from "@/lib/supabase";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const { data: initialChamados } = await supabase
    .from('chamados')
    .select('*, clientes(id, nome, empresa, email), respostas(id, autor_id, created_at)')
    .order('created_at', { ascending: false });

  return <DashboardClient initialChamados={(initialChamados as any) || []} />;
}
