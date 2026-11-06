import { useEffect, useState } from 'react';
import { Modal } from '../../componentes/ui/Modal';

interface Props {
  abierto: boolean;
  numero: string;
  cargando: boolean;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}

/** Confirmacion de cancelacion con motivo opcional (la API exige un texto; se usa uno por defecto). */
export function ModalCancelar({ abierto, numero, cargando, onConfirmar, onCancelar }: Props) {
  const [motivo, setMotivo] = useState('');

  // Limpia el campo cada vez que se abre.
  useEffect(() => {
    if (abierto) setMotivo('');
  }, [abierto]);

  return (
    <Modal
      abierto={abierto}
      titulo={`¿Cancelar el pedido ${numero}?`}
      textoConfirmar="Sí, cancelar"
      textoCancelar="No, mantener"
      varianteConfirmar="peligro"
      cargando={cargando}
      alConfirmar={() => onConfirmar(motivo.trim() || 'Cancelado por el cliente')}
      alCancelar={onCancelar}
      alCerrar={cargando ? () => {} : onCancelar}
    >
      <p>Se reintegra la existencia y, si usaste cupón, recuperas su uso.</p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-texto">Motivo (opcional)</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="Cuéntanos por qué cancelas (opcional)"
          className="w-full resize-none rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm text-texto outline-none transition-colors placeholder:text-apagado focus:border-marino-600"
        />
      </label>
    </Modal>
  );
}
