/* Contas a pagar: contas com filtros, parcelamento, baixa; fornecedores e categorias; recorrentes; planilha do escritório. */
(function () {
  'use strict';
  var U = App.u, I = App.icone, esc = U.esc;
  var FIN = ['admin', 'financeiro'];

  function abas(atual) {
    return '<nav class="abas">' + [['pagar', 'Contas'], ['pagar/fornecedores', 'Fornecedores e categorias'], ['pagar/recorrentes', 'Contas fixas do mês'], ['pagar/comprovantes', 'Comprovantes'], ['pagar/escritorio', 'Planilha do escritório']].map(function (a) {
      return '<a class="' + (a[0] === atual ? 'ativo' : '') + '" href="#/' + a[0] + '">' + a[1] + '</a>';
    }).join('') + '</nav>';
  }
  function carregarBase() { return Promise.all([App.api('pagar.fornecedores', {}), App.api('pagar.categorias')]); }
  function selo(c) { return c.status === 'paga' ? '<span class="selo s-ok">Paga ' + U.dataBr(c.pagoEm) + '</span>' : (c.status === 'cancelada' ? '<span class="selo s-neu">Cancelada</span>' : (c.vencida ? '<span class="selo s-ruim">Vencida</span>' : '<span class="selo s-azul">A vencer</span>')); }

  App.tela('pagar', {
    titulo: 'Contas a pagar', perfis: FIN,
    render: function (ctx) {
      var q = ctx.q, hoje = new Date(), ult = U.iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 12));
      var f = { vencDe: q.vencDe === undefined ? U.comp() + '-01' : q.vencDe, vencAte: q.vencAte === undefined ? ult : q.vencAte,
        pagoDe: q.pagoDe || '', pagoAte: q.pagoAte || '', fornecedorId: q.fornecedorId || '', categoriaId: q.categoriaId || '', situacao: q.situacao || 'todas', texto: q.texto || '' };
      ctx.dados.f = f;
      return Promise.all([App.api('pagar.contas', f), carregarBase()]).then(function (r) {
        var l = r[0].contas, t = r[0].totais; ctx.dados.forn = r[1][0]; ctx.dados.cats = r[1][1]; ctx.dados.mapa = {}; l.forEach(function (c) { ctx.dados.mapa[c.id] = c; });
        var h = abas('pagar') + '<form class="cartao" data-form="filtrar" style="gap:10px"><div class="form" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">' +
          '<label class="campo">Vencimento de<input class="ent" type="date" name="vencDe" value="' + f.vencDe + '"></label><label class="campo">até<input class="ent" type="date" name="vencAte" value="' + f.vencAte + '"></label>' +
          '<label class="campo">Pagamento de<input class="ent" type="date" name="pagoDe" value="' + f.pagoDe + '"></label><label class="campo">até<input class="ent" type="date" name="pagoAte" value="' + f.pagoAte + '"></label>' +
          '<label class="campo">Situação<select class="ent" name="situacao">' + U.opcoes([{ v: 'todas', t: 'Todas' }, { v: 'aberta', t: 'Em aberto' }, { v: 'vencida', t: 'Vencidas' }, { v: 'paga', t: 'Pagas' }, { v: 'cancelada', t: 'Canceladas' }], f.situacao) + '</select></label>' +
          '<label class="campo">Fornecedor<select class="ent" name="fornecedorId">' + U.opcoes(ctx.dados.forn.map(function (x) { return { v: x.id, t: x.nome }; }), f.fornecedorId, 'Todos') + '</select></label>' +
          '<label class="campo">Categoria<select class="ent" name="categoriaId">' + U.opcoes(ctx.dados.cats.map(function (x) { return { v: x.id, t: x.nome }; }), f.categoriaId, 'Todas') + '</select></label>' +
          '<label class="campo">Descrição ou observação<input class="ent" name="texto" type="search" value="' + esc(f.texto) + '"></label></div>' +
          '<div class="linha"><button class="btn" type="submit">Filtrar</button><button class="btn" type="button" data-acao="limpar">Limpar filtros</button><span style="flex:1"></span><button class="btn ama" type="button" data-acao="nova">' + I('mais', 18) + 'Nova conta</button></div></form>' +
          '<div class="grade-cartoes"><div class="kpi"><span class="r">Total filtrado</span><span class="v">' + U.moeda(t.total) + '</span><span class="sub">' + t.quantidade + ' conta(s)</span></div><div class="kpi"><span class="r">Pago</span><span class="v">' + U.moeda(t.pago) + '</span></div>' +
          '<div class="kpi escuro"><span class="r">A pagar</span><span class="v">' + U.moeda(t.aPagar) + '</span></div><div class="kpi"><span class="r">Vencido</span><span class="v" style="color:var(--verm-esc)">' + U.moeda(t.vencido) + '</span></div></div>';
        if (!l.length) return h + '<div class="cartao vazio">Nenhuma conta com esses filtros.</div>';
        return h + '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th>Categoria</th><th>Parcela</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>' + l.map(function (c) {
          return '<tr><td>' + U.dataBr(c.vencimento) + '</td><td class="b">' + esc(c.fornecedor) + '</td><td>' + esc(c.descricao) + (c.observacao ? '<div class="sub peq">' + esc(c.observacao) + '</div>' : '') + '</td><td class="peq">' + esc(c.categoria) + '</td><td>' + esc(c.parcela) + '</td>' +
            '<td class="num b">' + U.moeda(c.status === 'paga' ? (c.valorPago || c.valor) : c.valor) + '</td><td>' + selo(c) + '</td><td><div class="linha" style="flex-wrap:nowrap">' +
            (c.status === 'aberta' ? '<button class="btn peq pri" data-acao="baixa" data-id="' + c.id + '">Dar baixa</button><button class="btn peq" data-acao="editar" data-id="' + c.id + '">Editar</button>' : '') +
            (c.status === 'paga' ? '<button class="btn peq" data-acao="desfazer" data-id="' + c.id + '">Desfazer</button>' : '') +
            (c.anexoId ? '<button class="btn peq" data-acao="anexo" data-id="' + c.anexoId + '" aria-label="Ver anexo">' + I('anexo', 16) + '</button>' : '') + (c.comprovanteId ? '<button class="btn peq" data-acao="anexo" data-id="' + c.comprovanteId + '">Comprov.</button>' : '') +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
      });
    },
    acoes: {
      filtrar: function (f) { var d = U.dadosForm(f); location.hash = '#/pagar?' + Object.keys(d).map(function (k) { return k + '=' + encodeURIComponent(d[k]); }).join('&'); },
      limpar: function () { location.hash = '#/pagar?situacao=todas'; },
      nova: function (el, ev, ctx) { formConta(ctx, null); },
      editar: function (el, ev, ctx) { formConta(ctx, ctx.dados.mapa[el.getAttribute('data-id')]); },
      baixa: function (el, ev, ctx) {
        var c = ctx.dados.mapa[el.getAttribute('data-id')];
        var m = App.modal({ titulo: 'Dar baixa — ' + c.fornecedor, corpo: '<form class="form" data-form="ok"><label class="campo">Data do pagamento<input class="ent" type="date" name="pagoEm" required value="' + U.hoje() + '"></label>' +
          '<label class="campo">Valor pago (R$)<input class="ent" name="valorPago" inputmode="decimal" required value="' + U.num(c.valor) + '"></label><label class="campo todo">Comprovante (opcional)<input class="ent" type="file" name="_arq" accept="image/*,application/pdf"></label>' +
          (c.repasseId ? '<div class="campo todo"><div class="alerta a-aviso">Repasse: confira se a nota fiscal da profissional já foi anexada.</div></div>' : '') +
          '<div class="campo todo"><button class="btn pri" type="submit">Confirmar pagamento</button></div></form>',
          acoes: { ok: function (f) {
            var d = U.dadosForm(f), arq = f.querySelector('[name=_arq]').files[0];
            return (arq ? U.lerArquivo(arq).then(function (a) { return App.api('anexos.enviar', { tipo: 'conta', nome: a.nome, mime: a.mime, base64: a.base64, entidade: 'ContasPagar', entidadeId: c.id }); }) : Promise.resolve(null))
              .then(function (an) { return App.chamar('pagar.baixa', { id: c.id, pagoEm: d.pagoEm, valorPago: U.lerNum(d.valorPago), comprovanteId: an ? an.id : '' }, 'Baixa registrada.'); }).then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } });
          } } });
      },
      desfazer: function (el, ev, ctx) { App.confirmar('Desfazer a baixa desta conta?', { campo: 'Motivo', botao: 'Desfazer baixa', perigo: true }).then(function (mo) { if (mo) App.chamar('pagar.desfazer_baixa', { id: el.getAttribute('data-id'), motivo: mo }, 'Baixa desfeita.').then(function (r) { if (r) ctx.recarregar(); }); }); },
      anexo: function (el) { App.api('anexos.baixar', { id: el.getAttribute('data-id') }).then(function (a) { U.abrir(a.mime, a.base64); }, function (e) { App.toast(e.message, 'erro'); }); }
    }
  });

  function formConta(ctx, c) {
    var novo = !c; c = c || {};
    var m = App.modal({ titulo: novo ? 'Nova conta' : 'Editar conta', corpo: '<form class="form" data-form="salvar">' +
      '<label class="campo todo">Fornecedor<div class="linha" style="flex-wrap:nowrap"><select class="ent" name="fornecedorId" required data-muda="forn">' + U.opcoes(ctx.dados.forn.map(function (x) { return { v: x.id, t: x.nome }; }), c.fornecedorId, 'Escolha…') + '</select><button class="btn" type="button" data-acao="novoForn">Novo</button></div></label>' +
      '<label class="campo">Categoria<select class="ent" name="categoriaId">' + U.opcoes(ctx.dados.cats.map(function (x) { return { v: x.id, t: x.nome }; }), c.categoriaId, 'A do fornecedor') + '</select></label>' +
      '<label class="campo">Descrição<input class="ent" name="descricao" value="' + esc(c.descricao || '') + '"></label>' +
      '<label class="campo">' + (novo ? 'Valor total (R$)' : 'Valor (R$)') + '<input class="ent" name="valor" inputmode="decimal" required value="' + (c.valor ? U.num(c.valor) : '') + '"' + (c.repasseId ? ' disabled' : '') + '></label>' +
      '<label class="campo">' + (novo ? '1º vencimento' : 'Vencimento') + '<input class="ent" type="date" name="vencimento" required value="' + (c.vencimento || U.hoje()) + '"></label>' +
      (novo ? '<label class="campo">Parcelas<select class="ent" name="parcelas">' + U.opcoes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24].map(function (n) { return { v: n, t: n === 1 ? 'À vista' : n + 'x' }; }), 1) + '</select></label>' : '') +
      '<label class="campo todo">Observação<input class="ent" name="observacao" value="' + esc(c.observacao || '') + '"></label>' +
      '<label class="campo todo">Boleto ou nota (opcional)<input class="ent" type="file" name="_arq" accept="image/*,application/pdf"></label>' +
      '<div class="campo todo"><button class="btn pri" type="submit">Salvar</button>' + (!novo && !c.repasseId ? ' <button class="btn perigo" type="button" data-acao="cancelar">Cancelar esta conta</button>' : '') + '</div></form>',
      acoes: {
        forn: function (el) { var fo = ctx.dados.forn.filter(function (x) { return x.id === el.value; })[0]; var d = m.el.querySelector('[name=descricao]'); if (fo && !d.value) d.value = fo.nome; },
        novoForn: function () { formFornecedor(ctx, null, function (f) { ctx.dados.forn.push(f); var s = m.el.querySelector('[name=fornecedorId]'); s.insertAdjacentHTML('beforeend', '<option value="' + f.id + '">' + esc(f.nome) + '</option>'); s.value = f.id; }); },
        salvar: function (f) {
          var d = U.dadosForm(f), arq = f.querySelector('[name=_arq]').files[0];
          if (d.valor !== undefined) d.valor = U.lerNum(d.valor);
          return (arq ? U.lerArquivo(arq).then(function (a) { return App.api('anexos.enviar', { tipo: 'conta', nome: a.nome, mime: a.mime, base64: a.base64 }); }) : Promise.resolve(null)).then(function (an) {
            if (an) d.anexoId = an.id;
            if (novo) { d.parcelas = Number(d.parcelas); return App.chamar('pagar.conta_criar', d, Number(d.parcelas) > 1 ? d.parcelas + ' parcelas lançadas.' : 'Conta lançada.'); }
            d.id = c.id; return App.chamar('pagar.conta_editar', d, 'Conta atualizada.');
          }).then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } });
        },
        cancelar: function () { App.confirmar('Cancelar esta conta?', { campo: 'Motivo', perigo: true, botao: 'Cancelar conta' }).then(function (mo) { if (mo) App.chamar('pagar.conta_cancelar', { id: c.id, motivo: mo }, 'Conta cancelada.').then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } }); }); }
      } });
  }

  function formFornecedor(ctx, f, depois) {
    f = f || { ativo: true };
    var m = App.modal({ titulo: f.id ? 'Editar fornecedor' : 'Novo fornecedor', corpo: '<form class="form" data-form="salvar">' +
      '<label class="campo todo">Nome<input class="ent" name="nome" required value="' + esc(f.nome || '') + '"></label>' +
      '<label class="campo">CPF ou CNPJ<input class="ent" name="documento" value="' + esc(f.documento || '') + '"></label>' +
      '<label class="campo">Categoria<select class="ent" name="categoriaId">' + U.opcoes(ctx.dados.cats.map(function (x) { return { v: x.id, t: x.nome }; }), f.categoriaId, '—') + '</select></label>' +
      '<label class="campo">Telefone<input class="ent" name="telefone" value="' + esc(f.telefone || '') + '"></label><label class="campo">E-mail<input class="ent" name="email" type="email" value="' + esc(f.email || '') + '"></label>' +
      '<label class="campo">Chave Pix<input class="ent" name="chavePix" value="' + esc(f.chavePix || '') + '"></label><label class="campo">Observação<input class="ent" name="observacao" value="' + esc(f.observacao || '') + '"></label>' +
      '<label class="marcar campo todo"><input type="checkbox" name="ativo"' + (f.ativo !== false ? ' checked' : '') + '>Ativo</label>' +
      '<div class="campo todo"><button class="btn pri" type="submit">Salvar fornecedor</button></div></form>',
      acoes: { salvar: function (fm) { var d = U.dadosForm(fm); d.id = f.id; return App.chamar('pagar.fornecedor_salvar', d, 'Fornecedor salvo.').then(function (r) { if (r) { m.fechar(); depois(r); } }); } } });
  }

  App.tela('pagar/fornecedores', {
    titulo: 'Fornecedores e categorias', menu: 'pagar', perfis: FIN,
    render: function (ctx) {
      return Promise.all([App.api('pagar.fornecedores', { incluirInativos: true }), App.api('pagar.categorias')]).then(function (r) {
        ctx.dados.forn = r[0]; ctx.dados.cats = r[1];
        return abas('pagar/fornecedores') + '<div class="linha"><input class="ent" type="search" id="busca-forn" placeholder="Buscar fornecedor" style="max-width:320px"><span style="flex:1"></span><button class="btn" data-acao="novaCat">Nova categoria</button><button class="btn ama" data-acao="novo">' + I('mais', 18) + 'Novo fornecedor</button></div>' +
          '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Fornecedor</th><th>Categoria</th><th>CPF/CNPJ</th><th>Pix</th><th>Situação</th></tr></thead><tbody id="corpo-forn">' + linhasForn(r[0]) + '</tbody></table></div>' +
          '<section class="cartao"><h2>Categorias</h2><div class="linha">' + r[1].map(function (c) { return '<button class="btn peq" data-acao="editarCat" data-id="' + c.id + '">' + esc(c.nome) + (c.ativo === false ? ' (inativa)' : '') + '</button>'; }).join('') + '</div></section>';
      });
    },
    depois: function (ctx) {
      var b = document.getElementById('busca-forn');
      b.addEventListener('input', function () { var t = U.normal(b.value); document.getElementById('corpo-forn').innerHTML = linhasForn(ctx.dados.forn.filter(function (f) { return U.normal(f.nome).indexOf(t) >= 0; })); });
    },
    acoes: {
      novo: function (el, ev, ctx) { formFornecedor(ctx, null, function () { ctx.recarregar(); }); },
      editar: function (el, ev, ctx) { formFornecedor(ctx, ctx.dados.forn.filter(function (f) { return f.id === el.getAttribute('data-id'); })[0], function () { ctx.recarregar(); }); },
      novaCat: function (el, ev, ctx) { formCat(ctx, null); },
      editarCat: function (el, ev, ctx) { formCat(ctx, ctx.dados.cats.filter(function (c) { return c.id === el.getAttribute('data-id'); })[0]); }
    }
  });
  function linhasForn(l) {
    return l.map(function (f) { return '<tr class="clic" data-acao="editar" data-id="' + f.id + '"><td class="b">' + esc(f.nome) + '</td><td>' + esc(f.categoria) + '</td><td>' + esc(f.documento) + '</td><td>' + esc(f.chavePix) + '</td><td>' + (f.ativo === false ? '<span class="selo s-neu">Inativo</span>' : '<span class="selo s-ok">Ativo</span>') + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="vazio">Nenhum fornecedor.</td></tr>';
  }
  function formCat(ctx, c) {
    c = c || { ativo: true };
    var m = App.modal({ titulo: c.id ? 'Editar categoria' : 'Nova categoria', corpo: '<form class="form" data-form="salvar"><label class="campo todo">Nome<input class="ent" name="nome" required value="' + esc(c.nome || '') + '"></label>' + (c.id ? '<label class="marcar"><input type="checkbox" name="ativo"' + (c.ativo !== false ? ' checked' : '') + '>Ativa</label>' : '') + '<div class="campo todo"><button class="btn pri" type="submit">Salvar</button></div></form>',
      acoes: { salvar: function (f) { var d = U.dadosForm(f); d.id = c.id; if (d.ativo === undefined) d.ativo = true; return App.chamar('pagar.categoria_salvar', d, 'Categoria salva.').then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } }); } } });
  }

  App.tela('pagar/recorrentes', {
    titulo: 'Contas fixas do mês', menu: 'pagar', perfis: FIN,
    render: function (ctx) {
      return Promise.all([App.api('pagar.recorrentes'), carregarBase()]).then(function (r) {
        ctx.dados.l = r[0]; ctx.dados.forn = r[1][0]; ctx.dados.cats = r[1][1];
        return abas('pagar/recorrentes') + '<div class="alerta a-info">Contas fixas (aluguel, internet, salário, contador…) são lançadas sozinhas no dia 1 de cada mês, com o valor de referência. Ajuste o valor quando a conta chegar diferente.</div>' +
          '<div class="linha"><button class="btn ama" data-acao="nova">' + I('mais', 18) + 'Nova conta fixa</button><button class="btn" data-acao="gerar">Lançar as do mês agora</button></div>' +
          (r[0].length ? '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Fornecedor</th><th>Descrição</th><th>Dia</th><th class="num">Valor</th><th>Último mês lançado</th><th>Situação</th></tr></thead><tbody>' + r[0].map(function (x) {
            return '<tr class="clic" data-acao="editar" data-id="' + x.id + '"><td class="b">' + esc(x.fornecedor) + '</td><td>' + esc(x.descricao) + '</td><td>' + x.diaVencimento + '</td><td class="num">' + U.moeda(x.valor) + '</td><td>' + (x.ultimaCompetencia ? U.nomeMes(x.ultimaCompetencia) : '—') + '</td><td>' + (x.ativo === false ? '<span class="selo s-neu">Pausada</span>' : '<span class="selo s-ok">Ativa</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="cartao vazio">Nenhuma conta fixa cadastrada.</div>');
      });
    },
    acoes: {
      nova: function (el, ev, ctx) { formRec(ctx, null); },
      editar: function (el, ev, ctx) { formRec(ctx, ctx.dados.l.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]); },
      gerar: function (el, ev, ctx) { App.chamar('pagar.gerar_recorrentes', { competencia: U.comp() }).then(function (r) { if (r) { App.toast(r.criadas + ' conta(s) lançada(s) em ' + U.nomeMes(U.comp()) + '.', 'ok'); ctx.recarregar(); } }); }
    }
  });
  function formRec(ctx, x) {
    x = x || { ativo: true };
    var m = App.modal({ titulo: x.id ? 'Editar conta fixa' : 'Nova conta fixa', corpo: '<form class="form" data-form="salvar">' +
      '<label class="campo todo">Fornecedor<select class="ent" name="fornecedorId" required>' + U.opcoes(ctx.dados.forn.map(function (f) { return { v: f.id, t: f.nome }; }), x.fornecedorId, 'Escolha…') + '</select></label>' +
      '<label class="campo">Descrição<input class="ent" name="descricao" value="' + esc(x.descricao || '') + '"></label><label class="campo">Valor de referência (R$)<input class="ent" name="valor" inputmode="decimal" required value="' + (x.valor ? U.num(x.valor) : '') + '"></label>' +
      '<label class="campo">Dia do vencimento<input class="ent" type="number" min="1" max="31" name="diaVencimento" required value="' + (x.diaVencimento || 10) + '"></label>' +
      (x.id ? '' : '<label class="campo">Começar em<select class="ent" name="aPartirDe">' + U.opcoes([U.comp(), U.compSeguinte(U.comp())].map(function (c) { return { v: c, t: U.nomeMes(c) }; }), U.comp()) + '</select></label>') +
      '<label class="marcar campo todo"><input type="checkbox" name="ativo"' + (x.ativo !== false ? ' checked' : '') + '>Ativa</label><div class="campo todo"><button class="btn pri" type="submit">Salvar</button></div></form>',
      acoes: { salvar: function (f) { var d = U.dadosForm(f); d.id = x.id; d.valor = U.lerNum(d.valor); d.diaVencimento = Number(d.diaVencimento); return App.chamar('pagar.recorrente_salvar', d, 'Conta fixa salva.').then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } }); } } });
  }

  App.tela('pagar/escritorio', {
    titulo: 'Planilha do escritório', menu: 'pagar', perfis: FIN,
    render: function (ctx) {
      var ano = Number(ctx.q.ano) || new Date().getFullYear(), anos = [ano + 1, ano, ano - 1].filter(function (a) { return a <= new Date().getFullYear(); });
      ctx.dados.ano = ano;
      return abas('pagar/escritorio') + '<section class="cartao"><h2>Pagamentos por fornecedor</h2><div class="sub">Uma linha por fornecedor e uma coluna por mês, pela data de pagamento. Gere todo mês: o arquivo já vem com a coluna do mês novo.</div>' +
        '<div class="linha"><select class="ent" id="ano" style="width:auto">' + U.opcoes(anos.map(function (a) { return { v: a, t: String(a) }; }), ano) + '</select><button class="btn pri" data-acao="gerar">Gerar planilha (Excel)</button></div><div id="res-planilha"></div></section>';
    },
    acoes: {
      gerar: function (el, ev, ctx) {
        el.disabled = true; el.textContent = 'Gerando…';
        App.api('pagar.planilha_escritorio', { ano: Number(document.getElementById('ano').value) }).then(function (r) {
          el.disabled = false; el.textContent = 'Gerar planilha (Excel)';
          U.baixar(r.nome, r.mime, r.base64);
          var d = r.resumo, h = '<div class="alerta a-info">Arquivo "' + esc(r.nome) + '" baixado. Envie ao escritório pelo WhatsApp e anexe o arquivo na conversa.</div>' +
            (r.url ? '<div><button class="btn zap" data-acao="_zap" data-url="' + esc(r.url) + '">' + I('zap', 18) + 'Abrir WhatsApp do escritório</button></div>' : '<div class="alerta a-aviso">Cadastre o WhatsApp do escritório nas configurações para abrir a conversa daqui.</div>') +
            '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Fornecedor</th>' + d.meses.map(function (m) { return '<th class="num">' + U.MESES[m - 1].slice(0, 3) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            d.linhas.map(function (l) { return '<tr><td>' + esc(l.fornecedor) + '</td>' + l.valores.map(function (v) { return '<td class="num">' + (v ? U.num(v) : '—') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
          document.getElementById('res-planilha').innerHTML = h;
        }, function (e) { el.disabled = false; el.textContent = 'Gerar planilha (Excel)'; App.toast(e.message, 'erro'); });
      }
    }
  });
  /* ---------- Comprovantes de contas pagas (pré-baixa) ---------- */
  App.lerComprovantesPagar = function (arquivos) {
    return arquivos.reduce(function (p, a) {
      return p.then(function () { return U.lerArquivo(a); })
        .then(function (f) { return App.api('anexos.enviar', { tipo: 'conta', nome: f.nome, mime: f.mime, base64: f.base64 }); })
        .then(function (an) { return App.api('pagar.comprovante', { anexoId: an.id }); });
    }, Promise.resolve());
  };
  App.tela('pagar/comprovantes', {
    titulo: 'Comprovantes de contas pagas', menu: 'pagar', perfis: FIN,
    render: function (ctx) {
      return Promise.all([App.api('pagar.pre_baixas'), carregarBase()]).then(function (r) {
        var l = r[0]; ctx.dados.l = l; ctx.dados.forn = r[1][0]; ctx.dados.cats = r[1][1];
        var h = abas('pagar/comprovantes') + '<section class="cartao"><h2>Enviar comprovantes</h2><div class="sub">Envie o comprovante do pagamento (imagem ou PDF). No celular, dá para compartilhar direto do app do banco para o Espaço Giraosol. O sistema lê valor, data e quem recebeu e procura a conta em aberto. A baixa só vale depois da conferência.</div>' +
          '<div class="linha"><input class="ent" type="file" id="arq-pagar" accept="image/*,application/pdf" multiple style="max-width:420px"><button class="btn ama" data-acao="enviar">Ler comprovantes</button></div></section>';
        if (!l.length) return h + '<div class="cartao vazio">Nenhum comprovante aguardando conferência.</div>';
        return h + '<h2>Aguardando conferência (' + l.length + ')</h2>' + l.map(function (p, i) {
          var x = p.leituraJson || {}, sug = x.sugestoes || [];
          return '<section class="cartao"><div class="linha entre"><div><b>' + (p.valor ? U.moeda(p.valor) : 'Valor não lido') + '</b> · ' + U.dataBr(p.data) +
            (x.leu === false ? ' <span class="selo s-esp">Não consegui ler o texto</span>' : '') + (p.repetido ? ' <span class="selo s-ruim">Parece repetido</span>' : '') +
            '<div class="sub peq">Enviado por ' + esc(p.enviadoPor || '') + ' em ' + U.dataBr(p.criadoEm) + '</div></div><button class="btn peq" data-acao="ver" data-id="' + p.anexoId + '">Ver comprovante</button></div>' +
            '<form class="form" data-form="confirmar" data-i="' + i + '"><label class="campo todo">Conta em aberto<select class="ent" name="contaId" data-muda="trocaConta" data-i="' + i + '">' +
            U.opcoes(sug.map(function (c) { return { v: c.contaId, t: c.fornecedor + ' · ' + c.descricao + (c.parcela && c.parcela !== 'Única' ? ' (' + c.parcela + ')' : '') + ' · vence ' + U.dataBr(c.vencimento) + ' · ' + U.moeda(c.valor) }; }), p.contaId, 'Nenhuma destas: lançar a conta já paga') + '</select></label>' +
            '<div class="form campo todo' + (p.contaId ? ' oculto' : '') + '" id="nova-' + i + '" style="padding:0"><label class="campo">Fornecedor<select class="ent" name="fornecedorId">' + U.opcoes(ctx.dados.forn.map(function (f) { return { v: f.id, t: f.nome }; }), x.fornecedorSugeridoId || '', 'Escolha…') + '</select></label>' +
            '<label class="campo">Categoria<select class="ent" name="categoriaId">' + U.opcoes(ctx.dados.cats.map(function (c) { return { v: c.id, t: c.nome }; }), '', 'A do fornecedor') + '</select></label>' +
            '<label class="campo">Descrição<input class="ent" name="descricao" placeholder="Ex.: material de escritório"></label></div>' +
            '<label class="campo">Valor pago (R$)<input class="ent" name="valor" inputmode="decimal" required value="' + (p.valor ? U.num(p.valor) : '') + '"></label>' +
            '<label class="campo">Data do pagamento<input class="ent" type="date" name="data" required value="' + p.data + '"></label>' +
            '<div class="campo todo"><div class="linha"><button class="btn pri" type="submit">Confirmar baixa</button><button class="btn perigo" type="button" data-acao="descartar" data-id="' + p.id + '">Descartar</button></div></div></form></section>';
        }).join('');
      });
    },
    acoes: {
      enviar: function (el, ev, ctx) {
        var arqs = Array.prototype.slice.call(document.getElementById('arq-pagar').files);
        if (!arqs.length) { App.toast('Escolha o(s) arquivo(s).', 'erro'); return; }
        el.disabled = true; el.textContent = 'Lendo…';
        App.lerComprovantesPagar(arqs).then(function () { App.toast('Comprovante(s) lido(s). Confira abaixo.', 'ok'); ctx.recarregar(); }, function (e) { App.toast(e.message, 'erro'); el.disabled = false; el.textContent = 'Ler comprovantes'; });
      },
      trocaConta: function (el) { document.getElementById('nova-' + el.getAttribute('data-i')).classList.toggle('oculto', !!el.value); },
      confirmar: function (f, ev, ctx) {
        var p = ctx.dados.l[Number(f.getAttribute('data-i'))], d = U.dadosForm(f);
        var dados = { id: p.id, contaId: d.contaId || '', valor: U.lerNum(d.valor), data: d.data };
        if (!d.contaId) { if (!d.fornecedorId) { App.toast('Escolha a conta em aberto ou o fornecedor.', 'erro'); return; } dados.fornecedorId = d.fornecedorId; dados.categoriaId = d.categoriaId; dados.descricao = d.descricao; }
        return App.chamar('pagar.pre_baixa_confirmar', dados, 'Baixa confirmada.').then(function (r) { if (r) ctx.recarregar(); });
      },
      descartar: function (el, ev, ctx) { App.confirmar('Descartar este comprovante?', { botao: 'Descartar', perigo: true }).then(function (ok) { if (ok) App.chamar('pagar.pre_baixa_descartar', { id: el.getAttribute('data-id') }, 'Descartado.').then(function (r) { if (r) ctx.recarregar(); }); }); },
      ver: function (el) { App.api('anexos.baixar', { id: el.getAttribute('data-id') }).then(function (a) { U.abrir(a.mime, a.base64); }, function (e) { App.toast(e.message, 'erro'); }); }
    }
  });
})();
