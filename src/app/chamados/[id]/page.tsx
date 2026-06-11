import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ChamadoDetalhesClient from "./ChamadoDetalhesClient";

export default async function ChamadoDetalhesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: chamado, error } = await supabase
    .from('chamados')
    .select('*, clientes(id, nome, empresa, email, telefone)')
    .eq('id', id)
    .single();

  if (error || !chamado) {
    notFound();
  }

  const { data: respostas } = await supabase
    .from('respostas')
    .select('*, usuarios(nome, role)')
    .eq('chamado_id', id)
    .order('created_at', { ascending: true });

  return (
    <ChamadoDetalhesClient
      chamado={chamado}
      respostas={respostas ?? []}
    />
  );
}
