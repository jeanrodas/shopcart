import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '../../auth/useAuth';
import { useCuponesAdmin, useResumenCupones, useCategoriasAdmin } from '../../lib/consultas';
import { claves } from '../../lib/claves';
import { ErrorApi } from '../../api/clienteHttp';
import { crearCupon, actualizarCupon, cambiarEstadoCupon } from '../../api/cupones';
import { Boton } from '../../componentes/ui/Boton';
import { Campo } from '../../componentes/ui/Campo';
import { Modal } from '../../componentes/ui/Modal';
import { EstadoVista } from '../../componentes/ui/EstadoVista';
import { useOrdenURL, ThOrden } from '../../componentes/ui/Orden';
import { PanelLateral } from '../../componentes/ui/PanelLateral';
import { useToast } from '../../componentes/ui/Toast';
import { formatearQuetzales } from '../../componentes/ui/Precio';
import { formatearFechaCorta, plural } from '../../lib/formato';
import { Paginacion, TAMANOS_PAGINA_ADMIN } from '../catalogo/Paginacion';
import type { CuponAdminFila, CuponBody, EstadoCupon, FiltrosCupones } from '../../api/tipos';

type ClaveChip = 'todos' | 'vigentes' | 'futuros' | 'vencidos' | 'agotados' | 'inactivos';
const CHIPS: { clave: ClaveChip; texto: string; estado?: EstadoCupon; clases: string }[] = [
  { clave: 'todos', texto: 'Todos', clases: 'bg-marino-600/10 text-marino-700' },
  { clave: 'vigentes', texto: 'Vigentes', estado: 'Vigente', clases: 'bg-exito/10 text-exito-texto' },
  { clave: 'futuros', texto: 'Programados', estado: 'Programado', clases: 'bg-marino-600/10 text-marino-700' },
  { clave: 'vencidos', texto: 'Vencidos', estado: 'Vencido', clases: 'bg-apagado/15 text-apagado' },
  { clave: 'agotados', texto: 'Agotados', estado: 'Agotado', clases: 'bg-ambar/15 text-naranja-700' },
  { clave: 'inactivos', texto: 'Inactivos', estado: 'Inactivo', clases: 'bg-apagado/15 text-apagado' },
];

const PILL_ESTADO: Record<EstadoCupon, string> = {
  Vigente: 'bg-exito/10 text-exito-texto',
  Programado: 'bg-marino-600/10 text-marino-700',
  Vencido: 'bg-apagado/15 text-apagado',
  Agotado: 'bg-ambar/15 text-naranja-700',
  Inactivo: 'bg-apagado/15 text-apagado',
};

function beneficio(c: Pick<CuponAdminFila, 'Tipo' | 'Valor'>): string {
  return c.Tipo === 'PORCENTAJE' ? `${c.Valor} % por unidad` : `${formatearQuetzales(c.Valor)} una vez`;
}

function codigoClases(e: EstadoCupon): string {
  if (e === 'Programado') return 'bg-marino-600/10 text-marino-700';
  if (e === 'Vencido' || e === 'Inactivo') return 'bg-apagado/15 text-apagado';
  return 'bg-ambar/15 text-naranja-700';
}

export default function AdminCupones() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'Administrador';
  const qc = useQueryClient();
  const { mostrar } = useToast();

  const [texto, setTexto] = useState('');
  const [textoDeb, setTextoDeb] = useState('');
  const [chip, setChip] = useState<ClaveChip>('todos');
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(20);
  const orden = useOrdenURL(['codigo', 'vigencia', 'usos'] as const, { orden: 'vigencia', direccion: 'DESC' });

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [editando, setEditando] = useState<CuponAdminFila | null>(null);
  const [aDesactivar, setADesactivar] = useState<CuponAdminFila | null>(null);

  useEffect(() => {
    document.title = 'Cupones · Administración';
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setTextoDeb(texto.trim()), 300);
    return () => window.clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    setPagina(1);
  }, [textoDeb, chip, tamano]);

  const filtros: FiltrosCupones = useMemo(
    () => ({
      texto: textoDeb || undefined,
      filtro: chip === 'todos' ? undefined : chip,
      pagina,
      tamano,
      orden: orden.orden,
      direccion: orden.direccion,
    }),
    [textoDeb, chip, pagina, tamano, orden.orden, orden.direccion],
  );

  const { data, isPending, isError, refetch, isPlaceholderData } = useCuponesAdmin(filtros);
  const { data: resumen } = useResumenCupones();

  // El cupon vigente de categoria PORCENTAJE alimenta la cinta de ofertas de la tienda.
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: claves.cupones.admin });
    void qc.invalidateQueries({ queryKey: claves.cupones.vigentes });
  };

  const cambiarEstado = useMutation({
    mutationFn: (v: { id: number; activo: boolean }) => cambiarEstadoCupon(v.id, v.activo),
    onSuccess: () => {
      invalidar();
      setADesactivar(null);
      mostrar('Estado actualizado', 'exito');
    },
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo cambiar', 'error'),
  });

  const conteoChip: Record<ClaveChip, number | null> = {
    todos: resumen?.Total ?? null,
    vigentes: resumen?.Vigentes ?? null,
    futuros: resumen?.Programados ?? null,
    vencidos: resumen?.Vencidos ?? null,
    agotados: resumen?.Agotados ?? null,
    inactivos: resumen?.Inactivos ?? null,
  };

  const abrirNuevo = () => {
    setEditando(null);
    setPanelAbierto(true);
  };
  const abrirEditar = (c: CuponAdminFila) => {
    setEditando(c);
    setPanelAbierto(true);
  };
  const toggle = (c: CuponAdminFila) => {
    if (c.Activo && c.EstadoDerivado === 'Vigente') setADesactivar(c);
    else cambiarEstado.mutate({ id: c.IDCupon, activo: !c.Activo });
  };

  return (
    <div className="min-w-0">
      {/* Cabecera */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Catálogo</p>
          <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">Cupones</h1>
          {resumen && (
            <p className="mt-1 text-sm text-apagado">
              {resumen.Vigentes} vigentes · {resumen.Programados} programados · {resumen.Vencidos} vencidos ·{' '}
              {resumen.Agotados} agotados · {resumen.Inactivos} inactivos
            </p>
          )}
        </div>
        {esAdmin && (
          <Boton onClick={abrirNuevo}>Nuevo cupón</Boton>
        )}
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-20 bg-degradado-marino p-4 text-white shadow-marino">
          <p className="text-xs font-semibold uppercase tracking-ancho text-white/60">Descuento otorgado (30 d)</p>
          <p className="mt-1 text-2xl font-extrabold">{resumen ? formatearQuetzales(resumen.DescuentoOtorgado30d) : '—'}</p>
          <p className="mt-0.5 text-xs text-white/60">en {plural(resumen?.PedidosConCupon30d ?? 0, 'pedido')}</p>
        </div>
        <div className="rounded-20 border border-borde bg-white p-4 shadow-suave">
          <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Más usado</p>
          <p className="mt-1 font-mono text-lg font-extrabold text-marino-900">{resumen?.CuponMasUsadoCodigo ?? '—'}</p>
          <p className="mt-0.5 text-xs text-apagado">
            {resumen?.CuponMasUsadoCodigo
              ? `${plural(resumen.CuponMasUsadoUsos ?? 0, 'uso')} · ${formatearQuetzales(resumen.CuponMasUsadoBeneficio ?? 0)}`
              : 'sin usos aún'}
          </p>
        </div>
        <div className="rounded-20 border border-ambar/40 bg-ambar/10 p-4 shadow-suave">
          <p className="text-xs font-semibold uppercase tracking-ancho text-naranja-700">Por vencer (≤ 7 d)</p>
          <p className="mt-1 text-2xl font-extrabold text-naranja-700">{resumen?.CuponesPorVencer7d ?? '—'}</p>
          <p className="mt-0.5 truncate text-xs text-naranja-700/80">
            {resumen?.CuponPorVencerCodigo
              ? `${resumen.CuponPorVencerCodigo} · ${formatearFechaCorta(resumen.CuponPorVencerFecha as string)}`
              : 'ninguno próximo'}
          </p>
        </div>
        <div className="rounded-20 border border-borde bg-white p-4 shadow-suave">
          <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Tasa de uso</p>
          <p className="mt-1 text-2xl font-extrabold text-marino-900">{resumen ? `${resumen.TasaUso} %` : '—'}</p>
          <p className="mt-0.5 text-xs text-apagado">pedidos con cupón / total (30 d)</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-20 border border-borde bg-white p-4 shadow-suave">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por código…"
          className="w-full rounded-pill border border-[rgba(15,23,42,.14)] bg-fondo px-4 py-2.5 text-sm outline-none focus:border-marino-600"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {CHIPS.map((ch) => {
            const n = conteoChip[ch.clave];
            const activo = chip === ch.clave;
            return (
              <button
                key={ch.clave}
                type="button"
                onClick={() => setChip(ch.clave)}
                className={clsx(
                  'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
                  activo ? ch.clases : 'bg-fondo-2 text-apagado hover:text-marino-700',
                )}
              >
                {ch.texto}
                {n !== null && <span className="ml-1 opacity-70">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <EstadoVista
        cargando={isPending}
        error={isError}
        alReintentar={() => void refetch()}
        esqueleto={<div className="esqueleto h-80 w-full rounded-20" />}
      >
        {data && (
          <>
            {/* Escritorio: tabla */}
            <div className={clsx('hidden overflow-hidden rounded-20 border border-borde bg-white shadow-suave lg:block', isPlaceholderData && 'opacity-60')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-xs font-bold uppercase tracking-ancho text-apagado">
                    <ThOrden col="codigo" estado={orden} className="px-4 py-3">Código</ThOrden>
                    <th className="px-4 py-3">Beneficio</th>
                    <th className="hidden px-4 py-3 xl:table-cell">Alcance</th>
                    <ThOrden col="vigencia" estado={orden} className="px-4 py-3">Vigencia</ThOrden>
                    <ThOrden col="usos" estado={orden} className="px-4 py-3">Usos</ThOrden>
                    <th className="px-4 py-3">Estado</th>
                    {esAdmin && <th className="px-4 py-3 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((c) => (
                    <FilaCupon key={c.IDCupon} c={c} esAdmin={esAdmin} onEditar={abrirEditar} onToggle={toggle} />
                  ))}
                  {data.filas.length === 0 && (
                    <tr>
                      <td colSpan={esAdmin ? 7 : 6} className="px-4 py-10 text-center text-apagado">
                        No hay cupones con estos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Móvil: tarjetas */}
            <div className={clsx('grid grid-cols-1 gap-3 lg:hidden', isPlaceholderData && 'opacity-60')}>
              {data.filas.map((c) => (
                <TarjetaCupon key={c.IDCupon} c={c} esAdmin={esAdmin} onEditar={abrirEditar} onToggle={toggle} />
              ))}
              {data.filas.length === 0 && (
                <p className="rounded-20 border border-borde bg-white p-6 text-center text-apagado">
                  No hay cupones con estos filtros.
                </p>
              )}
            </div>

            {data.total > tamano && (
              <Paginacion pagina={pagina} tamanoPagina={tamano} total={data.total} onPagina={setPagina} onTamano={setTamano} tamanos={TAMANOS_PAGINA_ADMIN} />
            )}
          </>
        )}
      </EstadoVista>

      {/* Panel crear / editar */}
      <PanelLateral abierto={panelAbierto} onCerrar={() => setPanelAbierto(false)} etiqueta={editando ? 'Editar cupón' : 'Nuevo cupón'} testid="panel-cupon">
        <PanelCupon cupon={editando} onCerrar={() => setPanelAbierto(false)} onGuardado={invalidar} />
      </PanelLateral>

      {/* Confirmación al desactivar un cupón vigente */}
      <Modal
        abierto={aDesactivar !== null}
        titulo="¿Desactivar este cupón?"
        textoConfirmar="Desactivar"
        varianteConfirmar="peligro"
        cargando={cambiarEstado.isPending}
        alConfirmar={() => aDesactivar && cambiarEstado.mutate({ id: aDesactivar.IDCupon, activo: false })}
        alCancelar={() => setADesactivar(null)}
      >
        Los clientes que ya lo aplicaron en su carrito lo verán como inválido al pagar.
      </Modal>
    </div>
  );
}

/* --------------------------------- Fila ----------------------------------- */

function Vigencia({ c }: { c: CuponAdminFila }) {
  const alerta = c.EstadoDerivado === 'Vigente' && c.DiasParaVencer >= 0 && c.DiasParaVencer <= 7;
  return (
    <span className={clsx('text-xs', alerta ? 'font-semibold text-naranja-700' : 'text-apagado')}>
      → {formatearFechaCorta(c.FechaFin)}
      {c.EstadoDerivado === 'Vigente' && c.DiasParaVencer >= 0 && ` · ${c.DiasParaVencer} días`}
    </span>
  );
}

function BarraUsos({ c }: { c: CuponAdminFila }) {
  const pct = c.LimiteUsos ? Math.min(100, Math.round((c.UsosActuales / c.LimiteUsos) * 100)) : 0;
  const lleno = c.LimiteUsos !== null && c.UsosActuales >= c.LimiteUsos;
  return (
    <div className="min-w-[90px]">
      <p className="text-xs text-texto">
        {c.UsosActuales} / {c.LimiteUsos ?? '∞'}
        {c.LimitePorCliente ? ` · ${c.LimitePorCliente} por cliente` : ''}
      </p>
      {c.LimiteUsos !== null && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-fondo-2">
          <div className={clsx('h-full rounded-pill', lleno ? 'bg-error' : 'bg-degradado-acento')} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function AccionesFila({ c, onEditar, onToggle }: { c: CuponAdminFila; onEditar: (c: CuponAdminFila) => void; onToggle: (c: CuponAdminFila) => void }) {
  return (
    <div className="flex items-center justify-end gap-3 text-xs font-semibold">
      <button type="button" onClick={() => onEditar(c)} className="text-marino-700 hover:underline">
        Editar
      </button>
      <button
        type="button"
        onClick={() => onToggle(c)}
        className={c.Activo ? 'text-error-texto hover:underline' : 'text-exito-texto hover:underline'}
      >
        {c.Activo ? 'Desactivar' : 'Activar'}
      </button>
    </div>
  );
}

function FilaCupon({ c, esAdmin, onEditar, onToggle }: { c: CuponAdminFila; esAdmin: boolean; onEditar: (c: CuponAdminFila) => void; onToggle: (c: CuponAdminFila) => void }) {
  return (
    <tr className={clsx('border-b border-borde last:border-0', c.EstadoDerivado === 'Vencido' && 'opacity-70')}>
      <td className="px-4 py-3">
        <span className={clsx('rounded-pill px-2.5 py-1 font-mono text-xs font-bold', codigoClases(c.EstadoDerivado))}>{c.Codigo}</span>
      </td>
      <td className="px-4 py-3 text-texto">{beneficio(c)}</td>
      <td className="hidden px-4 py-3 text-apagado xl:table-cell">
        {c.Alcance}
        {c.MontoMinimo > 0 && <span className="text-xs"> · mín. {formatearQuetzales(c.MontoMinimo)}</span>}
      </td>
      <td className="px-4 py-3"><Vigencia c={c} /></td>
      <td className="px-4 py-3"><BarraUsos c={c} /></td>
      <td className="px-4 py-3">
        <span className={clsx('rounded-pill px-2.5 py-1 text-xs font-semibold', PILL_ESTADO[c.EstadoDerivado])}>{c.EstadoDerivado}</span>
      </td>
      {esAdmin && <td className="px-4 py-3"><AccionesFila c={c} onEditar={onEditar} onToggle={onToggle} /></td>}
    </tr>
  );
}

function TarjetaCupon({ c, esAdmin, onEditar, onToggle }: { c: CuponAdminFila; esAdmin: boolean; onEditar: (c: CuponAdminFila) => void; onToggle: (c: CuponAdminFila) => void }) {
  return (
    <article className={clsx('rounded-20 border border-borde bg-white p-4 shadow-suave', c.EstadoDerivado === 'Vencido' && 'opacity-70')}>
      <div className="flex items-start justify-between gap-2">
        <span className={clsx('rounded-pill px-2.5 py-1 font-mono text-xs font-bold', codigoClases(c.EstadoDerivado))}>{c.Codigo}</span>
        <span className={clsx('rounded-pill px-2.5 py-1 text-xs font-semibold', PILL_ESTADO[c.EstadoDerivado])}>{c.EstadoDerivado}</span>
      </div>
      <p className="mt-2 text-sm text-texto">{beneficio(c)}</p>
      <p className="text-xs text-apagado">
        {c.Alcance}
        {c.MontoMinimo > 0 && ` · mín. ${formatearQuetzales(c.MontoMinimo)}`}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Vigencia c={c} />
        <BarraUsos c={c} />
      </div>
      {esAdmin && (
        <div className="mt-3 border-t border-borde pt-3">
          <AccionesFila c={c} onEditar={onEditar} onToggle={onToggle} />
        </div>
      )}
    </article>
  );
}

/* ---------------------------- Panel crear/editar -------------------------- */

function soloFecha(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

function PanelCupon({ cupon, onCerrar, onGuardado }: { cupon: CuponAdminFila | null; onCerrar: () => void; onGuardado: () => void }) {
  const { mostrar } = useToast();
  const { data: categorias } = useCategoriasAdmin();
  const tieneUsos = (cupon?.UsosActuales ?? 0) > 0;

  const [codigo, setCodigo] = useState(cupon?.Codigo ?? '');
  const [tipo, setTipo] = useState<'PORCENTAJE' | 'MONTO'>(cupon?.Tipo ?? 'PORCENTAJE');
  const [valor, setValor] = useState(cupon ? String(cupon.Valor) : '');
  const [idCategoria, setIdCategoria] = useState<number | ''>(cupon?.IDCategoria ?? '');
  const [montoMinimo, setMontoMinimo] = useState(cupon ? String(cupon.MontoMinimo) : '0');
  const [desde, setDesde] = useState(soloFecha(cupon?.FechaInicio ?? ''));
  const [hasta, setHasta] = useState(soloFecha(cupon?.FechaFin ?? ''));
  const [limiteTotal, setLimiteTotal] = useState(cupon?.LimiteUsos != null ? String(cupon.LimiteUsos) : '');
  const [limitePorCliente, setLimitePorCliente] = useState(cupon?.LimitePorCliente != null ? String(cupon.LimitePorCliente) : '');
  const [activo, setActivo] = useState(cupon?.Activo ?? true);
  const [errorCodigo, setErrorCodigo] = useState<string | undefined>();
  const [aviso, setAviso] = useState<string | undefined>();

  const guardar = useMutation({
    mutationFn: (body: CuponBody) => (cupon ? actualizarCupon(cupon.IDCupon, body) : crearCupon(body)),
    onSuccess: () => {
      onGuardado();
      mostrar('Cupón guardado', 'exito');
      onCerrar();
    },
    onError: (err) => {
      if (err instanceof ErrorApi && err.status === 409 && /duplicad/i.test(err.mensaje)) {
        setErrorCodigo('Ya existe un cupón con ese código');
      } else {
        setAviso(err instanceof ErrorApi ? err.mensaje : 'No se pudo guardar el cupón');
      }
    },
  });

  const enviar = () => {
    setErrorCodigo(undefined);
    setAviso(undefined);
    const valorNum = Number(valor);
    if (!codigo || codigo.length < 3) {
      setErrorCodigo('El código debe tener al menos 3 caracteres');
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setAviso('El valor debe ser mayor que 0');
      return;
    }
    if (!desde || !hasta || hasta < desde) {
      setAviso('La fecha final debe ser igual o posterior a la inicial');
      return;
    }
    const body: CuponBody = {
      codigo: codigo.trim().toUpperCase(),
      tipoDescuento: tipo,
      valor: valorNum,
      idCategoria: idCategoria === '' ? undefined : Number(idCategoria),
      montoMinimo: Number(montoMinimo) || 0,
      fechaInicio: `${desde}T00:00:00.000Z`,
      fechaFin: `${hasta}T23:59:59.000Z`,
      limiteUsosTotal: limiteTotal ? Number(limiteTotal) : undefined,
      limiteUsosPorCliente: limitePorCliente ? Number(limitePorCliente) : undefined,
    };
    guardar.mutate(body);
  };

  const nombreCat = idCategoria === '' ? null : categorias?.find((c) => c.IDCategoria === Number(idCategoria))?.Nombre ?? null;
  const vista =
    tipo === 'PORCENTAJE'
      ? `Usa el cupón ${codigo || 'NUEVO'} y ahorra ${valor || '0'} %${nombreCat ? ` en ${nombreCat}` : ''}${hasta ? ` · vence el ${formatearFechaCorta(`${hasta}T12:00:00.000Z`)}` : ''}`
      : `${formatearQuetzales(Number(valor) || 0)} de descuento${nombreCat ? ` en ${nombreCat}` : ' en todo el carrito'}${Number(montoMinimo) > 0 ? ` desde ${formatearQuetzales(Number(montoMinimo))}` : ''}${hasta ? ` · vence el ${formatearFechaCorta(`${hasta}T12:00:00.000Z`)}` : ''}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-borde p-4 sm:p-5">
        <h2 className="text-lg font-extrabold tracking-apretado text-marino-900">{cupon ? 'Editar cupón' : 'Nuevo cupón'}</h2>
        <button type="button" onClick={onCerrar} className="text-sm font-semibold text-apagado hover:text-marino-700">Cerrar</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-4">
          <Campo
            label="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 30))}
            disabled={tieneUsos}
            error={errorCodigo}
            ayuda={tieneUsos ? 'Con usos registrados no se puede cambiar el código, tipo, valor ni alcance' : '3 a 30 · letras, números y guion'}
          />

          <div>
            <p className="mb-1.5 text-sm font-semibold text-texto">Tipo de descuento</p>
            <div className="flex gap-2">
              {(['PORCENTAJE', 'MONTO'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={tieneUsos}
                  onClick={() => setTipo(t)}
                  className={clsx(
                    'flex-1 rounded-12 border px-3 py-2 text-sm font-semibold disabled:opacity-60',
                    tipo === t ? 'border-marino-600 bg-marino-600/10 text-marino-700' : 'border-borde text-apagado',
                  )}
                >
                  {t === 'PORCENTAJE' ? 'Porcentaje' : 'Monto fijo'}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-texto">Valor</span>
            <div className="flex items-center gap-2">
              {tipo === 'MONTO' && <span className="text-sm font-semibold text-apagado">Q</span>}
              <input
                type="number"
                min="0"
                step="0.01"
                value={valor}
                disabled={tieneUsos}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600 disabled:bg-fondo-2"
              />
              {tipo === 'PORCENTAJE' && <span className="text-sm font-semibold text-apagado">%</span>}
            </div>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-texto">Alcance</span>
            <select
              value={idCategoria}
              disabled={tieneUsos}
              onChange={(e) => setIdCategoria(e.target.value ? Number(e.target.value) : '')}
              className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600 disabled:bg-fondo-2"
            >
              <option value="">Todo el carrito</option>
              {categorias?.filter((c) => c.Activo).map((c) => (
                <option key={c.IDCategoria} value={c.IDCategoria}>{c.Nombre}</option>
              ))}
            </select>
          </label>

          <Campo
            label="Monto mínimo (opcional)"
            type="number"
            min="0"
            step="0.01"
            value={montoMinimo}
            onChange={(e) => setMontoMinimo(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-texto">Desde</span>
              <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3 py-2.5 text-sm outline-none focus:border-marino-600" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-texto">Hasta</span>
              <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3 py-2.5 text-sm outline-none focus:border-marino-600" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Límite total (opcional)" type="number" min="1" value={limiteTotal} onChange={(e) => setLimiteTotal(e.target.value)} />
            <Campo label="Por cliente (opcional)" type="number" min="1" value={limitePorCliente} onChange={(e) => setLimitePorCliente(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-texto">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-4 w-4" />
            Activo
          </label>

          {/* Vista previa */}
          <div className="rounded-16 border border-ambar/40 bg-ambar/10 p-3 text-sm text-naranja-700">{vista}</div>
          <p className="text-xs text-apagado">
            Un porcentaje se aplica por unidad; un monto fijo una sola vez por carrito y nunca supera el subtotal.
          </p>

          {aviso && <p className="rounded-12 bg-error/10 px-3 py-2 text-sm font-medium text-error-texto">{aviso}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-borde p-4 sm:p-5">
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={enviar} cargando={guardar.isPending}>{cupon ? 'Guardar cambios' : 'Crear cupón'}</Boton>
      </div>
    </div>
  );
}
