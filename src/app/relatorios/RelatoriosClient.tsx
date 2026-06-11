'use client';

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, FileText, Download, Filter, Search, RotateCcw, AlertTriangle } from "lucide-react";

// Importações dinâmicas/seguras para exportações
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Cliente = {
  id: string;
  nome: string;
  empresa: string;
  email: string;
  telefone: string;
};

type Chamado = {
  id: string;
  protocolo: string;
  status: string;
  prioridade: string;
  categoria: string;
  assunto: string;
  mensagem_original: string;
  created_at: string;
  updated_at: string;
  clientes?: Cliente | null;
};

export default function RelatoriosClient({ chamados }: { chamados: Chamado[] }) {
  // Filtros
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Obter categorias únicas existentes
  const categoriasUnicas = Array.from(new Set(chamados.map(c => c.categoria || "Outros")));

  // Lógica de filtragem
  const filteredChamados = chamados.filter(c => {
    // Busca textual (protocolo, assunto, cliente, empresa)
    const matchesSearch = 
      c.protocolo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.assunto?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientes?.nome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientes?.empresa?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status
    const matchesStatus = statusFilter === "all" || c.status?.toLowerCase() === statusFilter.toLowerCase();

    // Prioridade
    const matchesPriority = priorityFilter === "all" || c.prioridade?.toLowerCase() === priorityFilter.toLowerCase();

    // Categoria
    const matchesCategory = categoryFilter === "all" || (c.categoria || "Outros").toLowerCase() === categoryFilter.toLowerCase();

    // Período de Data
    let matchesDate = true;
    const ticketDate = new Date(c.created_at);
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (ticketDate < start) matchesDate = false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (ticketDate > end) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesDate;
  });

  // Limpar filtros
  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setSearchQuery("");
  };

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

  // --- EXPORTAR EXCEL ---
  const exportToExcel = () => {
    const dataToExport = filteredChamados.map(c => ({
      Protocolo: c.protocolo,
      Data_Abertura: new Date(c.created_at).toLocaleString('pt-BR'),
      Cliente: c.clientes?.nome || "Desconhecido",
      Empresa: c.clientes?.empresa || "-",
      Email: c.clientes?.email || "-",
      Telefone: c.clientes?.telefone || "-",
      Assunto: c.assunto || "Sem assunto",
      Categoria: c.categoria || "Não categorizado",
      Prioridade: c.prioridade || "Média",
      Status: c.status || "Aberto"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    
    // Auto-ajustar colunas
    const maxLens = Object.keys(dataToExport[0] || {}).map(key => {
      const colKey = key as keyof typeof dataToExport[0];
      return Math.max(
        key.length,
        ...dataToExport.map(row => String(row[colKey] || '').length)
      );
    });
    worksheet['!cols'] = maxLens.map(len => ({ wch: len + 3 }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório SAC");
    XLSX.writeFile(workbook, `Relatorio_SAC_Delski_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // --- EXPORTAR PDF ---
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    
    // Configurações do layout e logotipo vetorial
    const primaryColor = "#3b82f6"; // Azul neon
    
    // Desenhar Cabeçalho Premium
    doc.setFillColor(15, 15, 15); // Fundo escuro
    doc.rect(0, 0, 210, 40, "F");
    
    // Logo "DELSKI SAC" em vetor
    doc.setTextColor(59, 130, 246); // Azul
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("DELSKI", 15, 20);
    
    doc.setTextColor(255, 255, 255); // Branco
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.text("TECNOLOGIA", 15, 28);
    
    // Título do Relatório
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RELATÓRIO CONSOLIDADO DE CHAMADOS", 110, 24);
    
    // Data de emissão
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 110, 30);
    
    // Sumário do filtro
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    
    let filterSummary = "Filtros aplicados: ";
    if (statusFilter !== "all") filterSummary += `Status: ${statusFilter} | `;
    if (priorityFilter !== "all") filterSummary += `Prioridade: ${priorityFilter} | `;
    if (categoryFilter !== "all") filterSummary += `Categoria: ${categoryFilter} | `;
    if (startDate || endDate) filterSummary += `Período: ${startDate || 'Início'} até ${endDate || 'Fim'} | `;
    if (filterSummary === "Filtros aplicados: ") filterSummary += "Nenhum (Todos os registros)";
    
    doc.text(filterSummary, 15, 48, { maxWidth: 180 });
    
    // Métricas rápidas no topo do PDF
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(15, 53, 180, 18, 2, 2, "F");
    
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Total Filtrado:", 20, 64);
    doc.setFont("helvetica", "normal");
    doc.text(`${filteredChamados.length} chamados`, 47, 64);

    doc.setFont("helvetica", "bold");
    doc.text("Abertos:", 90, 64);
    doc.setFont("helvetica", "normal");
    doc.text(`${filteredChamados.filter(c => c.status?.toLowerCase() === 'aberto').length}`, 108, 64);

    doc.setFont("helvetica", "bold");
    doc.text("Concluídos:", 145, 64);
    doc.setFont("helvetica", "normal");
    doc.text(`${filteredChamados.filter(c => ['resolvido', 'fechado', 'deferido'].includes(c.status?.toLowerCase() || '')).length}`, 168, 64);

    // Preparar dados da tabela
    const headers = [["Protocolo", "Cliente", "Assunto", "Categoria", "Prioridade", "Status", "Abertura"]];
    const data = filteredChamados.map(c => [
      c.protocolo,
      c.clientes?.nome || "Desconhecido",
      c.assunto || "Sem assunto",
      c.categoria || "Outros",
      c.prioridade || "Média",
      c.status || "Aberto",
      new Date(c.created_at).toLocaleDateString('pt-BR')
    ]);

    // Renderizar tabela usando jspdf-autotable
    autoTable(doc, {
      startY: 76,
      head: headers,
      body: data,
      theme: "striped",
      headStyles: {
        fillColor: [59, 130, 246], // Azul primário Delski
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold"
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 24 }, // Protocolo
        1: { cellWidth: 32 }, // Cliente
        2: { cellWidth: 42 }, // Assunto
        3: { cellWidth: 26 }, // Categoria
        4: { cellWidth: 20 }, // Prioridade
        5: { cellWidth: 20 }, // Status
        6: { cellWidth: 16 }  // Abertura
      },
      didDrawPage: (data) => {
        // Rodapé com paginação
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const str = `Página ${doc.getNumberOfPages()}`;
        doc.text(str, 195, 287, { align: "right" });
        doc.text("Delski Tecnologia - Painel SAC Oficial", 15, 287);
      }
    });

    doc.save(`Relatorio_SAC_Delski_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Filtre, analise e exporte dados consolidados de atendimentos.
          </p>
        </div>
        
        {/* Ações de Exportação */}
        <div className="flex items-center gap-3">
          <Button 
            onClick={exportToPDF}
            disabled={filteredChamados.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 gap-2 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
          >
            <FileText size={16} />
            Exportar PDF
          </Button>
          <Button 
            onClick={exportToExcel}
            disabled={filteredChamados.length === 0}
            variant="outline"
            className="border-white/10 hover:bg-white/5 text-foreground bg-background/50 h-10 gap-2"
          >
            <Download size={16} className="text-primary" />
            Exportar Excel (XLSX)
          </Button>
        </div>
      </div>

      {/* PAINEL DE FILTROS */}
      <Card className="glass border-white/5">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Filter size={18} className="text-primary" />
            Filtros Avançados
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleResetFilters}
            className="text-muted-foreground hover:text-foreground hover:bg-white/5 h-8 gap-2"
          >
            <RotateCcw size={14} />
            Resetar Filtros
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primeira linha de filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Busca textual */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Busca rápida</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input 
                  placeholder="Protocolo, cliente, empresa..." 
                  className="pl-9 bg-background/50 border-white/10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status do Chamado</label>
              <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                <SelectTrigger className="bg-background/50 border-white/10">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10 text-foreground">
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="Aberto">Aberto</SelectItem>
                  <SelectItem value="Em Análise">Em Análise</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Deferido">Deferido</SelectItem>
                  <SelectItem value="Indeferido">Indeferido</SelectItem>
                  <SelectItem value="Resolvido">Resolvido</SelectItem>
                  <SelectItem value="Fechado">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
              <Select value={priorityFilter} onValueChange={(v) => v && setPriorityFilter(v)}>
                <SelectTrigger className="bg-background/50 border-white/10">
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10 text-foreground">
                  <SelectItem value="all">Todas as Prioridades</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
                <SelectTrigger className="bg-background/50 border-white/10">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10 text-foreground">
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  {categoriasUnicas.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Segunda linha de filtros: Período de datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full md:max-w-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input 
                  type="date"
                  className="pl-9 bg-background/50 border-white/10 text-foreground"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data Final</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input 
                  type="date"
                  className="pl-9 bg-background/50 border-white/10 text-foreground"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABELA DE DADOS FILTRADOS */}
      <Card className="glass border-white/5">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-muted-foreground w-32 py-3 px-4">Protocolo</TableHead>
                <TableHead className="text-muted-foreground">Cliente</TableHead>
                <TableHead className="text-muted-foreground">Assunto</TableHead>
                <TableHead className="text-muted-foreground">Categoria</TableHead>
                <TableHead className="text-muted-foreground">Prioridade</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Abertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChamados.map((chamado) => (
                <TableRow key={chamado.id} className="border-white/10 hover:bg-white/5 transition-colors">
                  <TableCell className="font-mono text-primary font-bold px-4">
                    {chamado.protocolo}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{chamado.clientes?.nome || 'Desconhecido'}</div>
                    <div className="text-xs text-muted-foreground">{chamado.clientes?.empresa || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground max-w-[250px] truncate">{chamado.assunto || 'Sem assunto'}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {chamado.categoria || 'Outros'}
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
                </TableRow>
              ))}
              {filteredChamados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="text-muted-foreground/40" size={32} />
                      <p>Nenhum chamado corresponde aos filtros selecionados.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
