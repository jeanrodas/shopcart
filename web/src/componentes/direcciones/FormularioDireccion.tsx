import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Boton } from '../ui/Boton';
import { Campo } from '../ui/Campo';
import type { Direccion, DireccionInput } from '../../api/tipos';

// Mismas reglas que direccionSchema de la API (sin caracteres de control ni < >).
const CONTROL = /[\u0000-\u001F\u007F<>]/;
const plano = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? 'Requerido' : `Mínimo ${min}`)
    .max(max, `Máximo ${max}`)
    .refine((v) => !CONTROL.test(v), 'No uses los símbolos < o >');

export const formDireccionSchema = z.object({
  alias: plano(50),
  nombreReceptor: plano(150),
  telefono: plano(20),
  departamento: plano(100),
  linea1: plano(200),
  linea2: plano(200, 0).optional(),
  municipio: plano(100),
  codigoPostal: plano(10, 0).optional(),
  referencia: plano(300, 0).optional(),
});
export type FormDireccion = z.infer<typeof formDireccionSchema>;

interface Props {
  inicial: Direccion | null;
  guardando: boolean;
  onGuardar: (datos: DireccionInput) => void;
  onCancelar: () => void;
  textoGuardar?: string;
}

/** Formulario de alta/edicion de direccion, compartido por checkout y "Mi cuenta". */
export function FormularioDireccion({
  inicial,
  guardando,
  onGuardar,
  onCancelar,
  textoGuardar = 'Guardar',
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormDireccion>({
    resolver: zodResolver(formDireccionSchema),
    defaultValues: inicial
      ? {
          alias: inicial.Alias,
          nombreReceptor: inicial.NombreReceptor,
          telefono: inicial.Telefono,
          departamento: inicial.Departamento,
          linea1: inicial.Linea1,
          linea2: inicial.Linea2 ?? '',
          municipio: inicial.Municipio,
          codigoPostal: inicial.CodigoPostal ?? '',
          referencia: inicial.Referencia ?? '',
        }
      : undefined,
  });

  const enviar = handleSubmit((d) => onGuardar(d as DireccionInput));

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="rounded-16 border border-marino-600/30 bg-marino-600/5 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Alias" placeholder="Casa, Oficina…" error={errors.alias?.message} {...register('alias')} />
        <Campo label="Quién recibe" error={errors.nombreReceptor?.message} {...register('nombreReceptor')} />
        <Campo label="Teléfono" error={errors.telefono?.message} {...register('telefono')} />
        <Campo label="Departamento" error={errors.departamento?.message} {...register('departamento')} />
        <div className="sm:col-span-2">
          <Campo label="Dirección (línea 1)" error={errors.linea1?.message} {...register('linea1')} />
        </div>
        <div className="sm:col-span-2">
          <Campo label="Línea 2 (opcional)" error={errors.linea2?.message} {...register('linea2')} />
        </div>
        <Campo label="Municipio" error={errors.municipio?.message} {...register('municipio')} />
        <Campo label="Código postal (opcional)" error={errors.codigoPostal?.message} {...register('codigoPostal')} />
        <div className="sm:col-span-2">
          <Campo label="Referencia (opcional)" error={errors.referencia?.message} {...register('referencia')} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <Boton type="button" variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={guardando}>
          {textoGuardar}
        </Boton>
      </div>
    </form>
  );
}
