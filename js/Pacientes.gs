/**
 * Pacientes.gs — cadastro do paciente, responsável financeiro, valores, queixa e contatos.
 * O que cada perfil recebe é filtrado aqui, no servidor.
 */

var CAMPOS_COBRANCA = ['diaVencimento', 'formaPagamento', 'modalidade'];
var TIPOS_RESP = ['mae', 'pai', 'paciente', 'outro'];
var FORMAS_PAGAMENTO = ['pix', 'cartao', 'dinheiro', 'boleto', 'outro'];

function veFinanceiro_(u) { return u.perfil === PERFIS.ADMIN || u.perfil === PERFIS.FINANCEIRO; }
function veCadastroCompleto_(u) { return u.perfil !== PERFIS.PROFISSIONAL; }

function cpfValido_(cpf) {
  var c = soDigitos_(cpf);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (var t = 9; t < 11; t++) {
    var s = 0;
    for (var i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
  }
  return true;
}

/** Dados de quem paga e assina o contrato. */
function responsavelFinanceiro_(pac) {
  var contato = pac.contatoJson || {};
  var base, parentesco;
  switch (pac.respFinTipo) {
    case 'mae': base = pac.maeJson || {}; parentesco = 'Mãe'; break;
    case 'pai': base = pac.paiJson || {}; parentesco = 'Pai'; break;
    case 'paciente': base = { nome: pac.nome, cpf: pac.cpf, rg: pac.rg, telefone: contato.telefone }; parentesco = 'Próprio paciente'; break;
    default: base = pac.respFinJson || {}; parentesco = (pac.respFinJson || {}).parentesco || '';
  }
  var extra = pac.respFinJson || {};
  var r = {
    tipo: pac.respFinTipo || 'outro', parentesco: parentesco,
    nome: base.nome || extra.nome || '', cpf: base.cpf || extra.cpf || '', rg: base.rg || extra.rg || '',
    telefone: base.telefone || extra.telefone || contato.telefone || '',
    email: base.email || extra.email || contato.email || '',
    profissao: base.profissao || extra.profissao || '',
    estadoCivil: extra.estadoCivil || base.estadoCivil || '',
    endereco: extra.endereco && extra.endereco.logradouro ? extra.endereco : {
      logradouro: contato.endereco || '', numero: contato.numero || '', bairro: contato.bairro || '',
      cep: contato.cep || '', cidade: contato.cidade || '', estado: contato.estado || ''
    }
  };
  r.chave = soDigitos_(r.cpf).length === 11 ? 'cpf:' + soDigitos_(r.cpf) : (r.nome ? 'nome:' + normalizar_(r.nome) : 'pac:' + pac.id);
  return r;
}

function telefoneWhats_(tel) {
  var d = soDigitos_(tel);
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return d;
}

/**
 * Linha do tempo dos valores do paciente: cada valor salvo vale a partir da sua data e substitui
 * os valores lançados antes dele com data igual ou posterior (quem foi salvo por último manda).
 */
function linhaValores_(pacienteId) {
  var todos = Db.listar('Valores', function (v) { return v.pacienteId === pacienteId; });
  var ordem = todos.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return String(a.v.criadoEm) === String(b.v.criadoEm) ? a.i - b.i : (String(a.v.criadoEm) < String(b.v.criadoEm) ? -1 : 1); });
  var linha = [];
  ordem.forEach(function (o) { linha = linha.filter(function (x) { return x.vigenciaInicio < o.v.vigenciaInicio; }).concat([o.v]); });
  return linha.sort(function (a, b) { return a.vigenciaInicio < b.vigenciaInicio ? -1 : 1; });
}

function valoresVigentes_(pacienteId, dataIso) {
  var linha = linhaValores_(pacienteId);
  var lista = linha.filter(function (v) { return v.vigenciaInicio <= dataIso; }).reverse();
  var r = lista.length ? { valorSessao: Number(lista[0].valorSessao), valorAnamnese: Number(lista[0].valorAnamnese), confirmado: lista[0].confirmado !== false, id: lista[0].id, vigenciaInicio: lista[0].vigenciaInicio }
    : { valorSessao: Number(config_('valorSessao')), valorAnamnese: Number(config_('valorAnamnese')), confirmado: false, id: null, vigenciaInicio: '' };
  // Valor já programado para começar depois (ex.: novo valor a partir do mês que vem).
  var futuro = linha.filter(function (v) { return v.vigenciaInicio > dataIso; })[0];
  r.proximo = futuro ? { valorSessao: Number(futuro.valorSessao), valorAnamnese: Number(futuro.valorAnamnese), vigenciaInicio: futuro.vigenciaInicio } : null;
  return r;
}

function pacientesDaProfissional_(profissionalId) {
  var ids = {};
  Db.listar('Planos', function (p) { return p.profissionalId === profissionalId; }).forEach(function (p) { ids[p.pacienteId] = 1; });
  Db.listar('Atendimentos', function (a) { return a.profissionalId === profissionalId && a.status !== 'excluida'; }).forEach(function (a) { ids[a.pacienteId] = 1; });
  return ids;
}

function podeVerPaciente_(u, pacienteId) {
  if (veCadastroCompleto_(u)) return true;
  return !!u.profissionalId && !!pacientesDaProfissional_(u.profissionalId)[pacienteId];
}

/** Monta o paciente como o perfil pode ver. */
function pacienteParaPerfil_(u, pac) {
  var resp = responsavelFinanceiro_(pac);
  if (!veCadastroCompleto_(u)) {
    return { id: pac.id, nome: pac.nome, nascimento: pac.nascimento, situacao: pac.situacao,
      responsavel: { nome: resp.nome, parentesco: resp.parentesco }, queixaLiberada: queixaLiberada_(pac.id, u.profissionalId) };
  }
  var r = limpo_(pac);
  r.responsavel = resp;
  r.whatsapp = telefoneWhats_(resp.telefone);
  r.planos = Db.listar('Planos', function (p) { return p.pacienteId === pac.id; }).map(limpo_);
  r.temQueixa = !!(Db.obter('Queixas', pac.id) || {}).texto;
  if (veFinanceiro_(u)) {
    r.valores = valoresVigentes_(pac.id, hojeIso_());
    r.historicoValores = Db.listar('Valores', function (v) { return v.pacienteId === pac.id; }).map(limpo_);
  } else {
    CAMPOS_COBRANCA.forEach(function (c) { delete r[c]; });
  }
  return r;
}

function listarPacientes_(u, p) {
  p = p || {};
  var meus = u.perfil === PERFIS.PROFISSIONAL ? pacientesDaProfissional_(u.profissionalId) : null;
  var busca = normalizar_(p.busca || '');
  return Db.listar('Pacientes', function (x) {
    if (meus && !meus[x.id]) return false;
    if (p.situacao && x.situacao !== p.situacao) return false;
    if (busca) {
      var r = responsavelFinanceiro_(x);
      if ((normalizar_(x.nome) + ' ' + normalizar_(r.nome)).indexOf(busca) < 0) return false;
    }
    return true;
  }).map(function (x) {
    var r = responsavelFinanceiro_(x);
    var item = { id: x.id, nome: x.nome, situacao: x.situacao, responsavelNome: r.nome };
    if (veCadastroCompleto_(u)) { item.telefone = r.telefone; item.whatsapp = telefoneWhats_(r.telefone); }
    if (veFinanceiro_(u)) {
      var v = valoresVigentes_(x.id, hojeIso_());
      item.valorSessao = v.valorSessao; item.valoresConfirmados = v.confirmado; item.modalidade = x.modalidade; item.proximoValor = v.proximo;
    }
    return item;
  }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
}

function obterPaciente_(u, p) {
  var pac = Db.obter('Pacientes', p.id);
  exigir_(pac, 'Paciente não encontrado.');
  if (!podeVerPaciente_(u, pac.id)) throw erro_('PERMISSAO', 'Sem acesso a este paciente.');
  return pacienteParaPerfil_(u, pac);
}

function limparPessoa_(o) {
  if (!o) return null;
  var campos = ['nome', 'nascimento', 'rg', 'cpf', 'telefone', 'email', 'profissao', 'estadoCivil', 'parentesco'];
  var r = {};
  campos.forEach(function (c) { if (o[c] !== undefined && o[c] !== null) r[c] = String(o[c]).trim(); });
  if (o.endereco) r.endereco = limparEndereco_(o.endereco);
  return r;
}

function limparEndereco_(e) {
  var r = {};
  ['logradouro', 'numero', 'bairro', 'cep', 'cidade', 'estado', 'complemento'].forEach(function (c) { if (e[c] !== undefined) r[c] = String(e[c]).trim(); });
  return r;
}

function salvarPaciente_(u, p) {
  exigir_(p.nome && String(p.nome).trim().length >= 2, 'Informe o nome do paciente.');
  var tipo = p.respFinTipo || 'outro';
  exigir_(TIPOS_RESP.indexOf(tipo) >= 0, 'Escolha quem é o responsável financeiro.');
  if (tipo === 'mae') exigir_(p.maeJson && p.maeJson.nome, 'Preencha os dados da mãe, que é a responsável financeira.');
  if (tipo === 'pai') exigir_(p.paiJson && p.paiJson.nome, 'Preencha os dados do pai, que é o responsável financeiro.');
  if (tipo === 'outro') exigir_(p.respFinJson && p.respFinJson.nome, 'Preencha os dados do responsável financeiro.');
  [p.cpf, (p.maeJson || {}).cpf, (p.paiJson || {}).cpf, (p.respFinJson || {}).cpf].forEach(function (c) {
    if (c && soDigitos_(c)) exigir_(cpfValido_(c), 'CPF inválido: ' + c);
  });
  var dados = {
    nome: String(p.nome).trim(), nascimento: p.nascimento || '', rg: p.rg || '', cpf: p.cpf || '',
    escola: p.escola || '', serie: p.serie || '', periodo: p.periodo || '', especialidade: p.especialidade || '',
    inicio: p.inicio || '', situacao: p.situacao || 'ativo',
    maeJson: limparPessoa_(p.maeJson), paiJson: limparPessoa_(p.paiJson), outroJson: limparPessoa_(p.outroJson),
    contatoJson: p.contatoJson ? {
      endereco: p.contatoJson.endereco || '', numero: p.contatoJson.numero || '', bairro: p.contatoJson.bairro || '',
      cep: p.contatoJson.cep || '', cidade: p.contatoJson.cidade || '', estado: p.contatoJson.estado || '',
      email: p.contatoJson.email || '', telefone: p.contatoJson.telefone || ''
    } : null,
    respFinTipo: tipo, respFinJson: limparPessoa_(p.respFinJson),
    comoConheceu: p.comoConheceu || '', observacoes: p.observacoes || '', usoImagem: p.usoImagem || '',
    atualizadoEm: agoraIso_()
  };
  if (veFinanceiro_(u)) {
    if (p.diaVencimento !== undefined) {
      var dia = Number(p.diaVencimento);
      exigir_(dia >= 1 && dia <= 31, 'Dia de vencimento inválido.');
      dados.diaVencimento = dia;
    }
    if (p.formaPagamento !== undefined) {
      exigir_(!p.formaPagamento || FORMAS_PAGAMENTO.indexOf(p.formaPagamento) >= 0, 'Forma de pagamento inválida.');
      dados.formaPagamento = p.formaPagamento;
    }
    if (p.modalidade !== undefined) {
      exigir_(['mensal', 'sessao'].indexOf(p.modalidade) >= 0, 'Modalidade inválida.');
      dados.modalidade = p.modalidade;
    }
  }
  if (p.id) {
    var atual = Db.obter('Pacientes', p.id);
    exigir_(atual, 'Paciente não encontrado.');
    var antes = limpo_(atual);
    Db.atualizar('Pacientes', p.id, dados);
    auditar_(u, 'paciente.editar', 'Pacientes', p.id, antes, dados);
    return pacienteParaPerfil_(u, Db.obter('Pacientes', p.id));
  }
  dados.id = novoId_('pa');
  dados.criadoEm = agoraIso_();
  if (dados.diaVencimento === undefined) dados.diaVencimento = Number(config_('diaVencimento'));
  if (dados.modalidade === undefined) dados.modalidade = 'mensal';
  if (dados.formaPagamento === undefined) dados.formaPagamento = 'pix';
  Db.inserir('Pacientes', dados);
  // Valores padrão; se quem cadastrou não foi o financeiro, ficam aguardando conferência.
  Db.inserir('Valores', { id: novoId_('vl'), pacienteId: dados.id, valorSessao: Number(config_('valorSessao')), valorAnamnese: Number(config_('valorAnamnese')),
    vigenciaInicio: '2000-01-01', confirmado: veFinanceiro_(u), criadoPor: u.id, criadoEm: agoraIso_() });
  auditar_(u, 'paciente.criar', 'Pacientes', dados.id, null, dados);
  if (!veFinanceiro_(u)) avisarFinanceiro_('valores_conferir', 'Novo paciente para conferir', 'Confira os valores e o vencimento de ' + dados.nome + '.', '#/pacientes/' + dados.id);
  return pacienteParaPerfil_(u, Db.obter('Pacientes', dados.id));
}

/** Financeiro: valores do paciente a partir de uma data. */
function definirValores_(u, p) {
  var pac = Db.obter('Pacientes', p.pacienteId);
  exigir_(pac, 'Paciente não encontrado.');
  var vs = Number(p.valorSessao), va = Number(p.valorAnamnese);
  exigir_(vs > 0 && va > 0, 'Informe valores maiores que zero.');
  var vig = p.vigenciaInicio || hojeIso_();
  exigirMesAberto_(vig);
  var antes = valoresVigentes_(pac.id, vig);
  Db.inserir('Valores', { id: novoId_('vl'), pacienteId: pac.id, valorSessao: arred_(vs), valorAnamnese: arred_(va), vigenciaInicio: vig,
    confirmado: true, criadoPor: u.id, criadoEm: agoraIso_() });
  auditar_(u, 'paciente.valores', 'Pacientes', pac.id, antes, { valorSessao: vs, valorAnamnese: va, vigenciaInicio: vig });
  return valoresVigentes_(pac.id, hojeIso_());
}

function confirmarValores_(u, p) {
  var v = Db.listar('Valores', function (x) { return x.pacienteId === p.pacienteId && x.confirmado === false; });
  v.forEach(function (x) { Db.atualizar('Valores', x.id, { confirmado: true }); });
  auditar_(u, 'paciente.valores_confirmados', 'Pacientes', p.pacienteId);
  return { ok: true, confirmados: v.length };
}

/* ---------- Queixa (dado de saúde) ---------- */

function queixaLiberada_(pacienteId, profissionalId) {
  if (!profissionalId) return false;
  return Db.listar('LiberacoesQueixa', function (l) { return l.pacienteId === pacienteId && l.profissionalId === profissionalId; }).length > 0;
}

function podeLerQueixa_(u, pacienteId) {
  if (u.perfil === PERFIS.FINANCEIRO) return true;
  if (u.perfil === PERFIS.PROFISSIONAL) return queixaLiberada_(pacienteId, u.profissionalId);
  return false;
}

function obterQueixa_(u, p) {
  if (!podeLerQueixa_(u, p.pacienteId)) throw erro_('PERMISSAO', 'Sem acesso ao campo Queixa.');
  var q = Db.obter('Queixas', p.pacienteId);
  auditar_(u, 'queixa.ver', 'Pacientes', p.pacienteId);
  return { texto: q ? q.texto : '', atualizadoEm: q ? q.atualizadoEm : '' };
}

function salvarQueixa_(u, p) {
  exigir_(Db.obter('Pacientes', p.pacienteId), 'Paciente não encontrado.');
  var dados = { pacienteId: p.pacienteId, texto: String(p.texto || ''), atualizadoPor: u.id, atualizadoEm: agoraIso_() };
  if (Db.obter('Queixas', p.pacienteId)) Db.atualizar('Queixas', p.pacienteId, dados); else Db.inserir('Queixas', dados);
  auditar_(u, 'queixa.salvar', 'Pacientes', p.pacienteId); // o texto não vai para o histórico
  return { ok: true };
}

function liberarQueixa_(u, p) {
  exigir_(Db.obter('Pacientes', p.pacienteId) && Db.obter('Profissionais', p.profissionalId), 'Paciente ou profissional não encontrado.');
  var existentes = Db.listar('LiberacoesQueixa', function (l) { return l.pacienteId === p.pacienteId && l.profissionalId === p.profissionalId; });
  if (p.liberar === false) {
    Db.removerVarios('LiberacoesQueixa', existentes.map(function (l) { return l.id; }));
    auditar_(u, 'queixa.revogar', 'Pacientes', p.pacienteId, null, { profissionalId: p.profissionalId });
    return { liberado: false };
  }
  if (!existentes.length) Db.inserir('LiberacoesQueixa', { id: novoId_('lq'), pacienteId: p.pacienteId, profissionalId: p.profissionalId, liberadoPor: u.id, liberadoEm: agoraIso_() });
  auditar_(u, 'queixa.liberar', 'Pacientes', p.pacienteId, null, { profissionalId: p.profissionalId });
  return { liberado: true };
}

/* ---------- Contatos para recados ---------- */

function listarContatos_(u, p) {
  var lista = [];
  Db.listar('Pacientes', function (x) { return x.situacao !== 'inativo'; }).forEach(function (x) {
    var r = responsavelFinanceiro_(x);
    var w = telefoneWhats_(r.telefone);
    if (w) lista.push({ pacienteId: x.id, paciente: x.nome, responsavel: r.nome, telefone: r.telefone, whatsapp: w });
  });
  return lista.sort(function (a, b) { return a.paciente.localeCompare(b.paciente); });
}

/** Dados para imprimir a ficha cadastral (a queixa só sai para quem pode ler). */
function obterFicha_(u, p) {
  var pac = Db.obter('Pacientes', p.id);
  exigir_(pac, 'Paciente não encontrado.');
  var r = pacienteParaPerfil_(u, pac);
  r.queixa = podeLerQueixa_(u, pac.id) ? (Db.obter('Queixas', pac.id) || {}).texto || '' : null;
  r.clinica = { nome: APP.NOME, telefone: '(016) 99397-0995', email: config_('emailClinica'), endereco: 'Rua Antônio Covas, Nº 300 - Jardim Lima - 14403-111' };
  auditar_(u, 'paciente.ficha_impressa', 'Pacientes', pac.id);
  return r;
}

function registrarFichaAssinada_(u, p) {
  var pac = Db.obter('Pacientes', p.pacienteId);
  exigir_(pac, 'Paciente não encontrado.');
  var an = Db.obter('Anexos', p.anexoId);
  exigir_(an && an.tipo === 'ficha', 'Envie o arquivo da ficha assinada.');
  Db.atualizar('Anexos', an.id, { entidade: 'Pacientes', entidadeId: pac.id });
  Db.atualizar('Pacientes', pac.id, { fichaAnexoId: an.id, atualizadoEm: agoraIso_() });
  auditar_(u, 'paciente.ficha_assinada', 'Pacientes', pac.id, null, { anexoId: an.id });
  return { ok: true, fichaAnexoId: an.id };
}
