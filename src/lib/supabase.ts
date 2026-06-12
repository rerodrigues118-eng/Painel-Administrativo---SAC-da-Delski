import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://pcejljmykywpkrztiwpb.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZWpsam15a3l3cGtyenRpd3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDI2ODQ2MywiZXhwIjoyMDk1ODQ0NDYzfQ.ROUBEHT1cA1GsMG5PTW8k_Qp2JI5PVkc7eEFNy0lDj8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types para as tabelas do Supabase
export type Chamado = {
  id: string;
  protocolo: string;
  cliente_id: string;
  categoria: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  status: 'Aberto' | 'Em Análise' | 'Em Andamento' | 'Resolvido' | 'Fechado';
  mensagem_original: string;
  ia_summary?: string;
  ia_urgencia?: string;
  ia_sentimento?: string;
  created_at: string;
  updated_at: string;
};

export type Cliente = {
  id: string;
  nome: string;
  empresa: string;
  email: string;
  telefone?: string;
  created_at: string;
};

export type Historico = {
  id: string;
  chamado_id: string;
  usuario_id?: string;
  acao: string;
  detalhes: string;
  created_at: string;
};
