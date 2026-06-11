-- SQL Schema for Delski SAC (Run this in the Supabase SQL Editor)

-- 1. Create Clientes Table
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  empresa TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Categorias Table
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT UNIQUE NOT NULL,
  descricao TEXT
);

-- 3. Create Usuarios Table (Admin Panel Users)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Supervisor', 'Atendente')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Chamados Table
CREATE TABLE IF NOT EXISTS chamados (
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

-- 5. Create Respostas Table
CREATE TABLE IF NOT EXISTS respostas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chamado_id UUID REFERENCES chamados(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES usuarios(id), -- Null se a resposta for do cliente
  mensagem TEXT NOT NULL,
  anexos_urls JSONB DEFAULT '[]'::jsonb,
  tipo TEXT CHECK (tipo IN ('Pública', 'Interna')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create Historico Table (Audit log for n8n and manual actions)
CREATE TABLE IF NOT EXISTS historico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chamado_id UUID REFERENCES chamados(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id), -- Null se foi ação do sistema/n8n
  acao TEXT NOT NULL,
  detalhes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage bucket for anexos (if not exists)
INSERT INTO storage.buckets (id, name, public) VALUES ('anexos', 'anexos', true) ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- Basic Policies (To be tightened later based on auth rules)
-- Permitir select para consulta do cliente no site (usando anon key filtrando pelo protocolo)
CREATE POLICY "Permitir leitura anonima via protocolo" ON chamados FOR SELECT USING (true);
CREATE POLICY "Permitir leitura de clientes anonima" ON clientes FOR SELECT USING (true);
CREATE POLICY "Permitir leitura de respostas anonima" ON respostas FOR SELECT USING (true);

-- Permitir inserts via n8n (normalmente usa Service Role que já burla RLS, mas adicionando pra garantir)
CREATE POLICY "Enable all for authenticated users" ON chamados FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON clientes FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON respostas FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON historico FOR ALL USING (true);
