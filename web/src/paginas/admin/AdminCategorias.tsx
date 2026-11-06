import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '../../auth/useAuth';
import { useCategoriasAdmin } from '../../lib/consultas';
import { claves } from '../../lib/claves';
import { ErrorApi } from '../../api/clienteHttp';
import * as admin from '../../api/admin';
import { Boton } from '../../componentes/ui/Boton';
import { Campo } from '../../componentes/ui/Campo';
import { Modal } from '../../componentes/ui/Modal';
import { EstadoVista } from '../../componentes/ui/EstadoVista';
import { useToast } from '../../componentes/ui/Toast';
import type { CategoriaAdmin } from '../../api/tipos';

export default function AdminCategorias() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'Administrador';
  const qc = useQueryClient();
  const { mostrar } = useToast();
  const { data, isPending, isError, refetch } = useCategoriasAdmin();

  const [form, setForm] = useState(false);
  const [editando, setEditando] = useState<CategoriaAdmin | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [aCambiar, setACambiar] = useState<CategoriaAdmin | null>(null);

  useEffect(() => {
    document.title = 'Categorías · Administración';
  }, []);

  const invalidar = () => void qc.invalidateQueries({ queryKey: claves.admin.todo });

  const guardar = useMutation({
    mutationFn: (v: { id: number | null; nombre: string; descripcion?: string }) =>
      v.id === null
        ? admin.crearCategoria({ nombre: v.nombre, descripcion: v.descripcion })
        : admin.actualizarCategoria(v.id, { nombre: v.nombre, descripcion: v.descripcion }),
    onSuccess: () => {
      invalidar();
      setForm(false);
      setEditando(null);
      mostrar('Categoría guardada', 'exito');
    },
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo guardar', 'error'),
  });

  const cambiarEstado = useMutation({
    mutationFn: (v: { id: number; activo: boolean }) => admin.cambiarEstadoCategoria(v.id, v.activo),
    onSuccess: () => {
      invalidar();
      setACambiar(null);
      mostrar('Estado actualizado', 'exito');
    },
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo cambiar', 'error'),
  });

  const abrirNueva = () => {
    setEditando(null);
    setNombre('');
    setDescripcion('');
    setForm(true);
  };
  const abrirEditar = (c: CategoriaAdmin) => {
    setEditando(c);
    setNombre(c.Nombre);
    setDescripcion(c.Descripcion ?? '');
    setForm(true);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Catálogo</p>
          <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">Categorías</h1>
        </div>
        {esAdmin && <Boton onClick={abrirNueva}>Nueva categoría</Boton>}
      </div>

      <EstadoVista
        cargando={isPending}
        error={isError}
        alReintentar={() => void refetch()}
        esqueleto={<div className="esqueleto h-64 w-full rounded-20" />}
      >
        {data && (
          <>
          <div className="hidden overflow-x-auto rounded-20 border border-borde bg-white shadow-suave lg:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs font-bold uppercase tracking-ancho text-apagado">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Productos</th>
                  <th className="px-4 py-3">Estado</th>
                  {esAdmin && <th className="px-4 py-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.IDCategoria} className={clsx('border-b border-borde last:border-0', !c.Activo && 'opacity-60')}>
                    <td className="px-4 py-3 font-bold text-marino-900">{c.Nombre}</td>
                    <td className="px-4 py-3 text-apagado">{c.Descripcion ?? '—'}</td>
                    <td className="px-4 py-3 text-texto">
                      {c.ProductosVisibles} / {c.CantidadProductosTotal}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'rounded-pill px-2.5 py-1 text-xs font-semibold',
                          c.Activo ? 'bg-exito/10 text-exito-texto' : 'bg-apagado/15 text-apagado',
                        )}
                      >
                        {c.Activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    {esAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3 text-xs font-semibold">
                          <button type="button" onClick={() => abrirEditar(c)} className="text-marino-700 hover:underline">
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              c.Activo ? setACambiar(c) : cambiarEstado.mutate({ id: c.IDCategoria, activo: true })
                            }
                            className={c.Activo ? 'text-error-texto hover:underline' : 'text-exito-texto hover:underline'}
                          >
                            {c.Activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Movil (<1024): tarjetas, sin scroll horizontal */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {data.map((c) => (
              <article
                key={c.IDCategoria}
                className={clsx('rounded-20 border border-borde bg-white p-4 shadow-suave', !c.Activo && 'opacity-60')}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-marino-900">{c.Nombre}</p>
                  <span
                    className={clsx(
                      'rounded-pill px-2.5 py-1 text-xs font-semibold',
                      c.Activo ? 'bg-exito/10 text-exito-texto' : 'bg-apagado/15 text-apagado',
                    )}
                  >
                    {c.Activo ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-apagado">{c.Descripcion ?? '—'}</p>
                <p className="mt-1 text-xs text-apagado">
                  {c.ProductosVisibles} / {c.CantidadProductosTotal} productos
                </p>
                {esAdmin && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => abrirEditar(c)}
                      className="rounded-pill bg-marino-600/10 px-4 py-2 text-sm font-semibold text-marino-700"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        c.Activo ? setACambiar(c) : cambiarEstado.mutate({ id: c.IDCategoria, activo: true })
                      }
                      className={clsx(
                        'rounded-pill border px-4 py-2 text-sm font-semibold',
                        c.Activo ? 'border-error/40 text-error-texto' : 'border-exito/40 text-exito-texto',
                      )}
                    >
                      {c.Activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          </>
        )}
      </EstadoVista>

      {/* Alta / edicion */}
      <Modal
        abierto={form}
        titulo={editando ? 'Editar categoría' : 'Nueva categoría'}
        textoConfirmar="Guardar"
        cargando={guardar.isPending}
        alConfirmar={() =>
          guardar.mutate({ id: editando?.IDCategoria ?? null, nombre: nombre.trim(), descripcion: descripcion.trim() || undefined })
        }
        alCancelar={() => setForm(false)}
      >
        <div className="grid gap-3">
          <Campo label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 100))} />
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-texto">Descripción (opcional)</span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value.slice(0, 300))}
              rows={3}
              className="resize-none rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600"
            />
          </label>
        </div>
      </Modal>

      {/* Confirmacion al desactivar */}
      <Modal
        abierto={aCambiar !== null}
        titulo="¿Desactivar esta categoría?"
        textoConfirmar="Desactivar"
        varianteConfirmar="peligro"
        cargando={cambiarEstado.isPending}
        alConfirmar={() => aCambiar && cambiarEstado.mutate({ id: aCambiar.IDCategoria, activo: false })}
        alCancelar={() => setACambiar(null)}
      >
        Esto oculta <strong>{aCambiar?.ProductosVisibles ?? 0}</strong>{' '}
        {aCambiar?.ProductosVisibles === 1 ? 'producto' : 'productos'} de la tienda. Podrás reactivarla luego.
      </Modal>
    </div>
  );
}
