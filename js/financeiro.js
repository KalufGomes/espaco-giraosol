/* Financeiro: decisões de cobrança, fechamento do mês, contas a receber, comprovantes, repasses e extrato da profissional. */
(function () {
  'use strict';
  var U = App.u, I = App.icone, esc = U.esc;
  var FORMAS = [{ v: 'pix', t: 'Pix' }, { v: 'cartao', t: 'Cartão de crédito' }, { v: 'dinheiro', t: 'Dinheiro' }, { v: 'boleto', t: 'Boleto' }, { v: 'outro', t: 'Outro' }];
  var FIN = ['admin', 'financeiro'];

  App.seloCobranca = function (c) {
    if (c.status === 'paga') return '<span class="selo s-ok">Paga</span>';
    if (c.status === 'cancelada') return '<span class="selo s-neu">Cancelada</span>';
    if (c.diasAtraso > 0) return '<span class="selo s-ruim">Atrasada ' + c.diasAtraso + ' dia' + (c.diasAtraso > 1 ? 's' : '') + '</span>';
    return c.status === 'parcial' ? '<span class="selo s-esp">Parcial</span>' : '<span class="selo s-azul">Em aberto</span>';
  };

  /* ---------- Decisões ---------- */
  App.tela('financeiro/decisoes', {
    titulo: 'Decisões de cobrança', perfis: FIN,
    render: function (ctx) {
      return App.api('financeiro.decisoes').then(function (l) {
        ctx.dados.l = l;
        var h = '<div class="alerta a-info">Faltas sem aviso, cancelamentos com menos de 24h e atrasos acima de 30 minutos podem ser cobrados pelo contrato. Decida cada caso; enquanto houver pendência, o mês não fecha.</div>';
        if (!l.length) return h + '<div class="cartao vazio">Nenhuma decisão pendente.</div>';
        return h + '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Data</th><th>Paciente</th><th>Profissional</th><th>O que aconteceu</th><th>Justificativa</th><th></th></tr></thead><tbody>' + l.map(function (a) {
          return '<tr><td>' + U.dataBr(a.data) + ' ' + a.hora + '</td><td class="b">' + esc(a.paciente) + '</td><td>' + esc(a.profissional) + '</td><td><span class="selo s-ruim">' + esc(a.rotulo) + '</span></td><td class="peq">' + esc(a.justificativa || '—') + '</td>' +
            '<td><div class="linha"><button class="btn peq" data-acao="decidir" data-id="' + a.id + '" data-d="nao_cobrar">Não cobrar</button><button class="btn peq ama" data-acao="decidir" data-id="' + a.id + '" data-d="cobrar">Cobrar</button></div></td></tr>';
        }).join('') + '</tbody></table></div>';
      });
    },
    acoes: {
      decidir: function (el, ev, ctx) {
        var d = el.getAttribute('data-d');
        App.chamar('financeiro.decidir', { id: el.getAttribute('data-id'), decisao: d }, d === 'cobrar' ? 'Será cobrada.' : 'Não será cobrada.').then(function (r) { if (r) ctx.recarregar(); });
      }
    }
  });

  /* ---------- Fechamento ---------- */
  App.tela('financeiro/fechamento', {
    titulo: 'Fechamento do mês', perfis: FIN,
    render: function (ctx) {
      var c = ctx.q.mes || U.compAnterior(U.comp());
      ctx.dados.mes = c;
      return App.api('financeiro.previa', { competencia: c }).then(function (p) {
        ctx.dados.p = p;
        var pend = p.pendencias, nPend = pend.semRegistro.length + pend.semDecisao.length + pend.listasDivergentes.length;
        var totalPrev = p.porPaciente.reduce(function (s, x) { return s + x.previsto; }, 0), totalCob = p.porPaciente.reduce(function (s, x) { return s + x.cobrado; }, 0);
        var h = '<div class="linha"><label class="campo" style="flex-direction:row;align-items:center;gap:8px">Mês das sessões<select class="ent" data-muda="mes" style="width:auto">' + U.opcoesMeses(c) + '</select></label><span style="flex:1"></span>' +
          (p.fechado ? '<span class="selo s-ok" style="font-size:14px;padding:8px 14px">Mês fechado</span>' : '<button class="btn pri" data-acao="fechar"' + (p.podeFechar ? '' : ' disabled') + ' style="min-height:48px">' + I('fech', 18) + 'Fechar o mês</button>') + '</div>';
        if (!p.fechado && p.motivoNaoFecha) h += '<div class="alerta ' + (nPend ? 'a-erro' : 'a-aviso') + '">' + esc(p.motivoNaoFecha) + '</div>';
        h += '<div class="grade-cartoes"><div class="kpi"><span class="r">Previsto pelos planos</span><span class="v">' + U.moeda(totalPrev) + '</span></div>' +
          '<div class="kpi escuro"><span class="r">Sessões cobradas</span><span class="v">' + U.moeda(totalCob) + '</span></div>' +
          '<div class="kpi"><span class="r">Cobranças mensais</span><span class="v">' + U.moeda(p.totalMensal) + '</span><span class="sub">' + p.cobrancas.length + ' responsáveis · inclui avulsos e descontos</span></div>' +
          '<div class="kpi"><span class="r">Pago por sessão</span><span class="v">' + U.moeda(p.totalPorSessao) + '</span></div></div>';
        if (nPend) {
          h += '<section class="cartao"><h2>Pendências (' + nPend + ')</h2>';
          if (pend.semRegistro.length) h += '<div><b>' + pend.semRegistro.length + ' sessão(ões) sem registro na agenda</b><div class="sub peq">' + pend.semRegistro.slice(0, 12).map(function (a) { return '<a href="#/agenda?data=' + a.data + '">' + U.dataBr(a.data) + ' ' + a.hora + ' · ' + esc(a.paciente) + ' (' + esc(a.profissional) + ')</a>'; }).join(' · ') + (pend.semRegistro.length > 12 ? ' …' : '') + '</div></div>';
          if (pend.semDecisao.length) h += '<div><b>' + pend.semDecisao.length + ' falta(s) aguardando decisão</b> · <a href="#/financeiro/decisoes">Decidir agora</a></div>';
          if (pend.listasDivergentes.length) h += '<div><b>' + pend.listasDivergentes.length + ' folha(s) de presença com divergência</b> · <a href="#/presenca?mes=' + c + '">Ver folhas</a><div class="sub peq">' + pend.listasDivergentes.map(function (l) { return esc(l.paciente) + ': ' + l.divergencias.map(function (d) { return esc(d.texto); }).join(' '); }).join('<br>') + '</div></div>';
          h += '</section>';
        }
        if (pend.avisos.valoresNaoConfirmados.length || pend.avisos.listasNaoDigitalizadas) {
          h += '<div class="alerta a-aviso"><div>' + (pend.avisos.valoresNaoConfirmados.length ? pend.avisos.valoresNaoConfirmados.length + ' paciente(s) com valores ainda não conferidos: ' + pend.avisos.valoresNaoConfirmados.slice(0, 8).map(function (x) { return '<a href="#/pacientes/' + x.pacienteId + '?aba=financeiro">' + esc(x.paciente) + '</a>'; }).join(', ') + '. ' : '') +
            (pend.avisos.listasNaoDigitalizadas ? pend.avisos.listasNaoDigitalizadas + ' folha(s) de presença ainda não conferidas.' : '') + ' Não impede o fechamento.</div></div>';
        }
        h += '<nav class="abas"><button class="' + (ctx.dados.aba !== 'pac' && ctx.dados.aba !== 'rep' ? 'ativo' : '') + '" data-acao="aba" data-a="cob">Cobranças por responsável</button><button class="' + (ctx.dados.aba === 'pac' ? 'ativo' : '') + '" data-acao="aba" data-a="pac">Previsto x cobrado</button><button class="' + (ctx.dados.aba === 'rep' ? 'ativo' : '') + '" data-acao="aba" data-a="rep">Repasses</button></nav>';
        if (ctx.dados.aba === 'pac') {
          h += '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Paciente</th><th class="num">Previsto</th><th class="num">Cobrado</th><th>Não cobradas</th></tr></thead><tbody>' + p.porPaciente.map(function (x) {
            return '<tr><td class="b">' + esc(x.paciente) + '</td><td class="num">' + U.moeda(x.previsto) + '</td><td class="num b">' + U.moeda(x.cobrado) + '</td><td class="peq">' + x.naoCobradas.map(function (n) { return U.dataBr(n.data).slice(0, 5) + ' ' + esc(n.rotulo.toLowerCase()); }).join(' · ') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
        } else if (ctx.dados.aba === 'rep') {
          h += '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Profissional</th><th class="num">Sessões</th><th class="num">Base</th><th class="num">Percentual</th><th class="num">Repasse</th></tr></thead><tbody>' + p.repasses.map(function (r) {
            return '<tr><td class="b">' + esc(r.profissional) + '</td><td class="num">' + r.sessoes + '</td><td class="num">' + U.moeda(r.base) + '</td><td class="num">' + (r.percentual === null ? '—' : r.percentual + '%') + '</td><td class="num b">' + U.moeda(r.valor) + '</td></tr>';
          }).join('') + '</tbody></table></div><div class="sub">Anamnese não entra no repasse. Vencimento no dia 3 do mês seguinte.</div>';
        } else {
          h += p.cobrancas.length ? '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Responsável</th><th>Paciente(s)</th><th>Itens</th><th class="num">Total</th></tr></thead><tbody>' + p.cobrancas.map(function (g, i) {
            return '<tr class="clic" data-acao="detalhe" data-i="' + i + '"><td class="b">' + esc(g.responsavel) + '</td><td>' + esc(g.pacientes.join(', ')) + '</td><td>' + g.itens.length + '</td><td class="num b">' + U.moeda(g.total) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="cartao vazio">Nenhuma sessão cobrada neste mês.</div>';
        }
        return h;
      });
    },
    acoes: {
      mes: function (el) { location.hash = '#/financeiro/fechamento?mes=' + el.value; },
      aba: function (el, ev, ctx) { ctx.dados.aba = el.getAttribute('data-a'); var a = ctx.dados.aba; ctx.recarregar().then(function () { ctx.dados.aba = a; }); },
      detalhe: function (el, ev, ctx) {
        var g = ctx.dados.p.cobrancas[Number(el.getAttribute('data-i'))];
        App.modal({ titulo: g.responsavel, largo: true, corpo: tabelaItens(g.itens) + '<div class="linha fim"><b>Total: ' + U.moeda(g.total) + '</b></div>' });
      },
      fechar: function (el, ev, ctx) {
        App.confirmar('Fechar ' + U.nomeMes(ctx.dados.mes) + '? As cobranças serão geradas com vencimento no mês seguinte e os repasses irão para o contas a pagar. Depois disso, só o financeiro altera as sessões deste mês.', { botao: 'Fechar o mês' }).then(function (ok) {
          if (!ok) return;
          App.chamar('financeiro.fechar_mes', { competencia: ctx.dados.mes }).then(function (r) { if (r) { App.toast('Mês fechado: ' + r.cobrancas + ' cobrança(s), ' + U.moeda(r.totalCobrado) + '.', 'ok'); location.hash = '#/financeiro/cobrancas?mes=' + ctx.dados.mes; } });
        });
      }
    }
  });
  var _aba = App.telas['financeiro/fechamento'];
  var _render = _aba.render;
  _aba.render = function (ctx) { var a = App._abaFech; ctx.dados.aba = ctx.dados.aba || a; return _render(ctx); };
  _aba.acoes.aba = function (el, ev, ctx) { App._abaFech = el.getAttribute('data-a'); ctx.recarregar(); };

  function tabelaItens(itens) {
    return '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Data</th><th>Paciente</th><th>Descrição</th><th>Profissional</th><th class="num">Valor</th></tr></thead><tbody>' + itens.map(function (i) {
      return '<tr><td>' + U.dataBr(i.data) + '</td><td>' + esc(i.paciente) + '</td><td>' + esc(i.descricao) + '</td><td>' + esc(i.profissional || '') + '</td><td class="num' + (i.valor < 0 ? '" style="color:var(--verm-esc)' : '') + '">' + U.moeda(i.valor) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* ---------- Contas a receber ---------- */
  App.tela('financeiro/cobrancas', {
    titulo: 'Contas a receber', perfis: FIN,
    render: function (ctx) {
      var q = ctx.q, filtro = { status: q.status || '', competencia: q.status === 'atrasadas' ? '' : (q.mes === undefined ? U.compAnterior(U.comp()) : q.mes), busca: q.busca || '' };
      ctx.dados.f = filtro;
      return App.api('financeiro.cobrancas', filtro).then(function (l) {
        var tot = l.reduce(function (s, c) { return s + Number(c.total); }, 0), saldo = l.reduce(function (s, c) { return s + c.saldo; }, 0);
        var h = '<form class="linha" data-form="filtrar"><select class="ent" name="mes" style="width:auto"><option value="">Todos os meses</option>' + U.opcoesMeses(filtro.competencia) + '</select>' +
          '<select class="ent" name="status" style="width:auto">' + U.opcoes([{ v: '', t: 'Todas as situações' }, { v: 'aberta', t: 'Em aberto' }, { v: 'parcial', t: 'Parciais' }, { v: 'atrasadas', t: 'Atrasadas' }, { v: 'paga', t: 'Pagas' }], filtro.status) + '</select>' +
          '<input class="ent" name="busca" type="search" placeholder="Responsável ou paciente" value="' + esc(filtro.busca) + '" style="max-width:260px"><button class="btn" type="submit">Filtrar</button></form>' +
          '<div class="grade-cartoes"><div class="kpi"><span class="r">Total</span><span class="v">' + U.moeda(tot) + '</span><span class="sub">' + l.length + ' cobrança(s)</span></div><div class="kpi"><span class="r">Recebido</span><span class="v">' + U.moeda(tot - saldo) + '</span></div><div class="kpi escuro"><span class="r">Em aberto</span><span class="v">' + U.moeda(saldo) + '</span></div></div>';
        if (!l.length) return h + '<div class="cartao vazio">Nenhuma cobrança com esses filtros.</div>';
        return h + '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Responsável</th><th>Paciente(s)</th><th>Mês</th><th>Vencimento</th><th class="num">Total</th><th class="num">Saldo</th><th>Situação</th><th>Enviada</th></tr></thead><tbody>' + l.map(function (c) {
          return '<tr class="clic" data-acao="abrir" data-id="' + c.id + '"><td class="b">' + esc(c.responsavelNome) + '</td><td>' + esc(c.pacientes.join(', ')) + '</td><td>' + (c.modalidade === 'sessao' ? 'Sessão' : U.nomeMes(c.competencia)) + '</td><td>' + U.dataBr(c.vencimento) + '</td>' +
            '<td class="num">' + U.moeda(c.total) + '</td><td class="num b">' + U.moeda(c.saldo) + '</td><td>' + App.seloCobranca(c) + '</td><td>' + (c.enviadoEm ? '<span class="selo s-ok">' + U.dataBr(c.enviadoEm) + '</span>' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      });
    },
    acoes: {
      filtrar: function (f) { var d = U.dadosForm(f); location.hash = '#/financeiro/cobrancas?mes=' + encodeURIComponent(d.mes) + '&status=' + d.status + '&busca=' + encodeURIComponent(d.busca); },
      abrir: function (el) { location.hash = '#/financeiro/cobrancas/' + el.getAttribute('data-id'); }
    }
  });

  App.tela('financeiro/cobrancas/:id', {
    titulo: 'Cobrança', menu: 'financeiro/cobrancas', perfis: FIN,
    render: function (ctx) {
      return App.api('financeiro.cobranca', { id: ctx.id }).then(function (c) {
        ctx.dados.c = c;
        var aberta = c.status === 'aberta' || c.status === 'parcial';
        var h = '<div class="linha entre"><div><a class="peq" href="#/financeiro/cobrancas">← Contas a receber</a><h1>' + esc(c.responsavelNome) + '</h1><div class="sub">' + esc(c.pacientes.join(', ')) + ' · ' + (c.modalidade === 'sessao' ? 'sessão de ' + U.dataBr(c.vencimento) : U.nomeMes(c.competencia)) + '</div></div>' + App.seloCobranca(c) + '</div>' +
          '<div class="grade-cartoes"><div class="kpi"><span class="r">Total</span><span class="v">' + U.moeda(c.total) + '</span></div><div class="kpi"><span class="r">Pago</span><span class="v">' + U.moeda(c.pago) + '</span></div><div class="kpi escuro"><span class="r">Saldo</span><span class="v">' + U.moeda(c.saldo) + '</span><span class="r">Vence em ' + U.dataBr(c.vencimento) + '</span></div></div>' +
          '<div class="linha">' + (aberta && c.whatsapp ? '<button class="btn zap" data-acao="enviar">' + I('zap', 18) + 'Enviar cobrança pelo WhatsApp</button>' + (navigator.canShare ? '<button class="btn" data-acao="compartilhar">' + I('anexo', 18) + 'Enviar com a folha anexada</button>' : '') : '') +
          (!c.whatsapp ? '<span class="selo s-esp">Responsável sem telefone</span>' : '') + (Number(c.pago) > 0 ? '<button class="btn" data-acao="recibo">Emitir recibo</button>' : '') + (c.reciboAnexoId ? '<button class="btn" data-acao="verAnexo" data-id="' + c.reciboAnexoId + '">Último recibo</button>' : '') + '</div>' +
          (c.enviadoEm ? '<div class="sub">Cobrança enviada em ' + U.dataHoraBr(c.enviadoEm) + '.</div>' : '') +
          '<section class="cartao"><h2>Itens</h2>' + tabelaItens(c.itensJson || []) + '</section>';
        if (aberta) h += '<section class="cartao"><h2>Dar baixa</h2><form class="form" data-form="baixa"><label class="campo">Valor pago (R$)<input class="ent" name="valor" inputmode="decimal" required value="' + U.num(c.saldo) + '"></label>' +
          '<label class="campo">Data do pagamento<input class="ent" type="date" name="data" required value="' + U.hoje() + '"></label><label class="campo">Forma<select class="ent" name="forma">' + U.opcoes(FORMAS, c.formaPagamento || 'pix') + '</select></label>' +
          '<label class="campo">Comprovante (opcional)<input class="ent" type="file" name="_arq" accept="image/*,application/pdf"></label><div class="campo"><span>&nbsp;</span><button class="btn pri" type="submit">Registrar pagamento</button></div></form><div class="sub">Pagamento menor que o saldo fica como parcial; o restante continua em aberto.</div></section>';
        h += '<section class="cartao"><h2>Pagamentos</h2>' + (c.pagamentos.length ? '<table class="tab"><tbody>' + c.pagamentos.map(function (p) {
          return '<tr><td>' + U.dataBr(p.data) + '</td><td>' + esc((FORMAS.filter(function (f) { return f.v === p.forma; })[0] || { t: p.forma }).t) + '</td><td class="num">' + U.moeda(p.valor) + '</td><td>' + (p.status === 'confirmado' ? '<span class="selo s-ok">Confirmado</span>' : '<span class="selo s-neu">' + esc(p.status) + '</span>') + '</td>' +
            '<td><div class="linha">' + (p.comprovanteId ? '<button class="btn peq" data-acao="verAnexo" data-id="' + p.comprovanteId + '">Comprovante</button>' : '') + (p.status === 'confirmado' && p.origem !== 'credito_fechamento' ? '<button class="btn peq perigo" data-acao="estornar" data-id="' + p.id + '">Estornar</button>' : '') + '</div></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="sub">Nenhum pagamento registrado.</div>') + '</section>';
        return h;
      });
    },
    acoes: {
      baixa: function (f, ev, ctx) {
        var d = U.dadosForm(f), arq = f.querySelector('[name=_arq]').files[0];
        var antes = arq ? U.lerArquivo(arq).then(function (a) { return App.api('anexos.enviar', { tipo: 'comprovante', nome: a.nome, mime: a.mime, base64: a.base64, entidade: 'Cobrancas', entidadeId: ctx.id }); }) : Promise.resolve(null);
        return antes.then(function (an) { return App.chamar('financeiro.baixa', { cobrancaId: ctx.id, valor: U.lerNum(d.valor), data: d.data, forma: d.forma, comprovanteId: an ? an.id : '' }, 'Pagamento registrado.'); }).then(function (r) { if (r) ctx.recarregar(); });
      },
      estornar: function (el, ev, ctx) { App.confirmar('Estornar este pagamento? O valor volta para o saldo em aberto.', { campo: 'Motivo', perigo: true, botao: 'Estornar' }).then(function (m) { if (m) App.chamar('financeiro.estornar', { id: el.getAttribute('data-id'), motivo: m }, 'Pagamento estornado.').then(function (r) { if (r) ctx.recarregar(); }); }); },
      recibo: function (el, ev, ctx) { el.disabled = true; App.api('financeiro.recibo', { cobrancaId: ctx.id }).then(function (r) { U.abrir('application/pdf', r.base64); ctx.recarregar(); }, function (e) { App.toast(e.message, 'erro'); el.disabled = false; }); },
      verAnexo: function (el) { App.api('anexos.baixar', { id: el.getAttribute('data-id') }).then(function (a) { U.abrir(a.mime, a.base64); }, function (e) { App.toast(e.message, 'erro'); }); },
      enviar: function (el, ev, ctx) {
        App.api('financeiro.mensagem', { cobrancaId: ctx.id }).then(function (r) {
          var m = App.modal({ titulo: 'Mensagem de cobrança', corpo: '<label class="campo">Confira e ajuste se precisar<textarea class="ent" id="txt-cob" rows="10">' + esc(r.texto) + '</textarea></label>' + (r.links.length ? '' : '<div class="alerta a-aviso">A folha de presença deste mês ainda não foi conferida, então a mensagem vai sem o link.</div>'),
            pe: '<button class="btn" data-acao="_fechar">Cancelar</button><button class="btn zap" data-acao="abrirZap">' + I('zap', 18) + 'Abrir WhatsApp</button>',
            acoes: { abrirZap: function () { U.zap(U.zapNumero(r.whatsapp, m.el.querySelector('#txt-cob').value)); App.api('financeiro.enviada', { cobrancaId: ctx.id }).then(function () { m.fechar(); ctx.recarregar(); }); } } });
        }, function (e) { App.toast(e.message, 'erro'); });
      },
      compartilhar: function (el, ev, ctx) {
        el.disabled = true;
        App.api('financeiro.mensagem', { cobrancaId: ctx.id }).then(function (r) {
          if (!r.anexos.length) { App.toast('A folha deste mês ainda não foi conferida. Use o envio pelo WhatsApp com a mensagem.', 'erro'); el.disabled = false; return; }
          return Promise.all(r.anexos.map(function (id) { return App.api('anexos.baixar', { id: id }); })).then(function (arqs) {
            var files = arqs.map(function (a, i) { return new File([U.blobDeBase64(a.base64, a.mime)], 'folha-presenca-' + (i + 1) + (a.mime === 'application/pdf' ? '.pdf' : '.jpg'), { type: a.mime }); });
            var texto = r.texto.replace(/Folha de presença assinada:[^\n]*(\n[^\n]*https?:[^\n]*)*/, 'Folha de presença assinada em anexo.');
            if (!navigator.canShare({ files: files })) throw new Error('Este aparelho não permite compartilhar arquivos. Use o envio pelo WhatsApp.');
            return navigator.share({ files: files, text: texto }).then(function () { return App.api('financeiro.enviada', { cobrancaId: ctx.id }); }).then(function () { ctx.recarregar(); });
          });
        }).catch(function (e) { if (e && e.name !== 'AbortError') App.toast(e.message, 'erro'); el.disabled = false; });
      }
    }
  });

  /* ---------- Comprovantes ---------- */
  App.tela('financeiro/comprovantes', {
    titulo: 'Comprovantes', perfis: FIN,
    render: function (ctx) {
      return Promise.all([App.api('financeiro.pre_baixas'), App.listaPacientes()]).then(function (r) {
        ctx.dados.l = r[0]; ctx.dados.pacs = r[1];
        var h = '<section class="cartao"><h2>Enviar comprovantes</h2><div class="sub">Salve a imagem do comprovante (do grupo do WhatsApp ou do banco) e envie aqui. O sistema lê valor, data e nome e sugere a cobrança. A baixa só vale depois que você confirmar.</div>' +
          '<div class="linha"><input class="ent" type="file" id="arq-comp" accept="image/*,application/pdf" multiple style="max-width:420px"><button class="btn ama" data-acao="enviarComp">Ler comprovantes</button></div></section>';
        if (!r[0].length) return h + '<div class="cartao vazio">Nenhum comprovante aguardando conferência.</div>';
        var din = r[0].filter(function (p) { return p.forma === 'dinheiro'; });
        if (din.length) h += '<div class="alerta a-aviso">Dinheiro informado pela recepção aguardando conferência: <b>' + U.moeda(din.reduce(function (t, p) { return t + Number(p.valor || 0); }, 0)) + '</b> em ' + din.length + ' lançamento(s). Confira com o dinheiro recebido antes de confirmar.</div>';
        return h + '<h2>Aguardando conferência (' + r[0].length + ')</h2>' + r[0].map(function (p, i) {
          var l = p.leituraJson || {}, sug = l.sugestoes || [];
          return '<section class="cartao"><div class="linha entre"><div><b>' + (p.valor ? U.moeda(p.valor) : 'Valor não lido') + '</b> · ' + U.dataBr(p.data) + (p.forma === 'dinheiro' ? ' <span class="selo s-esp">Dinheiro</span>' : '') + (l.leu === false ? ' <span class="selo s-esp">Não consegui ler o texto</span>' : '') + (p.repetido ? ' <span class="selo s-ruim">Parece repetido</span>' : '') +
            (p.informadoPor ? '<div class="sub peq">Informado por ' + esc(p.informadoPor) + (p.paciente ? ' · paciente ' + esc(p.paciente) : '') + (l.observacao ? ' · ' + esc(l.observacao) : '') + '</div>' : '') + '</div>' +
            (p.comprovanteId ? '<button class="btn peq" data-acao="verAnexo" data-id="' + p.comprovanteId + '">Ver comprovante</button>' : '') + '</div>' +
            '<form class="form" data-form="confirmar" data-i="' + i + '"><label class="campo todo">Cobrança<select class="ent" name="cobrancaId">' + U.opcoes(sug.map(function (s) { return { v: s.cobrancaId, t: s.responsavel + ' · ' + s.pacientes.join(', ') + ' · ' + U.nomeMes(s.competencia) + ' · saldo ' + U.moeda(s.saldo) }; }), p.cobrancaId, sug.length ? 'Não é nenhuma destas (registrar como adiantamento)' : 'Nenhuma cobrança sugerida (registrar como adiantamento)') + '</select></label>' +
            '<label class="campo">Paciente (para adiantamento)<select class="ent" name="pacienteId">' + U.opcoes(ctx.dados.pacs.map(function (x) { return { v: x.id, t: x.nome }; }), p.pacienteId || '', '—') + '</select></label>' +
            '<label class="campo">Valor (R$)<input class="ent" name="valor" inputmode="decimal" value="' + (p.valor ? U.num(p.valor) : '') + '" required></label><label class="campo">Data<input class="ent" type="date" name="data" value="' + p.data + '" required></label>' +
            '<div class="campo todo"><div class="linha"><button class="btn pri" type="submit">Confirmar baixa</button><button class="btn perigo" type="button" data-acao="descartar" data-id="' + p.id + '">Descartar</button></div></div></form></section>';
        }).join('');
      });
    },
    acoes: {
      enviarComp: function (el, ev, ctx) {
        var arqs = Array.prototype.slice.call(document.getElementById('arq-comp').files);
        if (!arqs.length) { App.toast('Escolha o(s) arquivo(s).', 'erro'); return; }
        el.disabled = true; el.textContent = 'Lendo…';
        App.lerComprovantesReceber(arqs)
          .then(function () { App.toast('Comprovante(s) lido(s). Confira abaixo.', 'ok'); ctx.recarregar(); }, function (e) { App.toast(e.message, 'erro'); el.disabled = false; el.textContent = 'Ler comprovantes'; });
      },
      confirmar: function (f, ev, ctx) {
        var p = ctx.dados.l[Number(f.getAttribute('data-i'))], d = U.dadosForm(f);
        return App.chamar('financeiro.pre_baixa_confirmar', { id: p.id, cobrancaId: d.cobrancaId, pacienteId: d.pacienteId, valor: U.lerNum(d.valor), data: d.data }, 'Baixa confirmada.').then(function (r) { if (r) ctx.recarregar(); });
      },
      descartar: function (el, ev, ctx) { App.confirmar('Descartar esta pré-baixa? Se foi a recepção que informou, ela recebe o aviso com o motivo.', { campo: 'Motivo', botao: 'Descartar', perigo: true }).then(function (m) { if (m) App.chamar('financeiro.pre_baixa_descartar', { id: el.getAttribute('data-id'), motivo: m }, 'Descartada.').then(function (r) { if (r) ctx.recarregar(); }); }); },
      verAnexo: function (el) { App.api('anexos.baixar', { id: el.getAttribute('data-id') }).then(function (a) { U.abrir(a.mime, a.base64); }, function (e) { App.toast(e.message, 'erro'); }); }
    }
  });

  /* ---------- Repasses e NFs ---------- */
  App.tela('financeiro/repasses', {
    titulo: 'Repasses e notas fiscais', perfis: FIN,
    render: function (ctx) {
      var c = ctx.q.mes || U.compAnterior(U.comp());
      ctx.dados.mes = c;
      return App.api('repasse.listar', { competencia: c }).then(function (l) {
        ctx.dados.l = l;
        var nfs = l.filter(function (r) { return r.temNf; }).length;
        var h = '<div class="linha"><label class="campo" style="flex-direction:row;align-items:center;gap:8px">Mês das sessões<select class="ent" data-muda="mes" style="width:auto">' + U.opcoesMeses(c) + '</select></label><span style="flex:1"></span>' +
          '<button class="btn" data-acao="percentuais">Percentuais</button>' + (l.length ? '<button class="btn ' + (nfs === l.length ? 'pri' : '') + '" data-acao="enviarNfs">Enviar NFs ao escritório (' + nfs + '/' + l.length + ')</button>' : '') + '</div>';
        if (!l.length) return h + '<div class="cartao vazio">Os repasses aparecem aqui depois do fechamento do mês.</div>';
        h += '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Profissional</th><th class="num">Base</th><th class="num">%</th><th class="num">Repasse</th><th>Vencimento</th><th>Pagamento</th><th>Nota fiscal</th><th></th></tr></thead><tbody>' + l.map(function (r, i) {
          return '<tr><td class="b">' + esc(r.profissional) + '</td><td class="num">' + U.moeda(r.base) + '</td><td class="num">' + r.percentual + '%</td><td class="num b">' + U.moeda(r.valor) + '</td><td>' + U.dataBr(r.vencimento) + '</td>' +
            '<td>' + (r.contaStatus === 'paga' ? '<span class="selo s-ok">Pago</span>' : '<span class="selo s-azul">A pagar</span>') + '</td><td>' + (r.temNf ? '<span class="selo s-ok">Anexada</span>' + (r.nfEnviadaEm ? ' <span class="selo s-neu">Enviada</span>' : '') : '<span class="selo s-esp">Pendente</span>') + '</td>' +
            '<td><div class="linha"><button class="btn peq" data-acao="detalhe" data-i="' + i + '">Sessões</button>' + (r.temNf ? '<button class="btn peq" data-acao="verAnexo" data-id="' + r.nfAnexoId + '">Ver NF</button>' : '<button class="btn peq cont" data-acao="anexarNf" data-id="' + r.id + '">Anexar NF</button>') + '</div></td></tr>';
        }).join('') + '</tbody></table></div><div class="sub">O pagamento do repasse é feito no Contas a pagar. A NF é anexada pela profissional no app (ou aqui, pelo financeiro).</div>';
        return h;
      });
    },
    acoes: {
      mes: function (el) { location.hash = '#/financeiro/repasses?mes=' + el.value; },
      percentuais: function (el, ev, ctx) {
        App.api('profissionais.listar').then(function (ps) {
          ps = ps.filter(function (p) { return p.geraRepasse; });
          var m = App.modal({ titulo: 'Percentual de repasse', corpo: '<table class="tab"><tbody>' + ps.map(function (p) { return '<tr><td class="b">' + esc(p.nome) + '</td><td class="num">' + (p.percentualAtual === null ? '—' : p.percentualAtual + '%') + '</td></tr>'; }).join('') + '</tbody></table>' +
            '<form class="form" data-form="salvar"><label class="campo">Profissional<select class="ent" name="profissionalId" required>' + U.opcoes(ps.map(function (p) { return { v: p.id, t: p.nome }; }), '', 'Escolha…') + '</select></label>' +
            '<label class="campo">Novo percentual (%)<input class="ent" name="percentual" inputmode="decimal" required></label><label class="campo">Vale a partir de<input class="ent" type="date" name="vigenciaInicio" required value="' + U.comp() + '-01"></label>' +
            '<div class="campo todo"><div class="sub">Meses já fechados não mudam.</div><button class="btn pri" type="submit" style="margin-top:8px">Salvar</button></div></form>',
            acoes: { salvar: function (f) { var d = U.dadosForm(f); d.percentual = U.lerNum(d.percentual); return App.chamar('profissionais.percentual', d, 'Percentual salvo.').then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } }); } } });
        });
      },
      detalhe: function (el, ev, ctx) {
        var r = ctx.dados.l[Number(el.getAttribute('data-i'))];
        App.modal({ titulo: r.profissional + ' · ' + U.nomeMes(r.competencia), largo: true, corpo: '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Data</th><th>Paciente</th><th>Situação</th><th class="num">Valor</th></tr></thead><tbody>' + (r.detalheJson || []).map(function (d) {
          return '<tr><td>' + U.dataBr(d.data) + ' ' + (d.hora || '') + '</td><td>' + esc(d.paciente) + '</td><td>' + esc(d.rotulo) + '</td><td class="num">' + U.moeda(d.valor) + '</td></tr>';
        }).join('') + '</tbody></table></div><div class="linha fim"><b>Base ' + U.moeda(r.base) + ' × ' + r.percentual + '% = ' + U.moeda(r.valor) + '</b></div>' });
      },
      verAnexo: function (el) { App.api('anexos.baixar', { id: el.getAttribute('data-id') }).then(function (a) { U.abrir(a.mime, a.base64); }, function (e) { App.toast(e.message, 'erro'); }); },
      anexarNf: function (el, ev, ctx) { escolherNf(el.getAttribute('data-id'), function () { ctx.recarregar(); }); },
      enviarNfs: function (el, ev, ctx) {
        var faltam = ctx.dados.l.filter(function (r) { return !r.temNf; });
        var conf = faltam.length ? App.confirmar('Faltam as NFs de ' + faltam.map(function (r) { return r.profissional; }).join(', ') + '. Enviar mesmo assim só as que já chegaram?', { botao: 'Enviar as que chegaram' }) : App.confirmar('Enviar as ' + ctx.dados.l.length + ' notas fiscais de ' + U.nomeMes(ctx.dados.mes) + ' por e-mail ao escritório de contabilidade?', { botao: 'Enviar' });
        conf.then(function (ok) { if (ok) App.chamar('repasse.enviar_nfs', { competencia: ctx.dados.mes, enviarIncompleto: faltam.length > 0 }).then(function (r) { if (r) { App.toast(r.enviados + ' NF(s) enviadas para ' + r.para + '.', 'ok'); ctx.recarregar(); } }); });
      }
    }
  });
  function escolherNf(repasseId, depois) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,image/*';
    inp.onchange = function () {
      if (!inp.files[0]) return;
      App.toast('Enviando a nota…');
      U.lerArquivo(inp.files[0]).then(function (f) { return App.api('anexos.enviar', { tipo: 'nf', nome: f.nome, mime: f.mime, base64: f.base64 }); })
        .then(function (an) { return App.api('repasse.anexar_nf', { repasseId: repasseId, anexoId: an.id }); })
        .then(function () { App.toast('Nota fiscal anexada. O financeiro foi avisado.', 'ok'); depois(); }, function (e) { App.toast(e.message, 'erro'); });
    };
    inp.click();
  }

  /* ---------- Meu repasse (profissional) ---------- */
  App.tela('repasse', {
    titulo: 'Meu repasse', perfis: ['profissional'],
    render: function (ctx) {
      var c = ctx.q.mes || U.compAnterior(U.comp());
      ctx.dados.mes = c;
      return App.api('repasse.extrato', { competencia: c }).then(function (r) {
        ctx.dados.r = r;
        var h = '<div class="linha"><select class="ent" data-muda="mes" style="width:auto">' + U.opcoesMeses(c, 8) + '</select></div>' +
          '<div class="kpi escuro" style="border-radius:16px;padding:20px"><span class="r">' + (r.previa ? 'Prévia (mês ainda não fechado)' : 'Valor a receber') + '</span><span class="v" style="font-size:34px">' + U.moeda(r.valor) + '</span><span class="r">Pagamento previsto em ' + U.dataBr(r.vencimento) + '</span></div>' +
          '<div class="cartao plano"><div class="aviso-item"><span style="flex:1">Valor das sessões</span><b>' + U.moeda(r.base) + '</b></div><div class="aviso-item"><span style="flex:1">Seu percentual</span><b>' + (r.percentual === null ? '—' : r.percentual + '%') + '</b></div></div>';
        if (r.fechado && !r.temNf) h += '<div class="cartao" style="background:var(--amarelo-cl);border-color:var(--amarelo)"><div>Emita sua nota fiscal com o valor exato de <b>' + U.moeda(r.valor) + '</b> e anexe aqui.</div><button class="btn pri" data-acao="nf" style="min-height:50px">' + I('anexo', 18) + 'Anexar nota fiscal</button></div>';
        if (r.temNf) h += '<div class="alerta a-info">Nota fiscal anexada. Obrigada!</div>';
        h += '<h3>Sessões do mês</h3><div class="cartao plano">' + (r.sessoes.length ? r.sessoes.map(function (s) {
          return '<div class="aviso-item"><div style="flex:1;min-width:0"><b>' + U.dataBr(s.data).slice(0, 5) + ' ' + s.hora + '</b> · ' + esc(s.paciente) + '<div class="sub peq">' + esc(s.rotulo) + '</div></div>' + (s.entra ? '<span class="selo s-ok">Conta</span>' : '<span class="selo s-neu">Não conta</span>') + '</div>';
        }).join('') : '<div class="vazio">Nenhuma sessão neste mês.</div>') + '</div>';
        return h;
      }, function (e) { return '<div class="alerta a-aviso">' + esc(e.message) + '</div>'; });
    },
    acoes: {
      mes: function (el) { location.hash = '#/repasse?mes=' + el.value; },
      nf: function (el, ev, ctx) { escolherNf(ctx.dados.r.repasseId, function () { ctx.recarregar(); }); }
    }
  });

  /* ---------- Comprovantes de recebimento (usado pelo financeiro, pela recepção e pelo compartilhar) ---------- */
  App.lerComprovantesReceber = function (arquivos) {
    var res = [];
    return arquivos.reduce(function (p, a) {
      return p.then(function () { return U.lerArquivo(a); })
        .then(function (f) { return App.api('anexos.enviar', { tipo: 'comprovante', nome: f.nome, mime: f.mime, base64: f.base64 }); })
        .then(function (an) { return App.api('financeiro.comprovante', { anexoId: an.id }); }).then(function (r) { res.push(r); });
    }, Promise.resolve()).then(function () { return res; });
  };

  /* ---------- Recepção: registrar pagamento recebido ---------- */
  var SIT_REC = { aguardando: ['Aguardando conferência', 's-azul'], confirmado: ['Confirmado', 's-ok'], descartado: ['Não confirmado', 's-ruim'] };
  App.tela('recebimentos', {
    titulo: 'Registrar pagamento', perfis: ['secretaria'],
    render: function (ctx) {
      return Promise.all([App.api('recebimentos.meus'), App.listaPacientes()]).then(function (r) {
        var l = r[0], pacs = r[1];
        var h = '<div class="alerta a-info">Informe aqui os pagamentos recebidos na recepção. A Flávia confere e confirma; até lá eles aparecem como “Aguardando conferência”.</div>' +
          '<div class="grade-2">' +
          '<section class="cartao"><h2>Recebi em dinheiro</h2><form class="form" data-form="dinheiro">' +
          '<label class="campo todo">Paciente<select class="ent" name="pacienteId" required>' + U.opcoes(pacs.map(function (p) { return { v: p.id, t: p.nome + (p.responsavelNome ? ' — ' + p.responsavelNome : '') }; }), '', 'Escolha…') + '</select></label>' +
          '<label class="campo">Valor recebido (R$)<input class="ent" name="valor" inputmode="decimal" required></label>' +
          '<label class="campo">Data<input class="ent" type="date" name="data" required value="' + U.hoje() + '" max="' + U.hoje() + '"></label>' +
          '<label class="campo todo">Observação (opcional)<input class="ent" name="observacao" placeholder="Ex.: entregue pela avó"></label>' +
          '<div class="campo todo"><button class="btn pri" type="submit">Registrar dinheiro</button></div></form></section>' +
          '<section class="cartao"><h2>Enviar comprovante</h2><div class="sub">Pix ou transferência: salve a imagem ou o PDF do comprovante e envie. O sistema identifica de quem é.</div>' +
          '<div class="pilha" style="gap:10px;margin-top:8px"><input class="ent" type="file" id="arq-rec" accept="image/*,application/pdf" multiple><button class="btn ama" data-acao="enviar">Enviar comprovante</button></div><div id="res-rec"></div></section></div>' +
          '<h2>O que eu informei</h2>';
        if (!l.length) return h + '<div class="cartao vazio">Nada informado ainda.</div>';
        return h + '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Data</th><th>Paciente / responsável</th><th>Forma</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>' + l.map(function (x) {
          var st = SIT_REC[x.situacao] || [x.situacao, 's-neu'];
          return '<tr><td>' + U.dataBr(x.data) + '</td><td>' + (x.identificado ? esc(x.identificado) : '<span class="sub">Não identificado (a Flávia confere)</span>') + '</td><td>' + (x.tipo === 'dinheiro' ? 'Dinheiro' : 'Comprovante') + (x.repetido ? ' <span class="selo s-ruim">Parece repetido</span>' : '') + '</td>' +
            '<td class="num">' + (x.valor ? U.moeda(x.valor) : '—') + '</td><td><span class="selo ' + st[1] + '">' + st[0] + '</span></td><td>' + (x.comprovanteId ? '<button class="btn peq" data-acao="ver" data-id="' + x.comprovanteId + '">Ver</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      });
    },
    acoes: {
      dinheiro: function (f, ev, ctx) {
        var d = U.dadosForm(f); d.valor = U.lerNum(d.valor);
        if (!(d.valor > 0)) { App.toast('Informe o valor recebido.', 'erro'); return; }
        return App.chamar('recebimentos.dinheiro', d, 'Registrado. A Flávia vai conferir.').then(function (r) { if (r) ctx.recarregar(); });
      },
      enviar: function (el, ev, ctx) {
        var arqs = Array.prototype.slice.call(document.getElementById('arq-rec').files);
        if (!arqs.length) { App.toast('Escolha o comprovante.', 'erro'); return; }
        el.disabled = true; el.textContent = 'Lendo…';
        App.lerComprovantesReceber(arqs).then(function (res) {
          App.toast(res.length + ' comprovante(s) enviado(s). A Flávia vai conferir.', 'ok'); ctx.recarregar();
        }, function (e) { App.toast(e.message, 'erro'); el.disabled = false; el.textContent = 'Enviar comprovante'; });
      },
      ver: function (el) { App.api('anexos.baixar', { id: el.getAttribute('data-id') }).then(function (a) { U.abrir(a.mime, a.base64); }, function (e) { App.toast(e.message, 'erro'); }); }
    }
  });

  /* ---------- Arquivo compartilhado de outro app (ex.: app do banco no Android) ---------- */
  App.tela('compartilhado', {
    titulo: 'Comprovante recebido', perfis: ['admin', 'financeiro', 'secretaria'],
    render: function (ctx) {
      if (!('caches' in window)) return '<div class="cartao vazio">Este aparelho não guardou o arquivo. Envie pelo menu Comprovantes.</div>';
      return caches.open('giraosol-compartilhado').then(function (c) {
        return c.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return c.match(k).then(function (r) { return r.blob().then(function (b) { return new File([b], decodeURIComponent(r.headers.get('X-Nome') || 'comprovante'), { type: b.type }); }); }); })); });
      }).then(function (arqs) {
        ctx.dados.arqs = arqs;
        if (!arqs.length) return '<div class="cartao vazio">Nenhum arquivo recebido. Compartilhe o comprovante de novo a partir do app do banco.</div>';
        var fin = App.ehFin();
        return '<section class="cartao"><h2>' + arqs.length + ' arquivo(s) recebido(s)</h2><div class="sub">' + arqs.map(function (a) { return esc(a.name); }).join('<br>') + '</div></section>' +
          '<section class="cartao"><h2>Este comprovante é de…</h2><div class="pilha" style="gap:10px">' +
          (fin ? '<button class="btn pri" data-acao="destino" data-d="pagar" style="min-height:52px">Uma conta que a clínica pagou</button>' : '') +
          '<button class="btn ' + (fin ? '' : 'pri') + '" data-acao="destino" data-d="receber" style="min-height:52px">Um pagamento recebido de paciente</button>' +
          '<button class="btn" data-acao="destino" data-d="nada">Cancelar</button></div><div class="sub" style="margin-top:8px">O sistema lê o comprovante e deixa como pré-baixa para conferência. Nada recebe baixa sozinho.</div></section>';
      });
    },
    acoes: {
      destino: function (el, ev, ctx) {
        var d = el.getAttribute('data-d'), limpar = function () { return caches.delete('giraosol-compartilhado'); };
        if (d === 'nada') { limpar().then(function () { location.hash = '#/' + App.inicial(); }); return; }
        el.parentNode.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); el.textContent = 'Lendo…';
        var ir = d === 'pagar' ? App.lerComprovantesPagar(ctx.dados.arqs) : App.lerComprovantesReceber(ctx.dados.arqs);
        ir.then(limpar).then(function () {
          App.toast('Comprovante lido. Confira a pré-baixa.', 'ok');
          location.hash = d === 'pagar' ? '#/pagar/comprovantes' : (App.ehFin() ? '#/financeiro/comprovantes' : '#/recebimentos');
        }, function (e) { App.toast(e.message, 'erro'); ctx.recarregar(); });
      }
    }
  });
})();
