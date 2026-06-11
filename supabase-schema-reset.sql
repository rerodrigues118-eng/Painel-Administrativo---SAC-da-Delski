-- SQL Completo: Reset e Reconfiguração do Banco de Dados SAC Delski

-- 1. DELETA AS TABELAS ANTIGAS PARA RECOMEÇAR LIMPO (Cuidado: Isso apaga os dados antigos!)
DROP TABLE IF EXISTS historico CASCADE;
DROP TABLE IF EXISTS respostas CASCADE;
DROP TABLE IF EXISTS chamados CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;

-- 2. CRIA A TABELA DE CLIENTES
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  empresa TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CRIA A FUNÇÃO DE UPSERT DE CLIENTE (ESSENCIAL PARA O N8N NÃO DAR ERRO)
CREATE OR REPLACE FUNCTION upsert_cliente_func(p_nome text, p_empresa text, p_email text, p_telefone text)
RETURNS json AS $$
DECLARE
  v_cliente record;
BEGIN
  INSERT INTO clientes (nome, empresa, email, telefone)
  VALUES (p_nome, p_empresa, p_email, p_telefone)
  ON CONFLICT (email) DO UPDATE
  SET nome = EXCLUDED.nome, empresa = EXCLUDED.empresa, telefone = EXCLUDED.telefone
  RETURNING id, nome, empresa, email, telefone INTO v_cliente;
  
  RETURN row_to_json(v_cliente);
END;
$$ LANGUAGE plpgsql;

-- 4. CRIA A TABELA DE CATEGORIAS
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT UNIQUE NOT NULL,
  descricao TEXT
);

-- 5. CRIA A TABELA DE USUÁRIOS (ADMINISTRADORES)
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Supervisor', 'Atendente')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CRIA A TABELA DE CHAMADOS COM TODOS OS CAMPOS (INCLUINDO ASSUNTO E ANEXOS)
CREATE TABLE chamados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocolo TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  categoria TEXT,
  prioridade TEXT DEFAULT 'Média' CHECK (prioridade IN ('Baixa', 'Média', 'Alta', 'Urgente')),
  status TEXT DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Em Análise', 'Em Andamento', 'Deferido', 'Indeferido', 'Resolvido', 'Fechado')),
  assunto TEXT,
  mensagem_original TEXT NOT NULL,
  anexos_urls JSONB DEFAULT '[]'::jsonb,
  ia_summary TEXT,
  ia_urgencia TEXT,
  ia_sentimento TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CRIA A TABELA DE RESPOSTAS (CHAT)
CREATE TABLE respostas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chamado_id UUID REFERENCES chamados(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES usuarios(id), -- Fica nulo se o cliente responder
  mensagem TEXT NOT NULL,
  anexos_urls JSONB DEFAULT '[]'::jsonb,
  tipo TEXT CHECK (tipo IN ('Pública', 'Interna')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. CRIA A TABELA DE HISTÓRICO (LOGS E AUDITORIA)
CREATE TABLE historico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chamado_id UUID REFERENCES chamados(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id),
  acao TEXT NOT NULL,
  detalhes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. CONFIGURA BUCKET DE ANEXOS E SEGURANÇA (RLS)
INSERT INTO storage.buckets (id, name, public) VALUES ('anexos', 'anexos', true) ON CONFLICT DO NOTHING;

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON chamados FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON clientes FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON respostas FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON historico FOR ALL USING (true);

-- Política para permitir que a tela de "Consultar Protocolo" leia o chamado sem estar logado
CREATE POLICY "Permitir leitura anonima" ON chamados FOR SELECT USING (true);
CREATE POLICY "Permitir leitura anonima respostas" ON respostas FOR SELECT USING (true);
