/* Login, troca de senha, digital/Face ID, avisos e início. */
(function () {
  'use strict';
  var U = App.u, I = App.icone, esc = U.esc;

  /* ---------- Login ---------- */
  App.telaLogin = function (msg) {
    var dig = U.ls.get('digital');
    document.body.innerHTML = '<div class="tela-login"><form class="caixa-login" id="form-login" autocomplete="on">' +
      '<img src="icones/logo.png" alt="Espaço Giraosol — Semear para florescer">' +
      (msg ? '<div class="alerta a-aviso">' + esc(msg) + '</div>' : '') +
      '<div class="alerta a-erro oculto" id="login-erro" role="alert"></div>' +
      '<label class="campo">Usuário<input class="ent" name="usuario" autocomplete="username" autocapitalize="none" required></label>' +
      '<label class="campo">Senha<input class="ent" name="senha" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn pri" type="submit" style="min-height:48px">Entrar</button>' +
      (dig && window.PublicKeyCredential ? '<button class="btn cont" type="button" id="btn-digital" style="min-height:48px">' + I('digital') + 'Entrar com digital' + (dig.nome ? ' (' + esc(dig.nome) + ')' : '') + '</button>' : '') +
      '<div class="rodape-k">Esqueceu a senha ou foi bloqueado? Fale com o suporte.<br>Kaluf &amp; Gomes Soluções Empresariais</div></form></div>';
    var f = document.getElementById('form-login');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Entrando…';
      var d = U.dadosForm(f);
      App.api('auth.login', { usuario: d.usuario, senha: d.senha, dispositivo: navigator.userAgent.slice(0, 100) }, { semSair: true })
        .then(App.entrar, function (e) { mostrarErro(e.message); b.disabled = false; b.textContent = 'Entrar'; });
    });
    var bd = document.getElementById('btn-digital');
    if (bd) bd.addEventListener('click', entrarComDigital);
    var campo = f.querySelector('[name=usuario]');
    if (dig && dig.usuario) campo.value = dig.usuario;
    (campo.value ? f.querySelector('[name=senha]') : campo).focus();
  };
  function mostrarErro(m) { var e = document.getElementById('login-erro'); if (e) { e.textContent = m; e.classList.remove('oculto'); } }

  function b64url(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function deB64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function desafio() { return crypto.getRandomValues(new Uint8Array(32)); }

  function entrarComDigital() {
    var dig = U.ls.get('digital');
    if (!dig) return;
    navigator.credentials.get({ publicKey: { challenge: desafio(), allowCredentials: [{ type: 'public-key', id: deB64url(dig.credencial) }], userVerification: 'required', timeout: 60000 } })
      .then(function () { return App.api('auth.digital_entrar', { dispositivoId: dig.dispositivoId, segredo: dig.segredo, dispositivo: navigator.userAgent.slice(0, 100) }, { semSair: true }); })
      .then(App.entrar, function (e) {
        if (e && e.codigo === 'DIGITAL') U.ls.del('digital');
        mostrarErro(e && e.codigo ? e.message : 'Não foi possível confirmar a digital. Entre com usuário e senha.');
      });
  }

  function ativarDigital() {
    var u = App.estado.usuario;
    var nome = /iphone|ipad/i.test(navigator.userAgent) ? 'iPhone' : (/android/i.test(navigator.userAgent) ? 'Android' : 'Este aparelho');
    return navigator.credentials.create({ publicKey: {
      challenge: desafio(), rp: { name: 'Espaço Giraosol' }, user: { id: new TextEncoder().encode(u.id), name: u.usuario, displayName: u.nome },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000, attestation: 'none'
    } }).then(function (cred) {
      return App.api('auth.digital_ativar', { nome: nome }).then(function (r) {
        U.ls.set('digital', { credencial: b64url(cred.rawId), dispositivoId: r.dispositivoId, segredo: r.segredo, usuario: u.usuario, nome: nome });
        App.toast('Entrada com digital ativada neste aparelho.', 'ok');
        App.atual.recarregar();
      });
    }).catch(function (e) { App.toast(e && e.codigo ? e.message : 'Não foi possível ativar. Confira se o aparelho tem digital ou Face ID configurado.', 'erro'); });
  }

  /* ---------- Minha conta ---------- */
  App.tela('conta', {
    titulo: 'Minha conta',
    render: function () {
      var u = App.estado.usuario, dig = U.ls.get('digital');
      var podeDigital = !!window.PublicKeyCredential && location.protocol === 'https:';
      var pushOk = 'Notification' in window && Notification.permission === 'granted';
      var ios = /iphone|ipad/i.test(navigator.userAgent), instalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      return (u.trocarSenha ? '<div class="alerta a-aviso">Bem-vinda! Crie uma senha sua para continuar. A senha provisória só vale para este primeiro acesso.</div>' : '') +
        '<section class="cartao"><h2>' + (u.trocarSenha ? 'Criar minha senha' : 'Trocar senha') + '</h2>' +
        '<form class="form" data-form="senha" style="max-width:640px">' +
        '<label class="campo">' + (u.trocarSenha ? 'Senha provisória' : 'Senha atual') + '<input class="ent" type="password" name="senhaAtual" autocomplete="current-password" required></label>' +
        '<label class="campo">Nova senha<input class="ent" type="password" name="senhaNova" autocomplete="new-password" required minlength="8"><small>Mínimo 8 caracteres, com letras e números.</small></label>' +
        '<label class="campo">Repita a nova senha<input class="ent" type="password" name="senhaNova2" autocomplete="new-password" required></label>' +
        '<div class="campo todo"><button class="btn pri" type="submit" style="max-width:220px">Salvar senha</button></div></form></section>' +
        (u.trocarSenha ? '' :
          '<section class="cartao"><h2>Entrar com digital ou Face ID</h2>' +
          (dig ? '<div class="alerta a-info">Ativada neste aparelho (' + esc(dig.nome) + ').</div><div><button class="btn perigo" data-acao="desativarDigital">Desativar neste aparelho</button></div>'
            : (podeDigital ? '<p class="sub" style="margin:0">Depois de ativar, você entra só com a digital neste aparelho. Se trocar a senha, precisa ativar de novo.</p><div><button class="btn cont" data-acao="ativarDigital">' + I('digital') + 'Ativar neste aparelho</button></div>'
              : '<p class="sub" style="margin:0">Disponível no app instalado no celular.</p>')) + '</section>' +
          '<section class="cartao"><h2>Notificações</h2>' +
          (pushOk ? '<div class="alerta a-info">Notificações ativadas neste aparelho.</div>' : '<p class="sub" style="margin:0">Receba avisos de agendamentos, cancelamentos e pendências mesmo com o app fechado.' + (ios && !instalado ? ' No iPhone, primeiro adicione o app à Tela de Início (veja abaixo).' : '') + '</p><div><button class="btn cont" data-acao="ativarPush">' + I('sino') + 'Ativar notificações</button></div>') +
          '</section>' +
          (instalado ? '' : '<section class="cartao"><h2>Instalar o app no celular</h2>' +
            (ios ? '<ol class="sub" style="margin:0;padding-left:18px;line-height:1.7"><li>Abra este endereço no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> (quadrado com seta).</li><li>Escolha <b>Adicionar à Tela de Início</b> e confirme.</li><li>Abra pelo ícone do Espaço Giraosol e ative as notificações aqui.</li></ol>'
              : '<ol class="sub" style="margin:0;padding-left:18px;line-height:1.7"><li>Abra este endereço no <b>Chrome</b>.</li><li>Toque nos <b>três pontinhos</b> e em <b>Instalar app</b> (ou "Adicionar à tela inicial").</li><li>Abra pelo ícone do Espaço Giraosol.</li></ol>') + '</section>') +
          '<section class="cartao"><div class="linha entre"><div><b>' + esc(u.nome) + '</b><div class="sub">Usuário: ' + esc(u.usuario) + '</div></div><button class="btn perigo" data-acao="sair">' + I('sair') + 'Sair</button></div></section>');
    },
    acoes: {
      senha: function (f) {
        var d = U.dadosForm(f);
        if (d.senhaNova !== d.senhaNova2) { App.toast('As duas senhas novas não são iguais.', 'erro'); return; }
        return App.chamar('auth.trocar_senha', { senhaAtual: d.senhaAtual, senhaNova: d.senhaNova }, 'Senha salva.').then(function (r) {
          if (!r) return;
          U.ls.del('digital');
          App.estado.usuario = r.usuario; U.ls.set('sessao', { token: App.estado.token, usuario: r.usuario });
          App.montarLayout(); location.hash = '#/' + App.inicial(); App.renderizar(); App.atualizarAvisos();
        });
      },
      ativarDigital: ativarDigital,
      desativarDigital: function () { U.ls.del('digital'); App.toast('Digital desativada neste aparelho.'); App.atual.recarregar(); },
      ativarPush: function () { App.registrarPush(true).then(function (ok) { App.toast(ok ? 'Notificações ativadas.' : 'Não foi possível ativar. Confira a permissão do navegador.', ok ? 'ok' : 'erro'); App.atual.recarregar(); }); },
      sair: function () { App.sair(); }
    }
  });

  /* ---------- Avisos ---------- */
  App.tela('avisos', {
    titulo: 'Avisos',
    render: function () {
      return App.api('avisos.listar', {}).then(function (r) {
        App.api('avisos.marcar_lidos', {}).then(App.atualizarAvisos);
        if (!r.avisos.length) return '<div class="cartao vazio">Nenhum aviso por enquanto.</div>';
        return '<div class="cartao plano">' + r.avisos.map(function (a) {
          return '<a class="aviso-item ' + (a.lido ? 'lido' : 'novo') + '" href="' + esc(a.link || '#/avisos') + '"><span class="ponto"></span><div style="flex:1;min-width:0"><div class="linha entre"><b>' + esc(a.titulo) + '</b><span class="sub peq">' + U.dataHoraBr(a.criadoEm) + '</span></div><div class="sub" style="margin-top:2px">' + esc(a.texto) + '</div></div></a>';
        }).join('') + '</div>';
      });
    }
  });

  /* ---------- Início (secretária, financeiro, administradora) ---------- */
  App.tela('inicio', {
    titulo: function () { return 'Olá, ' + U.primeiroNome(App.estado.usuario.nome); },
    perfis: ['admin', 'financeiro', 'secretaria'],
    render: function () {
      var hoje = U.hoje(), fin = App.ehFin();
      var reqs = [App.api('agenda.listar', { de: hoje, ate: hoje }), App.api('avisos.listar', { apenasNaoLidos: true })];
      if (fin) { reqs.push(App.api('financeiro.decisoes')); reqs.push(App.api('financeiro.cobrancas', { status: 'atrasadas' })); reqs.push(App.api('financeiro.pre_baixas')); }
      return Promise.all(reqs).then(function (r) {
        var ag = r[0].atendimentos, av = r[1];
        var pend = ag.filter(function (a) { return a.status === 'agendada' && a.hora <= new Date().toTimeString().slice(0, 5); }).length;
        var h = '<div class="sub">' + U.dataLonga(hoje) + '</div><div class="grade-cartoes">' +
          '<a class="kpi" href="#/agenda" style="text-decoration:none;color:inherit"><span class="r">Sessões hoje</span><span class="v">' + ag.length + '</span><span class="sub">' + ag.filter(function (a) { return a.status === 'realizada'; }).length + ' realizadas · ' + pend + ' sem registro</span></a>' +
          '<a class="kpi" href="#/avisos" style="text-decoration:none;color:inherit"><span class="r">Avisos não lidos</span><span class="v">' + av.naoLidos + '</span></a>';
        if (fin) {
          h += '<a class="kpi" href="#/financeiro/decisoes" style="text-decoration:none;color:inherit"><span class="r">Faltas aguardando decisão</span><span class="v">' + r[2].length + '</span></a>' +
            '<a class="kpi" href="#/financeiro/cobrancas?status=atrasadas" style="text-decoration:none;color:inherit"><span class="r">Cobranças em atraso</span><span class="v">' + r[3].length + '</span><span class="sub">' + U.moeda(r[3].reduce(function (s, c) { return s + c.saldo; }, 0)) + '</span></a>' +
            '<a class="kpi" href="#/financeiro/comprovantes" style="text-decoration:none;color:inherit"><span class="r">Comprovantes para conferir</span><span class="v">' + r[4].length + '</span></a>';
        }
        h += '</div>';
        if (av.avisos.length) h += '<section class="cartao plano"><div style="padding:14px 16px 4px"><h2>Avisos recentes</h2></div>' + av.avisos.slice(0, 6).map(function (a) {
          return '<a class="aviso-item novo" href="' + esc(a.link || '#/avisos') + '"><span class="ponto"></span><div style="flex:1;min-width:0"><b>' + esc(a.titulo) + '</b><div class="sub">' + esc(a.texto) + '</div></div></a>';
        }).join('') + '</section>';
        h += '<div class="linha"><a class="btn pri" href="#/agenda">' + I('agenda') + 'Abrir agenda</a><a class="btn" href="#/pacientes">' + I('pacientes') + 'Pacientes</a>' + (fin ? '<a class="btn" href="#/financeiro/fechamento">' + I('fech') + 'Fechamento do mês</a>' : '') + '</div>';
        return h;
      });
    }
  });
})();
