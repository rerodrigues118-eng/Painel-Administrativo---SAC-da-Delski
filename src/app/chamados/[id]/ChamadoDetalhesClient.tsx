'use client';

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, MessageSquare, Paperclip, Send, User, Sparkles, CheckCircle, Edit2, X, Save } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = ['Aberto', 'Em Análise', 'Em Andamento', 'Deferido', 'Indeferido', 'Resolvido', 'Fechado'];

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'Aberto': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    'Em Análise': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    'Em Andamento': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    'Deferido': 'bg-green-500/20 text-green-400 border-green-500/50',
    'Indeferido': 'bg-red-500/20 text-red-400 border-red-500/50',
    'Resolvido': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    'Fechado': 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  };
  return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
};

const getPrioridadeColor = (p: string) => {
  const colors: Record<string, string> = {
    'Urgente': 'border-destructive text-destructive bg-destructive/10',
    'Alta': 'border-orange-500 text-orange-400 bg-orange-500/10',
    'Média': 'border-blue-500 text-blue-400 bg-blue-500/10',
    'Baixa': 'border-green-500 text-green-400 bg-green-500/10',
  };
  return colors[p] || 'border-white/10 text-foreground bg-white/5';
};

type Chamado = {
  id: string;
  protocolo: string;
  assunto: string;
  status: string;
  prioridade: string;
  categoria: string;
  mensagem_original: string;
  anexos_urls: string[];
  ia_summary: string;
  ia_sentimento: string;
  created_at: string;
  clientes: { id: string; nome: string; empresa: string; email: string; telefone: string } | null;
};

type Resposta = {
  id: string;
  mensagem: string;
  tipo: string;
  autor_id: string | null;
  created_at: string;
  usuarios?: { nome: string; role: string } | null;
};

export default function ChamadoDetalhesClient({
  chamado: initialChamado,
  respostas: initialRespostas,
}: {
  chamado: Chamado;
  respostas: Resposta[];
}) {
  const router = useRouter();
  const [chamado, setChamado] = useState(initialChamado);
  const [respostas, setRespostas] = useState(initialRespostas);
  const [mensagem, setMensagem] = useState('');
  const [tipoResposta, setTipoResposta] = useState<'Pública' | 'Interna'>('Pública');
  const [novoStatus, setNovoStatus] = useState(chamado.status);
  const [isPending, startTransition] = useTransition();
  const [enviando, setEnviando] = useState(false);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ⚙️ URLs dos Webhooks do n8n
  const N8N_WEBHOOK_RESPOSTA  = process.env.NEXT_PUBLIC_N8N_WEBHOOK_RESPOSTA  || 'https://n8n.srv1695139.hstgr.cloud/webhook/resposta-cliente';
  const N8N_WEBHOOK_STATUS    = process.env.NEXT_PUBLIC_N8N_WEBHOOK_STATUS    || 'https://n8n.srv1695139.hstgr.cloud/webhook-test/status-chamado';

  // States para Edição de Cliente
  const [isEditingCliente, setIsEditingCliente] = useState(false);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [clienteForm, setClienteForm] = useState({
    nome: chamado.clientes?.nome || '',
    email: chamado.clientes?.email || '',
    telefone: chamado.clientes?.telefone || '',
    empresa: chamado.clientes?.empresa || '',
  });

  const mostrarFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleAtualizarStatus = async () => {
    if (novoStatus === chamado.status) return;
    setAtualizandoStatus(true);
    const { error } = await supabase
      .from('chamados')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', chamado.id);

    if (error) {
      mostrarFeedback('error', 'Erro ao atualizar status: ' + error.message);
    } else {
      setChamado(prev => ({ ...prev, status: novoStatus }));
      mostrarFeedback('success', `Status atualizado para "${novoStatus}" com sucesso!`);

      // 🔔 Disparar webhook n8n → Gmail notificação de mudança de status
      if (chamado.clientes?.email) {
        try {
          await fetch(N8N_WEBHOOK_STATUS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              protocolo:       chamado.protocolo,
              assunto:         chamado.assunto,
              status_anterior: chamado.status,
              status_novo:     novoStatus,
              cliente_nome:    chamado.clientes.nome,
              cliente_email:   chamado.clientes.email,
              empresa:         chamado.clientes.empresa || '',
              data:            new Date().toLocaleString('pt-BR'),
            }),
          });
        } catch (webhookErr) {
          console.warn('Webhook de status não disparado:', webhookErr);
        }
      }

      startTransition(() => router.refresh());
    }
    setAtualizandoStatus(false);
  };

  const handleEnviarResposta = async () => {
    if (!mensagem.trim()) return;
    setEnviando(true);

    const { data, error } = await supabase
      .from('respostas')
      .insert({
        chamado_id: chamado.id,
        mensagem: mensagem.trim(),
        tipo: tipoResposta,
        autor_id: null,
      })
      .select()
      .single();

    if (error) {
      mostrarFeedback('error', 'Erro ao enviar resposta: ' + error.message);
    } else {
      setRespostas(prev => [...prev, data]);
      setMensagem('');
      mostrarFeedback('success', tipoResposta === 'Pública' ? 'Resposta enviada ao cliente!' : 'Nota interna salva!');

      // 📧 Disparar webhook n8n → Brevo (apenas para respostas públicas)
      if (tipoResposta === 'Pública' && chamado.clientes?.email) {
        try {
          await fetch(N8N_WEBHOOK_RESPOSTA, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              protocolo:     chamado.protocolo,
              assunto:       chamado.assunto,
              resposta:      mensagem.trim(),
              cliente_nome:  chamado.clientes.nome,
              cliente_email: chamado.clientes.email,
              empresa:       chamado.clientes.empresa || '',
              status_atual:  chamado.status,
              data:          new Date().toLocaleString('pt-BR'),
            }),
          });
        } catch (webhookErr) {
          console.warn('Webhook Brevo não disparado:', webhookErr);
        }
      }
    }
    setEnviando(false);
  };


  const handleSalvarCliente = async () => {
    if (!chamado.clientes?.id) return;
    setSalvandoCliente(true);

    const { error } = await supabase
      .from('clientes')
      .update({
        nome: clienteForm.nome,
        email: clienteForm.email,
        telefone: clienteForm.telefone,
        empresa: clienteForm.empresa,
      })
      .eq('id', chamado.clientes.id);

    if (error) {
      mostrarFeedback('error', 'Erro ao atualizar cliente: ' + error.message);
    } else {
      setChamado(prev => ({
        ...prev,
        clientes: { ...prev.clientes!, ...clienteForm }
      }));
      setIsEditingCliente(false);
      mostrarFeedback('success', 'Dados do cliente atualizados com sucesso!');
      startTransition(() => router.refresh());
    }
    setSalvandoCliente(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-7xl mx-auto pb-10">
      {/* Feedback Toast */}
      {feedback && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 ${
          feedback.type === 'success'
            ? 'bg-green-500/20 border-green-500/40 text-green-300'
            : 'bg-red-500/20 border-red-500/40 text-red-300'
        }`}>
          <CheckCircle size={16} />
          {feedback.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-6">
        <Link href="/chamados">
          <Button variant="outline" size="icon" className="bg-background/50 border-white/10 hover:bg-white/10">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {chamado.assunto || "Sem Assunto"}
            </h1>
            <Badge variant="outline" className={getStatusColor(chamado.status)}>
              {chamado.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-primary">{chamado.protocolo}</span> •
            <span>{chamado.clientes?.nome} ({chamado.clientes?.empresa})</span>
          </p>
        </div>
      </div>

      {/* NOVO LAYOUT: Top Cards (3 colunas iguais) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card 1: Gerenciar Status e Detalhes */}
        <Card className="glass border-white/5 flex flex-col">
          <CardHeader className="pb-3 border-b border-white/5">
            <CardTitle className="text-base">Gestão e Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status Atual</p>
                <Select value={novoStatus} onValueChange={(v) => v && setNovoStatus(v)}>
                  <SelectTrigger className="h-8 bg-background/50 border-white/10 text-foreground w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-white/10">
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s} className="text-foreground hover:bg-white/10 focus:bg-white/10">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Prioridade</p>
                <Badge variant="outline" className={getPrioridadeColor(chamado.prioridade)}>
                  {chamado.prioridade || 'Média'}
                </Badge>
              </div>
            </div>
            
            {novoStatus !== chamado.status && (
              <Button
                size="sm"
                onClick={handleAtualizarStatus}
                disabled={atualizandoStatus}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs">
                {atualizandoStatus ? 'Salvando...' : 'Salvar Novo Status'}
              </Button>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5 mt-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Categoria</p>
                <span className="text-sm text-foreground">{chamado.categoria || 'Não definida'}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Abertura</p>
                <span className="text-sm text-foreground">{new Date(chamado.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Informações do Cliente Editável */}
        <Card className="glass border-white/5 flex flex-col relative overflow-hidden">
          {/* Decorative background shape */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <User size={16} className="text-primary" />
                Cliente
              </CardTitle>
              {!isEditingCliente ? (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-white/10" onClick={() => setIsEditingCliente(true)}>
                  <Edit2 size={12} className="mr-1" /> Editar
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-red-500/20 text-red-400" onClick={() => setIsEditingCliente(false)}>
                  <X size={12} className="mr-1" /> Cancelar
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="pt-4 flex-1">
            {!isEditingCliente ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[80px_1fr] items-center">
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="text-sm text-foreground font-medium truncate">{chamado.clientes?.nome}</p>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center">
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <a href={`mailto:${chamado.clientes?.email}`} className="text-sm text-primary break-all hover:underline truncate">
                    {chamado.clientes?.email}
                  </a>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center">
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="text-sm text-foreground truncate">{chamado.clientes?.telefone || '-'}</p>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center">
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="text-sm text-foreground truncate">{chamado.clientes?.empresa}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <Input className="h-8 text-sm bg-background/50 border-white/10" value={clienteForm.nome} onChange={e => setClienteForm({...clienteForm, nome: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Empresa</label>
                    <Input className="h-8 text-sm bg-background/50 border-white/10" value={clienteForm.empresa} onChange={e => setClienteForm({...clienteForm, empresa: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">E-mail</label>
                  <Input className="h-8 text-sm bg-background/50 border-white/10" type="email" value={clienteForm.email} onChange={e => setClienteForm({...clienteForm, email: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Telefone</label>
                  <Input className="h-8 text-sm bg-background/50 border-white/10" value={clienteForm.telefone} onChange={e => setClienteForm({...clienteForm, telefone: e.target.value})} />
                </div>
                <Button 
                  size="sm" 
                  className="w-full mt-2 bg-primary hover:bg-primary/90 h-8"
                  onClick={handleSalvarCliente}
                  disabled={salvandoCliente}
                >
                  <Save size={14} className="mr-2" />
                  {salvandoCliente ? 'Salvando...' : 'Salvar Dados'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Análise da IA */}
        <Card className="glass border-primary/20 bg-primary/5 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50"></div>
          <CardHeader className="pb-3 border-b border-primary/10">
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <Sparkles size={16} className="text-primary/80" /> Análise Automática
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 flex-1">
            {chamado.ia_sentimento && (
              <div>
                <p className="text-xs text-primary/70 mb-1">Sentimento Detectado</p>
                <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10 shadow-[0_0_10px_rgba(var(--primary),0.1)]">
                  {chamado.ia_sentimento}
                </Badge>
              </div>
            )}
            {chamado.ia_summary ? (
              <div>
                <p className="text-xs text-primary/70 mb-1">Resumo Executivo</p>
                <p className="text-sm text-primary/90 leading-relaxed line-clamp-4" title={chamado.ia_summary}>
                  {chamado.ia_summary}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-primary/40 pb-4">
                <Sparkles size={24} className="mb-2 opacity-50" />
                <p className="text-sm">Nenhuma análise disponível</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* NOVO LAYOUT: Sessão Inferior Larga (Mensagem, Chat, Resposta) */}
      <div className="space-y-6 max-w-5xl mx-auto">
        
        <h2 className="text-lg font-semibold border-b border-white/5 pb-2 pt-4">Tratativa do Chamado</h2>

        {/* Mensagem Original */}
        <Card className="bg-background/40 border-white/5 shadow-none rounded-xl overflow-hidden">
          <div className="p-4 bg-white/[0.02] border-b border-white/5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {chamado.clientes?.nome?.charAt(0) ?? '?'}
            </div>
            <div>
              <p className="text-sm font-medium">{chamado.clientes?.nome}</p>
              <p className="text-xs text-muted-foreground">Mensagem Original • {new Date(chamado.created_at).toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <div className="p-5">
            <div className="prose prose-invert max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed text-sm">
              {chamado.mensagem_original}
            </div>
            
            {/* Anexos */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Paperclip size={12} /> Anexos do Cliente
              </h4>
              
              {chamado.anexos_urls && chamado.anexos_urls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {chamado.anexos_urls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors text-xs text-primary hover:text-primary-foreground">
                      <Paperclip size={12} />
                      Arquivo Anexado {i + 1}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 bg-white/[0.02] rounded-lg border border-white/5 flex items-center gap-2 text-xs text-muted-foreground/50 italic">
                  Nenhum arquivo anexado nesta solicitação.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Timeline de Respostas */}
        {respostas.length > 0 && (
          <div className="pl-6 space-y-4 border-l border-white/10 ml-4 py-2">
            {respostas.map((resp) => {
              const isAdmin = !!resp.autor_id;
              const isInterna = resp.tipo === 'Interna';
              return (
                <div key={resp.id} className="relative">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[31px] top-4 h-3 w-3 rounded-full border-2 border-background ${isAdmin ? 'bg-primary' : 'bg-gray-500'}`}></div>
                  
                  <Card className={`bg-background/40 border-white/5 shadow-none rounded-xl ${isInterna ? 'border-l-4 border-l-yellow-500/50 bg-yellow-500/5' : ''}`}>
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={14} className={isAdmin ? 'text-primary' : 'text-gray-400'} />
                        <span className="font-medium text-sm text-foreground">
                          {isAdmin ? (resp.usuarios?.nome ?? 'Equipe') : chamado.clientes?.nome}
                        </span>
                        {isInterna && (
                          <Badge variant="outline" className="text-[10px] h-5 border-yellow-500/40 text-yellow-400 bg-yellow-500/10 px-1.5">
                            Nota Interna
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(resp.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">{resp.mensagem}</p>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {/* Caixa de Resposta Centralizada */}
        <Card className="glass border-white/10 border-primary/20 shadow-xl overflow-hidden mt-8">
          <div className="bg-white/5 px-4 py-3 flex gap-2 border-b border-white/5">
            <button
              onClick={() => setTipoResposta('Pública')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all duration-300 ${tipoResposta === 'Pública' ? 'bg-primary/20 border-primary/50 text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]' : 'bg-transparent border-transparent text-muted-foreground hover:bg-white/5'}`}>
              💬 Responder ao Cliente
            </button>
            <button
              onClick={() => setTipoResposta('Interna')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all duration-300 ${tipoResposta === 'Interna' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'bg-transparent border-transparent text-muted-foreground hover:bg-white/5'}`}>
              🔒 Adicionar Nota Interna
            </button>
          </div>
          <CardContent className="p-0">
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder={tipoResposta === 'Pública'
                ? "Digite sua resposta. Esta mensagem será enviada ao cliente..."
                : "Escreva uma observação técnica. O cliente não verá esta mensagem..."}
              className="min-h-[140px] border-0 rounded-none bg-transparent resize-y focus-visible:ring-0 px-5 py-4 text-sm"
            />
            <div className="p-4 bg-background/50 border-t border-white/5 flex justify-between items-center">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8 px-3">
                <Paperclip size={14} className="mr-2" /> Anexar arquivo
              </Button>
              <Button
                onClick={handleEnviarResposta}
                disabled={enviando || !mensagem.trim()}
                className={`h-9 px-6 transition-all ${tipoResposta === 'Interna' ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-950' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}>
                {enviando ? (
                  <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> Processando...</span>
                ) : (
                  <span className="flex items-center gap-2"><Send size={14} /> Enviar</span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
