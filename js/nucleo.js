/* Espaço Giraosol — núcleo do app: API, sessão, roteador, layout, modais, avisos e notificações. */
(function () {
  'use strict';
  var CFG = window.GIRAOSOL_CONFIG || {};
  var App = window.App = { cfg: CFG, telas: {}, estado: { token: null, usuario: null, profissionais: [] }, atual: null };

  /* ---------- Utilidades ---------- */
  var U = App.u = {};
  U.esc = function (s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  U.moeda = function (v) { var n = Number(v || 0); return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  U.num = function (v) { return Number(v || 0).toFixed(2).replace('.', ','); };
  U.lerNum = function (s) { s = String(s || '').trim(); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); return Number(s); };
  U.dataBr = function (iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  U.dataHoraBr = function (iso) { if (!iso) return ''; return U.dataBr(iso) + ' ' + String(iso).slice(11, 16); };
  U.iso = function (d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; };
  U.hoje = function () { return U.iso(new Date()); };
  U.parse = function (iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); };
  U.somarDias = function (iso, n) { var d = U.parse(iso); d.setDate(d.getDate() + n); return U.iso(d); };
  U.diaSemana = function (iso) { return U.parse(iso).getDay(); };
  U.DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  U.DIAS_C = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  U.MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  U.dataLonga = function (iso) { var d = U.parse(iso); return U.DIAS[d.getDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + ', ' + d.getDate() + ' de ' + U.MESES[d.getMonth()] + ' de ' + d.getFullYear(); };
  U.comp = function (iso) { return String(iso || U.hoje()).slice(0, 7); };
  U.nomeMes = function (c) { var p = c.split('-'); return U.MESES[+p[1] - 1].replace(/^./, function (x) { return x.toUpperCase(); }) + '/' + p[0]; };
  U.compAnterior = function (c) { var p = c.split('-'); return U.iso(new Date(+p[0], +p[1] - 2, 1, 12)).slice(0, 7); };
  U.compSeguinte = function (c) { var p = c.split('-'); return U.iso(new Date(+p[0], +p[1], 1, 12)).slice(0, 7); };
  U.opcoesMeses = function (sel, n) { var c = U.comp(), r = '', i; for (i = 0; i < 2; i++) c = U.compSeguinte(c); for (i = 0; i < (n || 15); i++) { r += '<option value="' + c + '"' + (c === sel ? ' selected' : '') + '>' + U.nomeMes(c) + '</option>'; c = U.compAnterior(c); } return r; };
  U.query = function () { var h = location.hash, i = h.indexOf('?'), q = {}; if (i < 0) return q; h.slice(i + 1).split('&').forEach(function (p) { var kv = p.split('='); q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); }); return q; };
  U.primeiroNome = function (n) { return String(n || '').split(' ')[0]; };
  U.normal = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  U.ls = { get: function (k) { try { return JSON.parse(localStorage.getItem('gs_' + k)); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem('gs_' + k, JSON.stringify(v)); } catch (e) { } }, del: function (k) { try { localStorage.removeItem('gs_' + k); } catch (e) { } } };
  U.opcoes = function (lista, sel, vazio) { return (vazio !== undefined ? '<option value="">' + U.esc(vazio) + '</option>' : '') + lista.map(function (o) { var v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o; return '<option value="' + U.esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + U.esc(t) + '</option>'; }).join(''); };

  /** Lê um formulário como objeto; nomes com ponto viram objetos aninhados (ex.: maeJson.nome). */
  U.dadosForm = function (form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if ((el.type === 'checkbox')) { definir(o, el.name, el.checked); return; }
      if (el.type === 'radio') { if (el.checked) definir(o, el.name, el.value); return; }
      definir(o, el.name, el.value.trim());
    });
    return o;
    function definir(obj, nome, v) { var p = nome.split('.'), x = obj; for (var i = 0; i < p.length - 1; i++) { x[p[i]] = x[p[i]] || {}; x = x[p[i]]; } x[p[p.length - 1]] = v; }
  };

  U.lerArquivo = function (file) {
    return new Promise(function (ok, falha) {
      var r = new FileReader();
      r.onload = function () { ok({ nome: file.name, mime: file.type || 'application/octet-stream', base64: String(r.result).split(',')[1] }); };
      r.onerror = falha;
      r.readAsDataURL(file);
    });
  };
  U.blobDeBase64 = function (b64, mime) { var bin = atob(b64), n = bin.length, a = new Uint8Array(n); for (var i = 0; i < n; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }); };
  U.baixar = function (nome, mime, b64) { var url = URL.createObjectURL(U.blobDeBase64(b64, mime)); var a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); };
  U.abrir = function (mime, b64) { var url = URL.createObjectURL(U.blobDeBase64(b64, mime)); window.open(url, '_blank'); setTimeout(function () { URL.revokeObjectURL(url); }, 60000); };
  U.carregarScript = function (src) {
    return new Promise(function (ok, falha) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { falha(new Error('Não carregou ' + src)); }; document.head.appendChild(s);
    });
  };
  U.zap = function (url) { var w = window.open(url, '_blank'); if (!w) location.href = url; };
  U.zapNumero = function (numero, texto) { return 'https://wa.me/' + numero + (texto ? '?text=' + encodeURIComponent(texto) : ''); };

  /* ---------- Ícones (traço, herdam a cor) ---------- */
  var I = App.icone = function (n, t) {
    var d = {
      agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
      pacientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.7 2.5 3 5.2"/>',
      inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
      presenca: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 13l2 2 4-4"/>',
      fech: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
      dinheiro: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
      pagar: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
      zap: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/>',
      config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
      sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
      ant: '<path d="M15 6l-6 6 6 6"/>', prox: '<path d="M9 6l6 6-6 6"/>',
      mais: '<path d="M12 5v14M5 12h14"/>',
      usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.3-6.5 8-6.5s7 2 8 6.5"/>',
      anexo: '<path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>',
      imprimir: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
      repasse: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
      historico: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
      sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
      digital: '<path d="M12 11v3a8 8 0 0 1-1.5 4.7M8 10.5a4 4 0 0 1 8 0V13a12 12 0 0 1-.8 4.4M5 13.5V11a7 7 0 0 1 12.5-4.3M19 11v2a16 16 0 0 1-.6 4.3M8.2 20.5A12 12 0 0 0 9.5 15v-4"/>'
    }[n] || '';
    return '<svg aria-hidden="true" width="' + (t || 20) + '" height="' + (t || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  };

  /* ---------- Avisos rápidos ---------- */
  App.toast = function (msg, tipo) {
    var c = document.querySelector('.toasts');
    if (!c) { c = document.createElement('div'); c.className = 'toasts'; c.setAttribute('role', 'status'); document.body.appendChild(c); }
    var t = document.createElement('div'); t.className = 'toast ' + (tipo || ''); t.textContent = msg; c.appendChild(t);
    setTimeout(function () { t.remove(); }, tipo === 'erro' ? 7000 : 3800);
  };

  /* ---------- API ---------- */
  App.api = function (acao, dados, op) {
    op = op || {};
    if (!CFG.API_URL) return Promise.reject(new Error('Endereço do servidor não configurado (config.js).'));
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao: acao, token: App.estado.token, dados: dados || {} }) })
      .then(function (r) { return r.json(); }, function () { throw Object.assign(new Error('Sem conexão com o servidor. Confira a internet e tente de novo.'), { codigo: 'REDE' }); })
      .then(function (r) {
        if (r.ok) return r.dados;
        var e = new Error(r.erro.mensagem); e.codigo = r.erro.codigo;
        if (e.codigo === 'SESSAO' || e.codigo === 'BLOQUEADO') { if (!op.semSair) App.sair(true, e.message); }
        else if (e.codigo === 'TROCAR_SENHA') { location.hash = '#/conta'; }
        throw e;
      });
  };
  /** Chama a API mostrando erro em toast; devolve null em caso de erro. */
  App.chamar = function (acao, dados, msgOk) {
    return App.api(acao, dados).then(function (r) { if (msgOk) App.toast(msgOk, 'ok'); return r; }, function (e) { if (e.codigo !== 'SESSAO') App.toast(e.message, 'erro'); return null; });
  };

  /* ---------- Sessão ---------- */
  App.entrar = function (r) {
    App.estado.token = r.token; App.estado.usuario = r.usuario;
    U.ls.set('sessao', { token: r.token, usuario: r.usuario });
    return App.iniciar();
  };
  App.sair = function (expirou, msg) {
    if (!expirou && App.estado.token) App.api('auth.sair', {}, { semSair: true }).catch(function () { });
    App.estado.token = null; App.estado.usuario = null; U.ls.del('sessao');
    clearInterval(App._timerAvisos);
    App.mostrarLogin(msg);
  };
  App.perfil = function () { return App.estado.usuario ? App.estado.usuario.perfil : null; };
  App.e = function () { var p = App.perfil(); return Array.prototype.slice.call(arguments).indexOf(p) >= 0; };
  App.ehFin = function () { return App.e('admin', 'financeiro'); };

  App.profissionais = function () { return App.estado.profissionais || []; };
  App.prof = function (id) { return App.profissionais().filter(function (p) { return p.id === id; })[0] || null; };

  /* ---------- Roteador ---------- */
  App.tela = function (nome, def) { App.telas[nome] = def; };
  function rotaAtual() {
    var h = location.hash.replace(/^#\/?/, '').split('?')[0];
    var partes = h.split('/').filter(Boolean);
    var chaves = Object.keys(App.telas).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < chaves.length; i++) {
      var k = chaves[i], kp = k.split('/');
      if (kp.length > partes.length) continue;
      var param = null, okk = true;
      for (var j = 0; j < kp.length; j++) { if (kp[j] === ':id') param = partes[j]; else if (kp[j] !== partes[j]) { okk = false; break; } }
      if (okk && (kp.length === partes.length)) return { nome: k, id: param, q: U.query() };
    }
    return { nome: App.inicial(), id: null, q: {} };
  }
  App.inicial = function () { return App.e('profissional') ? 'hoje' : 'inicio'; };
  App.renderizar = function () {
    if (!App.estado.usuario) return;
    var r = rotaAtual(), def = App.telas[r.nome];
    if (App.estado.usuario.trocarSenha && r.nome !== 'conta') { location.hash = '#/conta'; return; }
    if (def.perfis && def.perfis.indexOf(App.perfil()) < 0) { location.hash = '#/' + App.inicial(); return; }
    var ctx = App.atual = { nome: r.nome, id: r.id, q: r.q, def: def, el: document.getElementById('conteudo'), dados: {} };
    document.querySelectorAll('.menu a, .nav-baixo a').forEach(function (a) { a.classList.toggle('ativo', a.getAttribute('data-rota') === (def.menu || r.nome)); });
    document.getElementById('titulo').textContent = typeof def.titulo === 'function' ? def.titulo(ctx) : (def.titulo || '');
    document.title = (App._naoLidos ? '(' + App._naoLidos + ') ' : '') + (def.tituloAba || def.titulo || 'Espaço Giraosol') + ' — Espaço Giraosol';
    fecharMenu();
    ctx.el.innerHTML = '<div class="carregando"><div class="giro"></div>Carregando…</div>';
    ctx.recarregar = function () { return desenhar(ctx); };
    desenhar(ctx);
  };
  function desenhar(ctx) {
    return Promise.resolve().then(function () { return ctx.def.render(ctx); }).then(function (html) {
      if (App.atual !== ctx) return;
      if (typeof html === 'string') ctx.el.innerHTML = html;
      if (ctx.def.depois) ctx.def.depois(ctx);
    }).catch(function (e) {
      if (App.atual !== ctx) return;
      ctx.el.innerHTML = '<div class="alerta a-erro">' + U.esc(e.message || 'Erro ao carregar.') + '</div>';
    });
  }
  window.addEventListener('hashchange', function () { App.renderizar(); });

  /* ---------- Eventos (delegação) ---------- */
  function executar(nomeAcao, el, ev) {
    var m = App._modais[App._modais.length - 1];
    if (m && m.acoes && m.acoes[nomeAcao]) return m.acoes[nomeAcao](el, ev, m);
    var a = App.atual && App.atual.def.acoes && App.atual.def.acoes[nomeAcao];
    if (a) return a(el, ev, App.atual);
    if (App.acoesGlobais[nomeAcao]) return App.acoesGlobais[nomeAcao](el, ev);
  }
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-acao]');
    if (!el) return;
    if (el.tagName === 'A' && !el.getAttribute('href')) ev.preventDefault();
    if (el.getAttribute('type') === 'submit') return;
    ev.preventDefault();
    if (el.disabled) return;
    executar(el.getAttribute('data-acao'), el, ev);
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target.closest('form[data-form]');
    if (!f) return;
    ev.preventDefault();
    var btn = f.querySelector('[type=submit]');
    if (btn && btn.disabled) return;
    if (btn) btn.disabled = true;
    Promise.resolve(executar(f.getAttribute('data-form'), f, ev)).finally(function () { if (btn && document.body.contains(btn)) btn.disabled = false; });
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target.closest('[data-muda]');
    if (el) executar(el.getAttribute('data-muda'), el, ev);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && App._modais.length) App._modais[App._modais.length - 1].fechar();
  });

  /* ---------- Modais ---------- */
  App._modais = [];
  App.modal = function (op) {
    var fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = '<div class="modal ' + (op.largo ? 'largo' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mt' + App._modais.length + '">' +
      '<div class="modal-topo"><h2 id="mt' + App._modais.length + '">' + U.esc(op.titulo || '') + '</h2><button class="btn icone" data-acao="_fechar" aria-label="Fechar">' + I('fechar') + '</button></div>' +
      '<div class="modal-corpo">' + (op.corpo || '') + '</div>' + (op.pe ? '<div class="modal-pe">' + op.pe + '</div>' : '') + '</div>';
    var m = { el: fundo, acoes: Object.assign({ _fechar: function () { m.fechar(); } }, op.acoes || {}), dados: op.dados || {} };
    m.fechar = function (v) { fundo.remove(); App._modais = App._modais.filter(function (x) { return x !== m; }); if (op.aoFechar) op.aoFechar(v); };
    m.corpo = function (html) { fundo.querySelector('.modal-corpo').innerHTML = html; };
    fundo.addEventListener('mousedown', function (ev) { if (ev.target === fundo && !op.fixo) m.fechar(); });
    document.body.appendChild(fundo);
    App._modais.push(m);
    var f = fundo.querySelector('input:not([type=hidden]), select, textarea');
    if (f && !op.semFoco) setTimeout(function () { f.focus(); }, 30);
    return m;
  };
  App.confirmar = function (texto, op) {
    op = op || {};
    return new Promise(function (ok) {
      var resp = false;
      App.modal({ titulo: op.titulo || 'Confirmar', corpo: '<p style="margin:0;line-height:1.5">' + U.esc(texto) + '</p>' + (op.campo ? '<label class="campo">' + U.esc(op.campo) + '<textarea class="ent" id="conf-campo"></textarea></label>' : ''),
        pe: '<button class="btn" data-acao="_fechar">Voltar</button><button class="btn ' + (op.perigo ? 'perigo' : 'pri') + '" data-acao="sim">' + U.esc(op.botao || 'Confirmar') + '</button>',
        acoes: { sim: function (el, ev, m) { var c = m.el.querySelector('#conf-campo'); if (op.campo && (!c.value.trim() || c.value.trim().length < 3)) { App.toast('Preencha: ' + op.campo, 'erro'); return; } resp = op.campo ? c.value.trim() : true; m.fechar(); } },
        aoFechar: function () { ok(resp); } });
    });
  };

  /* ---------- Layout ---------- */
  var MENU = [
    { rota: 'inicio', t: 'Início', i: 'inicio', p: ['admin', 'financeiro', 'secretaria'] },
    { rota: 'hoje', t: 'Agenda', i: 'agenda', p: ['profissional'] },
    { rota: 'agenda', t: 'Agenda', i: 'agenda', p: ['admin', 'financeiro', 'secretaria'] },
    { rota: 'pacientes', t: 'Pacientes', i: 'pacientes', p: ['admin', 'financeiro', 'secretaria'] },
    { rota: 'presenca', t: 'Listas de presença', i: 'presenca', p: ['admin', 'financeiro', 'secretaria'] },
    { rota: 'recados', t: 'Recados por WhatsApp', i: 'zap', p: ['admin', 'financeiro', 'secretaria'] },
    { sec: 'Financeiro', p: ['admin', 'financeiro'] },
    { rota: 'financeiro/decisoes', t: 'Decisões de cobrança', i: 'fech', p: ['admin', 'financeiro'] },
    { rota: 'financeiro/fechamento', t: 'Fechamento do mês', i: 'fech', p: ['admin', 'financeiro'] },
    { rota: 'financeiro/cobrancas', t: 'Contas a receber', i: 'dinheiro', p: ['admin', 'financeiro'] },
    { rota: 'financeiro/comprovantes', t: 'Comprovantes', i: 'anexo', p: ['admin', 'financeiro'] },
    { rota: 'financeiro/repasses', t: 'Repasses e NFs', i: 'repasse', p: ['admin', 'financeiro'] },
    { rota: 'pagar', t: 'Contas a pagar', i: 'pagar', p: ['admin', 'financeiro'] },
    { rota: 'repasse', t: 'Meu repasse', i: 'repasse', p: ['profissional'], se: function (u) { return u.podeVerExtrato || (u.profissional && u.profissional.geraRepasse); } },
    { rota: 'avisos', t: 'Avisos', i: 'sino', p: ['profissional'] },
    { sec: 'Administração', p: ['admin'] },
    { rota: 'admin/usuarios', t: 'Usuários', i: 'usuario', p: ['admin'] },
    { rota: 'admin/profissionais', t: 'Profissionais e horários', i: 'agenda', p: ['admin'] },
    { rota: 'admin/configuracoes', t: 'Configurações', i: 'config', p: ['admin'] },
    { rota: 'admin/historico', t: 'Histórico', i: 'historico', p: ['admin'] }
  ];
  App.montarLayout = function () {
    var u = App.estado.usuario, p = u.perfil;
    var itens = MENU.filter(function (m) { return m.p.indexOf(p) >= 0 && (!m.se || m.se(u)); });
    var menu = itens.map(function (m) { return m.sec ? '<div class="menu-sec">' + m.sec + '</div>' : '<a href="#/' + m.rota + '" data-rota="' + m.rota + '">' + I(m.i) + U.esc(m.t) + '</a>'; }).join('');
    var perfilNome = { admin: 'Administradora', financeiro: 'Financeiro', secretaria: 'Secretária', profissional: u.profissional ? u.profissional.especialidade : 'Profissional' }[p];
    var baixo = p === 'profissional' ? '<nav class="nav-baixo" aria-label="Navegação">' + itens.map(function (m) { return '<a href="#/' + m.rota + '" data-rota="' + m.rota + '">' + I(m.i, 22) + U.esc(m.t.replace('Meu repasse', 'Repasse')) + '</a>'; }).join('') + '<a href="#/conta" data-rota="conta">' + I('usuario', 22) + 'Conta</a></nav>' : '';
    document.body.innerHTML = '<div class="app' + (p === 'profissional' ? ' so-baixo' : '') + '">' +
      '<aside class="lateral" id="lateral"><div class="marca"><img src="icones/icone-192.png" alt=""><div><b>Espaço Giraosol</b><small>Semear para florescer</small></div></div>' +
      '<nav class="menu" aria-label="Menu principal">' + menu + '</nav>' +
      '<div class="rodape"><b>' + U.esc(u.nome) + '</b>' + U.esc(perfilNome) + '<div class="linha" style="margin-top:10px"><a class="btn peq" style="background:transparent;color:#fff;border-color:#6E8B3D" href="#/conta">' + I('usuario', 16) + 'Minha conta</a></div></div></aside>' +
      '<div class="principal"><header class="topo"><button class="btn icone btn-menu" data-acao="_menu" aria-label="Abrir menu">' + I('menu') + '</button>' +
      '<div class="titulo" id="titulo"></div>' +
      '<a class="btn icone sino" href="#/avisos" aria-label="Avisos">' + I('sino') + '<span class="cont oculto" id="cont-avisos"></span></a></header>' +
      '<main class="conteudo" id="conteudo"></main></div></div>' + baixo;
  };
  function fecharMenu() { var l = document.getElementById('lateral'); if (l) l.classList.remove('aberta'); var v = document.querySelector('.veu'); if (v) v.remove(); }
  App.acoesGlobais = {
    _menu: function () { var l = document.getElementById('lateral'); l.classList.add('aberta'); var v = document.createElement('div'); v.className = 'veu'; v.addEventListener('click', fecharMenu); document.body.appendChild(v); },
    _zap: function (el) { U.zap(el.getAttribute('data-url')); }
  };

  /* ---------- Início ---------- */
  App.iniciar = function () {
    App.montarLayout();
    return App.api('profissionais.listar').then(function (l) { App.estado.profissionais = l; }).catch(function () { }).then(function () {
      if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = '#/' + App.inicial();
      App.renderizar();
      App.atualizarAvisos();
      clearInterval(App._timerAvisos);
      App._timerAvisos = setInterval(App.atualizarAvisos, 60000);
      App.registrarPush(false);
    });
  };

  /* ---------- Avisos: sino, título piscando e notificação do computador ---------- */
  App._naoLidos = 0;
  App.atualizarAvisos = function () {
    if (!App.estado.token) return;
    App.api('avisos.listar', { apenasNaoLidos: true }, { semSair: false }).then(function (r) {
      var c = document.getElementById('cont-avisos');
      var antes = App._naoLidos;
      App._naoLidos = r.naoLidos;
      if (c) { c.textContent = r.naoLidos > 9 ? '9+' : r.naoLidos; c.classList.toggle('oculto', !r.naoLidos); }
      document.title = document.title.replace(/^\(\d+\) /, '');
      if (r.naoLidos) document.title = '(' + r.naoLidos + ') ' + document.title;
      var visto = U.ls.get('ultimoAviso') || '';
      var novos = r.avisos.filter(function (a) { return a.criadoEm > visto; });
      if (novos.length) {
        U.ls.set('ultimoAviso', novos[0].criadoEm);
        if (visto && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification('Espaço Giraosol', { body: novos[0].titulo, icon: 'icones/icone-192.png' }); } catch (e) { }
        } else if (visto && r.naoLidos > antes) App.toast(novos[0].titulo);
      }
    }).catch(function () { });
  };

  /* ---------- Notificações push (Firebase) ---------- */
  App.registrarPush = function (pedir) {
    var fb = CFG.firebase;
    if (!fb || !fb.apiKey || !('serviceWorker' in navigator) || !('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    if (Notification.permission !== 'granted' && !pedir) return Promise.resolve(false);
    return (Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission()).then(function (perm) {
      if (perm !== 'granted') return false;
      return Promise.all([U.carregarScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')]).then(function () {
        return U.carregarScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
      }).then(function () {
        if (!firebase.apps.length) firebase.initializeApp(fb);
        return navigator.serviceWorker.ready.then(function (reg) {
          return firebase.messaging().getToken({ vapidKey: fb.vapidKey, serviceWorkerRegistration: reg });
        });
      }).then(function (tok) {
        if (!tok) return false;
        var plat = /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : (/android/i.test(navigator.userAgent) ? 'android' : 'computador');
        return App.api('push.registrar', { token: tok, plataforma: plat }).then(function () { return true; });
      });
    }).catch(function (e) { console.warn('push', e); return false; });
  };

  /* ---------- Partida ---------- */
  App.mostrarLogin = function (msg) { App.telaLogin(msg); };
  document.addEventListener('DOMContentLoaded', function () {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { });
    var s = U.ls.get('sessao');
    if (s && s.token) {
      App.estado.token = s.token; App.estado.usuario = s.usuario;
      App.api('auth.eu').then(function (u) { App.estado.usuario = u; U.ls.set('sessao', { token: s.token, usuario: u }); App.iniciar(); }, function (e) { if (e.codigo === 'REDE') { App.iniciar(); App.toast(e.message, 'erro'); } });
    } else App.mostrarLogin();
  });
})();
