/* Agenda: visão do dia e da semana, seleção de profissionais, registro da sessão, agendamentos, recesso e ausências. */
(function () {
  'use strict';
  var U = App.u, I = App.icone, esc = U.esc;
  var ROT = { excluida: 'Excluída', agendada: 'Aguardando registro', realizada: 'Realizada', falta_sem_aviso: 'Falta sem aviso', cancel_menos_24h: 'Cancelamento com menos de 24h', atraso_30: 'Atraso acima de 30 min',
    falta_atestado: 'Falta com atestado', cancelada_aviso: 'Cancelada com aviso de 24h ou mais', remarcada: 'Remarcada', cancelada_clinica: 'Cancelada pela clínica', abonada: 'Abonada' };
  var CURTO = { agendada: 'Aguardando', realizada: 'Realizada', falta_sem_aviso: 'Falta', cancel_menos_24h: 'Cancel. < 24h', atraso_30: 'Atraso', falta_atestado: 'Atestado', cancelada_aviso: 'Cancelada', remarcada: 'Remarcada', cancelada_clinica: 'Cancel. clínica', abonada: 'Abonada' };
  var ORDEM = ['realizada', 'falta_sem_aviso', 'cancel_menos_24h', 'atraso_30', 'falta_atestado', 'cancelada_aviso', 'remarcada', 'cancelada_clinica', 'abonada', 'agendada'];
  var PADRAO = ['07:15', '08:00', '08:45', '09:30', '10:15', '11:00', '11:45', '13:15', '14:00', '14:45', '15:30', '16:15', '17:00'];
  App.ROTULO_STATUS = ROT;

  function ativas() { return App.profissionais().filter(function (p) { return p.ativo; }); }
  function selecionadas() {
    var s = U.ls.get('agendaProfs'), ids = ativas().map(function (p) { return p.id; });
    if (!s || !s.length) return ids;
    s = s.filter(function (id) { return ids.indexOf(id) >= 0; });
    return s.length ? s : ids;
  }
  function segunda(iso) { var d = U.diaSemana(iso); return U.somarDias(iso, d === 0 ? -6 : 1 - d); }

  App.tela('agenda', {
    titulo: 'Agenda', perfis: ['admin', 'financeiro', 'secretaria'],
    render: function (ctx) {
      var data = ctx.q.data || U.ls.get('agendaData') || U.hoje();
      if (ctx.q.data) U.ls.set('agendaData', data);
      var visao = U.ls.get('agendaVisao') || 'dia';
      var sel = selecionadas();
      var de = visao === 'dia' ? data : segunda(data), ate = visao === 'dia' ? data : U.somarDias(de, 5);
      ctx.dados.data = data; ctx.dados.visao = visao;
      return App.api('agenda.listar', { de: de, ate: ate, profissionalIds: sel }).then(function (r) {
        ctx.dados.mapa = {}; r.atendimentos.forEach(function (a) { ctx.dados.mapa[a.id] = a; });
        var profs = ativas().filter(function (p) { return sel.indexOf(p.id) >= 0; });
        var rotulo = visao === 'dia' ? U.dataLonga(data) : 'Semana de ' + U.dataBr(de) + ' a ' + U.dataBr(ate);
        var cont = {}; r.atendimentos.forEach(function (a) { cont[a.status] = (cont[a.status] || 0) + 1; });
        var h = '<div class="agenda-barra">' +
          '<button class="btn icone" data-acao="mover" data-n="-1" aria-label="Anterior">' + I('ant') + '</button>' +
          '<button class="btn" data-acao="hoje">Hoje</button>' +
          '<button class="btn icone" data-acao="mover" data-n="1" aria-label="Próximo">' + I('prox') + '</button>' +
          '<input class="ent" type="date" value="' + data + '" data-muda="irData" aria-label="Escolher data" style="width:auto">' +
          '<div class="seg" role="group" aria-label="Visão"><button class="' + (visao === 'dia' ? 'ativo' : '') + '" data-acao="visao" data-v="dia">Dia</button><button class="' + (visao === 'semana' ? 'ativo' : '') + '" data-acao="visao" data-v="semana">Semana</button></div>' +
          '<div class="seletor"><button class="btn" data-acao="abrirSeletor" aria-expanded="false">' + I('pacientes', 18) + 'Profissionais: ' + (sel.length === ativas().length ? 'todas' : sel.length) + '</button><div class="seletor-painel oculto" id="painel-prof"></div></div>' +
          '<span style="flex:1"></span>' +
          '<button class="btn" data-acao="bloqueios">Recesso e ausências</button>' +
          '<button class="btn ama" data-acao="novo">' + I('mais', 18) + 'Novo agendamento</button></div>' +
          '<div class="linha entre"><div class="data" style="font-family:var(--f-titulo);font-size:20px;font-weight:600">' + rotulo + '</div>' +
          '<div class="sub">' + r.atendimentos.length + ' sessões · ' + (cont.realizada || 0) + ' realizadas · ' + (cont.agendada || 0) + ' aguardando registro</div></div>';
        r.bloqueios.forEach(function (b) { h += '<div class="alerta a-aviso">' + (b.tipo === 'recesso' ? 'Recesso' : 'Ausência de ' + esc((App.prof(b.profissionalId) || {}).nome || '')) + ' de ' + U.dataBr(b.inicio) + ' a ' + U.dataBr(b.fim) + (b.motivo ? ' — ' + esc(b.motivo) : '') + '</div>'; });
        h += visao === 'dia' ? gradeDia(r.atendimentos, profs) : gradeSemana(r.atendimentos, de, profs);
        h += legenda();
        return h;
      });
    },
    acoes: {
      mover: function (el, ev, ctx) { var n = Number(el.getAttribute('data-n')) * (ctx.dados.visao === 'dia' ? 1 : 7); var d = U.somarDias(ctx.dados.data, n); if (ctx.dados.visao === 'dia' && U.diaSemana(d) === 0) d = U.somarDias(d, n > 0 ? 1 : -2); ir(d); },
      hoje: function () { ir(U.hoje()); },
      irData: function (el) { if (el.value) ir(el.value); },
      visao: function (el, ev, ctx) { U.ls.set('agendaVisao', el.getAttribute('data-v')); ctx.recarregar(); },
      abrirSeletor: function (el) { abrirSeletor(el); },
      selRap: function (el, ev, ctx) {
        var t = el.getAttribute('data-t'), ids;
        if (t === 'todas') ids = ativas().map(function (p) { return p.id; });
        else if (t === 'fonos') ids = ativas().filter(function (p) { return /fono/i.test(p.especialidade); }).map(function (p) { return p.id; });
        else if (t === 'eu') ids = [App.estado.usuario.profissionalId];
        else ids = [];
        document.querySelectorAll('#painel-prof input[type=checkbox]').forEach(function (c) { c.checked = ids.indexOf(c.value) >= 0; });
      },
      aplicarSel: function (el, ev, ctx) {
        var ids = Array.prototype.map.call(document.querySelectorAll('#painel-prof input:checked'), function (c) { return c.value; });
        if (!ids.length) { App.toast('Escolha pelo menos uma profissional.', 'erro'); return; }
        U.ls.set('agendaProfs', ids); ctx.recarregar();
      },
      sessao: function (el, ev, ctx) { abrirSessao(ctx.dados.mapa[el.getAttribute('data-id')], ctx); },
      novo: function (el, ev, ctx) { novoAgendamento(ctx); },
      bloqueios: function (el, ev, ctx) { abrirBloqueios(ctx); }
    }
  });
  function ir(d) { U.ls.set('agendaData', d); location.hash = '#/agenda?data=' + d; }

  function abrirSeletor(btn) {
    var p = document.getElementById('painel-prof');
    if (!p.classList.contains('oculto')) { p.classList.add('oculto'); return; }
    var sel = selecionadas(), u = App.estado.usuario;
    p.innerHTML = '<div class="rap"><button class="btn peq" data-acao="selRap" data-t="todas">Todas</button><button class="btn peq" data-acao="selRap" data-t="fonos">Só fonos</button>' +
      (u.profissionalId ? '<button class="btn peq" data-acao="selRap" data-t="eu">Só eu</button>' : '') + '<button class="btn peq" data-acao="selRap" data-t="limpar">Limpar</button></div>' +
      ativas().map(function (x) { return '<label class="marcar"><input type="checkbox" value="' + x.id + '"' + (sel.indexOf(x.id) >= 0 ? ' checked' : '') + '>' + esc(x.nome) + ' <span class="sub">· ' + esc(x.especialidade) + '</span></label>'; }).join('') +
      '<button class="btn pri" data-acao="aplicarSel" style="margin-top:8px">Mostrar</button>';
    p.classList.remove('oculto');
    btn.setAttribute('aria-expanded', 'true');
  }

  function cartaoSessao(a, comProf) {
    return '<button class="sessao st-' + a.status + (a.decisao === 'pendente' ? ' decisao' : '') + '" data-acao="sessao" data-id="' + a.id + '" aria-label="' + esc(a.paciente + ', ' + a.hora + ', ' + ROT[a.status]) + '">' +
      '<b>' + esc(a.paciente) + '</b><span>' + (comProf ? esc(a.profissional) + ' · ' : '') + esc(CURTO[a.status] || a.status) + (a.tipo === 'anamnese' ? ' · Anamnese' : '') + (a.decisao === 'pendente' ? ' · decidir' : '') + '</span></button>';
  }
  function horarios(atend) {
    var s = {}; PADRAO.forEach(function (h) { s[h] = 1; }); atend.forEach(function (a) { s[a.hora] = 1; });
    return Object.keys(s).sort();
  }
  function gradeDia(atend, profs) {
    if (!profs.length) return '<div class="cartao vazio">Escolha as profissionais para ver a agenda.</div>';
    var hs = horarios(atend);
    var h = '<div class="grade-agenda"><table><thead><tr><th class="hora">Hora</th>' + profs.map(function (p) { return '<th>' + esc(p.nome) + '<small>' + esc(p.especialidade) + '</small></th>'; }).join('') + '</tr></thead><tbody>';
    hs.forEach(function (hr) {
      h += '<tr><td class="hora">' + hr + '</td>' + profs.map(function (p) {
        var l = atend.filter(function (a) { return a.profissionalId === p.id && a.hora === hr; });
        return '<td>' + l.map(function (a) { return cartaoSessao(a, false); }).join('') + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  function gradeSemana(atend, de, profs) {
    var dias = [0, 1, 2, 3, 4, 5].map(function (i) { return U.somarDias(de, i); });
    var hs = horarios(atend);
    var varias = profs.length > 1;
    var h = '<div class="grade-agenda"><table><thead><tr><th class="hora">Hora</th>' + dias.map(function (d) { return '<th>' + U.DIAS_C[U.diaSemana(d)] + ' ' + U.dataBr(d).slice(0, 5) + '</th>'; }).join('') + '</tr></thead><tbody>';
    hs.forEach(function (hr) {
      h += '<tr><td class="hora">' + hr + '</td>' + dias.map(function (d) {
        return '<td>' + atend.filter(function (a) { return a.data === d && a.hora === hr; }).map(function (a) { return cartaoSessao(a, varias); }).join('') + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  function legenda() {
    return '<div class="legenda"><span><i class="st-realizada"></i>Realizada</span><span><i class="st-falta_sem_aviso"></i>Falta / cancel. &lt; 24h / atraso</span><span><i class="st-remarcada"></i>Remarcada</span><span><i class="st-cancelada_aviso"></i>Cancelada / atestado / abonada</span><span><i class="st-agendada"></i>Aguardando registro</span><span><i style="border-color:var(--verm);box-shadow:inset 3px 0 0 var(--verm)"></i>Falta aguardando decisão do financeiro</span></div>';
  }

  /* ---------- Sessão: registrar o que aconteceu ---------- */
  function abrirSessao(a, ctx) {
    var u = App.estado.usuario;
    var podeStatus = u.perfil !== 'profissional' || u.podeMarcarPresenca;
    if (a.fechado && !App.ehFin()) podeStatus = false;
    var corpo = '<div class="linha entre" style="align-items:flex-start"><div><h3>' + esc(a.paciente) + '</h3><div class="sub">' + esc(a.profissional) + (a.tipo === 'anamnese' ? ' · Anamnese' : '') + '</div>' +
      '<div class="sub">' + U.dataLonga(a.data) + ' · ' + a.hora + ' às ' + a.fim + '</div>' + (a.responsavel ? '<div class="sub">Responsável: ' + esc(a.responsavel) + '</div>' : '') + '</div>' +
      '<span class="selo ' + classeStatus(a.status) + '">' + esc(ROT[a.status]) + '</span></div>' +
      (a.justificativa ? '<div class="alerta a-info">' + esc(a.justificativa) + '</div>' : '') +
      (a.fechado ? '<div class="alerta a-aviso">O mês desta sessão já foi fechado.' + (App.ehFin() ? ' Uma alteração aqui atualiza a cobrança e o repasse.' : ' Só o financeiro pode alterar.') + '</div>' : '') +
      (a.decisao === 'pendente' ? '<div class="alerta a-erro">Aguardando o financeiro decidir se cobra.</div>' : '') +
      (a.decisao === 'cobrar' ? '<div class="alerta a-aviso">Financeiro decidiu cobrar.</div>' : '') + (a.decisao === 'nao_cobrar' ? '<div class="alerta a-info">Financeiro decidiu não cobrar.</div>' : '');
    if (podeStatus) {
      corpo += '<div><b>O que aconteceu?</b></div><div class="status-opcoes">' + ORDEM.filter(function (s) { return s !== 'agendada' || a.status !== 'agendada'; }).map(function (s) {
        return '<button type="button" class="st-' + s + (a.status === s ? ' ativo' : '') + '" data-acao="escolher" data-s="' + s + '">' + esc(ROT[s]) + '</button>';
      }).join('') + '</div>' +
        '<div id="extra-status" class="pilha"></div>';
    }
    var podeCorrigir = a.status === 'agendada' && !a.fechado && u.perfil !== 'profissional';
    if (podeCorrigir) corpo += '<div class="linha" style="gap:8px;flex-wrap:wrap;margin-top:4px"><span class="sub">Lançou errado?</span>' +
      '<button type="button" class="btn peq" data-acao="corrigir">Corrigir data, horário ou profissional</button>' +
      '<button type="button" class="btn peq perigo" data-acao="excluir">Excluir agendamento</button></div><div id="corrigir-caixa" class="pilha"></div>';
    var pe = '';
    if (a.whatsapp) pe += '<button class="btn zap" data-acao="_zap" data-url="' + esc(U.zapNumero(a.whatsapp)) + '">' + I('zap', 18) + 'WhatsApp</button>';
    if (u.perfil !== 'profissional') pe += '<a class="btn" href="#/pacientes/' + a.pacienteId + '">Ver cadastro</a>';
    if (App.ehFin() && a.decisao === 'pendente') pe += '<button class="btn" data-acao="decidir" data-d="nao_cobrar">Não cobrar</button><button class="btn ama" data-acao="decidir" data-d="cobrar">Cobrar</button>';
    var escolhido = null;
    var m = App.modal({ titulo: 'Sessão', corpo: corpo, pe: pe || '<button class="btn" data-acao="_fechar">Fechar</button>', semFoco: true, acoes: {
      escolher: function (el) {
        escolhido = el.getAttribute('data-s');
        m.el.querySelectorAll('.status-opcoes button').forEach(function (b) { b.classList.toggle('ativo', b === el); });
        var x = m.el.querySelector('#extra-status'), html = '';
        if (escolhido === 'remarcada') html += '<div class="form"><label class="campo">Nova data<input class="ent" type="date" id="nova-data" min="' + U.hoje() + '"></label><label class="campo">Horário<input class="ent" type="time" id="nova-hora" step="900" value="' + a.hora + '"></label></div><div class="sub peq">A nova sessão entra na agenda e é cobrada normalmente.</div>';
        if (['falta_sem_aviso', 'cancel_menos_24h', 'atraso_30', 'abonada', 'falta_atestado', 'cancelada_aviso', 'cancelada_clinica'].indexOf(escolhido) >= 0)
          html += '<label class="campo">Justificativa' + (escolhido === 'abonada' ? ' (obrigatória)' : ' (opcional)') + '<textarea class="ent" id="just" placeholder="' + (escolhido === 'abonada' ? 'Explique a situação diferenciada' : 'Ex.: avisou pelo WhatsApp às 7h') + '"></textarea></label>';
        if (escolhido === 'falta_atestado') html += '<label class="campo">Foto ou PDF do atestado (opcional)<input class="ent" type="file" id="atestado" accept="image/*,application/pdf"></label>';
        if (['falta_sem_aviso', 'cancel_menos_24h', 'atraso_30'].indexOf(escolhido) >= 0) html += '<div class="alerta a-aviso">O financeiro vai decidir se esta sessão é cobrada.</div>';
        if (escolhido === 'abonada') html += '<div class="alerta a-aviso">O financeiro será avisado do abono.</div>';
        html += '<button class="btn pri" data-acao="salvar">Salvar</button>';
        x.innerHTML = html;
      },
      salvar: function (el) {
        var d = { id: a.id, status: escolhido };
        var j = m.el.querySelector('#just'); if (j) d.justificativa = j.value.trim();
        if (escolhido === 'remarcada') { d.novaData = m.el.querySelector('#nova-data').value; d.novaHora = m.el.querySelector('#nova-hora').value; if (!d.novaData || !d.novaHora) { App.toast('Informe a nova data e o horário.', 'erro'); return; } }
        el.disabled = true;
        var arq = m.el.querySelector('#atestado');
        var antes = arq && arq.files[0] ? U.lerArquivo(arq.files[0]).then(function (f) { return App.api('anexos.enviar', { tipo: 'atestado', nome: f.nome, mime: f.mime, base64: f.base64, entidade: 'Atendimentos', entidadeId: a.id }); }).then(function (an) { d.anexoId = an.id; }) : Promise.resolve();
        antes.then(function () { return App.api('agenda.status', d); }).then(function () { App.toast('Sessão registrada.', 'ok'); m.fechar(); ctx.recarregar(); }, function (e) { App.toast(e.message, 'erro'); el.disabled = false; });
      },
      corrigir: function () {
        var x = m.el.querySelector('#corrigir-caixa');
        x.innerHTML = '<div class="form"><label class="campo">Data<input class="ent" type="date" id="cor-data" value="' + a.data + '"></label>' +
          '<label class="campo">Horário<input class="ent" type="time" id="cor-hora" step="900" value="' + a.hora + '"></label>' +
          '<label class="campo todo">Profissional<select class="ent" id="cor-prof">' + U.opcoes(ativas().map(function (p) { return { v: p.id, t: p.nome + ' · ' + p.especialidade }; }), a.profissionalId) + '</select></label></div>' +
          '<div class="sub peq">Use para acertar um lançamento errado. Se o paciente pediu para trocar o dia, use “Remarcada”.</div>' +
          '<button class="btn pri" data-acao="salvarCorrecao">Salvar correção</button>';
      },
      salvarCorrecao: function (el) {
        var d = { id: a.id, data: m.el.querySelector('#cor-data').value, hora: m.el.querySelector('#cor-hora').value, profissionalId: m.el.querySelector('#cor-prof').value };
        if (!d.data || !d.hora) { App.toast('Informe a data e o horário.', 'erro'); return; }
        el.disabled = true;
        App.api('agenda.corrigir', d).then(function () { App.toast('Agendamento corrigido. A profissional foi avisada.', 'ok'); m.fechar(); ctx.recarregar(); }, function (e) { App.toast(e.message, 'erro'); el.disabled = false; });
      },
      excluir: function () {
        App.confirmar('Excluir o agendamento de ' + a.paciente + ' em ' + U.dataBr(a.data) + ' às ' + a.hora + '? Ele sai da agenda e não é cobrado. Fica registrado no histórico.',
          { titulo: 'Excluir agendamento', campo: 'Motivo (ex.: lançado no dia errado)', botao: 'Excluir', perigo: true }).then(function (motivo) {
          if (!motivo) return;
          App.chamar('agenda.excluir', { id: a.id, motivo: motivo }, 'Agendamento excluído.').then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } });
        });
      },
      decidir: function (el) {
        var dec = el.getAttribute('data-d');
        App.chamar('financeiro.decidir', { id: a.id, decisao: dec }, dec === 'cobrar' ? 'Sessão será cobrada.' : 'Sessão não será cobrada.').then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } });
      }
    } });
  }
  App.abrirSessao = abrirSessao;
  function classeStatus(s) { return s === 'realizada' ? 's-ok' : (['falta_sem_aviso', 'cancel_menos_24h', 'atraso_30'].indexOf(s) >= 0 ? 's-ruim' : (s === 'remarcada' ? 's-esp' : (s === 'agendada' ? 's-azul' : 's-neu'))); }
  App.classeStatus = classeStatus;

  /* ---------- Novo agendamento ---------- */
  function listaPacientes(ctx) {
    if (App._cachePacientes && Date.now() - App._cachePacientes.t < 120000) return Promise.resolve(App._cachePacientes.l);
    return App.api('pacientes.listar', { situacao: 'ativo' }).then(function (l) { App._cachePacientes = { t: Date.now(), l: l }; return l; });
  }
  App.listaPacientes = listaPacientes;
  function novoAgendamento(ctx, pre) {
    pre = pre || {};
    listaPacientes().then(function (pacs) {
      var m = App.modal({ titulo: 'Novo agendamento', corpo: '<form class="form" data-form="agendar">' +
        '<label class="campo todo">Paciente<select class="ent" name="pacienteId" required>' + U.opcoes(pacs.map(function (p) { return { v: p.id, t: p.nome + (p.responsavelNome ? ' — ' + p.responsavelNome : '') }; }), pre.pacienteId, 'Escolha…') + '</select></label>' +
        '<label class="campo">Profissional<select class="ent" name="profissionalId" required>' + U.opcoes(ativas().map(function (p) { return { v: p.id, t: p.nome + ' · ' + p.especialidade }; }), pre.profissionalId, 'Escolha…') + '</select></label>' +
        '<label class="campo">Tipo<select class="ent" name="tipo"><option value="sessao">Sessão (fora do plano / reposição)</option><option value="anamnese">Anamnese (1ª consulta, com a Paula)</option></select></label>' +
        '<label class="campo">Data<input class="ent" type="date" name="data" required value="' + (ctx.dados.data || U.hoje()) + '"></label>' +
        '<label class="campo">Horário<input class="ent" type="time" name="hora" required step="900"></label>' +
        '<label class="campo todo">Observação<input class="ent" name="observacao"></label>' +
        '<div class="campo todo"><div class="sub">Para atendimentos semanais, cadastre o plano no paciente: a agenda gera as sessões sozinha.</div></div>' +
        '<div class="campo todo"><button class="btn pri" type="submit">Agendar</button></div></form>',
        acoes: { agendar: function (f) {
          return App.chamar('agenda.agendar', U.dadosForm(f), 'Agendado. A profissional foi avisada.').then(function (r) { if (r) { m.fechar(); if (ctx.recarregar) ctx.recarregar(); } });
        } } });
    });
  }
  App.novoAgendamento = novoAgendamento;

  /* ---------- Recesso e ausências ---------- */
  App.abrirBloqueios = function (ctx) { return abrirBloqueios(ctx); };
  function abrirBloqueios(ctx) {
    App.api('agenda.bloqueios', { de: U.somarDias(U.hoje(), -60) }).then(function (lista) {
      var adm = App.e('admin');
      var m = App.modal({ titulo: 'Recesso e ausências', largo: true, corpo:
        (lista.length ? '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Tipo</th><th>Profissional</th><th>Período</th><th>Motivo</th><th></th></tr></thead><tbody>' + lista.map(function (b) {
          var pode = b.tipo !== 'recesso' || adm;
          return '<tr><td>' + (b.tipo === 'recesso' ? 'Recesso' : 'Ausência') + '</td><td>' + esc(b.profissional) + '</td><td>' + U.dataBr(b.inicio) + ' a ' + U.dataBr(b.fim) + '</td><td>' + esc(b.motivo) + '</td><td>' + (pode ? '<button class="btn peq perigo" data-acao="remover" data-id="' + b.id + '">Remover</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="vazio">Nenhum recesso ou ausência lançado.</div>') +
        '<form class="form" data-form="salvar"><label class="campo">Tipo<select class="ent" name="tipo" data-muda="tipo"><option value="ausencia">Ausência de uma profissional</option>' + (adm ? '<option value="recesso">Recesso da clínica (todas)</option>' : '') + '</select></label>' +
        '<label class="campo" id="campo-prof">Profissional<select class="ent" name="profissionalId">' + U.opcoes(ativas().map(function (p) { return { v: p.id, t: p.nome }; }), '', 'Escolha…') + '</select></label>' +
        '<label class="campo">De<input class="ent" type="date" name="inicio" required></label><label class="campo">Até<input class="ent" type="date" name="fim" required></label>' +
        '<label class="campo todo">Motivo<input class="ent" name="motivo" placeholder="Ex.: Natal, curso, licença"></label>' +
        '<div class="campo todo"><div class="alerta a-aviso">As sessões do período ficam como "cancelada pela clínica" e não são cobradas. As profissionais são avisadas.</div><button class="btn pri" type="submit" style="margin-top:8px">Lançar</button></div></form>',
        acoes: {
          tipo: function (el) { m.el.querySelector('#campo-prof').classList.toggle('oculto', el.value === 'recesso'); },
          salvar: function (f) { return App.chamar('agenda.bloqueio_salvar', U.dadosForm(f)).then(function (r) { if (r) { App.toast(r.sessoesCanceladas + ' sessão(ões) cancelada(s) pela clínica.', 'ok'); m.fechar(); ctx.recarregar(); } }); },
          remover: function (el) { App.confirmar('Remover este período? As sessões futuras voltam a ficar agendadas.').then(function (ok) { if (ok) App.chamar('agenda.bloqueio_remover', { id: el.getAttribute('data-id') }, 'Removido.').then(function (r) { if (r) { m.fechar(); ctx.recarregar(); } }); }); }
        } });
    });
  }

  /* ---------- Agenda da profissional (celular) ---------- */
  App.tela('hoje', {
    titulo: 'Minha agenda', perfis: ['profissional'],
    render: function (ctx) {
      var data = ctx.q.data || U.hoje();
      ctx.dados.data = data;
      return App.api('agenda.listar', { de: data, ate: U.somarDias(data, 7) }).then(function (r) {
        ctx.dados.mapa = {}; r.atendimentos.forEach(function (a) { ctx.dados.mapa[a.id] = a; });
        var doDia = r.atendimentos.filter(function (a) { return a.data === data; });
        var prox = r.atendimentos.filter(function (a) { return a.data > data && ['agendada', 'realizada'].indexOf(a.status) >= 0; });
        var h = '<div class="linha entre"><button class="btn icone" data-acao="dia" data-n="-1" aria-label="Dia anterior">' + I('ant') + '</button><div style="text-align:center"><h2>' + (data === U.hoje() ? 'Hoje' : U.DIAS[U.diaSemana(data)].replace(/^./, function (c) { return c.toUpperCase(); })) + '</h2><div class="sub">' + U.dataLonga(data) + '</div></div><button class="btn icone" data-acao="dia" data-n="1" aria-label="Próximo dia">' + I('prox') + '</button></div>';
        var ativosDia = doDia.filter(function (a) { return a.status !== 'remarcada' && a.status !== 'cancelada_aviso' && a.status !== 'cancelada_clinica'; });
        h += '<div class="alerta a-aviso">' + (ativosDia.length ? 'Você tem <b>' + ativosDia.length + ' atendimento' + (ativosDia.length > 1 ? 's' : '') + '</b> neste dia.' : 'Nenhum atendimento neste dia.') + '</div>';
        h += '<div class="lista-dia">' + doDia.map(function (a) {
          return '<button class="dia-sessao" data-acao="ver" data-id="' + a.id + '"><span class="h">' + a.hora + '<br><small style="font-weight:400">45 min</small></span><span style="flex:1;min-width:0"><b style="font-size:16px">' + esc(a.paciente) + '</b><br><span class="selo ' + classeStatus(a.status) + '" style="margin-top:4px">' + esc(ROT[a.status]) + (a.tipo === 'anamnese' ? ' · Anamnese' : '') + '</span></span></button>';
        }).join('') + '</div>';
        if (prox.length) h += '<h3>Próximos dias</h3><div class="cartao plano">' + prox.map(function (a) { return '<div class="aviso-item"><div style="flex:1"><b>' + U.DIAS_C[U.diaSemana(a.data)] + ' ' + U.dataBr(a.data).slice(0, 5) + '</b> · ' + a.hora + '</div><div>' + esc(a.paciente) + '</div></div>'; }).join('') + '</div>';
        return h;
      });
    },
    acoes: {
      dia: function (el, ev, ctx) { location.hash = '#/hoje?data=' + U.somarDias(ctx.dados.data, Number(el.getAttribute('data-n'))); },
      ver: function (el, ev, ctx) { abrirSessao(ctx.dados.mapa[el.getAttribute('data-id')], ctx); }
    }
  });
})();
