/* Pacientes: lista, cadastro completo, responsável financeiro, queixa, planos de atendimento, valores, serviços avulsos e documentos. */
(function () {
  'use strict';
  var U = App.u, I = App.icone, esc = U.esc;
  var AVULSOS = [{ v: 'escolar', t: 'Atendimento escolar (2 sessões)' }, { v: 'domiciliar', t: 'Atendimento domiciliar (2 sessões)' }, { v: 'laudo', t: 'Laudo e/ou relatório (2 sessões)' },
    { v: 'reuniao', t: 'Reunião multidisciplinar (1 sessão)' }, { v: 'caa', t: 'Confecção de CAA (17 sessões)' }, { v: 'grupo_auxiliar', t: 'Profissional auxiliar em grupo (1 sessão)' }, { v: 'livre', t: 'Outro serviço (valor livre)' }];
  var FORMAS = [{ v: 'pix', t: 'Pix' }, { v: 'cartao', t: 'Cartão de crédito' }, { v: 'dinheiro', t: 'Dinheiro' }, { v: 'boleto', t: 'Boleto' }, { v: 'outro', t: 'Outro' }];

  App.tela('pacientes', {
    titulo: 'Pacientes', perfis: ['admin', 'financeiro', 'secretaria'],
    render: function (ctx) {
      var sit = ctx.q.situacao || 'ativo';
      return App.api('pacientes.listar', sit === 'todos' ? {} : { situacao: sit }).then(function (l) {
        ctx.dados.lista = l;
        var fin = App.ehFin();
        return '<div class="linha"><input class="ent" type="search" placeholder="Buscar paciente ou responsável" data-acao-input="filtrar" id="busca-pac" style="max-width:360px">' +
          '<select class="ent" data-muda="situacao" style="width:auto">' + U.opcoes([{ v: 'ativo', t: 'Ativos' }, { v: 'inativo', t: 'Inativos' }, { v: 'todos', t: 'Todos' }], sit) + '</select>' +
          '<span style="flex:1"></span><a class="btn ama" href="#/pacientes/novo">' + I('mais', 18) + 'Novo paciente</a></div>' +
          '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Paciente</th><th>Responsável financeiro</th><th>Telefone</th>' + (fin ? '<th class="num">Valor da sessão</th><th>Valores</th>' : '') + '</tr></thead><tbody id="corpo-pac">' + linhas(l, fin) + '</tbody></table></div>' +
          '<div class="sub">' + l.length + ' paciente(s).</div>';
      });
    },
    depois: function (ctx) {
      var b = document.getElementById('busca-pac');
      b.addEventListener('input', function () {
        var t = U.normal(b.value);
        document.getElementById('corpo-pac').innerHTML = linhas(ctx.dados.lista.filter(function (p) { return U.normal(p.nome + ' ' + p.responsavelNome).indexOf(t) >= 0; }), App.ehFin());
      });
      b.focus();
    },
    acoes: {
      situacao: function (el) { location.hash = '#/pacientes?situacao=' + el.value; },
      abrir: function (el) { location.hash = '#/pacientes/' + el.getAttribute('data-id'); }
    }
  });
  function linhas(l, fin) {
    if (!l.length) return '<tr><td colspan="5" class="vazio">Nenhum paciente encontrado.</td></tr>';
    return l.map(function (p) {
      return '<tr class="clic" data-acao="abrir" data-id="' + p.id + '"><td class="b">' + esc(p.nome) + '</td><td>' + esc(p.responsavelNome || '—') + '</td><td>' + esc(p.telefone || '—') + '</td>' +
        (fin ? '<td class="num">' + U.moeda(p.valorSessao) + (p.proximoValor ? '<div class="sub peq">' + U.moeda(p.proximoValor.valorSessao) + ' a partir de ' + U.dataBr(p.proximoValor.vigenciaInicio) + '</div>' : '') + (p.modalidade === 'sessao' ? ' <span class="selo s-azul">por sessão</span>' : '') + '</td><td>' + (p.valoresConfirmados ? '<span class="selo s-ok">Conferidos</span>' : '<span class="selo s-esp">Conferir</span>') + '</td>' : '') + '</tr>';
    }).join('');
  }

  /* ---------- Ficha do paciente ---------- */
  App.tela('pacientes/:id', {
    menu: 'pacientes', perfis: ['admin', 'financeiro', 'secretaria'],
    titulo: function (ctx) { return ctx.id === 'novo' ? 'Novo paciente' : 'Paciente'; },
    render: function (ctx) {
      if (ctx.id === 'novo') { ctx.dados.p = { respFinTipo: 'mae', situacao: 'ativo', maeJson: {}, paiJson: {}, outroJson: {}, contatoJson: {}, respFinJson: {}, planos: [] }; return formCadastro(ctx.dados.p, true); }
      return App.api('pacientes.obter', { id: ctx.id }).then(function (p) {
        ctx.dados.p = p;
        var aba = ctx.q.aba || 'cadastro', fin = App.ehFin();
        var abas = [['cadastro', 'Cadastro'], ['planos', 'Planos e horários']].concat(fin ? [['financeiro', 'Financeiro'], ['documentos', 'Contrato e documentos']] : []);
        var h = '<div class="linha entre"><div><a href="#/pacientes" class="peq">← Pacientes</a><h1>' + esc(p.nome) + '</h1><div class="sub">Responsável financeiro: ' + esc(p.responsavel.nome || '—') + (p.responsavel.parentesco ? ' (' + esc(p.responsavel.parentesco) + ')' : '') + '</div></div>' +
          '<div class="linha">' + (p.whatsapp ? '<button class="btn zap" data-acao="_zap" data-url="' + esc(U.zapNumero(p.whatsapp)) + '">' + I('zap', 18) + 'WhatsApp</button>' : '') + '<button class="btn" data-acao="imprimirFicha">' + I('imprimir', 18) + 'Imprimir ficha</button></div></div>' +
          '<nav class="abas">' + abas.map(function (a) { return '<a class="' + (a[0] === aba ? 'ativo' : '') + '" href="#/pacientes/' + p.id + '?aba=' + a[0] + '">' + a[1] + '</a>'; }).join('') + '</nav>';
        if (aba === 'cadastro') return h + formCadastro(p, false);
        if (aba === 'planos') return h + abaPlanos(p);
        if (aba === 'financeiro') return Promise.all([App.api('financeiro.avulsos', { pacienteId: p.id }), App.api('financeiro.cobrancas', { busca: p.nome })]).then(function (r) { return h + abaFinanceiro(p, r[0], r[1]); });
        if (aba === 'documentos') return App.api('financeiro.contratos', { pacienteId: p.id }).then(function (c) { return h + abaDocumentos(p, c); });
        return h;
      });
    },
    depois: function (ctx) { var r = document.querySelector('[name=respFinTipo]:checked'); if (r) mostrarResp(r.value); },
    acoes: {
      respTipo: function (el) { mostrarResp(el.value); },
      salvar: function (f, ev, ctx) {
        var d = U.dadosForm(f);
        if (ctx.id !== 'novo') d.id = ctx.id;
        if (d.diaVencimento !== undefined) d.diaVencimento = Number(d.diaVencimento);
        if (d.respFinTipo !== 'outro') { var ec = d.respFinJson && d.respFinJson.estadoCivil; d.respFinJson = ec ? { estadoCivil: ec } : null; }
        return App.chamar('pacientes.salvar', d, 'Cadastro salvo.').then(function (r) {
          if (!r) return;
          App._cachePacientes = null;
          var q = queixaPendente(f);
          (q !== null ? App.api('queixa.salvar', { pacienteId: r.id, texto: q }) : Promise.resolve()).then(function () {
            if (ctx.id === 'novo') location.hash = '#/pacientes/' + r.id + '?aba=planos'; else ctx.recarregar();
          });
        });
      },
      verQueixa: function (el, ev, ctx) {
        App.chamar('queixa.obter', { pacienteId: ctx.id }).then(function (q) {
          if (!q) return;
          var box = document.getElementById('caixa-queixa');
          box.innerHTML = '<label class="campo todo">Queixa<textarea class="ent" name="_queixa" rows="4">' + esc(q.texto) + '</textarea><small>Visível só para Paula e Flávia (e profissional liberada pela administradora).' + (q.atualizadoEm ? ' Atualizada em ' + U.dataHoraBr(q.atualizadoEm) + '.' : '') + '</small></label>';
        });
      },
      liberarQueixa: function (el, ev, ctx) {
        var prof = document.getElementById('lib-prof').value;
        if (!prof) { App.toast('Escolha a profissional.', 'erro'); return; }
        App.chamar('queixa.liberar', { pacienteId: ctx.id, profissionalId: prof, liberar: el.getAttribute('data-v') === '1' }, el.getAttribute('data-v') === '1' ? 'Leitura liberada.' : 'Liberação retirada.');
      },
      imprimirFicha: function (el, ev, ctx) { App.api('pacientes.ficha', { id: ctx.id }).then(imprimirFicha, function (e) { App.toast(e.message, 'erro'); }); },
      fichaAssinada: function (el, ev, ctx) {
        var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf';
        inp.onchange = function () {
          if (!inp.files[0]) return;
          U.lerArquivo(inp.files[0]).then(function (f) { return App.api('anexos.enviar', { tipo: 'ficha', nome: f.nome, mime: f.mime, base64: f.base64, entidade: 'Pacientes', entidadeId: ctx.id }); })
            .then(function (an) { return App.api('pacientes.ficha_assinada', { pacienteId: ctx.id, anexoId: an.id }); })
            .then(function () { App.toast('Ficha assinada guardada.', 'ok'); ctx.recarregar(); }, function (e) { App.toast(e.message, 'erro'); });
        };
        inp.click();
      },
      verAnexo: function (el) { App.api('anexos.baixar', { id: el.getAttribute('data-id') }).then(function (a) { U.abrir(a.mime, a.base64); }, function (e) { App.toast(e.message, 'erro'); }); },
      /* Planos */
      novoPlano: function (el, ev, ctx) { formPlano(ctx, null); },
      editarPlano: function (el, ev, ctx) { formPlano(ctx, ctx.dados.p.planos.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]); },
      encerrarPlano: function (el, ev, ctx) {
        var m = App.modal({ titulo: 'Encerrar atendimento', corpo: '<label class="campo">Último dia de atendimento<input class="ent" type="date" id="fim-plano" value="' + U.hoje() + '"></label><div class="alerta a-aviso">As sessões depois dessa data saem da agenda. A profissional é avisada.</div>',
          pe: '<button class="btn" data-acao="_fechar">Voltar</button><button class="btn perigo" data-acao="ok">Encerrar</button>',
          acoes: { ok: function () { App.chamar('agenda.plano_encerrar', { id: el.getAttribute('data-id'), fim: m.el.querySelector('#fim-plano').value }, 'Atendimento encerrado.').then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } }); } } });
      },
      agendarAvulso: function (el, ev, ctx) { App.novoAgendamento({ dados: {}, recarregar: function () { } }, { pacienteId: ctx.id }); },
      /* Financeiro */
      valores: function (f, ev, ctx) {
        var d = U.dadosForm(f);
        return App.chamar('pacientes.valores', { pacienteId: ctx.id, valorSessao: U.lerNum(d.valorSessao), valorAnamnese: U.lerNum(d.valorAnamnese), vigenciaInicio: d.vigenciaInicio }, 'Valores salvos: valem a partir de ' + U.dataBr(d.vigenciaInicio) + '.').then(function (r) { if (r) ctx.recarregar(); });
      },
      confirmarValores: function (el, ev, ctx) { App.chamar('pacientes.confirmar_valores', { pacienteId: ctx.id }, 'Valores conferidos.').then(function (r) { if (r) ctx.recarregar(); }); },
      avulso: function (f, ev, ctx) {
        var d = U.dadosForm(f); d.pacienteId = ctx.id; if (d.valor) d.valor = U.lerNum(d.valor);
        return App.chamar('financeiro.avulso', d, 'Serviço lançado na cobrança do mês.').then(function (r) { if (r) ctx.recarregar(); });
      },
      tipoAvulso: function (el) { document.getElementById('avulso-livre').classList.toggle('oculto', el.value !== 'livre'); },
      cancelarAvulso: function (el, ev, ctx) { App.confirmar('Cancelar este serviço avulso?').then(function (ok) { if (ok) App.chamar('financeiro.avulso_cancelar', { id: el.getAttribute('data-id') }, 'Cancelado.').then(function (r) { if (r) ctx.recarregar(); }); }); },
      adiantamento: function (f, ev, ctx) {
        var d = U.dadosForm(f);
        return App.chamar('financeiro.adiantamento', { pacienteId: ctx.id, valor: U.lerNum(d.valor), data: d.data, forma: d.forma }, 'Pagamento antecipado registrado. Será descontado no fechamento.').then(function (r) { if (r) ctx.recarregar(); });
      },
      /* Documentos */
      gerarContrato: function (el, ev, ctx) {
        el.disabled = true;
        App.api('financeiro.contrato', { pacienteId: ctx.id }).then(function (r) {
          U.abrir('application/pdf', r.base64);
          if (r.camposEmBranco.length) App.toast('Contrato gerado com campos em branco: ' + r.camposEmBranco.join(', ') + '.', 'erro'); else App.toast('Contrato gerado.', 'ok');
          ctx.recarregar();
        }, function (e) { App.toast(e.message, 'erro'); el.disabled = false; });
      }
    }
  });

  function mostrarResp(tipo) {
    var o = document.getElementById('bloco-outro'), e = document.getElementById('bloco-ec');
    if (o) { o.classList.toggle('oculto', tipo !== 'outro'); o.querySelectorAll('input').forEach(function (i) { i.disabled = tipo !== 'outro'; }); }
    if (e) { e.classList.toggle('oculto', tipo === 'outro'); e.querySelectorAll('input').forEach(function (i) { i.disabled = tipo === 'outro'; }); }
  }
  function queixaPendente(f) { var q = f.querySelector('[name=_queixa]'); return q ? q.value : null; }

  function campo(rotulo, nome, valor, tipo, extra) {
    return '<label class="campo' + (extra && extra.todo ? ' todo' : '') + '">' + rotulo + '<input class="ent" name="' + nome + '" type="' + (tipo || 'text') + '" value="' + esc(valor || '') + '"' + (extra && extra.req ? ' required' : '') + (extra && extra.ph ? ' placeholder="' + esc(extra.ph) + '"' : '') + '></label>';
  }
  function pessoa(pref, o, comParentesco) {
    o = o || {};
    return (comParentesco ? campo('Parentesco', pref + '.parentesco', o.parentesco, 'text', { ph: 'Ex.: avó, esposa, tio' }) : '') +
      campo('Nome', pref + '.nome', o.nome) + campo('Data de nascimento', pref + '.nascimento', o.nascimento, 'date') + campo('RG', pref + '.rg', o.rg) + campo('CPF', pref + '.cpf', o.cpf) +
      campo('Telefone / WhatsApp', pref + '.telefone', o.telefone, 'tel') + campo('Profissão', pref + '.profissao', o.profissao);
  }

  function formCadastro(p, novo) {
    var fin = App.ehFin(), c = p.contatoJson || {}, rf = p.respFinJson || {}, end = rf.endereco || {};
    var tipos = [['mae', 'Mãe'], ['pai', 'Pai'], ['paciente', 'O próprio paciente'], ['outro', 'Outra pessoa']];
    var h = '<form class="pilha" data-form="salvar" style="gap:16px">' +
      (!novo && p.situacao === 'ativo' && fin && p.valores && !p.valores.confirmado ? '<div class="alerta a-aviso">Valores aguardando conferência do financeiro (aba Financeiro).</div>' : '') +
      '<section class="cartao"><h2>Dados do paciente</h2><div class="form">' + campo('Nome completo', 'nome', p.nome, 'text', { req: 1, todo: 1 }) +
      campo('Data de nascimento', 'nascimento', p.nascimento, 'date') + campo('RG / certidão', 'rg', p.rg) + campo('CPF', 'cpf', p.cpf) + campo('Especialidade', 'especialidade', p.especialidade, 'text', { ph: 'Fonoaudiologia' }) +
      campo('Escola', 'escola', p.escola) + campo('Série', 'serie', p.serie) + campo('Período', 'periodo', p.periodo, 'text', { ph: 'Manhã / tarde' }) + campo('Data de início', 'inicio', p.inicio, 'date') +
      '<label class="campo">Situação<select class="ent" name="situacao">' + U.opcoes([{ v: 'ativo', t: 'Ativo' }, { v: 'inativo', t: 'Inativo' }], p.situacao) + '</select></label></div></section>';
    if (fin) {
      h += '<section class="cartao"><div class="linha entre"><h2>Queixa</h2><span class="selo s-esp">Dado de saúde · acesso restrito</span></div><div id="caixa-queixa">' +
        (novo ? '<label class="campo todo">Queixa<textarea class="ent" name="_queixa" rows="3"></textarea></label>' : (p.temQueixa ? '<button class="btn" type="button" data-acao="verQueixa">Mostrar e editar a queixa</button>' : '<label class="campo todo">Queixa<textarea class="ent" name="_queixa" rows="3"></textarea></label>')) + '</div></section>';
    }
    h += '<section class="cartao"><h2>Mãe</h2><div class="form">' + pessoa('maeJson', p.maeJson) + '</div></section>' +
      '<section class="cartao"><h2>Pai</h2><div class="form">' + pessoa('paiJson', p.paiJson) + '</div></section>' +
      '<section class="cartao"><h2>Outro responsável ou contato</h2><div class="form">' + pessoa('outroJson', p.outroJson, true) + '</div></section>' +
      '<section class="cartao"><h2>Endereço e contato</h2><div class="form">' + campo('Endereço', 'contatoJson.endereco', c.endereco, 'text', { todo: 1 }) + campo('Número', 'contatoJson.numero', c.numero) + campo('Bairro', 'contatoJson.bairro', c.bairro) +
      campo('CEP', 'contatoJson.cep', c.cep) + campo('Cidade', 'contatoJson.cidade', c.cidade || 'Franca') + campo('Estado', 'contatoJson.estado', c.estado || 'SP') + campo('E-mail', 'contatoJson.email', c.email, 'email') +
      campo('Telefone principal', 'contatoJson.telefone', c.telefone, 'tel') + campo('Como conheceu a clínica', 'comoConheceu', p.comoConheceu) + '</div></section>' +
      '<section class="cartao"><h2>Responsável financeiro</h2><div class="sub">Quem assina o contrato e paga. A cobrança e o recibo saem no nome dele.</div><div class="linha">' +
      tipos.map(function (t) { return '<label class="marcar"><input type="radio" name="respFinTipo" value="' + t[0] + '" data-muda="respTipo"' + (p.respFinTipo === t[0] ? ' checked' : '') + '>' + t[1] + '</label>'; }).join('') + '</div>' +
      '<div class="form" id="bloco-ec">' + campo('Estado civil do responsável', 'respFinJson.estadoCivil', rf.estadoCivil, 'text', { ph: 'Para o contrato' }) + '</div>' +
      '<div class="form oculto" id="bloco-outro">' + campo('Nome', 'respFinJson.nome', rf.nome) + campo('Parentesco', 'respFinJson.parentesco', rf.parentesco) + campo('CPF', 'respFinJson.cpf', rf.cpf) + campo('RG', 'respFinJson.rg', rf.rg) +
      campo('Estado civil', 'respFinJson.estadoCivil', rf.estadoCivil) + campo('Profissão', 'respFinJson.profissao', rf.profissao) + campo('Telefone / WhatsApp', 'respFinJson.telefone', rf.telefone, 'tel') + campo('E-mail', 'respFinJson.email', rf.email, 'email') +
      campo('Endereço (se diferente)', 'respFinJson.endereco.logradouro', end.logradouro, 'text', { todo: 1 }) + campo('Número', 'respFinJson.endereco.numero', end.numero) + campo('Bairro', 'respFinJson.endereco.bairro', end.bairro) +
      campo('CEP', 'respFinJson.endereco.cep', end.cep) + campo('Cidade', 'respFinJson.endereco.cidade', end.cidade) + campo('Estado', 'respFinJson.endereco.estado', end.estado) + '</div></section>';
    if (fin) {
      h += '<section class="cartao"><h2>Cobrança</h2><div class="form">' +
        '<label class="campo">Dia de vencimento<input class="ent" type="number" min="1" max="31" name="diaVencimento" value="' + esc(p.diaVencimento || 10) + '"></label>' +
        '<label class="campo">Forma de pagamento<select class="ent" name="formaPagamento">' + U.opcoes(FORMAS, p.formaPagamento || 'pix') + '</select></label>' +
        '<label class="campo">Modalidade<select class="ent" name="modalidade">' + U.opcoes([{ v: 'mensal', t: 'Mensal (paga o mês anterior)' }, { v: 'sessao', t: 'Por sessão (vence no dia)' }], p.modalidade || 'mensal') + '</select></label></div></section>';
    }
    h += '<section class="cartao"><h2>Outros</h2><div class="form"><label class="campo">Uso de imagem<select class="ent" name="usoImagem">' + U.opcoes([{ v: 'plena', t: 'Autoriza plenamente' }, { v: 'nao', t: 'Não autoriza' }, { v: 'cientifica', t: 'Só para questões científicas' }], p.usoImagem, 'Não informado') + '</select></label>' +
      campo('Observações administrativas (sem informação clínica)', 'observacoes', p.observacoes, 'text', { todo: 1 }) + '</div>' +
      (!novo ? '<div class="linha">' + (p.fichaAnexoId ? '<button class="btn" type="button" data-acao="verAnexo" data-id="' + p.fichaAnexoId + '">Ver ficha assinada</button>' : '<span class="sub">Ficha assinada ainda não anexada.</span>') + '<button class="btn" type="button" data-acao="fichaAssinada">' + I('anexo', 18) + 'Anexar ficha assinada</button></div>' : '') + '</section>';
    if (App.e('admin') && !novo) {
      h += '<section class="cartao"><h2>Liberar leitura da Queixa</h2><div class="linha"><select class="ent" id="lib-prof" style="max-width:280px">' + U.opcoes(App.profissionais().map(function (x) { return { v: x.id, t: x.nome }; }), '', 'Profissional…') + '</select>' +
        '<button class="btn cont" type="button" data-acao="liberarQueixa" data-v="1">Liberar</button><button class="btn" type="button" data-acao="liberarQueixa" data-v="0">Retirar</button></div></section>';
    }
    h += '<div class="linha fim"><a class="btn" href="#/pacientes">Cancelar</a><button class="btn pri" type="submit" style="min-width:180px">' + (novo ? 'Cadastrar paciente' : 'Salvar cadastro') + '</button></div></form>';
    return h;
  }

  /* ---------- Planos ---------- */
  function textoDias(dias) { return (dias || []).map(function (d) { return U.DIAS_C[d.dia] + ' ' + d.hora + (d.dupla ? ' (dupla)' : ''); }).join(' · '); }
  function abaPlanos(p) {
    var h = '<div class="linha"><button class="btn ama" data-acao="novoPlano">' + I('mais', 18) + 'Novo plano de atendimento</button><button class="btn" data-acao="agendarAvulso">Agendar sessão avulsa ou anamnese</button></div>';
    if (!p.planos.length) return h + '<div class="cartao vazio">Nenhum plano ainda. Cadastre a terapia, a profissional, os dias e os horários: a agenda é gerada a partir daqui.</div>';
    return h + '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Terapia</th><th>Profissional</th><th>Dias e horários</th><th>Início</th><th>Fim</th><th>Situação</th><th></th></tr></thead><tbody>' +
      p.planos.map(function (pl) {
        var pr = App.prof(pl.profissionalId) || {};
        return '<tr><td class="b">' + esc(pl.terapia) + '</td><td>' + esc(pr.nome || '') + '</td><td>' + textoDias(pl.diasJson) + ' · 45 min</td><td>' + U.dataBr(pl.inicio) + '</td><td>' + (pl.fim ? U.dataBr(pl.fim) : '—') + '</td>' +
          '<td>' + (pl.ativo !== false ? '<span class="selo s-ok">Ativo</span>' : '<span class="selo s-neu">Encerrado</span>') + '</td>' +
          '<td>' + (pl.ativo !== false ? '<div class="linha"><button class="btn peq" data-acao="editarPlano" data-id="' + pl.id + '">Alterar horário</button><button class="btn peq perigo" data-acao="encerrarPlano" data-id="' + pl.id + '">Encerrar</button></div>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function formPlano(ctx, pl) {
    pl = pl || { diasJson: [], inicio: U.hoje() };
    var dias = {}, duplas = {}; (pl.diasJson || []).forEach(function (d) { dias[d.dia] = d.hora; if (d.dupla) duplas[d.dia] = 1; });
    var profs = App.profissionais().filter(function (x) { return x.ativo; });
    var m = App.modal({ titulo: pl.id ? 'Alterar horário' : 'Novo plano de atendimento', corpo: '<form class="form" data-form="salvarPlano">' +
      '<label class="campo">Profissional<select class="ent" name="profissionalId" required data-muda="profPlano">' + U.opcoes(profs.map(function (x) { return { v: x.id, t: x.nome + ' · ' + x.especialidade }; }), pl.profissionalId, 'Escolha…') + '</select></label>' +
      '<label class="campo">Terapia<input class="ent" name="terapia" value="' + esc(pl.terapia || '') + '" placeholder="Fonoaudiologia"></label>' +
      '<label class="campo">' + (pl.id ? 'Novo horário vale a partir de' : 'Início') + '<input class="ent" type="date" name="inicio" required value="' + (pl.id ? U.hoje() : pl.inicio) + '"></label>' +
      '<label class="campo">Fim (opcional)<input class="ent" type="date" name="fim" value="' + esc(pl.fim || '') + '"></label>' +
      '<fieldset class="campo todo"><legend>Dias da semana e horário (sessões de 45 min)</legend><div class="form" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      [1, 2, 3, 4, 5, 6].map(function (d) { return '<div class="pilha" style="gap:4px"><label class="marcar"><input type="checkbox" name="d' + d + '"' + (dias[d] ? ' checked' : '') + '>' + U.DIAS[d] + '</label><input class="ent" type="time" step="900" name="h' + d + '" value="' + (dias[d] || '') + '" aria-label="Horário de ' + U.DIAS[d] + '"><label class="marcar peq" title="Divide o horário com outro paciente da mesma profissional"><input type="checkbox" name="u' + d + '"' + (duplas[d] ? ' checked' : '') + '>Em dupla</label></div>'; }).join('') +
      '</div></fieldset>' + (pl.id ? '<div class="campo todo"><div class="alerta a-aviso">As sessões já registradas não mudam. As futuras passam para o novo horário.</div></div>' : '') +
      '<div class="campo todo"><button class="btn pri" type="submit">Salvar plano</button></div></form>',
      acoes: {
        profPlano: function (el) { var t = m.el.querySelector('[name=terapia]'); var pr = App.prof(el.value); if (pr && !t.value) t.value = pr.especialidade; },
        salvarPlano: function (f) {
          var d = U.dadosForm(f), diasJ = [];
          for (var i = 1; i <= 6; i++) if (d['d' + i]) { if (!d['h' + i]) { App.toast('Informe o horário de ' + U.DIAS[i] + '.', 'erro'); return; } diasJ.push(d['u' + i] ? { dia: i, hora: d['h' + i], dupla: true } : { dia: i, hora: d['h' + i] }); }
          var dados = { id: pl.id, pacienteId: ctx.id, profissionalId: d.profissionalId, terapia: d.terapia, inicio: d.inicio, fim: d.fim, diasJson: diasJ };
          if (pl.id) { dados.inicio = pl.inicio; dados.aPartirDe = d.inicio; }
          var enviar = function (conf) {
            dados.confirmarConflitos = conf;
            return App.api('agenda.plano_salvar', dados).then(function (r) {
              App.toast(r.sessoesCriadas + ' sessão(ões) colocadas na agenda.' + (r.conflitos.length ? ' ' + r.conflitos.length + ' data(s) puladas por conflito.' : ''), 'ok');
              m.fechar(); ctx.recarregar();
            }, function (e) {
              if (e.codigo === 'CONFLITO') return App.confirmar(e.message, { botao: 'Salvar pulando as datas' }).then(function (ok) { if (ok) return enviar(true); });
              App.toast(e.message, 'erro');
            });
          };
          return enviar(false);
        }
      } });
  }

  /* ---------- Financeiro do paciente ---------- */
  function abaFinanceiro(p, avulsos, cobs) {
    var v = p.valores, px = v.proximo;
    var h = '<div class="grade-cartoes"><div class="kpi"><span class="r">Valor da sessão hoje</span><span class="v">' + U.moeda(v.valorSessao) + '</span>' + (px ? '<span class="sub"><b>' + U.moeda(px.valorSessao) + '</b> a partir de ' + U.dataBr(px.vigenciaInicio) + '</span>' : '') + '</div>' +
      '<div class="kpi"><span class="r">Anamnese hoje</span><span class="v">' + U.moeda(v.valorAnamnese) + '</span>' + (px ? '<span class="sub"><b>' + U.moeda(px.valorAnamnese) + '</b> a partir de ' + U.dataBr(px.vigenciaInicio) + '</span>' : '') + '</div>' +
      '<div class="kpi"><span class="r">Vencimento</span><span class="v">Dia ' + esc(p.diaVencimento || 10) + '</span><span class="sub">' + (p.modalidade === 'sessao' ? 'Paga por sessão' : 'Mensal') + '</span></div></div>';
    if (!v.confirmado) h += '<div class="alerta a-aviso linha entre"><div style="flex:1">Os valores deste paciente ainda não foram conferidos.</div><button class="btn peq cont" data-acao="confirmarValores">Conferi, estão certos</button></div>';
    h += '<section class="cartao"><h2>Alterar valores</h2><form class="form" data-form="valores"><label class="campo">Sessão (R$)<input class="ent" name="valorSessao" inputmode="decimal" required value="' + U.num((px || v).valorSessao) + '"></label>' +
      '<label class="campo">Anamnese (R$)<input class="ent" name="valorAnamnese" inputmode="decimal" required value="' + U.num((px || v).valorAnamnese) + '"></label><label class="campo">Vale a partir de<input class="ent" type="date" name="vigenciaInicio" required value="' + U.comp() + '-01"></label>' +
      '<div class="campo"><span>&nbsp;</span><button class="btn pri" type="submit">Salvar valores</button></div></form>' +
      (p.historicoValores.length > 1 ? '<details><summary class="sub">Histórico de valores</summary><table class="tab"><tbody>' + p.historicoValores.slice().reverse().map(function (x) { return '<tr><td>' + U.dataBr(x.vigenciaInicio) + '</td><td>Sessão ' + U.moeda(x.valorSessao) + '</td><td>Anamnese ' + U.moeda(x.valorAnamnese) + '</td></tr>'; }).join('') + '</tbody></table></details>' : '') + '</section>';
    h += '<section class="cartao"><h2>Serviços avulsos</h2>' + (avulsos.length ? '<table class="tab"><tbody>' + avulsos.map(function (a) { return '<tr><td>' + U.dataBr(a.data) + '</td><td>' + esc(a.descricao) + '</td><td class="num">' + U.moeda(a.valorCalculado) + '</td><td><button class="btn peq" data-acao="cancelarAvulso" data-id="' + a.id + '">Cancelar</button></td></tr>'; }).join('') + '</tbody></table>' : '') +
      '<form class="form" data-form="avulso"><label class="campo">Serviço<select class="ent" name="codigo" data-muda="tipoAvulso">' + U.opcoes(AVULSOS, 'laudo') + '</select></label>' +
      '<label class="campo">Profissional<select class="ent" name="profissionalId">' + U.opcoes(App.profissionais().filter(function (x) { return x.entraFinanceiro; }).map(function (x) { return { v: x.id, t: x.nome }; }), '', '—') + '</select></label>' +
      '<label class="campo">Data<input class="ent" type="date" name="data" required value="' + U.hoje() + '"></label>' +
      '<div class="form oculto campo todo" id="avulso-livre" style="padding:0"><label class="campo">Descrição<input class="ent" name="descricao"></label><label class="campo">Valor (R$)<input class="ent" name="valor" inputmode="decimal"></label></div>' +
      '<div class="campo"><span>&nbsp;</span><button class="btn cont" type="submit">Lançar na cobrança</button></div></form></section>';
    h += '<section class="cartao"><h2>Pagamento antecipado</h2><div class="sub">Quando a família paga no meio do mês. O valor é descontado no fechamento.</div><form class="form" data-form="adiantamento"><label class="campo">Valor (R$)<input class="ent" name="valor" inputmode="decimal" required></label>' +
      '<label class="campo">Data<input class="ent" type="date" name="data" required value="' + U.hoje() + '"></label><label class="campo">Forma<select class="ent" name="forma">' + U.opcoes(FORMAS, 'pix') + '</select></label>' +
      '<div class="campo"><span>&nbsp;</span><button class="btn cont" type="submit">Registrar</button></div></form></section>';
    h += '<section class="cartao"><h2>Cobranças</h2>' + (cobs.length ? '<table class="tab"><thead><tr><th>Mês</th><th>Vencimento</th><th class="num">Total</th><th class="num">Saldo</th><th>Situação</th></tr></thead><tbody>' + cobs.map(function (c) {
      return '<tr class="clic" onclick="location.hash=\'#/financeiro/cobrancas/' + c.id + '\'"><td>' + U.nomeMes(c.competencia) + '</td><td>' + U.dataBr(c.vencimento) + '</td><td class="num">' + U.moeda(c.total) + '</td><td class="num">' + U.moeda(c.saldo) + '</td><td>' + App.seloCobranca(c) + '</td></tr>';
    }).join('') + '</tbody></table>' : '<div class="sub">Nenhuma cobrança ainda.</div>') + '</section>';
    return h;
  }
  function abaDocumentos(p, contratos) {
    return '<section class="cartao"><h2>Contrato</h2><div class="sub">Gerado a partir do cadastro, do plano de fonoaudiologia e dos valores. Confira os dados antes de imprimir.</div>' +
      '<div><button class="btn pri" data-acao="gerarContrato">Gerar contrato (PDF)</button></div>' +
      (contratos.length ? '<table class="tab"><tbody>' + contratos.map(function (c) { return '<tr><td>Contrato gerado em ' + U.dataHoraBr(c.geradoEm) + '</td><td><button class="btn peq" data-acao="verAnexo" data-id="' + c.anexoId + '">Abrir</button></td></tr>'; }).join('') + '</tbody></table>' : '') + '</section>';
  }

  /* ---------- Ficha cadastral para imprimir ---------- */
  function imprimirFicha(f) {
    var linha = function (r, v) { return '<div class="l"><span>' + r + ':</span><b>' + esc(v || '') + '</b></div>'; };
    var pes = function (t, o) { o = o || {}; return '<h2>' + t + '</h2>' + linha('NOME', o.nome) + '<div class="g">' + linha('DATA DE NASCIMENTO', U.dataBr(o.nascimento)) + linha('RG', o.rg) + linha('CPF', o.cpf) + '</div><div class="g">' + linha('TELEFONE', o.telefone) + linha('PROFISSÃO', o.profissao) + '</div>'; };
    var c = f.contatoJson || {};
    var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha cadastral — ' + esc(f.nome) + '</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:11pt;color:#222}' +
      '.cab{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #3F5626;padding-bottom:8px}.cab img{height:70px}.cab div{text-align:right;font-size:10pt;color:#444}' +
      'h1{text-align:center;font-size:14pt;letter-spacing:.1em;margin:14px 0}h2{font-size:11pt;background:#EEF3E6;padding:4px 8px;margin:14px 0 6px;text-align:center;letter-spacing:.06em}' +
      '.l{display:flex;gap:6px;border-bottom:1px solid #bbb;padding:5px 0;flex:1}.l span{white-space:nowrap;font-size:9.5pt;color:#555}.l b{font-weight:600}.g{display:flex;gap:16px}.ass{margin-top:40px;display:flex;justify-content:space-between;gap:30px}.ass div{flex:1;border-top:1px solid #000;text-align:center;padding-top:4px;font-size:10pt}</style></head><body>' +
      '<div class="cab"><img src="' + location.href.replace(/#.*$/, '').replace(/index\.html$/, '') + 'icones/logo.png" alt="Espaço Giraosol"><div>' + esc(f.clinica.telefone) + '<br>' + esc(f.clinica.email) + '<br>' + esc(f.clinica.endereco) + '</div></div>' +
      '<h1>FICHA CADASTRAL</h1>' + linha('ESPECIALIDADE', f.especialidade) +
      '<h2>DADOS DO PACIENTE</h2>' + linha('NOME', f.nome) + '<div class="g">' + linha('DATA DE NASCIMENTO', U.dataBr(f.nascimento)) + linha('RG', f.rg) + linha('CPF', f.cpf) + '</div>' +
      '<div class="g">' + linha('ESCOLA', f.escola) + linha('SÉRIE', f.serie) + linha('PERÍODO', f.periodo) + '</div>' + (f.queixa !== null ? linha('QUEIXA', f.queixa) : linha('QUEIXA', '')) +
      pes('DADOS DA MÃE', f.maeJson) + pes('DADOS DO PAI', f.paiJson) + (f.outroJson && f.outroJson.nome ? pes('OUTRO RESPONSÁVEL (' + esc(f.outroJson.parentesco || '') + ')', f.outroJson) : '') +
      '<h2>CONTATOS</h2><div class="g">' + linha('ENDEREÇO', c.endereco) + linha('Nº', c.numero) + linha('BAIRRO', c.bairro) + '</div><div class="g">' + linha('CEP', c.cep) + linha('CIDADE', c.cidade) + '</div>' + linha('E-MAIL', c.email) +
      '<h2>RESPONSÁVEL FINANCEIRO</h2>' + linha('NOME', f.responsavel.nome) + '<div class="g">' + linha('PARENTESCO', f.responsavel.parentesco) + linha('CPF', f.responsavel.cpf) + '</div>' +
      '<h2>CONTE COMO NOS CONHECEU</h2>' + linha('', f.comoConheceu) +
      '<div class="ass"><div>Assinatura do responsável</div><div>Data: ____/____/______</div></div><script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>';
    var w = window.open('', '_blank');
    if (!w) { App.toast('Permita janelas pop-up para imprimir.', 'erro'); return; }
    w.document.write(html); w.document.close();
  }
})();
