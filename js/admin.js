/* Recados por WhatsApp e área da administradora: usuários, profissionais e horários, configurações, reajuste e histórico. */
(function () {
  'use strict';
  var U = App.u, I = App.icone, esc = U.esc;
  var PERFIS = [{ v: 'admin', t: 'Administradora' }, { v: 'financeiro', t: 'Financeiro' }, { v: 'secretaria', t: 'Secretária' }, { v: 'profissional', t: 'Profissional' }];

  /* ---------- Recados ---------- */
  App.tela('recados', {
    titulo: 'Recados por WhatsApp', perfis: ['admin', 'financeiro', 'secretaria'],
    render: function (ctx) {
      return App.api('pacientes.contatos').then(function (l) {
        ctx.dados.l = l;
        var rasc = U.ls.get('recado') || '';
        return '<section class="cartao"><h2>1. Escreva o recado</h2><textarea class="ent" id="txt-recado" rows="5" placeholder="Ex.: Olá, {responsavel}! Lembramos que na próxima semana a clínica estará em recesso…">' + esc(rasc) + '</textarea>' +
          '<div class="sub">Use <b>{responsavel}</b> para o primeiro nome do responsável e <b>{paciente}</b> para o nome do paciente.</div></section>' +
          '<section class="cartao"><div class="linha entre"><h2>2. Escolha os contatos</h2><span class="sub" id="cont-sel">0 selecionado(s)</span></div>' +
          '<div class="linha"><input class="ent" type="search" id="busca-rec" placeholder="Buscar" style="max-width:280px"><button class="btn peq" data-acao="todos">Marcar todos</button><button class="btn peq" data-acao="nenhum">Desmarcar</button></div>' +
          '<div class="tabela-caixa" style="max-height:420px;overflow:auto"><table class="tab"><tbody id="corpo-rec">' + linhas(l) + '</tbody></table></div></section>' +
          '<div class="linha fim"><button class="btn zap" data-acao="iniciar" style="min-height:48px">' + I('zap', 18) + 'Começar o envio</button></div>';
      });
    },
    depois: function (ctx) {
      var b = document.getElementById('busca-rec'), t = document.getElementById('txt-recado');
      b.addEventListener('input', function () { var q = U.normal(b.value); document.querySelectorAll('#corpo-rec tr').forEach(function (tr) { tr.classList.toggle('oculto', U.normal(tr.textContent).indexOf(q) < 0); }); });
      t.addEventListener('input', function () { U.ls.set('recado', t.value); });
      document.getElementById('corpo-rec').addEventListener('change', contar);
    },
    acoes: {
      todos: function () { document.querySelectorAll('#corpo-rec tr:not(.oculto) input').forEach(function (c) { c.checked = true; }); contar(); },
      nenhum: function () { document.querySelectorAll('#corpo-rec input').forEach(function (c) { c.checked = false; }); contar(); },
      iniciar: function (el, ev, ctx) {
        var txt = document.getElementById('txt-recado').value.trim();
        if (!txt) { App.toast('Escreva o recado.', 'erro'); return; }
        var sel = Array.prototype.map.call(document.querySelectorAll('#corpo-rec input:checked'), function (c) { return ctx.dados.l[Number(c.value)]; });
        if (!sel.length) { App.toast('Escolha pelo menos um contato.', 'erro'); return; }
        var i = 0;
        var m = App.modal({ titulo: 'Enviando recados', fixo: true, corpo: '', acoes: {
          abrir: function () { var c = sel[i]; U.zap(U.zapNumero(c.whatsapp, texto(c))); i++; passo(); },
          pular: function () { i++; passo(); }
        } });
        function texto(c) { return txt.replace(/\{responsavel\}/g, U.primeiroNome(c.responsavel || c.paciente)).replace(/\{paciente\}/g, c.paciente); }
        function passo() {
          if (i >= sel.length) { m.corpo('<div class="alerta a-info">Pronto! ' + sel.length + ' conversa(s) abertas.</div><div class="linha fim"><button class="btn pri" data-acao="_fechar">Fechar</button></div>'); return; }
          var c = sel[i];
          m.corpo('<div class="sub">' + (i + 1) + ' de ' + sel.length + '</div><h3>' + esc(c.responsavel || c.paciente) + '</h3><div class="sub">' + esc(c.paciente) + ' · ' + esc(c.telefone) + '</div>' +
            '<div class="alerta a-info" style="white-space:pre-wrap">' + esc(texto(c)) + '</div><div class="sub peq">O WhatsApp abre com a mensagem pronta. Toque em enviar e volte aqui para o próximo.</div>' +
            '<div class="linha fim"><button class="btn" data-acao="pular">Pular</button><button class="btn zap" data-acao="abrir" style="min-height:48px">' + I('zap', 18) + 'Abrir WhatsApp</button></div>');
        }
        passo();
      }
    }
  });
  function linhas(l) {
    if (!l.length) return '<tr><td class="vazio">Nenhum contato com telefone cadastrado.</td></tr>';
    return l.map(function (c, i) { return '<tr><td style="width:40px"><input type="checkbox" value="' + i + '" aria-label="Selecionar ' + esc(c.paciente) + '" style="width:19px;height:19px;accent-color:var(--verde)"></td><td class="b">' + esc(c.responsavel || '—') + '</td><td>' + esc(c.paciente) + '</td><td>' + esc(c.telefone) + '</td></tr>'; }).join('');
  }
  function contar() { var n = document.querySelectorAll('#corpo-rec input:checked').length; var e = document.getElementById('cont-sel'); if (e) e.textContent = n + ' selecionado(s)'; }

  /* ---------- Usuários ---------- */
  function mostrarSenha(nome, usuario, senha) {
    App.modal({ titulo: 'Senha provisória', corpo: '<div class="alerta a-aviso">Anote e entregue pessoalmente. Ela aparece só agora; no primeiro acesso a pessoa cria a própria senha.</div>' +
      '<div class="cartao" style="text-align:center"><div class="sub">' + esc(nome) + ' · usuário <b>' + esc(usuario) + '</b></div><div style="font-family:monospace;font-size:30px;font-weight:700;letter-spacing:.08em">' + esc(senha) + '</div></div>', pe: '<button class="btn pri" data-acao="_fechar">Anotei</button>' });
  }
  App.tela('admin/usuarios', {
    titulo: 'Usuários', perfis: ['admin'],
    render: function (ctx) {
      return App.api('admin.usuarios').then(function (l) {
        ctx.dados.l = l;
        return '<div class="linha"><span class="sub" style="flex:1">' + l.length + ' acessos. Quem errar a senha várias vezes fica bloqueado até você gerar uma senha provisória.</span><button class="btn ama" data-acao="novo">' + I('mais', 18) + 'Novo usuário</button></div>' +
          '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Profissional</th><th>Situação</th><th></th></tr></thead><tbody>' + l.map(function (u) {
            var sit = u.ativo === false ? '<span class="selo s-neu">Desativado</span>' : (u.bloqueado ? '<span class="selo s-ruim">Bloqueado</span>' : (u.trocarSenha ? '<span class="selo s-esp">Aguardando 1º acesso</span>' : '<span class="selo s-ok">Ativo</span>'));
            return '<tr><td class="b">' + esc(u.nome) + '</td><td>' + esc(u.usuario) + '</td><td>' + esc((PERFIS.filter(function (p) { return p.v === u.perfil; })[0] || {}).t) + '</td><td>' + esc(u.profissionalNome || '—') + '</td><td>' + sit + '</td>' +
              '<td><div class="linha"><button class="btn peq" data-acao="editar" data-id="' + u.id + '">Editar</button><button class="btn peq ' + (u.bloqueado ? 'ama' : '') + '" data-acao="senha" data-id="' + u.id + '">' + (u.bloqueado ? 'Desbloquear' : 'Senha provisória') + '</button></div></td></tr>';
          }).join('') + '</tbody></table></div>';
      });
    },
    acoes: {
      novo: function (el, ev, ctx) { formUsuario(ctx, null); },
      editar: function (el, ev, ctx) { formUsuario(ctx, ctx.dados.l.filter(function (u) { return u.id === el.getAttribute('data-id'); })[0]); },
      senha: function (el, ev, ctx) {
        var u = ctx.dados.l.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
        App.confirmar('Gerar uma senha provisória para ' + u.nome + '? A senha atual deixa de valer e a digital é desativada.', { botao: 'Gerar senha' }).then(function (ok) {
          if (ok) App.chamar('admin.senha_provisoria', { id: u.id }).then(function (r) { if (r) { mostrarSenha(u.nome, u.usuario, r.senhaProvisoria); ctx.recarregar(); } });
        });
      }
    }
  });
  function formUsuario(ctx, u) {
    var novo = !u; u = u || { perfil: 'profissional', ativo: true };
    var m = App.modal({ titulo: novo ? 'Novo usuário' : 'Editar usuário', corpo: '<form class="form" data-form="salvar">' +
      '<label class="campo">Nome<input class="ent" name="nome" required value="' + esc(u.nome || '') + '"></label>' +
      '<label class="campo">Usuário (login)<input class="ent" name="usuario" required autocapitalize="none" value="' + esc(u.usuario || '') + '"><small>Letras minúsculas, sem espaço. Ex.: carol</small></label>' +
      '<label class="campo">Perfil<select class="ent" name="perfil">' + U.opcoes(PERFIS, u.perfil) + '</select></label>' +
      '<label class="campo">Profissional ligada<select class="ent" name="profissionalId">' + U.opcoes(App.profissionais().map(function (p) { return { v: p.id, t: p.nome + ' · ' + p.especialidade }; }), u.profissionalId, 'Nenhuma') + '</select><small>Obrigatória para perfil Profissional. Para quem também atende (ex.: Paula).</small></label>' +
      (novo ? '' : '<label class="marcar campo todo"><input type="checkbox" name="ativo"' + (u.ativo !== false ? ' checked' : '') + '>Acesso ativo</label>') +
      '<div class="campo todo"><button class="btn pri" type="submit">' + (novo ? 'Criar e gerar senha' : 'Salvar') + '</button></div></form>',
      acoes: { salvar: function (f) {
        var d = U.dadosForm(f); d.id = u.id;
        return App.chamar(novo ? 'admin.usuario_criar' : 'admin.usuario_editar', d, novo ? null : 'Usuário salvo.').then(function (r) {
          if (!r) return; m.fechar(); ctx.recarregar(); if (novo) mostrarSenha(r.usuario.nome, r.usuario.usuario, r.senhaProvisoria);
        });
      } } });
  }

  /* ---------- Profissionais e horários ---------- */
  var DIAS = [1, 2, 3, 4, 5, 6];
  App.tela('admin/profissionais', {
    titulo: 'Profissionais e horários', perfis: ['admin'],
    render: function (ctx) {
      return App.api('profissionais.listar').then(function (l) {
        App.estado.profissionais = l; ctx.dados.l = l;
        return '<div class="linha"><span class="sub" style="flex:1">A grade define os horários em que a agenda aceita sessões de cada profissional.</span><button class="btn ama" data-acao="nova">' + I('mais', 18) + 'Nova profissional</button></div>' +
          '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Profissional</th><th>Especialidade</th><th>Financeiro</th><th class="num">Repasse</th><th>Extrato no app</th><th>Horários</th><th></th></tr></thead><tbody>' + l.map(function (p) {
            return '<tr><td class="b">' + esc(p.nome) + (p.fazAnamnese ? ' <span class="selo s-azul">anamnese</span>' : '') + (p.ativo ? '' : ' <span class="selo s-neu">inativa</span>') + '</td><td>' + esc(p.especialidade) + '</td><td>' + (p.entraFinanceiro ? 'Sim' : 'Só agenda') + '</td>' +
              '<td class="num">' + (p.geraRepasse ? (p.percentualAtual === null ? '—' : p.percentualAtual + '%') : 'Sem repasse') + '</td><td>' + (p.geraRepasse ? (p.extratoAtivo ? 'Ligado' : 'Desligado') : '—') + '</td><td class="peq">' + resumoGrade(p.grade) + '</td>' +
              '<td><button class="btn peq" data-acao="editar" data-id="' + p.id + '">Editar</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      });
    },
    acoes: {
      nova: function (el, ev, ctx) { formProf(ctx, null); },
      editar: function (el, ev, ctx) { formProf(ctx, ctx.dados.l.filter(function (p) { return p.id === el.getAttribute('data-id'); })[0]); }
    }
  });
  function resumoGrade(g) {
    if (!g) return '—';
    return DIAS.filter(function (d) { return (g[d] || []).length; }).map(function (d) { return U.DIAS_C[d] + ' ' + g[d].map(function (p) { return p[0] + '–' + p[1]; }).join(', '); }).join('<br>');
  }
  function formProf(ctx, p) {
    var novo = !p; p = p || { ativo: true, entraFinanceiro: true, geraRepasse: true, extratoAtivo: true, especialidade: 'Fonoaudiologia', grade: { 1: [['07:15', '11:45'], ['13:15', '17:45']], 2: [['07:15', '11:45'], ['13:15', '17:45']], 3: [['07:15', '11:45'], ['13:15', '17:45']], 4: [['07:15', '11:45'], ['13:15', '17:45']], 5: [['07:15', '12:30']] } };
    var g = p.grade || {};
    var linhaDia = function (d) { var per = g[d] || []; var m = per[0] || ['', ''], t = per[1] || ['', '']; return '<tr><td class="b">' + U.DIAS[d] + '</td><td><input class="ent" type="time" name="m' + d + 'i" value="' + m[0] + '" aria-label="Manhã início"></td><td><input class="ent" type="time" name="m' + d + 'f" value="' + m[1] + '" aria-label="Manhã fim"></td><td><input class="ent" type="time" name="t' + d + 'i" value="' + t[0] + '" aria-label="Tarde início"></td><td><input class="ent" type="time" name="t' + d + 'f" value="' + t[1] + '" aria-label="Tarde fim"></td></tr>'; };
    var m = App.modal({ titulo: novo ? 'Nova profissional' : p.nome, largo: true, corpo: '<form class="pilha" data-form="salvar">' +
      '<div class="form"><label class="campo">Nome<input class="ent" name="nome" required value="' + esc(p.nome || '') + '"></label><label class="campo">Especialidade<input class="ent" name="especialidade" value="' + esc(p.especialidade || '') + '"></label>' +
      '<label class="campo">CPF/CNPJ<input class="ent" name="documento" value="' + esc(p.documento || '') + '"></label><label class="campo">Chave Pix<input class="ent" name="chavePix" value="' + esc(p.chavePix || '') + '"></label></div>' +
      '<div class="linha"><label class="marcar"><input type="checkbox" name="entraFinanceiro"' + (p.entraFinanceiro ? ' checked' : '') + '>Sessões cobradas pela clínica</label><label class="marcar"><input type="checkbox" name="geraRepasse"' + (p.geraRepasse ? ' checked' : '') + '>Recebe repasse</label>' +
      '<label class="marcar"><input type="checkbox" name="fazAnamnese"' + (p.fazAnamnese ? ' checked' : '') + '>Faz anamnese</label><label class="marcar"><input type="checkbox" name="extratoAtivo"' + (p.extratoAtivo !== false ? ' checked' : '') + '>Extrato do repasse no app</label><label class="marcar"><input type="checkbox" name="ativo"' + (p.ativo !== false ? ' checked' : '') + '>Ativa</label></div>' +
      '<h3>Horários de atendimento</h3><div class="tabela-caixa"><table class="tab"><thead><tr><th>Dia</th><th>Manhã: início</th><th>Manhã: fim</th><th>Tarde: início</th><th>Tarde: fim</th></tr></thead><tbody>' + DIAS.map(linhaDia).join('') + '</tbody></table></div>' +
      '<div class="sub">Deixe em branco os períodos sem atendimento. Sessões de 45 minutos precisam terminar até o horário de fim.</div>' +
      (!novo && p.geraRepasse ? '<h3>Percentual de repasse</h3><div class="sub">Atual: ' + (p.percentualAtual === null ? '—' : p.percentualAtual + '%') + '</div><div class="form"><label class="campo">Novo percentual (%)<input class="ent" name="_pct" inputmode="decimal"></label><label class="campo">Vale a partir de<input class="ent" type="date" name="_pctData" value="' + U.comp() + '-01"></label></div>' : '') +
      '<div class="linha fim"><button class="btn pri" type="submit">Salvar</button></div></form>',
      acoes: { salvar: function (f) {
        var d = U.dadosForm(f), grade = {};
        DIAS.forEach(function (x) { var per = []; if (d['m' + x + 'i'] && d['m' + x + 'f']) per.push([d['m' + x + 'i'], d['m' + x + 'f']]); if (d['t' + x + 'i'] && d['t' + x + 'f']) per.push([d['t' + x + 'i'], d['t' + x + 'f']]); if (per.length) grade[x] = per; });
        var dados = { id: p.id, nome: d.nome, especialidade: d.especialidade, documento: d.documento, chavePix: d.chavePix, entraFinanceiro: d.entraFinanceiro, geraRepasse: d.geraRepasse, fazAnamnese: d.fazAnamnese, extratoAtivo: d.extratoAtivo, ativo: d.ativo, grade: grade, fornecedorId: p.fornecedorId };
        return App.chamar('profissionais.salvar', dados, 'Profissional salva.').then(function (r) {
          if (!r) return;
          var pct = d._pct ? U.lerNum(d._pct) : null;
          return (pct ? App.chamar('profissionais.percentual', { profissionalId: r.id, percentual: pct, vigenciaInicio: d._pctData }, 'Percentual atualizado.') : Promise.resolve(true)).then(function () { m.fechar(); ctx.recarregar(); });
        });
      } } });
  }

  /* ---------- Configurações ---------- */
  App.tela('admin/configuracoes', {
    titulo: 'Configurações', perfis: ['admin'],
    render: function (ctx) {
      return App.api('admin.configuracoes').then(function (c) {
        ctx.dados.c = c;
        var ct = c.contratada || {}, rs = c.reajusteSugerido;
        var campo = function (r, n, v, t, x) { return '<label class="campo' + (x ? ' todo' : '') + '">' + r + '<input class="ent" name="' + n + '" type="' + (t || 'text') + '" value="' + esc(v === null || v === undefined ? '' : v) + '"></label>'; };
        return '<form class="pilha" data-form="salvar" style="gap:16px">' +
          '<section class="cartao"><h2>Dados de pagamento (mensagens de cobrança)</h2><div class="form">' + campo('Chave Pix', 'chavePix', c.chavePix) + campo('Link de pagamento por cartão', 'linkCartao', c.linkCartao, 'url') + '</div></section>' +
          '<section class="cartao"><h2>Valores padrão</h2><div class="form">' + campo('Sessão (R$)', 'valorSessao', U.num(c.valorSessao)) + campo('Anamnese (R$)', 'valorAnamnese', U.num(c.valorAnamnese)) + campo('Dia de vencimento dos pacientes', 'diaVencimento', c.diaVencimento, 'number') + campo('Dia do repasse', 'diaRepasse', c.diaRepasse, 'number') + '</div><div class="sub">Valem para pacientes novos. Para mudar de todos, use o reajuste abaixo.</div></section>' +
          '<section class="cartao"><h2>E-mails e WhatsApp</h2><div class="form">' + campo('E-mail da clínica (recebe as respostas)', 'emailClinica', c.emailClinica, 'email') + campo('E-mail do escritório de contabilidade', 'emailEscritorio', c.emailEscritorio, 'email') + campo('WhatsApp do escritório', 'whatsappEscritorio', c.whatsappEscritorio, 'tel') + '</div></section>' +
          '<section class="cartao"><h2>Opções</h2><label class="marcar"><input type="checkbox" name="presencaPelasProfissionais"' + (c.presencaPelasProfissionais ? ' checked' : '') + '>Profissionais podem registrar a presença pelo app</label>' +
          '<label class="marcar"><input type="checkbox" name="extratoRepasseAtivo"' + (c.extratoRepasseAtivo !== false ? ' checked' : '') + '>Extrato do repasse visível no app das profissionais</label></section>' +
          '<section class="cartao"><h2>Mensagem de cobrança</h2><textarea class="ent" name="mensagemCobranca" rows="8">' + esc(c.mensagemCobranca) + '</textarea><div class="sub">Campos: {responsavel} {paciente} {mes} {valor} {vencimento} {pix} {linkCartao} {linkFolha}</div></section>' +
          '<section class="cartao"><h2>Dados do contrato</h2><div class="form">' + campo('Razão social', 'ct.razaoSocial', ct.razaoSocial, 'text', 1) + campo('CNPJ', 'ct.cnpj', ct.cnpj) + campo('Cidade', 'ct.cidade', ct.cidade) + campo('Endereço', 'ct.endereco', ct.endereco, 'text', 1) +
          campo('Representante', 'ct.representante', ct.representante) + campo('Qualificação da representante', 'ct.representanteQualificacao', ct.representanteQualificacao, 'text', 1) + campo('Testemunha', 'ct.testemunha1Nome', ct.testemunha1Nome) + campo('CPF da testemunha', 'ct.testemunha1Cpf', ct.testemunha1Cpf) + '</div></section>' +
          '<div class="linha fim"><button class="btn pri" type="submit" style="min-width:200px">Salvar configurações</button></div></form>' +
          '<section class="cartao"><h2>Recesso</h2><div class="sub">Lance os períodos em que a clínica fecha. As sessões do período ficam como canceladas pela clínica.</div><div><button class="btn" data-acao="recesso">Lançar ou ver recessos</button></div></section>' +
          '<section class="cartao"><h2>Reajuste anual (IGP-M)</h2>' + (rs ? '<div class="alerta ' + (rs.aplicado ? 'a-info' : 'a-aviso') + '">IGP-M de ' + esc(rs.periodo) + ': ' + String(rs.igpm).replace('.', ',') + '%.' + (rs.aplicado ? ' Aplicado ' + String(rs.percentualAplicado).replace('.', ',') + '% a partir de ' + U.dataBr(rs.vigenciaInicio) + '.' : ' Ainda não aplicado.') + '</div>' : '<div class="sub">Em janeiro o sistema consulta o IGP-M automaticamente.</div>') +
          '<div class="form"><div class="campo"><span>&nbsp;</span><button class="btn" data-acao="consultar">Consultar IGP-M agora</button></div><label class="campo">Percentual a aplicar (%)<input class="ent" id="pct-reaj" inputmode="decimal" value="' + (rs && !rs.aplicado ? String(rs.percentual).replace('.', ',') : '') + '"></label>' +
          '<label class="campo">A partir de<input class="ent" type="date" id="vig-reaj" value="' + new Date().getFullYear() + '-01-01"></label><div class="campo"><span>&nbsp;</span><button class="btn ama" data-acao="aplicar">Aplicar reajuste</button></div></div></section>';
      });
    },
    acoes: {
      salvar: function (f) {
        var d = U.dadosForm(f), out = {}, ct = {};
        Object.keys(d).forEach(function (k) { if (k === 'ct') return; out[k] = d[k]; });
        Object.keys(d.ct || {}).forEach(function (k) { ct[k] = d.ct[k]; });
        out.contratada = ct; out.valorSessao = U.lerNum(out.valorSessao); out.valorAnamnese = U.lerNum(out.valorAnamnese); out.diaVencimento = Number(out.diaVencimento); out.diaRepasse = Number(out.diaRepasse);
        return App.chamar('admin.configuracoes_salvar', out, 'Configurações salvas.');
      },
      recesso: function (el, ev, ctx) { App.abrirBloqueios(ctx); },
      consultar: function (el, ev, ctx) { el.disabled = true; App.chamar('admin.reajuste_consultar').then(function (r) { if (r) ctx.recarregar(); else el.disabled = false; }); },
      aplicar: function (el, ev, ctx) {
        var pct = U.lerNum(document.getElementById('pct-reaj').value), vig = document.getElementById('vig-reaj').value;
        if (!(pct >= 0)) { App.toast('Informe o percentual.', 'erro'); return; }
        App.confirmar('Reajustar em ' + String(pct).replace('.', ',') + '% os valores de todos os pacientes ativos a partir de ' + U.dataBr(vig) + '?', { botao: 'Aplicar' }).then(function (ok) {
          if (ok) App.chamar('admin.reajuste_aplicar', { percentual: pct, vigenciaInicio: vig }).then(function (r) { if (r) { App.toast(r.pacientes + ' paciente(s) reajustados. Sessão padrão: ' + U.moeda(r.valorSessaoPadrao) + '.', 'ok'); ctx.recarregar(); } });
        });
      }
    }
  });

  /* ---------- Histórico ---------- */
  App.tela('admin/historico', {
    titulo: 'Histórico', perfis: ['admin'],
    render: function (ctx) {
      var q = ctx.q;
      return Promise.all([App.api('admin.historico', { usuarioId: q.u || '', de: q.de || '', ate: q.ate || '', acao: q.acao || '', limite: 300 }), App.api('admin.usuarios')]).then(function (r) {
        var nomes = {}; r[1].forEach(function (u) { nomes[u.id] = u.nome; });
        return '<form class="linha" data-form="filtrar"><select class="ent" name="u" style="width:auto">' + U.opcoes(r[1].map(function (u) { return { v: u.id, t: u.nome }; }), q.u, 'Todas as pessoas') + '</select>' +
          '<input class="ent" type="date" name="de" value="' + esc(q.de || '') + '" style="width:auto" aria-label="De"><input class="ent" type="date" name="ate" value="' + esc(q.ate || '') + '" style="width:auto" aria-label="Até">' +
          '<select class="ent" name="acao" style="width:auto">' + U.opcoes([{ v: 'auth', t: 'Acessos' }, { v: 'agenda', t: 'Agenda' }, { v: 'paciente', t: 'Pacientes' }, { v: 'queixa', t: 'Queixa' }, { v: 'financeiro', t: 'Financeiro' }, { v: 'pagar', t: 'Contas a pagar' }, { v: 'repasse', t: 'Repasses' }, { v: 'admin', t: 'Administração' }], q.acao, 'Todas as ações') + '</select>' +
          '<button class="btn" type="submit">Filtrar</button><span style="flex:1"></span><button class="btn cont" type="button" data-acao="verificar">Verificar integridade</button></form>' +
          '<div class="tabela-caixa"><table class="tab"><thead><tr><th>#</th><th>Quando</th><th>Pessoa</th><th>Ação</th><th>Registro</th><th>Detalhe</th></tr></thead><tbody>' + r[0].map(function (h) {
            var det = h.depoisJson ? JSON.stringify(h.depoisJson) : '';
            return '<tr><td>' + h.seq + '</td><td>' + U.dataHoraBr(h.quando) + '</td><td>' + esc(h.usuarioNome) + '</td><td>' + esc(h.acao) + '</td><td class="peq">' + esc(h.entidade) + '</td><td class="peq" style="max-width:420px;word-break:break-word">' + esc(det.length > 160 ? det.slice(0, 160) + '…' : det) + '</td></tr>';
          }).join('') + '</tbody></table></div><div class="sub">Mostrando os ' + r[0].length + ' registros mais recentes.</div>';
      });
    },
    acoes: {
      filtrar: function (f) { var d = U.dadosForm(f); location.hash = '#/admin/historico?u=' + d.u + '&de=' + d.de + '&ate=' + d.ate + '&acao=' + d.acao; },
      verificar: function () { App.chamar('admin.verificar_historico').then(function (r) { if (!r) return; App.toast(r.ok ? 'Histórico íntegro: ' + r.total + ' registros conferidos.' : 'Atenção: problema no registro ' + r.seq + ' (' + r.motivo + ').', r.ok ? 'ok' : 'erro'); }); }
    }
  });
})();
