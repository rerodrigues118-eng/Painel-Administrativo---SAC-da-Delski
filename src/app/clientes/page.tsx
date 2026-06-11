import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default async function ClientesPage() {
  // Buscar os dados da tabela clientes reais, com contagem de chamados e ultima iteracao
  const { data: clientesData, error } = await supabase
    .from('clientes')
    .select('*, chamados(id, created_at)')
    .order('created_at', { ascending: false });

  const clientes = (clientesData || []).map((c: any) => {
    const chamados = c.chamados || [];
    const lastChamado = chamados.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    
    return {
      ...c,
      total_chamados: chamados.length,
      ultima_interacao: lastChamado ? new Date(lastChamado.created_at).toLocaleDateString('pt-BR') : 'Sem chamados',
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie a base de clientes do SAC.
        </p>
      </div>

      <Card className="glass border-white/5">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Carteira de Clientes</CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input placeholder="Pesquisar cliente ou empresa..." className="pl-9 bg-background/50 border-white/10" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Empresa</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Qtd. Chamados</TableHead>
                <TableHead className="text-muted-foreground">Última Interação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente: any) => (
                <TableRow key={cliente.id} className="border-white/10 hover:bg-white/5 transition-colors">
                  <TableCell className="font-medium text-foreground">{cliente.nome}</TableCell>
                  <TableCell>{cliente.empresa}</TableCell>
                  <TableCell>
                    <div className="text-sm">{cliente.email}</div>
                    <div className="text-xs text-muted-foreground">{cliente.telefone || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-primary font-bold bg-primary/10 px-3 py-1 rounded-full">{cliente.total_chamados}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{cliente.ultima_interacao}</TableCell>
                </TableRow>
              ))}
              {clientes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    A tabela de clientes está vazia. Registre clientes ou receba via SAC.
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
