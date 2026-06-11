'use client';

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, Eye, List, LayoutGrid, Columns, Clock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import ChamadoDetalhesClient from "./[id]/ChamadoDetalhesClient";
import { supabase } from "@/lib/supabase";

type Chamado = {
  id: string;
  protocolo: string;
  assunto: string;
  status: string;
  prioridade: string;
  categoria: string;
  created_at: string;
  mensagem_original: string;
  anexos_urls: string[];
  ia_summary: string;
  ia_sentimento: string;
  clientes: { id: string; nome: string; empresa: string; email: string; telefone: string } | null;
};

const STATUS_COLUMNS = ['Aberto', 'Em Análise', 'Em Andamento', 'Resolvido', 'Fechado'];

export default function ChamadosListClient({ chamados }: { chamados: Chamado[] }) {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'cards'>('list');
  const [localChamados, setLocalChamados] = useState<Chamado[]>(chamados);
  const [selectedChamadoId, setSelectedChamadoId] = useState<string | null>(chamados.length > 0 ? chamados[0].id : null);
  const [searchQuery, setSearchQuery] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: '', email: '', telefone: '', empresa: '',
    categoria: 'Dúvidas', prioridade: 'Média', assunto: '', descricao: ''
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("https://n8n.srv1695139.hstgr.cloud/webhook/delski-sac-recebimentooo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error("Erro ao criar chamado");
      alert("Chamado criado com sucesso!");
      setIsCreateModalOpen(false);
      setFormData({
        nome: '', email: '', telefone: '', empresa: '',
        categoria: 'Dúvidas', prioridade: 'Média', assunto: '', descricao: ''
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar chamado. Verifique o console ou a conexão com o n8n.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredChamados = localChamados.filter(c => 
    c.protocolo?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.assunto?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.clientes?.nome?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const selectedChamado = localChamados.find(c => c.id === selectedChamadoId);

  const N8N_WEBHOOK_STATUS = process.env.NEXT_PUBLIC_N8N_WEBHOOK_STATUS || 'https://n8n.srv1695139.hstgr.cloud/webhook-test/status-chamado';

  // === Drag and Drop Handlers ===
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('chamadoId', id);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('chamadoId');
    if (!id) return;

    // Achar o chamado para verificar se o status realmente mudou
    const chamado = localChamados.find(c => c.id === id);
    if (!chamado || chamado.status === newStatus) return;

    // Atualizar UI Otimisticamente
    setLocalChamados(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));

    try {
      const { error } = await supabase
        .from('chamados')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // 🔔 Disparar webhook n8n → Gmail notificação de mudança de status via Kanban
      if (chamado.clientes?.email) {
        try {
          await fetch(N8N_WEBHOOK_STATUS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              protocolo:       chamado.protocolo,
              assunto:         chamado.assunto,
              status_anterior: chamado.status,
              status_novo:     newStatus,
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

    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao alterar status do chamado.");
      // Reverter alteração em caso de erro
      setLocalChamados(chamados);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
  };

  return (
    <div className="gap-1 animate-in fade-in zoom-in-95 duration-500 h-full flex flex-col min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground leading-tight">Chamados</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie e responda as solicitações dos clientes.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setIsCreateModalOpen(true)}>
          Novo Chamado (Manual)
        </Button>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="sm:max-w-[600px] bg-background border-white/10 text-foreground max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Criar Novo Chamado (Manual)</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome *</label>
                  <Input required placeholder="Ex: João Silva" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="bg-background border-white/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-mail *</label>
                  <Input type="email" required placeholder="Ex: joao@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-background border-white/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone</label>
                  <Input placeholder="Ex: 11999999999" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} className="bg-background border-white/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Empresa</label>
                  <Input placeholder="Ex: Delski" value={formData.empresa} onChange={e => setFormData({...formData, empresa: e.target.value})} className="bg-background border-white/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria *</label>
                  <select required value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="flex h-10 w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground">
                    <option value="Dúvidas">Dúvidas</option>
                    <option value="Suporte Técnico">Suporte Técnico</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Elogio/Reclamação">Elogio/Reclamação</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prioridade *</label>
                  <select required value={formData.prioridade} onChange={e => setFormData({...formData, prioridade: e.target.value})} className="flex h-10 w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground">
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assunto *</label>
                <Input required placeholder="Ex: Problema com pagamento" value={formData.assunto} onChange={e => setFormData({...formData, assunto: e.target.value})} className="bg-background border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição *</label>
                <Textarea required placeholder="Detalhes do chamado..." rows={4} value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} className="bg-background border-white/10 resize-none" />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                Criar Chamado
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Topo Persistente e Sem Quebrar Layout Horizontal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-background/50 py-3 px-4 rounded-xl border border-white/5 shrink-0 overflow-x-auto w-full">
        <div className="flex items-center gap-4 w-full sm:max-w-md shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Pesquisar protocolo, assunto, cliente..." 
              className="pl-9 bg-background border-white/10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="border-white/10 text-foreground bg-background">
            <Filter className="mr-2" size={16} /> Filtros
          </Button>
        </div>

        <div className="flex items-center bg-background border border-white/10 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
          >
            <List size={16} /> Lista
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'kanban' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
          >
            <Columns size={16} /> Kanban
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'cards' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
          >
            <LayoutGrid size={16} /> Cards
          </button>
        </div>
      </div>

      {/* Container flex-1 com position relative para conter o Kanban absoluto */}
      <div className="flex-1 mt-2 min-h-0 min-w-0 relative">
        {/* === VIEW: LISTA === */}
        {viewMode === 'list' && (
          <Card className="glass border-white/5 animate-in fade-in duration-300">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-muted-foreground w-32 py-3 px-4">Protocolo</TableHead>
                    <TableHead className="text-muted-foreground">Cliente</TableHead>
                    <TableHead className="text-muted-foreground">Assunto</TableHead>
                    <TableHead className="text-muted-foreground">Prioridade</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Abertura</TableHead>
                    <TableHead className="text-muted-foreground text-right px-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChamados.map((chamado) => (
                    <TableRow key={chamado.id} className="border-white/10 hover:bg-white/5 transition-colors">
                      <TableCell className="font-mono text-primary font-medium px-4">
                        {chamado.protocolo}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{chamado.clientes?.nome || 'Desconhecido'}</div>
                        <div className="text-xs text-muted-foreground">{chamado.clientes?.empresa || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground max-w-[200px] truncate">{chamado.assunto || 'Sem Assunto'}</div>
                        <div className="text-xs text-muted-foreground">{chamado.categoria || 'Não Categorizado'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getPrioridadeColor(chamado.prioridade)}>
                          {chamado.prioridade || 'Média'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getStatusColor(chamado.status)}`}>
                          {chamado.status || 'Aberto'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(chamado.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right px-4">
                        <Link href={`/chamados/${chamado.id}`}>
                          <Button variant="ghost" size="sm" className="hover:text-primary hover:bg-primary/10 h-8">
                            Ver Detalhes <Eye size={14} className="ml-2" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredChamados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                        Nenhum chamado encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* === VIEW: KANBAN === */}
        {viewMode === 'kanban' && (
          <div className="absolute inset-0 flex gap-6 overflow-x-auto pb-4 items-start animate-in fade-in duration-300">
            {STATUS_COLUMNS.map(status => {
              const colChamados = filteredChamados.filter(c => 
                (status === 'Aberto' && (!c.status || c.status === 'Aberto')) || 
                (c.status === status)
              );
              
              return (
                <div 
                  key={status} 
                  className="w-80 shrink-0 flex flex-col gap-3 bg-white/[0.02] rounded-xl p-3 border border-white/5 h-full min-h-[500px] transition-colors hover:bg-white/[0.03]"
                  onDrop={(e) => handleDrop(e, status)}
                  onDragOver={handleDragOver}
                >
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="font-medium text-sm text-foreground flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(status).split(' ')[0]}`}></div>
                      {status}
                    </h3>
                    <Badge variant="outline" className="bg-background/50 border-white/10 text-muted-foreground h-5 text-xs">
                      {colChamados.length}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                    {colChamados.map(chamado => (
                      <Link 
                        href={`/chamados/${chamado.id}`} 
                        key={chamado.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, chamado.id)}
                        className="block cursor-grab active:cursor-grabbing"
                      >
                        <Card className="glass border-white/10 hover:border-primary/50 transition-all hover:shadow-[0_0_15px_rgba(var(--primary),0.1)] group pointer-events-none">
                          <CardContent className="p-4 space-y-3 pointer-events-auto">
                            <div className="flex justify-between items-start">
                              <span className="font-mono text-xs text-primary font-medium">{chamado.protocolo}</span>
                              <Badge variant="outline" className={`text-[10px] h-4 px-1 ${getPrioridadeColor(chamado.prioridade)}`}>
                                {chamado.prioridade || 'Média'}
                              </Badge>
                            </div>
                            <div>
                              <p className="font-medium text-sm text-foreground leading-tight mb-1 group-hover:text-primary transition-colors">{chamado.assunto || 'Sem assunto'}</p>
                              <p className="text-xs text-muted-foreground truncate">{chamado.clientes?.nome}</p>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground border-t border-white/5 pt-2 mt-1">
                              <Clock size={10} />
                              {new Date(chamado.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                    {colChamados.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-white/10 rounded-lg">
                        Vazio
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* === VIEW: CARDS (SPLIT SCREEN) === */}
        {viewMode === 'cards' && (
          <div className="flex h-[calc(100vh-220px)] gap-6 animate-in fade-in duration-300">
            
            {/* Esquerda: Lista de Cards */}
            <div className="w-[400px] shrink-0 flex flex-col gap-3 overflow-y-auto pr-2 border-r border-white/5">
              {filteredChamados.map(chamado => (
                <Card 
                  key={chamado.id} 
                  onClick={() => setSelectedChamadoId(chamado.id)}
                  className={`shrink-0 cursor-pointer transition-all border min-h-[140px] ${selectedChamadoId === chamado.id ? 'glass border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)] bg-primary/5' : 'bg-background/40 border-white/5 hover:border-white/20 hover:bg-white/[0.03]'}`}
                >
                  <CardContent className="p-4 flex flex-col gap-3">
                    {/* Linha 1: Protocolo + Status */}
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs text-primary font-bold">{chamado.protocolo}</span>
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${getStatusColor(chamado.status)}`}>
                        {chamado.status || 'Aberto'}
                      </Badge>
                    </div>

                    {/* Meio: Assunto e Categoria */}
                    <div className="flex flex-col gap-1.5 py-1">
                      <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2" title={chamado.assunto}>
                        {chamado.assunto || 'Sem assunto'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/80 italic bg-white/5 inline-flex self-start px-2 py-0.5 rounded-sm">
                        {chamado.categoria || 'Sem categoria'}
                      </p>
                    </div>

                    {/* Linha 4: Rodapé — Cliente + Prioridade */}
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-[9px] text-primary font-bold">
                            {(chamado.clientes?.nome || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate font-medium">{chamado.clientes?.nome || 'Desconhecido'}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${getPrioridadeColor(chamado.prioridade)}`}>
                        {chamado.prioridade || 'Média'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredChamados.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  Nenhum chamado encontrado.
                </div>
              )}
            </div>


            {/* Direita: Preview do Chamado */}
            <div className="flex-1 overflow-y-auto glass border border-white/5 rounded-xl p-6 relative">
              {selectedChamado ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-start border-b border-white/5 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground mb-2">{selectedChamado.assunto || 'Sem assunto'}</h2>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-primary text-sm">{selectedChamado.protocolo}</span>
                        <Badge variant="outline" className={getStatusColor(selectedChamado.status)}>{selectedChamado.status}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock size={12} /> Aberto em {new Date(selectedChamado.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <Link href={`/chamados/${selectedChamado.id}`}>
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                        Abrir Chamado Completo
                      </Button>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <Card className="bg-background/40 border-white/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Informações do Cliente</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Nome</p>
                          <p className="text-sm font-medium">{selectedChamado.clientes?.nome}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">E-mail</p>
                          <p className="text-sm text-primary">{selectedChamado.clientes?.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Empresa</p>
                          <p className="text-sm">{selectedChamado.clientes?.empresa || '-'}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-primary flex items-center gap-2">
                          Análise da IA
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedChamado.ia_sentimento && (
                          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
                            {selectedChamado.ia_sentimento}
                          </Badge>
                        )}
                        <p className="text-sm text-primary/80 line-clamp-3">
                          {selectedChamado.ia_summary || 'Nenhum resumo disponível.'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-background/40 border-white/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Mensagem Original</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-invert max-w-none text-sm text-foreground/80 whitespace-pre-wrap">
                        {selectedChamado.mensagem_original}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <LayoutGrid size={48} className="mb-4 opacity-20" />
                  <p>Selecione um chamado na lista para ver o resumo.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
