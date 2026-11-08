import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '../../auth/useAuth';
import { useUsuariosAdmin } from '../../lib/consultas';
import { claves } from '../../lib/claves';
import { ErrorApi } from '../../api/clienteHttp';
import {
  crearUsuarioInterno,
  cambiarRolUsuario,
  cambiarEstadoUsuario,
  desbloquearUsuario,
} from '../../api/usuarios';
import { Boton } from '../../componentes/ui/Boton';
import { Campo } from '../../componentes/ui/Campo';
import { Modal } from '../../componentes/ui/Modal';
import { EstadoVista } from '../../componentes/ui/EstadoVista';
import { useOrdenURL, ThOrden } from '../../componentes/ui/Orden';
import { PanelLateral } from '../../componentes/ui/PanelLateral';
import { useToast } from '../../componentes/ui/Toast';
import { formatearQuetzales } from '../../componentes/ui/Precio';
import { Paginacion, TAMANOS_PAGINA_ADMIN } from '../catalogo/Paginacion';
import { IconoCopiar } from '../../componentes/iconos';
import type { FiltrosUsuarios, Rol, UsuarioAdminFila, UsuarioCreado } from '../../api/tipos';

// Roles del sistema (sembrados en 004 en este orden: Cliente, Operador, Administrador).
const ROLES: { id: number; nombre: Rol }[] = [
  { id: 1, nombre: 'Cliente' },
  { id: 2, nombre: 'Operador' },
  { id: 3, nombre: 'Administrador' },
];

type ClaveChip = 'todos' | 'admin' | 'operador' | 'cliente' | 'bloqueados' | 'desactivados';
const CHIPS: { clave: ClaveChip; texto: string; clases: string }[] = [
  { clave: 'todos', texto: 'Todos', clases: 'bg-marino-600/10 text-marino-700' },
  { clave: 'admin', texto: 'Administradores', clases: 'bg-marino-700/10 text-marino-700' },
  { clave: 'operador', texto: 'Operadores', clases: 'bg-marino-600/10 text-marino-700' },
  { clave: 'cliente', texto: 'Clientes', clases: 'bg-apagado/15 text-apagado' },
  { clave: 'bloqueados', texto: 'Bloqueados', clases: 'bg-error/10 text-error-texto' },
  { clave: 'desactivados', texto: 'Desactivados', clases: 'bg-apagado/15 text-apagado' },
];

const PILL_ROL: Record<Rol, string> = {
  Administrador: 'bg-marino-700 text-white',
  Operador: 'bg-marino-600/15 text-marino-700',
  Cliente: 'bg-apagado/15 text-apagado',
};
const AVATAR_ROL: Record<Rol, string> = {
  Administrador: 'bg-ambar/30 text-naranja-700',
  Operador: 'bg-indigo-100 text-indigo-700',
  Cliente: 'bg-apagado/15 text-apagado',
};

export default function AdminUsuarios() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const { mostrar } = useToast();

  const [texto, setTexto] = useState('');
  const [textoDeb, setTextoDeb] = useState('');
  const [chip, setChip] = useState<ClaveChip>('todos');
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(20);
  // El SP acepta tambien `correo` (lista blanca); el correo se muestra bajo el nombre en la
  // misma columna, por eso las cabeceras visibles ordenan por nombre y rol.
  const orden = useOrdenURL(['nombre', 'correo', 'rol'] as const, { orden: 'nombre', direccion: 'ASC' });

  const [editar, setEditar] = useState<UsuarioAdminFila | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [creado, setCreado] = useState<UsuarioCreado | null>(null);

  useEffect(() => {
    document.title = 'Usuarios · Control';
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setTextoDeb(texto.trim()), 300);
    return () => window.clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    setPagina(1);
  }, [textoDeb, chip, tamano]);

  const filtros: FiltrosUsuarios = useMemo(() => {
    const base: FiltrosUsuarios = {
      texto: textoDeb || undefined,
      pagina,
      tamano,
      orden: orden.orden,
      direccion: orden.direccion,
    };
    if (chip === 'admin') base.idRol = 3;
    else if (chip === 'operador') base.idRol = 2;
    else if (chip === 'cliente') base.idRol = 1;
    else if (chip === 'bloqueados') base.filtro = 'bloqueados';
    else if (chip === 'desactivados') base.filtro = 'desactivados';
    return base;
  }, [textoDeb, chip, pagina, tamano, orden.orden, orden.direccion]);

  const { data, isPending, isError, refetch, isPlaceholderData } = useUsuariosAdmin(filtros);
  const c = data?.conteos ?? null;

  const invalidar = () => void qc.invalidateQueries({ queryKey: claves.usuarios.admin });

  const desbloquear = useMutation({
    mutationFn: (id: number) => desbloquearUsuario(id),
    onSuccess: () => {
      invalidar();
      mostrar('Cuenta desbloqueada', 'exito');
    },
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo desbloquear', 'error'),
  });

  const conteoChip: Record<ClaveChip, number | null> = {
    todos: c?.Total ?? null,
    admin: c?.Administradores ?? null,
    operador: c?.Operadores ?? null,
    cliente: c?.Clientes ?? null,
    bloqueados: c?.Bloqueados ?? null,
    desactivados: c?.Desactivados ?? null,
  };

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Control</p>
          <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">Usuarios</h1>
          {c && (
            <p className="mt-1 text-sm text-apagado">
              {c.Administradores} administradores · {c.Operadores} operadores · {c.Clientes} clientes ·{' '}
              {c.Desactivados} desactivados · {c.Bloqueados} bloqueados
            </p>
          )}
        </div>
        <Boton onClick={() => setNuevo(true)}>Nuevo usuario interno</Boton>
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-20 border border-borde bg-white p-4 shadow-suave">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre o correo…"
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
                className={clsx('rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors', activo ? ch.clases : 'bg-fondo-2 text-apagado hover:text-marino-700')}
              >
                {ch.texto}
                {n !== null && <span className="ml-1 opacity-70">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <EstadoVista cargando={isPending} error={isError} alReintentar={() => void refetch()} esqueleto={<div className="esqueleto h-80 w-full rounded-20" />}>
        {data && (
          <>
            {/* Escritorio: tabla */}
            <div className={clsx('hidden overflow-hidden rounded-20 border border-borde bg-white shadow-suave lg:block', isPlaceholderData && 'opacity-60')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-xs font-bold uppercase tracking-ancho text-apagado">
                    <ThOrden col="nombre" estado={orden} className="px-4 py-3">Usuario</ThOrden>
                    <ThOrden col="rol" estado={orden} className="px-4 py-3">Rol</ThOrden>
                    <th className="hidden px-4 py-3 xl:table-cell">Pedidos</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((u) => (
                    <FilaUsuario key={u.IDUsuario} u={u} esYo={u.IDUsuario === usuario?.id} onEditar={() => setEditar(u)} onDesbloquear={() => desbloquear.mutate(u.IDUsuario)} />
                  ))}
                  {data.filas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-apagado">No hay usuarios con estos filtros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Móvil: tarjetas */}
            <div className={clsx('grid grid-cols-1 gap-3 lg:hidden', isPlaceholderData && 'opacity-60')}>
              {data.filas.map((u) => (
                <TarjetaUsuario key={u.IDUsuario} u={u} esYo={u.IDUsuario === usuario?.id} onEditar={() => setEditar(u)} onDesbloquear={() => desbloquear.mutate(u.IDUsuario)} />
              ))}
              {data.filas.length === 0 && (
                <p className="rounded-20 border border-borde bg-white p-6 text-center text-apagado">No hay usuarios con estos filtros.</p>
              )}
            </div>

            {data.total > tamano && (
              <Paginacion pagina={pagina} tamanoPagina={tamano} total={data.total} onPagina={setPagina} onTamano={setTamano} tamanos={TAMANOS_PAGINA_ADMIN} />
            )}
          </>
        )}
      </EstadoVista>

      {/* Editar usuario */}
      <PanelLateral abierto={editar !== null} onCerrar={() => setEditar(null)} etiqueta="Editar usuario" testid="panel-usuario">
        {editar && <PanelEditar u={editar} esYo={editar.IDUsuario === usuario?.id} onCerrar={() => setEditar(null)} onCambio={invalidar} />}
      </PanelLateral>

      {/* Nuevo usuario interno */}
      <PanelLateral abierto={nuevo} onCerrar={() => setNuevo(false)} etiqueta="Nuevo usuario interno" testid="panel-nuevo-usuario">
        <PanelNuevo onCerrar={() => setNuevo(false)} onCreado={(u) => { invalidar(); setNuevo(false); setCreado(u); }} />
      </PanelLateral>

      {/* Contraseña temporal (una sola vez) */}
      <Modal
        abierto={creado !== null}
        titulo="Usuario creado"
        textoConfirmar="Listo"
        textoCancelar="Cerrar"
        alConfirmar={() => setCreado(null)}
        alCancelar={() => setCreado(null)}
      >
        <div className="text-texto">
          <p className="mb-2">Contraseña temporal de <strong>{creado?.Correo}</strong>:</p>
          <div className="flex items-center gap-2 rounded-12 border border-borde bg-fondo-2 px-3 py-2">
            <code data-testid="contrasena-temporal" className="flex-1 break-all font-mono text-sm font-bold text-marino-900">{creado?.contrasenaTemporal}</code>
            <button
              type="button"
              onClick={() => { if (creado?.contrasenaTemporal) void navigator.clipboard?.writeText(creado.contrasenaTemporal); }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-marino-600/10 text-marino-700 hover:bg-marino-600/20"
              aria-label="Copiar contraseña"
            >
              <IconoCopiar className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-apagado">No se volverá a mostrar; el usuario debe cambiarla en Mi cuenta.</p>
        </div>
      </Modal>
    </div>
  );
}

/* --------------------------------- Filas ---------------------------------- */

function EstadoUsuario({ u }: { u: UsuarioAdminFila }) {
  if (!u.Activo) return <span className="rounded-pill bg-apagado/15 px-2.5 py-1 text-xs font-semibold text-apagado">Desactivado</span>;
  if (u.MinutosBloqueo && u.MinutosBloqueo > 0) {
    return (
      <span className="inline-flex flex-col">
        <span className="w-fit rounded-pill bg-error/10 px-2.5 py-1 text-xs font-semibold text-error-texto">Bloqueado {u.MinutosBloqueo} min</span>
        <span className="mt-0.5 text-[11px] text-apagado">{u.IntentosFallidos} intentos fallidos</span>
      </span>
    );
  }
  return <span className="rounded-pill bg-exito/10 px-2.5 py-1 text-xs font-semibold text-exito-texto">Activo</span>;
}

function Pedidos({ u }: { u: UsuarioAdminFila }) {
  if (u.Rol !== 'Cliente') return <span className="text-apagado">—</span>;
  return <span className="text-texto">{u.CantidadPedidos} · {formatearQuetzales(u.TotalComprado)}</span>;
}

function Avatar({ u }: { u: UsuarioAdminFila }) {
  return (
    <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-pill text-sm font-extrabold', AVATAR_ROL[u.Rol])}>
      {u.Nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function Acciones({ u, esYo, onEditar, onDesbloquear }: { u: UsuarioAdminFila; esYo: boolean; onEditar: () => void; onDesbloquear: () => void }) {
  if (esYo) return <span className="text-xs text-apagado">tu cuenta</span>;
  return (
    <div className="flex items-center justify-end gap-3 text-xs font-semibold">
      {u.MinutosBloqueo && u.MinutosBloqueo > 0 ? (
        <button type="button" onClick={onDesbloquear} className="text-exito-texto hover:underline">Desbloquear</button>
      ) : null}
      <button type="button" onClick={onEditar} className="text-marino-700 hover:underline">Editar</button>
    </div>
  );
}

function FilaUsuario({ u, esYo, onEditar, onDesbloquear }: { u: UsuarioAdminFila; esYo: boolean; onEditar: () => void; onDesbloquear: () => void }) {
  return (
    <tr className={clsx('border-b border-borde last:border-0', !u.Activo && 'opacity-60')}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar u={u} />
          <div className="min-w-0">
            <p className="font-bold text-marino-900">{u.Nombre}</p>
            <p className="truncate text-xs text-apagado">{u.Correo}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><span className={clsx('rounded-pill px-2.5 py-1 text-xs font-semibold', PILL_ROL[u.Rol])}>{u.Rol}</span></td>
      <td className="hidden px-4 py-3 xl:table-cell"><Pedidos u={u} /></td>
      <td className="px-4 py-3"><EstadoUsuario u={u} /></td>
      <td className="px-4 py-3"><Acciones u={u} esYo={esYo} onEditar={onEditar} onDesbloquear={onDesbloquear} /></td>
    </tr>
  );
}

function TarjetaUsuario({ u, esYo, onEditar, onDesbloquear }: { u: UsuarioAdminFila; esYo: boolean; onEditar: () => void; onDesbloquear: () => void }) {
  return (
    <article className={clsx('rounded-20 border border-borde bg-white p-4 shadow-suave', !u.Activo && 'opacity-60')}>
      <div className="flex items-center gap-3">
        <Avatar u={u} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-marino-900">{u.Nombre}</p>
          <p className="truncate text-xs text-apagado">{u.Correo}</p>
        </div>
        <span className={clsx('rounded-pill px-2.5 py-1 text-xs font-semibold', PILL_ROL[u.Rol])}>{u.Rol}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Pedidos u={u} />
        <EstadoUsuario u={u} />
      </div>
      <div className="mt-3 border-t border-borde pt-3 text-right">
        <Acciones u={u} esYo={esYo} onEditar={onEditar} onDesbloquear={onDesbloquear} />
      </div>
    </article>
  );
}

/* ------------------------------ Panel editar ------------------------------ */

function PanelEditar({ u, esYo, onCerrar, onCambio }: { u: UsuarioAdminFila; esYo: boolean; onCerrar: () => void; onCambio: () => void }) {
  const { mostrar } = useToast();
  const [idRol, setIdRol] = useState(u.IDRol);
  const [activo, setActivo] = useState(u.Activo);
  const [confirmar, setConfirmar] = useState<null | { tipo: 'rol' | 'estado' }>(null);

  const rol = useMutation({
    mutationFn: (nuevoRol: number) => cambiarRolUsuario(u.IDUsuario, nuevoRol),
    onSuccess: () => { onCambio(); mostrar('Rol actualizado', 'exito'); onCerrar(); },
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo cambiar el rol', 'error'),
  });
  const estado = useMutation({
    mutationFn: (v: boolean) => cambiarEstadoUsuario(u.IDUsuario, v),
    onSuccess: () => { onCambio(); mostrar('Estado actualizado', 'exito'); onCerrar(); },
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo cambiar el estado', 'error'),
  });
  const desbloquear = useMutation({
    mutationFn: () => desbloquearUsuario(u.IDUsuario),
    onSuccess: () => { onCambio(); mostrar('Cuenta desbloqueada', 'exito'); onCerrar(); },
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo desbloquear', 'error'),
  });

  const rolCambia = idRol !== u.IDRol;
  const estadoCambia = activo !== u.Activo;

  const guardar = () => {
    // Confirmar si se promueve a Administrador o se desactiva.
    if (estadoCambia && !activo) { setConfirmar({ tipo: 'estado' }); return; }
    if (rolCambia && idRol === 3) { setConfirmar({ tipo: 'rol' }); return; }
    aplicar();
  };
  const aplicar = () => {
    if (rolCambia) rol.mutate(idRol);
    else if (estadoCambia) estado.mutate(activo);
    else onCerrar();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-borde p-4 sm:p-5">
        <h2 className="text-lg font-extrabold tracking-apretado text-marino-900">Editar usuario</h2>
        <button type="button" onClick={onCerrar} className="text-sm font-semibold text-apagado hover:text-marino-700">Cerrar</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-4">
          <Campo label="Nombre" value={u.Nombre} disabled readOnly ayuda="El usuario cambia su nombre en Mi cuenta" />
          <Campo label="Correo" value={u.Correo} disabled readOnly />

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-texto">Rol</span>
            <select
              value={idRol}
              disabled={esYo}
              onChange={(e) => setIdRol(Number(e.target.value))}
              className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600 disabled:bg-fondo-2"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
            <span className="text-xs text-apagado">Cambiar el rol o desactivar revoca sus sesiones (refresh tokens).</span>
          </label>

          <label className={clsx('flex items-center gap-2 text-sm font-semibold text-texto', esYo && 'opacity-60')}>
            <input type="checkbox" checked={activo} disabled={esYo} onChange={(e) => setActivo(e.target.checked)} className="h-4 w-4" />
            Cuenta activa
          </label>

          <div className="rounded-16 border border-borde p-3">
            <p className="text-xs font-bold uppercase tracking-ancho text-apagado">Intentos fallidos</p>
            <p className="mt-1 text-sm text-marino-900">
              {u.IntentosFallidos} intentos
              {u.MinutosBloqueo && u.MinutosBloqueo > 0 ? ` · bloqueado ${u.MinutosBloqueo} min` : ''}
            </p>
            {u.MinutosBloqueo && u.MinutosBloqueo > 0 && !esYo && (
              <button type="button" onClick={() => desbloquear.mutate()} className="mt-2 rounded-pill bg-exito/10 px-3 py-1.5 text-xs font-semibold text-exito-texto">
                Desbloquear
              </button>
            )}
          </div>

          {esYo && <p className="rounded-12 bg-fondo-2 px-3 py-2 text-xs text-apagado">Es tu propia cuenta: no puedes cambiar tu rol ni desactivarte.</p>}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-borde p-4 sm:p-5">
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} cargando={rol.isPending || estado.isPending} disabled={esYo || (!rolCambia && !estadoCambia)}>Guardar cambios</Boton>
      </div>

      <Modal
        abierto={confirmar !== null}
        titulo={confirmar?.tipo === 'rol' ? '¿Promover a Administrador?' : '¿Desactivar esta cuenta?'}
        textoConfirmar={confirmar?.tipo === 'rol' ? 'Promover' : 'Desactivar'}
        varianteConfirmar={confirmar?.tipo === 'rol' ? 'primario' : 'peligro'}
        cargando={rol.isPending || estado.isPending}
        alConfirmar={() => { setConfirmar(null); aplicar(); }}
        alCancelar={() => setConfirmar(null)}
      >
        {confirmar?.tipo === 'rol'
          ? 'Un administrador gestiona catálogo, cupones, usuarios y bitácora. Se revocarán sus sesiones activas.'
          : 'El usuario no podrá iniciar sesión y se revocarán sus sesiones activas.'}
      </Modal>
    </div>
  );
}

/* ------------------------------ Panel nuevo ------------------------------- */

function PanelNuevo({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (u: UsuarioCreado) => void }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [idRol, setIdRol] = useState(2); // Operador por defecto
  const [errorCorreo, setErrorCorreo] = useState<string | undefined>();

  const crear = useMutation({
    mutationFn: () => crearUsuarioInterno({ nombre: nombre.trim(), correo: correo.trim(), idRol }),
    onSuccess: (u) => onCreado(u),
    onError: (err) => {
      if (err instanceof ErrorApi && err.status === 409) setErrorCorreo('Ese correo ya está registrado');
      else setErrorCorreo(err instanceof ErrorApi ? err.mensaje : 'No se pudo crear el usuario');
    },
  });

  const enviar = () => {
    setErrorCorreo(undefined);
    if (nombre.trim().length < 2) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) { setErrorCorreo('Correo inválido'); return; }
    crear.mutate();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-borde p-4 sm:p-5">
        <h2 className="text-lg font-extrabold tracking-apretado text-marino-900">Nuevo usuario interno</h2>
        <button type="button" onClick={onCerrar} className="text-sm font-semibold text-apagado hover:text-marino-700">Cerrar</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-4">
          <Campo label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 150))} />
          <Campo label="Correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} error={errorCorreo} />
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-texto">Rol</span>
            <select value={idRol} onChange={(e) => setIdRol(Number(e.target.value))} className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600">
              <option value={2}>Operador</option>
              <option value={3}>Administrador</option>
            </select>
          </label>
          <p className="rounded-12 bg-fondo-2 px-3 py-2 text-xs text-apagado">
            El servidor genera una contraseña temporal que se mostrará una sola vez. Los clientes se registran desde la tienda.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-borde p-4 sm:p-5">
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={enviar} cargando={crear.isPending}>Crear usuario</Boton>
      </div>
    </div>
  );
}
