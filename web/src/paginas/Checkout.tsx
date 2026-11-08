import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '../auth/useAuth';
import {
  useActualizarDireccion,
  useCarrito,
  useCrearDireccion,
  useDirecciones,
  useEliminarDireccion,
  useIniciarCheckout,
  useMetadatos,
  usePagar,
  useResumenCheckout,
} from '../lib/consultas';
import { claves } from '../lib/claves';
import { resolverImagen } from '../lib/imagenes';
import { ErrorApi } from '../api/clienteHttp';
import {
  firmaCarrito,
  limpiarClaveIdem,
  nuevaClaveIdem,
  obtenerClaveIdem,
} from '../lib/idempotencia';
import { Boton } from '../componentes/ui/Boton';
import { Campo } from '../componentes/ui/Campo';
import { FormularioDireccion } from '../componentes/direcciones/FormularioDireccion';
import { TarjetaDireccion } from '../componentes/direcciones/TarjetaDireccion';
import { Modal } from '../componentes/ui/Modal';
import { EstadoVista } from '../componentes/ui/EstadoVista';
import { useToast } from '../componentes/ui/Toast';
import { formatearQuetzales } from '../componentes/ui/Precio';
import {
  IconoAlerta,
  IconoBolsa,
  IconoCamion,
  IconoCheck,
  IconoDevolucion,
  IconoEfectivo,
  IconoEscudo,
  IconoReloj,
  IconoTarjeta,
  IconoTransferencia,
} from '../componentes/iconos';
import type { Direccion, DireccionInput, PagarBody } from '../api/tipos';

const NIT_RE = /^(CF|\d{1,9}-?[\dK])$/;
const METODOS = [
  { v: 'TARJETA', t: 'Tarjeta', Icono: IconoTarjeta },
  { v: 'TRANSFERENCIA', t: 'Transferencia', Icono: IconoTransferencia },
  { v: 'EFECTIVO', t: 'Efectivo', Icono: IconoEfectivo },
] as const;

type MetodoPago = (typeof METODOS)[number]['v'];

interface Facturacion {
  tipo: 'CF' | 'NIT';
  nit: string;
  nombre: string;
}

function leerFacturacion(): Facturacion {
  try {
    const raw = localStorage.getItem('shopcart.facturacion');
    if (raw) {
      const d = JSON.parse(raw) as Partial<Facturacion>;
      return { tipo: d.tipo === 'NIT' ? 'NIT' : 'CF', nit: d.nit ?? '', nombre: d.nombre ?? '' };
    }
  } catch {
    /* sin localStorage */
  }
  return { tipo: 'CF', nit: '', nombre: '' };
}

/** Segundos restantes de la reserva a partir de ExpiraEn (UTC), con margen de 2 s. */
function calcularSegundos(expiraEn: string | null): number | null {
  if (!expiraEn) return null;
  const t = Date.parse(expiraEn.endsWith('Z') ? expiraEn : `${expiraEn}Z`);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((t - Date.now() - 2000) / 1000));
}

function useSegundosRestantes(expiraEn: string | null): number | null {
  const [seg, setSeg] = useState<number | null>(() => calcularSegundos(expiraEn));
  useEffect(() => {
    setSeg(calcularSegundos(expiraEn));
    if (!expiraEn) return;
    const id = window.setInterval(() => setSeg(calcularSegundos(expiraEn)), 1000);
    return () => window.clearInterval(id);
  }, [expiraEn]);
  return seg;
}

function mmss(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Checkout() {
  const { usuario } = useAuth();
  const esCliente = usuario?.rol === 'Cliente';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { mostrar } = useToast();

  const { data: meta } = useMetadatos();
  const modoDemo = Boolean(meta?.modoDemo);

  const { data: direcciones } = useDirecciones();
  const carritoQuery = useCarrito();
  const carrito = carritoQuery.data;
  const { pathname } = useLocation();
  const iniciar = useIniciarCheckout();
  const { data: resumenData } = useResumenCheckout(esCliente);
  const crear = useCrearDireccion();
  const actualizar = useActualizarDireccion();
  const eliminar = useEliminarDireccion();
  const pagar = usePagar();

  const resumen = resumenData?.resumen ?? null;
  const lineasReservadas = useMemo(() => resumenData?.lineas ?? [], [resumenData]);

  const [idDireccionSel, setIdDireccionSel] = useState<number | null>(null);
  const iniciadoPara = useRef<number | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Direccion | null>(null);
  const [modalEliminar, setModalEliminar] = useState<Direccion | null>(null);

  const [facturacion, setFacturacion] = useState<Facturacion>(() => leerFacturacion());
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('TARJETA');
  const [simular, setSimular] = useState<'APROBADO' | 'RECHAZADO'>('APROBADO');

  const [errorRechazo, setErrorRechazo] = useState<string | null>(null);
  const [vencidaManual, setVencidaManual] = useState(false);
  const [exitoPago, setExitoPago] = useState(false);

  const direccionSel = direcciones?.find((d) => d.IDDireccion === idDireccionSel) ?? null;

  const abrirFormNuevaDireccion = () => {
    setEditando(null);
    setMostrarForm(true);
  };

  // Reglas de error al iniciar la reserva (mismas para "Reservar de nuevo y continuar"):
  //   409 (existencia insuficiente) / 422 (carrito vacio, variante inactiva, cupon invalido)
  //     -> toast con el mensaje EXACTO y volver a /carrito con ese aviso;
  //   404 (direccion) -> quedarse aqui, abrir el form de direccion nueva y avisar;
  //   otros -> no se hace nada aqui: la vista de error con Reintentar se muestra abajo.
  const manejarErrorIniciar = (err: unknown) => {
    const api = err instanceof ErrorApi ? err : null;
    const mensaje = api?.mensaje ?? 'No se pudo iniciar el checkout';
    if (api?.status === 409 || api?.status === 422) {
      mostrar(mensaje, 'error');
      navigate('/carrito', { state: { aviso: mensaje } });
    } else if (api?.status === 404) {
      mostrar(mensaje, 'error');
      abrirFormNuevaDireccion();
    }
  };

  useEffect(() => {
    document.title = 'Finalizar compra · ShopCart';
    return () => {
      document.title = 'ShopCart';
    };
  }, []);

  // Recordar la eleccion de facturacion.
  useEffect(() => {
    try {
      localStorage.setItem('shopcart.facturacion', JSON.stringify(facturacion));
    } catch {
      /* sin localStorage */
    }
  }, [facturacion]);

  // "Pago aprobado" como señal INMEDIATA de la mutación (pagar.data llega al resolverse, antes
  // de que el estado exitoPago o la navegación se confirmen). Cierra la ventana real del bug:
  // el pago resuelve -> isPending pasa a false -> un refetch del carrito (ya Convertido = 0 u.)
  // resuelve ANTES de que onSuccess ponga exitoPago y navegue, y el efecto de "carrito vacío"
  // corría sin guarda. Con esto queda guardado desde el instante en que la mutación aprueba.
  const pagoAprobado = exitoPago || (pagar.isSuccess && Boolean(pagar.data?.aprobado));

  // UNICA regla "carrito vacío -> /carrito" de la app, y vive solo en esta página. Corre solo
  // cuando: (1) la ruta es EXACTAMENTE /checkout; (2) no hay pago en curso ni aprobado; y (3) el
  // carrito ya se cargó al menos una vez (no en la carga inicial ni con datos provisionales). La
  // confirmación jamás redirige a /carrito.
  useEffect(() => {
    if (pathname !== '/checkout') return;
    if (pagar.isPending || pagoAprobado) return;
    if (!carritoQuery.isSuccess || carritoQuery.isPlaceholderData) return;
    if ((carrito?.carrito?.totales.CantidadUnidades ?? 0) === 0) {
      navigate('/carrito', { replace: true });
    }
  }, [pathname, carrito, carritoQuery.isSuccess, carritoQuery.isPlaceholderData, navigate, pagar.isPending, pagoAprobado]);

  // Preseleccion de direccion (ultima usada o la primera); si no hay, abre el form.
  useEffect(() => {
    if (!direcciones) return;
    if (direcciones.length === 0) {
      setIdDireccionSel(null);
      setMostrarForm(true);
      setEditando(null);
      return;
    }
    setIdDireccionSel((actual) => {
      if (actual && direcciones.some((d) => d.IDDireccion === actual)) return actual;
      const guardada = Number(localStorage.getItem('shopcart.ultimaDireccion'));
      const pref = direcciones.find((d) => d.IDDireccion === guardada) ?? direcciones[0]!;
      return pref.IDDireccion;
    });
  }, [direcciones]);

  // Iniciar (reservar) cuando cambia la direccion seleccionada.
  useEffect(() => {
    if (idDireccionSel == null) return;
    if (iniciadoPara.current === idDireccionSel) return;
    iniciadoPara.current = idDireccionSel;
    setVencidaManual(false);
    setErrorRechazo(null);
    iniciar.mutate(idDireccionSel, { onError: manejarErrorIniciar });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDireccionSel]);

  const reiniciar = (id: number) => {
    iniciadoPara.current = id;
    setVencidaManual(false);
    setErrorRechazo(null);
    iniciar.mutate(id, { onError: manejarErrorIniciar });
  };

  const segundos = useSegundosRestantes(resumen?.ExpiraEn ?? null);
  const vencida =
    iniciar.isSuccess &&
    (vencidaManual || resumen?.ReservaActiva === false || (segundos !== null && segundos <= 0));

  // 409/422 navegan a /carrito y 404 abre el form (ver manejarErrorIniciar); el resto de
  // errores (red, 5xx, 401…) se muestran como vista de error con Reintentar.
  const errIniciar = iniciar.error instanceof ErrorApi ? iniciar.error : null;
  const estatusIniciar = errIniciar?.status;
  const mostrarErrorIniciar =
    iniciar.isError &&
    estatusIniciar !== 409 &&
    estatusIniciar !== 422 &&
    estatusIniciar !== 404;

  const firma = useMemo(
    () =>
      firmaCarrito(
        resumen?.IDCarrito ?? null,
        lineasReservadas.map((l) => ({ IDVariante: l.IDVariante, Cantidad: l.Cantidad })),
      ),
    [resumen?.IDCarrito, lineasReservadas],
  );

  const nitNorm = facturacion.nit.trim().toUpperCase();
  const facturacionValida =
    facturacion.tipo === 'CF' || (NIT_RE.test(nitNorm) && facturacion.nombre.trim().length >= 2);

  const guardarDireccion = (datos: DireccionInput) => {
    if (editando) {
      const id = editando.IDDireccion;
      actualizar.mutate(
        { id, datos },
        {
          onSuccess: () => {
            setMostrarForm(false);
            setEditando(null);
            setIdDireccionSel(id);
            reiniciar(id); // datos (y envio) pueden cambiar: re-reservar
          },
        },
      );
    } else {
      crear.mutate(datos, {
        onSuccess: (nueva) => {
          setMostrarForm(false);
          setIdDireccionSel(nueva.IDDireccion); // el efecto reserva
        },
      });
    }
  };

  const confirmarEliminar = () => {
    if (!modalEliminar) return;
    const id = modalEliminar.IDDireccion;
    eliminar.mutate(id, {
      onSuccess: () => {
        setModalEliminar(null);
        if (idDireccionSel === id) setIdDireccionSel(null); // el efecto repicara
      },
    });
  };

  const alPagar = () => {
    // Guarda contra doble envio: si ya hay un pago en curso o aprobado, no se dispara otro.
    if (!resumen || idDireccionSel == null || pagar.isPending || pagoAprobado) return;
    setErrorRechazo(null);
    const clave = obtenerClaveIdem(firma);
    const datos: PagarBody = {
      idDireccion: idDireccionSel,
      metodoPago,
      ...(modoDemo ? { simularResultado: simular } : {}),
      ...(facturacion.tipo === 'NIT'
        ? { nitFactura: nitNorm, nombreFactura: facturacion.nombre.trim() }
        : { nitFactura: 'CF' }),
    };
    pagar.mutate(
      { datos, clave },
      {
        onSuccess: (res) => {
          if (res.aprobado && res.pedido) {
            limpiarClaveIdem();
            // Marcar el pago como completado y navegar a la confirmacion ANTES de invalidar
            // ['carrito']: asi el efecto de "carrito vacio" (ya bloqueado por exitoPago) nunca
            // pisa esta navegacion. replace:true para que "atras" no vuelva al checkout.
            setExitoPago(true);
            navigate(`/checkout/confirmacion/${res.pedido.IDPedido}`, {
              replace: true,
              state: { resultado: res },
            });
            void qc.invalidateQueries({ queryKey: claves.carrito });
          } else {
            // Rechazado (402): el pago previo quedo consumido -> clave nueva.
            setErrorRechazo(res.pago.MensajeResultado ?? 'El pago fue rechazado');
            nuevaClaveIdem(firma);
          }
        },
        onError: (err) => {
          if (err instanceof ErrorApi && /reserv/i.test(err.mensaje)) setVencidaManual(true);
        },
      },
    );
  };

  // Descartar el modal de rechazo sin tocar la seleccion (Escape / clic fuera / X).
  const cerrarRechazo = () => setErrorRechazo(null);

  // "Cambiar metodo de pago": cerrar y llevar el foco al bloque 3.
  const cambiarMetodo = () => {
    setErrorRechazo(null);
    // Tras cerrar el modal (que al desmontarse devuelve el foco al boton Pagar),
    // enfocar el bloque de metodo de pago en el siguiente tick.
    window.setTimeout(() => {
      const el = document.getElementById('bloque-metodo-pago');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector<HTMLElement>('button')?.focus();
    }, 0);
  };

  // "Reintentar": cerrar y volver a pagar con la clave nueva ya generada tras el rechazo.
  const reintentar = () => alPagar();

  // ----- Estado "reserva vencida" -----
  if (vencida) {
    return (
      <div className="mx-auto grid max-w-lg place-items-center px-4 py-20 text-center">
        <span className="mb-4 grid h-16 w-16 place-items-center rounded-pill bg-[#FEF2F2] text-[#B91C1C]">
          <IconoReloj className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">
          Tu reserva venció
        </h1>
        <p className="mt-2 max-w-md text-sm text-apagado">
          Pasaron {resumen?.Minutos ?? 15} minutos sin completar el pago y la existencia volvió a
          estar disponible para otros clientes. Tu carrito sigue intacto.
        </p>
        <Boton
          className="mt-6"
          cargando={iniciar.isPending}
          onClick={() => idDireccionSel != null && reiniciar(idDireccionSel)}
        >
          Reservar de nuevo y continuar
        </Boton>
      </div>
    );
  }

  if (mostrarErrorIniciar) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EstadoVista
          cargando={false}
          error
          tituloError="No pudimos iniciar tu checkout"
          textoError={errIniciar?.mensaje}
          alReintentar={() => idDireccionSel != null && reiniciar(idDireccionSel)}
        >
          <></>
        </EstadoVista>
      </div>
    );
  }

  // No marcamos "preparando" si iniciar fallo (p. ej. 404 abrio el form): evita el
  // skeleton infinito de "Preparando tu reserva…".
  const preparando =
    !iniciar.isError && (!direcciones || (direcciones.length > 0 && !resumen && !mostrarForm));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8 lg:pb-10">
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-apretado text-marino-900 sm:text-[40px]">
            Finalizar compra
          </h1>
          <p className="mt-1 text-sm text-apagado">
            Tu existencia está reservada mientras completas el pago.
          </p>
        </div>
        {segundos !== null && resumen && (
          <PillReserva segundos={segundos} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-5">
          {/* 1 · Entrega */}
          <Bloque numero={1} titulo="Entrega" extra="Entrega estimada: mañana antes de las 18:00">
            <div className="space-y-3">
              {direcciones?.map((d) => (
                <TarjetaDireccion
                  key={d.IDDireccion}
                  dir={d}
                  seleccionada={d.IDDireccion === idDireccionSel}
                  ultima={
                    Number(localStorage.getItem('shopcart.ultimaDireccion')) === d.IDDireccion
                  }
                  puedeEliminar={(direcciones?.length ?? 0) > 1}
                  onSeleccionar={() => setIdDireccionSel(d.IDDireccion)}
                  onEditar={() => {
                    setEditando(d);
                    setMostrarForm(true);
                  }}
                  onEliminar={() => setModalEliminar(d)}
                />
              ))}

              {mostrarForm ? (
                <FormularioDireccion
                  inicial={editando}
                  guardando={crear.isPending || actualizar.isPending}
                  onGuardar={guardarDireccion}
                  onCancelar={() => {
                    setMostrarForm(false);
                    setEditando(null);
                  }}
                  textoGuardar="Guardar y usar"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditando(null);
                    setMostrarForm(true);
                  }}
                  className="w-full rounded-16 border border-dashed border-marino-600/40 px-4 py-3 text-sm font-semibold text-marino-700 hover:bg-marino-600/5"
                >
                  + Agregar una dirección nueva
                </button>
              )}
            </div>
          </Bloque>

          {/* 2 · Facturación */}
          <Bloque numero={2} titulo="Datos de facturación">
            <div className="grid gap-3 sm:grid-cols-2">
              <OpcionTarjeta
                activa={facturacion.tipo === 'CF'}
                titulo="Consumidor final"
                texto="Factura a nombre de CF"
                onClick={() => setFacturacion((f) => ({ ...f, tipo: 'CF' }))}
              />
              <OpcionTarjeta
                activa={facturacion.tipo === 'NIT'}
                titulo="Con NIT"
                texto="Persona o empresa"
                onClick={() => setFacturacion((f) => ({ ...f, tipo: 'NIT' }))}
              />
            </div>
            {facturacion.tipo === 'NIT' && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Campo
                  label="NIT"
                  value={facturacion.nit}
                  onChange={(e) =>
                    setFacturacion((f) => ({ ...f, nit: e.target.value.toUpperCase().slice(0, 20) }))
                  }
                  ayuda="Sin validación en línea: revísalo bien."
                  error={
                    facturacion.nit.trim() !== '' && !NIT_RE.test(nitNorm)
                      ? 'NIT inválido (ej. 1234567-8 o CF)'
                      : undefined
                  }
                  className="font-mono"
                  placeholder="1234567-8"
                />
                <Campo
                  label="Nombre o razón social"
                  value={facturacion.nombre}
                  onChange={(e) =>
                    setFacturacion((f) => ({ ...f, nombre: e.target.value.slice(0, 150) }))
                  }
                  placeholder="Nombre para la factura"
                />
              </div>
            )}
          </Bloque>

          {/* 3 · Método de pago */}
          <Bloque numero={3} titulo="Método de pago" id="bloque-metodo-pago">
            <div className="grid gap-3 sm:grid-cols-3">
              {METODOS.map(({ v, t, Icono }) => {
                const activo = metodoPago === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMetodoPago(v)}
                    aria-pressed={activo}
                    className={clsx(
                      'flex flex-col items-center gap-2 rounded-16 border px-3 py-4 text-sm font-semibold transition-colors',
                      activo
                        ? 'border-marino-700 bg-marino-900 text-white'
                        : 'border-[rgba(15,23,42,.14)] bg-white text-texto hover:border-marino-600',
                    )}
                  >
                    <Icono className={clsx('h-6 w-6', activo ? 'text-dorado' : 'text-marino-600')} />
                    {t}
                  </button>
                );
              })}
            </div>
            {modoDemo && (
              <div className="mt-4 rounded-16 border border-dashed border-marino-600/40 bg-marino-600/5 p-3 text-sm">
                <p className="mb-2 font-semibold text-marino-700">
                  Demostración: el pago se simula. Resultado:
                </p>
                <div className="flex gap-4">
                  {(['APROBADO', 'RECHAZADO'] as const).map((op) => (
                    <label key={op} className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="simular"
                        checked={simular === op}
                        onChange={() => setSimular(op)}
                      />
                      <span className="text-sm font-medium text-texto">
                        {op === 'APROBADO' ? 'Aprobado' : 'Rechazado'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Bloque>

          {/* 4 · Productos reservados */}
          {resumen && (
            <Bloque numero={4} titulo="Productos reservados">
              <ul className="divide-y divide-borde">
                {lineasReservadas.map((lr) => {
                  const cl = carrito?.lineas.find((l) => l.IDVariante === lr.IDVariante);
                  return (
                    <li key={lr.IDVariante} className="flex items-center gap-3 py-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-12 bg-fondo-2">
                        {cl?.ImagenPrincipal ? (
                          <img
                            src={resolverImagen(cl.ImagenPrincipal)}
                            alt={cl.Producto}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-degradado-marino text-white/40">
                            <IconoBolsa className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-marino-900">
                          {cl?.Producto ?? lr.SKU}
                        </p>
                        <p className="text-xs text-apagado">
                          {lr.Cantidad} × {cl ? formatearQuetzales(cl.PrecioUnitario) : lr.SKU}
                        </p>
                        <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-exito/10 px-2 py-0.5 text-[11px] font-semibold text-exito-texto">
                          <IconoCheck className="h-3 w-3" />
                          Reservado
                        </span>
                      </div>
                      {cl && (
                        <span className="text-sm font-extrabold text-marino-900">
                          {formatearQuetzales(cl.TotalLinea)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Link
                to="/carrito"
                className="mt-2 inline-block text-sm font-semibold text-marino-700 hover:text-marino-600"
              >
                Editar en el carrito
              </Link>
            </Bloque>
          )}

          {preparando && (
            <p className="rounded-16 border border-borde bg-white p-4 text-sm text-apagado">
              Preparando tu reserva…
            </p>
          )}
        </div>

        {/* Resumen */}
        {resumen && (
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Resumen
              resumen={resumen}
              cuponCodigo={carrito?.cupon?.Codigo ?? null}
              alias={direccionSel?.Alias ?? null}
              onPagar={alPagar}
              pagando={pagar.isPending || exitoPago}
              puedePagar={facturacionValida && !preparando && !pagar.isPending}
            />
          </aside>
        )}
      </div>

      {/* Barra fija inferior (movil) */}
      {resumen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="leading-tight">
              <span className="block text-xs text-apagado">Total a pagar</span>
              <span className="block text-lg font-extrabold text-marino-900">
                {formatearQuetzales(resumen.TotalConEnvio)}
              </span>
            </div>
            <Boton onClick={alPagar} cargando={pagar.isPending || exitoPago} disabled={!facturacionValida}>
              Pagar
            </Boton>
          </div>
        </div>
      )}

      <Modal
        abierto={modalEliminar !== null}
        titulo="¿Eliminar esta dirección?"
        textoConfirmar="Eliminar"
        varianteConfirmar="peligro"
        cargando={eliminar.isPending}
        alConfirmar={confirmarEliminar}
        alCancelar={() => setModalEliminar(null)}
      >
        Se quitará <strong>{modalEliminar?.Alias}</strong> de tus direcciones guardadas.
      </Modal>

      {/* Pago rechazado: modal centrado. La reserva sigue viva (misma cuenta regresiva). */}
      <Modal
        abierto={errorRechazo !== null}
        icono={
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-[#FEF2F2] text-[#B91C1C]">
            <IconoAlerta className="h-5 w-5" />
          </span>
        }
        titulo="No pudimos procesar el pago"
        textoCancelar="Cambiar método de pago"
        textoConfirmar="Reintentar"
        cargando={pagar.isPending}
        alCancelar={cambiarMetodo}
        alConfirmar={reintentar}
        alCerrar={cerrarRechazo}
      >
        <p>{errorRechazo}</p>
        <p className="mt-2">
          No se creó ningún pedido ni se hizo ningún cobro. Tu reserva sigue vigente:{' '}
          <strong className="font-mono text-marino-900">
            {segundos !== null ? mmss(segundos) : '--:--'}
          </strong>{' '}
          — elige otro método e intenta de nuevo.
        </p>
      </Modal>
    </div>
  );
}

/* ------------------------------- Piezas ---------------------------------- */

function Bloque({
  numero,
  titulo,
  extra,
  id,
  children,
}: {
  numero: number;
  titulo: string;
  extra?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-20 border border-borde bg-white p-5 shadow-suave">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-marino-900">
          <span className="grid h-6 w-6 place-items-center rounded-pill bg-marino-900 text-xs text-white">
            {numero}
          </span>
          {titulo}
        </h2>
        {extra && <span className="text-right text-xs text-apagado">{extra}</span>}
      </div>
      {children}
    </section>
  );
}

function PillReserva({ segundos }: { segundos: number }) {
  const bajo1 = segundos < 60;
  const bajo5 = segundos < 300;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-bold',
        bajo5 && !bajo1 && 'anim-pulso-suave',
        bajo1 ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'text-[#C2410C]',
      )}
      style={bajo1 ? undefined : { backgroundImage: 'linear-gradient(90deg,#FFF7ED,#FFEDD5)' }}
      aria-live="polite"
    >
      <IconoReloj className="h-4 w-4" />
      {mmss(segundos)}
    </span>
  );
}

function OpcionTarjeta({
  activa,
  titulo,
  texto,
  onClick,
}: {
  activa: boolean;
  titulo: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={clsx(
        'rounded-16 border px-4 py-3 text-left transition-colors',
        activa
          ? 'border-marino-700 bg-marino-600/5'
          : 'border-[rgba(15,23,42,.14)] bg-white hover:border-marino-600',
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={clsx(
            'grid h-4 w-4 place-items-center rounded-pill border',
            activa ? 'border-marino-700' : 'border-apagado',
          )}
        >
          {activa && <span className="h-2 w-2 rounded-pill bg-marino-700" />}
        </span>
        <span className="text-sm font-bold text-marino-900">{titulo}</span>
      </span>
      <span className="mt-1 block pl-6 text-xs text-apagado">{texto}</span>
    </button>
  );
}

/* -------------------------------- Resumen -------------------------------- */

function Resumen({
  resumen,
  cuponCodigo,
  alias,
  onPagar,
  pagando,
  puedePagar,
}: {
  resumen: NonNullable<import('../api/tipos').ResumenCheckout['resumen']>;
  cuponCodigo: string | null;
  alias: string | null;
  onPagar: () => void;
  pagando: boolean;
  puedePagar: boolean;
}) {
  const t = resumen.totales;
  return (
    <div className="rounded-20 border border-borde bg-white p-5 shadow-suave">
      <h2 className="mb-4 text-lg font-extrabold tracking-apretado text-marino-900">Resumen</h2>
      <dl className="flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-apagado">
            Subtotal ({t.CantidadLineas} {t.CantidadLineas === 1 ? 'producto' : 'productos'})
          </dt>
          <dd className="font-semibold text-marino-900">{formatearQuetzales(t.Subtotal)}</dd>
        </div>
        {t.Descuento > 0 && (
          <div className="flex justify-between text-exito-texto">
            <dt className="font-semibold">Descuento{cuponCodigo ? ` ${cuponCodigo}` : ''}</dt>
            <dd className="font-bold">−{formatearQuetzales(t.Descuento)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-apagado">Envío{alias ? ` a ${alias}` : ''}</dt>
          <dd className="font-semibold text-marino-900">{formatearQuetzales(resumen.CostoEnvio)}</dd>
        </div>
        <p className="text-xs text-apagado">
          IVA {t.PorcentajeIVA}% incluido: {formatearQuetzales(t.IVA)}
        </p>
        <div className="my-1 border-t border-borde" />
        <div className="flex items-baseline justify-between">
          <dt className="text-base font-extrabold text-marino-900">Total a pagar</dt>
          <dd className="text-[28px] font-extrabold tracking-apretado text-marino-900">
            {formatearQuetzales(resumen.TotalConEnvio)}
          </dd>
        </div>
      </dl>

      <Boton onClick={onPagar} cargando={pagando} disabled={!puedePagar} className="mt-5 w-full">
        Pagar {formatearQuetzales(resumen.TotalConEnvio)}
      </Boton>
      <p className="mt-2 text-xs text-apagado">
        Tu pago se procesa una sola vez, aunque pulses dos veces o falle la conexión.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-apagado">
        <span className="inline-flex items-center gap-1">
          <IconoEscudo className="h-3.5 w-3.5 text-marino-600" /> Cifrado TLS
        </span>
        <span className="inline-flex items-center gap-1">
          <IconoCamion className="h-3.5 w-3.5 text-marino-600" /> Sin cobros duplicados
        </span>
        <span className="inline-flex items-center gap-1">
          <IconoDevolucion className="h-3.5 w-3.5 text-marino-600" /> Devoluciones por línea
        </span>
      </div>
    </div>
  );
}
