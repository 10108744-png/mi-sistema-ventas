/* ============ ELEMENTOS ============ */
const buscar = document.getElementById("buscar");
const lineas = document.getElementById("lineas");
const totalEl = document.getElementById("total");
const efectivoEl = document.getElementById("efectivo");
const cambioEl = document.getElementById("cambio");
const avisoEl = document.getElementById("aviso");
const numeroEl = document.getElementById("numeroTicket");
const tituloEl = document.getElementById("titulo");

/* ============ UTILIDADES ============ */
function esc(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function dinero(n) { return "$" + n.toFixed(2); }
function redondear(n) { return Math.round(n * 100) / 100; }

function hoyLocal() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

let temporizador;
function mostrarAviso(texto, tipo = "", ms = 2500) {
  avisoEl.textContent = texto;
  avisoEl.className = "aviso visible " + tipo;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { avisoEl.className = "aviso"; }, ms);
}

/* ============ DATOS (se guardan en este navegador) ============ */
function leerDatos(clave, porDefecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? JSON.parse(texto) : porDefecto;
  } catch (e) {
    return porDefecto;
  }
}

function guardarDatos(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) {
    mostrarAviso("No se pudo guardar en este navegador", "error");
  }
}

const productosEjemplo = [
  { codigo: "1001", nombre: "Coca Cola", costo: 1.0, precio: 1.25, stock: 24, minimo: 6 },
  { codigo: "1002", nombre: "Pan francés", costo: 0.15, precio: 0.25, stock: 60, minimo: 20 },
  { codigo: "1003", nombre: "Huevos docena", costo: 2.0, precio: 2.5, stock: 10, minimo: 4 },
  { codigo: "1004", nombre: "Arroz 1kg", costo: 0.85, precio: 1.1, stock: 18, minimo: 5 },
  { codigo: "1005", nombre: "Leche 1L", costo: 0.95, precio: 1.25, stock: 5, minimo: 6 }
];

let productos = leerDatos("pos_productos", null);
if (!productos) {
  productos = productosEjemplo;
  guardarDatos("pos_productos", productos);
}

let ventas = leerDatos("pos_ventas", []);
let numeroTicket = leerDatos("numeroTicket", 1);
let cuenta = [];

function guardarProductos() { guardarDatos("pos_productos", productos); }
function guardarVentas() { guardarDatos("pos_ventas", ventas); }

/* ============ NAVEGACIÓN ENTRE PANTALLAS ============ */
const nombresVista = { ventas: "Ventas", resumen: "Resumen", ganancias: "Ganancias", inventario: "Inventario" };
let vistaActual = "ventas";
let diaVista = hoyLocal();

function mostrarVista(nombre) {
  vistaActual = nombre;
  document.querySelectorAll(".vista").forEach((v) => v.classList.add("oculta"));
  document.getElementById("vista-" + nombre).classList.remove("oculta");
  document.querySelectorAll("[data-vista]").forEach((b) => {
    b.classList.toggle("activo", b.dataset.vista === nombre);
  });
  tituloEl.textContent = nombresVista[nombre];

  document.querySelectorAll(".input-dia").forEach((i) => { i.value = diaVista; i.max = hoyLocal(); });

  if (nombre === "ventas") buscar.focus();
  if (nombre === "resumen") dibujarResumen();
  if (nombre === "ganancias") dibujarGanancias();
  if (nombre === "inventario") dibujarInventario();
}

document.querySelectorAll("[data-vista]").forEach((b) => {
  b.addEventListener("click", () => mostrarVista(b.dataset.vista));
});

document.querySelectorAll(".input-dia").forEach((input) => {
  input.addEventListener("change", () => {
    diaVista = input.value || hoyLocal();
    document.querySelectorAll(".input-dia").forEach((i) => { i.value = diaVista; });
    if (vistaActual === "resumen") dibujarResumen();
    if (vistaActual === "ganancias") dibujarGanancias();
  });
});

/* ============ VENTAS ============ */
function mostrarNumero() {
  numeroEl.textContent = String(numeroTicket).padStart(4, "0");
}

function calcularTotal() {
  return cuenta.reduce((suma, p) => suma + p.precio * p.cantidad, 0);
}

function actualizarCambio() {
  const total = calcularTotal();
  const efectivo = parseFloat(efectivoEl.value);
  cambioEl.textContent = (isNaN(efectivo) || efectivo < total) ? "$0.00" : dinero(efectivo - total);
}

function dibujarCuenta() {
  if (cuenta.length === 0) {
    lineas.innerHTML = `<tr><td colspan="5" class="vacio">La cuenta está vacía. Escanea un producto para empezar.</td></tr>`;
  } else {
    lineas.innerHTML = cuenta.map((p, i) => `
      <tr>
        <td>${esc(p.nombre)}</td>
        <td>
          <div class="cantidad">
            <button onclick="cambiarCantidad(${i}, -1)" aria-label="Restar uno">−</button>
            <span>${p.cantidad}</span>
            <button onclick="cambiarCantidad(${i}, 1)" aria-label="Sumar uno">+</button>
          </div>
        </td>
        <td>${dinero(p.precio)}</td>
        <td>${dinero(p.precio * p.cantidad)}</td>
        <td><button class="btn-quitar" onclick="quitar(${i})" aria-label="Quitar producto"><svg class="ico"><use href="#i-trash"/></svg></button></td>
      </tr>
    `).join("");
  }
  totalEl.textContent = dinero(calcularTotal());
  actualizarCambio();
}

function agregarProducto(texto) {
  texto = texto.trim().toLowerCase();
  if (!texto) return;

  const producto =
    productos.find((p) => p.codigo.toLowerCase() === texto) ||
    productos.find((p) => p.nombre.toLowerCase().includes(texto));

  if (!producto) {
    mostrarAviso("No existe el producto " + texto, "error");
    return;
  }

  const existente = cuenta.find((p) => p.codigo === producto.codigo);
  const yaEnCuenta = existente ? existente.cantidad : 0;

  if (producto.stock <= 0) {
    mostrarAviso(producto.nombre + " está agotado", "error");
    return;
  }
  if (yaEnCuenta + 1 > producto.stock) {
    mostrarAviso("Solo quedan " + producto.stock + " de " + producto.nombre, "error");
    return;
  }

  if (existente) {
    existente.cantidad += 1;
  } else {
    cuenta.push({
      codigo: producto.codigo,
      nombre: producto.nombre,
      costo: producto.costo,
      precio: producto.precio,
      cantidad: 1
    });
  }
  dibujarCuenta();
}

function cambiarCantidad(i, cambio) {
  if (cambio > 0) {
    const real = productos.find((p) => p.codigo === cuenta[i].codigo);
    if (real && cuenta[i].cantidad + 1 > real.stock) {
      mostrarAviso("Solo quedan " + real.stock + " de " + real.nombre, "error");
      return;
    }
  }
  cuenta[i].cantidad += cambio;
  if (cuenta[i].cantidad <= 0) cuenta.splice(i, 1);
  dibujarCuenta();
}

function quitar(i) {
  cuenta.splice(i, 1);
  dibujarCuenta();
}

function limpiarVenta() {
  cuenta = [];
  efectivoEl.value = "";
  dibujarCuenta();
  buscar.focus();
}

function cobrar() {
  if (cuenta.length === 0) {
    mostrarAviso("No hay productos en la cuenta", "error");
    return;
  }

  const total = redondear(calcularTotal());
  const efectivo = parseFloat(efectivoEl.value);

  if (isNaN(efectivo) || efectivo < total) {
    mostrarAviso("El efectivo no alcanza para pagar", "error");
    efectivoEl.focus();
    return;
  }

  // 1. Guardar la venta con el costo y el precio del momento
  const venta = {
    id: numeroTicket,
    dia: hoyLocal(),
    hora: new Date().toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" }),
    items: cuenta.map((p) => ({
      codigo: p.codigo, nombre: p.nombre, cantidad: p.cantidad, costo: p.costo, precio: p.precio
    })),
    total: total,
    ganancia: redondear(cuenta.reduce((s, p) => s + (p.precio - p.costo) * p.cantidad, 0))
  };
  ventas.push(venta);
  guardarVentas();

  // 2. Descontar el inventario y detectar stock bajo
  const bajos = [];
  cuenta.forEach((item) => {
    const real = productos.find((p) => p.codigo === item.codigo);
    if (real) {
      real.stock -= item.cantidad;
      if (real.stock <= real.minimo) bajos.push(real.nombre);
    }
  });
  guardarProductos();

  // 3. Aviso y siguiente ticket
  let mensaje = "Venta cobrada. Cambio: " + dinero(efectivo - total);
  if (bajos.length > 0) mensaje += ". Stock bajo: " + bajos.join(", ");
  mostrarAviso(mensaje, "ok", bajos.length > 0 ? 5000 : 2500);

  numeroTicket += 1;
  guardarDatos("numeroTicket", numeroTicket);
  mostrarNumero();
  limpiarVenta();
}

buscar.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    agregarProducto(buscar.value);
    buscar.value = "";
  }
});

efectivoEl.addEventListener("input", actualizarCambio);
efectivoEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") cobrar();
});

document.getElementById("btnCobrar").addEventListener("click", cobrar);

document.getElementById("btnCancelar").addEventListener("click", () => {
  if (cuenta.length === 0) return;
  if (confirm("¿Cancelar la venta actual?")) limpiarVenta();
});

document.getElementById("btnEscanear").addEventListener("click", () => {
  mostrarAviso("La cámara se activa en la siguiente etapa");
  buscar.focus();
});

document.querySelectorAll("[data-pronto]").forEach((btn) => {
  btn.addEventListener("click", () => {
    mostrarAviso(btn.dataset.pronto + " se activa en la siguiente etapa");
  });
});

/* ============ INVENTARIO ============ */
const formProducto = document.getElementById("formProducto");
const fCodigo = document.getElementById("fCodigo");
const fNombre = document.getElementById("fNombre");
const fCosto = document.getElementById("fCosto");
const fPrecio = document.getElementById("fPrecio");
const fStock = document.getElementById("fStock");
const fMinimo = document.getElementById("fMinimo");
const fGanancia = document.getElementById("fGanancia");
const gananciaCalc = document.getElementById("gananciaCalc");
const tituloForm = document.getElementById("tituloForm");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
const filtroInv = document.getElementById("filtroInventario");
const notaInv = document.getElementById("notaInventario");
const tablaInv = document.getElementById("tablaInventario");

let editando = null;

function actualizarGananciaForm() {
  const costo = parseFloat(fCosto.value);
  const precio = parseFloat(fPrecio.value);
  const g = (isNaN(costo) || isNaN(precio)) ? 0 : redondear(precio - costo);
  fGanancia.textContent = dinero(g);
  gananciaCalc.classList.toggle("negativa", g < 0);
}

function limpiarFormulario() {
  formProducto.reset();
  editando = null;
  tituloForm.textContent = "Agregar producto";
  btnGuardar.textContent = "Guardar producto";
  btnCancelarEdicion.classList.add("oculta");
  actualizarGananciaForm();
}

function editarProducto(codigo) {
  const p = productos.find((x) => x.codigo === codigo);
  if (!p) return;
  editando = codigo;
  fCodigo.value = p.codigo;
  fNombre.value = p.nombre;
  fCosto.value = p.costo;
  fPrecio.value = p.precio;
  fStock.value = p.stock;
  fMinimo.value = p.minimo;
  tituloForm.textContent = "Editar producto";
  btnGuardar.textContent = "Guardar cambios";
  btnCancelarEdicion.classList.remove("oculta");
  actualizarGananciaForm();
  window.scrollTo({ top: 0, behavior: "smooth" });
  fNombre.focus();
}

function borrarProducto(codigo) {
  const p = productos.find((x) => x.codigo === codigo);
  if (!p) return;
  if (!confirm("¿Borrar " + p.nombre + " del inventario?")) return;
  productos = productos.filter((x) => x.codigo !== codigo);
  guardarProductos();
  if (editando === codigo) limpiarFormulario();
  dibujarInventario();
  mostrarAviso("Producto borrado");
}

function dibujarInventario() {
  const filtro = filtroInv.value.trim().toLowerCase();
  const lista = productos.filter((p) =>
    !filtro || p.nombre.toLowerCase().includes(filtro) || p.codigo.toLowerCase().includes(filtro)
  );

  const bajos = productos.filter((p) => p.stock <= p.minimo).length;
  const valor = productos.reduce((s, p) => s + p.costo * p.stock, 0);
  notaInv.textContent =
    productos.length + (productos.length === 1 ? " producto, " : " productos, ") +
    bajos + " con stock bajo. Valor del inventario al precio inicial: " + dinero(valor);

  if (lista.length === 0) {
    tablaInv.innerHTML = `<tr><td colspan="6" class="vacio">No hay productos. Agrega el primero con el formulario.</td></tr>`;
    return;
  }

  tablaInv.innerHTML = lista.map((p) => {
    const bajo = p.stock <= p.minimo;
    const ganancia = redondear(p.precio - p.costo);
    return `
      <tr>
        <td>${esc(p.nombre)}<small>${esc(p.codigo)}</small></td>
        <td>${dinero(p.costo)}</td>
        <td>${dinero(p.precio)}</td>
        <td class="${ganancia < 0 ? "stock-bajo" : ""}">${dinero(ganancia)}</td>
        <td class="${bajo ? "stock-bajo" : ""}">${p.stock}${bajo ? `<span class="tag-bajo">${p.stock <= 0 ? "Agotado" : "Stock bajo"}</span>` : ""}</td>
        <td>
          <div class="acciones">
            <button class="btn-tabla" data-accion="editar" data-codigo="${esc(p.codigo)}">Editar</button>
            <button class="btn-tabla borrar" data-accion="borrar" data-codigo="${esc(p.codigo)}">Borrar</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

tablaInv.addEventListener("click", (e) => {
  const boton = e.target.closest("button[data-accion]");
  if (!boton) return;
  if (boton.dataset.accion === "editar") editarProducto(boton.dataset.codigo);
  if (boton.dataset.accion === "borrar") borrarProducto(boton.dataset.codigo);
});

fCosto.addEventListener("input", actualizarGananciaForm);
fPrecio.addEventListener("input", actualizarGananciaForm);
filtroInv.addEventListener("input", dibujarInventario);
btnCancelarEdicion.addEventListener("click", limpiarFormulario);

// Un lector de código de barras manda Enter al terminar: pasamos al siguiente campo
fCodigo.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    fNombre.focus();
  }
});

formProducto.addEventListener("submit", (e) => {
  e.preventDefault();

  const p = {
    codigo: fCodigo.value.trim(),
    nombre: fNombre.value.trim(),
    costo: parseFloat(fCosto.value),
    precio: parseFloat(fPrecio.value),
    stock: parseInt(fStock.value, 10),
    minimo: parseInt(fMinimo.value, 10) || 0
  };

  if (!p.codigo || !p.nombre) {
    mostrarAviso("Escribe el código y el nombre del producto", "error");
    return;
  }
  if (isNaN(p.costo) || isNaN(p.precio) || p.costo < 0 || p.precio < 0) {
    mostrarAviso("Revisa el precio inicial y el precio de venta", "error");
    return;
  }
  if (isNaN(p.stock) || p.stock < 0) {
    mostrarAviso("El stock debe ser 0 o más", "error");
    return;
  }
  if (productos.some((x) => x.codigo === p.codigo && x.codigo !== editando)) {
    mostrarAviso("Ya existe un producto con ese código", "error");
    return;
  }
  if (p.precio < p.costo && !confirm("El precio de venta es menor que el precio inicial: venderías con pérdida. ¿Guardar igual?")) {
    return;
  }

  if (editando !== null) {
    const i = productos.findIndex((x) => x.codigo === editando);
    productos[i] = p;
  } else {
    productos.push(p);
  }

  guardarProductos();
  limpiarFormulario();
  dibujarInventario();
  mostrarAviso("Producto guardado", "ok");
  fCodigo.focus();
});

/* ============ RESUMEN Y GANANCIAS ============ */
function ventasDe(dia) {
  return ventas.filter((v) => v.dia === dia);
}

function dibujarResumen() {
  const lista = ventasDe(diaVista);
  const total = redondear(lista.reduce((s, v) => s + v.total, 0));
  const ganancia = redondear(lista.reduce((s, v) => s + v.ganancia, 0));

  document.getElementById("resVentas").textContent = lista.length;
  document.getElementById("resTotal").textContent = dinero(total);
  document.getElementById("resCosto").textContent = dinero(redondear(total - ganancia));
  document.getElementById("resGanancia").textContent = dinero(ganancia);

  const tabla = document.getElementById("tablaTickets");
  if (lista.length === 0) {
    tabla.innerHTML = `<tr><td colspan="5" class="vacio">No hay ventas en este día.</td></tr>`;
    return;
  }

  tabla.innerHTML = lista.map((v) => {
    const unidades = v.items.reduce((s, i) => s + i.cantidad, 0);
    return `
      <tr>
        <td>${String(v.id).padStart(4, "0")}</td>
        <td>${esc(v.hora)}</td>
        <td>${unidades}</td>
        <td>${dinero(v.total)}</td>
        <td>${dinero(v.ganancia)}</td>
      </tr>
    `;
  }).join("");
}

function dibujarGanancias() {
  const porProducto = {};

  ventasDe(diaVista).forEach((v) => {
    v.items.forEach((i) => {
      if (!porProducto[i.codigo]) {
        porProducto[i.codigo] = { nombre: i.nombre, unidades: 0, vendido: 0, costo: 0 };
      }
      const x = porProducto[i.codigo];
      x.unidades += i.cantidad;
      x.vendido += i.precio * i.cantidad;
      x.costo += i.costo * i.cantidad;
    });
  });

  const filas = Object.values(porProducto)
    .map((x) => ({ ...x, ganancia: redondear(x.vendido - x.costo) }))
    .sort((a, b) => b.ganancia - a.ganancia);

  const gananciaTotal = redondear(filas.reduce((s, x) => s + x.ganancia, 0));
  document.getElementById("ganTotal").textContent = dinero(gananciaTotal);
  document.getElementById("ganTop").textContent = filas.length ? filas[0].nombre : "Sin ventas";

  const tabla = document.getElementById("tablaGanancias");
  if (filas.length === 0) {
    tabla.innerHTML = `<tr><td colspan="5" class="vacio">No hay ventas en este día.</td></tr>`;
    return;
  }

  tabla.innerHTML = filas.map((x) => `
    <tr>
      <td>${esc(x.nombre)}</td>
      <td>${x.unidades}</td>
      <td>${dinero(redondear(x.vendido))}</td>
      <td>${dinero(redondear(x.costo))}</td>
      <td>${dinero(x.ganancia)}</td>
    </tr>
  `).join("");
}

/* ============ CÓDIGO DE BARRAS DEL VISOR (solo decoración) ============ */
const anchos = [2,1,1,3,1,2,1,1,2,3,1,1,2,1,3,1,2,2,1,1,3,1,2,1,1,2,3,1,1,2,1,2,1,3,1,1,2];
const codigoEl = document.querySelector(".visor .codigo");
anchos.forEach((w) => {
  const barra = document.createElement("span");
  barra.style.width = w * 3 + "px";
  codigoEl.appendChild(barra);
});

/* ============ FECHA Y HORA ============ */
function actualizarFecha() {
  document.getElementById("fecha").textContent = new Date().toLocaleString("es-SV", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit"
  });
}
actualizarFecha();
setInterval(actualizarFecha, 30000);

/* ============ INICIO ============ */
mostrarNumero();
dibujarCuenta();
