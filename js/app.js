(function () {
  'use strict';

  /* ---------- Estado y almacenamiento ---------- */
  var KEY = 'morp_datos_v1';
  var KEY_TEMA = 'morp_tema';
  var estado = { buques: [], turno: null };
  var ruta = { vista: 'turno', id: null, filtro: '' };
  var cbConfirmar = null;
  var datosImport = null;
  var toastT = null;

  var vistaEl = document.getElementById('vista');
  var modalEl = document.getElementById('modal');
  var toastEl = document.getElementById('toast');
  var navEl = document.getElementById('nav');
  var archivoEl = document.getElementById('archivo');
  var pdfEl = document.getElementById('pdfzona');

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function leer(k, def) {
    try { var v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; }
  }
  function escribir(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function num(v, min, max, def) {
    var n = parseInt(v, 10);
    if (isNaN(n)) { return def; }
    return Math.max(min, Math.min(max, n));
  }
  function lado(v) { return (v === 'proa' || v === 'popa') ? v : ''; }

  function normBahia(b) {
    b = (b && typeof b === 'object') ? b : {};
    var cub = num(b.ancho_cub, 1, 30, 12);
    return {
      id: (typeof b.id === 'string' && b.id) ? b.id : uid(),
      num: String(b.num == null ? '' : b.num).slice(0, 10),
      anexo: !!b.anexo,
      ancho_cub: cub,
      ancho_bod: num(b.ancho_bod, 0, 30, Math.max(cub - 2, 0)),
      enc_cub: lado(b.enc_cub),
      enc_bod: lado(b.enc_bod),
      nota: String(b.nota || '').slice(0, 300)
    };
  }
  function normBuque(b) {
    if (!b || typeof b !== 'object') { return null; }
    var bs = Array.isArray(b.bahias) ? b.bahias : [];
    return {
      id: (typeof b.id === 'string' && b.id) ? b.id : uid(),
      nombre: String(b.nombre || 'Sin nombre').slice(0, 60),
      notas: String(b.notas || '').slice(0, 300),
      grupo: !!b.grupo,
      creado: typeof b.creado === 'number' ? b.creado : Date.now(),
      bahias: bs.map(normBahia)
    };
  }
  function normalizar(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.buques)) { return null; }
    var lista = [];
    for (var i = 0; i < o.buques.length; i++) {
      var n = normBuque(o.buques[i]);
      if (n) { lista.push(n); }
    }
    var turno = (typeof o.turno === 'string') ? o.turno : null;
    var existe = false;
    for (var j = 0; j < lista.length; j++) { if (lista[j].id === turno) { existe = true; } }
    return { buques: lista, turno: existe ? turno : null };
  }
  function cargar() {
    var t = leer(KEY, null);
    if (!t) { return; }
    try {
      var n = normalizar(JSON.parse(t));
      if (n) { estado = n; }
    } catch (e) { /* datos dañados: se empieza vacío */ }
  }
  function guardar() {
    if (!escribir(KEY, JSON.stringify(estado))) { toast('No se pudo guardar en el teléfono'); }
  }

  function buscarBuque(id) {
    for (var i = 0; i < estado.buques.length; i++) {
      if (estado.buques[i].id === id) { return estado.buques[i]; }
    }
    return null;
  }
  function buqueActual() {
    if (ruta.vista === 'turno') { return buscarBuque(estado.turno); }
    if (ruta.vista === 'buque') { return buscarBuque(ruta.id); }
    return null;
  }
  function buscarBahia(b, id) {
    for (var i = 0; i < b.bahias.length; i++) {
      if (b.bahias[i].id === id) { return b.bahias[i]; }
    }
    return null;
  }

  /* ---------- Utilidades ---------- */
  var IC = {
    atras: '<path d="M15 18l-6-6 6-6"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    arriba: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    abajo: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    barco: '<path d="M3 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M5 14l1.5-6h11L19 14M12 8V3h4"/>',
    pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    buscar: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
    cambiar: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    capas: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    flecha: '<path d="M9 6l6 6-6 6"/>',
    ancla: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M5 14H3a9 9 0 0 0 18 0h-2"/>',
    enchufe: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>'
  };
  function ic(n, clase) {
    return '<svg class="ic ' + (clase || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>';
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('ver');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('ver'); }, 2300);
  }
  function hoy() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var dia = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dia < 10 ? '0' : '') + dia;
  }
  function nombreArchivo(t) {
    var s = String(t || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'buque';
  }
  function quitarCeros(s) { return String(s).replace(/^0+/, ''); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function padN(v, largo) {
    var t = String(v);
    while (t.length < largo) { t = '0' + t; }
    return t;
  }
  function siguienteNum(n, grupo) {
    if (/^\d+$/.test(String(n))) {
      return padN(parseInt(n, 10) + (grupo ? 4 : 1), String(n).length);
    }
    return '';
  }
  /* Con grupos de 3: la bahía 06 son los números 05, 06 y 07 (el par del medio es el principal) */
  function miembros(x, grupo) {
    var t = String(x.num);
    if (grupo && /^\d+$/.test(t)) {
      var n = parseInt(t, 10);
      if (n >= 2 && n % 2 === 0) {
        var largo = Math.max(t.length, 2);
        return [padN(n - 1, largo), padN(n, largo), padN(n + 1, largo)];
      }
    }
    return [t];
  }
  function cercano(el, attr) {
    while (el && el.nodeType === 1) {
      if (el.hasAttribute(attr)) { return el; }
      el = el.parentNode;
    }
    return null;
  }

  /* ---------- Piezas de interfaz ---------- */
  function textoEnc(v) { return v === 'proa' ? 'Proa' : (v === 'popa' ? 'Popa' : 'Sin refer'); }
  function badgeEnc(v) {
    var i = v === 'proa' ? ic('arriba') : (v === 'popa' ? ic('abajo') : '');
    return '<span class="enc enc-' + (v || 'none') + '">' + i + textoEnc(v) + '</span>';
  }
  function celdas(n, v) {
    var h = '';
    for (var i = 0; i < n; i++) { h += '<i class="cel"></i>'; }
    return '<div class="celdas enc-' + (v || 'none') + '">' + h + '</div>';
  }
  function filaBahia(etq, n, v) {
    if (n < 1) {
      return '<div class="fila"><div class="f-cab"><span class="f-etq">' + etq + '</span></div><div class="sin-bodega">Sin posiciones</div></div>';
    }
    return '<div class="fila"><div class="f-cab"><span class="f-etq">' + etq + '<span>' + n + '</span></span>' + badgeEnc(v) + '</div>' + celdas(n, v) + '</div>';
  }
  function htmlBahia(x, grupo) {
    var m = miembros(x, grupo);
    var izq;
    if (m.length === 3) {
      izq = '<div class="b-num b-grupo"><small>' + esc(m[0]) + '</small><span>' + esc(m[1]) + '</span><small>' + esc(m[2]) + '</small>' + (x.anexo ? '<em>Anexo</em>' : '') + '</div>';
    } else {
      izq = '<div class="b-num"><span>' + esc(x.num || '?') + '</span>' + (x.anexo ? '<small>Anexo</small>' : '<small>Bahía</small>') + '</div>';
    }
    return '<button type="button" class="bahia" data-acc="editar-bahia" data-id="' + esc(x.id) + '">' + izq +
      '<div class="b-cuerpo">' + filaBahia('Cubierta', x.ancho_cub, x.enc_cub) + filaBahia('Bodega', x.ancho_bod, x.enc_bod) +
      (x.nota ? '<div class="b-nota">' + esc(x.nota) + '</div>' : '') + '</div></button>';
  }
  function coincide(x, filtro, grupo) {
    var f = String(filtro).replace(/^\s+|\s+$/g, '').toLowerCase();
    if (!f) { return true; }
    var m = miembros(x, grupo);
    var fz = quitarCeros(f);
    for (var i = 0; i < m.length; i++) {
      var n = m[i].toLowerCase();
      if (/^\d+$/.test(n)) {
        if (fz === '' ? n.indexOf(f) === 0 : quitarCeros(n).indexOf(fz) === 0) { return true; }
      } else if (n.indexOf(f) > -1) { return true; }
    }
    return false;
  }
  function htmlLista(b) {
    if (!b.bahias.length) {
      return '<div class="vacio"><h2>Sin bahías todavía</h2><p>Agrega la primera bahía de este buque.</p><button type="button" class="btn btn-prim" data-acc="nueva-bahia">Agregar bahía</button></div>';
    }
    var h = '';
    for (var i = 0; i < b.bahias.length; i++) {
      if (coincide(b.bahias[i], ruta.filtro, b.grupo)) { h += htmlBahia(b.bahias[i], b.grupo); }
    }
    if (!h) { h = '<div class="vacio"><h2>No hay esa bahía</h2><p>Revisa el número que escribiste.</p></div>'; }
    return h;
  }
  function ib(acc, icono, nombre, extra, id, vista) {
    return '<button type="button" class="ibtn' + (extra || '') + '" data-acc="' + acc + '"' + (id ? ' data-id="' + esc(id) + '"' : '') +
      (vista ? ' data-vista="' + vista + '"' : '') + ' aria-label="' + nombre + '" title="' + nombre + '">' + ic(icono) + '</button>';
  }
  function htmlBuque(b, home) {
    var turno = estado.turno === b.id;
    var h = '<section class="pantalla">';
    if (!home) { h += '<button type="button" class="atras" data-acc="ir" data-vista="buques">' + ic('atras') + 'Buques</button>'; }
    h += '<div class="cab"><div>' + (turno ? '<div class="pill-turno">En turno</div>' : '') +
      '<h1 class="titulo">' + esc(b.nombre) + '</h1><p class="sub">' + b.bahias.length + (b.bahias.length === 1 ? ' bahía' : ' bahías') +
      (b.notas ? ' · ' + esc(b.notas) : '') + '</p></div></div>';
    h += '<div class="barra" role="toolbar" aria-label="Acciones">';
    if (home) {
      h += ib('ir', 'cambiar', 'Cambiar de buque', '', null, 'buques');
    } else {
      h += ib('turno-toggle', 'ancla', turno ? 'Quitar de turno' : 'Poner en turno', turno ? ' activo' : '', b.id);
    }
    h += ib('nueva-bahia', 'mas', 'Agregar bahía') + ib('aplicar-todas', 'enchufe', 'Enchufe de todas las bahías') +
      ib('pdf', 'pdf', 'Crear PDF') + ib('editar-buque', 'editar', 'Editar buque') + '</div>';
    h += '<div class="leyenda"><span>Enchufe hacia</span>' + badgeEnc('proa') + badgeEnc('popa') + '</div>' +
      '<p class="pista">Toca una bahía para editarla.</p>';
    h += '<label class="buscar">' + ic('buscar') + '<input id="filtro" type="search" autocomplete="off" placeholder="Buscar bahía (ejemplo: 25)" value="' + esc(ruta.filtro) + '"></label>';
    h += '<div id="lista">' + htmlLista(b) + '</div></section>';
    return h;
  }
  function htmlVacioTurno() {
    return '<section class="pantalla"><div class="vacio">' + ic('barco', 'ic-grande') +
      '<h2>No hay buque en turno</h2><p>Elige el buque que están trabajando para verlo aquí al abrir MORP.</p>' +
      '<button type="button" class="btn btn-prim" data-acc="ir" data-vista="buques">' + (estado.buques.length ? 'Elegir buque' : 'Agregar buque') + '</button></div></section>';
  }
  function htmlBuques() {
    var h = '<section class="pantalla"><div class="cab"><h1 class="titulo">Buques</h1></div>' +
      '<div class="fila-acc"><button type="button" class="chip" data-acc="nuevo-buque">' + ic('mas') + 'Nuevo buque</button></div>';
    if (!estado.buques.length) {
      h += '<div class="vacio">' + ic('barco', 'ic-grande') + '<h2>Aún no hay buques</h2><p>Registra un buque con sus bahías y la posición de los enchufes refer.</p>' +
        '<button type="button" class="btn btn-prim" data-acc="nuevo-buque">Agregar buque</button></div>';
    }
    for (var i = 0; i < estado.buques.length; i++) {
      var b = estado.buques[i];
      var t = estado.turno === b.id;
      h += '<button type="button" class="item-buque' + (t ? ' turno' : '') + '" data-acc="abrir-buque" data-id="' + esc(b.id) + '"><div>' +
        (t ? '<div class="pill-turno">En turno</div>' : '') +
        '<div class="nombre">' + esc(b.nombre) + '</div><div class="det">' + b.bahias.length + (b.bahias.length === 1 ? ' bahía' : ' bahías') + '</div></div>' + ic('flecha') + '</button>';
    }
    return h + '</section>';
  }
  function htmlAjustes() {
    var noche = (document.documentElement.getAttribute('data-tema') !== 'dia');
    return '<section class="pantalla"><div class="cab"><h1 class="titulo">Ajustes</h1></div>' +
      '<div class="bloque"><h2>Apariencia</h2><p>El modo noche descansa la vista en los turnos nocturnos.</p>' +
      '<div class="seg"><button type="button" class="' + (noche ? 'on' : '') + '" data-acc="tema" data-v="noche">Noche</button>' +
      '<button type="button" class="' + (noche ? '' : 'on') + '" data-acc="tema" data-v="dia">Día</button></div></div>' +
      '<div class="bloque"><h2>Respaldo</h2><p>Guarda tus buques en un archivo JSON para no perderlos si cambias de teléfono.</p>' +
      '<div class="botones-col"><button type="button" class="btn btn-prim btn-bloque" data-acc="exportar">Guardar respaldo</button>' +
      '<button type="button" class="btn btn-bloque" data-acc="importar">Restaurar respaldo</button></div></div>' +
      '<div class="bloque"><h2>Datos</h2><p>Todo se guarda solo en este teléfono y funciona sin internet.</p>' +
      '<button type="button" class="btn btn-peligro btn-bloque" data-acc="borrar-todo">Borrar todos los datos</button></div></section>';
  }

  function render(conservar) {
    var y = conservar ? vistaEl.scrollTop : 0;
    var h = '';
    if (ruta.vista === 'turno') {
      var bt = buscarBuque(estado.turno);
      h = bt ? htmlBuque(bt, true) : htmlVacioTurno();
    } else if (ruta.vista === 'buques') {
      h = htmlBuques();
    } else if (ruta.vista === 'buque') {
      var b = buscarBuque(ruta.id);
      if (!b) { ruta.vista = 'buques'; ruta.id = null; return render(false); }
      h = htmlBuque(b, false);
    } else {
      h = htmlAjustes();
    }
    vistaEl.innerHTML = h;
    vistaEl.scrollTop = y;
    var botones = navEl.querySelectorAll('button');
    var activo = ruta.vista === 'buque' ? 'buques' : ruta.vista;
    for (var i = 0; i < botones.length; i++) {
      if (botones[i].getAttribute('data-vista') === activo) { botones[i].classList.add('on'); }
      else { botones[i].classList.remove('on'); }
    }
  }
  function ir(vista, id) {
    ruta.vista = vista;
    ruta.id = id || null;
    ruta.filtro = '';
    render(false);
  }

  /* ---------- Ventanas propias ---------- */
  function abrirModal(html) {
    toastEl.classList.remove('ver');
    modalEl.innerHTML = '<div class="velo"><div class="hoja" role="dialog" aria-modal="true">' + html + '</div></div>';
    modalEl.hidden = false;
  }
  function cerrarModal() {
    modalEl.hidden = true;
    modalEl.innerHTML = '';
  }
  function confirmar(titulo, texto, etq, fn) {
    cbConfirmar = fn;
    abrirModal('<h2>' + esc(titulo) + '</h2><p>' + esc(texto) + '</p><div class="botones"><button type="button" class="btn" data-acc="cerrar">Cancelar</button>' +
      '<button type="button" class="btn btn-peligro" data-acc="confirmar-ok">' + esc(etq) + '</button></div>');
  }
  function seg(grupo, opciones, actual, extra) {
    var h = '<div class="seg ' + (extra || '') + '" data-grupo="' + grupo + '">';
    for (var i = 0; i < opciones.length; i++) {
      h += '<button type="button" data-val="' + opciones[i][0] + '" class="' + (opciones[i][0] === actual ? 'on' : '') + '">' + opciones[i][1] + '</button>';
    }
    return h + '</div>';
  }
  function valSeg(grupo) {
    var e = modalEl.querySelector('.seg[data-grupo="' + grupo + '"] .on');
    return e ? e.getAttribute('data-val') : '';
  }
  function stepper(id, val, min, max) {
    return '<div class="stepper"><button type="button" data-paso="-1" data-t="' + id + '" aria-label="Menos">&minus;</button>' +
      '<input id="' + id + '" type="number" inputmode="numeric" min="' + min + '" max="' + max + '" value="' + val + '">' +
      '<button type="button" data-paso="1" data-t="' + id + '" aria-label="Más">+</button></div>';
  }
  function leerNum(id, min, max, def) {
    var e = document.getElementById(id);
    return num(e ? e.value : '', min, max, def);
  }
  function ajustarCub() {
    var c = document.getElementById('f-cub');
    var bo = document.getElementById('f-bod');
    if (!c || !bo) { return; }
    var nuevo = parseInt(c.value, 10);
    if (isNaN(nuevo)) { return; }
    var prev = parseInt(c.getAttribute('data-prev'), 10);
    var bv = parseInt(bo.value, 10);
    if (!isNaN(prev) && bv === Math.max(prev - 2, 0)) { bo.value = Math.max(nuevo - 2, 0); }
    c.setAttribute('data-prev', nuevo);
  }
  var OPC_ENC = [['proa', 'Proa'], ['popa', 'Popa'], ['', 'Sin refer']];

  function modalBuqueNuevo() {
    abrirModal('<h2>Nuevo buque</h2>' +
      '<div class="campo"><label for="f-nombre">Nombre del buque</label><input id="f-nombre" type="text" maxlength="60" autocomplete="off" placeholder="Ejemplo: Chiquita Grower"></div>' +
      '<div class="campo"><div class="etq">¿Cuántas bahías tiene?</div>' + stepper('f-n', 20, 1, 80) + '</div>' +
      '<div class="dos"><div class="campo"><div class="etq">Cubierta</div>' + stepper('f-cub', 12, 1, 30) + '</div>' +
      '<div class="campo"><div class="etq">Bodega</div>' + stepper('f-bod', 10, 0, 30) + '</div></div>' +
      '<p class="ayuda" style="margin-top:6px;font-size:14px">Cuántos contenedores caben de izquierda a derecha. Después puedes cambiar cada bahía.</p>' +
      '<div class="campo"><div class="etq">Enchufe en cubierta</div>' + seg('enc-cub', OPC_ENC, '', 'seg-enc') + '</div>' +
      '<div class="campo"><div class="etq">Enchufe en bodega</div>' + seg('enc-bod', OPC_ENC, '', 'seg-enc') + '</div>' +
      '<div class="campo"><div class="etq">¿Lo están trabajando ahora?</div>' + seg('turno', [['si', 'Sí'], ['no', 'No']], 'si') + '</div>' +
      '<div class="botones"><button type="button" class="btn" data-acc="cerrar">Cancelar</button><button type="button" class="btn btn-prim" data-acc="guardar-buque-nuevo">Crear buque</button></div>');
    document.getElementById('f-cub').setAttribute('data-prev', '12');
  }
  function guardarBuqueNuevo() {
    var nombre = document.getElementById('f-nombre').value.replace(/^\s+|\s+$/g, '');
    if (!nombre) { toast('Escribe el nombre del buque'); return; }
    var n = leerNum('f-n', 1, 80, 1);
    var cub = leerNum('f-cub', 1, 30, 12);
    var bod = leerNum('f-bod', 0, 30, Math.max(cub - 2, 0));
    var ec = valSeg('enc-cub');
    var eb = valSeg('enc-bod');
    var modo = 'g';
    var bahias = [];
    for (var i = 0; i < n; i++) {
      var v = modo === 'g' ? 2 + 4 * i : (modo === '2' ? 1 + 2 * i : 1 + i);
      bahias.push(normBahia({ num: padN(v, 2), ancho_cub: cub, ancho_bod: bod, enc_cub: ec, enc_bod: eb }));
    }
    var b = normBuque({ nombre: nombre, grupo: modo === 'g', bahias: bahias });
    estado.buques.push(b);
    var turno = valSeg('turno') === 'si';
    if (turno) { estado.turno = b.id; }
    guardar();
    cerrarModal();
    if (turno) { ir('turno'); } else { ir('buque', b.id); }
    toast('Buque creado');
  }

  function modalBuqueEditar() {
    var b = buqueActual();
    if (!b) { return; }
    abrirModal('<h2>Editar buque</h2>' +
      '<div class="campo"><label for="f-nombre">Nombre del buque</label><input id="f-nombre" type="text" maxlength="60" autocomplete="off" value="' + esc(b.nombre) + '"></div>' +
      '<div class="campo"><label for="f-notas">Nota (opcional)</label><input id="f-notas" type="text" maxlength="300" autocomplete="off" value="' + esc(b.notas) + '"></div>' +
      '<div class="campo"><div class="etq">Bahías de 3 números</div>' + seg('grupo', [['si', 'Sí'], ['no', 'No']], b.grupo ? 'si' : 'no') +
      '<p class="ayuda">Sí: la bahía 06 se ve como 05 · 06 · 07.</p></div>' +
      '<div class="botones"><button type="button" class="btn" data-acc="cerrar">Cancelar</button><button type="button" class="btn btn-prim" data-acc="guardar-buque-edit">Guardar</button></div>' +
      '<div class="botones"><button type="button" class="btn btn-peligro" data-acc="borrar-buque">Eliminar buque</button></div>');
  }
  function guardarBuqueEdit() {
    var b = buqueActual();
    if (!b) { return; }
    var nombre = document.getElementById('f-nombre').value.replace(/^\s+|\s+$/g, '');
    if (!nombre) { toast('Escribe el nombre del buque'); return; }
    b.nombre = nombre.slice(0, 60);
    b.notas = document.getElementById('f-notas').value.slice(0, 300);
    b.grupo = valSeg('grupo') === 'si';
    guardar();
    cerrarModal();
    render(true);
    toast('Cambios guardados');
  }
  function borrarBuque() {
    var b = buqueActual();
    if (!b) { return; }
    var id = b.id;
    confirmar('¿Eliminar este buque?', 'Se borrará "' + b.nombre + '" con todas sus bahías. No se puede deshacer.', 'Eliminar', function () {
      var lista = [];
      for (var i = 0; i < estado.buques.length; i++) { if (estado.buques[i].id !== id) { lista.push(estado.buques[i]); } }
      estado.buques = lista;
      if (estado.turno === id) { estado.turno = null; }
      guardar();
      ir('buques');
      toast('Buque eliminado');
    });
  }

  function modalBahia(idBahia) {
    var b = buqueActual();
    if (!b) { return; }
    var x = idBahia ? buscarBahia(b, idBahia) : null;
    var nueva = !x;
    if (nueva) {
      var u = b.bahias.length ? b.bahias[b.bahias.length - 1] : null;
      x = { num: u ? siguienteNum(u.num, b.grupo) : (b.grupo ? '02' : '01'), anexo: false, ancho_cub: u ? u.ancho_cub : 12, ancho_bod: u ? u.ancho_bod : 10, enc_cub: u ? u.enc_cub : '', enc_bod: u ? u.enc_bod : '', nota: '' };
    }
    abrirModal('<h2>' + (nueva ? 'Nueva bahía' : 'Bahía ' + esc(miembros(x, b.grupo).join(' · '))) + '</h2>' +
      '<div class="campo"><label for="f-num">' + (b.grupo ? 'Número del medio (par)' : 'Número de bahía') + '</label><input id="f-num" type="text" maxlength="10" autocomplete="off" value="' + esc(x.num) + '">' +
      (b.grupo ? '<p class="ayuda">Ejemplo: 06 para la bahía 05 · 06 · 07.</p>' : '') + '</div>' +
      '<div class="campo"><div class="etq">Tipo</div>' + seg('anexo', [['no', 'Normal'], ['si', 'Anexo']], x.anexo ? 'si' : 'no') + '</div>' +
      '<div class="campo"><div class="etq">Posiciones en cubierta</div>' + stepper('f-cub', x.ancho_cub, 1, 30) + '</div>' +
      '<div class="campo"><div class="etq">Enchufe en cubierta</div>' + seg('enc-cub', OPC_ENC, x.enc_cub, 'seg-enc') + '</div>' +
      '<div class="campo"><div class="etq">Posiciones en bodega</div>' + stepper('f-bod', x.ancho_bod, 0, 30) + '</div>' +
      '<div class="campo"><div class="etq">Enchufe en bodega</div>' + seg('enc-bod', OPC_ENC, x.enc_bod, 'seg-enc') + '</div>' +
      '<div class="campo"><label for="f-nota">Nota (opcional)</label><input id="f-nota" type="text" maxlength="300" autocomplete="off" value="' + esc(x.nota) + '"></div>' +
      '<div class="botones"><button type="button" class="btn" data-acc="cerrar">Cancelar</button><button type="button" class="btn btn-prim" data-acc="guardar-bahia" data-id="' + (nueva ? '' : esc(x.id)) + '">Guardar</button></div>' +
      (nueva ? '' : '<div class="botones"><button type="button" class="btn btn-peligro" data-acc="borrar-bahia" data-id="' + esc(x.id) + '">Eliminar bahía</button></div>'));
    document.getElementById('f-cub').setAttribute('data-prev', String(x.ancho_cub));
  }
  function guardarBahia(id) {
    var b = buqueActual();
    if (!b) { return; }
    var numero = document.getElementById('f-num').value.replace(/^\s+|\s+$/g, '');
    if (!numero) { toast('Escribe el número de bahía'); return; }
    var datos = {
      num: numero,
      anexo: valSeg('anexo') === 'si',
      ancho_cub: leerNum('f-cub', 1, 30, 12),
      ancho_bod: leerNum('f-bod', 0, 30, 10),
      enc_cub: valSeg('enc-cub'),
      enc_bod: valSeg('enc-bod'),
      nota: document.getElementById('f-nota').value
    };
    var x = id ? buscarBahia(b, id) : null;
    if (x) {
      datos.id = x.id;
      var n = normBahia(datos);
      for (var k in n) { if (n.hasOwnProperty(k)) { x[k] = n[k]; } }
    } else {
      b.bahias.push(normBahia(datos));
    }
    guardar();
    cerrarModal();
    render(true);
    toast('Bahía guardada');
  }
  function borrarBahia(id) {
    var b = buqueActual();
    if (!b) { return; }
    var x = buscarBahia(b, id);
    if (!x) { return; }
    confirmar('¿Eliminar la bahía ' + x.num + '?', 'No se puede deshacer.', 'Eliminar', function () {
      var lista = [];
      for (var i = 0; i < b.bahias.length; i++) { if (b.bahias[i].id !== id) { lista.push(b.bahias[i]); } }
      b.bahias = lista;
      guardar();
      render(true);
      toast('Bahía eliminada');
    });
  }

  var OPC_TODAS = [['keep', 'No cambiar'], ['proa', 'Proa'], ['popa', 'Popa'], ['none', 'Sin refer']];
  function modalAplicarTodas() {
    var b = buqueActual();
    if (!b) { return; }
    if (!b.bahias.length) { toast('Este buque no tiene bahías'); return; }
    abrirModal('<h2>Enchufe de todas las bahías</h2><p>Cambia las ' + b.bahias.length + ' bahías de una vez. Deja «No cambiar» en lo que no quieras tocar.</p>' +
      '<div class="campo"><div class="etq">Enchufe en cubierta</div>' + seg('todas-cub', OPC_TODAS, 'keep', 'seg-enc') + '</div>' +
      '<div class="campo"><div class="etq">Enchufe en bodega</div>' + seg('todas-bod', OPC_TODAS, 'keep', 'seg-enc') + '</div>' +
      '<div class="botones"><button type="button" class="btn" data-acc="cerrar">Cancelar</button><button type="button" class="btn btn-prim" data-acc="guardar-aplicar">Aplicar</button></div>');
  }
  function guardarAplicar() {
    var b = buqueActual();
    if (!b) { return; }
    var c = valSeg('todas-cub');
    var o = valSeg('todas-bod');
    if (c === 'keep' && o === 'keep') { cerrarModal(); return; }
    for (var i = 0; i < b.bahias.length; i++) {
      if (c !== 'keep') { b.bahias[i].enc_cub = (c === 'none') ? '' : c; }
      if (o !== 'keep') { b.bahias[i].enc_bod = (o === 'none') ? '' : o; }
    }
    guardar();
    cerrarModal();
    render(true);
    toast('Bahías actualizadas');
  }

  /* ---------- Respaldo JSON ---------- */
  function descargarBlob(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function exportarJSON() {
    var texto = JSON.stringify({ app: 'MORP', version: 1, fecha: new Date().toISOString(), datos: estado }, null, 2);
    var nombre = 'MORP-respaldo-' + hoy() + '.json';
    if (window.NativeSaveJSON) {
      Promise.resolve(window.NativeSaveJSON(texto, nombre)).catch(function (e) {
        var m = String(e && e.message ? e.message : e).toLowerCase();
        if (m.indexOf('cancel') === -1) { toast('No se pudo guardar el respaldo'); }
      });
    } else {
      try { descargarBlob(new Blob([texto], { type: 'application/json' }), nombre); toast('Respaldo descargado'); }
      catch (e) { toast('No se pudo guardar el respaldo'); }
    }
  }
  function leerArchivoImport() {
    var f = archivoEl.files && archivoEl.files[0];
    if (!f) { return; }
    var lector = new FileReader();
    lector.onload = function () {
      archivoEl.value = '';
      var n = null;
      try {
        var o = JSON.parse(String(lector.result));
        n = normalizar(o && o.datos ? o.datos : o);
      } catch (e) { n = null; }
      if (!n) { toast('Ese archivo no es un respaldo válido de MORP'); return; }
      datosImport = n;
      abrirModal('<h2>Restaurar respaldo</h2><p>El archivo trae ' + n.buques.length + (n.buques.length === 1 ? ' buque' : ' buques') + '. ¿Qué quieres hacer?</p>' +
        '<div class="botones-col"><button type="button" class="btn btn-prim" data-acc="import-agregar">Agregar a los buques actuales</button>' +
        '<button type="button" class="btn btn-peligro" data-acc="import-reemplazar">Reemplazar todo lo actual</button>' +
        '<button type="button" class="btn" data-acc="cerrar">Cancelar</button></div>');
    };
    lector.onerror = function () { archivoEl.value = ''; toast('No se pudo leer el archivo'); };
    lector.readAsText(f);
  }
  function importar(reemplazar) {
    if (!datosImport) { return; }
    if (reemplazar) {
      estado = datosImport;
    } else {
      for (var i = 0; i < datosImport.buques.length; i++) {
        var b = datosImport.buques[i];
        b.id = uid();
        for (var j = 0; j < b.bahias.length; j++) { b.bahias[j].id = uid(); }
        estado.buques.push(b);
      }
    }
    datosImport = null;
    guardar();
    cerrarModal();
    ir('buques');
    toast('Respaldo restaurado');
  }

  /* ---------- PDF ---------- */
  function encPdf(v) { return v === 'proa' ? 'PROA' : (v === 'popa' ? 'POPA' : '—'); }
  function htmlPDF(b) {
    var th = 'style="text-align:left;padding:6px 8px;border-bottom:2px solid #000;font-size:12px"';
    var td = 'style="padding:6px 8px;border-bottom:1px solid #bbb;font-size:13px;vertical-align:top"';
    var filas = '';
    for (var i = 0; i < b.bahias.length; i++) {
      var x = b.bahias[i];
      filas += '<tr style="page-break-inside:avoid">' +
        '<td ' + td + '><b>' + esc(miembros(x, b.grupo).join(' · ')) + '</b>' + (x.anexo ? ' (anexo)' : '') + '</td>' +
        '<td ' + td + '>' + x.ancho_cub + '</td><td ' + td + '><b>' + encPdf(x.enc_cub) + '</b></td>' +
        '<td ' + td + '>' + x.ancho_bod + '</td><td ' + td + '><b>' + encPdf(x.enc_bod) + '</b></td>' +
        '<td ' + td + '>' + esc(x.nota) + '</td></tr>';
    }
    return '<div style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff">' +
      '<div style="font-size:22px;font-weight:bold">MORP · ' + esc(b.nombre) + '</div>' +
      '<div style="font-size:13px;margin:4px 0 14px;color:#444">Posición de enchufes refer por bahía · ' + hoy() + ' · ' + b.bahias.length + ' bahías</div>' +
      '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
      '<th ' + th + '>Bahía</th><th ' + th + '>Cubierta (pos.)</th><th ' + th + '>Enchufe cubierta</th>' +
      '<th ' + th + '>Bodega (pos.)</th><th ' + th + '>Enchufe bodega</th><th ' + th + '>Nota</th></tr></thead><tbody>' + filas + '</tbody></table></div>';
  }
  function base64ABlob(b64, tipo) {
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { arr[i] = bin.charCodeAt(i); }
    return new Blob([arr], { type: tipo });
  }
  function generarPDF() {
    var b = buqueActual();
    if (!b) { return; }
    if (!b.bahias.length) { toast('Agrega bahías antes de crear el PDF'); return; }
    if (typeof window.html2pdf === 'undefined') { toast('El generador de PDF no está disponible'); return; }
    toast('Creando PDF…');
    pdfEl.innerHTML = htmlPDF(b);
    var nombre = 'MORP-' + nombreArchivo(b.nombre) + '-' + hoy() + '.pdf';
    var opciones = {
      margin: 10,
      filename: nombre,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    window.html2pdf().set(opciones).from(pdfEl.firstChild).outputPdf('datauristring').then(function (uri) {
      pdfEl.innerHTML = '';
      var b64 = String(uri).split(',')[1];
      if (window.NativeShare) {
        return Promise.resolve(window.NativeShare(b64, nombre)).catch(function (e) {
          var m = String(e && e.message ? e.message : e).toLowerCase();
          if (m.indexOf('cancel') === -1) { toast('No se pudo compartir el PDF'); }
        });
      }
      descargarBlob(base64ABlob(b64, 'application/pdf'), nombre);
      toast('PDF descargado');
    }).catch(function () {
      pdfEl.innerHTML = '';
      toast('No se pudo crear el PDF');
    });
  }

  /* ---------- Tema ---------- */
  function aplicarTema(t) {
    document.documentElement.setAttribute('data-tema', t === 'dia' ? 'dia' : 'noche');
  }

  /* ---------- Eventos ---------- */
  function accion(el) {
    var a = el.getAttribute('data-acc');
    var id = el.getAttribute('data-id');
    if (a === 'ir') { ir(el.getAttribute('data-vista')); }
    else if (a === 'abrir-buque') { ir('buque', id); }
    else if (a === 'nuevo-buque') { modalBuqueNuevo(); }
    else if (a === 'guardar-buque-nuevo') { guardarBuqueNuevo(); }
    else if (a === 'editar-buque') { modalBuqueEditar(); }
    else if (a === 'guardar-buque-edit') { guardarBuqueEdit(); }
    else if (a === 'borrar-buque') { borrarBuque(); }
    else if (a === 'turno-toggle') {
      estado.turno = (estado.turno === id) ? null : id;
      guardar();
      render(true);
      toast(estado.turno ? 'Buque en turno' : 'Ya no hay buque en turno');
    }
    else if (a === 'nueva-bahia') { modalBahia(null); }
    else if (a === 'editar-bahia') { modalBahia(id); }
    else if (a === 'guardar-bahia') { guardarBahia(id); }
    else if (a === 'borrar-bahia') { borrarBahia(id); }
    else if (a === 'aplicar-todas') { modalAplicarTodas(); }
    else if (a === 'guardar-aplicar') { guardarAplicar(); }
    else if (a === 'pdf') { generarPDF(); }
    else if (a === 'tema') {
      var t = el.getAttribute('data-v');
      aplicarTema(t);
      escribir(KEY_TEMA, t);
      render(true);
    }
    else if (a === 'exportar') { exportarJSON(); }
    else if (a === 'importar') { archivoEl.click(); }
    else if (a === 'import-agregar') { importar(false); }
    else if (a === 'import-reemplazar') { importar(true); }
    else if (a === 'borrar-todo') {
      confirmar('¿Borrar todos los datos?', 'Se eliminarán todos los buques y bahías de este teléfono. Guarda un respaldo antes si lo necesitas.', 'Borrar todo', function () {
        estado = { buques: [], turno: null };
        guardar();
        ir('turno');
        toast('Datos borrados');
      });
    }
    else if (a === 'cerrar') { cerrarModal(); }
    else if (a === 'confirmar-ok') {
      var f = cbConfirmar;
      cbConfirmar = null;
      cerrarModal();
      if (f) { f(); }
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('velo')) { cerrarModal(); return; }
    var p = cercano(t, 'data-paso');
    if (p) {
      var inp = document.getElementById(p.getAttribute('data-t'));
      if (inp) {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) { v = 0; }
        v += parseInt(p.getAttribute('data-paso'), 10);
        var mn = parseInt(inp.getAttribute('min'), 10);
        var mx = parseInt(inp.getAttribute('max'), 10);
        inp.value = Math.max(mn, Math.min(mx, v));
        if (inp.id === 'f-cub') { ajustarCub(); }
      }
      return;
    }
    var s = cercano(t, 'data-val');
    if (s && s.parentNode && s.parentNode.classList.contains('seg')) {
      var hermanos = s.parentNode.querySelectorAll('button');
      for (var i = 0; i < hermanos.length; i++) { hermanos[i].classList.remove('on'); }
      s.classList.add('on');
      return;
    }
    var a = cercano(t, 'data-acc');
    if (a) { accion(a); }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'filtro') {
      ruta.filtro = t.value;
      var b = buqueActual();
      var lista = document.getElementById('lista');
      if (b && lista) { lista.innerHTML = htmlLista(b); }
    } else if (t.id === 'f-cub') {
      ajustarCub();
    }
  });
  archivoEl.addEventListener('change', leerArchivoImport);

  /* ---------- Arranque ---------- */
  aplicarTema(leer(KEY_TEMA, 'noche'));
  cargar();
  render(false);
  window.__appListo = true;
})();
