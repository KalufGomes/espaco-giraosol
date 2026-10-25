/* Listas de presença: impressão das folhas com QR code e leitura das folhas assinadas (tudo no navegador). */
(function () {
  'use strict';
  var U = App.u, I = App.icone, esc = U.esc;

  /* Geometria da folha em milímetros (A4). A leitura usa os 4 quadrados pretos dos cantos como referência. */
  var G = App.folhaGeo = {
    marcas: [[12, 12], [192, 12], [12, 279], [192, 279]], lado: 6,
    topoTabela: 64, cab: 8, inicioLinhas: 72, limite: 252,
    cols: [18, 26, 48, 64, 128, 158, 192], // nº | data | horário | assinatura | terapeuta | justificativa
    assin: [64, 128]
  };
  G.centros = G.marcas.map(function (m) { return [m[0] + G.lado / 2, m[1] + G.lado / 2]; });
  G.altura = function (n) { return Math.min(9, (G.limite - G.inicioLinhas) / n); };

  function svgQr(texto, x, y, tam) {
    var qr = qrcode(0, 'M'); qr.addData(texto); qr.make();
    var n = qr.getModuleCount(), q = 2, m = tam / (n + q * 2), r = '<rect x="' + x + '" y="' + y + '" width="' + tam + '" height="' + tam + '" fill="#fff"/>';
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (qr.isDark(i, j)) r += '<rect x="' + (x + (j + q) * m).toFixed(3) + '" y="' + (y + (i + q) * m).toFixed(3) + '" width="' + (m + 0.01).toFixed(3) + '" height="' + (m + 0.01).toFixed(3) + '"/>';
    return r;
  }
  function t(x, y, s, tam, peso, ancora) { return '<text x="' + x + '" y="' + y + '" font-size="' + (tam || 3.2) + '" font-weight="' + (peso || 400) + '"' + (ancora ? ' text-anchor="' + ancora + '"' : '') + '>' + esc(s) + '</text>'; }

  /** Uma página da folha como SVG em milímetros. */
  App.svgFolha = function (f, logoUrl, assinaturasTeste) {
    var n = f.linhas.length + f.linhasEmBranco, h = G.altura(n), c = G.cols, s = '';
    G.marcas.forEach(function (m) { s += '<rect x="' + m[0] + '" y="' + m[1] + '" width="' + G.lado + '" height="' + G.lado + '" fill="#000"/>'; });
    if (logoUrl) s += '<image href="' + logoUrl + '" x="22" y="12" width="20" height="24" preserveAspectRatio="xMidYMid meet"/>';
    s += t(105, 22, f.especialidade + ' - ' + f.mes, 5.2, 700, 'middle') + t(105, 28, 'Espaço Giraosol · ' + U.nomeMes(f.competencia), 3.2, 400, 'middle');
    s += svgQr(f.qr, 162, 18, 26);
    s += t(22, 42, f.paciente.toUpperCase(), 4.6, 700) + '<line x1="22" y1="43.2" x2="150" y2="43.2" stroke="#000" stroke-width="0.3"/>';
    f.contatos.slice(0, 3).forEach(function (ct, i) { s += t(22, 49 + i * 5, ct.rotulo.toUpperCase() + ': ' + ct.nome.toUpperCase(), 3.2) + t(110, 49 + i * 5, 'CONTATO: ' + (ct.telefone || ''), 3.2); });
    s += t(22, 61, 'Terapeuta: ' + f.profissional, 3);
    var y0 = G.topoTabela, y1 = G.inicioLinhas, yf = y1 + n * h;
    s += '<rect x="' + c[0] + '" y="' + y0 + '" width="' + (c[6] - c[0]) + '" height="' + (yf - y0) + '" fill="none" stroke="#000" stroke-width="0.35"/>';
    s += '<rect x="' + c[0] + '" y="' + y0 + '" width="' + (c[6] - c[0]) + '" height="' + G.cab + '" fill="#E3EDD3" stroke="#000" stroke-width="0.35"/>';
    for (var k = 1; k < c.length - 1; k++) s += '<line x1="' + c[k] + '" y1="' + y0 + '" x2="' + c[k] + '" y2="' + yf + '" stroke="#000" stroke-width="0.3"/>';
    ['Nº', 'DATA', 'HORÁRIO', 'ASSINATURA DO RESPONSÁVEL', 'TERAPEUTA', 'JUSTIFICATIVA'].forEach(function (r, i) { s += t((c[i] + c[i + 1]) / 2, y0 + 5.3, r, 2.7, 700, 'middle'); });
    for (var i = 0; i < n; i++) {
      var y = y1 + i * h;
      s += '<line x1="' + c[0] + '" y1="' + y + '" x2="' + c[6] + '" y2="' + y + '" stroke="#000" stroke-width="0.25"/>';
      s += t((c[0] + c[1]) / 2, y + h / 2 + 1.1, String(i + 1), 3, 700, 'middle');
      var l = f.linhas[i];
      if (l) s += t((c[1] + c[2]) / 2, y + h / 2 + 1.1, U.dataBr(l.data), 3.2, 400, 'middle') + t((c[2] + c[3]) / 2, y + h / 2 + 1.1, l.hora, 3.2, 400, 'middle') + t((c[4] + c[5]) / 2, y + h / 2 + 1.1, U.primeiroNome(f.profissional), 3, 400, 'middle');
      if (assinaturasTeste && assinaturasTeste[i]) s += '<path d="M' + (G.assin[0] + 8) + ' ' + (y + h * 0.65) + ' q 6 -' + (h * 0.5) + ' 12 0 t 12 0 t 12 0 t 10 -1" fill="none" stroke="#123" stroke-width="0.6"/>';
    }
    var yn = Math.max(yf + 5, 258);
    ['* Faltas avisadas com antecedência mínima de 24 horas poderão ser reagendadas conforme a disponibilidade da clínica.',
      '* Faltas avisadas de última hora ou não avisadas não garantem reposição e poderão ser consideradas como atendimento.',
      '* Faltas justificadas acompanhadas de atestado médico.'].forEach(function (r, i) { s += t(18, yn + i * 4.6, r, 2.8); });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297" font-family="Arial, Helvetica, sans-serif">' + s + '</svg>';
  };

  function base() { return location.href.replace(/#.*$/, '').replace(/[^/]*$/, ''); }
  function imprimirFolhas(folhas) {
    var w = window.open('', '_blank');
    if (!w) { App.toast('Permita janelas pop-up para imprimir.', 'erro'); return; }
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Folhas de presença</title><style>@page{size:A4;margin:0}html,body{margin:0}.p{width:210mm;height:297mm;overflow:hidden;page-break-after:always;break-after:page}.p:last-child{page-break-after:auto}svg{display:block}' +
      '@media screen{body{background:#999}.p{background:#fff;margin:10px auto}.aviso{font-family:sans-serif;background:#FBEFC8;padding:10px;text-align:center}}@media print{.aviso{display:none}}</style></head><body>' +
      '<div class="aviso">Imprima em A4, escala 100% ("tamanho real"), sem ajustar à página. Não corte os quadrados pretos dos cantos.</div>' +
      folhas.map(function (f) { return '<div class="p">' + App.svgFolha(f, base() + 'icones/logo.png') + '</div>'; }).join('') +
      '<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>';
    w.document.write(html); w.document.close();
  }

  /* ---------- Leitura da folha escaneada ---------- */
  function cinza(img) { var d = img.data, n = img.width * img.height, g = new Uint8Array(n); for (var i = 0; i < n; i++) g[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0; return g; }
  function branco(g) { var h = new Array(256).fill(0); for (var i = 0; i < g.length; i += 7) h[g[i]]++; var tot = 0, alvo = g.length / 7 * 0.9, s = 0; for (var v = 0; v < 256; v++) { s += h[v]; if (s >= alvo) return v; } return 230; }

  /** Acha os quatro quadrados pretos dos cantos. Devolve os centros em pixels da imagem original. */
  function acharMarcas(canvas) {
    var W = 700, esc2 = W / canvas.width, H = Math.round(canvas.height * esc2);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var cx = c.getContext('2d'); cx.drawImage(canvas, 0, 0, W, H);
    var g = cinza(cx.getImageData(0, 0, W, H)), lim = branco(g) * 0.5;
    var ladoEsp = G.lado / 210 * W, areaEsp = ladoEsp * ladoEsp;
    var visto = new Uint8Array(W * H);
    var cantos = [[0, 0], [W, 0], [0, H], [W, H]], res = [];
    cantos.forEach(function (ct, k) {
      var x0 = k % 2 ? Math.round(W * 0.7) : 0, x1 = k % 2 ? W : Math.round(W * 0.3), y0 = k < 2 ? 0 : Math.round(H * 0.78), y1 = k < 2 ? Math.round(H * 0.22) : H;
      var melhor = null;
      for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
        var i = y * W + x;
        if (visto[i] || g[i] > lim) continue;
        var fila = [i], area = 0, sx = 0, sy = 0, minx = x, maxx = x, miny = y, maxy = y; visto[i] = 1;
        while (fila.length) {
          var p = fila.pop(), px = p % W, py = (p / W) | 0; area++; sx += px; sy += py;
          if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
          if (area > areaEsp * 6) continue;
          [p - 1, p + 1, p - W, p + W].forEach(function (q) { var qx = q % W, qy = (q / W) | 0; if (q >= 0 && q < W * H && !visto[q] && g[q] <= lim && qx >= x0 && qx < x1 && qy >= y0 && qy < y1 && Math.abs(qx - px) <= 1) { visto[q] = 1; fila.push(q); } });
        }
        var bw = maxx - minx + 1, bh = maxy - miny + 1;
        if (area < areaEsp * 0.25 || area > areaEsp * 4) continue;
        if (area / (bw * bh) < 0.6 || bw / bh < 0.6 || bw / bh > 1.6) continue;
        var cxm = sx / area, cym = sy / area, dist = Math.hypot(cxm - ct[0], cym - ct[1]);
        if (!melhor || dist < melhor.d) melhor = { x: cxm / esc2, y: cym / esc2, d: dist };
      }
      res.push(melhor);
    });
    return res.every(Boolean) ? res : null;
  }

  /** Homografia que leva pontos da folha (mm) para a imagem (px). */
  function homografia(de, para) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = de[i][0], y = de[i][1], u = para[i][0], v = para[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (var c = 0; c < 8; c++) {
      var piv = c; for (var r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      var tA = A[c]; A[c] = A[piv]; A[piv] = tA; var tb = b[c]; b[c] = b[piv]; b[piv] = tb;
      for (var r2 = 0; r2 < 8; r2++) if (r2 !== c) { var f = A[r2][c] / A[c][c]; for (var k = c; k < 8; k++) A[r2][k] -= f * A[c][k]; b[r2] -= f * b[c]; }
    }
    var h = b.map(function (v, i) { return v / A[i][i]; });
    return function (x, y) { var w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
  }

  /** Mede a tinta em cada quadro de assinatura. */
  App.lerAssinaturas = function (canvas, nLinhas) {
    var marcas = acharMarcas(canvas);
    if (!marcas) return null;
    var H = homografia(G.centros, marcas.map(function (m) { return [m.x, m.y]; }));
    var cx = canvas.getContext('2d'), img = cx.getImageData(0, 0, canvas.width, canvas.height), g = cinza(img), W = canvas.width, Hh = canvas.height;
    var lim = branco(g) * 0.62, h = G.altura(nLinhas), r = [], tinta = [];
    for (var i = 0; i < nLinhas; i++) {
      var yt = G.inicioLinhas + i * h + 1.3, yb = G.inicioLinhas + (i + 1) * h - 1.3, xt = G.assin[0] + 1.6, xb = G.assin[1] - 1.6, esc3 = 0, tot = 0;
      for (var y = yt; y <= yb; y += 0.3) for (var x = xt; x <= xb; x += 0.3) {
        var p = H(x, y), px = Math.round(p[0]), py = Math.round(p[1]);
        if (px < 0 || py < 0 || px >= W || py >= Hh) continue;
        tot++; if (g[py * W + px] < lim) esc3++;
      }
      var fr = tot ? esc3 / tot : 0;
      tinta.push(fr); r.push(fr > 0.012);
    }
    return { assinaturas: r, tinta: tinta };
  };

  function lerQr(canvas) {
    var cx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var tentar = function (x, y, w, h) { var d = cx.getImageData(x, y, w, h); var q = jsQR(d.data, w, h, { inversionAttempts: 'dontInvert' }); return q && /^GIRAOSOL\|/.test(q.data) ? q.data : null; };
    return tentar(Math.round(W * 0.6), 0, Math.round(W * 0.4), Math.round(H * 0.25)) || tentar(0, 0, W, Math.round(H * 0.35)) || tentar(0, 0, W, H);
  }

  function carregarLibs() {
    return Promise.all([U.carregarScript('lib/pdf.min.js'), U.carregarScript('lib/jsQR.js')]).then(function () { if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js'; });
  }
  /** Transforma os arquivos (PDF ou imagens) em uma lista de canvases, uma por página. */
  function paginas(arquivos, progresso) {
    var lista = [];
    return arquivos.reduce(function (p, arq) {
      return p.then(function () {
        if (arq.type === 'application/pdf' || /\.pdf$/i.test(arq.name)) {
          return arq.arrayBuffer().then(function (buf) { return pdfjsLib.getDocument({ data: buf }).promise; }).then(function (pdf) {
            var seq = Promise.resolve();
            for (var n = 1; n <= pdf.numPages; n++) (function (n) {
              seq = seq.then(function () { return pdf.getPage(n); }).then(function (pg) {
                var v = pg.getViewport({ scale: 1 }), s = 1700 / v.width, vp = pg.getViewport({ scale: s });
                var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
                return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () { lista.push({ canvas: c, origem: arq.name + ' · pág. ' + n }); progresso(lista.length); });
              });
            })(n);
            return seq;
          });
        }
        return new Promise(function (ok, falha) {
          var im = new Image(); im.onload = function () { var s = Math.min(1, 1700 / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); lista.push({ canvas: c, origem: arq.name }); progresso(lista.length); ok(); };
          im.onerror = function () { falha(new Error('Não foi possível abrir ' + arq.name)); }; im.src = URL.createObjectURL(arq);
        });
      });
    }, Promise.resolve()).then(function () { return lista; });
  }
  function jpeg(canvas) { var s = Math.min(1, 1240 / canvas.width), c = document.createElement('canvas'); c.width = Math.round(canvas.width * s); c.height = Math.round(canvas.height * s); c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.72).split(',')[1]; }

  /* ---------- Tela ---------- */
  var ROT_SIT = { impressa: ['Aguardando folha assinada', 's-neu'], ok: ['Confere com a agenda', 's-ok'], divergente: ['Divergência', 's-ruim'], resolvida: ['Resolvida', 's-azul'] };
  App.tela('presenca', {
    titulo: 'Listas de presença', perfis: ['admin', 'financeiro', 'secretaria'],
    render: function (ctx) {
      var c = ctx.q.mes || U.comp();
      ctx.dados.mes = c;
      return App.api('listas.listar', { competencia: c }).then(function (l) {
        ctx.dados.listas = l;
        var cont = {}; l.forEach(function (x) { cont[x.situacao] = (cont[x.situacao] || 0) + 1; });
        var h = '<div class="linha"><label class="campo" style="flex-direction:row;align-items:center;gap:8px">Mês<select class="ent" data-muda="mes" style="width:auto">' + U.opcoesMeses(c) + '</select></label><span style="flex:1"></span>' +
          '<button class="btn" data-acao="imprimir">' + I('imprimir', 18) + 'Gerar e imprimir as folhas</button><button class="btn ama" data-acao="conferir">' + I('presenca', 18) + 'Conferir folhas assinadas</button></div>' +
          '<div class="alerta a-info">Uma folha por paciente e por profissional, só de fonoaudiologia. No fim do mês, escaneie todas as folhas assinadas num PDF só e envie em "Conferir folhas assinadas": o sistema lê o QR code de cada folha e compara as assinaturas com a agenda.</div>';
        if (!l.length) return h + '<div class="cartao vazio">Nenhuma folha gerada para ' + U.nomeMes(c) + '.</div>';
        h += '<div class="sub">' + l.length + ' folha(s) · ' + (cont.ok || 0) + ' conferem · ' + (cont.divergente || 0) + ' com divergência · ' + (cont.impressa || 0) + ' aguardando</div>';
        return h + '<div class="tabela-caixa"><table class="tab"><thead><tr><th>Paciente</th><th>Profissional</th><th>Sessões</th><th>Situação</th><th>Divergências</th><th></th></tr></thead><tbody>' + l.map(function (x) {
          var s = ROT_SIT[x.situacao] || [x.situacao, 's-neu'], div = (x.divergenciasAtuais || x.divergenciasJson || []).filter(function (d) { return d.tipo !== 'resolucao'; });
          if (x.situacao === 'divergente' && x.divergenciasAtuais && !x.divergenciasAtuais.length) s = ['Agenda já corrigida', 's-ok'];
          return '<tr><td class="b">' + esc(x.paciente) + '</td><td>' + esc(x.profissional) + '</td><td>' + (x.linhasJson || []).length + '</td><td><span class="selo ' + s[1] + '">' + s[0] + '</span></td>' +
            '<td class="peq">' + (x.situacao === 'resolvida' ? esc(((x.divergenciasJson || []).filter(function (d) { return d.tipo === 'resolucao'; }).pop() || {}).texto || '') : div.map(function (d) { return esc(d.texto); }).join('<br>')) + '</td>' +
            '<td><div class="linha">' + (x.digitalizadaAnexoId ? '<button class="btn peq" data-acao="ver" data-id="' + x.digitalizadaAnexoId + '">Ver folha</button>' : '') + (x.situacao === 'divergente' && div.length ? '<button class="btn peq cont" data-acao="resolver" data-id="' + x.id + '">Resolver</button>' : '') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
      });
    },
    acoes: {
      mes: function (el) { location.hash = '#/presenca?mes=' + el.value; },
      imprimir: function (el, ev, ctx) {
        el.disabled = true;
        Promise.all([U.carregarScript('lib/qrcode.js'), App.api('listas.gerar', { competencia: ctx.dados.mes })]).then(function (r) {
          el.disabled = false;
          if (!r[1].folhas.length) { App.toast('Nenhuma sessão de fonoaudiologia neste mês.', 'erro'); return; }
          imprimirFolhas(r[1].folhas); ctx.recarregar();
        }, function (e) { el.disabled = false; App.toast(e.message, 'erro'); });
      },
      ver: function (el) { App.api('anexos.baixar', { id: el.getAttribute('data-id') }).then(function (a) { U.abrir(a.mime, a.base64); }, function (e) { App.toast(e.message, 'erro'); }); },
      resolver: function (el, ev, ctx) {
        App.confirmar('Explique como a divergência foi resolvida (ex.: "a mãe esqueceu de assinar; presença confirmada pela profissional"). Se a agenda estava errada, corrija a sessão na agenda.', { campo: 'Como foi resolvido', botao: 'Marcar como resolvida' })
          .then(function (obs) { if (obs) App.chamar('listas.resolver', { listaId: el.getAttribute('data-id'), observacao: obs }, 'Divergência resolvida.').then(function (r) { if (r) ctx.recarregar(); }); });
      },
      conferir: function (el, ev, ctx) { abrirConferencia(ctx); }
    }
  });

  function abrirConferencia(ctx) {
    var m = App.modal({ titulo: 'Conferir folhas assinadas', largo: true, fixo: true, corpo:
      '<div class="alerta a-info">Escolha o PDF escaneado com todas as folhas (ou as fotos). A leitura acontece neste computador; nada é enviado antes da sua confirmação.</div>' +
      '<label class="campo">Arquivo(s)<input class="ent" type="file" id="arq-folhas" accept="application/pdf,image/*" multiple></label><div id="res-folhas"></div>',
      acoes: {
        enviar: function (b) {
          var itens = m.dados.itens.filter(function (x) { return x.lista; });
          if (!itens.length) { App.toast('Nenhuma folha identificada.', 'erro'); return; }
          b.disabled = true;
          var feitas = 0, divergentes = 0;
          itens.reduce(function (p, it) {
            return p.then(function () {
              var marc = Array.prototype.map.call(m.el.querySelectorAll('[data-pag="' + it.idx + '"]'), function (c) { return c.checked; });
              return App.api('anexos.enviar', { tipo: 'folha', nome: 'Folha ' + it.lista.paciente + ' ' + ctx.dados.mes + '.jpg', mime: 'image/jpeg', base64: jpeg(it.canvas) })
                .then(function (an) { return App.api('listas.conferir', { listaId: it.lista.id, assinaturas: marc, anexoId: an.id }); })
                .then(function (r) { feitas++; if (r.situacao === 'divergente') divergentes++; b.textContent = 'Enviando… ' + feitas + '/' + itens.length; });
            });
          }, Promise.resolve()).then(function () {
            App.toast(feitas + ' folha(s) conferida(s). ' + (divergentes ? divergentes + ' com divergência.' : 'Tudo confere com a agenda.'), divergentes ? 'erro' : 'ok');
            m.fechar(); ctx.recarregar();
          }, function (e) { App.toast(e.message, 'erro'); b.disabled = false; });
        },
        escolherLista: function (sel) {
          var it = m.dados.itens[Number(sel.getAttribute('data-idx'))];
          it.lista = ctx.dados.listas.filter(function (l) { return l.id === sel.value; })[0] || null;
          if (it.lista) { var n = it.lista.linhasJson.length + 4; var lido = App.lerAssinaturas(it.canvas, n); it.leitura = lido; }
          mostrar();
        }
      } });
    m.dados.itens = [];
    function mostrar() {
      var itens = m.dados.itens, ok = itens.filter(function (x) { return x.lista; }).length;
      var h = '<div class="sub">' + itens.length + ' página(s) lida(s) · ' + ok + ' identificada(s). Confira as marcações e corrija se precisar antes de enviar.</div>';
      itens.forEach(function (it, idx) {
        it.idx = idx;
        var thumb = it.canvas.toDataURL('image/jpeg', 0.4);
        h += '<div class="cartao" style="flex-direction:row;flex-wrap:wrap;gap:14px;align-items:flex-start"><img src="' + thumb + '" alt="Página ' + (idx + 1) + '" style="width:140px;border:1px solid var(--borda);border-radius:6px">' +
          '<div style="flex:1;min-width:240px" class="pilha"><div class="sub peq">' + esc(it.origem) + '</div>';
        if (!it.lista) {
          h += '<div class="alerta a-aviso">QR code não lido. Escolha de quem é a folha:</div><select class="ent" data-muda="escolherLista" data-idx="' + idx + '">' + U.opcoes(ctx.dados.listas.map(function (l) { return { v: l.id, t: l.paciente + ' · ' + l.profissional }; }), '', 'Escolha…') + '</select>';
        } else {
          var linhas = it.lista.linhasJson, n = linhas.length + 4, a = it.leitura ? it.leitura.assinaturas : new Array(n).fill(false);
          h += '<b>' + esc(it.lista.paciente) + ' · ' + esc(it.lista.profissional) + '</b>' + (!it.leitura ? '<div class="alerta a-aviso">Não achei os quadrados dos cantos; marque as assinaturas à mão.</div>' : '') +
            '<div class="linha" style="gap:6px 14px">' + a.map(function (v, i) { var l = linhas[i]; return '<label class="marcar peq"><input type="checkbox" data-pag="' + idx + '"' + (v ? ' checked' : '') + '>' + (l ? U.dataBr(l.data).slice(0, 5) + ' ' + l.hora : 'Linha ' + (i + 1) + ' (reposição)') + '</label>'; }).join('') + '</div>';
        }
        h += '</div></div>';
      });
      h += '<div class="linha fim"><button class="btn" data-acao="_fechar">Cancelar</button><button class="btn pri" data-acao="enviar"' + (ok ? '' : ' disabled') + '>Enviar conferência (' + ok + ')</button></div>';
      m.el.querySelector('#res-folhas').innerHTML = h;
    }
    m.el.querySelector('#arq-folhas').addEventListener('change', function (ev) {
      var arqs = Array.prototype.slice.call(ev.target.files);
      if (!arqs.length) return;
      var res = m.el.querySelector('#res-folhas');
      res.innerHTML = '<div class="carregando"><div class="giro"></div><span id="prog">Abrindo arquivos…</span></div>';
      carregarLibs().then(function () { return paginas(arqs, function (n) { var p = document.getElementById('prog'); if (p) p.textContent = 'Lendo página ' + n + '…'; }); }).then(function (pgs) {
        m.dados.itens = pgs.map(function (pg) {
          var qr = lerQr(pg.canvas), id = qr ? qr.split('|')[1] : null;
          var lista = id ? ctx.dados.listas.filter(function (l) { return l.id === id; })[0] : null;
          return { canvas: pg.canvas, origem: pg.origem, lista: lista || null, leitura: lista ? App.lerAssinaturas(pg.canvas, lista.linhasJson.length + 4) : null, qrOutroMes: !!id && !lista };
        });
        if (m.dados.itens.some(function (x) { return x.qrOutroMes; })) App.toast('Há folha de outro mês no arquivo. Confira o mês escolhido.', 'erro');
        mostrar();
      }).catch(function (e) { res.innerHTML = '<div class="alerta a-erro">' + esc(e.message) + '</div>'; });
    });
  }
})();
