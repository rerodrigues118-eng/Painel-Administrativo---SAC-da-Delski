import { supabase } from "@/lib/supabase";
import ChamadosListClient from "./ChamadosListClient";

export const dynamic = 'force-dynamic';

export default async function ChamadosPage() {
  // Buscar os dados da tabela chamados real, incluindo informações do cliente
  const { data: chamadosData, error } = await supabase
    .from('chamados')
    .select('*, clientes(id, nome, empresa, email, telefone)')
    .order('created_at', { ascending: false });

  const chamados = chamadosData || [];

  return <ChamadosListClient chamados={chamados} />;
}
